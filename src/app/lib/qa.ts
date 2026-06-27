import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface QAItem {
  id: string;
  question: string;
  answer: string;
  category: 'login' | 'usage' | 'technical' | 'security';
  priority: number;
  enabled: boolean;
  createdAt: string;
}

const QA_DIR = path.join(process.cwd(), 'src/app/content/qa');
const ENABLE_PROD_CACHE = process.env.NODE_ENV === 'production';
const QA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

type CacheEntry<T> = { data: T; ts: number };

let cachedAllQA: CacheEntry<QAItem[]> | null = null;

function isCacheFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  if (!entry) return false;
  return Date.now() - entry.ts < QA_CACHE_TTL_MS;
}

export function getAllQA(): QAItem[] {
  if (ENABLE_PROD_CACHE && isCacheFresh(cachedAllQA)) return cachedAllQA.data;

  try {
    if (!fs.existsSync(QA_DIR)) {
      if (ENABLE_PROD_CACHE) cachedAllQA = { data: [], ts: Date.now() };
      return [];
    }

    const files = fs.readdirSync(QA_DIR).filter(file => file.endsWith('.md'));
    
    const qaItems = files.map(filename => {
      const filepath = path.join(QA_DIR, filename);
      const fileContent = fs.readFileSync(filepath, 'utf-8');
      const { data, content } = matter(fileContent);
      
      return {
        id: data.id || filename.replace('.md', ''),
        question: data.question || '',
        answer: content.trim(),
        category: data.category || 'usage',
        priority: data.priority || 999,
        enabled: data.enabled !== false,
        createdAt: data.createdAt || new Date().toISOString(),
      };
    });

    // 只返回启用的问题，按优先级和创建时间排序
    const result = qaItems
      .filter(item => item.enabled)
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    if (ENABLE_PROD_CACHE) cachedAllQA = { data: result, ts: Date.now() };
    return result;
  } catch (error) {
    console.error('Error reading QA files:', error);
    return [];
  }
}

/** 主动失效 QA 缓存 */
export function invalidateQACache(): void {
  cachedAllQA = null;
}

export function getQAByCategory(category: QAItem['category']): QAItem[] {
  return getAllQA().filter(item => item.category === category);
}
