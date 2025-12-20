# 双层 Error Boundary 设计模式详解

## 一、设计概述

### 1.1 什么是双层 Error Boundary

双层 Error Boundary 是一种错误处理架构模式，通过在应用的不同层级设置错误边界，实现**细粒度的错误隔离**和**全面的错误捕获**。

本项目采用了以下两层错误边界：

- **全局 Error Boundary**：包裹整个应用，作为最后一道防线
- **路由 Error Boundary**：为每个路由配置独立的错误处理，实现错误隔离

### 1.2 设计目标

1. **布局保留**：路由错误时保留侧边栏和导航，用户可以继续使用应用
2. **自动恢复**：路由级错误通过导航自动恢复，无需手动操作
3. **错误类型区分**：路由级可以区分 404/500 等不同错误类型
4. **全面覆盖**：全局级捕获所有未处理的错误，作为最后防线
5. **错误追踪**：分层收集错误信息，便于问题定位

## 二、架构实现

### 2.1 全局 Error Boundary

**位置**：`src/components/ErrorBoundary.tsx`

**作用范围**：包裹整个应用根组件

**实现方式**：使用 React 的类组件 Error Boundary 机制

```typescript
// src/main.tsx
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>
)
```

**捕获的错误类型**：
- 组件渲染错误
- 生命周期方法中的错误
- 构造函数中的错误
- 事件处理器中的错误（如果未在事件处理器中捕获）

**特点**：
- 使用 `componentDidCatch` 记录错误信息
- 提供"重试"和"返回首页"的恢复选项
- 开发环境显示详细错误堆栈

### 2.2 路由 Error Boundary

**位置**：`src/components/RouteErrorBoundary.tsx`

**作用范围**：每个路由的 `errorElement` 配置

**实现方式**：使用 React Router v6 的 `errorElement` 和 `useRouteError` Hook

```typescript
// src/router/index.tsx
const router = createBrowserRouter([
  {
    path: '/app/dashboard',
    element: withSuspense(<Dashboard />),
    errorElement: <RouteErrorBoundary />,  // 路由级错误处理
  },
  // ... 其他路由
]);
```

**捕获的错误类型**：
- 路由加载器（loader）错误
- 路由动作（action）错误
- 路由组件加载失败
- 路由参数验证错误
- 404/500 等 HTTP 错误

**特点**：
- 与 React Router 深度集成
- 区分不同类型的路由错误（404、500、其他）
- 使用 `Link` 组件进行导航，保持 SPA 特性

## 三、错误处理流程

### 3.1 错误捕获优先级

```
用户操作
    ↓
路由组件/加载器
    ↓
[路由 Error Boundary] ← 优先捕获路由相关错误
    ↓
全局组件树
    ↓
[全局 Error Boundary] ← 捕获所有未处理的错误
    ↓
应用崩溃（理论上不会到达这里）
```

### 3.2 错误处理示例

#### 场景 1：路由组件加载失败

```typescript
// 路由懒加载失败
const Dashboard = lazy(() => import('@/pages/Dashboard'));

// 如果 Dashboard 模块加载失败
// → 被 RouteErrorBoundary 捕获
// → 只替换 <Outlet /> 内容，显示路由错误页面
// → 侧边栏和导航仍然可见
// → 用户可以直接点击导航菜单访问其他路由
```

**布局结构**：
```typescript
// App.tsx
<MainLayout>  {/* 侧边栏、顶部导航 - 仍然可见 */}
  <Outlet />  {/* 这里显示 RouteErrorBoundary 的错误页面 */}
</MainLayout>
```

#### 场景 2：组件渲染错误

```typescript
// Dashboard 组件内部渲染错误
function Dashboard() {
  const data = null;
  return <div>{data.items.map(...)}</div>; // TypeError
}

// → 被全局 ErrorBoundary 捕获
// → 显示全局错误页面
// → 提供重试或返回首页选项
```

