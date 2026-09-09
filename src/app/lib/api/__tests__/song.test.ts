import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSongCoverUrl, searchSong, shouldUseMultiKeywordMode } from '../song';

type MockResponse = { status: number; payload: unknown };

const createFetchMock = (responses: MockResponse[]) => {
  const queue = [...responses];
  return vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => {
    const next = queue.shift();
    if (!next) throw new Error('fetch mock: 没有更多预置响应');
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      async json() {
        return next.payload;
      },
    } as Response;
  });
};

const songInfo = (overrides: Record<string, unknown> = {}) => ({
  id: 'KhronostasisKatharsis.Halv',
  name: 'Khronostasis Katharsis',
  composer: 'Halv',
  illustrator: 'utosao',
  chartConstants: { ez: 6.0, hd: 11.8, in: 14.0, at: null },
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildSongCoverUrl', () => {
  it('按路径片段编码曲目 ID（含空格/日文/特殊符号）', () => {
    expect(buildSongCoverUrl('Stasis.Maozon')).toBe(
      'https://seekend.xtower.site/_ill/illLow/Stasis.Maozon.png',
    );
    expect(buildSongCoverUrl('亂☆舞.NekockLK')).toBe(
      `https://seekend.xtower.site/_ill/illLow/${encodeURIComponent('亂☆舞.NekockLK')}.png`,
    );
    expect(buildSongCoverUrl('  ')).toBe('');
  });
});

describe('shouldUseMultiKeywordMode', () => {
  it('单串查询（含黑话/缩写）走默认模式', () => {
    expect(shouldUseMultiKeywordMode('三只狗')).toBe(false);
    expect(shouldUseMultiKeywordMode('bq')).toBe(false);
    expect(shouldUseMultiKeywordMode('  Stasis  ')).toBe(false);
  });

  it('含空白或双引号短语时启用多关键词模式', () => {
    expect(shouldUseMultiKeywordMode('雪降 A39')).toBe(true);
    expect(shouldUseMultiKeywordMode('"ENERGY SYNERGY MATRIX"')).toBe(true);
    expect(shouldUseMultiKeywordMode('')).toBe(false);
  });
});

describe('searchSong', () => {
  it('唯一命中时返回 single', async () => {
    const mockFetch = createFetchMock([{ status: 200, payload: songInfo() }]);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(searchSong('query-single-hit')).resolves.toEqual({
      kind: 'single',
      songId: 'KhronostasisKatharsis.Halv',
    });
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('/api/songs/search?q=query-single-hit&unique=true');
  });

  it('多词查询优先使用 mode=and', async () => {
    const mockFetch = createFetchMock([
      { status: 200, payload: songInfo({ id: 'A39', name: '雪降り、メリクリ' }) },
    ]);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(searchSong('query multi token')).resolves.toEqual({ kind: 'single', songId: 'A39' });
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe(
      '/api/songs/search?q=query+multi+token&unique=true&mode=and',
    );
  });

  it('mode=and 未命中时回退默认模式（含连字符的完整曲名）', async () => {
    const mockFetch = createFetchMock([
      { status: 404, payload: { detail: '搜索错误: 未找到匹配项' } },
      { status: 200, payload: songInfo({ id: '祈', name: '祈 -我ら神祖と共に歩む者なり-' }) },
    ]);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(searchSong('query fallback -phrase')).resolves.toEqual({ kind: 'single', songId: '祈' });
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('mode=and');
    expect(String(mockFetch.mock.calls[1]?.[0])).toBe(
      '/api/songs/search?q=query+fallback+-phrase&unique=true',
    );
  });

  it('多命中时返回补全后的候选（曲师/定数/曲绘）', async () => {
    const mockFetch = createFetchMock([
      {
        status: 409,
        payload: {
          detail: '搜索错误: 查询到多个候选项（需要更精确的关键词）',
          candidatesTotal: 3,
          candidates: [
            { id: 'KhronostasisKatharsis.Halv', name: 'Khronostasis Katharsis' },
            { id: 'Chronostasis.黒皇帝', name: 'Chronostasis' },
          ],
        },
      },
      {
        status: 200,
        payload: {
          items: [
            songInfo(),
            songInfo({ id: 'Chronostasis.黒皇帝', name: 'Chronostasis', composer: '黒皇帝', chartConstants: { ez: 6.0, hd: 10.7, in: 16.0, at: null } }),
          ],
          total: 3,
        },
      },
    ]);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const outcome = await searchSong('query ambiguous');

    expect(outcome.kind).toBe('multiple');
    if (outcome.kind !== 'multiple') return;

    expect(outcome.total).toBe(3);
    expect(outcome.message).toContain('多个候选项');
    expect(outcome.candidates).toHaveLength(2);
    expect(outcome.candidates[0]).toMatchObject({
      id: 'KhronostasisKatharsis.Halv',
      artist: 'Halv',
      illustrator: 'utosao',
      chartConstants: { ez: 6.0, hd: 11.8, in: 14.0, at: null },
      coverUrl: 'https://seekend.xtower.site/_ill/illLow/KhronostasisKatharsis.Halv.png',
    });
    expect(outcome.candidates[1]).toMatchObject({ artist: '黒皇帝' });

    // 补全请求：非 unique、带 limit、不带 mode（单串查询）
    const enrichUrl = String(mockFetch.mock.calls[1]?.[0]);
    expect(enrichUrl).toContain('q=query+ambiguous');
    expect(enrichUrl).toContain('limit=20');
    expect(enrichUrl).not.toContain('unique=true');
  });

  it('补全请求失败时仍返回候选（仅 id/name/曲绘）', async () => {
    const mockFetch = createFetchMock([
      {
        status: 409,
        payload: {
          detail: '需要更精确的关键词',
          candidates: [{ id: 'X.Y', name: 'X' }],
        },
      },
      { status: 500, payload: { detail: 'boom' } },
    ]);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const outcome = await searchSong('query enrich-fail');

    expect(outcome.kind).toBe('multiple');
    if (outcome.kind !== 'multiple') return;
    expect(outcome.candidates[0]).toMatchObject({
      id: 'X.Y',
      name: 'X',
      coverUrl: 'https://seekend.xtower.site/_ill/illLow/X.Y.png',
    });
    expect(outcome.candidates[0]?.artist).toBeUndefined();
  });

  it('未命中返回 none', async () => {
    const mockFetch = createFetchMock([{ status: 404, payload: { detail: '未找到匹配项' } }]);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(searchSong('query-not-found')).resolves.toEqual({ kind: 'none' });
  });

  it('其他错误状态抛出后端 detail', async () => {
    const mockFetch = createFetchMock([{ status: 500, payload: { detail: '服务暂时不可用' } }]);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(searchSong('query-server-error')).rejects.toThrow('服务暂时不可用');
  });

  it('同一查询命中缓存，不重复请求', async () => {
    const mockFetch = createFetchMock([{ status: 200, payload: songInfo() }]);
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await searchSong('query-cached');
    await searchSong('QUERY-CACHED');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
