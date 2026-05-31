import { prisma } from '../lib/prisma';
import schedule from 'node-schedule';
import { chat } from '../ai/bailian';
import { computeBufferHash } from '../ingestion/parser';
import { cacheGet, cacheSet, cacheDelPattern } from '../cache/redis';
import { publishDocumentProcessing } from '../queue/producer';

/**
 * 自动知识提炼服务。
 *
 * 定时扫描所有知识库，对产生新对话的 KB 自动提取知识点。
 *
 * 调度规则：每天凌晨 4:30 执行（cron: 30 4 * * *）。
 */
export function startAutoExtract() {
  // 每天凌晨 4:30 执行
  schedule.scheduleJob('30 4 * * *', async () => {
    console.log('[AutoExtract] 开始定时扫描...');
    try {
      await runAutoExtract();
      console.log('[AutoExtract] 扫描完成');
    } catch (err) {
      console.error('[AutoExtract] 扫描异常:', (err as Error).message);
    }
  });

  console.log('[AutoExtract] 定时任务已启动（每天凌晨 4:30）');
}

async function runAutoExtract() {
  // 获取所有有对话记录的知识库
  const activeKBs = await prisma.chatSession.groupBy({
    by: ['kbId'],
    _count: { id: true },
  });

  for (const { kbId } of activeKBs) {
    try {
      // 检查上次提炼时间
      const lastExtractTime = await cacheGet<string>(`autoextract:last:${kbId}`);
      const sinceTime = lastExtractTime
        ? new Date(lastExtractTime)
        : new Date(Date.now() - 24 * 60 * 60 * 1000); // 首次：只扫最近 24 小时

      // 获取新消息（带 sessionId 用于分组）
      const newMessages = await prisma.chatMessage.findMany({
        where: {
          session: { kbId },
          createdAt: { gt: sinceTime },
        },
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true, sessionId: true },
      });

      // 按会话分组
      const sessions = new Map<string, typeof newMessages>();
      for (const m of newMessages) {
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

      const extractSession = async (msgs: typeof newMessages): Promise<string[]> => {
        const userMsgs = msgs.filter((m) => m.role === 'USER').length;
        if (userMsgs < 2) return [];

        const text = msgs
          .reverse()
          .map((m) => `[${m.role === 'USER' ? '用户' : 'AI'}] ${m.content.slice(0, 800)}`)
          .join('\n\n');
        const preview = text.slice(0, 16000);

        const response = await chat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `对话记录：\n${preview}` },
        ], 0.5);

        if (!response || response.trim() === 'NONE') return [];
        return response.split('---').map((s: string) => s.trim()).filter(Boolean);
      };

      // 并行提炼每个会话
      const allSections = (
        await Promise.all(
          Array.from(sessions.values()).map((msgs) => extractSession(msgs)),
        )
      ).flat();

      // 更新提取时间
      if (newMessages.length > 0) {
        await cacheSet(`autoextract:last:${kbId}`, new Date().toISOString(), 86400);
      }

      if (allSections.length === 0) continue;

      // 解析并入库
      let created = 0;

      for (const section of allSections) {
        const titleMatch = section.match(/^##\s+(.+)/);
        if (!titleMatch) continue;
        const title = titleMatch[1].trim().slice(0, 200);
        const content = section.replace(/^##\s+.+\n?/, '').trim();
        if (!content || content.length < 200) continue;

        // SHA256 去重
        const contentHash = computeBufferHash(Buffer.from(content));
        const existingByTitle = await prisma.knowledgeEntry.findFirst({
          where: { kbId, title },
        });
        if (existingByTitle) continue;

        const existingByHash = await prisma.knowledgeEntry.findFirst({
          where: { kbId, sourceFileHash: contentHash },
        });
        if (existingByHash) continue;

        try {
          const entry = await prisma.knowledgeEntry.create({
            data: {
              kbId, title, content,
              type: 'MANUAL',
              processingStatus: 'PENDING',
              sourceFileHash: contentHash,
            },
          });
          await publishDocumentProcessing(entry.id, content);
          created++;
        } catch { /* 单条失败不影响 */ }
      }

      if (created > 0) {
        await cacheDelPattern(`entry:${kbId}:*`);
        console.log(`[AutoExtract] KB ${kbId} 提炼 ${created} 条知识`);
      }
    } catch (err) {
      console.error(`[AutoExtract] KB ${kbId} 出错:`, (err as Error).message);
    }
  }
}
