# Skeleton 骨架屏组件使用说明

骨架屏（Skeleton Screen）是一种在数据加载时显示的占位界面，能够提升用户体验，让用户感知到内容正在加载，而不是看到空白页面。

## 组件列表

### 1. DashboardSkeleton - Dashboard页面骨架屏

专门为Dashboard页面设计的完整骨架屏，包含：
- 顶部工具栏骨架
- 4个统计卡片骨架
- 图表卡片骨架
- 表格卡片骨架

**使用方式：**
```tsx
import { DashboardSkeleton } from '@/components/Skeleton';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  // 首次加载且没有数据时显示骨架屏
  if (loading && data.length === 0) {
    return <DashboardSkeleton />;
  }

  return (
    <Spin spinning={loading}>
      {/* 实际内容 */}
    </Spin>
  );
};
```

**已应用位置：**
- `src/pages/Dashboard/index.tsx` - Dashboard页面

---

### 2. StatisticCardSkeleton - 统计卡片骨架屏

用于单个统计卡片的加载状态。

**使用方式：**
```tsx
import { StatisticCardSkeleton } from '@/components/Skeleton';

<Row gutter={[16, 16]}>
  {loading ? (
    <>
      <Col span={6}>
        <StatisticCardSkeleton />
      </Col>
      <Col span={6}>
        <StatisticCardSkeleton />
      </Col>
      {/* ... */}
    </>
  ) : (
    // 实际内容
  )}
</Row>
```

**Props：**
- `showTitle?: boolean` - 是否显示标题骨架，默认true
- `titleWidth?: string | number` - 标题宽度，默认'60%'

---

### 3. TableSkeleton - 表格骨架屏

用于表格组件的加载状态。

**使用方式：**
```tsx
import { TableSkeleton } from '@/components/Skeleton';

{loading ? (
  <TableSkeleton 
    columns={3} 
    rows={5} 
    showCard 
    cardTitle="数据列表"
  />
) : (
  <Table dataSource={data} columns={columns} />
)}
```

**Props：**
- `columns?: number` - 表格列数，默认3
- `rows?: number` - 表格行数，默认5
- `showCard?: boolean` - 是否显示卡片包裹，默认true
- `cardTitle?: string` - 卡片标题

---

### 4. ChartSkeleton - 图表骨架屏

用于图表组件的加载状态。

**使用方式：**
```tsx
import { ChartSkeleton } from '@/components/Skeleton';

{loading ? (
  <ChartSkeleton 
    showCard 
    cardTitle="访问趋势"
    height={400}
  />
) : (
  <Line {...config} />
)}
```

**Props：**
- `showCard?: boolean` - 是否显示卡片包裹，默认true
- `cardTitle?: string` - 卡片标题
- `height?: number | string` - 图表高度，默认400

---

## 设计原则

### 何时使用骨架屏

1. **首次加载**：页面首次加载数据时使用骨架屏
2. **数据刷新**：如果已有数据，使用Spin遮罩层；如果没有数据，使用骨架屏
3. **关键内容**：为主要内容区域提供骨架屏，而不是每个小元素

### 最佳实践

```tsx
// ✅ 好的做法：首次加载显示骨架屏
if (loading && data.length === 0) {
  return <DashboardSkeleton />;
}

// ✅ 好的做法：有数据时刷新使用Spin
return (
  <Spin spinning={loading}>
    {/* 已有数据，刷新时显示遮罩 */}
    <DashboardContent data={data} />
  </Spin>
);

// ❌ 不好的做法：每次都显示骨架屏
if (loading) {
  return <DashboardSkeleton />; // 会闪烁
}
```

---

## 统一导出

所有组件都通过 `src/components/Skeleton/index.ts` 统一导出：

```tsx
import { 
  DashboardSkeleton,
  StatisticCardSkeleton,
  TableSkeleton,
  ChartSkeleton 
} from '@/components/Skeleton';
```

---

## 与其他加载组件的区别

| 组件类型 | 使用场景 | 特点 |
|---------|---------|------|
| **Skeleton** | 首次加载、无数据时 | 显示页面结构，用户知道内容布局 |
| **Spin** | 数据刷新、有数据时 | 遮罩层，不改变页面结构 |
| **Loading** | 路由懒加载 | 全屏加载，路由切换时 |

---

## 未来扩展

可以考虑添加：
- `FormSkeleton` - 表单骨架屏
- `ListSkeleton` - 列表骨架屏
- `CardSkeleton` - 通用卡片骨架屏
- 自定义动画效果

---

## 性能考虑

骨架屏组件使用Ant Design的`Skeleton`组件，性能优化：
- 使用`active`属性启用动画（仅在需要时）
- 避免过度使用动画，影响性能
- 骨架屏结构应尽量接近实际内容布局

