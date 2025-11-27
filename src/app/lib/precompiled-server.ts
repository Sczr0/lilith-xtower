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

/**
 * 服务端预编译内容获取工具
 * 在服务端直接读取文件系统，避免客户端 fetch 瀑布
 */
export async function getPrecompiledAssetServer(key: string): Promise<PrecompiledAsset> {
  const publicDir = path.join(process.cwd(), 'public', 'precompiled');
  const manifestPath = path.join(publicDir, 'manifest.json');

  try {
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest: PrecompiledManifest = JSON.parse(manifestContent);

    // 支持两种 manifest 格式：{ pages: { key: {...} } } 或 { key: {...} }
    const rawEntry = manifest?.pages?.[key] ?? manifest?.[key];

    if (!rawEntry || typeof rawEntry !== 'object' || !('html' in rawEntry) || !('toc' in rawEntry)) {
      console.warn('[getPrecompiledAssetServer] key not found in manifest:', key);
      throw new Error(`Precompiled asset "${key}" not found in manifest`);
    }

    // 类型断言，确保 entry 是 ManifestEntry
    const entry = rawEntry as ManifestEntry;

    const [html, tocContent] = await Promise.all([
      fs.readFile(path.join(publicDir, entry.html), 'utf-8'),
      fs.readFile(path.join(publicDir, entry.toc), 'utf-8'),
    ]);

    const toc: TocItem[] = JSON.parse(tocContent);

    return { html, toc };
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
    const manifestPath = path.join(publicDir, 'manifest.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest: PrecompiledManifest = JSON.parse(manifestContent);
    const entry = manifest?.pages?.[key] ?? manifest?.[key];
    return !!(entry && typeof entry === 'object' && 'html' in entry && 'toc' in entry);
  } catch {
    return false;
  }
}