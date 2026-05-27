import crypto from 'crypto';
import iconv from 'iconv-lite';

/**
 * 文档解析器：支持 PDF、Word (docx)、Markdown、纯文本。
 *
 * 接收 Buffer 而非文件路径——配合 multer.memoryStorage()，
 * 文档二进制数据在内存中完成解析，不落盘。
 *
 * 中文编码处理：先尝试 UTF-8，若出现乱码特征则回退 GBK。
 */
export async function parseDocumentBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const ext = fileName.split('.').pop()?.toLowerCase();

  if (ext === 'pdf') {
    const pdf = await import('pdf-parse');
    const data = await pdf.default(buffer);

    if (!data.text || !data.text.trim()) {
      // pdf-parse 提取不到文本的常见原因：
      //   1. 扫版 PDF（页面上是图片，没有文字层）
      //   2. PDF 字体编码不标准，pdf-parse 无法识别
      const reason =
        data.numpages > 0
          ? `PDF 解析后无文本（共 ${data.numpages} 页），可能是扫版 PDF 或加密文档`
          : 'PDF 无法识别，文件可能已损坏或格式不标准';
      throw new Error(reason);
    }

    return data.text;
  }

  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === 'md' || ext === 'txt') {
    return decodeChineseText(buffer);
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

/**
 * 中文文本解码：UTF-8 优先，乱码时回退 GBK。
 */
function decodeChineseText(buffer: Buffer): string {
  const utf8Text = buffer.toString('utf-8');
  if (!utf8Text.includes('�')) {
    return utf8Text;
  }
  return iconv.decode(buffer, 'gbk');
}

/**
 * 计算 Buffer 的 SHA256 哈希，用于去重校验。
 */
export function computeBufferHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