#### 场景 3：路由加载器错误

```typescript
// 如果路由配置了 loader
{
  path: '/app/dashboard',
  loader: async () => {
    const data = await fetchData();
    if (!data) throw new Response('Not Found', { status: 404 });
    return data;
  },
  errorElement: <RouteErrorBoundary />
}

// → 被 RouteErrorBoundary 捕获
// → 根据错误状态码显示对应页面（404/500）
```

## 四、核心优势分析

### 4.1 布局保留与用户体验

**单层 Error Boundary 的问题**：
- 全局 Error Boundary 捕获错误后，会替换整个应用内容
- 虽然用户仍可通过 URL 访问其他路由，但**当前页面的布局（侧边栏、导航）可能被错误页面完全替换**
- 用户需要手动输入 URL 或刷新页面才能访问其他路由

**双层设计的优势**：
- **路由级错误边界只替换 `<Outlet />` 的内容区域**
- **侧边栏、顶部导航等布局元素仍然可见和可用**
- 用户可以直接点击导航菜单跳转到其他路由，无需手动输入 URL

**实际效果对比**：

**单层（全局 Error Boundary）**：
```
用户访问 /app/dashboard（出错）
    ↓
全局 ErrorBoundary 捕获
    ↓
显示全局错误页面（替换整个应用，包括侧边栏）
    ↓
用户需要手动输入 URL 或刷新才能访问其他路由
```

**双层（路由 + 全局 Error Boundary）**：
```
用户访问 /app/dashboard（出错）
    ↓
路由 ErrorBoundary 捕获
    ↓
只替换内容区域，显示路由错误页面
    ↓
侧边栏和导航仍然可见
    ↓
用户点击侧边栏菜单 → 直接跳转到 /app/events（正常）
    ↓
正常显示 Events 页面，无需刷新
```

**关键代码结构**：
```typescript
// App.tsx - 布局组件
<MainLayout>  {/* 侧边栏、导航等 */}
  <Outlet />  {/* 路由内容区域 - 这里会被 RouteErrorBoundary 替换 */}
</MainLayout>
```

### 4.2 错误类型区分

#### 路由 Error Boundary 的错误分类

```typescript
// RouteErrorBoundary.tsx
if (isRouteErrorResponse(error)) {
  if (error.status === 404) {
    // 显示 404 页面
  } else if (error.status === 500) {
    // 显示 500 页面
  } else {
    // 显示其他 HTTP 错误
  }
} else {
  // JavaScript 错误或其他错误
}
```

#### 全局 Error Boundary 的错误处理

```typescript
// ErrorBoundary.tsx
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  // 记录组件渲染错误
  // 包含组件堆栈信息
  console.error('ErrorBoundary捕获到错误:', error, errorInfo);
}
```

### 4.3 错误恢复机制

#### 路由级错误恢复（自动恢复）

```typescript
// RouteErrorBoundary 使用 Link 组件
<Link to="/app/dashboard">
  <Button type="primary">返回首页</Button>
</Link>
```

**优势**：
- **自动恢复**：用户导航到其他路由时，错误状态自动清除（因为路由切换会重新渲染）
- 使用 `Link` 组件，保持 SPA 特性（无需刷新页面）
- **布局保留**：侧边栏和导航仍然可见，用户可以直接点击菜单

**实际场景**：
```typescript
// 用户操作流程
1. Dashboard 页面出错 → 显示路由错误页面
2. 侧边栏仍然可见，用户点击"事件分析"菜单
3. 路由切换到 /app/events → 自动清除错误状态
4. Events 页面正常显示
```

#### 全局级错误恢复（手动恢复）

```typescript
// ErrorBoundary 提供重试和导航选项
<Button onClick={this.handleReset}>重试</Button>
<Button onClick={this.handleGoHome}>返回首页</Button>
```

