import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import router from './router'
import './index.css'
import useGlobalStore from '@/store/globalStore'
import ErrorBoundary from '@/components/ErrorBoundary'
import logo1 from '@/assets/logo1.jpg'
import logo2 from '@/assets/logo2.jpg'
import { initPerformanceMonitoring } from '@/utils/performance'
import { applyThemePreset, getThemePreset } from '@/utils/themePresets'

// 在 React 渲染之前立即应用主题，避免闪烁
if (typeof document !== 'undefined') {
  const storedThemeMode = localStorage.getItem('themeMode') === 'dark' ? 'dark' : 'light';
  const storedSettings = localStorage.getItem('siteSettings');
  let themePresetName = 'default-blue';
  if (storedSettings) {
    try {
      const parsed = JSON.parse(storedSettings);
      themePresetName = parsed.themePreset || 'default-blue';
    } catch {
      // 忽略解析错误
    }
  }
  document.documentElement.setAttribute('data-theme', storedThemeMode);
  applyThemePreset(themePresetName, storedThemeMode);
}

// 尽早预加载 LCP 图像（在 React 渲染之前）
// 这样浏览器可以在解析 HTML 后立即开始加载图片
if (typeof document !== 'undefined') {
  // 检查是否已经添加过预加载链接
  const existingPreloads = document.querySelectorAll('link[rel="preload"][as="image"][data-lcp="true"]');
  if (existingPreloads.length === 0) {
    // 预加载主要 logo（logo2，展开状态，更可能是 LCP）
    const preloadLink2 = document.createElement('link');
    preloadLink2.rel = 'preload';
    preloadLink2.as = 'image';
    preloadLink2.href = logo2;
    preloadLink2.setAttribute('fetchPriority', 'high');
    preloadLink2.setAttribute('data-lcp', 'true');
    document.head.appendChild(preloadLink2);

    // 预加载备用 logo（logo1，折叠状态）
    const preloadLink1 = document.createElement('link');
    preloadLink1.rel = 'preload';
    preloadLink1.as = 'image';
    preloadLink1.href = logo1;
    preloadLink1.setAttribute('fetchPriority', 'low');
    preloadLink1.setAttribute('data-lcp', 'true');
    document.head.appendChild(preloadLink1);
  }
}

const Root = () => {
  const themeMode = useGlobalStore(state => state.themeMode)
  const siteSettings = useGlobalStore(state => state.siteSettings)

  // 获取当前主题预设
  const themePreset = getThemePreset(siteSettings.themePreset)

  // 设置 HTML 属性，便于自定义样式选择
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', themeMode)
    }
  }, [themeMode])

  // 当主题预设或主题模式变化时，更新 CSS 变量
  useEffect(() => {
    applyThemePreset(siteSettings.themePreset, themeMode)
  }, [siteSettings.themePreset, themeMode])

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: themeMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { colorPrimary: themePreset.colors.primary }
      }}
      componentSize={siteSettings.componentSize}
    >
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </ConfigProvider>
  )
}

// 初始化性能监控
// 从 localStorage 获取项目ID，如果不存在则使用默认值
const getProjectId = (): string => {
  const storedProjectId = localStorage.getItem('selectedProjectId');
  return storedProjectId || 'demo-project';
};

initPerformanceMonitoring(getProjectId());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>
)