import { Connection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

export interface EventDefinition {
  id?: string;
  projectId: string;
  eventName: string;
  description: string;
  paramsSchema: Record<string, any>;
}

// 业务错误类型
export class AppError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class EventDefinitionService {
  constructor(private db: Connection) {}

  // 获取事件定义列表
  async getEventDefinitions(projectId: string) {
    try {
      console.log('正在获取事件定义，项目ID:', projectId);
      
      const [rows] = await this.db.execute(
        'SELECT * FROM event_definitions WHERE project_id = ?',
        [projectId]
      );
      
      console.log('查询结果:', rows);
      
      if (!Array.isArray(rows)) {
        console.error('查询结果不是数组');
        throw new Error('Invalid query result format');
      }

      return (rows as any[]).map(row => {
        try {
          return {
            id: row.id,
            projectId: row.project_id,
            eventName: row.event_name,
            description: row.description,
            paramsSchema: typeof row.params_schema === 'string' 
              ? JSON.parse(row.params_schema)
              : row.params_schema
          };
        } catch (err: any) {
          console.error('解析事件定义失败:', err, row);
          throw new Error(`Failed to parse event definition: ${err.message}`);
        }
      });
    } catch (err: any) {
      console.error('获取事件定义失败:', err);
      throw err;
    }
  }

  // 创建事件定义
  async createEventDefinition(eventDef: EventDefinition) {
    const id = uuidv4();
    try {
      await this.db.execute(
        'INSERT INTO event_definitions (id, project_id, event_name, description, params_schema) VALUES (?, ?, ?, ?, ?)',
        [
          id,
          eventDef.projectId,
          eventDef.eventName,
          eventDef.description,
          JSON.stringify(eventDef.paramsSchema)
        ]
      );
    } catch (err: any) {
      // MySQL 唯一键冲突
      if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
        throw new AppError('DUPLICATE_EVENT_NAME', '事件名称已存在', 409);
      }
      // 外键失败（项目不存在）
      if (err && (err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452)) {
        throw new AppError('PROJECT_NOT_FOUND', '项目不存在或已被删除', 404);
      }
      console.error('创建事件定义失败:', err);
      throw new AppError('CREATE_EVENT_FAILED', '创建事件定义失败', 500);
    }

    return {
      ...eventDef,
      id
    };
  }

  // 更新事件定义
  async updateEventDefinition(id: string, eventDef: EventDefinition) {
    await this.db.execute(
      'UPDATE event_definitions SET event_name = ?, description = ?, params_schema = ? WHERE id = ? AND project_id = ?',
      [
        eventDef.eventName,
        eventDef.description,
        JSON.stringify(eventDef.paramsSchema),
        id,
        eventDef.projectId
      ]
    );

    return {
      ...eventDef,
      id
    };
  }

  // 删除事件定义
  async deleteEventDefinition(id: string, projectId: string) {
    await this.db.execute(
      'DELETE FROM event_definitions WHERE id = ? AND project_id = ?',
      [id, projectId]
    );
  }
} 