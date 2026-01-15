/**
 * TapTap 移动端确认页深链（scheme）生成工具。
 *
 * 说明：
 * - 站点侧拿到的是 TapTap OAuth2 Device Code 返回的 https 确认链接（qrcode_url / verification_url）。
 * - 移动端希望优先唤起 TapTap App，可使用 TapTap 的自定义 scheme 包装该 https 链接。
 * - 若无法唤起 App，则使用 https 链接作为兜底。
 */

/**
 * 为 TapTap 确认链接补齐 opener=web（若已存在则不覆盖）。
 *
 * 备注：该参数来自 TapTap 侧的深链示例形态，用于标识来源为 web opener。
 */
export function normalizeTapTapConfirmUrl(rawUrl: string): string {
  if (!rawUrl) return '';

  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has('opener')) {
      url.searchParams.set('opener', 'web');
    }
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * 将 TapTap 的 https 确认链接包装为可唤起 TapTap App 的 scheme 深链。
 *
 * 示例：
 * - 输入：https://accounts.taptap.cn/device?qrcode=1&user_code=XXXXX
 * - 输出：taptap://taptap.com/login-auth?url=<encoded(https://...&opener=web)>
 */
export function buildTapTapLoginAuthDeepLink(rawConfirmUrl: string): string {
  if (!rawConfirmUrl) return '';
  if (rawConfirmUrl.startsWith('taptap://')) return rawConfirmUrl;

  const confirmUrl = normalizeTapTapConfirmUrl(rawConfirmUrl);
  if (!confirmUrl) return '';

  return `taptap://taptap.com/login-auth?url=${encodeURIComponent(confirmUrl)}`;
}

