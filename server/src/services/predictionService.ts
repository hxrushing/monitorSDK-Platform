import { Connection, RowDataPacket } from 'mysql2/promise';
import axios from 'axios';

export interface PredictionRequest {
  projectId: string;
  metricType: 'pv' | 'uv' | 'conversion_rate';
  modelType: 'lstm' | 'gru';
  days: number;
  startDate?: string;
  endDate?: string;
}

export interface PredictionResult {
  date: string;
  value: number;
}

export interface PredictionResponse {
  success: boolean;
  projectId: string;
  metricType: string;
  modelType: string;
  predictions: PredictionResult[];
  historicalData?: any[];
  modelInfo?: any;
  error?: string;
}

export class PredictionService {
  private mlServiceUrl: string;

  constructor(private db: Connection) {
    // 从环境变量获取ML服务地址，默认使用127.0.0.1避免IPv6/IPv4解析问题
    this.mlServiceUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5000';
  }

  /**
   * 获取历史数据用于预测
   */
  async getHistoricalData(
    projectId: string,
    days: number = 30
  ): Promise<Array<{ date: string; pv: number; uv: number }>> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [rows] = await this.db.execute<RowDataPacket[]>(
        `SELECT 
          DATE(timestamp) as date,
          COUNT(*) as pv,
          COUNT(DISTINCT user_id) as uv
        FROM events
        WHERE project_id = ?
          AND DATE(timestamp) BETWEEN ? AND ?
        GROUP BY DATE(timestamp)
        ORDER BY date ASC`,
        [
          projectId,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        ]
      );

      return rows.map((row: any) => {
        // 确保日期格式为 YYYY-MM-DD
        let dateStr = row.date;
        if (dateStr instanceof Date) {
          dateStr = dateStr.toISOString().split('T')[0];
        } else if (typeof dateStr === 'string') {
          // 如果是字符串，提取日期部分（处理可能的日期时间格式）
          dateStr = dateStr.split('T')[0].split(' ')[0];
        }
        
        return {
          date: dateStr,
          pv: Number(row.pv) || 0,
          uv: Number(row.uv) || 0
        };
      });
    } catch (err: any) {
      console.error('获取历史数据失败:', err);
      throw new Error(`Failed to get historical data: ${err.message}`);
    }
  }

  /**
   * 检查ML服务是否可用
   */
  async checkMLServiceHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.mlServiceUrl}/health`, {
        timeout: 5000,
        // 强制使用IPv4，避免IPv6连接问题
        family: 4,
        // 禁用自动重定向
        maxRedirects: 0
      });
      return response.status === 200;
    } catch (error: any) {
      // 只记录简要错误信息，避免输出大量堆栈
      if (error.code === 'ECONNREFUSED') {
        console.error(`ML服务连接被拒绝，请确保服务已启动在 ${this.mlServiceUrl}`);
      } else if (error.code === 'ETIMEDOUT') {
        console.error(`ML服务连接超时，请检查服务是否正常运行在 ${this.mlServiceUrl}`);
      } else {
        console.error('ML服务不可用:', error.message || error);
      }
      return false;
    }
  }

  /**
   * 预测单个指标
   */
  async predict(
    request: PredictionRequest
  ): Promise<PredictionResponse> {
    try {
      // 获取历史数据
      const historicalData = await this.getHistoricalData(
        request.projectId,
        request.days + 14 // 至少需要14天历史数据
      );

      if (historicalData.length < 14) {
        return {
          success: false,
          projectId: request.projectId,
          metricType: request.metricType,
          modelType: request.modelType,
          predictions: [],
          error: `历史数据不足，至少需要14天，当前只有${historicalData.length}天`
        };
      }

      // 调用ML服务进行预测
      const response = await axios.post(
        `${this.mlServiceUrl}/predict`,
        {
          projectId: request.projectId,
          metricType: request.metricType,
          modelType: request.modelType,
          days: request.days,
          historicalData: historicalData
        },
        {
          timeout: 90000, // 90秒超时，首次预测需要训练模型，可能需要更长时间
          // 强制使用IPv4，避免IPv6连接问题
          family: 4,
          // 禁用自动重定向
          maxRedirects: 0
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('预测失败:', error);
      
      // 如果ML服务不可用，返回错误信息
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return {
          success: false,
          projectId: request.projectId,
          metricType: request.metricType,
          modelType: request.modelType,
          predictions: [],
          error: 'ML预测服务不可用，请确保服务已启动'
        };
      }

      return {
        success: false,
        projectId: request.projectId,
        metricType: request.metricType,
        modelType: request.modelType,
        predictions: [],
        error: error.response?.data?.error || error.message || '预测失败'
      };
    }
  }

  /**
   * 批量预测多个指标
   */
  async predictBatch(
    projectId: string,
    metrics: Array<'pv' | 'uv' | 'conversion_rate'>,
    modelType: 'lstm' | 'gru' = 'lstm',
    days: number = 7
  ): Promise<{
    success: boolean;
    projectId: string;
    modelType: string;
    results: Record<string, PredictionResult[] | null>;
    error?: string;
  }> {
    try {
      // 获取历史数据
      const historicalData = await this.getHistoricalData(
        projectId,
        days + 14
      );

      if (historicalData.length < 14) {
        return {
          success: false,
          projectId,
          modelType,
          results: {},
          error: `历史数据不足，至少需要14天，当前只有${historicalData.length}天`
        };
      }

      // 调用ML服务进行批量预测
      const response = await axios.post(
        `${this.mlServiceUrl}/predict/batch`,
        {
          projectId,
          metrics,
          modelType,
          days,
          historicalData
        },
        {
          timeout: 180000, // 180秒超时，批量预测需要训练多个模型，需要更长时间
          // 强制使用IPv4，避免IPv6连接问题
          family: 4,
          // 禁用自动重定向
          maxRedirects: 0
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('批量预测失败:', error);
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return {
          success: false,
          projectId,
          modelType,
          results: {},
          error: 'ML预测服务不可用，请确保服务已启动'
        };
      }

      return {
        success: false,
        projectId,
        modelType,
        results: {},
        error: error.response?.data?.error || error.message || '批量预测失败'
      };
    }
  }
}

