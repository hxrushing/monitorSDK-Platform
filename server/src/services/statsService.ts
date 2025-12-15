import { Connection, Pool, RowDataPacket } from 'mysql2/promise';
import { cacheManager } from '../utils/cache';

type DBClient = Connection | Pool;

export interface StatsQuery {
  projectId: string;
  startDate: string;
  endDate: string;
  eventName?: string;
}

export interface StatsData extends RowDataPacket {
  date: string;
  pv: number;
  uv: number;
}

export interface EventAnalysisQuery extends StatsQuery {
  events: string[];
}

export interface FunnelQuery extends StatsQuery {
  stages: string[];
}

interface FunnelStageResult {
  stage: string;
  value: number;
  rate: number | null;
  change: number;
}

interface EventAnalysisRow extends RowDataPacket {
  date: string;
  eventName: string;
  count: number;
  users: number;
}

interface FunnelAnalysisRow extends RowDataPacket {
  value: number;
  total: number;
}

export interface PerformanceAnalysisQuery {
  projectId: string;
  startDate: string;
  endDate: string;
  metrics: string[];
}

interface PerformanceAnalysisRow extends RowDataPacket {
  date: string;
  metricName: string;
  avgValue: number;
  p50: number;
  p75: number;
  p95: number;
  goodCount: number;
  totalCount: number;
}

export interface PerformanceAnalysisQuery {
  projectId: string;
  startDate: string;
  endDate: string;
  metrics: string[];
}

interface PerformanceAnalysisRow extends RowDataPacket {
  date: string;
  metricName: string;
  avgValue: number;
  p50: number;
  p75: number;
  p95: number;
  goodCount: number;
  totalCount: number;
}

export class StatsService {
  // 缓存实例
  private statsCache = cacheManager.getCache<string, StatsData[]>(
    'stats',
    500, // 最大500条缓存
    2 * 60 * 1000 // 2分钟过期（统计数据变化较快）
  );

  private overviewCache = cacheManager.getCache<string, any>(
    'overview',
    200, // 最大200条缓存
    1 * 60 * 1000 // 1分钟过期（概览数据需要更实时）
  );

  private eventAnalysisCache = cacheManager.getCache<string, any[]>(
    'eventAnalysis',
    300, // 最大300条缓存
    2 * 60 * 1000 // 2分钟过期
  );

  private funnelCache = cacheManager.getCache<string, FunnelStageResult[]>(
    'funnel',
    200, // 最大200条缓存
    3 * 60 * 1000 // 3分钟过期（漏斗分析计算复杂，缓存时间稍长）
  );

  private topProjectsCache = cacheManager.getCache<string, any[]>(
    'topProjects',
    100, // 最大100条缓存
    5 * 60 * 1000 // 5分钟过期（Top项目变化较慢）
  );

  private performanceCache = cacheManager.getCache<string, any>(
    'performance',
    200, // 最大200条缓存
    3 * 60 * 1000 // 3分钟过期（性能分析计算复杂）
  );

  constructor(private db: DBClient) {}

