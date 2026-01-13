#!/usr/bin/env node
// Precompile static Markdown to sanitized HTML + TOC
// Targets: agreement.md -> public/precompiled/agreement.html, agreement.toc.json

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { createHash } from 'node:crypto';
import { marked } from 'marked';
import { parsePgpClearsignedMessage } from './lib/pgp-clearsigned-markdown.mjs';
import { sanitizeWithHeadingIds } from './lib/sanitize-precompiled-html.mjs';


async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function buildTocFromMarkdown(md) {
  const items = [];
  const lines = md.split(/\r?\n/);
  let counter = 0;
  for (const line of lines) {
    const m = line.trim().match(/^(#{1,6})\s+(.+)$/);
    if (!m) continue;
    const level = m[1].length;
    const title = m[2].replace(/\*\*/g, '').trim();
    const id = `heading-${counter++}`;
    items.push({ id, title, level });
  }
  return items;
}

async function compileOne({ key, mdPath, outDir }) {
  const mdRaw = await fsp.readFile(mdPath, 'utf8');
  const parsed = parsePgpClearsignedMessage(mdRaw);
  const md = parsed.isClearsigned && typeof parsed.body === 'string' ? parsed.body : mdRaw;
  const rawHtml = marked.parse(md);
  const safeHtml = sanitizeWithHeadingIds(rawHtml);
  const toc = buildTocFromMarkdown(md);

  const hash = createHash('sha256').update(safeHtml).digest('hex').slice(0, 8);
  const htmlName = `${key}.${hash}.html`;
  const tocName = `${key}.${hash}.toc.json`;
  let sigName = null;
  let sigPayload = null;
  if (parsed.isClearsigned && typeof parsed.signature === 'string') {
    sigPayload = {
      format: 'openpgp-clearsign',
      status: 'signed',
      verified: null,
      hash: parsed.hash,
      signature: parsed.signature,
    };
    const sigHash = createHash('sha256')
      .update(`${sigPayload.hash ?? ''}\n${sigPayload.signature}`)
      .digest('hex')
      .slice(0, 8);
    sigName = `${key}.${sigHash}.sig.json`;
  }
  const outHtmlPath = path.join(outDir, htmlName);
  const outTocPath = path.join(outDir, tocName);
  const outSigPath = sigName ? path.join(outDir, sigName) : null;

  await ensureDir(outDir);
  // cleanup old hashed files for this key
  try {
    const files = await fsp.readdir(outDir);
    const keep = new Set([htmlName, tocName, sigName].filter(Boolean));
    await Promise.all(
      files
        .filter((f) => f.startsWith(`${key}.`) && (f.endsWith('.html') || f.endsWith('.toc.json') || f.endsWith('.sig.json')))
        .filter((f) => !keep.has(f))
        .map((f) => fsp.unlink(path.join(outDir, f)).catch(() => {}))
    );
  } catch {}
  await fsp.writeFile(outHtmlPath, safeHtml, 'utf8');
  await fsp.writeFile(outTocPath, JSON.stringify(toc, null, 2), 'utf8');
  if (outSigPath && sigPayload) {
    await fsp.writeFile(outSigPath, JSON.stringify(sigPayload, null, 2), 'utf8');
  }

  return { key, mdPath, outHtmlPath, outTocPath, outSigPath, htmlName, tocName, sigName };
}

async function main() {
  const cwd = process.cwd();
  const outDir = path.join(cwd, 'public', 'precompiled');
  const targets = [
    { key: 'agreement', mdPath: path.join(cwd, 'src', 'app', 'agreement', 'agreement.md') },
    { key: 'privacy', mdPath: path.join(cwd, 'src', 'app', 'privacy', 'privacy.md') },
    { key: 'about', mdPath: path.join(cwd, 'public', 'about', 'custom.md') },
  ];

  const results = [];
  for (const t of targets) {
    if (fs.existsSync(t.mdPath)) {
      const res = await compileOne({ key: t.key, mdPath: t.mdPath, outDir });
      results.push(res);
      console.log('[precompile-md] Compiled:', path.relative(cwd, res.mdPath), '->', path.relative(cwd, res.outHtmlPath));
    } else {
      console.log('[precompile-md] Skip (not found):', path.relative(cwd, t.mdPath));
    }
  }

  if (results.length === 0) {
    console.error('[precompile-md] No markdown sources found.');
    process.exit(1);
  }

  const manifest = {
    pages: Object.fromEntries(results.map((r) => [
      r.key,
      { html: r.htmlName, toc: r.tocName, ...(r.sigName ? { sig: r.sigName } : {}) },
    ])),
  };
  const a = results.find((r) => r.key === 'agreement');
  if (a) manifest.agreement = { html: a.htmlName, toc: a.tocName, ...(a.sigName ? { sig: a.sigName } : {}) };
  await fsp.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  // Change log
  for (const r of results) {
    const hashPart = r.htmlName.match(/\.(\w{8})\.html$/)?.[1] || 'unknown';
    console.log(`[Precompile] ${r.key}: ${hashPart} (${new Date().toISOString()})`);
  }
}

main().catch((err) => {
  console.error('[precompile-md] Failed:', err);
  process.exit(1);
});
