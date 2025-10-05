# SVG 客户端渲染功能使用指南

## 功能概述

本项目现已支持 Best N 图片的 SVG 格式获取，并实现了客户端渲染下载功能。相比传统 PNG 方式，具有以下优势：

### 优势

1. **性能优化**
   - SVG 体积更小，传输更快
   - 后端无需 CPU 密集的栅格化操作
   - 渲染压力分散到客户端，支持高并发

2. **灵活性**
   - 用户可自选下载分辨率（1x/2x/3x/4x）
   - 支持多种格式（PNG/JPG/WebP）
   - SVG 无损缩放，适合任意尺寸显示

3. **用户体验**
   - 快速显示预览
   - 按需高质量下载
   - 进度反馈

## 技术实现

### 1. SVG 渲染工具 (`src/app/utils/svgRenderer.ts`)

核心类 `SVGRenderer` 提供：

```typescript
// 渲染 SVG 为图片 Blob
SVGRenderer.renderToImage(
  svgText: string,
  options?: {
    format?: 'png' | 'jpg' | 'webp',
    quality?: number,  // 0-1，默认 0.95
    scale?: number,    // 分辨率倍数，默认 2
    backgroundColor?: string
  },
  onProgress?: (progress) => void
): Promise<Blob>

// 直接下载
SVGRenderer.downloadImage(
  svgText: string,
  filename: string,
  options?: RenderOptions,
  onProgress?: (progress) => void
): Promise<void>
```

**渲染流程：**
1. 加载系统字体（确保文本正确渲染）
2. 解析 SVG 文本
3. 创建 Canvas，按 scale 放大
4. 绘制 SVG 到 Canvas
5. 转换为指定格式的 Blob

### 2. API 扩展 (`src/app/lib/api/image.ts`)

新增方法：

```typescript
// 获取 SVG 格式
ImageAPI.generateBestNSVG(
  n: number,
  credential: AuthCredential,
  theme: BestNTheme
): Promise<string>

// 原方法增加 format 参数
ImageAPI.generateBestNImage(
  n: number,
  credential: AuthCredential,
  theme: BestNTheme,
  format?: 'png' | 'svg'  // 新增
): Promise<Blob>
```

### 3. BNImage 组件 (`src/app/components/BNImage.tsx`)

专用的 SVG 显示和下载组件：

**功能特性：**
- SVG 内联显示（`dangerouslySetInnerHTML`）
- 下载格式选择（PNG/JPG/WebP）
- 分辨率选择（1x-4x）
- 进度条显示（加载字体→渲染→编码）
- 错误处理
- 使用提示

**Props：**
```typescript
interface BNImageProps {
  svgContent: string;  // SVG 文本内容
  n: number;          // Best N 数值
  onClear?: () => void; // 清除回调
}
```

### 4. BnImageGenerator 组件更新

新增功能：
- 格式选择器（SVG/PNG）
- 根据格式调用不同 API
- 集成 BNImage 组件显示 SVG

## 使用方式

### 用户操作流程

1. 在 Dashboard 页面选择 Best N 图片生成
2. 选择格式为 "SVG (推荐)"
3. 点击"生成图片"
4. 快速显示 SVG 预览
5. 根据需要选择：
   - 下载格式（PNG 推荐）
   - 分辨率（2x 推荐平衡质量和文件大小）
6. 点击"下载图片"
7. 等待渲染进度（通常几秒钟）
8. 自动下载到本地

### 开发者使用

如需在其他页面使用：

```tsx
import { BNImage } from '@/app/components/BNImage';

// 获取 SVG
const svgContent = await ImageAPI.generateBestNSVG(19, credential, 'dark');

// 渲染组件
<BNImage 
  svgContent={svgContent}
  n={19}
  onClear={() => setSvgContent(null)}
/>
```

或直接使用渲染工具：

```tsx
import { SVGRenderer } from '@/app/utils/svgRenderer';

// 下载到本地
await SVGRenderer.downloadImage(
  svgContent,
  'best-19.png',
  { format: 'png', scale: 3 },
  (progress) => console.log(progress)
);

// 或获取 Blob 用于其他用途
const blob = await SVGRenderer.renderToImage(svgContent, {
  format: 'webp',
  scale: 2,
  quality: 0.9
});
```

## 注意事项

### 1. 字体渲染

- SVG 未内嵌字体（避免文件过大）
- 渲染器会尝试加载系统字体
- 不同设备可能略有差异
- 如需强一致性，可修改 `svgRenderer.ts` 中的字体列表

### 2. 性能考虑

- 分辨率 4x 会显著增加渲染时间和文件大小
- 推荐使用 2x 或 3x
- 渲染在主线程进行，高分辨率可能短暂卡顿

### 3. 浏览器兼容性

- 需要现代浏览器（支持 Canvas API）
- 已测试：Chrome, Edge, Firefox, Safari
- 不支持 IE

### 4. 安全性

- SVG 内容来自可信后端
- 使用 `dangerouslySetInnerHTML` 需确保内容不含脚本
- 建议配置适当的 CSP

## 后续优化建议

1. **Web Worker 渲染**：将渲染移到 Worker 避免阻塞 UI
2. **字体内嵌**：提供可选的字体内嵌功能
3. **缓存优化**：缓存已渲染的图片
4. **批量下载**：支持一次下载多个 Best N
5. **预设模板**：提供常用分辨率/格式组合

## 文件清单

新增/修改文件：
- `src/app/utils/svgRenderer.ts` - SVG 渲染工具
- `src/app/lib/api/image.ts` - API 扩展
- `src/app/components/BNImage.tsx` - SVG 显示组件
- `src/app/components/BnImageGenerator.tsx` - 集成新功能

## API 接口说明

详见 `API.md` 中的 "BN SVG 输出接口说明" 章节。

后端接口示例：
```
POST /api/image/bn/27?format=svg&theme=dark
Content-Type: application/json

{
  "token": "..."
}
```

返回：
```
Content-Type: image/svg+xml; charset=utf-8

<svg>...</svg>
```
