# 内容管理快速上手指南

## 💡 提示

**添加新曲速递时，只需输入定数 (1.0-20.0)，等级会自动计算（向下取整）**

## 🎯 添加新公告（3步搞定）

```bash
# 1. 启动CLI工具
npm run content

# 2. 选择"📢 添加公告"，按提示填写

# 3. 完成！文件已自动生成到 src/app/content/announcements/
```

## 🎵 添加新曲速递（3步搞定）

```bash
# 1. 启动CLI工具
npm run content

# 2. 选择"🎵 添加新曲速递"，按提示填写

# 3. 完成！文件已自动生成到 src/app/content/song-updates/
```

## 📝 手动编辑内容

所有内容都是Markdown文件，可以直接编辑：

```bash
# 编辑公告
code src/app/content/announcements/2025-10-04-welcome.md

# 编辑新曲速递
code src/app/content/song-updates/2025-10-01-update-4.8.0.md
```

## 🔄 禁用或删除内容

### 临时禁用（不删除文件）
打开 `.md` 文件，修改Front Matter：
```yaml
---
enabled: false  # 改为false即可隐藏
---
```

### 永久删除
直接删除对应的 `.md` 文件即可。

## 📋 查看现有内容

```bash
# 启动CLI工具
npm run content

# 选择"📋 查看所有公告"或"📋 查看所有新曲速递"
```

## ✅ 内容立即生效

保存Markdown文件后，用户刷新页面即可看到最新内容，无需重启服务器。

---

详细文档请查看 [CONTENT_MANAGEMENT.md](./CONTENT_MANAGEMENT.md)
