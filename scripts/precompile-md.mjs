#!/usr/bin/env node
// Precompile static Markdown to sanitized HTML + TOC
// Targets: agreement.md -> public/precompiled/agreement.html, agreement.toc.json

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { createHash } from 'node:crypto';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';


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

function sanitizeWithHeadingIds(html) {
  let headingCounter = 0;
  const allowedHeadings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  const allowedTags = [
    // structure
    'p', 'ul', 'ol', 'li', 'blockquote', 'hr', 'br',
    // headings
    ...allowedHeadings,
    // code
    'pre', 'code',
    // tables
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    // emphasis
    'em', 'strong',
    // links
    'a',
    // optional images
    'img',
  ];
  const allowedAttributes = {
    a: ['href', 'name', 'target', 'title', 'rel'],
    code: ['class'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    h1: ['id', 'data-heading-id'],
    h2: ['id', 'data-heading-id'],
    h3: ['id', 'data-heading-id'],
    h4: ['id', 'data-heading-id'],
    h5: ['id', 'data-heading-id'],
    h6: ['id', 'data-heading-id'],
  };

  const clean = sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto'],
      img: ['http', 'https', 'data'],
    },
    transformTags: {
      // inject stable data-heading-id for headings
      ...Object.fromEntries(
        allowedHeadings.map(tag => [tag, (attribs) => {
          const id = attribs['data-heading-id'] ?? `heading-${headingCounter++}`;
          return {
            tagName: tag,
            attribs: { ...attribs, 'data-heading-id': id, id },
          };
        }])
      ),
      a: (attribs) => {
        const href = attribs.href || '';
        // treat absolute http/https as external; add rel for safety
        const isExternal = /^https?:\/\//i.test(href);
        let rel = attribs.rel || '';
        if (isExternal) {
          const parts = new Set(rel.split(/\s+/).filter(Boolean));
          parts.add('noopener');
          parts.add('noreferrer');
          rel = Array.from(parts).join(' ');
        }
        return { tagName: 'a', attribs: { ...attribs, rel } };
      }
    },
  });
  return clean;
}

async function compileOne({ key, mdPath, outDir }) {
  const md = await fsp.readFile(mdPath, 'utf8');
  const rawHtml = marked.parse(md);
  const safeHtml = sanitizeWithHeadingIds(rawHtml);
  const toc = buildTocFromMarkdown(md);

  const hash = createHash('sha256').update(safeHtml).digest('hex').slice(0, 8);
  const htmlName = `${key}.${hash}.html`;
  const tocName = `${key}.${hash}.toc.json`;
  const outHtmlPath = path.join(outDir, htmlName);
  const outTocPath = path.join(outDir, tocName);

  await ensureDir(outDir);
  // cleanup old hashed files for this key
  try {
    const files = await fsp.readdir(outDir);
    await Promise.all(
      files
        .filter((f) => f.startsWith(`${key}.`) && (f.endsWith('.html') || f.endsWith('.toc.json')))
        .filter((f) => f !== htmlName && f !== tocName)
        .map((f) => fsp.unlink(path.join(outDir, f)).catch(() => {}))
    );
  } catch {}
  await fsp.writeFile(outHtmlPath, safeHtml, 'utf8');
  await fsp.writeFile(outTocPath, JSON.stringify(toc, null, 2), 'utf8');

  return { key, mdPath, outHtmlPath, outTocPath, htmlName, tocName };
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
    pages: Object.fromEntries(results.map((r) => [r.key, { html: r.htmlName, toc: r.tocName }])),
  };
  const a = results.find((r) => r.key === 'agreement');
  if (a) manifest.agreement = { html: a.htmlName, toc: a.tocName };
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
