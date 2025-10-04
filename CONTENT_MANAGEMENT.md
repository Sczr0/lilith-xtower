# 内容管理系统使用文档

本项目使用 **CLI + Markdown** 的混合方案来管理公告和新曲速递内容，无需搭建后台管理系统。

## 📁 文件结构

```
src/app/content/
├── announcements/           # 公告目录
│   ├── 2025-10-04-welcome.md
│   └── ...
└── song-updates/           # 新曲速递目录
    ├── 2025-10-01-update-4.8.0.md
    └── ...
```

## 🚀 快速开始

### 方式一：使用CLI工具（推荐）

#### 启动CLI工具
```bash
npm run content
```

CLI工具提供以下功能：
- 📢 添加公告
- 🎵 添加新曲速递
- 📋 查看所有公告
- 📋 查看所有新曲速递
- ⚙️  维护配置管理（查看/编辑/快速测试）
- ✏️  编辑内容提示

#### 添加公告示例
1. 运行 `npm run content`
2. 选择 "📢 添加公告"
3. 按提示填写：
   - 公告标题
   - 公告类型（info/warning/maintenance）
   - 优先级（high/medium/low）
   - 是否允许"不再提示"
   - 公告内容（支持Markdown）

#### 添加新曲速递示例
1. 运行 `npm run content`
2. 选择 "🎵 添加新曲速递"
3. 按提示填写：
   - 版本号（如 4.8.0）
   - 更新日期
   - 逐个添加曲目信息（曲名、艺术家）
   - **只需输入定数**（如 15.8、14.5、16.3），等级会自动计算

### 方式二：直接编辑Markdown文件

#### 公告文件格式

创建文件：`src/app/content/announcements/YYYY-MM-DD-title.md`

```markdown
---
id: announcement-2025-10-04-welcome
title: 欢迎使用新版系统
type: info                    # info | warning | maintenance
publishDate: 2025-10-04T10:00:00+08:00
enabled: true                 # 是否启用
dismissible: true            # 是否允许"不再提示"
priority: high               # high | medium | low
---

# 欢迎使用新版系统 🎉

这里是公告正文，支持完整的 **Markdown** 语法。

- 支持列表
- 支持链接 [官方群聊](https://example.com)
- 支持图片、代码块等
```

#### 新曲速递文件格式

创建文件：`src/app/content/song-updates/YYYY-MM-DD-update-x.x.x.md`

```markdown
---
updateId: update-2025-10-01
updateDate: 2025-10-01T00:00:00+08:00
version: 4.8.0
enabled: true
---

# Phigros 4.8.0 新曲速递

## 新增曲目

### WINTER ～願いを込めて～

- **艺术家**: TOKOTOKO（西沢さんP）
- **定数**:
  - EZ: 5.0
  - HD: 10.2
  - IN: 14.5
  - AT: 15.8
- **备注**: 冬日限定曲目

### 另一首歌曲

- **艺术家**: Artist Name
- **定数**:
  - IN: 13.9
  - AT: 15.2

---

**更新说明**: 本次更新新增2首曲目，优化了部分谱面判定。
```

## 🎨 内容展示

### 公告展示
- 用户登录Dashboard后自动弹窗显示未读公告
- 支持"不再提示"功能，基于公告ID记录
- 支持多条公告依次显示
- 按优先级和发布时间排序

### 新曲速递展示
- 在Dashboard的"新曲速递"标签页查看
- 最新更新标记为"最新"
- 支持Markdown富文本渲染
- 按更新时间降序排列

## 📝 内容管理最佳实践

### 文件命名规范
- **公告**: `YYYY-MM-DD-简短描述.md`
  - 例如: `2025-10-04-new-feature.md`
  
- **新曲速递**: `YYYY-MM-DD-update-版本号.md`
  - 例如: `2025-10-01-update-4.8.0.md`

### ID生成规则
- **公告ID**: `announcement-日期-时间戳`
  - 例如: `announcement-2025-10-04-1728028800000`
  
- **更新ID**: `update-日期`
  - 例如: `update-2025-10-01`

### 启用/禁用内容
将Front Matter中的 `enabled` 设为 `false` 即可禁用：

```yaml
---
enabled: false  # 该内容将不会显示在前端
---
```

### 删除内容
直接删除对应的 `.md` 文件即可。

建议使用Git进行版本管理，方便回滚。

## 🔧 技术细节

### 内容加载流程
```
用户访问Dashboard
    ↓
调用 /api/content/announcements
调用 /api/content/song-updates
    ↓
后端读取Markdown文件
    ↓
解析YAML Front Matter + Markdown内容
    ↓
返回JSON数据给前端
    ↓
前端渲染展示
```

