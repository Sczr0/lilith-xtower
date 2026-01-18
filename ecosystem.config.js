module.exports = {
  apps: [
    {
      name: 'lilith-xtower',
      script: 'server.js',
      // 2H2G 服务器资源有限，且有后端服务，建议设置为 1 或 'max' (如果只有这一个主要服务)
      // 如果内存紧张，请显式设置为 1
      instances: 'max', 
      exec_mode: 'cluster', // 集群模式支持零停机重载 (pm2 reload)
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      },
    },
  ],
};
