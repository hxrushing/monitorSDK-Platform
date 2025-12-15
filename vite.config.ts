import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
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
          'antd-vendor': ['antd'],
          // 图表库（按需加载，不在这里打包）
          // '@ant-design/plots': ['@ant-design/plots'],
        },
        // 优化 chunk 大小
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Worker 文件命名
        workerChunkFileNames: 'js/[name]-[hash].js'
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
