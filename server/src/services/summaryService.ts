import { Connection, RowDataPacket } from 'mysql2/promise';
import { StatsService, StatsData } from './statsService';
import { AIService, SummaryData } from './aiService';
import { EmailService } from './emailService';
import { v4 as uuidv4 } from 'uuid';

export interface SummarySetting {
  id: string;
  userId: string;
  enabled: boolean;
  sendTime: string;
  email: string | null;
  projectIds: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SummarySettingInput {
  enabled?: boolean;
  sendTime?: string;
  email?: string;
  projectIds?: string[];
}

export class SummaryService {
  constructor(
    private db: Connection,
    private statsService: StatsService,
    private aiService: AIService,
    private emailService: EmailService
  ) {}

  // 获取用户的总结设置
  async getUserSetting(userId: string): Promise<SummarySetting | null> {
    try {
      const [rows] = await this.db.execute<RowDataPacket[]>(
        'SELECT * FROM ai_summary_settings WHERE user_id = ?',
        [userId]
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      let projectIds = null;
      if (row.project_ids) {
        try {
          // MySQL JSON 类型可能返回对象或字符串
          if (typeof row.project_ids === 'string') {
            projectIds = JSON.parse(row.project_ids);
          } else {
            projectIds = row.project_ids;
          }
        } catch (e) {
          console.warn('解析 project_ids 失败:', e);
          projectIds = null;
        }
      }
      
      return {
        id: row.id,
        userId: row.user_id,
        enabled: Boolean(row.enabled),
        sendTime: row.send_time,
        email: row.email,
        projectIds,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error: any) {
      console.error('获取总结设置失败:', error);
      // 如果表不存在，返回 null 而不是抛出错误
      if (error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146) {
        console.warn('ai_summary_settings 表不存在，请先运行数据库初始化脚本');
        return null;
      }
      throw error;
    }
  }

  // 创建或更新总结设置
  async upsertSetting(userId: string, input: SummarySettingInput): Promise<SummarySetting> {
    try {
      console.log('开始保存总结设置:', { userId, input });
      
      // 检查表是否存在
      try {
        await this.db.execute('SELECT 1 FROM ai_summary_settings LIMIT 1');
      } catch (error: any) {
        if (error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146) {
          throw new Error('数据库表 ai_summary_settings 不存在，请先运行数据库初始化脚本 (npm run init-db)');
        }
        throw error;
      }

      const existing = await this.getUserSetting(userId);
      console.log('现有设置:', existing);

      if (existing) {
        // 更新现有设置
        const updates: string[] = [];
        const values: any[] = [];

        if (input.enabled !== undefined) {
          updates.push('enabled = ?');
          values.push(input.enabled ? 1 : 0); // MySQL BOOLEAN 实际上是 TINYINT(1)
        }
        if (input.sendTime !== undefined) {
          updates.push('send_time = ?');
          values.push(input.sendTime);
        }
        if (input.email !== undefined) {
          updates.push('email = ?');
          values.push(input.email || null);
        }
        if (input.projectIds !== undefined) {
          updates.push('project_ids = ?');
          values.push(input.projectIds && input.projectIds.length > 0 ? JSON.stringify(input.projectIds) : null);
        }

        if (updates.length > 0) {
          values.push(userId);
          console.log('执行更新:', { sql: `UPDATE ai_summary_settings SET ${updates.join(', ')} WHERE user_id = ?`, values });
          await this.db.execute(
            `UPDATE ai_summary_settings SET ${updates.join(', ')} WHERE user_id = ?`,
            values
          );
        } else {
          console.log('没有需要更新的字段');
        }

        const result = await this.getUserSetting(userId);
        if (!result) {
          throw new Error('更新后无法获取设置');
        }
        return result;
      } else {
        // 创建新设置
        // 获取用户默认邮箱
        const [userRows] = await this.db.execute<RowDataPacket[]>(
          'SELECT email FROM users WHERE id = ?',
          [userId]
        );
        const defaultEmail = userRows[0]?.email || '';

        const id = uuidv4();
        const insertValues = [
          id,
          userId,
          input.enabled !== undefined ? (input.enabled ? 1 : 0) : 1, // MySQL BOOLEAN 实际上是 TINYINT(1)
          input.sendTime || '09:00:00',
          input.email || defaultEmail || null,
          input.projectIds && input.projectIds.length > 0 ? JSON.stringify(input.projectIds) : null,
        ];
        console.log('执行插入:', { sql: 'INSERT INTO ai_summary_settings', values: insertValues });
        
        await this.db.execute(
          `INSERT INTO ai_summary_settings 
           (id, user_id, enabled, send_time, email, project_ids) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          insertValues
        );

        const result = await this.getUserSetting(userId);
        if (!result) {
          throw new Error('插入后无法获取设置');
        }
        return result;
      }
    } catch (error) {
      console.error('保存总结设置失败:', error);
      throw error;
    }
  }

  // 获取所有启用的设置
  async getEnabledSettings(): Promise<SummarySetting[]> {
    try {
      const [rows] = await this.db.execute<RowDataPacket[]>(
        'SELECT * FROM ai_summary_settings WHERE enabled = TRUE'
      );

      return rows.map((row) => {
        let projectIds = null;
        if (row.project_ids) {
          try {
            // MySQL JSON 类型可能返回对象或字符串
            if (typeof row.project_ids === 'string') {
              projectIds = JSON.parse(row.project_ids);
            } else {
              projectIds = row.project_ids;
            }
          } catch (e) {
            console.warn('解析 project_ids 失败:', e);
            projectIds = null;
          }
        }
        
        return {
          id: row.id,
          userId: row.user_id,
          enabled: Boolean(row.enabled),
          sendTime: row.send_time,
          email: row.email,
          projectIds,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });
    } catch (error) {
      console.error('获取启用的总结设置失败:', error);
      throw error;
    }
  }

  // 生成并发送总结
  async generateAndSendSummary(setting: SummarySetting): Promise<boolean> {
    try {
      console.log('开始生成并发送总结:', { userId: setting.userId, email: setting.email });
      
      // 获取用户邮箱（优先使用设置中的邮箱，否则使用注册邮箱）
      let email = setting.email;
      if (!email) {
        console.log('设置中没有邮箱，尝试从用户表获取');
        const [userRows] = await this.db.execute<RowDataPacket[]>(
          'SELECT email FROM users WHERE id = ?',
          [setting.userId]
        );
        email = userRows[0]?.email;
        console.log('从用户表获取的邮箱:', email);
      }

      if (!email) {
        console.error(`用户 ${setting.userId} 没有配置邮箱`);
        return false;
      }

      // 获取项目列表
      let projectIds: string[] = [];
      if (setting.projectIds && Array.isArray(setting.projectIds) && setting.projectIds.length > 0) {
        projectIds = setting.projectIds;
        console.log('使用指定的项目:', projectIds);
      } else {
        // 如果没有指定项目，获取用户的所有项目
        console.log('没有指定项目，获取所有项目');
        const [projectRows] = await this.db.execute<RowDataPacket[]>(
          'SELECT id FROM projects ORDER BY created_at DESC'
        );
        projectIds = projectRows.map((row) => row.id);
        console.log('获取到的所有项目:', projectIds);
      }

      if (projectIds.length === 0) {
        console.log(`用户 ${setting.userId} 没有项目数据`);
        return false;
      }

      // 获取昨天的日期
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      // 获取前天的日期（用于计算趋势）
      const dayBeforeYesterday = new Date(yesterday);
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
      const prevDateStr = dayBeforeYesterday.toISOString().split('T')[0];

      // 收集所有项目的数据
      const summaryData: SummaryData[] = [];

      for (const projectId of projectIds) {
        try {
          // 获取项目名称
          const [projectRows] = await this.db.execute<RowDataPacket[]>(
            'SELECT name FROM projects WHERE id = ?',
            [projectId]
          );
          const projectName = projectRows[0]?.name || projectId;

          // 获取昨天的统计数据
          const overview = await this.statsService.getDashboardOverview(projectId);
          
          // 获取昨天的详细统计
          const stats = await this.statsService.getStats({
            projectId,
            startDate: dateStr,
            endDate: dateStr,
          });

          // 获取前天的统计数据（用于计算趋势）
          const prevStats = await this.statsService.getStats({
            projectId,
            startDate: prevDateStr,
            endDate: prevDateStr,
          });

          const todayStats = Array.isArray(stats) && stats.length > 0 ? (stats[0] as StatsData) : ({ date: '', pv: 0, uv: 0 } as StatsData);
          const yesterdayStats = Array.isArray(prevStats) && prevStats.length > 0 ? (prevStats[0] as StatsData) : ({ date: '', pv: 0, uv: 0 } as StatsData);

          // 计算趋势
          const pvChange = yesterdayStats.pv > 0 
            ? (todayStats.pv - yesterdayStats.pv) / yesterdayStats.pv
            : 0;
          const uvChange = yesterdayStats.uv > 0 
            ? (todayStats.uv - yesterdayStats.uv) / yesterdayStats.uv
            : 0;

          // 获取热门事件（Top 5）
          const [eventRows] = await this.db.execute<RowDataPacket[]>(
            `SELECT 
              event_name as eventName,
              COUNT(*) as count,
              COUNT(DISTINCT user_id) as users
            FROM events
            WHERE project_id = ? AND DATE(timestamp) = ?
            GROUP BY event_name
            ORDER BY count DESC
            LIMIT 5`,
            [projectId, dateStr]
          );

          summaryData.push({
            projectId,
            projectName,
            date: dateStr,
            stats: {
              pv: Number(todayStats.pv) || 0,
              uv: Number(todayStats.uv) || 0,
              avgPages: overview.avgPages || 0,
              avgDuration: overview.avgDuration || 0,
            },
            topEvents: eventRows.map((row) => ({
              eventName: row.eventName,
              count: Number(row.count),
              users: Number(row.users),
            })),
            trends: {
              pvChange,
              uvChange,
            },
          });
        } catch (error) {
          console.error(`获取项目 ${projectId} 数据失败:`, error);
        }
      }

      if (summaryData.length === 0) {
        console.log(`用户 ${setting.userId} 没有可用的数据`);
        return false;
      }

      console.log(`收集到 ${summaryData.length} 个项目的数据，开始生成总结`);

      // 使用AI生成总结
      const summary = await this.aiService.generateSummary(summaryData);
      console.log('总结生成完成，长度:', summary.length);

      // 发送邮件
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 800px; margin: 0 auto; padding: 20px; }
            h2 { color: #1890ff; }
            h3 { color: #52c41a; margin-top: 20px; }
            ul { margin: 10px 0; }
            li { margin: 5px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            ${summary}
            <div class="footer">
              <p>此邮件由系统自动发送，请勿回复。</p>
              <p>如需修改设置，请登录系统进行配置。</p>
            </div>
          </div>
        </body>
        </html>
      `;

      console.log('准备发送邮件到:', email);
      const success = await this.emailService.sendEmail({
        to: email,
        subject: `每日数据总结 - ${dateStr}`,
        html,
      });

      if (success) {
        console.log('邮件发送成功');
      } else {
        console.error('邮件发送失败');
      }
      
      return success;
    } catch (error: any) {
      console.error('生成并发送总结失败:', error);
      console.error('错误堆栈:', error?.stack);
      return false;
    }
  }
}

