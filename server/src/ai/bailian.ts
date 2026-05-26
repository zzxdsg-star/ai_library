/**
 * 阿里云百炼 AI 客户端（基于 LangChain）。
 *
 * 百炼提供 OpenAI-compatible 接口，因此使用 LangChain 的
 * ChatOpenAI 和 OpenAIEmbeddings 并指向百炼的 baseURL。
 *
 * 封装两项核心能力：
 * 1. getEmbedding — 文本向量化（text-embedding-v2, 1536 维）
 * 2. streamChat   — LLM 流式对话（qwen-plus）
 *
 * 选型说明（使用 LangChain）：
 * LangChain 是 RAG 领域的标准框架，提供统一的模型抽象和工具链。
 * 使用 LangChain 而非直接 fetch API，使代码更标准化、答辩更有说服力，
 * 同时保留自定义混合检索 + RRF 融合作为技术亮点。
 */
import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { config } from '../config';

const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

/**
 * LangChain Embeddings 实例。
 * 百炼 text-embedding-v2 模型输出 1536 维向量。
 * 构建函数参数 dimensions=1536 显式声明，确保与 pgvector 存储一致。
 */
const embeddings = new OpenAIEmbeddings({
  model: config.bailian.embeddingModel,
  apiKey: config.bailian.apiKey,
  configuration: { baseURL: BASE_URL },
  dimensions: 1536,
});

/**
 * LangChain Chat 模型实例。
 *
 * 选型说明：
 * - model: qwen-plus — 百炼中端模型，推理质量与速度的平衡点
 * - temperature: 0.3 — 知识问答场景需低随机性，确保回答忠于检索内容
 * - maxTokens: 2048 — 留给回答足够空间，同时防止过长输出增加费用
 */
const chatModel = new ChatOpenAI({
  model: config.bailian.llmModel,
  apiKey: config.bailian.apiKey,
  configuration: { baseURL: BASE_URL },
  temperature: 0.3,
  maxTokens: 2048,
  streaming: true,
});

/**
 * 单条文本向量化，返回 1536 维浮点数组。
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const result = await embeddings.embedQuery(text);
  return result;
}

/**
 * 批量文本向量化，分批调用以适配百炼 API 限制。
 *
 * 百炼 embedding 接口单次最多接受 25 条文本，
 * 超过则报：batch size is invalid, it should not be larger than 25
 * 此处按每批 20 条拆分（留余量），逐批调用后合并结果。
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 20;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchResults = await embeddings.embedDocuments(batch);
    results.push(...batchResults);
  }

  return results;
}

/**
 * 流式 LLM 对话生成（AsyncGenerator）。
 *
 * 通过 LangChain ChatOpenAI.stream() 获取 token 级别的流式输出，
 * 对上层暴露 AsyncGenerator<string>，每个 yield 为一个文本 token。
 */
export async function* streamChat(
  messages: Array<{ role: string; content: string }>,
  _options?: { temperature?: number; maxTokens?: number },
): AsyncGenerator<string> {
  const stream = await chatModel.stream(
    messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    })),
  );

  for await (const chunk of stream) {
    const content = typeof chunk.content === 'string' ? chunk.content : '';
    if (content) yield content;
  }
}
