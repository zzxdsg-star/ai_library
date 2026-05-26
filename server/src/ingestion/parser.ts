import fs from 'fs/promises';
import crypto from 'crypto';

/**
 * 文档解析器：支持 PDF、Word (docx)、Markdown、纯文本。
 *
 * pdf-parse 提取 PDF 文本，mammoth 提取 Word 文本（去格式），
 * Markdown/纯文本直接按 UTF-8 读取。
 */
export async function parseDocument(filePath: string): Promise<string> {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const buffer = await fs.readFile(filePath);

  if (ext === 'pdf') {
    const pdf = await import('pdf-parse');
    const data = await pdf.default(buffer);
    return data.text;
  }

  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === 'md' || ext === 'txt') {
    return buffer.toString('utf-8');
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

/**
 * 计算文件 SHA256 哈希，用于去重校验。
 * 相同 hash 的文件不重复入库。
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
