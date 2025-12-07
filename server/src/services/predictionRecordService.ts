import { Connection, RowDataPacket } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

export interface PredictionRecord {
  id: string;
  projectId: string;
  userId?: string;
  metricType: 'pv' | 'uv' | 'conversion_rate';
  modelType: 'lstm' | 'gru';
  predictionDays: number;
  predictions: Array<{ date: string; value: number }>;
  historicalData?: Array<{ date: string; pv: number; uv: number }>;
  modelInfo?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePredictionRecordParams {
  projectId: string;
  userId?: string;
  metricType: 'pv' | 'uv' | 'conversion_rate';
  modelType: 'lstm' | 'gru';
  predictionDays: number;
  predictions: Array<{ date: string; value: number }>;
  historicalData?: Array<{ date: string; pv: number; uv: number }>;
  modelInfo?: any;
}

export interface PredictionRecordQuery {
  projectId?: string;
  userId?: string;
  metricType?: 'pv' | 'uv' | 'conversion_rate';
  modelType?: 'lstm' | 'gru';
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export class PredictionRecordService {
  constructor(private db: Connection) {}

  /**
   * 创建预测记录
   */
  async createRecord(params: CreatePredictionRecordParams): Promise<PredictionRecord> {
    try {
      const id = uuidv4();
      const now = new Date();

      await this.db.execute(
        `INSERT INTO prediction_records 
        (id, project_id, user_id, metric_type, model_type, prediction_days, predictions, historical_data, model_info, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          params.projectId,
          params.userId || null,
          params.metricType,
          params.modelType,
          params.predictionDays,
          JSON.stringify(params.predictions),
          params.historicalData ? JSON.stringify(params.historicalData) : null,
          params.modelInfo ? JSON.stringify(params.modelInfo) : null,
          now,
          now
        ]
      );

      const record = await this.getRecordById(id);
      if (!record) {
        throw new Error('Failed to retrieve created prediction record');
      }
      return record;
    } catch (err: any) {
      console.error('创建预测记录失败:', err);
      throw new Error(`Failed to create prediction record: ${err.message}`);
    }
  }

  /**
   * 根据ID获取预测记录
   */
  async getRecordById(id: string): Promise<PredictionRecord | null> {
    try {
      const [rows] = await this.db.execute<RowDataPacket[]>(
        'SELECT * FROM prediction_records WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToRecord(rows[0]);
    } catch (err: any) {
      console.error('获取预测记录失败:', err);
      throw new Error(`Failed to get prediction record: ${err.message}`);
    }
  }

  /**
   * 查询预测记录列表
   */
  async getRecords(query: PredictionRecordQuery): Promise<{
    records: PredictionRecord[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const offset = (page - 1) * pageSize;

      // 构建查询条件
      const conditions: string[] = [];
      const params: any[] = [];

      if (query.projectId) {
        conditions.push('project_id = ?');
        params.push(query.projectId);
      }

      if (query.userId) {
        conditions.push('user_id = ?');
        params.push(query.userId);
      }

      if (query.metricType) {
        conditions.push('metric_type = ?');
        params.push(query.metricType);
      }

      if (query.modelType) {
        conditions.push('model_type = ?');
        params.push(query.modelType);
      }

      if (query.startDate) {
        conditions.push('created_at >= ?');
        params.push(query.startDate);
      }

      if (query.endDate) {
        conditions.push('created_at <= ?');
        params.push(query.endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 查询总数
      const [countRows] = await this.db.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM prediction_records ${whereClause}`,
        params
      );
      const total = countRows[0]?.total || 0;

      // 查询记录
      const [rows] = await this.db.execute<RowDataPacket[]>(
        `SELECT * FROM prediction_records 
         ${whereClause}
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );

      const records = rows.map(row => this.mapRowToRecord(row));

      return {
        records,
        total: Number(total),
        page,
        pageSize
      };
    } catch (err: any) {
      console.error('查询预测记录失败:', err);
      throw new Error(`Failed to get prediction records: ${err.message}`);
    }
  }

  /**
   * 删除预测记录
   */
  async deleteRecord(id: string, userId?: string): Promise<boolean> {
    try {
      let sql = 'DELETE FROM prediction_records WHERE id = ?';
      const params: any[] = [id];

      // 如果提供了userId，确保只能删除自己的记录
      if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }

      const [result] = await this.db.execute(sql, params);
      return (result as any).affectedRows > 0;
    } catch (err: any) {
      console.error('删除预测记录失败:', err);
      throw new Error(`Failed to delete prediction record: ${err.message}`);
    }
  }

  /**
   * 清理过期记录（可选，用于定期清理）
   */
  async cleanExpiredRecords(daysToKeep: number = 90): Promise<number> {
    try {
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() - daysToKeep);

      const [result] = await this.db.execute(
        'DELETE FROM prediction_records WHERE created_at < ?',
        [expireDate]
      );

      return (result as any).affectedRows;
    } catch (err: any) {
      console.error('清理过期记录失败:', err);
      throw new Error(`Failed to clean expired records: ${err.message}`);
    }
  }

  /**
   * 安全地解析JSON值（处理MySQL可能已经解析的情况）
   */
  private safeParseJson(value: any, defaultValue: any = null): any {
    if (value === null || value === undefined) {
      return defaultValue;
    }
    // 如果已经是对象或数组，直接返回
    if (typeof value === 'object') {
      return value;
    }
    // 如果是字符串，尝试解析
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        console.warn('JSON解析失败，返回默认值:', e);
        return defaultValue;
      }
    }
    return defaultValue;
  }

  /**
   * 将数据库行映射为PredictionRecord对象
   */
  private mapRowToRecord(row: any): PredictionRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id || undefined,
      metricType: row.metric_type,
      modelType: row.model_type,
      predictionDays: row.prediction_days,
      predictions: this.safeParseJson(row.predictions, []),
      historicalData: this.safeParseJson(row.historical_data),
      modelInfo: this.safeParseJson(row.model_info),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}


