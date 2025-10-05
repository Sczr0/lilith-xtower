# 常见问题（QA）管理指南

## 概述

Phigros 查询工具现在支持通过命令行工具快速管理常见问题。QA 内容存储在 `src/app/content/qa/` 目录下，采用 Markdown 格式。

## 快速开始

运行以下命令打开内容管理工具：

```bash
pnpm run content
```

在菜单中选择 QA 相关操作：
- ❓ **添加常见问题** - 交互式添加新的常见问题
- 📋 **查看所有常见问题** - 查看现有的所有 QA
- 🗑️ **删除常见问题** - 删除指定的 QA

## 添加常见问题

选择"❓ 添加常见问题"后，工具会引导你输入：

1. **问题** - 问题标题（必填）
2. **分类** - 选择分类：
   - 🔐 登录相关 (login)
   - 📖 使用指南 (usage)
   - 🔧 技术问题 (technical)
   - 🔒 安全隐私 (security)
3. **优先级** - 数字越小越靠前（默认 999）
4. **答案内容** - 支持 Markdown 格式（必填）

### 示例

```
问题: 如何获取 SessionToken？
分类: 🔐 登录相关
优先级: 1
答案内容: 
Phigros 游戏内没有直接获取 SessionToken 的方式。

你可以通过以下方式获取：
1. 使用扫码登录
2. 使用联合查分 API
3. 登录后在调试页面查看
```

## 文件格式

QA 文件采用 Markdown 格式，包含 YAML front matter：

```markdown
---
id: qa-1736060000000
question: 如何获取 SessionToken？
category: login
priority: 1
enabled: true
createdAt: '2025-01-05T12:00:00.000Z'
---

这里是答案内容，支持 Markdown 格式。

- 可以使用列表
- 可以使用 **粗体**
- 可以使用 `代码`
```

### Front Matter 字段说明

- `id` - 唯一标识符，自动生成
- `question` - 问题标题
- `category` - 分类（login / usage / technical / security）
- `priority` - 优先级，数字越小越靠前
- `enabled` - 是否启用（true / false）
- `createdAt` - 创建时间，ISO 8601 格式

## 查看常见问题

选择"📋 查看所有常见问题"会列出所有 QA，包括：
- 状态（✅ 启用 / ❌ 禁用）
- 分类图标
- 问题标题
- ID
- 文件名
- 优先级

## 删除常见问题

选择"🗑️ 删除常见问题"：
1. 从列表中选择要删除的问题
2. 确认删除操作
3. 文件将被永久删除

⚠️ **注意**：删除操作不可恢复，请谨慎操作！

## Markdown 支持

答案内容支持完整的 Markdown 语法：

- **标题**：`# H1`, `## H2`, `### H3`
- **粗体**：`**粗体文本**`
- **斜体**：`*斜体文本*`
- **代码**：`` `内联代码` ``
- **代码块**：
  ````
  ```javascript
  const example = "代码块";
  ```
  ````
- **列表**：
  ```
  - 无序列表项
  - 另一项
  
  1. 有序列表项
  2. 另一项
  ```
- **链接**：`[链接文本](https://example.com)`

## 文件位置

- QA 内容文件：`src/app/content/qa/*.md`
- QA 数据读取逻辑：`src/app/lib/qa.ts`
- API 路由：`src/app/api/qa/route.ts`
- 前端页面：`src/app/qa/page.tsx`

## 手动编辑

你也可以直接编辑 `src/app/content/qa/` 目录下的 Markdown 文件。文件命名格式：

```
问题标题-时间戳.md
```

例如：`how-to-get-sessiontoken-1736060000000.md`

## 注意事项

1. **优先级**：数字越小的问题会显示在越前面
2. **分类**：确保使用正确的分类值（login / usage / technical / security）
3. **启用状态**：只有 `enabled: true` 的问题会在前端显示
4. **Markdown 格式**：答案内容会在前端使用 ReactMarkdown 渲染
5. **实时更新**：修改或添加 QA 后，刷新页面即可看到更新

## 常见问题

**Q: 修改 QA 后需要重启服务器吗？**
A: 不需要，刷新页面即可看到更新。

**Q: 如何临时隐藏某个问题？**
A: 将该问题文件中的 `enabled` 改为 `false`。

**Q: 如何调整问题的显示顺序？**
A: 修改 `priority` 字段，数字越小越靠前。

**Q: 答案中的图片如何处理？**
A: 可以使用 Markdown 图片语法，图片需放在 `public` 目录下：
```markdown
![描述](/images/example.png)
```

## 技术细节

### 数据流程

1. QA Markdown 文件存储在 `src/app/content/qa/`
2. `src/app/lib/qa.ts` 中的 `getAllQA()` 函数读取并解析所有 QA 文件
3. API 路由 `/api/qa` 提供 QA 数据
4. 前端页面通过 fetch 获取数据并渲染
5. 使用 ReactMarkdown 组件渲染答案内容

### 性能优化

- QA 数据在客户端缓存
- 只返回 `enabled: true` 的问题
- 按优先级和创建时间排序

## 更新日志

- 2025-01-05: 初始版本，支持添加、查看、删除 QA
