import OSS from 'ali-oss';
import { config } from '../config';

/**
 * 阿里云 OSS 客户端：上传/删除图片。
 * Bucket 公共读，图片通过 OSS URL 直接访问。
 */
const client = new OSS({
  accessKeyId: config.oss.accessKeyId,
  accessKeySecret: config.oss.accessKeySecret,
  bucket: config.oss.bucket,
  region: config.oss.region,
});

/**
 * 上传图片到 OSS。
 * @returns 图片的公开访问 URL
 */
export async function uploadImage(
  userId: string,
  entryId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const key = `ai-library/images/${userId}/${entryId}.${ext}`;

  const result = await client.put(key, buffer, {
    mime: mimeType,
    headers: { 'x-oss-object-acl': 'public-read' },
  });

  return result.url;
}

/**
 * 删除 OSS 上的图片。入口不存在时忽略（幂等）。
 */
export async function deleteImage(userId: string, entryId: string): Promise<void> {
  // 尝试两种扩展名，文件名不固定时两种都删
  const keys = [
    `ai-library/images/${userId}/${entryId}.jpg`,
    `ai-library/images/${userId}/${entryId}.png`,
  ];
  for (const key of keys) {
    try {
      await client.delete(key);
    } catch {
      // 文件不存在时忽略，其他情况不影响主流程
    }
  }
}
