import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type EnvSnapshot = Record<string, string | undefined>;

const snapshotEnv = (): EnvSnapshot => ({ ...process.env });

const restoreEnv = (snapshot: EnvSnapshot) => {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(snapshot)) {
    if (typeof value === 'undefined') {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

let envSnapshot: EnvSnapshot;

beforeEach(() => {
  envSnapshot = snapshotEnv();
  vi.resetModules();
});

afterEach(() => {
  restoreEnv(envSnapshot);
  vi.restoreAllMocks();
});

describe('config/discord.config', () => {
  it('未配置时返回 null', async () => {
    delete process.env.DISCORD_INVITE_URL;
    delete process.env.NEXT_PUBLIC_DISCORD_INVITE_URL;

    const { getDiscordInviteRedirectHref, getDiscordInviteUrl } = await import('../discord.config');

    expect(getDiscordInviteUrl()).toBe(null);
    expect(getDiscordInviteRedirectHref()).toBe(null);
  });

  it('优先使用 DISCORD_INVITE_URL', async () => {
    process.env.DISCORD_INVITE_URL = 'https://discord.gg/server-internal';
    process.env.NEXT_PUBLIC_DISCORD_INVITE_URL = 'https://discord.gg/server-public';

    const { getDiscordInviteRedirectHref, getDiscordInviteUrl } = await import('../discord.config');

    expect(getDiscordInviteUrl()).toBe('https://discord.gg/server-internal');
    expect(getDiscordInviteRedirectHref()).toBe(
      `/go?url=${encodeURIComponent('https://discord.gg/server-internal')}`,
    );
  });

  it('支持 NEXT_PUBLIC_DISCORD_INVITE_URL 作为回退配置', async () => {
    delete process.env.DISCORD_INVITE_URL;
    process.env.NEXT_PUBLIC_DISCORD_INVITE_URL = '//discord.gg/server-public';

    const { getDiscordInviteRedirectHref, getDiscordInviteUrl } = await import('../discord.config');

    expect(getDiscordInviteUrl()).toBe('https://discord.gg/server-public');
    expect(getDiscordInviteRedirectHref()).toBe(
      `/go?url=${encodeURIComponent('https://discord.gg/server-public')}`,
    );
  });

  it('忽略非法协议配置', async () => {
    process.env.DISCORD_INVITE_URL = 'discord://invite/server';
    process.env.NEXT_PUBLIC_DISCORD_INVITE_URL = 'javascript:alert(1)';

    const { getDiscordInviteRedirectHref, getDiscordInviteUrl } = await import('../discord.config');

    expect(getDiscordInviteUrl()).toBe(null);
    expect(getDiscordInviteRedirectHref()).toBe(null);
  });
});

