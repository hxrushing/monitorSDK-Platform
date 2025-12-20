// Node.js 16 需要 fetch polyfill
if (typeof globalThis.fetch === 'undefined') {
  const { default: fetch } = require('node-fetch');
  globalThis.fetch = fetch;
  globalThis.Headers = require('node-fetch').Headers;
  globalThis.Request = require('node-fetch').Request;
  globalThis.Response = require('node-fetch').Response;
}

import express from 'express';
import cors from 'cors';
import { createPool } from 'mysql2/promise';
import { createApiRouter } from './routes/api';
import { SchedulerService } from './services/schedulerService';
import { SummaryService } from './services/summaryService';
import { StatsService } from './services/statsService';
import { AIService } from './services/aiService';
import { EmailService } from './services/emailService';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import path from 'path';

// 加载环境变量 - 明确指定 .env 文件路径
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// 调试：输出数据库配置（不输出密码）
console.log('环境变量加载信息:');
console.log(`  .env 文件路径: ${envPath}`);
console.log(`  当前工作目录: ${process.cwd()}`);
console.log(`  DB_HOST: ${process.env.DB_HOST || '未设置'}`);
console.log(`  DB_PORT: ${process.env.DB_PORT || '3306'}`);
console.log(`  DB_USER: ${process.env.DB_USER || '未设置'}`);
console.log(`  DB_NAME: ${process.env.DB_NAME || '未设置'}`);

async function main() {
  const app = express();
  const port = process.env.PORT || 3000;

  try {
    // 数据库连接池配置
    const dbConfig = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: parseInt(process.env.DB_POOL_LIMIT || '20'),
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    };

    // 调试：输出数据库配置（不输出密码）
    console.log('数据库连接池配置:');
    console.log(`  host: ${dbConfig.host}`);
    console.log(`  port: ${dbConfig.port}`);
    console.log(`  user: ${dbConfig.user}`);
    console.log(`  database: ${dbConfig.database}`);

    const db = createPool(dbConfig);
    console.log('数据库连接池已创建');

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
    // API 文档
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.get('/api/docs.json', (_, res) => res.json(swaggerSpec));

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