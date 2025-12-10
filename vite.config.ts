import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // 启用代码压缩（使用 esbuild，更快）
    minify: 'esbuild',
    // 注意：esbuild 不支持 drop_console，如果需要移除 console，可以使用 terser
    // 但 esbuild 压缩速度更快，通常已经足够
    // 启用 Tree Shaking
    treeshake: true,
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
      'pdfast'
    ],
    // 排除大型库，让它们按需加载
    // 注意：虽然排除 @ant-design/plots，但需要包含其依赖
    exclude: ['@ant-design/plots']
  }
})
