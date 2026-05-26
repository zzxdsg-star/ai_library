import { Router, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { knowledgeService } from '../services/knowledge.service';
import { AppError } from '../errors/app-error';
import { ErrorCodes } from '../errors/error-codes';
import { computeFileHash } from '../ingestion/parser';
import { publishDocumentProcessing } from '../queue/producer';

const prisma = new PrismaClient();

const router = Router();
router.use(authMiddleware);

/**
 * Multer 配置：文件存入 server/uploads/ 目录，限制 20MB，
 * 仅允许 PDF、Word、Markdown、纯文本。
 */
const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.md')) {
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
    const entry = await knowledgeService.createEntry(req.params.id as string, req.user!.id, title, content);
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
 * POST /:id/entries/upload — 文档上传 + 异步入库。
 *
 * 流程：上传文件 → SHA256 去重 → 创建 entry(PENDING) →
 * 发布 RabbitMQ 消息 → Consumer 异步分块+Embedding → 更新状态。
 * 前端轮询 GET /entries/:eid 获取 processing_status 变化。
 */
router.post('/:id/entries/upload', upload.single('file'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError(ErrorCodes.DOCUMENT_PARSE_FAILED, '请选择文件');
    }

    const kbId = req.params.id as string;
    const filePath = req.file.path;
    const fileHash = await computeFileHash(filePath);

    // 去重检查：相同 SHA256 的文件不重复入库
    const existingEntry = await prisma.knowledgeEntry.findFirst({
      where: { kbId, sourceFileHash: fileHash },
    });
    if (existingEntry) {
      await fs.unlink(filePath); // 删除重复的临时文件
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

    // 创建 entry 并发布异步任务
    const entry = await prisma.knowledgeEntry.create({
      data: {
        kbId,
        title: req.file.originalname,
        content: '',
        type: 'FILE',
        processingStatus: 'PENDING',
        sourceFileName: req.file.originalname,
        sourceFileHash: fileHash,
      },
    });

    await publishDocumentProcessing(entry.id, filePath);

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
