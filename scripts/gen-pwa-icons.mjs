#!/usr/bin/env node
// Generate PWA icons from the site avatar into public/icons/.
// Usage: node scripts/gen-pwa-icons.mjs
// Requires: sharp (already a runtime dependency).

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const CWD = process.cwd();
const SOURCE = path.join(CWD, 'public', 'about', 'avatar.png');
const OUT_DIR = path.join(CWD, 'public', 'icons');

// Maskable safe-zone: content must fit within a circle of diameter ~80% of the
// icon. We shrink the artwork to 70% and center it on a solid background.
const MASKABLE_SOURCE_SCALE = 0.7;
const MASKABLE_BG = { r: 255, g: 255, b: 255, alpha: 1 };

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('[gen-pwa-icons] source not found:', SOURCE);
    process.exit(1);
  }
  await fsp.mkdir(OUT_DIR, { recursive: true });

  const meta = await sharp(SOURCE).metadata();
  console.log('[gen-pwa-icons] source:', path.relative(CWD, SOURCE), `${meta.width}x${meta.height}`);

  // 1) "any" purpose icons (full-bleed square artwork).
  await sharp(SOURCE).resize({ width: 192, height: 192, fit: 'cover' }).png().toFile(path.join(OUT_DIR, 'icon-192.png'));
  await sharp(SOURCE).resize({ width: 512, height: 512, fit: 'cover' }).png().toFile(path.join(OUT_DIR, 'icon-512.png'));

  // 2) 180x180 for iOS apple-touch-icon (iOS rounds it itself, so full square is correct).
  await sharp(SOURCE).resize({ width: 180, height: 180, fit: 'cover' }).png().toFile(path.join(OUT_DIR, 'apple-touch-icon.png'));

  // 3) maskable 512: artwork scaled to 70% centered on a solid background so
  //    circular / rounded maskable cropping keeps the character in the safe zone.
  const inner = Math.round(512 * MASKABLE_SOURCE_SCALE);
  const offset = Math.round((512 - inner) / 2);
  const overlay = await sharp(SOURCE).resize({ width: inner, height: inner, fit: 'cover' }).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: MASKABLE_BG } })
    .composite([{ input: overlay, left: offset, top: offset }])
    .png()
    .toFile(path.join(OUT_DIR, 'icon-maskable-512.png'));

  // 4) favicon fallback reference (optional, small).
  await sharp(SOURCE).resize({ width: 32, height: 32, fit: 'cover' }).png().toFile(path.join(OUT_DIR, 'favicon-32.png'));

  for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'icon-maskable-512.png', 'favicon-32.png']) {
    const p = path.join(OUT_DIR, f);
    const s = await fsp.stat(p);
    console.log('[gen-pwa-icons] wrote', path.relative(CWD, p), `${Math.round(s.size / 1024)}KB`);
  }
}

main().catch((err) => {
  console.error('[gen-pwa-icons] Failed:', err);
  process.exit(1);
});
