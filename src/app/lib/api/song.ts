const BASE_URL = '/api';

/**
 * 根据关键词查询歌曲，返回唯一歌曲ID（若有）。
 */
export async function searchSongId(query: string): Promise<string | null> {
  if (!query.trim()) return null;
  const params = new URLSearchParams({ q: query, unique: 'true' });
  try {
    const resp = await fetch(`${BASE_URL}/songs/search?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    // 期望单个对象 { id, name, ... }
    if (data && typeof data === 'object' && typeof data.id === 'string') {
      return data.id as string;
    }
    return null;
  } catch {
    return null;
  }
}
