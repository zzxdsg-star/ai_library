import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { knowledgeService } from '../services/knowledge.service';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';
import {
  parseDocumentBuffer,
  computeBufferHash,
} from '../ingestion/parser';
import { publishDocumentProcessing } from '../queue/producer';
import { cacheDelPattern } from '../cache/redis';
import { describeImage } from '../ai/bailian';
import { uploadImage } from '../storage/oss';

const router = Router();
router.use(authMiddleware);

/**
 * Multer 配置：内存存储（不落盘），限制 20MB，
 * 仅允许 PDF、Word、Markdown、纯文本。
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
      'text/plain',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.endsWith('.md') ||
      file.originalname.endsWith('.csv') ||
      file.originalname.endsWith('.xlsx')
    ) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          ErrorCodes.DOCUMENT_PARSE_FAILED,
          '不支持的文件格式，仅支持 PDF、Word、Markdown、CSV、Excel',
        ),
      );
    }
  },
});

/**
 * 图片上传 multer 实例：仅 PNG/JPG，限制 5MB。
 */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          ErrorCodes.DOCUMENT_PARSE_FAILED,
          '不支持的图片格式，仅支持 PNG、JPG',
        ),
      );
    }
  },
});

/**
 * 包装 multer 中间件，将 MulterError（如文件过大）转为 AppError 中文提示。
 */
function handleDocUpload(req: AuthRequest, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(ErrorCodes.DOCUMENT_PARSE_FAILED, '文件过大，最大支持 20MB'));
      }
      return next(new AppError(ErrorCodes.DOCUMENT_PARSE_FAILED, err.message || '文件上传失败'));
    }
    next();
  });
}

function handleImageUpload(req: AuthRequest, res: Response, next: NextFunction) {
  imageUpload.array('images', 10)(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(ErrorCodes.DOCUMENT_PARSE_FAILED, '图片过大，单张最大 5MB'));
      }
      return next(new AppError(ErrorCodes.DOCUMENT_PARSE_FAILED, err.message || '图片上传失败'));
    }
    next();
  });
}

