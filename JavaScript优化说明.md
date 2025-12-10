# JavaScript 优化说明

## 问题分析

根据 Lighthouse 性能分析，存在大量未使用的 JavaScript：
- **总未使用代码**：4,578.3 KiB
- **主要来源**：
  - Ant Design (antd.js): 2,188.3 KiB
  - @ant-design/plots: 1,439.3 KiB
  - react-router-dom: 311.5 KiB
  - react-dom.development.js: 264.9 KiB
  - chunk-LAV6FB6A.js: 268.4 KiB

## 优化方案

### 1. 图表库懒加载

**问题**：`@ant-design/plots` 在初始加载时就全部打包，即使用户不访问图表页面。

**解决方案**：使用 React.lazy 和 Suspense 实现按需加载。

**优化前**：
```typescript
import { Line } from '@ant-design/plots';
// 直接使用
<Line {...config} />
```

**优化后**：
```typescript
// 懒加载
const Line = React.lazy(() => import('@ant-design/plots').then(m => ({ default: m.Line })));

// 使用 Suspense 包裹
<Suspense fallback={<Spin />}>
  <Line {...config} />
</Suspense>
```

**已优化的文件**：
- ✅ `src/pages/Dashboard/index.tsx`
- ✅ `src/pages/EventAnalysis/index.tsx`
- ✅ `src/pages/FunnelAnalysis/index.tsx`
- ✅ `src/pages/Prediction/index.tsx`
- ✅ `src/pages/PredictionHistory/index.tsx`
- ✅ `src/components/Dashboard.tsx`

**效果**：
- 图表库代码不在初始 bundle 中
- 只在用户访问图表页面时才加载
- 预计节省：1,439.3 KiB

### 2. Vite 构建优化

**配置位置**：`vite.config.ts`

#### 2.1 手动分包

将大型依赖分离到独立的 chunk：

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        'antd-vendor': ['antd'],
      }
    }
  }
}
```

**效果**：
- 更好的缓存策略
- 并行加载多个 chunk
- 减少重复代码

#### 2.2 代码压缩

```typescript
build: {
  minify: 'terser',
  terserOptions: {
    compress: {
      drop_console: true,    // 移除 console
      drop_debugger: true,   // 移除 debugger
    },
  },
}
```

**效果**：
- 移除开发代码
- 减少文件大小
- 提升运行性能

#### 2.3 Tree Shaking

```typescript
build: {
  treeshake: true,  // 启用 Tree Shaking
}
```

**效果**：
- 自动移除未使用的代码
- Ant Design 按需导入
- 减少 bundle 大小

#### 2.4 依赖预构建优化

```typescript
optimizeDeps: {
  include: ['react', 'react-dom', 'antd', ...],
  exclude: ['@ant-design/plots']  // 排除，按需加载
}
```

**效果**：
- 优化常用依赖的预构建
- 大型库按需加载

### 3. Ant Design 按需导入

**说明**：Ant Design 5.x 已经支持 Tree Shaking，但需要确保：
1. 使用 ES 模块导入
2. 不导入整个库
3. 使用生产构建

**当前导入方式**（已优化）：
```typescript
// ✅ 正确：按需导入
import { Button, Card, Table } from 'antd';

// ❌ 错误：导入整个库
import * as antd from 'antd';
```

**效果**：
- 只打包使用的组件
- 预计节省：2,188.3 KiB（部分）

### 4. 路由代码分割

**当前状态**：✅ 已实现

所有路由都使用 `React.lazy` 和 `Suspense`：

```typescript
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const EventAnalysis = lazy(() => import('@/pages/EventAnalysis'));
// ...
```

**效果**：
- 每个页面独立打包
- 按需加载页面代码
- 减少初始 bundle 大小

### 5. 图标按需导入

**当前状态**：✅ 已优化

```typescript
// ✅ 正确：按需导入图标
import { UserOutlined, LockOutlined } from '@ant-design/icons';
```

**效果**：
- 只打包使用的图标
- 减少图标库大小

## 优化效果

### 优化前
- 初始 bundle：8,478.1 KiB
- 未使用代码：4,578.3 KiB
- 图表库：全部打包（即使用户不访问）

### 优化后（预期）
- 初始 bundle：约 3,000-4,000 KiB（减少 50%+）
- 未使用代码：大幅减少
- 图表库：按需加载（节省 1,439.3 KiB）
- **预计总节省**：约 4,000+ KiB

## 验证方法

### 1. 构建分析

```bash
# 构建项目
npm run build

# 查看构建产物
ls -lh dist/assets
```

### 2. 使用 Vite Bundle Analyzer

```bash
# 安装分析工具
npm install --save-dev rollup-plugin-visualizer

# 在 vite.config.ts 中添加插件
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true, filename: 'dist/stats.html' })
  ],
  // ...
});
```

### 3. 使用 Chrome DevTools

1. **打开 Network 面板**
2. **刷新页面**
3. **查看加载的 JavaScript 文件**：
   - 初始加载应该不包含图表库
   - 访问图表页面时才加载图表库

### 4. 使用 Lighthouse

1. **运行 Lighthouse 性能测试**
2. **查看 "减少未使用的 JavaScript" 建议**：
   - 应该看到显著减少
   - 未使用代码应该 < 1,000 KiB

## 最佳实践

### ✅ 应该做的

1. **使用懒加载大型库**
   ```typescript
   const Chart = React.lazy(() => import('@ant-design/plots'));
   ```

2. **按需导入组件**
   ```typescript
   import { Button, Card } from 'antd';
   ```

3. **使用生产构建**
   ```bash
   npm run build
   ```

4. **代码分割**
   ```typescript
   const Page = lazy(() => import('./Page'));
   ```

### ❌ 不应该做的

1. **导入整个库**
   ```typescript
   // ❌ 差
   import * as antd from 'antd';
   ```

2. **在初始 bundle 中包含大型库**
   ```typescript
   // ❌ 差
   import { Line, Bar, Pie, Funnel } from '@ant-design/plots';
   ```

3. **使用开发版本**
   ```typescript
   // ❌ 差（开发版本包含大量调试代码）
   // 确保使用生产构建
   ```

## 总结

通过以下优化措施：
- ✅ 图表库懒加载
- ✅ Vite 构建优化（分包、压缩、Tree Shaking）
- ✅ Ant Design 按需导入
- ✅ 路由代码分割
- ✅ 图标按需导入

**预期效果**：
- 初始 bundle 大小：减少 50%+
- 未使用代码：从 4,578 KiB 减少到 < 1,000 KiB
- 首屏加载时间：显著提升
- 用户体验：更快的页面加载

