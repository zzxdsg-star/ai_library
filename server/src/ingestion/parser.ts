import crypto from 'crypto';
import iconv from 'iconv-lite';

/**
 * 文档解析器：支持 PDF、Word (docx)、Markdown、纯文本、CSV、Excel。
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

  if (ext === 'csv') {
    return parseCSV(buffer);
  }

  if (ext === 'xlsx') {
    return parseExcel(buffer);
  }

  throw new Error(`不支持的文件格式: .${ext}`);
}

// ==================== 中文编码 ====================

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

// ==================== CSV / Excel ====================

/**
 * CSV 解析：将 CSV 内容转为 Markdown table。第一行作为表头。
 */
function parseCSV(buffer: Buffer): string {
  const text = decodeChineseText(buffer);
  const rows: string[][] = [];
  text.split('\n').forEach((line) => {
    const cells = parseCSVLine(line);
    if (cells.some((c) => c.trim())) {
      rows.push(cells);
    }
  });
  if (rows.length === 0) throw new Error('CSV 文件为空');
  return rowsToMarkdownTable(rows);
}

/**
 * 简单 CSV 行解析：处理引号内的逗号。
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Excel (.xlsx) 解析：读取第一个 sheet，转为 Markdown table。
 */
function parseExcel(buffer: Buffer): string {
  const XLSX = require('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Excel 文件为空');
  const sheet = wb.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });
  const filtered = rows.filter((r: any[]) => r.some((c: any) => String(c).trim()));
  if (filtered.length === 0) throw new Error('Excel 文件无内容');
  return rowsToMarkdownTable(filtered);
}

/**
 * 二维数组转 Markdown table 字符串。
 */
function rowsToMarkdownTable(rows: any[][]): string {
  if (rows.length === 0) return '';
  const header = rows[0].map((c) => String(c));
  const align = header.map(() => '---');
  const body = rows.slice(1).map((row) =>
    header.map((_, i) => String(row[i] ?? '')).join(' | '),
  );
  return [
    header.join(' | '),
    align.join(' | '),
    ...body,
  ].join('\n');
}

// ==================== 工具 ====================

/**
 * 计算 Buffer 的 SHA256 哈希，用于去重校验。
 */
export function computeBufferHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
