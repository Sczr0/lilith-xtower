import { bindings, defineConfig } from 'cf/config';

/**
 * 探测 Worker（部署到 workers.dev，不绑任何 route）。
 * 部署前把 PROBE_KEY 改成你自己的随机串，调用时带 ?key=... 才能触发。
 */
export default defineConfig({
  worker: {
    name: 'edge-probe',
    compatibilityDate: '2025-09-01',
    entrypoint: 'src/index.ts',
    env: {
      PROBE_KEY: bindings.text('change-me'),
    },
  },
});
