/**
 * catch-all 代理（/api/[...path]）的 Cookie 安全过滤。
 *
 * 背景：代理此前把浏览器带来的全部 Cookie 原样转发给上游，并把上游的
 * Set-Cookie 原样透传回本站域名。问题：
 * - 本站自有 Cookie（iron-session 会话等）会被不必要地外发给上游；
 * - 上游可通过 Set-Cookie 在本站域写任意 Cookie，包括与本站会话 Cookie
 *   同名覆盖（重放攻击面），或用 Domain 属性放大作用域到父域。
 *
 * 规则：
 * - 请求侧：转发前剔除站内自有 Cookie（SITE_OWNED_COOKIE_NAMES），
 *   其余 Cookie（上游经由本站中转的会话）原样保留；
 * - 响应侧：上游 Set-Cookie 与站内 Cookie 同名 → 丢弃；携带 Domain 属性 →
 *   剥离该属性（收窄为 host-only，浏览器只接受本站可写的域，剥离后功能
 *   等价且作用域最小）；其余属性（HttpOnly/Secure/SameSite 等）原样保留。
 */

/** 请求侧：从 Cookie 头中剔除站内自有 Cookie，返回仍需转发的部分（可能为空串） */
export function filterOutSiteOwnedCookies(
  cookieHeader: string,
  siteOwnedNames: ReadonlySet<string>,
): string {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const eq = part.indexOf('=');
      const name = eq === -1 ? part : part.slice(0, eq).trim();
      return !siteOwnedNames.has(name);
    })
    .join('; ');
}

/** 响应侧：净化上游 Set-Cookie；返回 null 表示该条应被丢弃 */
export function sanitizeUpstreamSetCookie(
  setCookieValue: string,
  siteOwnedNames: ReadonlySet<string>,
): string | null {
  const segments = setCookieValue.split(';');
  const pair = segments[0] ?? '';
  const eq = pair.indexOf('=');
  if (eq <= 0) return null; // 无 name=value 结构，视为畸形条目丢弃

  const name = pair.slice(0, eq).trim();
  if (!name || siteOwnedNames.has(name)) return null;

  const keptSegments = [pair];
  for (let index = 1; index < segments.length; index += 1) {
    const segment = segments[index];
    const trimmed = segment.trim();
    const attrEq = trimmed.indexOf('=');
    const attrKey = (attrEq === -1 ? trimmed : trimmed.slice(0, attrEq)).trim().toLowerCase();
    // Domain 属性剥离：Set-Cookie 来自本站响应，浏览器只可能将其落到本站域；
    // 去掉 Domain 可避免放大到父域（如 xtower.site），收窄为 host-only
    if (attrKey === 'domain') continue;
    keptSegments.push(segment);
  }

  return keptSegments.join(';');
}
