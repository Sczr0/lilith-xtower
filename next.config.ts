import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://seekend.xtower.site/api/v1/:path*',
      },
    ];
  },
  async headers() {
    return [
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
    ];
  },
};

export default nextConfig;
