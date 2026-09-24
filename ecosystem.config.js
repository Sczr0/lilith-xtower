module.exports = {
  apps: [
    {
      name: 'lilith-xtower',
      // 说明：output: 'standalone' 下 next build 产出 .next/standalone/server.js。
      // 部署时把 .next/standalone/* 铺到部署根目录（连同 .next/static 与 public），
      // 因此此处相对 PM2 的 cwd（部署根）指向 server.js。
      // 若部署布局改为直接在仓库根运行，需要同步改成 .next/standalone/server.js 并设置 cwd。
      script: 'server.js',
      // 显式单实例（2H2G 单机）：
      instances: 1,
      exec_mode: 'cluster', // 单实例 + cluster 保留零停机重载 (pm2 reload) 能力
      // 内存兜底：Node 默认堆上限可能超过 2G 物理内存，一旦泄漏会被 OOM Killer
      // 直接杀掉且不会自愈。这里显式限制堆大小，并让 PM2 在超限时自动重启。
      node_args: '--max-old-space-size=1536',
      max_memory_restart: '1500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      },
    },
  ],
};
