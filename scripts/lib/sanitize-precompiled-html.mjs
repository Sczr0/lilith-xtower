import sanitizeHtml from 'sanitize-html';

/**
 * 将 Markdown 渲染出的 HTML 进行白名单净化，并为标题注入稳定的 heading id。
 *
 * 说明：
 * - 预编译产物会在运行时通过 dangerouslySetInnerHTML 渲染，因此必须确保“只能渲染净化后的 HTML”。
 * - heading id 用于协议/隐私页目录高亮与定位（data-heading-id + id）。
 */
export function sanitizeWithHeadingIds(html) {
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
      // 注入稳定 data-heading-id 与 id（用于目录高亮/锚点定位）
      ...Object.fromEntries(
        allowedHeadings.map((tag) => [
          tag,
          (_tagName, attribs) => {
            const id = attribs['data-heading-id'] ?? `heading-${headingCounter++}`;
            return {
              tagName: tag,
              attribs: { ...attribs, 'data-heading-id': id, id },
            };
          },
        ]),
      ),
      a: (_tagName, attribs) => {
        const href = attribs.href || '';
        // 绝对 http/https 视为外链；补齐 rel 以避免 opener 风险
        const isExternal = /^https?:\/\//i.test(href);
        let rel = attribs.rel || '';
        if (isExternal) {
          const parts = new Set(rel.split(/\s+/).filter(Boolean));
          parts.add('noopener');
          parts.add('noreferrer');
          rel = Array.from(parts).join(' ');
        }
        return { tagName: 'a', attribs: { ...attribs, rel } };
      },
    },
  });

  return clean;
}
