import { Connection, RowDataPacket } from 'mysql2/promise';

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

export class StatsService {
  constructor(private db: Connection) {}

  // 获取基础统计数据
  async getStats(query: StatsQuery) {
    try {
      console.log('开始获取基础统计数据:', query);
      const { projectId, startDate, endDate, eventName } = query;
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
      return rows;
    } catch (err: any) {
      console.error('获取统计数据失败:', err);
      throw new Error(`Failed to get stats: ${err.message}`);
    }
  }

  // 获取今日概览数据
  async getDashboardOverview(projectId: string) {
    try {
      console.log('开始获取仪表盘概览数据:', projectId);
      const today = new Date().toISOString().split('T')[0];
      
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

      // 获取平均停留时间（分钟）
      const [avgDuration] = await this.db.execute(
        `SELECT 
          ROUND(AVG(TIMESTAMPDIFF(MINUTE, 
            first_visit.timestamp, 
            last_visit.timestamp
          )), 1) as avg_duration
        FROM (
          SELECT user_id, MIN(timestamp) as timestamp
          FROM events
          WHERE project_id = ? AND DATE(timestamp) = ?
          GROUP BY user_id
        ) first_visit
        JOIN (
          SELECT user_id, MAX(timestamp) as timestamp
          FROM events
          WHERE project_id = ? AND DATE(timestamp) = ?
          GROUP BY user_id
        ) last_visit ON first_visit.user_id = last_visit.user_id`,
        [projectId, today, projectId, today]
      );

      const result = {
        todayPV: (todayStats as any)[0]?.pv || 0,
        todayUV: (todayStats as any)[0]?.uv || 0,
        avgPages: (avgPages as any)[0]?.avg_pages || 0,
        avgDuration: (avgDuration as any)[0]?.avg_duration || 0
      };

      console.log('仪表盘概览数据:', result);
      return result;
    } catch (err: any) {
      console.error('获取仪表盘概览数据失败:', err);
      throw new Error(`Failed to get dashboard overview: ${err.message}`);
    }
  }

  // 获取事件分析数据
  async getEventAnalysis(query: EventAnalysisQuery) {
    try {
      console.log('开始获取事件分析数据:', query);
      const { projectId, startDate, endDate, events } = query;
      
      if (!projectId || !startDate || !endDate || !events || events.length === 0) {
        throw new Error('Missing required parameters');
      }

      // 验证日期格式
      if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
      }

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
      
      return results.map(row => ({
        date: row.timestamp,
        eventName: row.eventName,
        count: Number(row.count),
        users: Number(row.users),
        avgPerUser: row.users > 0 ? Number(row.count) / Number(row.users) : 0
      }));
    } catch (err: any) {
      console.error('获取事件分析数据失败:', err);
      throw new Error(`Failed to get event analysis: ${err.message}`);
    }
  }

  // 获取漏斗分析数据
  async getFunnelAnalysis(query: FunnelQuery): Promise<FunnelStageResult[]> {
    try {
      console.log('开始获取漏斗分析数据:', query);
      const { projectId, startDate, endDate, stages } = query;
      
      if (!projectId || !startDate || !endDate || !stages || stages.length === 0) {
        throw new Error('Missing required parameters');
      }

      // 验证日期格式
      if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
      }

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
      return rows;
    } catch (err: any) {
      console.error('获取Top 5访问项目数据失败:', err);
      throw new Error(`Failed to get top visited projects: ${err.message}`);
    }
  }
} 