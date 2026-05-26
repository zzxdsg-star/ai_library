/**
 * RAG 回答生成器（基于 LangChain）。
 *
 * 使用 LangChain ChatOpenAI 的流式接口逐 token 产出回答。
 * AsyncGenerator 模式对接 SSE 推送至前端。
 *
 * 选型说明：
 * - temperature=0.3：知识问答场景需低随机性，确保回答忠于检索内容
 * - maxTokens=2048：留给回答足够空间，同时防止过长输出
 * - system prompt：默认要求引用参考资料编号，支持知识库级自定义
 * - 使用 LangChain 的 ChatOpenAI.stream() 而非直接 fetch：
 *   LangChain 提供统一的流式接口，token 级别控制更精细
 */
import { streamChat } from '../ai/bailian';
import type { Reference } from 'shared';
import type { SearchResult } from './retriever';

interface GenerateInput {
  query: string;
  searchResults: SearchResult[];
  systemPrompt?: string | null;
  chatHistory?: Array<{ role: string; content: string }>;
}

export async function* generateAnswer(
  input: GenerateInput,
): AsyncGenerator<{
  type: 'chunk' | 'done';
  content?: string;
  references?: Reference[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}> {
  const { query, searchResults, systemPrompt, chatHistory } = input;

  // 拼接检索上下文（LangChain 处理检索结果格式化）
  const context = searchResults
    .map(
      (r, i) =>
        `[参考资料${i + 1}]\n标题: ${r.entryTitle}\n内容: ${r.content}`,
    )
    .join('\n\n');

  const defaultSystemPrompt =
    '你是一个专业的知识库助手，请根据提供的参考资料回答问题。如果参考资料中没有相关信息，请如实告知用户。回答时请引用具体的参考资料编号。';

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt || defaultSystemPrompt },
    ...(chatHistory || []),
    {
      role: 'user',
      content: `参考资料：\n${context}\n\n用户问题：${query}`,
    },
  ];

  // 构建引用列表（截取前 200 字符作为摘要）
  const references: Reference[] = searchResults.map((r) => ({
    id: r.entryId,
    title: r.entryTitle,
    content: r.content.slice(0, 200),
  }));

  let fullContent = '';

  // LangChain ChatOpenAI.stream() → token 级别的流式生成
  for await (const token of streamChat(messages, {
    temperature: 0.3,
    maxTokens: 2048,
  })) {
    fullContent += token;
    yield { type: 'chunk', content: token };
  }

  // 粗略估算 token 用量（中文约 2 chars ≈ 1 token）
  const promptTokens = Math.ceil(
    messages.reduce((sum, m) => sum + m.content.length, 0) / 2,
  );
  const completionTokens = Math.ceil(fullContent.length / 2);

  yield {
    type: 'done',
    references,
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
  };
}
