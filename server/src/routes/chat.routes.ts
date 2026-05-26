import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { chatService } from '../services/chat.service';
import { knowledgeService } from '../services/knowledge.service';
import { hybridSearch } from '../rag/retriever';
import { generateAnswer } from '../rag/generator';

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

export default router;
