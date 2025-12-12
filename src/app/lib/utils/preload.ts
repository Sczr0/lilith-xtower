/**
 * 预加载工具库
 * 提供统一的资源预加载、数据预取和缓存管理功能
 */

import type { AuthCredential } from '../types/auth';
import { buildAuthRequestBody } from '../api/auth';
import { LeaderboardAPI } from '../api/leaderboard';

// 预取缓存，避免重复请求
const prefetchCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

/**
 * 检查是否应该进行预加载（考虑用户偏好）
 */
// 扩展 Navigator 类型以支持 Network Information API
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
}

export function shouldPreload(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    // 检查省流模式
    const nav = navigator as NavigatorWithConnection;
    if (nav?.connection?.saveData) return false;
    
    // 检查用户偏好
    if (window.matchMedia?.('(prefers-reduced-data: reduce)').matches) return false;
    
    // 检查网络类型（慢速网络不预加载）
    const effectiveType = nav?.connection?.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g') return false;
    
    return true;
  } catch {
    return true;
  }
}

/**
 * 在浏览器空闲时执行任务
 */
export function runWhenIdle(callback: () => void, timeout = 2000): void {
  if (typeof window === 'undefined') return;
  
  try {
    // 使用类型断言避免 TypeScript 错误
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (typeof ric === 'function') {
      ric(callback, { timeout });
    } else {
      setTimeout(callback, 0);
    }
  } catch {
    setTimeout(callback, 0);
  }
}

/**
 * 预取 API 数据
 */
export async function prefetchData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { force?: boolean; ttl?: number }
): Promise<T | null> {
  const { force = false, ttl = CACHE_TTL } = options || {};
  
  // 检查缓存
  const cached = prefetchCache.get(key);
  if (!force && cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }
  
  try {
    const data = await fetcher();
    prefetchCache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.warn(`[prefetch] Failed to prefetch ${key}:`, error);
    return null;
  }
}

/**
 * 获取预取的缓存数据
 */
export function getPrefetchedData<T>(key: string): T | null {
  const cached = prefetchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

/**
 * 清除预取缓存
 */
export function clearPrefetchCache(key?: string): void {
  if (key) {
    prefetchCache.delete(key);
  } else {
    prefetchCache.clear();
  }
}

/**
 * 预取 RKS 数据
 */
export async function prefetchRksData(credential: AuthCredential): Promise<void> {
  if (!shouldPreload()) return;
  
  const key = `rks_${credential.type}`;
  await prefetchData(key, async () => {
    const requestBody = buildAuthRequestBody(credential);
    const response = await fetch('/api/save?calculate_rks=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) throw new Error('Failed to prefetch RKS data');
    return response.json();
  });
}

/**
 * 预取排行榜数据
 */
export async function prefetchLeaderboard(limit = 20): Promise<void> {
  if (!shouldPreload()) return;
  
  const key = `leaderboard_top_${limit}`;
  await prefetchData(key, async () => {
    return LeaderboardAPI.getTop({ limit });
  });
}

/**
 * 预取服务统计数据
 */
export async function prefetchServiceStats(): Promise<void> {
  if (!shouldPreload()) return;
  
  const key = 'service_stats';
  await prefetchData(key, async () => {
    const response = await fetch('/api/stats/summary', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to prefetch service stats');
    return response.json();
  });
}

/**
 * 预加载图片
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * 批量预加载图片
 */
export async function preloadImages(srcs: string[], concurrent = 3): Promise<void> {
  if (!shouldPreload()) return;
  
  const chunks: string[][] = [];
  for (let i = 0; i < srcs.length; i += concurrent) {
    chunks.push(srcs.slice(i, i + concurrent));
  }
  
  for (const chunk of chunks) {
    await Promise.allSettled(chunk.map(preloadImage));
  }
}

/**
 * 预连接到指定域名
 */
export function preconnect(href: string, crossOrigin = true): void {
  if (typeof document === 'undefined') return;
  
  // 检查是否已存在
  const existing = document.querySelector(`link[rel="preconnect"][href="${href}"]`);
  if (existing) return;
  
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = href;
  if (crossOrigin) {
    link.crossOrigin = 'anonymous';
  }
  document.head.appendChild(link);
}

/**
 * DNS 预解析
 */
export function dnsPrefetch(href: string): void {
  if (typeof document === 'undefined') return;
  
  const existing = document.querySelector(`link[rel="dns-prefetch"][href="${href}"]`);
  if (existing) return;
  
  const link = document.createElement('link');
  link.rel = 'dns-prefetch';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * 预加载关键资源
 */
export function preloadResource(href: string, as: string, type?: string): void {
  if (typeof document === 'undefined') return;
  
  const existing = document.querySelector(`link[rel="preload"][href="${href}"]`);
  if (existing) return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  if (type) {
    link.type = type;
  }
  document.head.appendChild(link);
}

/**
 * 预取页面（用于路由预取）
 */
export function prefetchPage(href: string): void {
  if (typeof document === 'undefined') return;
  
  const existing = document.querySelector(`link[rel="prefetch"][href="${href}"]`);
  if (existing) return;
  
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * 登录后的预加载任务
 */
export function runPostLoginPreload(credential: AuthCredential): void {
  if (!shouldPreload()) return;
  
  runWhenIdle(() => {
    // 预取 RKS 数据
    prefetchRksData(credential);
    
    // 预取排行榜
    prefetchLeaderboard();
    
    // 预取服务统计
    prefetchServiceStats();
    
    // 预取 Dashboard 页面
    prefetchPage('/dashboard');
  });
}

/**
 * TapTap 二维码预加载数据存储
 */
interface PreloadedQrData {
  cn?: { data: unknown; timestamp: number };
  global?: { data: unknown; timestamp: number };
}

const preloadedQrData: PreloadedQrData = {};
const QR_PRELOAD_TTL = 60 * 1000; // 二维码预加载有效期 60 秒

/**
 * 预加载 TapTap 二维码
 */
export async function preloadTapTapQr(version: 'cn' | 'global'): Promise<unknown | null> {
  if (!shouldPreload()) return null;
  
  // 检查缓存
  const cached = preloadedQrData[version];
  if (cached && Date.now() - cached.timestamp < QR_PRELOAD_TTL) {
    return cached.data;
  }
  
  try {
    const response = await fetch('/api/internal/taptap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'device_code', version }),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    preloadedQrData[version] = { data, timestamp: Date.now() };
    return data;
  } catch {
    return null;
  }
}

/**
 * 获取预加载的二维码数据
 */
export function getPreloadedQrData(version: 'cn' | 'global'): unknown | null {
  const cached = preloadedQrData[version];
  if (cached && Date.now() - cached.timestamp < QR_PRELOAD_TTL) {
    return cached.data;
  }
  return null;
}

/**
 * 清除预加载的二维码数据
 */
export function clearPreloadedQrData(version?: 'cn' | 'global'): void {
  if (version) {
    delete preloadedQrData[version];
  } else {
    delete preloadedQrData.cn;
    delete preloadedQrData.global;
  }
}
