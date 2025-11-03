Phigros Query（塔弦）

Phigros 成绩查询与图片生成器。提供 BestN 图片生成、单曲成绩图片、RKS 列表、新曲速递、服务统计等功能，支持移动端与深色模式。

站点主页：https://lilith.xtower.site

功能特性

- 登录入口（TapTap/联合查分等）
- 仪表盘：Best N 图片、单曲成绩图片、RKS 列表、新曲速递、玩家自报成绩渲染、服务统计
- 公告弹窗（Markdown，支持“稍后不再提示”）
- 深色模式（next-themes class 策略）

快速开始

开发环境：Node.js 18+（推荐 LTS）

安装依赖：

```bash
npm i
# 或 pnpm i
```

本地开发：

```bash
npm run dev
```

构建与启动：

```bash
npm run build
npm run start
```

环境变量

- `NEXT_PUBLIC_SITE_URL`（可选）：用于站点元数据 `metadataBase`

Web Vitals 真实用户监测（RUM）
- 已集成基于 `web-vitals` 的 RUM，上报核心指标 LCP/CLS/INP/TTFB/FCP。
- 默认仅在生产环境启用，动态导入并在空闲时机注册，避免影响首屏关键路径。
- 采样率（可选）：在环境中设置 `NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE`（0~1，默认 1）。`rating !== 'good'` 的数据将强制上报，问题优先。
- 移动优先（可选）：设置 `NEXT_PUBLIC_WEB_VITALS_ONLY_MOBILE=true` 则仅在移动端设备上采样。
- 上报优先尝试 Umami 自定义事件：`umami.track('web-vitals', payload)`；若不可用，使用 `navigator.sendBeacon('/api/rum', ...)` 兜底。
- 服务器端接收端点：`/api/rum`（Edge Runtime），当前仅打印关键字段，可按需接入日志或持久化。
- 细节：
  - 端侧去重：同一 `name+id` 仅上报一次；`CLS` 微小增量（`delta < 0.001`）被过滤。
  - 视图分段：当路由变更（软导航）时生成 `viewId`，便于按“页面视图”聚合。

文档

- 更新日志见 `[CHANGELOG.md](docs/CHANGELOG.md)`

许可

MIT，详见 `LICENSE`。