### 依赖包
- `gray-matter`: 解析YAML Front Matter
- `react-markdown`: Markdown渲染
- `prompts`: CLI交互
- `js-yaml`: YAML序列化

## 🎯 常见问题

### Q: 如何修改已发布的公告？
A: 直接编辑对应的 `.md` 文件，保存后刷新页面即可生效。

### Q: 公告没有显示怎么办？
A: 检查以下几点：
1. `enabled` 是否为 `true`
2. 文件格式是否正确（YAML Front Matter）
3. 浏览器控制台是否有错误
4. 是否点击了"不再提示"（清除localStorage）

### Q: 如何批量导入新曲信息？
A: 可以直接编写Markdown文件，按照格式复制粘贴曲目信息即可。

### Q: 能否支持图片上传？
A: 可以使用图床链接，在Markdown中引用：
```markdown
![图片描述](https://example.com/image.png)
```

### Q: 如何清除"不再提示"记录？
A: 打开浏览器控制台，执行：
```javascript
localStorage.removeItem('dismissed_announcements');
```

## 📊 示例工作流

### 发布新公告
```bash
# 1. 使用CLI快速创建
npm run content
# 选择 "添加公告" → 填写信息

# 2. 提交到Git
git add src/app/content/announcements/
git commit -m "docs: 添加新公告"
git push

# 3. 用户刷新页面即可看到
```

### 发布新曲速递
```bash
# 1. 使用CLI创建基础结构
npm run content
# 选择 "添加新曲速递" → 填写基本信息

# 2. 手动编辑MD文件补充细节
code src/app/content/song-updates/2025-10-15-update-4.9.0.md

# 3. 提交并发布
git add src/app/content/song-updates/
git commit -m "docs: 更新4.9.0新曲信息"
git push
```

## 🚀 未来扩展

可能的扩展方向：
- [ ] 支持定时发布（通过CI/CD）
- [ ] 添加内容预览功能
- [ ] 支持多语言
- [ ] 集成CMS（如Notion、Strapi）
- [ ] 添加内容统计（浏览量、点击率）

## 📞 技术支持

遇到问题请：
1. 查看本文档
2. 检查浏览器控制台错误
3. 查看项目README
4. 提交Issue到GitHub

---

## ⚙️ 维护配置管理

### 使用 CLI 工具管理维护模式

运行 `npm run content`，选择 "⚙️ 维护配置管理"，提供以下功能：

#### 1. 查看当前配置 👁️
显示当前维护配置的所有参数：
- 启用状态
- 维护开始/结束时间
- 提前通知天数
- 标题和消息内容
- **当前状态**（维护中/预告期/已结束/未启用）

#### 2. 编辑配置 ✏️
交互式编辑所有维护参数：
- 启用/禁用维护模式
- 设置维护开始时间（格式：YYYY-MM-DDTHH:mm:ss）
- 设置维护结束时间
- 设置提前通知天数（0-30天）
- 编辑维护标题
- 编辑维护消息（支持HTML）
- 编辑横幅消息（支持HTML）

#### 3. 快速测试 🔄
一键测试维护功能：
- **测试维护覆盖层**：立即进入维护模式，持续10分钟
- **测试预告横幅**：5分钟后进入维护，立即显示横幅

测试配置会自动写入 `maintenance.config.ts`，测试完成后记得禁用。

### 维护配置文件

配置文件位置：`src/app/config/maintenance.config.ts`

```typescript
export const maintenanceConfig: MaintenanceConfig = {
  enabled: false,              // 启用维护模式
  startTime: '2025-01-20T09:00:00',
  endTime: '2025-01-20T12:00:00',
  preNoticeDays: 3,           // 提前3天显示横幅
  title: '系统维护通知',
  message: `维护期间的消息...`,
  bannerMessage: `横幅消息...`,
};
```

### 维护状态时间线

```
现在 ──────────────▶ 时间轴

├─ 维护前 N 天：显示橙色预告横幅（可关闭）
│  └─ 用户可以正常使用所有功能
│
├─ 维护开始：显示全屏覆盖层
│  └─ 所有功能不可用
│  └─ 显示维护信息和预计恢复时间
│
└─ 维护结束：自动恢复正常
   └─ 页面重新可用
```

### 使用场景

1. **提前通知用户**：
   - 设置 `preNoticeDays: 3`
   - 维护前3天开始显示橙色横幅
   - 用户可以提前知晓维护时间

2. **进入维护期**：
   - 到达 `startTime` 后自动显示全屏覆盖
   - 所有页面和API不可用
   - 显示预计恢复时间

3. **维护结束**：
   - 到达 `endTime` 后自动恢复
   - 用户刷新页面后正常使用

详细文档请参考：`MAINTENANCE_GUIDE.md`

---

**维护者**: @YourName  
**最后更新**: 2025-10-04
