# 修复 size-sensor 错误 - 最终方案

## 问题原因

`size-sensor` 是 `@ant-design/plots` 的依赖，它是一个 CommonJS 模块。当 `@ant-design/plots` 被懒加载时，Vite 的依赖预构建没有正确处理 `size-sensor` 的 CommonJS 导出。

## 解决方案

已更新 `vite.config.ts`，将 `@ant-design/plots` 也包含在 `optimizeDeps.include` 中，这样它的所有依赖（包括 `size-sensor`）都会被正确预构建和转换。

### 关键更改

```typescript
optimizeDeps: {
  include: [
    // ... 其他依赖
    'size-sensor',
    'pdfast',
    '@ant-design/plots'  // ✅ 新增：包含 @ant-design/plots 以确保依赖被正确预构建
  ],
  // ❌ 移除了 exclude: ['@ant-design/plots']
  esbuildOptions: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    format: 'esm'  // ✅ 新增：确保转换为 ES 模块
  }
}
```

## 修复步骤

### 1. 清除 Vite 缓存（必须）

**方法 1：手动删除**
- 删除 `node_modules/.vite` 文件夹

**方法 2：使用命令**
```powershell
# PowerShell
Remove-Item -Recurse -Force node_modules\.vite
```

```bash
# Git Bash / Linux / Mac
rm -rf node_modules/.vite
```

### 2. 重启开发服务器

```bash
# 停止当前服务器（Ctrl+C），然后重新启动
pnpm dev
# 或
npm run dev
```

### 3. 验证修复

修复后应该能够：
- ✅ 正常加载图表组件（Line、Funnel 等）
- ✅ 不再出现 `size-sensor` 相关的错误
- ✅ 懒加载功能正常工作

## 为什么这样修复？

1. **预构建依赖**：将 `@ant-design/plots` 包含在 `optimizeDeps.include` 中，Vite 会在启动时预构建它及其所有依赖
2. **CommonJS 转换**：通过 `esbuildOptions.format: 'esm'`，确保 CommonJS 模块（如 `size-sensor`）被正确转换为 ES 模块
3. **避免懒加载问题**：预构建后，即使使用懒加载，依赖也已经被正确处理

## 性能影响

- **首次启动**：可能会稍慢一些（需要预构建 `@ant-design/plots`）
- **后续启动**：使用缓存，速度正常
- **运行时**：没有影响，因为依赖已经被预构建

## 如果问题仍然存在

1. **完全清除并重新安装**：
   ```bash
   Remove-Item -Recurse -Force node_modules
   Remove-Item pnpm-lock.yaml  # 或 package-lock.json
   pnpm install
   ```

2. **检查 Node.js 版本**：建议使用 Node.js 16+ 或 18+

3. **检查 Vite 版本**：确保使用最新版本的 Vite

4. **查看完整错误信息**：检查浏览器控制台的完整错误堆栈

