# 更新日志

规范：按日期倒序记录主要变更；语义化分类（新增/修复/优化/重构/文档/杂项）。

## Unreleased

- 优化（单曲检索）：启用后端多关键词模式 + 候选消歧信息补全（对应问卷「同名/相近名混淆」「曲师不好搜」）
  - `lib/api/song.ts` 重构为 `searchSong()`：含多词的查询（如「雪降 A39」）优先走 `mode=and`（后端该模式下官方名/别名/曲师/曲目 ID 均参与匹配，支持双引号短语与 `-` 排除）；`mode=and` 未命中时自动回退默认单串模式，保证「祈 -我ら神祖と共に歩む者なり-」这类含连字符的完整曲名仍可命中
  - 多命中（409）时用同查询的非 unique 请求补全候选的曲师/画师/四难度定数（后端候选预览只含 id/name），补全失败不影响消歧
  - 新增 `SongCandidateList` 组件（单曲查询 / 玩家成绩渲染共用）：展示曲绘缩略图（`/_ill/illLow`，immutable 缓存，加载失败退回占位图标）、曲名、曲师/画师、各难度定数与曲目 ID；由红色错误框改为独立的消歧面板
  - 单曲查询输入区补充检索能力提示（黑话/缩写别名、「曲名 + 曲师」组合、`-` 排除），占位文案同步更新
  - 检索结果按查询词做 10 分钟 LRU 缓存（上限 200），同一查询不重复回源
  - 单测：`song.test.ts`（mode 选择/回退/409 补全/补全失败降级/缓存去重）、`song-candidate-list.test.tsx`（渲染与交互）

- 新增（PWA，MVP）：站点可安装为渐进式 Web 应用
  - `src/app/manifest.ts` 生成 `/manifest.webmanifest`（name/short_name/start_url/scope/display=standalone/theme_color/background_color/lang/id + 192/512 与 maskable 图标）
  - `scripts/gen-pwa-icons.mjs`：由站点头像生成 `public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon,favicon-32}.png`
  - `public/sw.js`（Service Worker）：静态资源 cache-first、公开只读 API（白名单）stale-while-revalidate、导航 network-first + 离线回退 `public/offline.html`；鉴权/会话/内部端点与 catch-all、unified 代理一律不缓存（避免带凭据响应跨用户泄漏）
  - `src/app/components/ServiceWorkerRegister.tsx`：仅生产环境注册 `sw.js`（含 waiting SW 的 SKIP_WAITING 与可见性触发更新）；`layout.tsx` 补充 `applicationName/manifest/appleWebApp/icons` 元数据
  - `next.config.ts` 对 `/sw.js` 设 `must-revalidate`，避免 SW 被长期缓存而无法及时更新
  - 单测：`src/app/__tests__/manifest.test.ts` 校验可安装字段与图标声明
- 新增（PWA，增强）：自定义安装按钮与离线提示
  - `InstallPromptContext`（`InstallPromptProvider` + `useInstallPrompt`）监听 `beforeinstallprompt` / `appinstalled` / display-mode，暴露可安装/是否 iOS/standalone 状态与 `install()`
  - `InstallButton`：Chrome/Edge/Android 点击触发浏览器原生安装；iOS（无原生事件）点击展示轻量“分享 → 添加到主屏幕”引导；已安装为 PWA 时不渲染
  - 接入位置：全局 `TopBar` 右侧图标态按钮（所有页面可见）+ Dashboard 侧边栏 PC 端菜单底部 + 移动端底部操作区（展开/收起态均支持）
  - `OfflineNotice`：顶部悬浮小通知条，监听 `online/offline` 事件与 SW 的 `OFFLINE_FALLBACK`/`NETWORK_OK` 消息，离线或回退到缓存时展示、恢复后自动消失，不遮挡正文
  - `sw.js` 增补对页面 `postMessage`（导航成功 `NETWORK_OK` / 回退 `OFFLINE_FALLBACK`）
  - 单测：安装按钮（原生安装 / iOS 引导）、离线提示（onLine 变化 / SW 消息）、Sidebar 移动操作
