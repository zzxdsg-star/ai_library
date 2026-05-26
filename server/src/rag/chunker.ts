/**
 * 文本智能分块器（基于 LangChain RecursiveCharacterTextSplitter）。
 *
 * 使用 LangChain 标准的分块策略：按段落 → 句子 → 字符的优先级递归分割。
 *
 * 选型说明：
 * - chunkSize=512 tokens（约 2048 chars for 中文）：
 *   在语义完整性和检索精度间取平衡。
 *   过小（<256）切断语义，过大（>1024）降低检索相关性。
 * - chunkOverlap=50 tokens（约 200 chars）：
 *   约 10% 重叠，遵循信息检索领域经验法则，
 *   防止关键事实落在分块边界被截断。
 * - 使用 RecursiveCharacterTextSplitter 而非自己实现：
 *   LangChain 实现经过了大量验证，分离器优先级（段落>句子>字符）
 *   与中文文本特性兼容良好。
 */
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { Document } from '@langchain/core/documents';

export interface Chunk {
  index: number;
  content: string;
}

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 2048,       // ~512 tokens for Chinese
  chunkOverlap: 200,     // ~50 tokens overlap
  separators: [
    '\n\n',     // 优先按段落分割
    '\n',       // 其次按换行分割
    '。',       // 中文句号
    '！',       // 中文感叹号
    '？',       // 中文问号
    '.',        // 英文句号
    '!',        // 英文感叹号
    '?',        // 英文问号
    '；',       // 中文分号
    ';',        // 英文分号
    ' ',        // 空格兜底
    '',         // 字符级兜底
  ],
});

/**
 * 将文本分块并转换为 { index, content } 格式。
 * LangChain 内部按 separators 优先级递归分割，保证分块语义连贯。
 */
export async function chunkText(text: string): Promise<Chunk[]> {
  const docs: Document[] = await splitter.createDocuments([text]);
  return docs.map((doc, index) => ({
    index,
    content: doc.pageContent,
  }));
}
