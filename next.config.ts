import { withSentryConfig } from "@sentry/nextjs";
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
  // 静态资源 URL 附带构建版本，部署后旧缓存自动失效
  generateBuildId: async () => BUILD_ID,
  env: {
    // 供客户端（诊断信息块/页脚）读取当前构建版本
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
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
