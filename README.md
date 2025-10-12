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

文档

- 更新日志见 `[CHANGELOG.md](docs/CHANGELOG.md)`

许可

MIT，详见 `LICENSE`。
