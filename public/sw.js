/* ============================================================================
 * Phigros Query — Service Worker (PWA)
 *
 * 策略摘要：
 *  - 静态资源 (/_next/static, /chunks, /precompiled, /icons, favicon,
 *    manifest)  → cache-first（这些资源均由 next.config 配置了 long/immutable
 *    Cache-Control，缓存命中即不再发网，离线可复用）。
 *  - /fonts/*（品牌字体 CSS 与子集）→ 不拦截，交给浏览器 HTTP 缓存
 *    （同样是 immutable 一年）。原因：复访要靠 <head> 里的渲染阻塞样式表
 *    在首帧前拿到字体，Service Worker 的 respondWith 会多一跳异步（SW 冷启动
 *    时更久），那一跳足以让字体错过首帧、退回「先系统字体再切换」。
 *  - 公开只读 API（白名单）→ stale-while-revalidate（先回缓存，后台刷新）。
 *  - 页面导航（HTML）→ network-first；离线时回退到已缓存的公开页，否则给出
 *    /offline.html。
 *  - 其余（鉴权/会话/保存/内部端点、catch-all 与 unified 代理、非 GET、跨域
 *    分析脚本）→ 一律不拦截、不缓存，交给浏览器正常走网络，避免缓存到带
 *    用户凭据的响应造成跨用户泄漏。
 *
 * 注意：当静态资源布局或缓存策略变化时，请将 CACHE_VERSION 递增以清空旧缓存。
 * ========================================================================== */

const CACHE_VERSION = "v2";
const STATIC_CACHE = `lilith-static-${CACHE_VERSION}`;
const PAGES_CACHE = `lilith-pages-${CACHE_VERSION}`;
const API_CACHE = `lilith-api-${CACHE_VERSION}`;

const OFFLINE_PATH = "/offline.html";

// 安装时预缓存的最小壳（允许个别失败，不阻断安装）。
const PRECACHE = [
  OFFLINE_PATH,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// 只对“确定公开且只读的 GET 接口”做 SWR 缓存；其余 /api/* 与 /internal/*
// （含 catch-all 与 unified 代理）一律不缓存。
const SWR_API_PATTERNS = [
  /^\/api\/public\/profile\/.+/,
  /^\/api\/leaderboard\/rks\/(?:top|by-rank)$/,
  /^\/api\/stats\/.+/,
  /^\/api\/content\/.+/,
  /^\/api\/songs$/,
  /^\/api\/qa$/,
  /^\/api\/agreement$/,
  /^\/internal\/sponsors$/,
];

// 公开页面（与 middleware.ts 的 PUBLIC_HTML_CACHE 键保持一致），仅这些页面的
// HTML 响应会被缓存以支持离线访问；个性化页面（dashboard 等）不缓存。
const PUBLIC_PAGES = new Set([
  "/",
  "/about",
  "/sponsors",
  "/contribute",
  "/songs",
  "/login",
  "/open-platform",
  "/open-platform/agreement",
  "/qa",
  "/agreement",
  "/privacy",
]);

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isCacheFirstCandidate(url) {
  if (!isSameOrigin(url)) return false;
  const p = url.pathname;
  // 注意：/fonts/ 刻意不在此列，见文件头「策略摘要」中的说明。
  return (
    p.startsWith("/_next/static/") ||
    p.startsWith("/chunks/") ||
    p.startsWith("/precompiled/") ||
    p.startsWith("/icons/") ||
    p === "/favicon.ico" ||
    p === "/manifest.webmanifest"
  );
}

function isSrwApi(url) {
  return (
    isSameOrigin(url) &&
    SWR_API_PATTERNS.some((re) => re.test(url.pathname))
  );
}

function isProbablyCacheableResponse(res) {
  return res && res.ok && !res.headers.get("set-cookie");
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (isProbablyCacheableResponse(res)) {
    // 只缓存成功的同源 GET；clone 以避免已使用的响应体被再次读取
    cache.put(req, res.clone()).catch(() => {});
  }
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (isProbablyCacheableResponse(res)) {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

// 通知所有打开的同源页面（供离线提示条等 UI 联动）
async function notifyClients(type, url) {
  try {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
    for (const client of clients) {
      client.postMessage({ type, url: url || null });
    }
  } catch {
    /* ignore */
  }
}

async function networkFirstNavigate(req) {
  const cache = await caches.open(PAGES_CACHE);
  const url = new URL(req.url);
  const publicPage = PUBLIC_PAGES.has(url.pathname);

  try {
    const res = await fetch(req);
    // 网络可用（即便 4xx/5xx 也算连通）——通知页面恢复在线状态
    notifyClients("NETWORK_OK", url.pathname);
    if (publicPage && isProbablyCacheableResponse(res)) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    // 网络失败：回退到已缓存内容 / 离线页，并通知页面正在使用缓存
    notifyClients("OFFLINE_FALLBACK", url.pathname);
    const cached = await cache.match(req);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_PATH);
    if (offline) return offline;
    return Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(
        PRECACHE.map((u) =>
          cache
            .add(u)
            .catch(() => {
              /* 个别资源不可用时不阻断安装 */
            }),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

// 注册组件在检测到 waiting 的 SW 时会发来 SKIP_WAITING，配合安装时的
// skipWaiting 与 activate 的 clients.claim，让新版本尽快接管。
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGES_CACHE, API_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names.map((n) => (keep.has(n) ? null : caches.delete(n))),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // 仅拦截同源的安全 GET；其余交给浏览器直接走网络（不缓存带凭据的请求）
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!isSameOrigin(url)) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirstNavigate(req));
    return;
  }
  if (isCacheFirstCandidate(url)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }
  if (isSrwApi(url)) {
    event.respondWith(staleWhileRevalidate(req, API_CACHE));
    return;
  }
  // 其余（鉴权/会话/保存/内部端点、代理、非白名单 /api/*）→ 浏览器默认网络
});
