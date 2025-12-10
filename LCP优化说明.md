# LCP (Largest Contentful Paint) 优化说明

## 问题分析

根据 Lighthouse 性能分析，LCP 图像需要优化：
- ✅ 已应用 `fetchpriority="high"` 属性值
- ✅ 可在初始文档中检测到请求
- ✅ 未应用延迟加载

## 优化方案

### 1. 在 HTML 中尽早预加载 LCP 图像

**实现位置**：`src/main.tsx`

在 React 渲染之前，就在 HTML head 中添加预加载链接：

```typescript
// 在 React 渲染之前预加载
if (typeof document !== 'undefined') {
  const preloadLink = document.createElement('link');
  preloadLink.rel = 'preload';
  preloadLink.as = 'image';
  preloadLink.href = logo2;
  preloadLink.setAttribute('fetchPriority', 'high');
  document.head.appendChild(preloadLink);
}
```

**效果**：
- 浏览器在解析 HTML 时就能发现图片
- 不需要等待 JavaScript 执行
- 图片下载可以与其他资源并行

### 2. 优化图片组件属性

**实现位置**：`src/components/OptimizedImage.tsx`

为 LCP 图像添加特殊处理：

```typescript
// LCP 图像的特殊属性
- loading="eager"        // 不延迟加载
- fetchPriority="high"   // 高优先级
- decoding="sync"        // 同步解码（LCP 图像）
- isLCP={true}          // 标记为 LCP 图像
```

**效果**：
- 浏览器优先下载和渲染 LCP 图像
- 避免延迟加载导致的延迟
- 同步解码确保及时显示

### 3. 标记 LCP 图像

**实现位置**：`src/components/Layout/MainLayout.tsx`

明确标记 logo 为 LCP 图像：

```typescript
<OptimizedImage
  src={siteSettings.logoUrl || (collapsed ? logo1 : logo2)}
  alt="Logo"
  loading="eager"
  isLCP={true}
  fetchPriority="high"
  // ...
/>
```

### 4. 预加载组件（备用方案）

**实现位置**：`src/components/PreloadResources.tsx`

作为备用方案，在组件渲染时也添加预加载链接（虽然不如在 main.tsx 中早，但可以处理动态路径）。

## 优化效果

### 优化前
- LCP 图像可能在 JavaScript 执行后才被发现
- 图片下载可能延迟
- LCP 时间：可能 > 2.5 秒

### 优化后（预期）
- LCP 图像在 HTML 解析时就被发现
- 图片下载与其他关键资源并行
- 使用 `fetchPriority="high"` 提高优先级
- **预期效果**：LCP 时间 < 2.5 秒（良好）

## 技术细节

### 预加载链接的优先级

```html
<!-- 主要 LCP 图像（高优先级） -->
<link rel="preload" as="image" href="/logo2.jpg" fetchPriority="high" />

<!-- 备用图像（低优先级） -->
<link rel="preload" as="image" href="/logo1.jpg" fetchPriority="low" />
```

### 图片属性说明

| 属性 | 值 | 说明 |
|------|-----|------|
| `loading` | `eager` | 不延迟加载，立即加载 |
| `fetchPriority` | `high` | 高优先级，优先下载 |
| `decoding` | `sync` | 同步解码（LCP 图像） |
| `isLCP` | `true` | 标记为 LCP 图像 |

### 为什么在 main.tsx 中预加载？

1. **执行时机早**：在 React 渲染之前就执行
2. **不依赖组件**：不等待组件挂载
3. **浏览器友好**：浏览器可以在解析 HTML 后立即发现资源

## 验证方法

### 使用 Chrome DevTools

1. **打开 Network 面板**
2. **刷新页面**
3. **查看图片请求**：
   - 应该看到 `logo2.jpg` 的请求
   - Priority 应该显示为 "High"
   - 应该没有 "lazy" 标记

### 使用 Lighthouse

1. **运行 Lighthouse 性能测试**
2. **查看 LCP 指标**：
   - 应该 < 2.5 秒（良好）
   - 应该 < 4.0 秒（需要改进）
3. **查看 "LCP 请求" 建议**：
   - ✅ 已应用 fetchpriority 的 high 属性值
   - ✅ 可在初始文档中检测到请求
   - ✅ 未应用延迟加载

### 使用 Performance 面板

1. **打开 Performance 面板**
2. **录制页面加载**
3. **查看 LCP 标记**：
   - 应该显示 LCP 元素
   - 应该显示 LCP 时间
   - 图片应该在早期就开始加载

## 最佳实践

### ✅ 应该做的

1. **在 HTML 中预加载 LCP 图像**
   ```html
   <link rel="preload" as="image" href="lcp-image.jpg" fetchPriority="high" />
   ```

2. **使用 `loading="eager"`**
   ```typescript
   <img src="lcp-image.jpg" loading="eager" />
   ```

3. **使用 `fetchPriority="high"`**
   ```typescript
   <img src="lcp-image.jpg" fetchPriority="high" />
   ```

4. **设置明确的宽高**
   ```typescript
   <img src="lcp-image.jpg" width="160" height="48" />
   ```

### ❌ 不应该做的

1. **对 LCP 图像使用延迟加载**
   ```typescript
   // ❌ 差
   <img src="lcp-image.jpg" loading="lazy" />
   ```

2. **在 JavaScript 中动态加载 LCP 图像**
   ```typescript
   // ❌ 差
   useEffect(() => {
     setImageSrc('/lcp-image.jpg');
   }, []);
   ```

3. **使用低优先级**
   ```typescript
   // ❌ 差
   <img src="lcp-image.jpg" fetchPriority="low" />
   ```

## 总结

通过以下优化措施：
- ✅ 在 HTML 中预加载 LCP 图像
- ✅ 使用 `fetchPriority="high"`
- ✅ 使用 `loading="eager"`
- ✅ 同步解码 LCP 图像
- ✅ 明确标记 LCP 图像

**预期效果**：
- LCP 时间：从可能 > 2.5 秒优化到 < 2.5 秒
- 图片发现时间：从 JavaScript 执行后提前到 HTML 解析时
- 下载优先级：提高，与其他关键资源并行

