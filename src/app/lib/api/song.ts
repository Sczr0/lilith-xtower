const BASE_URL = '/api';

type NotUniqueResponse = {
  Search?: {
    NotUnique?: {
      candidates?: Array<{ name?: string }>;
    };
  };
};

/**
 * 根据关键字查询歌曲，返回唯一谱面ID（若存在）。
 * @throws 当有多个匹配结果时抛出错误，内含建议候选列表
 */
export async function searchSongId(query: string): Promise<string | null> {
  if (!query.trim()) return null;
  const params = new URLSearchParams({ q: query, unique: 'true' });
  try {
    const resp = await fetch(`${BASE_URL}/songs/search?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (resp.status === 404) {
      // 未找到匹配项
      return null;
    }

    if (resp.status === 409) {
      // 结果不唯一，提取候选列表
      try {
        const errorData = (await resp.json()) as NotUniqueResponse;
        const candidates = errorData?.Search?.NotUnique?.candidates || [];
        const songNames = candidates.map((c) => c.name ?? '').filter(Boolean).join('、');
        const suffix = songNames ? `：${songNames}` : '';
        throw new Error(`找到多个匹配的谱面，请使用更精确的关键词${suffix}`);
      } catch (e) {
        if (e instanceof Error && e.message.includes('找到多个')) throw e;
        throw new Error('找到多个匹配的谱面，请使用更精确的关键词');
      }
    }

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => null);
      const message = (errorData as { message?: string } | null)?.message || `搜索失败 (${resp.status})`;
      throw new Error(message);
    }

    const data = await resp.json();
    // 期望单个对象 { id, name, ... }
    if (data && typeof data === 'object' && typeof data.id === 'string') {
      return data.id as string;
    }
    return null;
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error('搜索谱面失败');
  }
}
