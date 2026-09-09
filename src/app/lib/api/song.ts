import { extractProblemMessage } from './problem';
import { createDedupedCache } from '../utils/cacheWithDedup';

const BASE_URL = '/api';

const CACHE_TTL_MS = 10 * 60 * 1000;
// 用户输入属于高基数 key：加 LRU 上限，避免长会话下缓存无限增长。
const CACHE_MAX_SIZE = 200;
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * 多关键词模式（后端 `mode=and`）：
 * - 空格分词，双引号包裹短语，`-` 前缀排除；
 * - 该模式下官方名/别名/曲师/曲目 ID 均参与匹配（默认模式只匹配官方名与别名）。
 * 仅在查询含多个词时启用：单串查询沿用默认模式（别名+模糊匹配语义最完整）。
 */
const MULTI_KEYWORD_MODE = 'and';

/** 候选补全（非 unique 查询）的返回条数上限。 */
const ENRICH_LIMIT = 20;

/**
 * 曲绘缩略图：后端低分辨率原图（`/_ill/illLow`），带 `immutable` 长缓存，
 * 同一首歌只需拉取一次；CSP 的 `img-src` 已放行 `*.xtower.site`。
 */
const COVER_BASE_URL = 'https://seekend.xtower.site/_ill/illLow';

/** 四难度定数（缺失难度为 null）。 */
export interface SongChartConstants {
  ez: number | null;
  hd: number | null;
  in: number | null;
  at: number | null;
}

export interface SongCandidate {
  id: string;
  name: string;
  /** 曲师（后端字段 composer） */
  artist?: string;
  /** 画师 */
  illustrator?: string;
  /** 各难度定数 */
  chartConstants?: SongChartConstants;
  /** 曲绘缩略图 URL */
  coverUrl?: string;
}

/** 检索结果：唯一命中 / 多命中（需消歧）/ 未命中。 */
export type SongSearchOutcome =
  | { kind: 'single'; songId: string }
  | { kind: 'multiple'; candidates: SongCandidate[]; total: number; message: string }
  | { kind: 'none' };

/** 构造曲绘缩略图 URL（曲目 ID 可能含空格/日文/特殊符号，逐段编码）。 */
export function buildSongCoverUrl(songId: string): string {
  const id = songId.trim();
  if (!id) return '';
  return `${COVER_BASE_URL}/${encodeURIComponent(id)}.png`;
}

/**
 * 是否应使用多关键词模式：
 * - 含双引号短语（用户显式指定短语）→ 启用；
 * - 含空白（"曲名 + 曲师"这类组合查询）→ 启用。
 * 单串查询（如「三只狗」「bq」）保持默认模式，以沿用别名与模糊匹配。
 */
export function shouldUseMultiKeywordMode(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (q.includes('"')) return true;
  return /\s/.test(q);
}

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseChartConstants = (raw: unknown): SongChartConstants | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const constants: SongChartConstants = {
    ez: toNullableNumber(value.ez),
    hd: toNullableNumber(value.hd),
    in: toNullableNumber(value.in),
    at: toNullableNumber(value.at),
  };
  const hasAny = constants.ez !== null || constants.hd !== null || constants.in !== null || constants.at !== null;
  return hasAny ? constants : undefined;
};

/** 解析完整曲目对象（非 unique 分页结果 / unique 单条命中）。 */
const parseSongInfo = (item: unknown): SongCandidate | null => {
  if (!item || typeof item !== 'object') return null;
  const raw = item as Record<string, unknown>;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;

  const candidate: SongCandidate = {
    id: raw.id,
    name: raw.name,
    coverUrl: buildSongCoverUrl(raw.id),
  };
  if (typeof raw.composer === 'string' && raw.composer) candidate.artist = raw.composer;
  if (typeof raw.illustrator === 'string' && raw.illustrator) candidate.illustrator = raw.illustrator;
  const constants = parseChartConstants(raw.chartConstants);
  if (constants) candidate.chartConstants = constants;
  return candidate;
};