// ==================== Knowledge Bases ====================

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description, system_prompt } = req.body;
    const kb = await knowledgeService.createKB(req.user!.id, name, description, system_prompt);
    res.json({ code: 0, data: kb, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 10;
    const result = await knowledgeService.listKB(req.user!.id, page, size);
    res.json({ code: 0, data: result, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const kb = await knowledgeService.getKB(req.params.id as string, req.user!.id);
    res.json({ code: 0, data: kb, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // API 层 snake_case → Prisma camelCase 映射
    const { system_prompt, ...rest } = req.body;
    const data = { ...rest, ...(system_prompt !== undefined ? { systemPrompt: system_prompt } : {}) };
    const kb = await knowledgeService.updateKB(req.params.id as string, req.user!.id, data);
    res.json({ code: 0, data: kb, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await knowledgeService.deleteKB(req.params.id as string, req.user!.id);
    res.json({ code: 0, data: null, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

// ==================== Knowledge Entries ====================

router.post('/:id/entries', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, content } = req.body;
    const entry = await knowledgeService.createEntry(
      req.params.id as string,
      req.user!.id,
      title,
      content,
    );
    // 手动录入的条目也走异步 embedding 管线
    await publishDocumentProcessing(entry.id, content);
    res.json({ code: 0, data: entry, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/entries', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 10;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const result = await knowledgeService.listEntries(
      req.params.id as string,
      req.user!.id,
      page,
      size,
      search,
      status,
    );
    res.json({ code: 0, data: result, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/entries/:eid', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entry = await knowledgeService.getEntry(req.params.eid as string, req.user!.id);
    res.json({ code: 0, data: entry, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

router.put('/:id/entries/:eid', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entry = await knowledgeService.updateEntry(req.params.eid as string, req.user!.id, req.body);
    res.json({ code: 0, data: entry, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id/entries/:eid', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await knowledgeService.deleteEntry(req.params.eid as string, req.user!.id);
    res.json({ code: 0, data: null, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/entries/:eid/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const entry = await knowledgeService.updateEntryStatus(req.params.eid as string, req.user!.id, status);
    res.json({ code: 0, data: entry, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

/**
 * 修复 multer/busboy 对中文文件名的 Latin-1 误读。
 * 将 JS 字符串按 Latin-1 还原为原始字节 → UTF-8 重新解码。
 */
function decodeFilename(name: string): string {
  try {
    const bytes = Buffer.from(name, 'latin1');
    const utf8 = bytes.toString('utf-8');
    if (!utf8.includes('�') && utf8 !== name) {
      return utf8;
    }
  } catch { /* ignore */ }
  return name;
}

/**
 * POST /:id/entries/upload — 文档上传 + 内存解析 + 异步入库。
 *
 * 流程：上传 → 内存解析文本 → SHA256 去重 → 创建 entry（含原文）→
 * 发布 RabbitMQ → Consumer 分块+Embedding → COMPLETED/FAILED。
 * 文件不落盘，全程在内存中处理。
 */
router.post('/:id/entries/upload', handleDocUpload, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError(ErrorCodes.DOCUMENT_PARSE_FAILED, '请选择文件');
    }

    const kbId = req.params.id as string;
    const buffer = req.file.buffer;
    const fileName = decodeFilename(req.file.originalname);
    const fileHash = computeBufferHash(buffer);

    // SHA256 去重
    const existingEntry = await prisma.knowledgeEntry.findFirst({
      where: { kbId, sourceFileHash: fileHash },
    });
    if (existingEntry) {
      res.json({
        code: 0,
        data: {
          entry_id: existingEntry.id,
          processing_status: existingEntry.processingStatus,
        },
        message: '文件已存在',
      });
      return;
    }

    // 在内存中解析文档文本
    let text: string;
    try {
      text = await parseDocumentBuffer(buffer, fileName);
    } catch (parseErr) {
      throw new AppError(
        ErrorCodes.DOCUMENT_PARSE_FAILED,
        `文档解析失败: ${(parseErr as Error).message}`,
      );
    }

    // 创建 entry 并写入解析后的原文
    const entry = await prisma.knowledgeEntry.create({
      data: {
        kbId,
        title: fileName,
        content: text,
        type: 'FILE',
        processingStatus: 'PENDING',
        sourceFileName: fileName,
        sourceFileHash: fileHash,
      },
    });

    // 失效条目列表缓存
    await cacheDelPattern(`entry:${kbId}:*`);

    // 发布异步任务（text 随消息传递，避免 Consumer 从 DB 读取时写延迟）
    await publishDocumentProcessing(entry.id, text);

    res.json({
      code: 0,
      data: { entry_id: entry.id, processing_status: 'PENDING' },
      message: 'ok',
    });
  } catch (e) {
    if (e instanceof AppError) return next(e);
    next(new AppError(ErrorCodes.DOCUMENT_PARSE_FAILED, (e as Error).message || '文件处理失败'));
  }
});

/**
 * POST /:id/entries/upload-images — 批量上传图片。
 *
 * 流程：上传多张图片 → 存 OSS → 调用 qwen-vl-plus 生成描述 →
 * 创建 KnowledgeEntry(content=描述+图片URL) → 异步 Embedding。
 */
router.post(
  '/:id/entries/upload-images',
  handleImageUpload,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const kbId = req.params.id as string;
      const userId = req.user!.id;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        throw new AppError(ErrorCodes.DOCUMENT_PARSE_FAILED, '请选择图片');
      }

      // 先验证知识库归属
      await knowledgeService.getKB(kbId, userId);

      const results: Array<{ entry_id: string; title: string }> = [];

      for (const file of files) {
        const fileName = decodeFilename(file.originalname);
        const fileHash = computeBufferHash(file.buffer);

        // SHA256 去重
        const existingEntry = await prisma.knowledgeEntry.findFirst({
          where: { kbId, sourceFileHash: fileHash },
        });
        if (existingEntry) {
          results.push({
            entry_id: existingEntry.id,
            title: fileName,
          });
          continue;
        }

        // 创建 entry 先获取 ID
        const entry = await prisma.knowledgeEntry.create({
          data: {
            kbId,
            title: fileName,
            content: '', // 待填充
            type: 'FILE',
            processingStatus: 'PROCESSING',
            sourceFileName: fileName,
            sourceFileHash: fileHash,
          },
        });

        try {
          // 上传 OSS
          const imageUrl = await uploadImage(userId, entry.id, file.buffer, file.mimetype);

          // 调用视觉模型生成描述
          const base64 = file.buffer.toString('base64');
          const description = await describeImage(base64, file.mimetype);

          // 拼接内容：描述 + 图片引用
          const content = `${description}\n\n![](${imageUrl})`;

          // 更新 entry content + 触发异步 Embedding
          await prisma.knowledgeEntry.update({
            where: { id: entry.id },
            data: { content, processingStatus: 'PENDING' },
          });

          await publishDocumentProcessing(entry.id, content);

          results.push({ entry_id: entry.id, title: fileName });
        } catch (err) {
          // 视觉模型或 OSS 失败时标记为 FAILED
          await prisma.knowledgeEntry.update({
            where: { id: entry.id },
            data: {
              processingStatus: 'FAILED',
              processingMessage: `图片处理失败: ${(err as Error).message}`,
            },
          });
          results.push({ entry_id: entry.id, title: fileName });
        }
      }

      await cacheDelPattern(`entry:${kbId}:*`);

      res.json({
        code: 0,
        data: { entries: results },
        message: 'ok',
      });
    } catch (e) {
      if (e instanceof AppError) return next(e);
      next(new AppError(ErrorCodes.DOCUMENT_PARSE_FAILED, (e as Error).message || '图片处理失败'));
    }
  },
);

export default router;
