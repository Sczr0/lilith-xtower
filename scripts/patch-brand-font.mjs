/**
 * 品牌字体 CSS 构建期修补脚本（②）
 *
 * 为什么需要：
 *   cn-font-split 生成的 result.css 里 160 条 @font-face 全部是 `font-display: swap`。
 *   swap 的语义是「永不阻塞、随时替换」，所以哪怕字体 100% 命中缓存，也一定先画一帧
 *   后备字体再换 —— 这就是「每次都要闪一下」的直接原因之一。
 *   改成 `fallback`（~100ms 阻塞期 + ~3s 交换期）后：
 *     - 缓存命中 → 字体在阻塞期内就绪 → 首帧直接是品牌字体，不闪；
 *     - 缓存未命中 → 短阻塞期后落回后备字体，字体到达再换 → 只闪一次。
 *
 * 做法：
 *   就地修补生成产物（保持 URL 不变，避免多一份 154KB 的派生文件；脚本幂等）。
 *   若重新用 cn-font-split 生成字体包，重新跑一次构建即会自动打上。
 *
 * 用法：
 *   node scripts/patch-brand-font.mjs            # 修补（幂等）
 *   node scripts/patch-brand-font.mjs --check    # 只检查，未修补则退出码 1
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const CHECK_ONLY = process.argv.includes('--check');

const FROM = /font-display\s*:\s*swap/gi;
const TO = 'font-display:fallback';

const files = globSync('public/fonts/**/result.css', { cwd: ROOT });
if (files.length === 0) {
  console.warn('[patch-brand-font] 未找到 public/fonts/**/result.css，跳过');
  process.exit(0);
}

let patched = 0;
let clean = 0;
let missing = 0;

for (const rel of files) {
  const abs = join(ROOT, rel);
  let css;
  try {
    css = readFileSync(abs, 'utf8');
  } catch (err) {
    console.warn(`[patch-brand-font] 读取失败 ${rel}: ${err.message}`);
    missing++;
    continue;
  }

  const hits = css.match(FROM)?.length ?? 0;
  if (hits === 0) {
    clean++;
    console.log(`[patch-brand-font] 已是最新 ${rel}`);
    continue;
  }

  if (CHECK_ONLY) {
    console.error(`[patch-brand-font] ${rel} 仍有 ${hits} 处 font-display:swap`);
    patched++;
    continue;
  }

  const before = statSync(abs).size;
  writeFileSync(abs, css.replace(FROM, TO), 'utf8');
  patched++;
  console.log(
    `[patch-brand-font] ${rel}: ${hits} 处 swap → fallback（${before} → ${statSync(abs).size} 字节）`,
  );
}

if (CHECK_ONLY && patched > 0) process.exit(1);
if (patched === 0 && clean === 0 && missing > 0) process.exit(1);

// 若线上实际加载的是 CDN 上的那份 result.css，本地这份补丁不会被用到，必须显式提醒。
const configured = readConfiguredCss();
if (
  configured &&
  /^https?:\/\//i.test(configured) &&
  !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(configured)
) {
  console.warn(
    `[patch-brand-font] 注意：NEXT_PUBLIC_BRAND_FONT_CSS 指向远端 ${configured}\n` +
      '[patch-brand-font]       本地 result.css 的 font-display 已改为 fallback，但线上走的是远端那份，\n' +
      '[patch-brand-font]       需要把同样处理过的 result.css 重新上传到 CDN（或去掉该环境变量改用本地版本），\n' +
      '[patch-brand-font]       否则「复访不闪」只能依赖 preload 时序，少了 fallback 的阻塞期兜底。',
  );
}

function readConfiguredCss() {
  const fromEnv = process.env.NEXT_PUBLIC_BRAND_FONT_CSS?.trim();
  if (fromEnv) return fromEnv;
  for (const file of ['.env.local', '.env.production.local', '.env.production', '.env']) {
    try {
      const text = readFileSync(join(ROOT, file), 'utf8');
      const line = text
        .split(/\r?\n/)
        .reverse()
        .find((l) => l.trim().startsWith('NEXT_PUBLIC_BRAND_FONT_CSS='));
      if (line) return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
    } catch {
      /* 文件不存在 */
    }
  }
  return undefined;
}
