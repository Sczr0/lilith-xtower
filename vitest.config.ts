import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    /**
     * 测试必须运行在非 production 的 NODE_ENV 下（vitest 默认即 test），这里显式固定，
     * 避免受外部环境干扰（本机 shell / CI 可能预设 NODE_ENV=production）：
     *
     * - react 的**生产构建不导出 `act`**（只有 react.development.js 有），而
     *   react-dom/test-utils 的 act 包装内部会调用 `React.act(callback)`，
     *   于是 @testing-library/react 会抛 "React.act is not a function"，
     *   导致所有 jsdom 组件测试整体红灯。
     * - src/app/api/unified/upstream.ts 在 production 下会强制关闭本地探针，
     *   使该模块的用例期望落空。
     */
    env: { NODE_ENV: 'test' },
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Next.js 内部提供的 server-only 包在 vitest 下无法解析，使用空桩
      'server-only': path.resolve(__dirname, 'test/server-only-stub.ts'),
    },
  },
});
