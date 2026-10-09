/* ============================================================================
 * Phigros Query — Service Worker (PWA)
 * 当静态资源布局或缓存策略变化时，递增 CACHE_VERSION 
 * ========================================================================== */

const CACHE_VERSION = "v4";
const STATIC_CACHE = `lilith-static-${CACHE_VERSION}`;
const PAGES_CACHE = `lilith-pages-${CACHE_VERSION}`;
const API_CACHE = `lilith-api-${CACHE_VERSION}`;
const RSC_CACHE = `lilith-rsc-${CACHE_VERSION}`;

const OFFLINE_PATH = "/offline.html";

const RSC_QUERY_PARAM = "_rsc";

const API_CACHE_MAX_ENTRIES = 300;

const API_LRU_KEY = "__sw_api_lru__";

// 安装时预缓存的最小壳
const PRECACHE = [
  OFFLINE_PATH,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

const SWR_API_PATTERNS = [
  /^\/api\/public\/profile\/.+/,
  /^\/api\/leaderboard\/rks\/(?:top|by-rank)$/,
  /^\/api\/content\/.+/,
  /^\/api\/songs$/,
  /^\/api\/qa$/,
  /^\/api\/agreement$/,
  /^\/internal\/sponsors$/,
];

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
  "/verify",
  "/banned",
]);

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isCacheFirstCandidate(url) {
  if (!isSameOrigin(url)) return false;
  const p = url.pathname;
  return (
    p.startsWith("/_next/static/") ||
    p.startsWith("/chunks/") ||
    p.startsWith("/precompiled/") ||
    p.startsWith("/icons/") ||
    p === "/favicon.ico"
  );
}

function isManifestRequest(url) {
  return url.pathname === "/manifest.webmanifest";
}

function isRscRequest(req, url) {
  if (url.searchParams.has(RSC_QUERY_PARAM)) return true;
  return req.headers.get("rsc") === "1";
}

function isRscPrefetchRequest(req) {
  return (
    req.headers.get("next-router-prefetch") !== null ||
    req.headers.get("next-router-segment-prefetch") !== null
  );
}

function isRscPayloadResponse(res) {
  return (res.headers.get("content-type") || "").startsWith("text/x-component");
}

function rscCacheKey(url) {
  const u = new URL(url.href);
  u.searchParams.delete(RSC_QUERY_PARAM);
  u.hash = "";
  return u.toString();
}

function isSrwApi(url) {
  return (
    isSameOrigin(url) &&
    SWR_API_PATTERNS.some((re) => re.test(url.pathname))
  );
}

function isProbablyCacheableResponse(res) {
  if (!res || !res.ok) return false;
  if (res.headers.get("set-cookie")) return false;
  const cacheControl = (res.headers.get("cache-control") || "").toLowerCase();
  if (cacheControl.includes("no-store") || cacheControl.includes("private")) return false;
  return true;
}

function apiLruRequest() {
  return new Request(new URL(`/${API_LRU_KEY}`, self.location.origin));
}

async function readApiLruList(cache) {
  try {
    const res = await cache.match(apiLruRequest());
    if (!res) return [];
    const list = await res.json();
    return Array.isArray(list) ? list.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}

async function writeApiLruList(cache, list) {
  try {
    await cache.put(
      apiLruRequest(),
      new Response(JSON.stringify(list), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch {
    /* ignore */
  }
}

async function touchApiCache(cache, req) {
  const key = req.url;
  const list = (await readApiLruList(cache)).filter((k) => k !== key);
  list.push(key);
  while (list.length > API_CACHE_MAX_ENTRIES) {
    const evicted = list.shift();
    if (!evicted) break;
    try {
      await cache.delete(evicted);
    } catch {
      /* ignore */
    }
  }
  await writeApiLruList(cache, list);
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (isProbablyCacheableResponse(res)) {
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
        const clone = res.clone();
        cache
          .put(req, clone)
          .then(() => touchApiCache(cache, req))
          .catch(() => {});
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

async function networkFirstStatic(req, cacheName) {
  let cache;
  try {
    cache = await caches.open(cacheName);
  } catch {
    return fetch(req);
  }
  const url = new URL(req.url);
  try {
    const res = await fetch(req);
    if (isProbablyCacheableResponse(res)) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    const cached = (await cache.match(req)) || (await cache.match(url.pathname));
    if (cached) return cached;
    return Response.error();
  }
}

async function matchCachedNavigation(cache, req, url) {
  const exact = await cache.match(req);
  if (exact) return exact;

  const fallback = new URL(url.href);
  fallback.search = "";
  fallback.hash = "";
  if (fallback.toString() === url.toString()) return undefined;
  return cache.match(new Request(fallback.toString(), { headers: req.headers }));
}

async function networkFirstNavigate(req) {
  const cache = await caches.open(PAGES_CACHE);
  const url = new URL(req.url);
  const publicPage = PUBLIC_PAGES.has(url.pathname);

  try {
    const res = await fetch(req);
    notifyClients("NETWORK_OK", url.pathname);
    if (publicPage && isProbablyCacheableResponse(res)) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    notifyClients("OFFLINE_FALLBACK", url.pathname);
    const cached = await matchCachedNavigation(cache, req, url);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_PATH);
    if (offline) return offline;
    return Response.error();
  }
}

async function readRscCache(key) {
  try {
    const cache = await caches.open(RSC_CACHE);
    return await cache.match(key);
  } catch {
    return undefined;
  }
}

async function writeRscCache(key, res) {
  try {
    const cache = await caches.open(RSC_CACHE);
    await cache.put(key, res);
  } catch {
  }
}

async function networkFirstRsc(req) {
  const url = new URL(req.url);
  const prefetch = isRscPrefetchRequest(req);
  const cacheable = !prefetch && PUBLIC_PAGES.has(url.pathname);
  const key = rscCacheKey(url);

  let res;
  try {
    res = await fetch(req);
  } catch {
    if (cacheable) {
      const cached = await readRscCache(key);
      if (cached) return cached;
    }
    return Response.error();
  }

  if (!prefetch) notifyClients("NETWORK_OK", url.pathname);
  if (cacheable && isRscPayloadResponse(res) && isProbablyCacheableResponse(res)) {
    await writeRscCache(key, res.clone());
  }
  return res;
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
            }),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGES_CACHE, API_CACHE, RSC_CACHE]);
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
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!isSameOrigin(url)) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirstNavigate(req));
    return;
  }
  if (isRscRequest(req, url)) {
    event.respondWith(networkFirstRsc(req));
    return;
  }
  if (isManifestRequest(url)) {
    event.respondWith(networkFirstStatic(req, STATIC_CACHE));
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
});
