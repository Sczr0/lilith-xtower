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
    a: ['href', 'name', 'target', 'title', 'rel', 'referrerpolicy'],
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
    // 说明：允许形如 //example.com 的协议相对链接（会在 transformTags 里规范化为 https）
    allowProtocolRelative: true,
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
        // 站外跳转提示页：仅对“会离开本站的 web 链接”启用（http/https/协议相对）。
        const isExternalWeb = /^https?:\/\//i.test(href) || href.startsWith('//');
        const normalized = href.startsWith('//') ? `https:${href}` : href;
        const goHref = isExternalWeb ? `/go?url=${encodeURIComponent(normalized)}` : null;

        let rel = attribs.rel || '';
        if (isExternalWeb) {
          const parts = new Set(rel.split(/\s+/).filter(Boolean));
          parts.add('noopener');
          parts.add('noreferrer');
          rel = Array.from(parts).join(' ');
        }

        return {
          tagName: 'a',
          attribs: {
            ...attribs,
            href: goHref ?? href,
            // 说明：外链统一新标签打开，并显式禁止发送 Referer。
            ...(isExternalWeb ? { target: '_blank', rel, referrerpolicy: 'no-referrer' } : { rel }),
          },
        };
      },
    },
  });

  return clean;
}
