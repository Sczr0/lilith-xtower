/**
 * 曲目信息数据模型与纯解析逻辑（可被 client / server 共享）。
 *
 * 上游文件（somnia.xtower.site/info）：
 * - info.csv       曲目基础信息（id, 曲名, 曲师, 画师, EZ/HD/IN/AT 谱师）
 * - difficulty.csv 曲目定数（id, EZ, HD, IN, AT）
 * - version.txt    游戏版本（如 "3.19.5 (153)"）
 *
 * 注意：info.csv 的 EZ/HD/IN/AT 列是各难度的**谱师名**（非定数），
 * 定数来自 difficulty.csv。
 */
import type { Difficulty } from '@/app/lib/constants/difficultyColors';

export interface SongInfo {
  /** 谱面唯一 ID，如 "Glaciaxion.SunsetRay"。 */
  id: string;
  /** 曲名。 */
  name: string;
  /** 曲师。 */
  composer: string;
  /** 画师。 */
  illustrator: string;
  /** 各难度定数；该难度不存在时为 null。 */
  ez: number | null;
  hd: number | null;
  in: number | null;
  at: number | null;
  /** 各难度谱师（来自 info.csv 的 EZ/HD/IN/AT 列）；该难度无谱师或不存在时为 null。 */
  chartEz: string | null;
  chartHd: string | null;
  chartIn: string | null;
  chartAt: string | null;
}

export interface SongInfoData {
  /** 游戏版本（如 "3.19.5"）。 */
  version: string;
  /** 版本构建号（如 153）；解析失败为 null。 */
  build: number | null;
  /** 上游原始版本行（如 "3.19.5 (153)"）。 */
  rawVersion: string;
  /** 全量曲目（按 id 排序，与上游一致）。 */
  songs: SongInfo[];
}

/** Difficulty → 定数字段名。 */
export const LEVEL_FIELD: Record<Difficulty, 'ez' | 'hd' | 'in' | 'at'> = {
  EZ: 'ez',
  HD: 'hd',
  IN: 'in',
  AT: 'at',
};

/** 与上游一致的列顺序（difficulty.csv 与 info.csv 的 EZ/HD/IN/AT 列）。 */
export const LEVEL_COLUMNS: Difficulty[] = ['EZ', 'HD', 'IN', 'AT'];

export function getSongLevel(info: SongInfo, difficulty: Difficulty): number | null {
  return info[LEVEL_FIELD[difficulty]];
}

/**
 * 理论 RKS：全谱面（EZ/HD/IN/AT）定数降序取前 27，前 3 个 ×2，求和 ÷ 30。
 * 无任何定数数据时返回 null。
 */
export function computeTheoryRks(songs: SongInfo[]): number | null {
  const levels = songs
    .flatMap((song) => [song.ez, song.hd, song.in, song.at])
    .filter((level): level is number => level !== null)
    .sort((a, b) => b - a)
    .slice(0, 27);

  if (levels.length === 0) return null;

  const weightedSum = levels.reduce(
    (sum, level, index) => sum + (index < 3 ? level * 2 : level),
    0,
  );
  return weightedSum / 30;
}

/**
 * 筛选/排序用定数：'ALL' 模式取该曲所有难度中的最高定数，否则取指定难度。
 * 该曲无任何可用定数时返回 null。
 */
export function displayLevelForFilter(song: SongInfo, filter: Difficulty | 'ALL'): number | null {
  if (filter !== 'ALL') return getSongLevel(song, filter);
  const levels = [song.ez, song.hd, song.in, song.at].filter(
    (level): level is number => level !== null,
  );
  return levels.length > 0 ? Math.max(...levels) : null;
}

/**
 * 定数区间匹配：'ALL' 模式下任一难度落在 [min, max] 内即通过。
 * min/max 为 null 表示该侧不限制。
 */
export function matchLevelRange(
  song: SongInfo,
  filter: Difficulty | 'ALL',
  min: number | null,
  max: number | null,
): boolean {
  if (min === null && max === null) return true;
  const levels =
    filter === 'ALL'
      ? [song.ez, song.hd, song.in, song.at]
      : [getSongLevel(song, filter)];
  return levels.some((level) => {
    if (level === null) return false;
    if (min !== null && !Number.isNaN(min) && level < min) return false;
    if (max !== null && !Number.isNaN(max) && level > max) return false;
    return true;
  });
}

