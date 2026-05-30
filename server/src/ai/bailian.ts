/**
 * 阿里云百炼 AI 客户端（基于 LangChain）。
 *
 * 百炼提供 OpenAI-compatible 接口，因此使用 LangChain 的
 * ChatOpenAI 和 OpenAIEmbeddings 并指向百炼的 baseURL。
 *
 * 封装两项核心能力：
 * 1. getEmbedding — 文本向量化（text-embedding-v3, 1024 维）
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
 * 百炼 text-embedding-v3 模型，默认 1024 维向量。
 * 构建函数参数 dimensions=1024 显式声明，确保与 pgvector 存储一致。
 */
const embeddings = new OpenAIEmbeddings({
  model: config.bailian.embeddingModel,
  apiKey: config.bailian.apiKey,
  configuration: { baseURL: BASE_URL },
  dimensions: 1024,
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
 * 百炼 text-embedding-v3 单次最多接受 10 条文本。
 * 此处按每批 10 条拆分，逐批调用后合并结果。
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 10;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchResults = await embeddings.embedDocuments(batch);
    results.push(...batchResults);
  }

  return results;
}

/**
 * 视觉模型看图生成文字描述。
 *
 * qwen-vl-plus 接收图片并输出中文描述（100-200 字）。
 * 使用 LangChain ChatOpenAI 的多模态 content 格式
 * （数组，包含 text 和 image_url 两种 block）。
 */
export async function describeImage(base64Image: string, mimeType: string, context?: string): Promise<string> {
  const visionModel = new ChatOpenAI({
    model: config.bailian.visionModel,
    apiKey: config.bailian.apiKey,
    configuration: { baseURL: BASE_URL },
    temperature: 0.3,
    maxTokens: 512,
  });

  const hasContext = context && context.trim();
  const prompt = hasContext
    ? `请结合以下文档上下文，用中文详细描述这张图片的内容（包括关键信息、主体、场景和重要细节，约100-200字）。只输出描述文字，不要加"这张图片"开头。\n\n文档上下文：\n${context.slice(0, 1500)}`
    : '请用中文详细描述这张图片的内容，包括关键信息、主体、场景和重要细节，约100-200字。只输出描述文字，不要加"这张图片"开头。';

  const response = await visionModel.invoke([
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64Image}` },
        },
      ],
    },
  ]);

  const content = typeof response.content === 'string'
    ? response.content
    : Array.isArray(response.content)
      ? response.content.map((c: any) => c.text || '').join('')
      : '';
  return content.trim();
}

/**
 * 非流式 LLM 对话（返回完整结果）。
 * 用于知识提炼等需要一次性获取完整响应的场景。
 */
export async function chat(
  messages: Array<{ role: string; content: string }>,
  temperature?: number,
): Promise<string> {
  const model = temperature !== undefined
    ? new ChatOpenAI({
        model: config.bailian.llmModel,
        apiKey: config.bailian.apiKey,
        configuration: { baseURL: BASE_URL },
        temperature,
        maxTokens: 2048,
      })
    : chatModel;
  const response = await model.invoke(
    messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    })),
  );
  return typeof response.content === 'string' ? response.content : '';
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
