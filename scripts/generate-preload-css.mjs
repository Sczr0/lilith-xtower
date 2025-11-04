#!/usr/bin/env node
/**
 * 生成首屏 CSS 预加载清单（public/preload-css.json）
 * 策略：扫描 .next/static 下的 css 文件，选取体积最大的前 N 个（默认 2 个）。
 * 输出：{"css": ["/_next/static/chunks/xxxxx.css", ...]}
 * 可通过环境变量 PRELOAD_CSS_TOPK 调整 N（建议 1~3）。
 */
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const nextStaticDir = path.join(projectRoot, '.next', 'static');
const outFile = path.join(projectRoot, 'public', 'preload-css.json');
const TOPK = Math.max(1, Math.min(Number(process.env.PRELOAD_CSS_TOPK || '2') || 2, 5));

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

try {
  if (!fs.existsSync(nextStaticDir)) {
    console.warn(`[generate-preload-css] Skip: not found ${nextStaticDir}`);
    process.exit(0);
  }

  const files = walk(nextStaticDir)
    .filter((p) => p.endsWith('.css'))
    .map((p) => ({ p, size: fs.statSync(p).size }))
    .sort((a, b) => b.size - a.size);

  const picked = files.slice(0, TOPK).map((f) => {
    // 转换为以 /_next 开头的 URL 路径
    const rel = '/' + path.relative(path.join(projectRoot, '.next'), f.p).replace(/\\/g, '/');
    return rel.startsWith('/static/') ? '/_next' + rel : '/_next/' + rel.replace(/^\/+/, '');
  });

  const json = { css: picked };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(json, null, 2));
  console.log(`[generate-preload-css] wrote ${outFile}:`, JSON.stringify(json));
} catch (e) {
  console.error('[generate-preload-css] failed:', e);
  process.exitCode = 0; // 不阻断构建
}