/**
 * RFC 4180 CSV 解析器。
 * 支持：引号包裹字段、字段内逗号/换行、"" 转义、CRLF。
 * 数据来自上游（约 300 行），未引入第三方依赖，解析失败时抛错由调用方兜底。
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
        } else {
          inQuotes = false;
          index += 1;
        }
      } else {
        field += char;
        index += 1;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      index += 1;
    } else if (char === ',') {
      row.push(field);
      field = '';
      index += 1;
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      index += 1;
    } else if (char === '\r') {
      // 忽略 CR（兼容 \r\n 与旧式 \r 行尾）
      index += 1;
    } else {
      field += char;
      index += 1;
    }
  }

  // 末行可能没有换行结尾
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** 解析定数单元格：空字符串 → null；非法数值 → null。 */
export function parseLevelCell(raw: string): number | null {
  const value = raw.trim();
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 解析谱师名单元格：空字符串 → null。 */
function parseDesignerCell(raw: string): string | null {
  const value = raw.trim();
  return value === '' ? null : value;
}

/** 从 info.csv 解析曲目基础信息（难度列为谱师名）。 */
export function parseSongInfoCsv(text: string): SongInfo[] {
  const rows = parseCsv(text);
  const songs: SongInfo[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row || row.length < 1) continue;

    const id = row[0]?.trim() ?? '';
    if (!id) continue;

    const song: SongInfo = {
      id,
      name: row[1]?.trim() ?? '',
      composer: row[2]?.trim() ?? '',
      illustrator: row[3]?.trim() ?? '',
      ez: null,
      hd: null,
      in: null,
      at: null,
      chartEz: parseDesignerCell(row[4] ?? ''),
      chartHd: parseDesignerCell(row[5] ?? ''),
      chartIn: parseDesignerCell(row[6] ?? ''),
      chartAt: parseDesignerCell(row[7] ?? ''),
    };
    songs.push(song);
  }

  return songs;
}

/** 从 difficulty.csv 解析定数，返回 id → 定数的映射。 */
export function parseDifficultyCsv(text: string): Record<string, Partial<Record<Difficulty, number | null>>> {
  const rows = parseCsv(text);
  const map: Record<string, Partial<Record<Difficulty, number | null>>> = {};

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row || row.length < 1) continue;

    const id = row[0]?.trim() ?? '';
    if (!id) continue;

    const entry: Partial<Record<Difficulty, number | null>> = {};
    for (let col = 0; col < LEVEL_COLUMNS.length; col += 1) {
      entry[LEVEL_COLUMNS[col]] = parseLevelCell(row[col + 1] ?? '');
    }
    map[id] = entry;
  }

  return map;
}

/** 解析版本行，如 "3.19.5 (153)" → { version: "3.19.5", build: 153 }。 */
export function parseVersionLine(raw: string): { version: string; build: number | null } {
  const trimmed = raw.trim();
  const buildMatch = trimmed.match(/\((\d+)\)\s*$/);
  const version = trimmed.replace(/\s*\(\d+\)\s*$/, '').trim();
  return {
    version,
    build: buildMatch ? Number(buildMatch[1]) : null,
  };
}

/**
 * 合并 info.csv + difficulty.csv + version.txt。
 * 以 info.csv 为全集（曲名/曲师/画师/谱师）；difficulty.csv 提供各难度定数。
 */
export function mergeSongInfo(songCsv: string, difficultyCsv: string, versionText: string): SongInfoData {
  const difficultyMap = parseDifficultyCsv(difficultyCsv);
  const parsedVersion = parseVersionLine(versionText);

  const songs = parseSongInfoCsv(songCsv).map((song) => {
    const levels = difficultyMap[song.id];
    if (!levels) return song;
    return {
      ...song,
      ez: levels.EZ ?? song.ez,
      hd: levels.HD ?? song.hd,
      in: levels.IN ?? song.in,
      at: levels.AT ?? song.at,
    };
  });

  return {
    version: parsedVersion.version,
    build: parsedVersion.build,
    rawVersion: versionText.trim(),
    songs,
  };
}
