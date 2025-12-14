type RewriteFn = (url: string) => string;

// 仅对 SVG <image> 的 href / xlink:href 做重写，避免误伤其他属性。
// 目标：将外链图片替换为同源代理地址，解决 CSP/CORS 导致的 SVG 内嵌图片无法加载。
export function rewriteSvgImageHrefs(svgText: string, rewriteUrl: RewriteFn): string {
  // 匹配：<image ... href="..."> 或 <image ... xlink:href='...'>
  // 说明：这里刻意不尝试完整 XML 解析，避免在无 DOMParser 的环境（vitest/node）下不可测。
  return svgText.replace(
    /(<image\b[^>]*\s)(href|xlink:href)\s*=\s*(["'])([^"']+)\3/gi,
    (full, prefix: string, attr: string, quote: string, url: string) => {
      if (!/^https?:\/\//i.test(url)) {
        return full;
      }

      const replaced = rewriteUrl(url);
      if (!replaced || replaced === url) {
        return full;
      }

      // 统一输出为双引号，避免把原始 URL 中的单引号/双引号弄乱
      return `${prefix}${attr}="${replaced}"`;
    },
  );
}

