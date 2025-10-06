const BASE_URL = '/api';

export interface SongSearchResponse {
  code: number;
  status: string;
  message: string | null;
  data?: { id?: string } & Record<string, unknown>;
}

/**
 * 根据关键词查询歌曲，返回唯一歌曲ID（若有）。
 */
export async function searchSongId(query: string): Promise<string | null> {
  if (!query.trim()) return null;
  const params = new URLSearchParams({ q: query });
  try {
    const resp = await fetch(`${BASE_URL}/song/search?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as SongSearchResponse;
    if (data && data.code === 200 && data.data && typeof data.data.id === 'string') {
      return data.data.id;
    }
    return null;
  } catch {
    return null;
  }
}
