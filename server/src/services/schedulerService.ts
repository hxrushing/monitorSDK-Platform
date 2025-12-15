import * as cron from 'node-cron';
import { Connection, Pool } from 'mysql2/promise';
import { SummaryService } from './summaryService';
import { StatsService } from './statsService';
import { AIService } from './aiService';
import { EmailService } from './emailService';

export class SchedulerService {
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  constructor(
    private db: Connection | Pool,
    private summaryService: SummaryService
  ) {}

  // 启动调度服务
  start() {
    console.log('启动定时任务服务...');
    
    // 每分钟检查一次需要发送总结的用户
    cron.schedule('* * * * *', async () => {
      await this.checkAndSendSummaries();
    });

    console.log('定时任务服务已启动');
  }

  // 检查并发送总结
  private async checkAndSendSummaries() {
    try {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;

      // 获取所有启用的设置
      const settings = await this.summaryService.getEnabledSettings();

      for (const setting of settings) {
        // 检查是否到了发送时间
        if (setting.sendTime === currentTime) {
          console.log(`开始为用户 ${setting.userId} 生成并发送总结...`);
          await this.summaryService.generateAndSendSummary(setting);
        }
      }
    } catch (error) {
      console.error('检查并发送总结失败:', error);
    }
  }

  // 停止调度服务
  stop() {
    this.tasks.forEach((task) => task.stop());
    this.tasks.clear();
    console.log('定时任务服务已停止');
  }
}

