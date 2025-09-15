import express from 'express';
import cors from 'cors';
import { createConnection } from 'mysql2/promise';
import { createApiRouter } from './routes/api';
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

    // 中间件配置
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // API路由
    app.use('/api', createApiRouter(db));

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