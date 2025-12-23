import fs from 'fs/promises';
import path from 'path';

interface ManifestEntry {
  html: string;
  toc: string;
}

interface PrecompiledManifest {
  pages?: Record<string, ManifestEntry>;
  [key: string]: ManifestEntry | Record<string, ManifestEntry> | undefined;
}

interface TocItem {
  id: string;
  title: string;
  level: number;
}

interface PrecompiledAsset {
  html: string;
  toc: TocItem[];
}

const ENABLE_PROD_CACHE = process.env.NODE_ENV === 'production';

let cachedManifest: PrecompiledManifest | null = null;
let cachedManifestPromise: Promise<PrecompiledManifest> | null = null;
const cachedAssets = new Map<string, PrecompiledAsset>();

async function loadManifest(publicDir: string): Promise<PrecompiledManifest> {
  if (!ENABLE_PROD_CACHE) {
    const manifestContent = await fs.readFile(path.join(publicDir, 'manifest.json'), 'utf-8');
    return JSON.parse(manifestContent) as PrecompiledManifest;
  }

  if (cachedManifest) return cachedManifest;
  if (!cachedManifestPromise) {
    cachedManifestPromise = fs
      .readFile(path.join(publicDir, 'manifest.json'), 'utf-8')
      .then((manifestContent) => JSON.parse(manifestContent) as PrecompiledManifest)
      .then((manifest) => {
        cachedManifest = manifest;
        return manifest;
      })
      .finally(() => {
        cachedManifestPromise = null;
      });
  }
  return cachedManifestPromise;
}

/**
 * 服务端预编译内容获取工具
 * 在服务端直接读取文件系统，避免客户端 fetch 瀑布
 */
export async function getPrecompiledAssetServer(key: string): Promise<PrecompiledAsset> {
  const publicDir = path.join(process.cwd(), 'public', 'precompiled');

  try {
    const manifest = await loadManifest(publicDir);

    // 支持两种 manifest 格式：{ pages: { key: {...} } } 或 { key: {...} }
    const rawEntry = manifest?.pages?.[key] ?? manifest?.[key];

    if (!rawEntry || typeof rawEntry !== 'object' || !('html' in rawEntry) || !('toc' in rawEntry)) {
      console.warn('[getPrecompiledAssetServer] key not found in manifest:', key);
      throw new Error(`Precompiled asset "${key}" not found in manifest`);
    }

    // 类型断言，确保 entry 是 ManifestEntry
    const entry = rawEntry as ManifestEntry;

    const assetCacheKey = `${key}|${entry.html}|${entry.toc}`;
    if (ENABLE_PROD_CACHE) {
      const cached = cachedAssets.get(assetCacheKey);
      if (cached) return cached;
    }

    const [html, tocContent] = await Promise.all([
      fs.readFile(path.join(publicDir, entry.html), 'utf-8'),
      fs.readFile(path.join(publicDir, entry.toc), 'utf-8'),
    ]);

    const toc: TocItem[] = JSON.parse(tocContent);

    const result = { html, toc };
    if (ENABLE_PROD_CACHE) cachedAssets.set(assetCacheKey, result);
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    console.error('[getPrecompiledAssetServer] Failed to load asset:', key, error);
    throw new Error(`Failed to load precompiled asset "${key}"`);
  }
}

/**
 * 检查预编译资源是否存在（用于条件渲染）
 */
export async function hasPrecompiledAsset(key: string): Promise<boolean> {
  try {
    const publicDir = path.join(process.cwd(), 'public', 'precompiled');
    const manifest = await loadManifest(publicDir);
    const entry = manifest?.pages?.[key] ?? manifest?.[key];
    return !!(entry && typeof entry === 'object' && 'html' in entry && 'toc' in entry);
  } catch {
    return false;
  }
}
