// src/utils/http.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

// 重试配置
const MAX_RETRIES = 3
const BASE_DELAY = 500 // ms，指数退避基准

// 简单延迟方法
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// 直接使用相对路径 /api，通过 Nginx 反向代理
const instance = axios.create({
  baseURL: '/api',
  timeout: 30000  // 增加到30秒，支持大数据量查询
})

// 请求拦截器
instance.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    (config.headers = config.headers || {}).Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器
instance.interceptors.response.use(
  response => response.data,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { __retryCount?: number }) | undefined

    // 401 直接处理，不重试
    const status = error?.response?.status
    if (status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }

    // 判断是否需要重试：网络错误/无响应，或 5xx/429
    const shouldRetry =
      !error.response ||
      (status !== undefined && (status >= 500 || status === 429))

    if (config && shouldRetry) {
      config.__retryCount = config.__retryCount || 0
      if (config.__retryCount < MAX_RETRIES) {
        config.__retryCount += 1
        const delay = BASE_DELAY * Math.pow(2, config.__retryCount - 1) + Math.random() * 200
        await sleep(delay)
        return instance.request(config)
      }
    }

    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export default instance