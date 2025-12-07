/**
 * 异常检测服务
 * 使用多种算法检测用户行为数据中的异常
 */

import { Connection, RowDataPacket } from 'mysql2/promise';

export interface Anomaly {
  type: 'pv' | 'uv' | 'event' | 'conversion';
  metric: string;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  description: string;
}

export class AnomalyDetectionService {
  constructor(private db: Connection) {}

  /**
   * 检测指定项目的异常
   */
  async detectAnomalies(
    projectId: string,
    date: string
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // 1. 检测PV异常
    const pvAnomalies = await this.detectPVAnomalies(projectId, date);
    anomalies.push(...pvAnomalies);

    // 2. 检测UV异常
    const uvAnomalies = await this.detectUVAnomalies(projectId, date);
    anomalies.push(...uvAnomalies);

    // 3. 检测事件异常
    const eventAnomalies = await this.detectEventAnomalies(projectId, date);
    anomalies.push(...eventAnomalies);

    return anomalies;
  }

  /**
   * 检测PV异常（使用Z-Score方法）
   */
  private async detectPVAnomalies(
    projectId: string,
    date: string
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // 获取最近30天的PV数据
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT 
        DATE(timestamp) as date,
        COUNT(*) as pv
      FROM events
      WHERE project_id = ?
        AND DATE(timestamp) BETWEEN DATE_SUB(?, INTERVAL 30 DAY) AND ?
      GROUP BY DATE(timestamp)
      ORDER BY date`,
      [projectId, date, date]
    );

    if (rows.length < 7) {
      return anomalies; // 数据不足，无法检测
    }

    const pvValues = rows.map((row: any) => Number(row.pv));
    const todayPV = pvValues[pvValues.length - 1];

    // 计算均值和标准差（排除今天）
    const historicalPV = pvValues.slice(0, -1);
    const mean = historicalPV.reduce((a, b) => a + b, 0) / historicalPV.length;
    const variance = historicalPV.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalPV.length;
    const stdDev = Math.sqrt(variance);

    // 计算Z-Score
    const zScore = stdDev > 0 ? Math.abs((todayPV - mean) / stdDev) : 0;

    // Z-Score > 2 为异常，> 3 为严重异常
    if (zScore > 2) {
      const severity = zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low';
      anomalies.push({
        type: 'pv',
        metric: 'PV',
        value: todayPV,
        expectedValue: mean,
        deviation: zScore,
        severity,
        timestamp: date,
        description: `今日PV ${todayPV}，与历史均值 ${mean.toFixed(0)} 偏差 ${(zScore * 100).toFixed(1)}%`
      });
    }

    return anomalies;
  }

  /**
   * 检测UV异常
   */
  private async detectUVAnomalies(
    projectId: string,
    date: string
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // 获取最近30天的UV数据
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT 
        DATE(timestamp) as date,
        COUNT(DISTINCT user_id) as uv
      FROM events
      WHERE project_id = ?
        AND DATE(timestamp) BETWEEN DATE_SUB(?, INTERVAL 30 DAY) AND ?
      GROUP BY DATE(timestamp)
      ORDER BY date`,
      [projectId, date, date]
    );

    if (rows.length < 7) {
      return anomalies;
    }

    const uvValues = rows.map((row: any) => Number(row.uv));
    const todayUV = uvValues[uvValues.length - 1];

    const historicalUV = uvValues.slice(0, -1);
    const mean = historicalUV.reduce((a, b) => a + b, 0) / historicalUV.length;
    const variance = historicalUV.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalUV.length;
    const stdDev = Math.sqrt(variance);

    const zScore = stdDev > 0 ? Math.abs((todayUV - mean) / stdDev) : 0;

    if (zScore > 2) {
      const severity = zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low';
      anomalies.push({
        type: 'uv',
        metric: 'UV',
        value: todayUV,
        expectedValue: mean,
        deviation: zScore,
        severity,
        timestamp: date,
        description: `今日UV ${todayUV}，与历史均值 ${mean.toFixed(0)} 偏差 ${(zScore * 100).toFixed(1)}%`
      });
    }

    return anomalies;
  }

  /**
   * 检测事件异常（使用3-Sigma规则）
   */
  private async detectEventAnomalies(
    projectId: string,
    date: string
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // 获取所有事件及其最近30天的触发次数
    const [eventRows] = await this.db.execute<RowDataPacket[]>(
      `SELECT 
        event_name,
        DATE(timestamp) as date,
        COUNT(*) as count
      FROM events
      WHERE project_id = ?
        AND DATE(timestamp) BETWEEN DATE_SUB(?, INTERVAL 30 DAY) AND ?
      GROUP BY event_name, DATE(timestamp)
      ORDER BY event_name, date`,
      [projectId, date, date]
    );

    // 按事件分组
    const eventGroups = new Map<string, number[]>();
    eventRows.forEach((row: any) => {
      if (!eventGroups.has(row.event_name)) {
        eventGroups.set(row.event_name, []);
      }
      eventGroups.get(row.event_name)!.push(Number(row.count));
    });

    // 对每个事件检测异常
    for (const [eventName, counts] of eventGroups.entries()) {
      if (counts.length < 7) continue;

      const todayCount = counts[counts.length - 1];
      const historicalCounts = counts.slice(0, -1);

      const mean = historicalCounts.reduce((a, b) => a + b, 0) / historicalCounts.length;
      const variance = historicalCounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalCounts.length;
      const stdDev = Math.sqrt(variance);

      // 3-Sigma规则：超出3个标准差为异常
      const threshold = mean + 3 * stdDev;
      const lowerThreshold = mean - 3 * stdDev;

      if (todayCount > threshold || todayCount < lowerThreshold) {
        const deviation = stdDev > 0 ? Math.abs((todayCount - mean) / stdDev) : 0;
        const severity = deviation > 3 ? 'high' : deviation > 2.5 ? 'medium' : 'low';

        anomalies.push({
          type: 'event',
          metric: eventName,
          value: todayCount,
          expectedValue: mean,
          deviation,
          severity,
          timestamp: date,
          description: `事件 "${eventName}" 今日触发 ${todayCount} 次，与历史均值 ${mean.toFixed(0)} 偏差过大`
        });
      }
    }

    return anomalies;
  }

  /**
   * 使用Isolation Forest检测异常（简化版）
   * 注意：完整版Isolation Forest需要更复杂的实现
   */
  private detectWithIsolationForest(data: number[]): boolean[] {
    // 简化版：使用Z-Score代替
    // 完整版Isolation Forest需要实现树结构和路径长度计算
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    return data.map(value => {
      const zScore = stdDev > 0 ? Math.abs((value - mean) / stdDev) : 0;
      return zScore > 2.5; // 标记为异常
    });
  }

  /**
   * 获取异常检测历史记录
   */
  async getAnomalyHistory(
    projectId: string,
    startDate: string,
    endDate: string
  ): Promise<Anomaly[]> {
    // 这里可以查询存储的异常记录
    // 目前返回空数组，实际应该从数据库查询
    return [];
  }
}



