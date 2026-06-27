import crypto from 'crypto';

export function computeWeakEtag(payload: string | Buffer): string {
  const hash = crypto.createHash('sha1').update(payload).digest('base64url');
  return `W/"${hash}"`;
}

/**
 * 检查 If-None-Match 是否与给定 ETag 匹配
 *
 * 按照 RFC 7232：
 * - `*` 通配符表示"资源存在即为 fresh"
 * - 多值以逗号分隔：`"abc", W/"def", "ghi"`
 * - 弱 ETag 前缀 W/ 在比较时忽略强弱差异（我们的所有 ETag 都使用 W/）
 */
export function isEtagFresh(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;

  // 通配符
  if (ifNoneMatch.trim() === '*') return true;

  // 规范化：去空白、拆多值
  const tags = ifNoneMatch.replace(/\s/g, '').split(',');
  const normalizedEtag = normalizeEtagValue(etag);

  return tags.some((tag) => {
    const normalizedTag = normalizeEtagValue(tag);
    return normalizedTag === normalizedEtag;
  });
}

/** 规范化 ETag 值：去掉 W/ 前缀和引号，统一强弱比较 */
function normalizeEtagValue(s: string): string {
  let v = s.trim();
  // W/ 弱标记在前（W/"hash"）
  if (v.startsWith('W/')) v = v.slice(2);
  // 去掉外层引号
  if (v.startsWith('"')) v = v.slice(1);
  if (v.endsWith('"')) v = v.slice(0, -1);
  return v;
}