**特点**：
- **需要手动操作**：必须点击"重试"按钮才能清除错误状态
- 重试功能重置组件状态，尝试重新渲染
- 返回首页使用 `window.location.href`，会刷新整个页面

**对比**：
- **路由级**：导航即恢复，无需额外操作
- **全局级**：需要手动点击按钮恢复

### 4.4 开发体验

#### 开发环境错误详情

```typescript
// 两个 Error Boundary 都在开发环境显示详细错误信息
{process.env.NODE_ENV === 'development' && (
  <details>
    <summary>错误详情（开发环境）</summary>
    <pre>{error.stack || error.toString()}</pre>
  </details>
)}
```

**优势**：
- 开发时快速定位问题
- 生产环境隐藏技术细节，保护应用信息

## 五、实现细节

### 5.1 全局 Error Boundary 实现

```typescript
// src/components/ErrorBoundary.tsx
class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    // 更新 state，显示降级 UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误信息
    console.error('ErrorBoundary捕获到错误:', error, errorInfo);
    // 可以发送到错误监控服务
  }

  handleReset = () => {
    // 重置错误状态，尝试重新渲染
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    });
  };
}
```

**关键点**：
- 必须使用类组件（函数组件无法实现 Error Boundary）
- `getDerivedStateFromError` 用于更新状态
- `componentDidCatch` 用于记录错误

### 5.2 路由 Error Boundary 实现

```typescript
// src/components/RouteErrorBoundary.tsx
const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    // 处理路由错误响应
    if (error.status === 404) {
      return <NotFoundPage />;
    }
    // ...
  }

  // 处理 JavaScript 错误
  return <ErrorPage error={error} />;
};
```

**关键点**：
- 使用 `useRouteError` Hook 获取路由错误
- 使用 `isRouteErrorResponse` 判断错误类型
- 可以返回不同的错误 UI 组件

### 5.3 路由配置

```typescript
// src/router/index.tsx
const router = createBrowserRouter([
  {
    path: '/app',
    element: withSuspense(<App />),
    errorElement: <RouteErrorBoundary />,  // 父路由错误边界
    children: [
      {
        path: 'dashboard',
        element: withSuspense(<Dashboard />),
        errorElement: <RouteErrorBoundary />,  // 子路由错误边界
      },
    ],
  },
]);
```

**关键点**：
- 每个路由都可以配置独立的 `errorElement`
- 子路由的错误会被最近的父级 `errorElement` 捕获
- 如果没有配置，错误会向上冒泡到全局 Error Boundary

## 六、使用场景

### 6.1 适合使用路由 Error Boundary 的场景

1. **路由懒加载失败**
   ```typescript
   const Dashboard = lazy(() => import('@/pages/Dashboard'));
   // 如果网络问题导致加载失败
   ```

2. **路由加载器错误**
   ```typescript
   {
     loader: async () => {
       const data = await fetchData();
       if (!data) throw new Response('Not Found', { status: 404 });
     }
   }
   ```

3. **路由参数验证失败**
   ```typescript
   {
     path: '/user/:id',
     loader: ({ params }) => {
       if (!isValidId(params.id)) {
         throw new Response('Invalid ID', { status: 400 });
       }
     }
   }
   ```

### 6.2 适合使用全局 Error Boundary 的场景

1. **组件渲染错误**
   ```typescript
   function Component() {
     const data = null;
     return <div>{data.items}</div>; // TypeError
   }
   ```

2. **生命周期错误**
   ```typescript
   componentDidMount() {
     this.setState({ data: undefined.data }); // 错误
   }
   ```

3. **未捕获的组件错误**
   ```typescript
   // 任何在组件树中未处理的错误
   ```

## 七、最佳实践

### 7.1 错误边界配置建议

1. **为所有路由配置 errorElement**
   ```typescript
   // 推荐：每个路由都有错误处理
   {
     path: '/app/dashboard',
     element: withSuspense(<Dashboard />),
     errorElement: <RouteErrorBoundary />,
   }
   ```

