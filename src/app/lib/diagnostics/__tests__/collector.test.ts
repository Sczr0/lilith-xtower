import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearEvents,
  computeErrorSignature,
  formatDiagnosticsBlock,
  getDiagnosticsLogin,
  getEvents,
  nextViewId,
  parseUserAgent,
  pushEvent,
  setDiagnosticsLogin,
  type DiagnosticsSnapshot,
} from '../collector';

describe('collector 环形缓冲', () => {
  beforeEach(() => clearEvents());

  it('记录并返回事件', () => {
    pushEvent({ t: 1, type: 'route', url: '/dashboard' });
    expect(getEvents()).toEqual([{ t: 1, type: 'route', url: '/dashboard' }]);
  });

  it('超出上限时只保留最近 20 条', () => {
    for (let i = 0; i < 25; i++) {
      pushEvent({ t: i, type: 'route', url: `/page-${i}` });
    }
    const events = getEvents();
    expect(events).toHaveLength(20);
    expect(events[0].url).toBe('/page-5');
    expect(events[19].url).toBe('/page-24');
  });

  it('clearEvents 清空缓冲', () => {
    pushEvent({ t: 1, type: 'route', url: '/x' });
    clearEvents();
    expect(getEvents()).toHaveLength(0);
  });
});

describe('collector viewId 与登录态', () => {
  beforeEach(() => {
    nextViewId();
    setDiagnosticsLogin({ authenticated: false });
  });

  it('nextViewId 每次生成不同 id', () => {
    const a = nextViewId();
    const b = nextViewId();
    expect(a).not.toBe(b);
  });

  it('登录态可设置并读取（副本）', () => {
    setDiagnosticsLogin({ authenticated: true, method: 'tapTap' });
    expect(getDiagnosticsLogin()).toEqual({ authenticated: true, method: 'tapTap' });
    // 返回副本，外部修改不影响内部
    const login = getDiagnosticsLogin();
    login.authenticated = false;
    expect(getDiagnosticsLogin().authenticated).toBe(true);
  });
});

describe('collector 错误去重签名', () => {
  it('同 message 同页面签名一致', () => {
    expect(computeErrorSignature('boom', '/a')).toBe(computeErrorSignature('boom', '/a'));
  });

  it('不同页面签名不同', () => {
    expect(computeErrorSignature('boom', '/a')).not.toBe(computeErrorSignature('boom', '/b'));
  });

  it('签名截断到 200 字符', () => {
    const sig = computeErrorSignature('x'.repeat(500), '/a');
    expect(sig.length).toBeLessThanOrEqual(200);
  });
});

describe('collector UA 解析', () => {
  it('识别 Chrome / Windows 桌面端', () => {
    const parsed = parseUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    );
    expect(parsed.browser).toBe('Chrome');
    expect(parsed.os).toBe('Windows');
    expect(parsed.mobile).toBe(false);
  });

  it('识别 iPhone / Safari 移动端', () => {
    const parsed = parseUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );
    expect(parsed.browser).toBe('Safari');
    expect(parsed.os).toBe('iOS');
    expect(parsed.mobile).toBe(true);
  });

  it('识别 Android / 微信内置浏览器', () => {
    const parsed = parseUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.44',
    );
    expect(parsed.browser).toBe('微信内置浏览器');
    expect(parsed.os).toBe('Android');
    expect(parsed.mobile).toBe(true);
  });

  it('未知 UA 给出兜底值', () => {
    const parsed = parseUserAgent('curl/8.0');
    expect(parsed.browser).toBe('未知浏览器');
    expect(parsed.os).toBe('未知系统');
    expect(parsed.mobile).toBe(false);
  });
});

describe('collector 诊断块格式化', () => {
  const snapshot: DiagnosticsSnapshot = {
    version: 'abc1234',
    t: 1754120000000,
    page: '/dashboard',
    ua: 'Mozilla/5.0 Chrome',
    parsedUA: { browser: 'Chrome', os: 'Windows', mobile: false },
    online: true,
    networkType: '4g',
    login: { authenticated: true, method: 'platform' },
    viewId: '1754120000000-1',
    events: [
      { t: 1754120001000, type: 'fetch', url: '/api/image/bn', method: 'GET', status: 500, durMs: 312 },
      { t: 1754120002000, type: 'route', url: '/dashboard' },
      { t: 1754120003000, type: 'error', message: 'TypeError: boom', stack: 'TypeError: boom\n    at Foo (src/app/x.ts)' },
    ],
  };

  it('输出完整诊断块', () => {
    const block = formatDiagnosticsBlock(snapshot);
    expect(block).toContain('【诊断信息】Phigros Query vabc1234');
    expect(block).toContain('页面: /dashboard');
    expect(block).toContain('浏览器: Chrome / Windows (桌面端)');
    expect(block).toContain('网络: 在线 (4g)');
    expect(block).toContain('登录: 是 (platform)');
    expect(block).toContain('会话: 1754120000000-1');
  });

  it('操作与错误分区展示', () => {
    const block = formatDiagnosticsBlock(snapshot);
    expect(block).toContain('最近操作:');
    expect(block).toContain('GET /api/image/bn → 500 (312ms)');
    expect(block).toContain('页面切换 → /dashboard');
    expect(block).toContain('最近错误:');
    expect(block).toContain('错误: TypeError: boom');
    // 错误不在“最近操作”里
    const actionsSection = block.slice(block.indexOf('最近操作:'), block.indexOf('最近错误:'));
    expect(actionsSection).not.toContain('TypeError');
  });

  it('无事件时给出占位', () => {
    const block = formatDiagnosticsBlock({ ...snapshot, events: [] });
    expect(block).toContain('最近操作: 无');
    expect(block).not.toContain('最近错误:');
  });
});
