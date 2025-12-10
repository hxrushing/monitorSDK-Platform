import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import router from './router'
import './index.css'
import useGlobalStore from '@/store/globalStore'
import logo1 from '@/assets/logo1.jpg'
import logo2 from '@/assets/logo2.jpg'

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

  // 设置 HTML 属性，便于自定义样式选择
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', themeMode)
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: themeMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { colorPrimary: siteSettings.primaryColor }
      }}
      componentSize={siteSettings.componentSize}
    >
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)