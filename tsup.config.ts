import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/sdk/index.ts'],
  dts: true,
  format: ['esm', 'cjs', 'iife'],
  globalName: 'AnalyticsSDK',
  outDir: 'dist/sdk',
  clean: true,
  sourcemap: true,
  minify: true,
  target: 'es2018',
  treeshake: true,
});


