import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Next.js 内部提供的 server-only 包在 vitest 下无法解析，使用空桩
      'server-only': path.resolve(__dirname, 'test/server-only-stub.ts'),
    },
  },
});