- 安全（验证码）：修复 CAP 验证码 fail-open 绕过
  - `verifyCapToken` 区分「服务端未配置密钥（灰度放行）」与「已配置密钥但客户端缺 token」：后者现在明确拒绝（`missing_token`），且该检查先于断路器，断路打开也不会顺带放行；脚本不带 capToken 直接 POST 登录接口的绕过路径被关闭
  - 登录接口对 `missing_token` / `invalid_token` 返回 403（code `CAP_FAILED`），仅 `upstream_error` / `timeout` / `circuit_open` 维持降级放行；`CAP_SECRET_KEY` 改为惰性读取（便于测试与灰度切换）
  - 单测：灰度模式/缺 token/无效 token/验证成功/断路器降级、登录路由强制校验集成用例
- 安全（限流）：`resolveClientIp` 收紧可信来源，封堵伪造头绕过
  - 不再默认信任 `cf-connecting-ip` / `x-real-ip` / `X-Forwarded-For` 首跳（客户端均可伪造，CDN 部署下登录/TapTap/report 等 IP 限流可被绕过）
  - 默认改为解析 `X-Forwarded-For` 最后一跳的可公网路由 IP（对 CDN 覆盖/追加两种回源语义均成立，客户端自带前缀不可信）；从尾向前跳过私有/回环/CGNAT 地址以兼容边缘内部多跳
  - 部署平台为阿里云 ESA：推荐在控制台「托管转换」开启「回源自动注入客户端真实 IP」并设置 `TRUSTED_CLIENT_IP_HEADER=ali-real-client-ip`（ESA 边缘节点写入 TCP 建连真实 IP，最可信）；无任何可信来源时退化为全局共享桶（'unknown'）
- 安全（代理）：catch-all 代理 Cookie 双向收敛
  - 请求侧：转发上游前剔除站内自有 Cookie（`phigros_auth_session`、`phigros_debug_auth`，集中登记于 `SITE_OWNED_COOKIE_NAMES`），本站会话状态不再外发上游
  - 响应侧：上游 Set-Cookie 与站内 Cookie 同名 → 丢弃（防覆盖站内会话状态）；携带 `Domain` 属性 → 剥离（收窄为 host-only）；其余属性原样保留
  - 新增 `lib/utils/proxyCookies`（含单测）与 catch-all 路由集成用例
- 优化（缓存）：公开数据多级缓存强化（对应 docs/cache-strategy-remediation.md 问题 2/4/9/10 的落地）
  - 修复 `next.config.ts` 头规则顺序 bug：排行榜 Top/按名次、公开档案、统计四条 `public, s-maxage` 规则此前排在 `/api/:path*` no-store 之前被整体架空，现移至其后并同步补进 `edgeone.json`
  - catch-all 代理（`/api/[...path]`）新增"公开只读 GET"服务端缓存层（`publicProxyCache`）：排行榜 Top/按名次、公开档案、歌曲搜索在源站内存中带防击穿短 TTL 缓存（LRU 容量上限），匿名请求不再逐访客穿透上游；响应附带弱 ETag + 304，公开路径不再转发 Cookie / 携带 `Vary: Cookie`
  - `createDedupedCache` 支持可选 `maxSize`（LRU 淘汰），防止高基数 key（如搜索词）无限增长
  - 内容三层 TTL 收敛：进程内存 5 分钟 → 60 秒（仅防重复 I/O），公告/新曲速递/QA/协议 ISR 与 CDN `s-maxage` 3600 → 600 对齐；协议接口浏览器侧 `max-age` 1 小时 → 0（法律文本更新即时生效）
  - 新增缓存 purge 管理端点 `/api/internal/cache`（Bearer `CACHE_ADMIN_TOKEN` 鉴权，未配置一律拒绝），接通此前无人调用的 `invalidateContentCache` / `invalidateQACache` / `clearPublicProxyCache`，配合 `revalidatePath` / `revalidateTag` 形成"发布即生效"闭环
- 优化（缓存）：HTML/页面缓存策略
  - middleware 公开 HTML 缓存名单新增 `/login`、`/open-platform`、`/open-platform/agreement`（仅匿名访客生效，带会话 Cookie 仍为 private no-store）
  - `/songs` 由 `force-dynamic` 改为 ISR（`revalidate = 3600`，与数据层 1 小时内存缓存对齐）；上游不可达时走既有降级 UI，不影响构建
  - 单测：`cacheWithDedup`（TTL/防击穿/LRU/失效）、`publicProxyCache` 规则匹配、middleware 新名单

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
