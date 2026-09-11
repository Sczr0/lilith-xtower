import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withAxiom } from "next-axiom";

// 构建版本号：优先 git 短提交，非 git 环境回退日期（诊断信息/页脚展示用）
function resolveBuildId(): string {
  try {
    const rev = execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (rev) return rev;
  } catch {
    // 忽略：非 git 环境
  }
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

const BUILD_ID = resolveBuildId();

const outputMode: NextConfig["output"] =
  process.platform === "win32" ? undefined : "standalone";

const nextConfig: NextConfig = {
  output: outputMode,
  /**
   * 生成浏览器端 source map。
   *
   * Next 默认 false，Turbopack 只会为 `server/**` 出 map，`static/chunks/*.js` 没有 .map，
   * 导致 Sentry 只收到带 debugId 的 chunk、收不到对应 source file，栈永远无法符号化
   * （“No Source File With Matching Debug ID”）。
   * 这些 map 会由 withSentryConfig 上传到 Sentry，并在上传后删除（见下方 sourcemaps 选项）。
   */
  productionBrowserSourceMaps: true,
  // 静态资源 URL 附带构建版本，部署后旧缓存自动失效
  generateBuildId: async () => BUILD_ID,
  env: {
    // 供客户端（诊断信息块/页脚）读取当前构建版本
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  /**
   * 关闭「流式 metadata」（streaming metadata）以规避 React 19 的宿主提升资源崩溃。
   *
   * 背景：Next 16 默认对普通浏览器启用 streaming metadata，把 `<title>`/`<meta>`/`<link>`
   * 渲染进一个 `<div hidden>` 并交给 React 19 hoist 到 `<head>`。客户端软导航（如
   * /dashboard → /login 的鉴权跳转）删除该子树时，某个已被 hoist 的节点 parentNode 已被置空，
   * React 的 commitDeletionEffectsOnFiber（HostHoistable 分支）仍执行
   * `stateNode.parentNode.removeChild(stateNode)`，抛出：
   *   TypeError: Cannot read properties of null (reading 'removeChild')
   * 详见 node_modules/next/dist/lib/metadata/metadata.js 的 MetadataWrapper。
   *
   * shouldServeStreamingMetadata() 里 htmlLimitedBots 是唯一开关：UA 命中正则即返回 false，
   * 走非流式的 MetadataBoundary 分支（无 hidden div）。该配置仅影响 metadata 的流式与否，
   * 不参与 is-bot / 动态渲染判定。匹配全部 UA 等价于「所有请求都用阻塞式 metadata」，
   * 即 Next 15.2 之前的既有行为。
   *
   * TODO: 升级 next（当前 16.2.12 → 16.3.4）验证上游修复后，可移除此开关。
   */
  htmlLimitedBots: /.*/,
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-select"],
  },
  async redirects() {
    return [
      {
        source: "/info",
        destination: "/songs",
        statusCode: 301,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        // 说明：/api/* 的统一转发由 app/api/[...path]/route.ts 承担（带前缀白名单）。
        // 这里不再配置 /api/:path* 泛匹配，避免绕过白名单形成全量代理面。
        {
          source: "/health",
          destination: "https://seekend.xtower.site/health",
        },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/health",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
      {
        source: "/api/auth/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, max-age=0, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Vary",
            value: "Cookie, Authorization",
          },
        ],
      },
      // 注意：公开只读接口的缓存规则必须排在 /api/:path* no-store 之后，
      // 同名头多条规则匹配时后者覆盖前者（Next.js 官方语义）。
      {
        source: "/api/leaderboard/rks/top",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=120, stale-while-revalidate=600",
          },
        ],
      },
      {
        source: "/api/leaderboard/rks/by-rank",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=120, stale-while-revalidate=600",
          },
        ],
      },
      {
        source: "/api/public/profile/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/api/stats/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
          },
        ],
      },
      {
        source: "/internal/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
      {
        source: "/api/content/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/api/songs",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/api/qa",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/api/agreement",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/internal/sponsors",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
          },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:all*.(woff2|woff)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/chunks/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/precompiled/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=600",
          },
        ],
      },
      {
        source: "/precompiled/:file.html",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/precompiled/:file.toc.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // PWA：service worker 必须可及时更新，禁止 long-cache / immutable
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
  analyzerMode: "static",
});

export default withSentryConfig(withAxiom(withBundleAnalyzer(nextConfig)), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "r-0semi",

  project: "lilith-xtower",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  sourcemaps: {
    // 上传成功后删除 map（Turbopack 下还会顺带剥掉 chunk 末尾的 sourceMappingURL 注释），
    // 避免把源码 map 公开到 static/chunks。上传在构建期由 SENTRY_AUTH_TOKEN 完成。
    deleteSourcemapsAfterUpload: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
