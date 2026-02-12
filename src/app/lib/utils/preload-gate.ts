/**
 * 轻量预加载门禁工具
 *
 * 说明：
 * - 仅保留“是否允许预加载”与“空闲调度”能力；
 * - 避免直接依赖体积较大的 preload.ts，使首屏共享包更小。
 */

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  deviceMemory?: number;
}

export type PreloadProfile = 'off' | 'conservative' | 'balanced' | 'aggressive';

export type PreloadProfileInput = {
  saveData?: boolean;
  prefersReducedData?: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
};

function sanitizePositiveNumber(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

export function resolvePreloadProfile(input: PreloadProfileInput): PreloadProfile {
  const saveData = !!input.saveData;
  const prefersReducedData = !!input.prefersReducedData;
  const effectiveType = typeof input.effectiveType === 'string' ? input.effectiveType.toLowerCase() : undefined;
  const downlink = sanitizePositiveNumber(input.downlink);
  const rtt = sanitizePositiveNumber(input.rtt);
  const deviceMemory = sanitizePositiveNumber(input.deviceMemory);
  const hardwareConcurrency = sanitizePositiveNumber(input.hardwareConcurrency);

  if (saveData || prefersReducedData) return 'off';
  if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'off';
  if (typeof downlink === 'number' && downlink < 1.5) return 'off';
  if (typeof rtt === 'number' && rtt > 600) return 'off';
  if (typeof deviceMemory === 'number' && deviceMemory < 4) return 'off';
  if (typeof hardwareConcurrency === 'number' && hardwareConcurrency < 4) return 'off';

  const isAggressiveNetwork =
    effectiveType === '4g' &&
    (typeof downlink === 'number' ? downlink >= 8 : true) &&
    (typeof rtt === 'number' ? rtt <= 120 : true);
  const isAggressiveDevice =
    (typeof deviceMemory === 'number' ? deviceMemory >= 8 : true) &&
    (typeof hardwareConcurrency === 'number' ? hardwareConcurrency >= 8 : true);
  if (isAggressiveNetwork && isAggressiveDevice) return 'aggressive';

  const isConservativeNetwork =
    effectiveType === '3g' ||
    (typeof downlink === 'number' && downlink < 3) ||
    (typeof rtt === 'number' && rtt > 300);
  const isConservativeDevice =
    (typeof deviceMemory === 'number' && deviceMemory < 6) ||
    (typeof hardwareConcurrency === 'number' && hardwareConcurrency < 6);
  if (isConservativeNetwork || isConservativeDevice) return 'conservative';

  return 'balanced';
}

export function getPreloadProfile(): PreloadProfile {
  if (typeof window === 'undefined') return 'off';

  try {
    const nav = navigator as NavigatorWithConnection;
    return resolvePreloadProfile({
      saveData: !!nav?.connection?.saveData,
      prefersReducedData: !!window.matchMedia?.('(prefers-reduced-data: reduce)').matches,
      effectiveType: nav?.connection?.effectiveType,
      downlink: nav?.connection?.downlink,
      rtt: nav?.connection?.rtt,
      deviceMemory: nav?.deviceMemory,
      hardwareConcurrency: nav?.hardwareConcurrency,
    });
  } catch {
    return 'balanced';
  }
}

export function shouldPreloadLite(): boolean {
  return getPreloadProfile() !== 'off';
}

export function getHomePreloadIdleTimeout(): number {
  const profile = getPreloadProfile();
  switch (profile) {
    case 'aggressive':
      return 900;
    case 'balanced':
      return 3000;
    case 'conservative':
      return 3600;
    default:
      return 4000;
  }
}

/**
 * 在浏览器空闲时执行任务（轻量版本）
 */
export function runWhenIdleLite(callback: () => void, timeout = 2000): void {
  if (typeof window === 'undefined') return;

  try {
    const ric = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;

    if (typeof ric === 'function') {
      ric(callback, { timeout });
      return;
    }
  } catch {
    // ignore
  }

  setTimeout(callback, 0);
}

