# 更新日志

规范：按日期倒序记录主要变更；语义化分类（新增/修复/优化/重构/文档/杂项）。

## Unreleased

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
