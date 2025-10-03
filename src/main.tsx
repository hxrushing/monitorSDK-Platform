import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import router from './router'
import './index.css'
import useGlobalStore from '@/store/globalStore'

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
      <RouterProvider router={router} />
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)