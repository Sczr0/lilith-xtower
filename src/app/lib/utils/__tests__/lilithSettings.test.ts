import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LILITH_USER_SETTINGS,
  isLilithUserSettingsDefault,
  parseLilithUserSettings,
  serializeLilithUserSettings,
} from '../lilithSettings';

describe('lilithSettings: 用户调参解析与序列化', () => {
  it('空值/损坏 JSON/非对象输入回退默认值', () => {
    expect(parseLilithUserSettings(null)).toEqual(DEFAULT_LILITH_USER_SETTINGS);
    expect(parseLilithUserSettings('')).toEqual(DEFAULT_LILITH_USER_SETTINGS);
    expect(parseLilithUserSettings('{bad json')).toEqual(DEFAULT_LILITH_USER_SETTINGS);
    expect(parseLilithUserSettings('"string"')).toEqual(DEFAULT_LILITH_USER_SETTINGS);
    expect(parseLilithUserSettings('[1,2,3]')).toEqual(DEFAULT_LILITH_USER_SETTINGS);
  });

  it('合法输入完整读取（序列化往返一致）', () => {
    const custom = {
      absAccCeiling: 97,
      jumpBase: 2.2,
      overReachCap: 3.2,
      enableProof: false,
      limit: 12,
    };
    const parsed = parseLilithUserSettings(serializeLilithUserSettings(custom));
    expect(parsed).toEqual(custom);
  });

  it('越界值被钳制到允许范围并对齐步长', () => {
    const parsed = parseLilithUserSettings(
      JSON.stringify({
        absAccCeiling: 120, // 超上限 → 100
        jumpBase: 0.1, // 低于下限 → 0.5
        overReachCap: 9, // → 4
        enableProof: 1, // 非 boolean → true（默认）
        limit: 999, // → 16
      }),
    );
    expect(parsed.absAccCeiling).toBe(100);
    expect(parsed.jumpBase).toBe(0.5);
    expect(parsed.overReachCap).toBe(4);
    expect(parsed.enableProof).toBe(true);
    expect(parsed.limit).toBe(16);
  });

  it('非步长的脏值量化为最近的滑块网格点（97.79999 → 98.0）', () => {
    const parsed = parseLilithUserSettings(JSON.stringify({ absAccCeiling: 97.79999 }));
    expect(parsed.absAccCeiling).toBe(98);
    expect(parsed.jumpBase).toBe(DEFAULT_LILITH_USER_SETTINGS.jumpBase);
  });

  it('部分字段缺失时其余字段回退默认', () => {
    const parsed = parseLilithUserSettings(JSON.stringify({ limit: 6 }));
    expect(parsed.limit).toBe(6);
    expect(parsed.absAccCeiling).toBe(DEFAULT_LILITH_USER_SETTINGS.absAccCeiling);
    expect(parsed.enableProof).toBe(DEFAULT_LILITH_USER_SETTINGS.enableProof);
  });

  it('isLilithUserSettingsDefault 判断正确', () => {
    expect(isLilithUserSettingsDefault(DEFAULT_LILITH_USER_SETTINGS)).toBe(true);
    expect(isLilithUserSettingsDefault({ ...DEFAULT_LILITH_USER_SETTINGS, limit: 9 })).toBe(false);
    expect(
      isLilithUserSettingsDefault({ ...DEFAULT_LILITH_USER_SETTINGS, absAccCeiling: 99 }),
    ).toBe(false);
  });
});
