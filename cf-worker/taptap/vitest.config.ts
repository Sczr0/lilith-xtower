import { defineConfig } from 'vitest/config';

/**
 * 纯单元测试（node 环境）：只覆盖不依赖 Workers 运行时的模块（md5 / 签名 / 状态机）。
 * Durable Object 与 `cf` 配置的集成验证放到 `cf deploy --dry-run` 与联调阶段。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