/** 解析 409 ProblemDetails 中的候选预览（仅 id/name）。 */
const parseProblemCandidates = (payload: unknown): { candidates: SongCandidate[]; total: number } => {
  const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const rawList = Array.isArray(obj.candidates) ? obj.candidates : [];

  const candidates = rawList
    .map((item): SongCandidate | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as { id?: unknown; name?: unknown };
      if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
      return { id: raw.id, name: raw.name, coverUrl: buildSongCoverUrl(raw.id) };
    })
    .filter((it): it is SongCandidate => it !== null);

  const total = toNullableNumber(obj.candidatesTotal);
  return {
    candidates,
    total: total !== null && total >= candidates.length ? total : candidates.length,
  };
};

/** 解析非 unique 分页结果（items: SongInfo[]）。 */
const parseSongPage = (payload: unknown): SongCandidate[] => {
  if (!payload || typeof payload !== 'object') return [];
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => parseSongInfo(item))
    .filter((it): it is SongCandidate => it !== null);
};

const parseSingleSongId = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const id = (payload as { id?: unknown }).id;
  return typeof id === 'string' && id ? id : null;
};

interface SongSearchRequestOptions {
  unique?: boolean;
  mode?: string;
  limit?: number;
}

async function requestSongSearch(
  query: string,
  options: SongSearchRequestOptions = {},
): Promise<{ status: number; payload: unknown }> {
  const params = new URLSearchParams({ q: query });
  if (options.unique) params.set('unique', 'true');
  if (options.mode) params.set('mode', options.mode);
  if (typeof options.limit === 'number') params.set('limit', String(options.limit));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}/songs/search?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    return { status: response.status, payload };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('搜索请求超时，请稍后重试');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 补全候选信息（曲师/画师/定数）。
 * 后端 409 的候选预览只含 id/name，这里用同查询的非 unique 请求取回完整曲目对象并按 id 合并；
 * 补全失败不影响消歧本身，退回仅含 id/name/曲绘的候选列表。
 */
async function enrichCandidates(
  candidates: SongCandidate[],
  query: string,
  mode?: string,
): Promise<SongCandidate[]> {
  if (candidates.length === 0) return candidates;

  try {
    const { status, payload } = await requestSongSearch(query, { mode, limit: ENRICH_LIMIT });
    if (status !== 200) return candidates;

    const byId = new Map(parseSongPage(payload).map((item) => [item.id, item]));
    return candidates.map((candidate) => {
      const info = byId.get(candidate.id);
      return info ? { ...candidate, ...info } : candidate;
    });
  } catch {
    return candidates;
  }
}

async function searchOnce(query: string, mode?: string): Promise<SongSearchOutcome> {
  const { status, payload } = await requestSongSearch(query, { unique: true, mode });

  if (status === 200) {
    const songId = parseSingleSongId(payload);
    return songId ? { kind: 'single', songId } : { kind: 'none' };
  }

  if (status === 404) return { kind: 'none' };

  if (status === 409) {
    const { candidates, total } = parseProblemCandidates(payload);
    const enriched = await enrichCandidates(candidates, query, mode);
    return {
      kind: 'multiple',
      candidates: enriched,
      total: Math.max(total, enriched.length),
      message: extractProblemMessage(payload, '找到多首匹配曲目，请选择'),
    };
  }

  throw new Error(extractProblemMessage(payload, `搜索失败 (${status})`));
}

const songCache = createDedupedCache<SongSearchOutcome>({
  ttlMs: CACHE_TTL_MS,
  maxSize: CACHE_MAX_SIZE,
});

/**
 * 检索歌曲（唯一命中 / 多命中 / 未命中）。
 *
 * 策略：
 * - 含多词的查询（如「雪降 A39」）优先用 `mode=and`：默认模式会把整串当单条关键词，
 *   可能匹配到错误曲目（实测「雪降 A39」在默认模式下命中另一首雪降）；
 * - `mode=and` 未命中时回退默认模式，保证「祈 -我ら神祖と共に歩む者なり-」这类
 *   含连字符的完整曲名仍可命中（实测该查询在 `mode=and` 下无结果）；
 * - 多命中时补全候选的曲师/画师/定数，供消歧界面展示。
 */
export async function searchSong(query: string): Promise<SongSearchOutcome> {
  const q = query.trim();
  if (!q) return { kind: 'none' };

  const cacheKey = q.toLowerCase();
  return songCache.get(cacheKey, async () => {
    if (shouldUseMultiKeywordMode(q)) {
      const multi = await searchOnce(q, MULTI_KEYWORD_MODE);
      if (multi.kind !== 'none') return multi;
      return searchOnce(q);
    }
    return searchOnce(q);
  });
}
