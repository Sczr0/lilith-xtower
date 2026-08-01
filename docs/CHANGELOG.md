# 更新日志

规范：按日期倒序记录主要变更；语义化分类（新增/修复/优化/重构/文档/杂项）。

## Unreleased

- 安全：修复 11 个依赖漏洞（pnpm audit 归零）
  - vite 7.3.1 → 7.3.6（3 个 high CVE：dev server 任意文件读取/fs.deny 绕过；显式声明为 devDependency 以满足 vitest peer 范围）
  - sharp 0.34.5 → 0.35.3（4 个 CVE：libvips 继承漏洞；pnpm overrides 强制覆盖 next 内部锁定）
  - postcss 8.4.31 → 8.5.25（sourceMappingURL 任意文件读取；overrides 覆盖 next 内部锁定）
  - brace-expansion 1.1.16 → 1.1.18（eslint 链 DoS）、esbuild 0.27.7 → 0.28.1（Windows dev 文件读取）
  - 升级项集中在 `pnpm-workspace.yaml` 的 `overrides`，并附注释说明回退依据

- 修复：会话撤销记录改为内存表 + 文件持久化（默认 `/var/lib/lilith-xtower/revocations.json`，可用 `AUTH_SESSION_REVOCATION_FILE` 覆盖），解决 PM2 reload/重启后已登出 Cookie「复活」问题
- 优化：PM2 显式单实例（`instances: 1`），避免 cluster 多 worker 撤销记录不一致与 2H2G 内存风险
- 新增：曲目信息页（/songs，原 /info 已 301 重定向）
  - 定数表 Tab：按难度（EZ/HD/IN/AT）浏览全曲目定数，支持搜索、定数区间筛选、升降序切换；≥15 定数高亮；定数可视化条
  - 曲目信息 Tab：曲名/曲师/画师/各难度谱师一览
  - 版本信息 Tab：游戏版本号、构建号、难度分布统计
  - 数据源 somnia.xtower.site/info（info.csv / difficulty.csv / version.txt），服务端代理 + Referer + 内存缓存 + 失败降级；新增 /api/songs 接口（ETag + CDN 缓存）
  - 新增 RFC4180 CSV 解析器（支持引号转义），覆盖单测
- 优化：定数表新增「全部」难度视图，将所有难度曲目混排展示（按最高定数排序/筛选）
- 优化：定数表难度 Tab 支持横向滑动（移动端），切换时自动滚动到当前 Tab，内容带滑动淡入动画
- 新增：版本信息 Tab 展示理论 RKS（全谱面定数前 27，前三 ×2，求和 ÷30）
- 安全：/api/songs 上游响应增加大小上限校验（防超大响应）；缓存过期瞬间并发请求去重（防上游 stampede）
- 修复（样式/移动端）：亮/暗模式切换时偶发出现“亮色模式白字”
  - 统一以 `html.dark` 控制主题；移除 `@media (prefers-color-scheme: dark)` 对 `:root` 的覆盖
  - 去除对 `html, body` 的全局强制文本色，避免覆盖 Markdown 等局部文案
- 文档：
  - README 精简为项目相关内容，移除与模板/内部流程无关部分
  - 新增本变更日志文档（docs/CHANGELOG.md）

## 2025-10-13

- 新增：为多个组件添加标题/描述显示控制选项（避免卡片内外重复文案）
  - 影响组件：BnImageGenerator、SongSearchGenerator、RksRecordsList、ServiceStats
  - 使用：在页面外层已有说明时传入 `showDescription={false}`

## 2025-10-11

- 新增（About）：服务提供商展示区域
- 修复（About）：部署平台检测与 hydration 不匹配问题；域名检测与致谢文案
- 新增（Score/RKS）：
  - RksRecord 增加 `score` 字段并同步相关组件
  - 更新单曲 RKS 计算公式并补充说明
- 适配：对接新的后端 API 接口与数据结构
- 文档：添加 MIT 许可证文件

## 2025-10-07

- 新增：
  - 全局生成任务管理上下文（GenerationContext）
  - 全局缓存与冷却机制（BestN、单曲图片、RKS 列表等）
  - 独立赞助者页面（Sponsors）
- UI/体验：
  - 首页与多页面响应式与样式优化
  - 统一 Select 为 `StyledSelect`（Radix UI）
- SEO：新增基础 SEO 配置与 `NEXT_PUBLIC_SITE_URL` 处理
- 杂项：Bing 站点校验文件迁移至 `public/`，更新版权年份与维护通知逻辑

## 2025-10-06

- 新增（登录）：TapTap 移动端深链登录支持
- 优化：若干展示细节

## 2025-10-05

- 新增（QA）：
  - 默认回退的 QA 内容（Markdown），供 API 读取
  - 联系方式新增“空间站『索终』”群聊按钮与链接
- 数据：新增数据追踪
- 修复：多处布局与构建问题

## 2025-10-04

- 新增：基础功能与样式优化

## 2025-10-03

- 新增：登录页面

## 2025-10-02

- 新增：主页与项目初始化（Create Next App）
