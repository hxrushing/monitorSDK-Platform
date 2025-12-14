import express from 'express';
import cors from 'cors';
import { createConnection } from 'mysql2/promise';
import { createApiRouter } from './routes/api';
import { SchedulerService } from './services/schedulerService';
import { SummaryService } from './services/summaryService';
import { StatsService } from './services/statsService';
import { AIService } from './services/aiService';
import { EmailService } from './services/emailService';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

async function main() {
  const app = express();
  const port = process.env.PORT || 3000;

  try {
    // 数据库连接配置
    const db = await createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('数据库连接成功');

    // 初始化服务
    const statsService = new StatsService(db);
    const aiService = new AIService();
    const emailService = new EmailService();
    const summaryService = new SummaryService(db, statsService, aiService, emailService);
    
    // 启动定时任务服务
    const schedulerService = new SchedulerService(db, summaryService);
    schedulerService.start();

    // 中间件配置
    // 配置 CORS，允许所有必要的 HTTP 方法和请求头
    app.use(cors({
      origin: true, // 允许所有来源（生产环境应该指定具体域名）
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Content-Type'],
      maxAge: 86400 // 预检请求缓存时间（24小时）
    }));
    
    // 处理 OPTIONS 预检请求
    app.options('*', cors());
    
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // API路由
    app.use('/api', createApiRouter(db, summaryService));

    // 错误处理中间件
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error(err.stack);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    });

    app.listen(port, () => {
      console.log(`服务器运行在端口 ${port}`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

main().catch(console.error); 