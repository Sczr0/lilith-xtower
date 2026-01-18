/**
 * 站外跳转（/go）相关工具函数
 *
 * 设计目标：
 * - 仅处理“会离开本站”的 web 链接（http/https/协议相对 //）
 * - 统一生成 /go?url=... 形式的中间页跳转链接
 * - 对 /go 的 url 参数做最小但明确的校验，避免 javascript:/data: 等危险 scheme
 */

export type GoUrlParseResult =
  | {
      ok: true;
      normalized: string;
      url: URL;
    }
  | {
      ok: false;
      reason: 'missing' | 'invalid' | 'unsupported-protocol';
    };

/**
 * 仅识别“web 外链”：http / https / 协议相对（//example.com）
 * - mailto/tel 不走 /go（它们不是“跳转到其他网站”）
 */
export function normalizeExternalWebUrl(href: string): string | null {
  const raw = typeof href === 'string' ? href.trim() : '';
  if (!raw) return null;

  if (raw.startsWith('//')) return `https:${raw}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  return null;
}

/**
 * 将外部 URL 转为站内中间页链接：/go?url=<encoded>
 * - 如果不是 web 外链（或为空），返回 null
 */
export function buildGoHref(href: string): string | null {
  const normalized = normalizeExternalWebUrl(href);
  if (!normalized) return null;
  return `/go?url=${encodeURIComponent(normalized)}`;
}

/**
 * 解析 /go?url=... 参数，做协议白名单校验（仅允许 http/https）
 */
export function parseGoUrlParam(value: string | string[] | undefined): GoUrlParseResult {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return { ok: false, reason: 'missing' };

  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'missing' };

  const parseWithCandidate = (candidate: string): GoUrlParseResult => {
    const normalized = normalizeExternalWebUrl(candidate) ?? candidate.trim();
    if (!normalized) return { ok: false, reason: 'missing' };

    let url: URL;
    try {
      url = new URL(normalized);
    } catch {
      return { ok: false, reason: 'invalid' };
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, reason: 'unsupported-protocol' };
    }

    return { ok: true, normalized: url.href, url };
  };

  const safeDecodeOnce = (input: string): string => {
    try {
      return decodeURIComponent(input);
    } catch {
      return input;
    }
  };

  const first = parseWithCandidate(trimmed);
  if (first.ok || first.reason === 'unsupported-protocol') return first;

  const decodedOnce = safeDecodeOnce(trimmed);
  if (decodedOnce !== trimmed) {
    const second = parseWithCandidate(decodedOnce);
    if (second.ok || second.reason === 'unsupported-protocol') return second;

    const decodedTwice = safeDecodeOnce(decodedOnce);
    if (decodedTwice !== decodedOnce) {
      return parseWithCandidate(decodedTwice);
    }
  }

  return first;
}
