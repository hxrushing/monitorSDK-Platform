import { Connection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { cacheManager } from '../utils/cache';

interface EventData {
  projectId: string;
  eventName: string;
  eventParams: Record<string, any>;
  uid?: string;
  deviceInfo: {
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
  };
  timestamp: number;
}

export class TrackingService {
  constructor(private db: Connection) {}

  /**
   * 清除项目相关的所有统计缓存
   * 当有新事件数据插入时调用此方法
   */
  private clearStatsCache(projectId: string): void {
    // 获取所有缓存实例并清除相关键
    const cacheNames = ['stats', 'overview', 'eventAnalysis', 'funnel', 'topProjects', 'performance'];
    
    cacheNames.forEach(cacheName => {
      const cache = cacheManager.getCache<string, any>(cacheName);
      const keysToDelete: string[] = [];
      
      for (const key of cache.keys()) {
        if (key.includes(`projectId:${projectId}`)) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => {
        cache.delete(key);
        console.log(`[缓存失效] 已清除 ${cacheName} 缓存: ${key}`);
      });
    });
  }

  // 批量处理事件
  async trackBatchEvents(batchData: {
    projectId: string;
    events: EventData[];
    batchSize: number;
    timestamp: number;
    uid?: string;
    deviceInfo: any;
    sdkVersion: string;
  }): Promise<{ success: boolean; processedCount: number; failedEvents?: any[] }> {
    try {
      console.log(`开始处理批量事件，数量: ${batchData.events.length}`);

      const failedEvents: any[] = [];
      let processedCount = 0;

      // 使用事务处理批量插入
      await this.db.beginTransaction();

      try {
        for (const eventData of batchData.events) {
          try {
            // 检查事件定义是否存在
            const exists = await this.validateEventDefinition(batchData.projectId, eventData.eventName);
            
            if (!exists) {
              await this.createEventDefinition(batchData.projectId, eventData.eventName);
            }

            // 准备插入数据
            const params = [
              batchData.projectId,
              eventData.eventName,
              JSON.stringify(eventData.eventParams || {}),
              batchData.uid || null,
              JSON.stringify(batchData.deviceInfo || {}),
              new Date(eventData.timestamp || Date.now()).toISOString().slice(0, 19).replace('T', ' ')
            ];

            // 插入事件数据
            await this.db.execute(
              'INSERT INTO events (project_id, event_name, event_params, user_id, device_info, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
              params
            );

            processedCount++;
          } catch (error) {
            console.error(`处理单个事件失败:`, error);
            failedEvents.push(eventData);
          }
        }

        // 提交事务
        await this.db.commit();
        console.log(`批量事件处理完成，成功: ${processedCount}, 失败: ${failedEvents.length}`);

        // 如果有成功插入的事件，清除该项目的统计缓存
        if (processedCount > 0) {
          this.clearStatsCache(batchData.projectId);
        }

        return {
          success: true,
          processedCount,
          failedEvents: failedEvents.length > 0 ? failedEvents : undefined
        };
      } catch (error) {
        // 回滚事务
        await this.db.rollback();
        throw error;
      }
    } catch (err: any) {
      console.error('批量事件处理失败:', err);
      return {
        success: false,
        processedCount: 0,
        failedEvents: batchData.events
      };
    }
  }

  async trackEvent(eventData: EventData): Promise<void> {
    try {
      console.log('开始处理事件追踪:', eventData);

      // 检查必要字段
      if (!eventData.projectId || !eventData.eventName) {
        throw new Error('Missing required fields: projectId or eventName');
      }

      // 检查事件定义是否存在，如果不存在则自动创建
      console.log('验证事件定义...');
      const exists = await this.validateEventDefinition(eventData.projectId, eventData.eventName);
      
      if (!exists) {
        console.log('事件定义不存在，正在创建...');
        await this.createEventDefinition(eventData.projectId, eventData.eventName);
      }

      // 准备插入数据
      const params = [
        eventData.projectId,
        eventData.eventName,
        JSON.stringify(eventData.eventParams || {}),
        eventData.uid || null,
        JSON.stringify(eventData.deviceInfo || {}),
        new Date(eventData.timestamp || Date.now()).toISOString().slice(0, 19).replace('T', ' ')
      ];

      console.log('插入事件数据:', params);

      // 插入事件数据
      await this.db.execute(
        'INSERT INTO events (project_id, event_name, event_params, user_id, device_info, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
        params
      );

      // 清除该项目的统计缓存
      this.clearStatsCache(eventData.projectId);

      console.log('事件追踪完成');
    } catch (err: any) {
      console.error('事件追踪失败:', err);
      console.error('错误详情:', err.stack);
      throw new Error(`Failed to track event: ${err.message}`);
    }
  }

  async validateEventDefinition(projectId: string, eventName: string): Promise<boolean> {
    try {
      console.log('验证事件定义:', { projectId, eventName });
      const [rows]: any = await this.db.execute(
        'SELECT COUNT(*) as count FROM event_definitions WHERE project_id = ? AND event_name = ?',
        [projectId, eventName]
      );
      const exists = rows[0].count > 0;
      console.log('事件定义存在:', exists);
      return exists;
    } catch (err: any) {
      console.error('验证事件定义失败:', err);
      throw new Error(`Failed to validate event definition: ${err.message}`);
    }
  }

  private async createEventDefinition(projectId: string, eventName: string): Promise<void> {
    try {
      console.log('创建事件定义:', { projectId, eventName });
      const id = uuidv4();
      await this.db.execute(
        'INSERT INTO event_definitions (id, project_id, event_name, description, params_schema) VALUES (?, ?, ?, ?, ?)',
        [
          id,
          projectId,
          eventName,
          eventName, // 描述不再添加前缀，直接使用事件名
          '{}'
        ]
      );
      console.log('事件定义创建成功');
    } catch (err: any) {
      console.error('创建事件定义失败:', err);
      throw new Error(`Failed to create event definition: ${err.message}`);
    }
  }

  async getRecentEvents(projectId: string, limit: number = 100): Promise<any[]> {
    try {
      const [rows] = await this.db.execute(
        `SELECT * FROM events 
         WHERE project_id = ? 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [projectId, limit]
      );
      return rows as any[];
    } catch (err: any) {
      console.error('获取最近事件失败:', err);
      throw new Error(`Failed to get recent events: ${err.message}`);
    }
  }
} 