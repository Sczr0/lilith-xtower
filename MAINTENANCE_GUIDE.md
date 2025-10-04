# 维护模式使用指南

## 功能概述

本系统实现了自动维护模式，支持：
- ✅ 提前 N 天显示维护预告横幅
- ✅ 维护期间全屏覆盖，禁止所有操作
- ✅ 自动时间检测和状态切换
- ✅ 用户可关闭预告横幅
- ✅ 每分钟自动刷新状态

## 文件结构

```
src/app/
├── config/
│   └── maintenance.config.ts          # 维护配置（修改这个文件）
├── hooks/
│   └── useMaintenanceStatus.ts        # 维护状态检测 Hook
├── components/
│   ├── MaintenanceBanner.tsx          # 维护预告横幅
│   ├── MaintenanceOverlay.tsx         # 维护全屏覆盖
│   └── MaintenanceProvider.tsx        # 维护状态提供者
└── layout.tsx                         # 已集成维护模式
```

## 如何配置维护

### 1. 编辑配置文件

打开 `src/app/config/maintenance.config.ts`，修改以下配置：

```typescript
export const maintenanceConfig: MaintenanceConfig = {
  // 启用维护模式检查
  enabled: true,  // 改为 true 启用

  // 维护开始时间（ISO 8601 格式）
  startTime: '2025-01-20T09:00:00',

  // 维护结束时间
  endTime: '2025-01-20T12:00:00',

  // 提前多少天显示预告横幅
  preNoticeDays: 3,

  // 维护期间显示的标题
  title: '系统维护通知',

  // 维护期间的消息（支持 HTML）
  message: `
    受 Phigros 更新影响，本服务正在进行例行维护。<br/>
    <strong>预计恢复时间：2025年1月20日 12:00（UTC+8）</strong><br/><br/>
    维护期间所有功能暂时不可用。<br/>
    给您带来不便，敬请谅解。
  `,

  // 预告横幅消息（支持 HTML）
  bannerMessage: `
    <strong>维护通知：</strong>
    本服务将于 <strong>2025年1月20日 09:00（UTC+8）</strong> 开始例行维护，
    预计 <strong>12:00</strong> 恢复。维护期间所有功能将暂时不可用。
  `,
};
```

### 2. 时间格式说明

时间使用 ISO 8601 格式：`YYYY-MM-DDTHH:mm:ss`

示例：
- `2025-01-20T09:00:00` = 2025年1月20日 09:00
- `2025-12-31T23:59:59` = 2025年12月31日 23:59:59

**注意：** 时间是本地时间，不需要转换时区。

### 3. 测试维护模式

要立即测试维护功能，可以设置：

```typescript
// 测试维护预告横幅（设置未来几分钟后开始维护）
enabled: true,
startTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5分钟后
endTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),  // 10分钟后
preNoticeDays: 0, // 立即显示横幅

// 测试维护覆盖层（设置当前时间为维护期）
enabled: true,
startTime: new Date(Date.now() - 1 * 60 * 1000).toISOString(), // 1分钟前
endTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),   // 5分钟后
```

## 维护状态时间线

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

## 用户体验

### 维护预告阶段
- 页面顶部显示橙色横幅
- 用户可以点击 ✕ 关闭横幅
- 关闭状态保存在 localStorage
- 所有功能正常使用

### 维护进行中
- 显示全屏维护页面
- 显示维护开始/结束时间
- 显示"系统维护中"状态
- 页面滚动被禁用
- 用户无法访问任何功能

### 维护结束后
- 页面自动恢复正常
- 清除维护相关的 localStorage
- 用户可以正常使用

## 自动检测机制

- Hook 每分钟自动检查一次维护状态
- 时间到达时自动切换状态
- 无需手动刷新页面
- 状态切换是实时的

## 关闭维护模式

将 `enabled` 设为 `false` 即可完全禁用维护检查：

```typescript
export const maintenanceConfig: MaintenanceConfig = {
  enabled: false,  // 禁用维护模式
  // ... 其他配置
};
```

## 常见问题

### Q: 维护时间过了，但页面还是显示维护中？
A: 检查配置文件中的 `endTime` 是否正确，确保已经过了结束时间。系统每分钟检查一次，最多延迟 1 分钟。

### Q: 如何紧急关闭维护模式？
A: 将 `enabled` 改为 `false`，用户刷新页面后即可恢复。

### Q: 可以在维护期间只禁用部分功能吗？
A: 当前实现是全站维护。如需部分功能维护，需要修改 `MaintenanceProvider.tsx` 的逻辑。

### Q: 横幅关闭后，还会再显示吗？
A: 在同一个浏览器中不会再显示。如果用户清除了 localStorage 或使用其他浏览器，会再次显示。

## 最佳实践

1. **提前通知**：建议 `preNoticeDays` 设置为 3-7 天
2. **时间精确**：确保 `startTime` 和 `endTime` 准确无误
3. **清晰消息**：在 `message` 中明确说明维护原因和预计恢复时间
4. **测试验证**：正式维护前先在测试环境验证配置
5. **及时更新**：维护完成后记得将 `enabled` 改回 `false`

## 技术细节

- 所有时间比较在客户端进行
- 使用 React Hook 实现状态管理
- 横幅关闭状态存储在 localStorage
- 维护覆盖层 z-index 为 9999，确保在最上层
- 维护期间禁用 body 滚动
