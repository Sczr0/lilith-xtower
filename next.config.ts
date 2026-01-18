import type { NextConfig } from "next";
// 启用 Bundle Analyzer：生成静态可视化报告，用于定位过度切分与大体积依赖
// 使用 ESM 默认导入（项目已启用 esModuleInterop）
import bundleAnalyzer from '@next/bundle-analyzer';

const nextConfig: NextConfig = {
  // 开启 Standalone 模式，大幅减少部署体积，只需 Node.js 即可运行
  output: 'standalone',
  // 减少对包内子模块的零碎解析，合并请求、缩短编译与运行时的模块解析链路
  // 仅列出在客户端广泛使用、且内部模块较为分散的依赖
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-select',
    ],
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: '/api/:path*',
          destination: 'https://seekend.xtower.site/api/v1/:path*',
        },
        {
          // 轻量健康检查透传到后端根级 /health
          source: '/health',
          destination: 'https://seekend.xtower.site/health',
        },
      ],
    };
  },
  async headers() {
    return [
      {
        // 健康检查不缓存，确保实时性
        source: '/health',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
      // 说明：HTML 页面的 Cache-Control 由 middleware.ts 统一决策（可识别登录态 cookie），这里仅保留 API/静态资源的缓存头策略。
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
      {
        source: '/internal/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
      {
        source: '/api/content/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/api/qa',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/api/agreement',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/internal/sponsors',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
          },
        ],
      },
      {
        // 字体包（含字体 CSS）：目录带版本标识，允许长期缓存以提升复访与多页命中
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 为字体等静态资源设置长期缓存
        source: '/:all*.(woff2|woff)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Next.js 构建产物（哈希文件）长期缓存
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 兼容静态导出下的 chunks 路径（如报告中出现的 /chunks/*.css）
        source: '/chunks/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // legacy non-hash endpoints removed
      {
        // 预编译 manifest：短缓存以便快速感知更新
        source: '/precompiled/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=600',
          },
        ],
      },
      {
        // 预编译的哈希化 HTML：长期缓存
        source: '/precompiled/:file.html',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 预编译的哈希化 TOC JSON：长期缓存（注意匹配 .toc.json）
        source: '/precompiled/:file.toc.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

// 包分析插件：仅在 ANALYZE=true 时启用，输出静态报告
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
  analyzerMode: 'static',
});

export default withBundleAnalyzer(nextConfig);
