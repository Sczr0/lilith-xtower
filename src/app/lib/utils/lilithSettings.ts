/**
 * 实验室-Lilith「RKS 提升助手」用户调参（localStorage 持久化）。
 *
 * 设计目标：
 * - 只暴露少数"简单易懂"的参数（3 滑块 + 1 开关 + 推荐条数），其余算法常量保持内部默认；
 * - 读写均做严格校验与钳制（localStorage 为不可信来源，错误输入回退默认值）；
 * - 纯函数实现，便于单元测试与 SSR 安全使用。
 */

import { LILITH_SETTINGS_STORAGE_KEY } from '../constants/storageKeys';
import { coerceFiniteNumber } from './number';

export type LilithUserSettings = {
  /** 高定数绝对 ACC 天花板基准（%），规则1 */
  absAccCeiling: number;
  /** 单次提升上限基准（%），规则3 */
  jumpBase: number;
  /** 上行放宽幅度：目标 ACC 可超出稳定水平的上限（%），潜力视图 */
  overReachCap: number;
  /** 是否启用能力证明放宽（近-φ 记录可 +0.5% 天花板） */
  enableProof: boolean;
  /** 推荐条数 */
  limit: number;
};

export { LILITH_SETTINGS_STORAGE_KEY };

/** 默认值 = 算法当前默认，未调参时行为与发版一致 */
export const DEFAULT_LILITH_USER_SETTINGS: LilithUserSettings = {
  absAccCeiling: 98.5,
  jumpBase: 1.5,
  overReachCap: 2.5,
  enableProof: true,
  limit: 8,
};

/** 各参数允许范围（UI 滑块与解析钳制共用） */
export const LILITH_SETTINGS_BOUNDS = {
  absAccCeiling: { min: 95, max: 100, step: 0.5 },
  jumpBase: { min: 0.5, max: 3, step: 0.1 },
  overReachCap: { min: 1, max: 4, step: 0.1 },
  limit: { min: 4, max: 16, step: 1 },
} as const;

function clampToRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** 对齐到滑块步长，避免手动输入/浮点产生 97.79999 之类的脏值 */
function snapToStep(value: number, step: number): number {
  const snapped = Math.round(value / step) * step;
  // 浮点误差容忍
  return Math.abs(snapped - value) < 1e-9 ? value : snapped;
}

function clampWithStep(value: unknown, fallback: number, min: number, max: number, step: number): number {
  const parsed = coerceFiniteNumber(value, fallback);
  return snapToStep(clampToRange(parsed, min, max), step);
}

/**
 * 从 localStorage（可能为 null / 损坏 JSON / 越界值）解析用户设置。
 * 任何非法输入逐项回退默认值；返回全新对象，不共享内部引用。
 */
export function parseLilithUserSettings(raw: string | null): LilithUserSettings {
  if (!raw) return { ...DEFAULT_LILITH_USER_SETTINGS };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_LILITH_USER_SETTINGS };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ...DEFAULT_LILITH_USER_SETTINGS };
  }

  const obj = parsed as Record<string, unknown>;
  const { absAccCeiling, jumpBase, overReachCap, limit } = LILITH_SETTINGS_BOUNDS;

  return {
    absAccCeiling: clampWithStep(obj.absAccCeiling, DEFAULT_LILITH_USER_SETTINGS.absAccCeiling, absAccCeiling.min, absAccCeiling.max, absAccCeiling.step),
    jumpBase: clampWithStep(obj.jumpBase, DEFAULT_LILITH_USER_SETTINGS.jumpBase, jumpBase.min, jumpBase.max, jumpBase.step),
    overReachCap: clampWithStep(obj.overReachCap, DEFAULT_LILITH_USER_SETTINGS.overReachCap, overReachCap.min, overReachCap.max, overReachCap.step),
    enableProof: typeof obj.enableProof === 'boolean' ? obj.enableProof : DEFAULT_LILITH_USER_SETTINGS.enableProof,
    limit: Math.round(clampWithStep(obj.limit, DEFAULT_LILITH_USER_SETTINGS.limit, limit.min, limit.max, limit.step)),
  };
}

export function serializeLilithUserSettings(settings: LilithUserSettings): string {
  return JSON.stringify({
    absAccCeiling: settings.absAccCeiling,
    jumpBase: settings.jumpBase,
    overReachCap: settings.overReachCap,
    enableProof: settings.enableProof,
    limit: settings.limit,
  });
}

/** 是否全部为默认值（用于 UI 显示"已自定义"与恢复默认按钮） */
export function isLilithUserSettingsDefault(settings: LilithUserSettings): boolean {
  const d = DEFAULT_LILITH_USER_SETTINGS;
  return (
    Math.abs(settings.absAccCeiling - d.absAccCeiling) < 1e-9
    && Math.abs(settings.jumpBase - d.jumpBase) < 1e-9
    && Math.abs(settings.overReachCap - d.overReachCap) < 1e-9
    && settings.enableProof === d.enableProof
    && settings.limit === d.limit
  );
}
