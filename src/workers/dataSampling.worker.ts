/**
 * 数据采样 Web Worker
 * 在后台线程中处理大数据采样，避免阻塞主线程
 */

// Worker 中需要复制采样算法，因为不能直接导入模块
// 这里复制了 lttbSampling 和相关辅助函数

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
 * LTTB (Largest-Triangle-Three-Buckets) 采样算法
 * 保持数据趋势特征的采样方法
 */
function lttbSampling<T extends { [key: string]: any }>(
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
 * 简单等间隔采样（备用方案）
 */
function simpleSampling<T>(data: T[], maxPoints: number = 1000): T[] {
  if (data.length <= maxPoints) {
    return data;
  }

  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, index) => index % step === 0);
}

/**
 * 对图表数据进行智能采样
 * 支持多系列数据（通过 seriesField 分组）
 */
function smartChartSampling<T extends { [key: string]: any }>(
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
 */
function adaptiveChartSampling<T extends { [key: string]: any }>(
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

// Worker 消息处理
self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  try {
    let result: any;

    switch (type) {
      case 'lttb':
        result = lttbSampling(
          payload.data,
          payload.maxPoints || 1000,
          payload.xField || 'date',
          payload.yField || 'value'
        );
        break;

      case 'simple':
        result = simpleSampling(
          payload.data,
          payload.maxPoints || 1000
        );
        break;

      case 'smart':
        result = smartChartSampling(
          payload.data,
          payload.maxPoints || 1000,
          payload.xField || 'date',
          payload.yField || 'value',
          payload.seriesField
        );
        break;

      case 'adaptive':
        result = adaptiveChartSampling(
          payload.data,
          payload.threshold || 500,
          payload.maxPoints || 1000,
          payload.xField || 'date',
          payload.yField || 'value',
          payload.seriesField
        );
        break;

      default:
        throw new Error(`Unknown sampling type: ${type}`);
    }

    // 发送处理结果
    self.postMessage({
      success: true,
      type,
      result,
      originalLength: payload.data?.length || 0,
      sampledLength: result?.length || 0
    });
  } catch (error) {
    // 发送错误信息
    self.postMessage({
      success: false,
      type,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
};

// 导出类型（用于类型检查）
export type {};

