import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withAxiom } from "next-axiom";

const outputMode: NextConfig["output"] =
  process.platform === "win32" ? undefined : "standalone";

const nextConfig: NextConfig = {
  output: outputMode,
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-select"],
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: "/api/:path*",
          destination: "https://seekend.xtower.site/api/v1/:path*",
        },
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
            value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/api/qa",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/api/agreement",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
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

export default withAxiom(withBundleAnalyzer(nextConfig));
