# edge-probe

从 **Cloudflare 边缘**去 fetch TapTap / LeanCloud 上游，测**可达性与延迟**。
用途：判断「cn 版本能不能放在边缘跑」——CF 到国内链路常常不可达或很差。

## 探测目标（两组 × cn/global × 4 项）

- `backend`：后端 `Next-Phi-Backend/config.example.toml` 实际用的端点（要"薅"后端模块就以这组为准）
  - cn：device `www.taptap.com` / token `www.taptap.cn` / user_info `open.tapapis.cn` / LeanCloud `rak3ffdi.cloud.tds1.tapapis.cn`
  - global：device+token `www.taptap.io` / user_info `open.tapapis.io` / LeanCloud `kviehlel.cloud.ap-sg.tapapis.com`
- `current`：本站 `shared/taptap-config.json` 用的端点（`accounts.tapapis.cn` / `accounts.tapapis.com`），仅作对比

每组的 4 项：`device_code`（真实表单）、`token_reach`（无效 code，证明可达）、`user_info`、`leancloud`。

## 部署

（`cf` 在 Windows 上有 beta bug，见根 README；请在 WSL2/Linux 部署，或临时用 wrangler）

1. 在 `cloudflare.config.ts` 把 `PROBE_KEY` 改成随机串。
2. 部署（不绑 route，走 workers.dev）：

```bash
cd cf-worker/probe
pnpm install
pnpm typecheck
pnpm exec cf deploy      # WSL/Linux；或 pnpm exec wrangler deploy
```

## 调用

```bash
BASE="https://edge-probe.<你的子域>.workers.dev"
curl -s "$BASE/?key=<PROBE_KEY>&group=backend&only=cn"
curl -s "$BASE/?key=<PROBE_KEY>&group=backend&only=global"
curl -s "$BASE/?key=<PROBE_KEY>&group=current&only=cn"    # 对比组
```

## 判读

```json
{
  "edge": { "colo": "NRT", "country": "JP" },
  "totalMs": 1234,
  "results": [
    { "name": "backend:cn:device_code", "ok": true, "status": 200, "ms": 320, "snippet": "{\"success\":true,...}" },
    { "name": "backend:cn:leancloud",   "ok": false, "status": null, "ms": 12000, "error": "TimeoutError: ..." }
  ]
}
```

- `ok:true` + 几百 ms → 边缘能到，cn 可放边缘。
- `ok:false` 或 `ms≈12000` → 边缘到不了，**cn 必须回源站**。
- 重点：`backend:cn:device_code` / `token_reach` / `leancloud` 三条，以及和 `current` 组的差异。
- 多打几次看稳定性；不同 colo 结果会不同，必要时从多地区分别打。
