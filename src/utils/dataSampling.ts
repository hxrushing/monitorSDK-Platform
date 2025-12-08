/**
 * 智能数据采样工具
 * 用于优化大数据量图表渲染性能
 */

/**
 * LTTB (Largest-Triangle-Three-Buckets) 采样算法
 * 保持数据趋势特征的采样方法
 * 
 * @param data 原始数据数组
 * @param maxPoints 最大采样点数
 * @returns 采样后的数据数组
 */
export function lttbSampling<T extends { [key: string]: any }>(
  data: T[],
  maxPoints: number = 1000,
  xField: string = 'date',
  yField: string = 'value'
): T[] {
  if (data.length <= maxPoints) {
    return data;
  }

  const sampled: T[] = [];
  const bucketSize = (data.length - 2) / (maxPoints - 2);
  let a = 0; // 第一个点索引

  // 总是包含第一个点
  sampled.push(data[0]);

  for (let i = 0; i < maxPoints - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 2) * bucketSize) + 1;
    const rangeEndNext = Math.min(rangeEnd + 1, data.length - 1);

    let avgRangeStart = 0;
    let avgRangeEnd = 0;
    let avgRangeEndNext = 0;
    let avgRangeStartLength = 0;
    let avgRangeEndLength = 0;
    let avgRangeEndNextLength = 0;

    // 计算范围平均值
    for (let j = rangeStart; j < rangeEnd; j++) {
      avgRangeStart += Number(data[j][yField]) || 0;
      avgRangeStartLength++;
    }
    avgRangeStart = avgRangeStart / avgRangeStartLength;

    for (let j = rangeEnd; j < rangeEndNext; j++) {
      avgRangeEnd += Number(data[j][yField]) || 0;
      avgRangeEndLength++;
    }
    avgRangeEnd = avgRangeEnd / avgRangeEndLength;

    for (let j = rangeEndNext; j < Math.min(rangeEndNext + 1, data.length); j++) {
      avgRangeEndNext += Number(data[j][yField]) || 0;
      avgRangeEndNextLength++;
    }
    avgRangeEndNext = avgRangeEndNext / avgRangeEndNextLength;

    // 计算三角形面积，找到最大面积的点
    let maxArea = -1;
    let maxAreaIndex = rangeStart;

    for (let j = rangeStart; j < rangeEnd; j++) {
      const area = Math.abs(
        (Number(data[a][xField]) - avgRangeEndNext) * (Number(data[j][yField]) - Number(data[a][yField])) -
        (Number(data[a][xField]) - Number(data[j][xField])) * (avgRangeEndNext - Number(data[a][yField]))
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










