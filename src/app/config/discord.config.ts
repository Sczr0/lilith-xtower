import { buildGoHref, normalizeExternalWebUrl } from '../utils/outbound';

const DISCORD_INVITE_ENV_KEYS = ['DISCORD_INVITE_URL', 'NEXT_PUBLIC_DISCORD_INVITE_URL'] as const;

/**
 * 读取 Discord 邀请链接配置。
 * 说明：
 * - 优先使用服务端环境变量 `DISCORD_INVITE_URL`；
 * - 兼容公开环境变量 `NEXT_PUBLIC_DISCORD_INVITE_URL`，便于纯前端部署场景复用；
 * - 仅接受 http/https（含协议相对）外链，避免误配到危险 scheme。
 */
export function getDiscordInviteUrl(): string | null {
  for (const envKey of DISCORD_INVITE_ENV_KEYS) {
    const rawValue = process.env[envKey]?.trim();
    if (!rawValue) {
      continue;
    }

    const normalized = normalizeExternalWebUrl(rawValue);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

/**
 * 获取 Discord 邀请入口最终应跳转到的站内地址。
 * 说明：
 * - 优先复用 `/go` 中间页，保持现有站外跳转安全提示一致；
 * - 若未来 `buildGoHref` 策略调整，此处自动跟随。
 */
export function getDiscordInviteRedirectHref(): string | null {
  const inviteUrl = getDiscordInviteUrl();
  if (!inviteUrl) {
    return null;
  }

  return buildGoHref(inviteUrl) ?? inviteUrl;
}

