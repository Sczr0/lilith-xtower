import { bindings, defineConfig, exports, triggers } from 'cf/config';

/**
 * Cloudflare CLI（`cf`）配置（`cf` 目前为 beta）。
 *
 * 契约对齐后端 `Next-Phi-Backend`：两个端点
 *   POST /api/auth/qrcode?taptapVersion=cn|global   → { qrId, verificationUrl, expiresIn, interval }
 *   GET  /api/auth/qrcode/{qr_id}/status            → { status, sessionToken?, retryAfter?, message? }
 * 海外（非 CN）由 Durable Object 在本 Worker 处理；国内不经过 CF，走 ESA→源站 catch-all→seekend。
 *
 * DO 生命周期用 `exports.durableObject` 声明（取代 Wrangler 的 migrations）。
 */
// 允许用环境变量覆盖（CI workflow_dispatch 或本地 `HANDLE_MODE=do cf deploy` 时注入）；默认 proxy。
// 用 globalThis 访问 process，避免为配置文件引入 Node 类型依赖。
const handleMode =
  (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env?.HANDLE_MODE ??
  'proxy';

export default defineConfig({
  worker: {
    name: 'taptap-flow',
    compatibilityDate: '2025-09-01',
    entrypoint: 'src/index.ts',
    triggers: [
      // 只接管扫码登录这两个端点；其余 /api/* 仍走源站。
      triggers.fetch({ pattern: 'lilith.xtower.site/api/auth/qrcode*', zone: 'xtower.site' }),
    ],
    exports: {
      TapTapFlow: exports.durableObject({ storage: 'sqlite' }),
    },
    env: {
      // proxy = 透传 seekend（灰度/回滚/CN 兜底）；do = 本地 DO 处理。
      HANDLE_MODE: bindings.text(handleMode),
      CN_FALLBACK_COUNTRIES: bindings.text('CN'),
      // 透传目标：seekend 业务前缀（直接可达，避免回环到本域名）。
      PROXY_BASE: bindings.text('https://seekend.xtower.site/api/v1'),
      TAP_FLOW: bindings.durableObject({ worker: 'taptap-flow', exportName: 'TapTapFlow' }),
    },
  },
});
