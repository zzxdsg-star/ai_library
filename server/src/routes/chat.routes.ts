import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { chatService } from '../services/chat.service';
import { knowledgeService } from '../services/knowledge.service';
import { hybridSearch } from '../rag/retriever';
import { generateAnswer } from '../rag/generator';
import { chat } from '../ai/bailian';
import { cacheDelPattern } from '../cache/redis';
import { publishDocumentProcessing } from '../queue/producer';
import { computeBufferHash } from '../ingestion/parser';

const router = Router();
router.use(authMiddleware);

/**
 * POST /:id/chat/sessions — 创建对话会话。
 */
router.post('/:id/chat/sessions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await chatService.createSession(req.params.id as string, req.user!.id);
    res.json({ code: 0, data: session, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /:id/chat/sessions — 获取当前知识库下的所有会话列表。
 */
router.get('/:id/chat/sessions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessions = await chatService.listSessions(req.params.id as string, req.user!.id);
    res.json({ code: 0, data: sessions, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /:id/chat/sessions/:sid — 获取指定会话的历史消息。
 */
router.get('/:id/chat/sessions/:sid', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const messages = await chatService.getMessages(req.params.sid as string, req.user!.id);
    res.json({ code: 0, data: messages, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /:id/chat/sessions/:sid — 删除会话。
 */
router.delete('/:id/chat/sessions/:sid', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await chatService.deleteSession(req.params.sid as string, req.user!.id);
    res.json({ code: 0, data: null, message: 'ok' });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /:id/chat/sessions/:sid/messages — 发送消息并 SSE 流式返回 AI 回答。
 *
 * 完整 RAG 对话流程：
 * 1. 保存用户消息
 * 2. 获取历史对话（多轮上下文）
 * 3. 混合检索 → 拼接上下文
 * 4. 调用百炼 LLM 流式生成
 * 5. SSE 推送至前端
 * 6. 保存 AI 回复（含引用和 token 用量）
 *
 * SSE 格式：text/event-stream
 *   data: {"type":"chunk","content":"...","is_end":false}
 *   data: {"type":"done","is_end":true,"references":[...],"usage":{...}}
 */
router.post('/:id/chat/sessions/:sid/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const kbId = req.params.id as string;
    const sid = req.params.sid as string;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ code: 5000, message: '请输入问题', data: null });
      return;
    }

    // 获取知识库信息（含自定义 system_prompt）
    const kb = await knowledgeService.getKB(kbId, req.user!.id);

    // 保存用户消息
    await chatService.saveMessage(sid, 'USER', content);

    // 获取历史对话（多轮对话上下文）
    const history = await chatService.getMessages(sid, req.user!.id);
    const chatHistory = history.slice(0, -1).map((m) => ({
      role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }));

    // 混合检索
    const searchResults = await hybridSearch(content, kbId);

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream;charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let fullContent = '';
    let lastRefs: any = null;
    let lastUsage: any = null;

    try {
      for await (const event of generateAnswer({
        query: content,
        searchResults,
        systemPrompt: kb.system_prompt,
        chatHistory,
      })) {
        if (event.type === 'chunk') {
          fullContent += event.content!;
          res.write(
            `data: ${JSON.stringify({ type: 'chunk', content: event.content, is_end: false })}\n\n`,
          );
        } else if (event.type === 'done') {
          lastRefs = event.references;
          lastUsage = event.usage;
        }
      }

      // 保存 AI 消息
      await chatService.saveMessage(sid, 'ASSISTANT', fullContent, lastRefs, lastUsage);

      // 发送完成事件
      res.write(
        `data: ${JSON.stringify({ type: 'done', is_end: true, references: lastRefs, usage: lastUsage })}\n\n`,
      );
      res.end();
    } catch (streamError: any) {
      res.write(
        `data: ${JSON.stringify({ type: 'done', is_end: true, content: `生成回答时出错: ${streamError.message}` })}\n\n`,
      );
      res.end();
    }
  } catch (e) {
    next(e);
  }
});

/**
 * POST /:id/chat/extract — 从对话中提炼新知识。
 *
 * 读取知识库下所有对话消息 → 发给 qwen-plus 分析 → 解析出知识点 →
 * 批量创建 KnowledgeEntry → 返回创建结果。
 * 可选传 sessionId 限定单会话。
 */
router.post('/:id/chat/extract', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const kbId = req.params.id as string;
    const userId = req.user!.id;
    const { sessionId } = req.body || {};

    // 1. 验证知识库归属
    await knowledgeService.getKB(kbId, userId);

    // 2. 收集对话消息
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    type ChatMessage = { role: string; content: string; createdAt: Date; sessionId: string };
    const allMessages = await prisma.chatMessage.findMany({
      where: sessionId
        ? { session: { id: sessionId, kbId, userId } }
        : { session: { kbId, userId } },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true, createdAt: true, sessionId: true },
    });

    if (allMessages.length === 0) {
      res.json({ code: 0, data: { entries: [] }, message: '没有对话记录可提炼' });
      return;
    }

    // 3. 分会话提取（每个会话独立提炼，互不干扰）
    const sessions = new Map<string, ChatMessage[]>();
    for (const m of allMessages) {
      const list = sessions.get(m.sessionId) || [];
      list.push(m);
      sessions.set(m.sessionId, list);
    }

    const systemPrompt = `你是一个知识提炼专家。请分析以下对话记录，从中提取出有价值的知识点。要求：
1. 标题用 "## " 开头，正文用 Markdown 格式，正文不少于 200 字
2. 正文包含核心要点和关键信息
3. 各知识点之间用 "---" 分隔
4. 忽略纯闲聊和问候
5. 如果没有可提炼的知识，返回 "NONE"`;

    const extractSession = async (msgs: ChatMessage[]): Promise<string[]> => {
      const text = msgs
        .reverse()
        .map((m) => `[${m.role === 'USER' ? '用户' : 'AI'}] ${m.content.slice(0, 800)}`)
        .join('\n\n');
      const preview = text.slice(0, 16000);

      const response = await chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `对话记录：\n${preview}` },
      ], 0.3);

      if (!response || response.trim() === 'NONE') return [];
      return response.split('---').map((s: string) => s.trim()).filter(Boolean);
    };

    // 4. 并行调用 LLM，每个会话独立提炼
    const allSections = (
      await Promise.all(
        Array.from(sessions.values()).map((msgs) => extractSession(msgs)),
      )
    ).flat();

    // 5. 解析并入库
    const createdEntries: Array<{ id: string; title: string }> = [];

    for (const section of allSections) {
      const titleMatch = section.match(/^##\s+(.+)/);
      if (!titleMatch) continue;
      const title = titleMatch[1].trim().slice(0, 200);
      const content = section.replace(/^##\s+.+\n?/, '').trim();
      if (!content || content.length < 200) continue;

      try {
        const existingByTitle = await prisma.knowledgeEntry.findFirst({
          where: { kbId, title },
        });
        if (existingByTitle) continue;

        const contentHash = computeBufferHash(Buffer.from(content));
        const existingByHash = await prisma.knowledgeEntry.findFirst({
          where: { kbId, sourceFileHash: contentHash },
        });
        if (existingByHash) continue;

        const entry = await prisma.knowledgeEntry.create({
          data: {
            kbId, title, content,
            type: 'MANUAL',
            processingStatus: 'PENDING',
            sourceFileHash: contentHash,
          },
        });
        await publishDocumentProcessing(entry.id, content);
        createdEntries.push({ id: entry.id, title });
      } catch { /* 单条失败不影响其他 */ }
    }

    await cacheDelPattern(`entry:${kbId}:*`);

    res.json({
      code: 0,
      data: { entries: createdEntries, count: createdEntries.length },
      message: createdEntries.length > 0 ? `成功提炼 ${createdEntries.length} 条知识` : '未提炼到新知识',
    });
  } catch (e) {
    next(e);
  }
});

export default router;