2. **全局 Error Boundary 作为最后防线**
   ```typescript
   // 必须：在应用根部设置全局错误边界
   <ErrorBoundary>
     <App />
   </ErrorBoundary>
   ```

### 7.2 错误信息收集

```typescript
// 在 ErrorBoundary 中集成错误监控
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  // 发送到错误监控服务
  errorReportingService.logError({
    error,
    errorInfo,
    timestamp: new Date(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  });
}
```

### 7.3 错误恢复策略

1. **路由级错误**：提供导航到其他路由的选项
2. **全局级错误**：提供重试和返回首页的选项
3. **网络错误**：提供刷新页面的选项

### 7.4 用户体验优化

1. **友好的错误提示**：使用清晰的错误消息，避免技术术语
2. **恢复选项**：提供多种恢复路径（重试、导航、刷新）
3. **开发环境详情**：开发时显示详细错误，生产环境隐藏

## 八、与其他错误处理机制的配合

### 8.1 与 Suspense 配合

```typescript
// 路由配置
{
  path: '/app/dashboard',
  element: (
    <Suspense fallback={<RouteLoading />}>
      <Dashboard />
    </Suspense>
  ),
  errorElement: <RouteErrorBoundary />,
}
```

**配合效果**：
- Suspense 处理加载状态
- Error Boundary 处理加载失败和渲染错误

### 8.2 与 try-catch 配合

```typescript
// 事件处理器中的错误需要手动捕获
function handleClick() {
  try {
    // 可能出错的操作
  } catch (error) {
    // 手动处理或重新抛出
    throw error; // 会被 Error Boundary 捕获
  }
}
```

**注意**：Error Boundary 不会捕获以下错误：
- 事件处理器中的错误（需要手动 try-catch）
- 异步代码中的错误（需要 Promise.catch）
- 服务端渲染错误
- Error Boundary 自身的错误

## 九、总结

双层 Error Boundary 设计模式通过以下方式提升了应用的健壮性和用户体验：

### 9.1 核心优势总结

1. **布局保留**：路由级错误只替换内容区域，保留侧边栏和导航，用户可以继续使用应用
2. **自动恢复**：路由级错误通过导航自动恢复，无需手动点击"重试"按钮
3. **错误类型区分**：路由级可以区分 404/500 等不同错误类型，提供针对性提示
4. **全面覆盖**：全局级错误边界捕获所有未处理的错误，作为最后防线
5. **开发效率**：开发环境显示详细错误信息，便于调试

### 9.2 与单层设计的对比

| 特性 | 单层（全局） | 双层（路由+全局） |
|------|------------|-----------------|
| 布局保留 | ❌ 错误页面可能替换整个应用 | ✅ 只替换内容区域 |
| 错误恢复 | ⚠️ 需要手动点击"重试" | ✅ 导航即自动恢复 |
| 错误类型区分 | ❌ 只能显示通用错误 | ✅ 可以区分 404/500 等 |
| 用户体验 | ⚠️ 需要手动输入 URL | ✅ 可以直接点击导航菜单 |
| 路由加载器错误 | ❌ 无法捕获 | ✅ 可以捕获 |

### 9.3 适用场景

这种设计模式特别适合：
- **大型单页应用（SPA）**：有复杂布局和多个路由
- **需要保留导航的应用**：侧边栏、顶部导航等需要始终可见
- **需要区分错误类型的应用**：404、500 等需要不同处理
- **注重用户体验的应用**：减少用户操作步骤，提升流畅度

通过双层设计，我们实现了**细粒度的错误处理**和**优雅的用户体验**，让错误处理不再是应用的负担，而是提升用户体验的工具。

## 十、参考资源

- [React Error Boundaries 官方文档](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [React Router v6 Error Handling](https://reactrouter.com/en/main/route/error-element)
- [错误处理最佳实践](https://kentcdodds.com/blog/use-react-error-boundary)

