/**
 * 智能数据采样工具
 * 用于优化大数据量图表渲染性能
 */

/**
 * LTTB (Largest-Triangle-Three-Buckets) 采样算法
 * 保持数据趋势特征的采样方法
 * 
 * @param data 原始数据数组
 * @param maxPoints 最大采样点数（默认1000）
 * @param xField X轴字段名（默认'date'）
 * @param yField Y轴字段名（默认'value'）
 * @returns 采样后的数据数组
 */
export function lttbSampling<T extends { [key: string]: any }>(
  data: T[],
  maxPoints: number = 1000,
  xField: string = 'date',
  yField: string = 'value'
): T[] {
  if (!data || data.length === 0) {
    return [];
  }
  
  if (data.length <= maxPoints) {
    return data;
  }

  // 如果只需要1个点，返回第一个点
  if (maxPoints === 1) {
    return [data[0]];
  }

  // 如果只需要2个点，返回首尾两个点
  if (maxPoints === 2) {
    return [data[0], data[data.length - 1]];
  }

  const sampled: T[] = [];
  const bucketSize = (data.length - 2) / (maxPoints - 2);
  let a = 0; // 已选中的前一个点索引

  // 总是包含第一个点
  sampled.push(data[0]);

  for (let i = 0; i < maxPoints - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length - 1);
    const rangeEndNext = Math.min(rangeEnd + 1, data.length - 1);

    // 计算下一个桶的平均值（用于计算三角形面积）
    let avgRangeEndNext = 0;
    let avgRangeEndNextCount = 0;
    
    for (let j = rangeEnd; j < rangeEndNext; j++) {
      const yValue = Number(data[j]?.[yField]);
      if (!isNaN(yValue)) {
        avgRangeEndNext += yValue;
        avgRangeEndNextCount++;
      }
    }
    avgRangeEndNext = avgRangeEndNextCount > 0 ? avgRangeEndNext / avgRangeEndNextCount : 0;

    // 计算当前桶中每个点与已选点和下一个桶平均点形成的三角形面积
    // 选择面积最大的点
    let maxArea = -1;
    let maxAreaIndex = rangeStart;

    const aX = getNumericValue(data[a], xField);
    const aY = Number(data[a]?.[yField]) || 0;

    for (let j = rangeStart; j < rangeEnd; j++) {
      const jX = getNumericValue(data[j], xField);
      const jY = Number(data[j]?.[yField]) || 0;

      // 计算三角形面积（使用叉积公式）
      // 面积 = |(x1-x3)(y2-y1) - (x1-x2)(y3-y1)| / 2
      const area = Math.abs(
        (aX - avgRangeEndNext) * (jY - aY) - 
        (aX - jX) * (avgRangeEndNext - aY)
      );

      if (area > maxArea) {
        maxArea = area;
        maxAreaIndex = j;
      }
    }

    sampled.push(data[maxAreaIndex]);
    a = maxAreaIndex;
  }

  // 总是包含最后一个点
  sampled.push(data[data.length - 1]);

  return sampled;
}

/**
 * 获取数值（支持日期字符串转换为时间戳）
 */
function getNumericValue(item: any, field: string): number {
  const value = item[field];
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    // 尝试解析日期字符串
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
    // 尝试解析数字字符串
    const num = Number(value);
    if (!isNaN(num)) {
      return num;
    }
  }
  return 0;
}

/**
 * 简单等间隔采样（备用方案）
 * 当数据量不是特别大时使用
 * 
 * @param data 原始数据数组
 * @param maxPoints 最大采样点数
 * @returns 采样后的数据数组
 */
export function simpleSampling<T>(data: T[], maxPoints: number = 1000): T[] {
  if (data.length <= maxPoints) {
    return data;
  }

  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, index) => index % step === 0);
}

/**
 * 自适应采样
 * 根据数据量自动选择采样策略
 * 
 * @param data 原始数据数组
 * @param maxPoints 最大采样点数
 * @param useLTTB 是否使用LTTB算法（默认true）
 * @returns 采样后的数据数组
 */
export function adaptiveSampling<T extends { [key: string]: any }>(
  data: T[],
  maxPoints: number = 1000,
  useLTTB: boolean = true,
  xField: string = 'date',
  yField: string = 'value'
): T[] {
  if (data.length <= maxPoints) {
    return data;
  }

  // 数据量小于1万时使用简单采样，大于1万时使用LTTB
  if (useLTTB && data.length > 10000) {
    return lttbSampling(data, maxPoints, xField, yField);
  } else {
    return simpleSampling(data, maxPoints);
  }
}

