module.exports = {
  apps: [
    {
      name: 'lilith-xtower',
      script: 'server.js',
      // 显式单实例（2H2G 单机）：
      instances: 1,
      exec_mode: 'cluster', // 单实例 + cluster 保留零停机重载 (pm2 reload) 能力
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      },
    },
  ],
};
