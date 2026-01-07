import type { RksRecord } from '../types/score';

export const DEFAULT_RKS_PUSH_LINE_RANK = 27;

export type RksPushAccResult = {
  pushLineRank: number;
  pushLineRks: number;
  records: RksRecord[];
};

type AttachOptions = {
  pushLineRank?: number;
};

const EPS = 1e-6;

function normalizePushLineRank(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_RKS_PUSH_LINE_RANK;
  return Math.max(1, Math.floor(value));
}

function normalizeFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function computePushLineRks(records: RksRecord[], pushLineRank: number): number {
  if (records.length < pushLineRank) return 0;
  const sorted = [...records].sort((a, b) => b.rks - a.rks);
  const candidate = sorted[pushLineRank - 1]?.rks;
  return candidate && Number.isFinite(candidate) && candidate > 0 ? candidate : 0;
}

/**
 * 反解“达到目标 rks 所需的最低 acc（百分比）”
 * - RKS 公式（本项目现有实现）：rks = constant * ((100*accDecimal - 55) / 45)^2
 * - accDecimal = acc / 100
 * - 反解得到：acc = 55 + 45 * sqrt(targetRks / constant)
 */
function solveRequiredAcc(targetRks: number, constant: number): number {
  if (!Number.isFinite(targetRks) || targetRks <= 0) return 70;
  if (!Number.isFinite(constant) || constant <= 0) return Number.POSITIVE_INFINITY;

  const ratio = targetRks / constant;
  if (!Number.isFinite(ratio) || ratio <= 0) return 70;
  // 本项目的 RKS 实现对 acc < 70% 直接视为 0，因此推分ACC最低为 70%
  return Math.max(70, 55 + 45 * Math.sqrt(ratio));
}

/**
 * 为 RKS 记录列表补齐“推分ACC”字段（push_acc）与状态字段：
 * - unreachable：不可推分（即使 Phi 也达不到推分线）
 * - phi_only：需 Phi（只有 acc=100% 才能达到推分线）
 * - already_phi：已满 ACC（acc=100%，该谱面无法再通过提高 acc 推分）
 *
 * 口径（可参数化）：推分线取当前第 N 名单曲 RKS（默认 N=27，即 Best27 最低值）。
 */
export function attachRksPushAcc(records: RksRecord[], options?: AttachOptions): RksPushAccResult {
  const pushLineRank = normalizePushLineRank(options?.pushLineRank);
  const pushLineRks = computePushLineRks(records, pushLineRank);

  const patched = records.map((record) => {
    const acc = normalizeFiniteNumber(record.acc);
    const constant = normalizeFiniteNumber(record.difficulty_value);

    const already_phi = acc >= 100 - EPS;

    if (already_phi) {
      return {
        ...record,
        push_acc: null,
        unreachable: false,
        phi_only: false,
        already_phi: true,
      };
    }

    // 推分线缺失（例如不足 Best27）时无法计算推分ACC。
    if (pushLineRks <= 0) {
      return {
        ...record,
        push_acc: null,
        unreachable: false,
        phi_only: false,
        already_phi: false,
      };
    }

    const requiredAcc = solveRequiredAcc(pushLineRks, constant);

    if (!Number.isFinite(requiredAcc) || requiredAcc > 100 + EPS) {
      return {
        ...record,
        push_acc: null,
        unreachable: true,
        phi_only: false,
        already_phi: false,
      };
    }

    if (requiredAcc >= 100 - EPS) {
      return {
        ...record,
        push_acc: 100,
        unreachable: false,
        phi_only: true,
        already_phi: false,
      };
    }

    return {
      ...record,
      push_acc: requiredAcc,
      unreachable: false,
      phi_only: false,
      already_phi: false,
    };
  });

  return { pushLineRank, pushLineRks, records: patched };
}
