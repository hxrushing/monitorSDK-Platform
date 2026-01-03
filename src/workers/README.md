# Web Workers 使用说明

## 📋 概述

Web Workers 用于在后台线程中处理大数据，避免阻塞主线程，提升用户体验。

## 🚀 功能特性

1. **后台处理**: 大数据采样在后台线程执行，不阻塞 UI
2. **自动回退**: Worker 不支持时自动回退到同步处理
3. **类型安全**: 完整的 TypeScript 类型支持
4. **易于使用**: 提供便捷的 Hook 封装

## 📖 使用方法

### 1. 使用数据采样 Worker Hook

```typescript
import { useDataSamplingWorker } from '@/hooks/useWorker';

const MyComponent: React.FC = () => {
  const [sampledData, setSampledData] = useState<any[]>([]);
  
  const { postMessage, isProcessing } = useDataSamplingWorker<any[]>(
    (result) => {
      setSampledData(result);
    },
    {
      onError: (error) => {
        console.error('Worker 处理失败:', error);
        // 回退到同步处理
      }
    }
  );

  useEffect(() => {
    if (largeDataArray.length > 500) {
      postMessage({
        type: 'adaptive',
        payload: {
          data: largeDataArray,
          threshold: 500,
          maxPoints: 1000,
          xField: 'date',
          yField: 'value',
          seriesField: 'type'
        }
      });
    }
  }, [largeDataArray, postMessage]);

  return (
    <Spin spinning={isProcessing}>
      {/* 渲染图表 */}
    </Spin>
  );
};
```

### 2. 使用通用 Worker Hook

```typescript
import { useWorker } from '@/hooks/useWorker';

const { postMessage, isProcessing, terminate } = useWorker(
  new URL('../workers/dataSampling.worker.ts', import.meta.url),
  (result) => {
    console.log('处理结果:', result);
  }
);

// 发送消息
postMessage({
  type: 'lttb',
  payload: {
    data: myData,
    maxPoints: 1000,
    xField: 'date',
    yField: 'value'
  }
});
```

## 🔧 支持的采样类型

### 1. LTTB 采样

```typescript
postMessage({
  type: 'lttb',
  payload: {
    data: dataArray,
    maxPoints: 1000,
    xField: 'date',
    yField: 'value'
  }
});
```

### 2. 简单采样

```typescript
postMessage({
  type: 'simple',
  payload: {
    data: dataArray,
    maxPoints: 1000
  }
});
```

### 3. 智能采样（多系列）

```typescript
postMessage({
  type: 'smart',
  payload: {
    data: dataArray,
    maxPoints: 1000,
    xField: 'date',
    yField: 'value',
    seriesField: 'type' // 按此字段分组采样
  }
});
```

### 4. 自适应采样（推荐）

```typescript
postMessage({
  type: 'adaptive',
  payload: {
    data: dataArray,
    threshold: 500,      // 触发采样的阈值
    maxPoints: 1000,     // 最大采样点数
    xField: 'date',
    yField: 'value',
    seriesField: 'type'  // 可选
  }
});
```

## 📊 性能优势

### 主线程处理（同步）
- ❌ 阻塞 UI 渲染
- ❌ 用户操作无响应
- ❌ 大数据量时页面卡顿

### Worker 处理（异步）
- ✅ 不阻塞 UI
- ✅ 用户操作流畅
- ✅ 大数据量也能保持响应

## ⚠️ 注意事项

1. **数据大小限制**: Worker 中传递的数据会被序列化，注意数据大小
2. **浏览器支持**: 现代浏览器都支持 Web Workers
3. **自动回退**: Worker 不支持时会自动回退到同步处理
4. **内存管理**: Worker 会在组件卸载时自动终止

## 🔍 调试

### 查看 Worker 处理状态

```typescript
const { isProcessing } = useDataSamplingWorker(...);

console.log('Worker 处理中:', isProcessing);
```

### 查看处理结果

Worker 处理完成后会在控制台输出：
```
[Worker] 采样完成: 10000 -> 1000 点, 压缩比: 90.0%
```

## 📚 参考文档

- [MDN: Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [Vite: Web Workers](https://vitejs.dev/guide/features.html#web-workers)

