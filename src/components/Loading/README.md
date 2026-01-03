# Loading 组件使用说明

本目录包含项目中使用的各种加载状态组件，用于提升用户体验。

## 组件列表

### 1. RouteLoading - 路由加载组件

专门用于路由懒加载时的fallback，提供美观的加载界面。

**特性：**
- 渐变背景和动画效果
- 毛玻璃效果（backdrop-filter）
- 支持明暗主题自动切换
- 友好的加载提示文字

**使用方式：**
```tsx
import { RouteLoading } from '@/components/Loading';

const withSuspense = (node: JSX.Element) => (
  <Suspense fallback={<RouteLoading />}>{node}</Suspense>
);
```

**已应用位置：**
- `src/router/index.tsx` - 所有路由的懒加载fallback

---

### 2. PageLoading - 页面加载组件

通用页面加载组件，可用于任何需要显示加载状态的场景。

**特性：**
- 可配置提示文字
- 支持全屏或局部显示
- 自定义样式支持

**使用方式：**
```tsx
import { PageLoading } from '@/components/Loading';

// 全屏加载
<PageLoading tip="数据加载中..." fullScreen />

// 局部加载
<PageLoading tip="加载中..." />
```

**Props：**
- `tip?: string` - 提示文字，默认"页面加载中..."
- `fullScreen?: boolean` - 是否全屏显示，默认false
- `style?: React.CSSProperties` - 自定义样式

---

### 3. ChartLoading - 图表加载组件

专门用于图表组件的懒加载，提供统一的图表加载体验。

**特性：**
- 专门优化的尺寸和样式
- 可配置最小高度
- 适合图表容器的布局

**使用方式：**
```tsx
import { ChartLoading } from '@/components/Loading';

<Suspense fallback={<ChartLoading />}>
  <Line {...config} />
</Suspense>

// 自定义高度
<Suspense fallback={<ChartLoading minHeight={400} />}>
  <Bar {...config} />
</Suspense>
```

**Props：**
- `tip?: string` - 提示文字，默认"图表加载中..."
- `minHeight?: number | string` - 最小高度，默认300

**已应用位置：**
- `src/pages/Dashboard/index.tsx` - Dashboard图表加载

---

## 统一导出

所有组件都通过 `src/components/Loading/index.ts` 统一导出：

```tsx
import { RouteLoading, PageLoading, ChartLoading } from '@/components/Loading';
```

---

## 设计原则

1. **统一性**：所有加载组件使用相同的设计语言和动画效果
2. **可配置性**：提供必要的配置选项，满足不同场景需求
3. **性能**：轻量级实现，不影响页面性能
4. **可访问性**：提供清晰的加载提示，支持屏幕阅读器

---

## 未来扩展

可以考虑添加：
- 骨架屏组件（Skeleton Loading）
- 进度条加载组件（Progress Loading）
- 全屏遮罩加载组件（FullScreen Loading）

