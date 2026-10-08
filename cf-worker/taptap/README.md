# taptap-flow-worker

TapTap 扫码登录的**海外副本**：Cloudflare Worker + Durable Object，用 **Cloudflare CLI（`cf`，beta）** 开发与部署。

- **契约对齐后端**（`Next-Phi-Backend`）：
  - `POST /api/auth/qrcode?taptapVersion=cn|global` → `{ qrId, verificationUrl, expiresIn, interval }`
  - `GET  /api/auth/qrcode/{qr_id}/status` → `{ status, sessionToken?, retryAfter?, message?, errorCode? }`
- **海外（非 CN）**：同域触发 `/api/auth/qrcode*`，由 Durable Object `TapTapFlow` 本地处理（状态在边缘，不再回源）。
- **国内**：不经过 CF，走 阿里云 ESA → 源站 catch-all `/api/auth/qrcode` → seekend（`/api/v1/auth/qrcode`）。
- 客户端零地域感知：同源、同契约。

## 目录

- `cloudflare.config.ts` — `cf` 项目配置（TS）；DO 生命周期用 `exports.durableObject` 声明。
- `src/config.ts` — 读取仓库根 `shared/taptap-config.json`（端点用 `accounts.tapapis.*`，**不要**照抄后端的 `open.tapapis.io`，该域名 NXDOMAIN）+ 常量。
- `src/tap.ts` — 移植自后端 `TapTapClient`：`requestDeviceCode` + `pollForToken`（一次完成 token→资料(MAC)→LeanCloud），**LeanCloud 用 `X-LC-Id`+`X-LC-Key`，无 MD5**。
- `src/state.ts` — 纯逻辑（`buildScanUrl` / `toRetryAfterSecs` / 类型）。
- `src/flow.ts` — Durable Object `TapTapFlow`（替代后端 Moka 缓存；**alarm 驱动上游轮询**，`status()` 只读本地状态、不 await 上游；打上游前先推进 `nextPollAt` 以去重；过期/终态即清理）。
- `src/index.ts` — 入口：两个端点 + `HANDLE_MODE` 灰度 + CN 兜底透传 seekend。

## 安装 / 校验

本目录是**独立子工作区**（自带 `pnpm-workspace.yaml`，不并入仓库根 workspace）：

```bash
cd cf-worker/taptap
pnpm install
pnpm typecheck
pnpm test
```

## 部署与灰度

1. 确认 `cloudflare.config.ts` 的 `PROXY_BASE` 指向 seekend（默认 `https://seekend.xtower.site/api/v1`）。
2. 登录（`cf` 用自己的凭据）：

   ```bash
   cf auth login          # 或 export CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
   ```

3. 先以 **proxy 模式**部署（默认 `HANDLE_MODE=proxy`，等价现状、只多一跳）：

   ```bash
   cf deploy --dry-run
   cf deploy
   ```

4. 观察无误后切 **DO 模式**（`HANDLE_MODE=do`）重新部署。
5. **回滚**：改回 `proxy` 重新部署，秒级生效。
6. **CN 校验**：国内 `curl` 应仍为 `Server: ESA` 且**没有** `X-TapTap-Edge` 头（未经本 Worker）。

排查：响应头 `X-TapTap-Edge` = `do`（边缘本地）/`proxy`（透传）。

## 注意

- 同域 trigger 依赖 `xtower.site` zone 在 CF 上、且海外解析到 CF、国内解析到 ESA。
- **Windows 已知问题**：`cf`（1.0.0-beta.12）在 Windows 上执行 `cf build/deploy` 会在「Delegating to Wrangler」阶段报 `spawn EFTYPE`（cf 自身 spawn Wrangler 的缺陷，发生在解析配置之前，与本项目无关）。请在 **WSL2/Linux** 执行，或临时用 `npx wrangler deploy`。
- 跨境合规：海外扫码会在 Cloudflare DO 处理 TapTap `access_token`/资料（openid/unionid）等个人信息，需同步更新 `docs/data-cross-border-supplement.md`。
- `cf` 不提供 Workers 运行时内的单测运行器；DO 的集成验证放在 `cf deploy --dry-run` 与联调阶段。
