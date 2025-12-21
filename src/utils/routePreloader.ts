/**
 * 路由预加载工具
 * 用于优化路由懒加载性能，在用户可能访问前提前加载资源
 */

// 路由组件导入函数映射
const routeImportMap: Record<string, () => Promise<any>> = {
  'dashboard': () => import('@/pages/Dashboard'),
  'events': () => import('@/pages/EventAnalysis'),
  'funnel': () => import('@/pages/FunnelAnalysis'),
  'performance': () => import('@/pages/PerformanceAnalysis'),
  'event-management': () => import('@/pages/EventManagement'),
  'member-management': () => import('@/pages/MemberManagement'),
  'settings': () => import('@/pages/SystemSettings'),
  'ai-summary': () => import('@/pages/AISummarySettings'),
  'prediction': () => import('@/pages/Prediction'),
  'prediction-history': () => import('@/pages/PredictionHistory'),
};

// 已预加载的路由集合
const preloadedRoutes = new Set<string>();

/**
 * 预加载指定路由
 * @param routeName 路由名称（对应路由路径）
 * @returns Promise<void>
 */
export const preloadRoute = async (routeName: string): Promise<void> => {
  // 如果已经预加载过，直接返回
  if (preloadedRoutes.has(routeName)) {
    return;
  }

  const importFn = routeImportMap[routeName];
  if (!importFn) {
    console.warn(`路由 ${routeName} 未找到对应的导入函数`);
    return;
  }

  try {
    // 使用 requestIdleCallback 在浏览器空闲时预加载
    if ('requestIdleCallback' in window) {
      requestIdleCallback(async () => {
        await importFn();
        preloadedRoutes.add(routeName);
      }, { timeout: 2000 }); // 2秒超时，确保即使浏览器不空闲也会执行
    } else {
      // 降级方案：使用 setTimeout
      setTimeout(async () => {
        await importFn();
        preloadedRoutes.add(routeName);
      }, 100);
    }
  } catch (error) {
    console.error(`预加载路由 ${routeName} 失败:`, error);
  }
};

/**
 * 批量预加载路由
 * @param routeNames 路由名称数组
 */
export const preloadRoutes = async (routeNames: string[]): Promise<void> => {
  const promises = routeNames
    .filter(name => !preloadedRoutes.has(name))
    .map(name => preloadRoute(name));
  
  await Promise.all(promises);
};

/**
 * 预加载关键路由（如首页、常用页面）
 * 在应用初始化后调用
 */
export const preloadCriticalRoutes = (): void => {
  // 预加载最常用的路由
  const criticalRoutes = ['dashboard', 'events', 'funnel'];
  preloadRoutes(criticalRoutes);
};

/**
 * 使用 link prefetch 预加载路由资源
 * 这是一个更轻量级的预加载方式，不会执行 JavaScript
 * @param routeName 路由名称
 */
export const prefetchRouteResource = (_routeName: string): void => {
  // 注意：这个方法需要知道构建后的 chunk 文件名
  // 在实际项目中，可以通过 manifest 文件获取
  // 这里提供一个基础实现思路
  
  // 在开发环境，Vite 会自动处理 prefetch
  // 在生产环境，可以通过分析构建产物来获取 chunk 名称
  
  // 示例：使用 link prefetch
  // const link = document.createElement('link');
  // link.rel = 'prefetch';
  // link.as = 'script';
  // link.href = `/js/${routeName}-[hash].js`;
  // document.head.appendChild(link);
};

/**
 * 检查路由是否已预加载
 * @param routeName 路由名称
 * @returns boolean
 */
export const isRoutePreloaded = (routeName: string): boolean => {
  return preloadedRoutes.has(routeName);
};

/**
 * 清除预加载缓存（用于开发调试）
 */
export const clearPreloadCache = (): void => {
  preloadedRoutes.clear();
};