  /**
   * 生成缓存键
   */
  private generateCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    return `${prefix}:${sortedParams}`;
  }

  /**
   * 清除项目相关的所有缓存（当有新事件数据时调用）
   */
  clearProjectCache(projectId: string): void {
    // 清除该项目的所有相关缓存
    // 由于缓存键包含projectId，我们需要遍历所有键来清除
    const caches = [
      this.statsCache,
      this.overviewCache,
      this.eventAnalysisCache,
      this.funnelCache,
      this.topProjectsCache,
      this.performanceCache,
    ];

    caches.forEach(cache => {
      const keysToDelete: string[] = [];
      for (const key of cache.keys()) {
        if (key.includes(`projectId:${projectId}`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => cache.delete(key));
    });

    console.log(`已清除项目 ${projectId} 的所有缓存`);
  }

  // 获取基础统计数据
  async getStats(query: StatsQuery) {
    try {
      const { projectId, startDate, endDate, eventName } = query;
      
      // 生成缓存键
      const cacheKey = this.generateCacheKey('stats', {
        projectId,
        startDate,
        endDate,
        eventName: eventName || '',
      });

      // 尝试从缓存获取
      const cached = this.statsCache.get(cacheKey);
      if (cached) {
        console.log(`[缓存命中] 基础统计数据: ${cacheKey}`);
        return cached;
      }

      console.log('开始获取基础统计数据:', query);
      const params = [projectId, startDate, endDate];

      let sql = `
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as pv,
          COUNT(DISTINCT user_id) as uv
        FROM events
        WHERE project_id = ?
          AND DATE(timestamp) BETWEEN ? AND ?
      `;

      if (eventName) {
        sql += ' AND event_name = ?';
        params.push(eventName);
      }

      sql += ' GROUP BY DATE(timestamp) ORDER BY date';

      console.log('执行SQL查询:', sql);
      console.log('查询参数:', params);

      const [rows] = await this.db.execute<StatsData[]>(sql, params);
      console.log('查询结果:', rows);
      
      // 存入缓存
      this.statsCache.set(cacheKey, rows as StatsData[]);
      console.log(`[缓存存储] 基础统计数据: ${cacheKey}`);
      
      return rows;
    } catch (err: any) {
      console.error('获取统计数据失败:', err);
      throw new Error(`Failed to get stats: ${err.message}`);
    }
  }

  // 获取今日概览数据
  async getDashboardOverview(projectId: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 生成缓存键（包含日期，确保每天的数据独立缓存）
      const cacheKey = this.generateCacheKey('overview', {
        projectId,
        date: today,
      });

      // 尝试从缓存获取
      const cached = this.overviewCache.get(cacheKey);
      if (cached) {
        console.log(`[缓存命中] 仪表盘概览数据: ${cacheKey}`);
        return cached;
      }

      console.log('开始获取仪表盘概览数据:', projectId);
      
      // 获取今日PV和UV
      const [todayStats] = await this.db.execute(
        `SELECT 
          COUNT(*) as pv,
          COUNT(DISTINCT user_id) as uv
        FROM events
        WHERE project_id = ?
          AND DATE(timestamp) = ?`,
        [projectId, today]
      );

      // 获取人均访问页面数
      const [avgPages] = await this.db.execute(
        `SELECT 
          ROUND(COUNT(*) / NULLIF(COUNT(DISTINCT user_id), 0), 2) as avg_pages
        FROM events
        WHERE project_id = ?
          AND event_name = 'pageview'
          AND DATE(timestamp) = ?`,
        [projectId, today]
      );

      // 获取平均停留时间（分钟）- 优化版本，使用更简单的查询
      // 对于大数据量，这个查询可能很慢，使用简化版本
      const [avgDuration] = await this.db.execute(
        `SELECT 
          ROUND(AVG(duration_minutes), 1) as avg_duration
        FROM (
          SELECT 
            user_id,
            TIMESTAMPDIFF(MINUTE, MIN(timestamp), MAX(timestamp)) as duration_minutes
          FROM events
          WHERE project_id = ? AND DATE(timestamp) = ?
          GROUP BY user_id
          HAVING duration_minutes > 0
        ) user_durations`,
        [projectId, today]
      );

      const result = {
        todayPV: (todayStats as any)[0]?.pv || 0,
        todayUV: (todayStats as any)[0]?.uv || 0,
        avgPages: (avgPages as any)[0]?.avg_pages || 0,
        avgDuration: (avgDuration as any)[0]?.avg_duration || 0
      };

      console.log('仪表盘概览数据:', result);
      
      // 存入缓存
      this.overviewCache.set(cacheKey, result);
      console.log(`[缓存存储] 仪表盘概览数据: ${cacheKey}`);
      
      return result;
    } catch (err: any) {
      console.error('获取仪表盘概览数据失败:', err);
      throw new Error(`Failed to get dashboard overview: ${err.message}`);
    }
  }

  // 获取事件分析数据
  async getEventAnalysis(query: EventAnalysisQuery) {
    try {
      const { projectId, startDate, endDate, events } = query;
      
      if (!projectId || !startDate || !endDate || !events || events.length === 0) {
        throw new Error('Missing required parameters');
      }

      // 验证日期格式
      if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
      }

      // 生成缓存键（事件列表需要排序以确保一致性）
      const sortedEvents = [...events].sort().join(',');
      const cacheKey = this.generateCacheKey('eventAnalysis', {
        projectId,
        startDate,
        endDate,
        events: sortedEvents,
      });

      // 尝试从缓存获取
      const cached = this.eventAnalysisCache.get(cacheKey);
      if (cached) {
        console.log(`[缓存命中] 事件分析数据: ${cacheKey}`);
        return cached;
      }

      console.log('开始获取事件分析数据:', query);

      // 构建SQL查询
      const placeholders = events.map(() => '?').join(',');
      const sql = `
        SELECT 
          DATE_FORMAT(CONVERT_TZ(timestamp, '+00:00', '+08:00'), '%Y-%m-%d %H:00:00') as timestamp,
          event_name as eventName,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as users
        FROM events
        WHERE project_id = ?
          AND DATE(CONVERT_TZ(timestamp, '+00:00', '+08:00')) BETWEEN ? AND ?
          AND event_name IN (${placeholders})
        GROUP BY DATE_FORMAT(CONVERT_TZ(timestamp, '+00:00', '+08:00'), '%Y-%m-%d %H:00:00'), event_name
        ORDER BY timestamp ASC, event_name
      `;

      const params = [projectId, startDate, endDate, ...events];
      console.log('执行SQL查询:', sql);
      console.log('查询参数:', params);

      const [rows] = await this.db.execute<EventAnalysisRow[]>(sql, params);
      console.log('查询结果:', rows);

      // 确保返回的是数组
      const results = Array.isArray(rows) ? rows : [];
      
      const mappedResults = results.map(row => ({
        date: row.timestamp,
        eventName: row.eventName,
        count: Number(row.count),
        users: Number(row.users),
        avgPerUser: row.users > 0 ? Number(row.count) / Number(row.users) : 0
      }));

      // 存入缓存
      this.eventAnalysisCache.set(cacheKey, mappedResults);
      console.log(`[缓存存储] 事件分析数据: ${cacheKey}`);

      return mappedResults;
    } catch (err: any) {
      console.error('获取事件分析数据失败:', err);
      throw new Error(`Failed to get event analysis: ${err.message}`);
    }
  }

  // 获取漏斗分析数据
  async getFunnelAnalysis(query: FunnelQuery): Promise<FunnelStageResult[]> {
    try {
      const { projectId, startDate, endDate, stages } = query;
      
      if (!projectId || !startDate || !endDate || !stages || stages.length === 0) {
        throw new Error('Missing required parameters');
      }

      // 验证日期格式
      if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
      }

      // 生成缓存键（阶段列表需要排序以确保一致性）
      const sortedStages = [...stages].sort().join(',');
      const cacheKey = this.generateCacheKey('funnel', {
        projectId,
        startDate,
        endDate,
        stages: sortedStages,
      });

      // 尝试从缓存获取
      const cached = this.funnelCache.get(cacheKey);
      if (cached) {
        console.log(`[缓存命中] 漏斗分析数据: ${cacheKey}`);
        return cached;
      }

      console.log('开始获取漏斗分析数据:', query);

      // 为每个阶段获取用户数
      const results: FunnelStageResult[] = [];
      
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        
        // 获取当前阶段的用户数
        const [rows] = await this.db.execute<FunnelAnalysisRow[]>(
          `SELECT 
            COUNT(DISTINCT user_id) as value,
            COUNT(*) as total
          FROM events
          WHERE project_id = ?
            AND event_name = ?
            AND DATE(timestamp) BETWEEN ? AND ?`,
          [projectId, stage, startDate, endDate]
        );

        const value = Number(rows[0]?.value || 0);
        
        // 计算转化率
        let rate: number | null = null;
        if (i > 0 && results[i - 1]) {
          const prevValue = results[i - 1].value;
          rate = prevValue > 0 ? (value / prevValue) : 0;
        }

        // 获取环比数据
        const prevStartDate = new Date(startDate);
        const prevEndDate = new Date(endDate);
        const days = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
        prevStartDate.setDate(prevStartDate.getDate() - days);
        prevEndDate.setDate(prevEndDate.getDate() - days);

        const [prevRows] = await this.db.execute<FunnelAnalysisRow[]>(
          `SELECT 
            COUNT(DISTINCT user_id) as value
          FROM events
          WHERE project_id = ?
            AND event_name = ?
            AND DATE(timestamp) BETWEEN ? AND ?`,
          [
            projectId,
            stage,
            prevStartDate.toISOString().split('T')[0],
            prevEndDate.toISOString().split('T')[0]
          ]
        );

        const prevValue = Number(prevRows[0]?.value || 0);
        const change = prevValue > 0 ? ((value - prevValue) / prevValue) : 0;

        results.push({
          stage,
          value,
          rate,
          change
        });
      }

      console.log('漏斗分析结果:', results);
      
      // 存入缓存
      this.funnelCache.set(cacheKey, results);
      console.log(`[缓存存储] 漏斗分析数据: ${cacheKey}`);
      
      return results;
    } catch (err: any) {
      console.error('获取漏斗分析数据失败:', err);
      throw new Error(`Failed to get funnel analysis: ${err.message}`);
    }
  }

  // 验证日期格式
  private isValidDate(dateStr: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  }

  // 获取Top 5访问项目
  async getTopVisitedProjects(projectId: string, startDate: string, endDate: string) {
    try {
      // 生成缓存键
      const cacheKey = this.generateCacheKey('topProjects', {
        projectId,
        startDate,
        endDate,
      });

      // 尝试从缓存获取
      const cached = this.topProjectsCache.get(cacheKey);
      if (cached) {
        console.log(`[缓存命中] Top 5访问项目数据: ${cacheKey}`);
        return cached;
      }

      console.log('开始获取Top 5访问项目数据:', { projectId, startDate, endDate });
      
      const sql = `
        SELECT 
          p.name as projectName,
          COUNT(*) as visitCount,
          COUNT(DISTINCT e.user_id) as uniqueVisitors
        FROM events e
        JOIN projects p ON e.project_id = p.id
        WHERE e.project_id = ?
          AND DATE(e.timestamp) BETWEEN ? AND ?
        GROUP BY p.id, p.name
        ORDER BY visitCount DESC
        LIMIT 5
      `;

      const [rows] = await this.db.execute(sql, [projectId, startDate, endDate]);
      console.log('Top 5访问项目数据:', rows);
      
      // 存入缓存
      this.topProjectsCache.set(cacheKey, rows as any[]);
      console.log(`[缓存存储] Top 5访问项目数据: ${cacheKey}`);
      
      return rows;
    } catch (err: any) {
      console.error('获取Top 5访问项目数据失败:', err);
      throw new Error(`Failed to get top visited projects: ${err.message}`);
    }
  }

  // 获取性能分析数据
  async getPerformanceAnalysis(query: PerformanceAnalysisQuery) {
    try {
      const { projectId, startDate, endDate, metrics } = query;
      
      if (!projectId || !startDate || !endDate || !metrics || metrics.length === 0) {
        throw new Error('Missing required parameters');
      }

      // 验证日期格式
      if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
      }

      // 生成缓存键（指标列表需要排序以确保一致性）
      const sortedMetrics = [...metrics].sort().join(',');
      const cacheKey = this.generateCacheKey('performance', {
        projectId,
        startDate,
        endDate,
        metrics: sortedMetrics,
      });

      // 尝试从缓存获取
      const cached = this.performanceCache.get(cacheKey);
      if (cached) {
        console.log(`[缓存命中] 性能分析数据: ${cacheKey}`);
        return cached;
      }

      console.log('开始获取性能分析数据:', query);

      // 性能指标阈值
      const thresholds: Record<string, { good: number; needsImprovement: number }> = {
        FCP: { good: 1800, needsImprovement: 3000 },
        LCP: { good: 2500, needsImprovement: 4000 },
        CLS: { good: 0.1, needsImprovement: 0.25 },
        TTFB: { good: 800, needsImprovement: 1800 },
        INP: { good: 200, needsImprovement: 500 },
      };

      const placeholders = metrics.map(() => '?').join(',');
      
      // 查询性能数据（从web_vitals事件中提取）
      // 先获取所有符合条件的性能事件
      const fetchSql = `
        SELECT 
          id,
          DATE(timestamp) as date,
          event_params
        FROM events
        WHERE project_id = ?
          AND event_name = 'web_vitals'
          AND DATE(timestamp) BETWEEN ? AND ?
      `;

      const [allRows] = await this.db.execute<any[]>(fetchSql, [projectId, startDate, endDate]);
      
      // 在内存中处理数据
      const metricDataMap = new Map<string, Map<string, {
        values: number[];
        ratings: string[];
      }>>();

      allRows.forEach((row: any) => {
        try {
          const params = typeof row.event_params === 'string' 
            ? JSON.parse(row.event_params) 
            : row.event_params;
          
          const metricName = params['指标名称'];
          const metricValue = Number(params['指标值']) || 0;
          const rating = params['评级'] || 'unknown';
          const date = String(row.date);

          if (!metrics.includes(metricName)) {
            return;
          }

          if (!metricDataMap.has(metricName)) {
            metricDataMap.set(metricName, new Map());
          }

          const dateMap = metricDataMap.get(metricName)!;
          if (!dateMap.has(date)) {
            dateMap.set(date, { values: [], ratings: [] });
          }

          const data = dateMap.get(date)!;
          data.values.push(metricValue);
          data.ratings.push(rating);
        } catch (err) {
          console.warn('解析性能事件数据失败:', err);
        }
      });

      // 计算统计数据
      const details: any[] = [];
      metricDataMap.forEach((dateMap, metricName) => {
        dateMap.forEach((data, date) => {
          const sortedValues = [...data.values].sort((a, b) => a - b);
          const count = sortedValues.length;
          const avgValue = count > 0 
            ? sortedValues.reduce((sum, val) => sum + val, 0) / count 
            : 0;
          const p50 = count > 0 ? sortedValues[Math.floor(count * 0.5)] : 0;
          const p75 = count > 0 ? sortedValues[Math.floor(count * 0.75)] : 0;
          const p95 = count > 0 ? sortedValues[Math.floor(count * 0.95)] : 0;
          const goodCount = data.ratings.filter(r => r === 'good').length;
          const goodRate = count > 0 ? goodCount / count : 0;

          details.push({
            date,
            metricName,
            avgValue,
            p50,
            p75,
            p95,
            goodRate,
            totalCount: count,
          });
        });
      });

      details.sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        return a.metricName.localeCompare(b.metricName);
      });

      console.log('性能分析处理完成，详情数量:', details.length);

      // 计算汇总数据
      const summaryMap = new Map<string, {
        metricName: string;
        totalValue: number;
        totalGood: number;
        totalCount: number;
      }>();

      details.forEach(detail => {
        const existing = summaryMap.get(detail.metricName) || {
          metricName: detail.metricName,
          totalValue: 0,
          totalGood: 0,
          totalCount: 0,
        };
        existing.totalValue += detail.avgValue * detail.totalCount;
        existing.totalGood += detail.goodRate * detail.totalCount;
        existing.totalCount += detail.totalCount;
        summaryMap.set(detail.metricName, existing);
      });

      const summary = Array.from(summaryMap.values()).map(item => {
        const avgValue = item.totalCount > 0 ? item.totalValue / item.totalCount : 0;
        const goodRate = item.totalCount > 0 ? item.totalGood / item.totalCount : 0;
        const threshold = thresholds[item.metricName] || { good: 0, needsImprovement: 0 };
        
        let rating: 'good' | 'needs-improvement' | 'poor' = 'good';
        if (item.metricName === 'CLS') {
          rating = avgValue <= threshold.good ? 'good' : avgValue <= threshold.needsImprovement ? 'needs-improvement' : 'poor';
        } else {
          rating = avgValue <= threshold.good ? 'good' : avgValue <= threshold.needsImprovement ? 'needs-improvement' : 'poor';
        }

        return {
          metricName: item.metricName,
          avgValue,
          goodRate,
          totalCount: item.totalCount,
          rating,
        };
      });

      const result = {
        summary,
        details,
      };

      // 存入缓存
      this.performanceCache.set(cacheKey, result);
      console.log(`[缓存存储] 性能分析数据: ${cacheKey}`);

      return result;
    } catch (err: any) {
      console.error('获取性能分析数据失败:', err);
      throw new Error(`Failed to get performance analysis: ${err.message}`);
    }
  }
} 