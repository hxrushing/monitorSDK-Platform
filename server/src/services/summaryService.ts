import { Connection, RowDataPacket } from 'mysql2/promise';
import MarkdownIt from 'markdown-it';
import { StatsService, StatsData } from './statsService';
import { AIService, SummaryData } from './aiService';
import { EmailService } from './emailService';
import { v4 as uuidv4 } from 'uuid';

// 任务进度状态
export interface SummaryTaskProgress {
  taskId: string;
  userId: string;
  status: 'pending' | 'collecting' | 'generating' | 'sending' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep: string;
  totalProjects: number;
  processedProjects: number;
  error?: string;
  startedAt: number;
  updatedAt: number;
}

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

// SSE 监听器类型
type ProgressListener = (progress: SummaryTaskProgress) => void;

export class SummaryService {
  // 任务进度存储（内存存储，生产环境建议使用 Redis）
  private taskProgress: Map<string, SummaryTaskProgress> = new Map();
  // SSE 监听器存储（taskId -> listeners[]）
  private progressListeners: Map<string, Set<ProgressListener>> = new Map();

  constructor(
    private db: Connection,
    private statsService: StatsService,
    private aiService: AIService,
    private emailService: EmailService
  ) {
    // 定期清理过期的任务进度（1小时后）
    setInterval(() => {
      const now = Date.now();
      for (const [taskId, progress] of this.taskProgress.entries()) {
        if (now - progress.updatedAt > 3600000) { // 1小时
          this.taskProgress.delete(taskId);
          this.progressListeners.delete(taskId);
        }
      }
    }, 60000); // 每分钟检查一次
  }

