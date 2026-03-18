import { isValidElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type EnvSnapshot = Record<string, string | undefined>;

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn<(href: string) => never>(),
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

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
  mockRedirect.mockReset();
  mockRedirect.mockImplementation((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  });
  vi.resetModules();
});

afterEach(() => {
  restoreEnv(envSnapshot);
  vi.restoreAllMocks();
});

describe('app/discord/page', () => {
  it('有有效配置时重定向到 /go 外链中转页', async () => {
    process.env.DISCORD_INVITE_URL = 'https://discord.gg/xtower';

    const { default: DiscordRedirectPage } = await import('./page');

    expect(() => DiscordRedirectPage()).toThrowError(
      `NEXT_REDIRECT:${`/go?url=${encodeURIComponent('https://discord.gg/xtower')}`}`,
    );
    expect(mockRedirect).toHaveBeenCalledWith(
      `/go?url=${encodeURIComponent('https://discord.gg/xtower')}`,
    );
  });

  it('未配置时渲染降级提示页', async () => {
    delete process.env.DISCORD_INVITE_URL;
    delete process.env.NEXT_PUBLIC_DISCORD_INVITE_URL;

    const { default: DiscordRedirectPage } = await import('./page');
    const element = DiscordRedirectPage();

    expect(isValidElement(element)).toBe(true);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
