import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://evernight.xtower.site/:path*',
      },
    ];
  },
};

export default nextConfig;
