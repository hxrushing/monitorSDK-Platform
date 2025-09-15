import express from 'express';
import { StatsService } from '../services/statsService';
import { EventDefinitionService, AppError } from '../services/eventDefinitionService';
import { TrackingService } from '../services/trackingService';
import { UserService } from '../services/userService';
import { Connection } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

export function createApiRouter(db: Connection) {
  const router = express.Router();
  const statsService = new StatsService(db);
  const eventDefinitionService = new EventDefinitionService(db);
  const trackingService = new TrackingService(db);
  const userService = new UserService(db);

  // 用户登录
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
      res.json(result);
    } catch (error) {
      console.error('登录失败:', error);
      res.status(500).json({
        success: false,
        error: '登录失败，请稍后重试'
      });
    }
  });

  // 用户注册
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

  // 事件追踪接口
  router.post('/track', async (req, res) => {
    try {
      const eventData = req.body;
      await trackingService.trackEvent(eventData);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error tracking event:', error);
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

  return router;
} 