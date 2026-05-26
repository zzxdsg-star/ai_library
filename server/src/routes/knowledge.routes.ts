import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { knowledgeService } from '../services/knowledge.service';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';
import {
  parseDocumentBuffer,
  computeBufferHash,
} from '../ingestion/parser';
import { publishDocumentProcessing } from '../queue/producer';

const prisma = new PrismaClient();

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
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.endsWith('.md')
    ) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          ErrorCodes.DOCUMENT_PARSE_FAILED,
          '不支持的文件格式，仅支持 PDF、Word、Markdown',
        ),
      );
    }
  },
});

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
    const kb = await knowledgeService.updateKB(req.params.id as string, req.user!.id, req.body);
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
    await publishDocumentProcessing(entry.id);
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
 * 发布 RabbitMQ（仅 entryId）→ Consumer 分块+Embedding → COMPLETED/FAILED。
 * 文件不落盘，全程在内存中处理。
 */
router.post('/:id/entries/upload', upload.single('file'), async (req: AuthRequest, res: Response, next: NextFunction) => {
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
    const text = await parseDocumentBuffer(buffer, fileName);

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

    // 发布异步任务（仅传 entryId，Consumer 从 DB 读取文本）
    await publishDocumentProcessing(entry.id);

    res.json({
      code: 0,
      data: { entry_id: entry.id, processing_status: 'PENDING' },
      message: 'ok',
    });
  } catch (e) {
    next(e);
  }
});

export default router;
