import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/sdk/index.ts'],
  dts: true,
  format: ['esm', 'cjs', 'iife'],
  globalName: 'Analytics',
  outDir: 'dist/sdk',
  clean: true,
  sourcemap: true,
  minify: true,
  target: 'es2018',
  treeshake: true,
  external: [], // 不外部化任何依赖，确保打包后可以独立使用
  // 为IIFE格式提供导出
  iife: {
    footer: 'window.Analytics = Analytics;',
  },
});


