import { Connection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

export interface EventDefinition {
  id?: string;
  projectId: string;
  eventName: string;
  description: string;
  paramsSchema: Record<string, any>;
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