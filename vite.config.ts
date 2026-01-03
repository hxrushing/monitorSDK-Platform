import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import removeConsole from 'vite-plugin-remove-console'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 生产环境移除 console 语句（保留 console.error 和 console.warn，便于错误追踪）
    // 该插件默认只在生产环境（build 模式）生效，开发环境不受影响
    removeConsole({
      includes: ['log', 'info', 'debug', 'trace'],
      // 不包含 error 和 warn，保留它们用于错误追踪
    }),
    // 自定义插件：在开发环境中服务 dist/sdk 目录
    {
      name: 'serve-sdk',
      configureServer(server) {
        server.middlewares.use('/sdk', (req, res, next) => {
          try {
            // 移除查询字符串和hash
            const urlPath = req.url?.split('?')[0].split('#')[0] || ''
            // 移除前导斜杠，避免路径解析问题
            const relativePath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath
            const filePath = path.resolve(__dirname, 'dist/sdk', relativePath)
            
            // 安全检查：确保路径在 dist/sdk 目录内
            const distSdkPath = path.resolve(__dirname, 'dist/sdk')
            const normalizedFilePath = path.normalize(filePath)
            const normalizedDistSdkPath = path.normalize(distSdkPath)
            
            if (!normalizedFilePath.startsWith(normalizedDistSdkPath + path.sep) && 
                normalizedFilePath !== normalizedDistSdkPath) {
              res.statusCode = 403
              res.end('Forbidden')
              return
            }

            // 检查文件是否存在
            if (fs.existsSync(normalizedFilePath) && fs.statSync(normalizedFilePath).isFile()) {
              const content = fs.readFileSync(normalizedFilePath)
              const ext = path.extname(normalizedFilePath)
              
              // 设置正确的 Content-Type
              const mimeTypes: Record<string, string> = {
                '.js': 'application/javascript',
                '.map': 'application/json',
                '.d.ts': 'text/typescript',
                '.d.cts': 'text/typescript',
                '.cjs': 'application/javascript',
              }
              
              res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
              res.setHeader('Content-Length', content.length.toString())
              // 添加CORS头，允许跨域访问
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(content)
            } else {
              res.statusCode = 404
              res.end('Not Found')
            }
          } catch (error) {
            console.error('SDK文件服务错误:', error)
            res.statusCode = 500
            res.end('Internal Server Error')
          }
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    },
    // 确保正确处理 CommonJS 模块
    dedupe: ['react', 'react-dom']
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    // 优化构建配置，减少未使用的代码
    rollupOptions: {
      output: {
        // 手动分包，将大型依赖分离
        manualChunks: {
          // React 相关
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Ant Design
          'antd-vendor': ['antd', '@ant-design/icons'],
          // 图表库
          'charts-vendor': ['@ant-design/plots'],
          // 工具库
          'utils-vendor': ['dayjs', 'lodash', 'axios', 'zustand'],
          // SDK 单独拆分，方便按需加载与缓存
          'sdk-vendor': ['src/sdk/index.ts'],
        },
        // 优化 chunk 大小
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      }
    },
    // 启用代码压缩（使用 esbuild，更快）
    minify: 'esbuild',
    // 注意：console 移除已通过 vite-plugin-remove-console 插件处理
    // 保留 esbuild 压缩以获得更快的构建速度
    // Tree Shaking 默认启用，无需配置
    // 设置 chunk 大小警告阈值
    chunkSizeWarningLimit: 1000,
  },
  // Worker 产物命名（独立于主构建）
  worker: {
    rollupOptions: {
      output: {
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'antd',
      'dayjs',
      'zustand',
      'axios',
      // 包含 size-sensor，修复懒加载时的导入问题
      'size-sensor',
      // 包含 pdfast，修复导入问题
      'pdfast',
      // 将 @ant-design/plots 也包含进来，确保其依赖（如 size-sensor）被正确预构建
      // 这样可以避免懒加载时的 CommonJS 模块转换问题
      '@ant-design/plots'
    ],
    // 不再排除 @ant-design/plots，因为需要预构建其依赖
    // exclude: ['@ant-design/plots'],
    // 添加 esbuild 选项来处理 CommonJS
    esbuildOptions: {
      // 确保正确处理 CommonJS 模块
      logOverride: { 'this-is-undefined-in-esm': 'silent' },
      // 将 CommonJS 转换为 ES 模块
      format: 'esm'
    }
  }
})
