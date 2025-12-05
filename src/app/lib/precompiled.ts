'use client';

type TocItem = {
  id: string;
  title: string;
  level: number;
};

// 预编译静态页面获取工具：统一从 manifest 读取哈希文件名并获取 HTML/TOC
// 失败时抛出错误，交由调用方决定 UI 回退，同时输出 console.warn 便于排查
export async function getPrecompiledAsset(key: string): Promise<{ html: string; toc: TocItem[] }> {
  const manifestRes = await fetch('/precompiled/manifest.json', { cache: 'force-cache' });
  if (!manifestRes.ok) {
    console.warn('[getPrecompiledAsset] manifest fetch failed:', manifestRes.status);
    throw new Error('manifest unavailable');
  }
  const manifest = (await manifestRes.json()) as { pages?: Record<string, { html: string; toc: string }> } & Record<
    string,
    { html?: string; toc?: string }
  >;
  const entry = manifest?.pages?.[key] ?? manifest?.[key];
  if (!entry || !entry.html || !entry.toc) {
    console.warn('[getPrecompiledAsset] key not found in manifest:', key);
    throw new Error('key not found');
  }
  const [htmlRes, tocRes] = await Promise.all([
    fetch(`/precompiled/${entry.html}`, { cache: 'force-cache' }),
    fetch(`/precompiled/${entry.toc}`, { cache: 'force-cache' }),
  ]);
  if (!htmlRes.ok || !tocRes.ok) {
    console.warn('[getPrecompiledAsset] asset fetch failed:', key, htmlRes.status, tocRes.status);
    throw new Error('asset fetch failed');
  }
  const html = await htmlRes.text();
  const toc = (await tocRes.json()) as TocItem[];
  return { html, toc };
}
