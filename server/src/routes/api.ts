import express from 'express';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { StatsService } from '../services/statsService';
import { EventDefinitionService, AppError } from '../services/eventDefinitionService';
import { TrackingService } from '../services/trackingService';
import { UserService } from '../services/userService';
import { SummaryService } from '../services/summaryService';
import { PredictionService } from '../services/predictionService';
import { PredictionRecordService } from '../services/predictionRecordService';
import { Connection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

export function createApiRouter(db: Connection, summaryService?: SummaryService) {
  const router = express.Router();
  const statsService = new StatsService(db);
  const eventDefinitionService = new EventDefinitionService(db);
  const trackingService = new TrackingService(db);
  const userService = new UserService(db);
  const predictionService = new PredictionService(db);
  const predictionRecordService = new PredictionRecordService(db);

  const JWT_SECRET: Secret = process.env.JWT_SECRET || 'dev-secret';
  const JWT_EXPIRES_IN: SignOptions['expiresIn'] = (process.env.JWT_EXPIRES_IN as any) || '7d';

  // 简单鉴权中间件：校验 Bearer Token
  const authMiddleware: express.RequestHandler = (req, res, next) => {
    try {
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!token) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const payload = jwt.verify(token, JWT_SECRET) as { sub: string; username: string; role: string };
      (req as any).user = payload;
      next();
    } catch (e) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  };

  // 用户登录（公开）
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: '用户名和密码不能为空'
        });
      }

      const result = await userService.login(username, password);
      if (result.success && result.user) {
        const payload = { sub: result.user.id, username: result.user.username, role: result.user.role };
        const signOptions: SignOptions = { expiresIn: JWT_EXPIRES_IN };
        const token = jwt.sign(payload, JWT_SECRET, signOptions);
        return res.json({ ...result, token });
      }
      res.json(result);
    } catch (error) {
      console.error('登录失败:', error);
      res.status(500).json({
        success: false,
        error: '登录失败，请稍后重试'
      });
    }
  });

  // 用户注册（公开）
  router.post('/register', async (req, res) => {
    try {
      const { username, password, email } = req.body;
      
      if (!username || !password || !email) {
        return res.status(400).json({
          success: false,
          error: '请填写完整的注册信息'
        });
      }

      const result = await userService.register(username, password, email);
      res.json(result);
    } catch (error) {
      console.error('注册失败:', error);
      res.status(500).json({
        success: false,
        error: '注册失败，请稍后重试'
      });
    }
  });

  // 事件追踪接口（不需要认证，因为SDK可能没有token）
  router.post('/track', async (req, res) => {
    try {
      const eventData = req.body;
      
      // 检查是否是批量事件
      if (eventData.events && Array.isArray(eventData.events)) {
        // 批量事件处理
        const result = await trackingService.trackBatchEvents(eventData);
        res.status(200).json(result);
      } else {
        // 单个事件处理（向后兼容）
        await trackingService.trackEvent(eventData);
        res.status(200).json({ success: true });
      }
    } catch (error) {
      console.error('Error tracking event:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  // 从这里开始的路由均需要鉴权
  router.use(authMiddleware);

  // 获取用户列表
  router.get('/users', async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT id, username, email, role, created_at, updated_at FROM users ORDER BY created_at DESC');
      res.json({ success: true, data: rows });
    } catch (error: any) {
      console.error('获取用户列表失败:', error);
      // 常见错误识别
      const code = error?.code || error?.errno;
      if (code === 'ER_NO_SUCH_TABLE' || code === 1146) {
        return res.status(500).json({ success: false, error: "数据库缺少表 'users'，请先执行初始化脚本或运行建表 SQL", code, message: error?.message });
      }
      if (code === 'ER_ACCESS_DENIED_ERROR' || code === 1045) {
        return res.status(500).json({ success: false, error: '数据库访问被拒绝，请检查 server/.env 中数据库账号与权限', code, message: error?.message });
      }
      return res.status(500).json({ success: false, error: 'Internal Server Error', code, message: error?.message });
    }
  });

  // 更新用户角色
  router.put('/users/:id/role', async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body || {};
      if (role !== 'Admin' && role !== 'User') {
        return res.status(400).json({ success: false, error: '角色值不合法' });
      }
      await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, id]);
      res.json({ success: true });
    } catch (error) {
      console.error('更新用户角色失败:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  // 获取事件定义列表
  router.get('/event-definitions', async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Project ID is required' 
        });
      }

      const events = await eventDefinitionService.getEventDefinitions(projectId);
      res.json({ success: true, data: events });
    } catch (error) {
      console.error('Error getting event definitions:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  // 创建事件定义
  router.post('/event-definitions', async (req, res) => {
    try {
      const { projectId, eventName, description, paramsSchema } = req.body || {};
      if (!projectId || !eventName || !description || paramsSchema == null) {
        return res.status(400).json({ success: false, code: 'INVALID_PARAMS', error: '缺少必要参数' });
      }
      if (typeof eventName !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(eventName)) {
        return res.status(400).json({ success: false, code: 'INVALID_EVENT_NAME', error: '事件名称格式不正确' });
      }

      const data = await eventDefinitionService.createEventDefinition(req.body);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      console.error('Error creating event definition:', error);
      if (error instanceof AppError) {
        return res.status(error.status).json({ success: false, code: error.code, error: error.message });
      }
      res.status(500).json({ success: false, code: 'INTERNAL_ERROR', error: 'Internal Server Error' });
    }
  });

  // 更新事件定义
  router.put('/event-definitions/:id', async (req, res) => {
    try {
      const data = await eventDefinitionService.updateEventDefinition(
        req.params.id,
        req.body
      );
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error updating event definition:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  // 删除事件定义
  router.delete('/event-definitions/:id', async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Project ID is required' 
        });
      }

      await eventDefinitionService.deleteEventDefinition(req.params.id, projectId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting event definition:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  // 获取事件分析数据
  router.get('/events/analysis', async (req, res) => {
    try {
      const params = {
        projectId: req.query.projectId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        events: (req.query.events as string).split(',').filter(Boolean)
      };

      console.log('接收到事件分析请求:', params);

      if (!params.projectId || !params.startDate || !params.endDate || !params.events.length) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters' 
        });
      }

      const data = await statsService.getEventAnalysis(params);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting event analysis:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  // 获取漏斗分析数据
  router.get('/funnel/analysis', async (req, res) => {
    try {
      const params = {
        projectId: req.query.projectId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        stages: (req.query.stages as string).split(',').filter(Boolean)
      };

      console.log('接收到漏斗分析请求:', params);

      if (!params.projectId || !params.startDate || !params.endDate || !params.stages.length) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters' 
        });
      }

      const data = await statsService.getFunnelAnalysis(params);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting funnel analysis:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  // 获取统计数据
  router.get('/stats', async (req, res) => {
    try {
      const data = await statsService.getStats({
        projectId: req.query.projectId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        eventName: req.query.eventName as string
      });
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  // 获取仪表盘概览数据
  router.get('/dashboard/overview', async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Project ID is required' 
        });
      }

      const data = await statsService.getDashboardOverview(projectId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting dashboard overview:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  // 创建项目
  router.post('/projects', async (req, res) => {
    try {
      const { name, description } = req.body;
      const id = uuidv4();
      
      await db.execute(
        'INSERT INTO projects (id, name, description) VALUES (?, ?, ?)',
        [id, name, description]
      );

      res.status(201).json({ 
        success: true, 
        data: { id, name, description } 
      });
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  // 获取项目列表
  router.get('/projects', async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT * FROM projects ORDER BY created_at DESC');
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Error getting projects:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  // 获取Top 5访问项目数据
  router.get('/top-projects', async (req, res) => {
    try {
      const { projectId, startDate, endDate } = req.query;
      
      if (!projectId || !startDate || !endDate) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters' 
        });
      }

      const data = await statsService.getTopVisitedProjects(
        projectId as string,
        startDate as string,
        endDate as string
      );
      
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting top projects:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  // AI总结设置相关路由
  if (summaryService) {
    // 获取用户的总结设置
    router.get('/ai-summary/settings', async (req, res) => {
      try {
        const userId = (req as any).user?.sub;
        if (!userId) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const setting = await summaryService.getUserSetting(userId);
        res.json({ success: true, data: setting });
      } catch (error) {
        console.error('获取总结设置失败:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
      }
    });

    // 创建或更新总结设置
    router.post('/ai-summary/settings', async (req, res) => {
      try {
        const userId = (req as any).user?.sub;
        if (!userId) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { enabled, sendTime, email, projectIds } = req.body;
        const setting = await summaryService.upsertSetting(userId, {
          enabled,
          sendTime,
          email: email || undefined,
          projectIds: projectIds && Array.isArray(projectIds) && projectIds.length > 0 ? projectIds : undefined,
        });

        res.json({ success: true, data: setting });
      } catch (error: any) {
        console.error('保存总结设置失败:', error);
        const errorMessage = error?.message || 'Internal Server Error';
        res.status(500).json({ success: false, error: errorMessage });
      }
    });

    // 手动触发生成并发送总结（用于测试）
    router.post('/ai-summary/send-now', async (req, res) => {
      try {
        const userId = (req as any).user?.sub;
        if (!userId) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        console.log('收到手动发送总结请求，用户ID:', userId);
        
        const setting = await summaryService.getUserSetting(userId);
        if (!setting) {
          return res.status(400).json({ success: false, error: '请先配置总结设置' });
        }

        console.log('开始生成并发送总结...');
        const success = await summaryService.generateAndSendSummary(setting);
        if (success) {
          res.json({ success: true, message: '总结已发送，请查看您的邮箱' });
        } else {
          res.status(500).json({ success: false, error: '发送失败，请检查邮件配置和日志' });
        }
      } catch (error: any) {
        console.error('手动发送总结失败:', error);
        console.error('错误堆栈:', error?.stack);
        const errorMessage = error?.message || 'Internal Server Error';
        res.status(500).json({ success: false, error: errorMessage });
      }
    });
  }

  // 时序预测相关路由
  // 检查ML服务健康状态
  router.get('/prediction/health', async (req, res) => {
    try {
      const isHealthy = await predictionService.checkMLServiceHealth();
      res.json({ 
        success: true, 
        data: { 
          mlServiceAvailable: isHealthy,
          mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:5000'
        } 
      });
    } catch (error) {
      console.error('检查ML服务状态失败:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  // 预测单个指标
  router.post('/prediction/predict', async (req, res) => {
    try {
      const { projectId, metricType, modelType, days } = req.body;
      
      if (!projectId || !metricType) {
        return res.status(400).json({ 
          success: false, 
          error: 'projectId 和 metricType 是必需的' 
        });
      }

      const userId = (req as any).user?.sub; // 获取当前用户ID
      
      console.log(`[预测请求] projectId: ${projectId}, metricType: ${metricType}, modelType: ${modelType || 'lstm'}, days: ${days || 7}`);
      
      const result = await predictionService.predict({
        projectId,
        metricType: metricType || 'pv',
        modelType: modelType || 'lstm',
        days: days || 7
      });

      console.log(`[预测结果] success: ${result.success}, error: ${result.error || 'none'}`);

      // 如果预测成功，自动保存记录
      if (result.success && result.predictions) {
        try {
          await predictionRecordService.createRecord({
            projectId,
            userId,
            metricType: result.metricType as 'pv' | 'uv' | 'conversion_rate',
            modelType: result.modelType as 'lstm' | 'gru',
            predictionDays: days || 7,
            predictions: result.predictions,
            historicalData: result.historicalData,
            modelInfo: result.modelInfo
          });
          console.log('[预测记录] 保存成功');
        } catch (saveError: any) {
          // 保存失败不影响预测结果返回，只记录日志
          console.error('[预测记录] 保存失败:', saveError.message || saveError);
        }
      }

      // 如果预测失败，返回错误但使用200状态码（因为result中已包含错误信息）
      if (!result.success) {
        return res.status(200).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('[预测路由] 捕获异常:', error);
      console.error('[预测路由] 错误堆栈:', error.stack);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Internal Server Error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // 批量预测多个指标
  router.post('/prediction/predict-batch', async (req, res) => {
    try {
      const { projectId, metrics, modelType, days } = req.body;
      
      if (!projectId || !metrics || !Array.isArray(metrics)) {
        return res.status(400).json({ 
          success: false, 
          error: 'projectId 和 metrics 是必需的，且 metrics 必须是数组' 
        });
      }

      const userId = (req as any).user?.sub; // 获取当前用户ID
      
      const result = await predictionService.predictBatch(
        projectId,
        metrics,
        modelType || 'lstm',
        days || 7
      );

      // 如果批量预测成功，为每个指标保存记录
      if (result.success && result.results) {
        try {
          for (const [metric, predictions] of Object.entries(result.results)) {
            if (predictions && Array.isArray(predictions)) {
              await predictionRecordService.createRecord({
                projectId,
                userId,
                metricType: metric as 'pv' | 'uv' | 'conversion_rate',
                modelType: result.modelType as 'lstm' | 'gru',
                predictionDays: days || 7,
                predictions: predictions,
                modelInfo: { batch: true }
              });
            }
          }
        } catch (saveError) {
          // 保存失败不影响预测结果返回，只记录日志
          console.error('保存批量预测记录失败:', saveError);
        }
      }

      res.json(result);
    } catch (error: any) {
      console.error('批量预测失败:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Internal Server Error' 
      });
    }
  });

  // 查询预测历史记录
  router.get('/prediction/records', async (req, res) => {
    try {
      const userId = (req as any).user?.sub;
      const { 
        projectId, 
        metricType, 
        modelType, 
        startDate, 
        endDate, 
        page, 
        pageSize 
      } = req.query;

      const result = await predictionRecordService.getRecords({
        projectId: projectId as string,
        userId: userId, // 只查询当前用户的记录
        metricType: metricType as 'pv' | 'uv' | 'conversion_rate' | undefined,
        modelType: modelType as 'lstm' | 'gru' | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('查询预测记录失败:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Internal Server Error' 
      });
    }
  });

  // 获取单个预测记录详情
  router.get('/prediction/records/:id', async (req, res) => {
    try {
      const userId = (req as any).user?.sub;
      const { id } = req.params;

      const record = await predictionRecordService.getRecordById(id);

      if (!record) {
        return res.status(404).json({ 
          success: false, 
          error: '预测记录不存在' 
        });
      }

      // 确保用户只能查看自己的记录
      if (userId && record.userId && record.userId !== userId) {
        return res.status(403).json({ 
          success: false, 
          error: '无权访问此记录' 
        });
      }

      res.json({ success: true, data: record });
    } catch (error: any) {
      console.error('获取预测记录失败:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Internal Server Error' 
      });
    }
  });

  // 删除预测记录
  router.delete('/prediction/records/:id', async (req, res) => {
    try {
      const userId = (req as any).user?.sub;
      const { id } = req.params;

      const success = await predictionRecordService.deleteRecord(id, userId);

      if (success) {
        res.json({ success: true, message: '删除成功' });
      } else {
        res.status(404).json({ 
          success: false, 
          error: '记录不存在或无权删除' 
        });
      }
    } catch (error: any) {
      console.error('删除预测记录失败:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Internal Server Error' 
      });
    }
  });

  return router;
} 