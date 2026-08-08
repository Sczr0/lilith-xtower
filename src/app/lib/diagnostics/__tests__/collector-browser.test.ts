// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearEvents,
  getEvents,
  installErrorCapture,
  installFetchPatch,
  shouldReportError,
} from '../collector';

describe('collector 浏览器行为（jsdom）', () => {
  beforeEach(() => {
    clearEvents();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('错误上报去重', () => {
    it('同签名只放行一次', () => {
      expect(shouldReportError('boom', '/a')).toBe(true);
      expect(shouldReportError('boom', '/a')).toBe(false);
      // 不同页面可再次上报
      expect(shouldReportError('boom', '/b')).toBe(true);
    });

    it('签名数量有上限', () => {
      for (let i = 0; i < 30; i++) {
        shouldReportError(`err-${i}`, '/x');
      }
      // 最早被挤出的签名可再次上报
      expect(shouldReportError('err-0', '/x')).toBe(true);
    });
  });

  describe('fetch 轨迹补丁', () => {
    it('记录成功请求（去 query）', async () => {
      window.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 })) as unknown as typeof fetch;
      const off = installFetchPatch();
      try {
        await window.fetch('/api/image/bn?token=secret');
        const events = getEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          type: 'fetch',
          url: '/api/image/bn',
          method: 'GET',
          status: 200,
        });
        expect(events[0].durMs).toBeGreaterThanOrEqual(0);
      } finally {
        off();
      }
    });

    it('记录失败请求', async () => {
      window.fetch = vi.fn().mockRejectedValue(new TypeError('network down')) as unknown as typeof fetch;
      const off = installFetchPatch();
      try {
        await expect(window.fetch('/api/stats')).rejects.toThrow('network down');
        expect(getEvents()[0]).toMatchObject({ type: 'fetch', status: undefined });
      } finally {
        off();
      }
    });

    it('卸载后恢复原始 fetch', async () => {
      const original = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
      window.fetch = original as unknown as typeof fetch;
      const off = installFetchPatch();
      await window.fetch('/api/x');
      off();
      window.fetch('/api/y');
      expect(original).toHaveBeenCalledTimes(2);
      expect(getEvents()).toHaveLength(1);
    });
  });

  describe('全局错误捕获', () => {
    it('window error 触发回调并记录轨迹', () => {
      const onCapture = vi.fn();
      const off = installErrorCapture(onCapture);
      try {
        window.dispatchEvent(
          new ErrorEvent('error', { message: 'boom', error: new Error('boom') }),
        );
        expect(onCapture).toHaveBeenCalledWith({ message: 'boom', stack: expect.stringContaining('boom') });
        expect(getEvents()).toHaveLength(1);
        expect(getEvents()[0].type).toBe('error');
      } finally {
        off();
      }
    });

    it('unhandledrejection 触发回调并记录轨迹', () => {
      const onCapture = vi.fn();
      const off = installErrorCapture(onCapture);
      try {
        // jsdom 无 PromiseRejectionEvent 构造器，用 Event + reason 属性模拟
        const event = new Event('unhandledrejection') as PromiseRejectionEvent;
        Object.defineProperty(event, 'reason', { value: new Error('rejected') });
        window.dispatchEvent(event);
        expect(onCapture).toHaveBeenCalledWith({ message: 'rejected', stack: expect.any(String) });
        expect(getEvents()).toHaveLength(1);
      } finally {
        off();
      }
    });

    it('卸载后不再回调', () => {
      const onCapture = vi.fn();
      const off = installErrorCapture(onCapture);
      off();
      window.dispatchEvent(new ErrorEvent('error', { message: 'boom' }));
      expect(onCapture).not.toHaveBeenCalled();
    });
  });
});