/**
 * 按时间窗口采样
 * 将数据按时间窗口聚合（如每小时、每天）
 * 
 * @param data 原始数据数组
 * @param windowSize 时间窗口大小（毫秒）
 * @param xField 时间字段名
 * @param yField 值字段名
 * @param aggregateFn 聚合函数（sum, avg, max, min）
 * @returns 聚合后的数据数组
 */
export function timeWindowSampling<T extends { [key: string]: any }>(
  data: T[],
  windowSize: number,
  xField: string = 'date',
  yField: string = 'value',
  aggregateFn: 'sum' | 'avg' | 'max' | 'min' = 'avg'
): T[] {
  if (data.length === 0) return [];

  // 按时间窗口分组
  const windows = new Map<number, T[]>();
  
  data.forEach(item => {
    const timestamp = new Date(item[xField]).getTime();
    const windowKey = Math.floor(timestamp / windowSize) * windowSize;
    
    if (!windows.has(windowKey)) {
      windows.set(windowKey, []);
    }
    windows.get(windowKey)!.push(item);
  });

  // 聚合每个窗口的数据
  const result: T[] = [];
  windows.forEach((items, windowKey) => {
    const values = items.map(item => Number(item[yField]) || 0);
    let aggregatedValue: number;

    switch (aggregateFn) {
      case 'sum':
        aggregatedValue = values.reduce((a, b) => a + b, 0);
        break;
      case 'max':
        aggregatedValue = Math.max(...values);
        break;
      case 'min':
        aggregatedValue = Math.min(...values);
        break;
      case 'avg':
      default:
        aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
    }

    result.push({
      ...items[0],
      [xField]: new Date(windowKey).toISOString(),
      [yField]: aggregatedValue
    } as T);
  });

  return result.sort((a, b) => 
    new Date(a[xField]).getTime() - new Date(b[xField]).getTime()
  );
}

/**
 * 对图表数据进行智能采样
 * 支持多系列数据（通过 seriesField 分组）
 * 
 * @param data 原始数据数组
 * @param maxPoints 每个系列的最大采样点数（默认1000）
 * @param xField X轴字段名（默认'date'）
 * @param yField Y轴字段名（默认'value'）
 * @param seriesField 系列字段名（可选，如果提供则按系列分组采样）
 * @returns 采样后的数据数组
 */
export function smartChartSampling<T extends { [key: string]: any }>(
  data: T[],
  maxPoints: number = 1000,
  xField: string = 'date',
  yField: string = 'value',
  seriesField?: string
): T[] {
  if (!data || data.length === 0) {
    return [];
  }

  // 如果没有系列字段，直接对整个数据集采样
  if (!seriesField) {
    return lttbSampling(data, maxPoints, xField, yField);
  }

  // 按系列分组
  const seriesMap = new Map<string, T[]>();
  data.forEach(item => {
    const seriesValue = String(item[seriesField] || 'default');
    if (!seriesMap.has(seriesValue)) {
      seriesMap.set(seriesValue, []);
    }
    seriesMap.get(seriesValue)!.push(item);
  });

  // 对每个系列分别采样
  const sampledData: T[] = [];
  seriesMap.forEach((seriesData) => {
    // 按时间排序
    const sortedData = [...seriesData].sort((a, b) => {
      const aTime = getNumericValue(a, xField);
      const bTime = getNumericValue(b, xField);
      return aTime - bTime;
    });
    
    // 对每个系列进行LTTB采样
    const sampled = lttbSampling(sortedData, maxPoints, xField, yField);
    sampledData.push(...sampled);
  });

  return sampledData;
}

/**
 * 自适应图表采样
 * 根据数据量自动决定是否采样以及采样点数
 * 
 * @param data 原始数据数组
 * @param threshold 触发采样的数据量阈值（默认500）
 * @param maxPoints 最大采样点数（默认1000）
 * @param xField X轴字段名（默认'date'）
 * @param yField Y轴字段名（默认'value'）
 * @param seriesField 系列字段名（可选）
 * @returns 采样后的数据数组
 */
export function adaptiveChartSampling<T extends { [key: string]: any }>(
  data: T[],
  threshold: number = 500,
  maxPoints: number = 1000,
  xField: string = 'date',
  yField: string = 'value',
  seriesField?: string
): T[] {
  if (!data || data.length === 0) {
    return [];
  }

  // 如果数据量小于阈值，不采样
  if (data.length <= threshold) {
    return data;
  }

  // 使用智能采样
  return smartChartSampling(data, maxPoints, xField, yField, seriesField);
}