  // 添加进度监听器
  addProgressListener(taskId: string, listener: ProgressListener): () => void {
    if (!this.progressListeners.has(taskId)) {
      this.progressListeners.set(taskId, new Set());
    }
    this.progressListeners.get(taskId)!.add(listener);

    // 返回清理函数
    return () => {
      const listeners = this.progressListeners.get(taskId);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.progressListeners.delete(taskId);
        }
      }
    };
  }

  // 获取任务进度
  getTaskProgress(taskId: string): SummaryTaskProgress | null {
    return this.taskProgress.get(taskId) || null;
  }

  // 初始化任务进度（公开方法，用于在任务开始前初始化）
  initializeTaskProgress(taskId: string, userId: string): void {
    this.updateProgress(taskId, userId, 'pending', 0, '准备开始...', 0, 0);
  }

  // 更新任务进度
  private updateProgress(
    taskId: string,
    userId: string,
    status: SummaryTaskProgress['status'],
    progress: number,
    currentStep: string,
    totalProjects?: number,
    processedProjects?: number,
    error?: string
  ): void {
    const existing = this.taskProgress.get(taskId);
    const now = Date.now();
    
    // 保留到小数点后一位，并确保在 0-100 范围内
    const roundedProgress = Math.round(Math.min(100, Math.max(0, progress)) * 10) / 10;
    
    const progressData: SummaryTaskProgress = {
      taskId,
      userId,
      status,
      progress: roundedProgress,
      currentStep,
      totalProjects: totalProjects ?? existing?.totalProjects ?? 0,
      processedProjects: processedProjects ?? existing?.processedProjects ?? 0,
      error,
      startedAt: existing?.startedAt ?? now,
      updatedAt: now,
    };

    this.taskProgress.set(taskId, progressData);

    // 通知所有监听器
    const listeners = this.progressListeners.get(taskId);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(progressData);
        } catch (error) {
          console.error('通知进度监听器失败:', error);
        }
      });
    }
  }

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

  // 生成并发送总结（支持进度跟踪）
  async generateAndSendSummary(setting: SummarySetting, taskId?: string): Promise<boolean> {
    const currentTaskId = taskId || uuidv4();
    const userId = setting.userId;
    const startTime = Date.now();
    
    try {
      // 如果进度还没有初始化（可能已经在返回 taskId 前初始化了），则初始化
      const existingProgress = this.taskProgress.get(currentTaskId);
      if (!existingProgress) {
        this.updateProgress(currentTaskId, userId, 'pending', 0, '准备开始...');
      }
      
      console.log('开始生成并发送总结:', { userId: setting.userId, email: setting.email, taskId: currentTaskId });
      
      this.updateProgress(currentTaskId, userId, 'collecting', 2, '获取用户邮箱...');
      
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
        this.updateProgress(currentTaskId, userId, 'failed', 0, '获取邮箱失败', 0, 0, '用户没有配置邮箱');
        return false;
      }

      this.updateProgress(currentTaskId, userId, 'collecting', 5, '获取项目列表...');

      // 获取项目列表
      let projectIds: string[] = [];
      const MAX_PROJECTS = parseInt(process.env.AI_MAX_PROJECTS || '50'); // 最多处理的项目数
      
      if (setting.projectIds && Array.isArray(setting.projectIds) && setting.projectIds.length > 0) {
        projectIds = setting.projectIds;
        console.log('使用指定的项目:', projectIds);
      } else {
        // 如果没有指定项目，获取用户的所有项目
        console.log('没有指定项目，获取所有项目');
        const [projectRows] = await this.db.execute<RowDataPacket[]>(
          'SELECT id FROM projects ORDER BY created_at DESC'
        );
        projectIds = (projectRows as RowDataPacket[]).map((row: RowDataPacket) => row.id as string);
        console.log('获取到的所有项目:', projectIds);
      }

      if (projectIds.length === 0) {
        console.log(`用户 ${setting.userId} 没有项目数据`);
        this.updateProgress(currentTaskId, userId, 'failed', 0, '没有项目数据', 0, 0, '用户没有项目数据');
        return false;
      }

      // 限制项目数量，避免数据量过大
      if (projectIds.length > MAX_PROJECTS) {
        console.warn(`项目数量过多（${projectIds.length}），将只处理前 ${MAX_PROJECTS} 个项目`);
        projectIds = projectIds.slice(0, MAX_PROJECTS);
      }

      const totalProjects = projectIds.length;
      // 数据收集阶段：10% - 60%（共 50%）
      const collectStartProgress = 10;
      const collectEndProgress = 60;
      const collectProgressRange = collectEndProgress - collectStartProgress;
      const collectProgressStep = collectProgressRange / totalProjects;
      
      this.updateProgress(currentTaskId, userId, 'collecting', collectStartProgress, `开始收集 ${totalProjects} 个项目的数据...`, totalProjects, 0);

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

      for (let i = 0; i < projectIds.length; i++) {
        const projectId = projectIds[i];
        try {
          // 线性计算每个项目的进度
          const currentProgress = collectStartProgress + (i + 1) * collectProgressStep;
          this.updateProgress(
            currentTaskId,
            userId,
            'collecting',
            Math.min(collectEndProgress, currentProgress),
            `正在收集项目 ${i + 1}/${totalProjects} 的数据...`,
            totalProjects,
            i + 1
          );

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

          // 确保 overview 存在，并且数值类型正确
          const safeOverview = overview || { avgPages: 0, avgDuration: 0 };
          const avgPages = typeof safeOverview.avgPages === 'number' && !isNaN(safeOverview.avgPages) 
            ? safeOverview.avgPages 
            : (typeof safeOverview.avgPages === 'string' ? parseFloat(safeOverview.avgPages) || 0 : 0);
          const avgDuration = typeof safeOverview.avgDuration === 'number' && !isNaN(safeOverview.avgDuration)
            ? safeOverview.avgDuration
            : (typeof safeOverview.avgDuration === 'string' ? parseFloat(safeOverview.avgDuration) || 0 : 0);

          summaryData.push({
            projectId,
            projectName,
            date: dateStr,
            stats: {
              pv: Number(todayStats.pv) || 0,
              uv: Number(todayStats.uv) || 0,
              avgPages,
              avgDuration,
            },
            topEvents: (eventRows as RowDataPacket[]).map((row: RowDataPacket) => ({
              eventName: row.eventName as string,
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
        this.updateProgress(currentTaskId, userId, 'failed', 0, '没有可用数据', totalProjects, totalProjects, '没有可用的数据');
        return false;
      }

      console.log(`收集到 ${summaryData.length} 个项目的数据，开始生成总结`);
      
      // 记录数据量信息
      const totalEvents = summaryData.reduce((sum, p) => sum + p.topEvents.length, 0);
      console.log(`数据统计：${summaryData.length} 个项目，${totalEvents} 个事件记录`);

      // AI 生成阶段：60% - 85%（共 25%）
      const generateStartProgress = 50;
      const generateEndProgress = 85;
      
      // 添加平滑过渡：从收集阶段到生成阶段
      // 获取当前进度，确保平滑过渡
      const currentProgressData = this.taskProgress.get(currentTaskId);
      const currentProgress = currentProgressData?.progress ?? collectEndProgress;
      
      // 如果当前进度小于 50%，先平滑过渡到 50%
      if (currentProgress < generateStartProgress) {
        this.updateProgress(currentTaskId, userId, 'collecting', generateStartProgress, '数据收集完成，准备生成总结...', totalProjects, totalProjects);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // 平滑过渡到生成阶段：50% -> 51% -> 52% -> 53%
      const transitionEndProgress = 53; // 过渡结束时的进度
      const transitionSteps = [51, 52, transitionEndProgress];
      for (const step of transitionSteps) {
        this.updateProgress(currentTaskId, userId, 'generating', step, '正在使用 AI 生成总结...', totalProjects, totalProjects);
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // 使用AI生成总结（Markdown），在生成过程中定期更新进度
      const generateStartTime = Date.now();
      const estimatedGenerateTime = 30000; // 预估生成时间 30 秒
      
      // 记录过渡结束时的进度，作为定时器的起始进度
      const timerStartProgress = transitionEndProgress;
      const timerProgressRange = generateEndProgress - timerStartProgress; // 从 63% 到 85%，共 22%
      
      // 创建一个进度更新定时器，在生成过程中线性更新进度
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - generateStartTime;
        const progressRatio = Math.min(0.9, elapsed / estimatedGenerateTime); // 最多到 90%，等待实际完成
        // 从 timerStartProgress (63%) 开始，线性增长到 generateEndProgress (85%)
        const currentProgress = timerStartProgress + progressRatio * timerProgressRange;
        // 确保进度不会回退，并且不会超过 generateEndProgress - 1
        const finalProgress = Math.max(timerStartProgress, Math.min(generateEndProgress - 1, currentProgress));
        this.updateProgress(
          currentTaskId,
          userId,
          'generating',
          finalProgress,
          '正在使用 AI 生成总结...',
          totalProjects,
          totalProjects
        );
      }, 1000); // 每秒更新一次进度
      
      let summary: string;
      try {
        summary = await this.aiService.generateSummary(summaryData);
        clearInterval(progressInterval);
        
        const duration = Date.now() - generateStartTime;
        console.log(`总结生成完成，长度: ${summary.length} 字符，耗时: ${duration}ms`);
        
        this.updateProgress(currentTaskId, userId, 'generating', generateEndProgress, '总结生成完成，正在准备邮件...', totalProjects, totalProjects);
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
      
      // 使用 markdown-it 渲染为 HTML（兼容 CJS）
      const md = new MarkdownIt({ html: false, linkify: true, breaks: false });
      const summaryHtml = md.render(summary || '');
      
      // 邮件发送阶段：85% - 100%（共 15%）
      const sendStartProgress = 85;
      this.updateProgress(currentTaskId, userId, 'sending', sendStartProgress, '正在发送邮件...', totalProjects, totalProjects);

      // 发送邮件
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 800px; margin: 0 auto; padding: 20px; }
            h1, h2, h3, h4 { color: #1890ff; margin: 16px 0 8px; }
            h3 { color: #52c41a; }
            ul { margin: 10px 0; }
            li { margin: 5px 0; }
            code { background: #f6f8fa; padding: 2px 4px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
            pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow: auto; }
            blockquote { margin: 0; padding: 0 12px; color: #555; border-left: 4px solid #ddd; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            ${summaryHtml}
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
        this.updateProgress(currentTaskId, userId, 'completed', 100, '总结已成功发送到邮箱', totalProjects, totalProjects);
        
        const totalDuration = Date.now() - startTime;
        console.log(`总结生成和发送完成，总耗时: ${totalDuration}ms`);
      } else {
        console.error('邮件发送失败');
        this.updateProgress(currentTaskId, userId, 'failed', 90, '邮件发送失败', totalProjects, totalProjects, '邮件发送失败，请检查邮件配置');
      }
      
      return success;
    } catch (error: any) {
      console.error('生成并发送总结失败:', error);
      console.error('错误堆栈:', error?.stack);
      this.updateProgress(
        currentTaskId,
        userId,
        'failed',
        0,
        '处理失败',
        0,
        0,
        error?.message || '未知错误'
      );
      return false;
    }
  }
}

