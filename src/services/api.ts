import http from '@/utils/http';
import type { EventDefinition } from '@/types';

const api = http;

export interface UserItem {
  id: string;
  username: string;
  email: string;
  role: 'Admin' | 'User';
  created_at: string;
  updated_at: string;
}

// 统计数据接口
export interface StatsQuery {
  projectId: string;
  startDate: string;
  endDate: string;
  eventName?: string;
}

export interface StatsData {
  date: string;
  pv: number;
  uv: number;
}

// 事件分析接口
export interface EventAnalysisQuery extends StatsQuery {
  events: string[];
}

export interface EventAnalysisData {
  date: string;
  eventName: string;
  count: number;
  users: number;
}

// 漏斗分析接口
export interface FunnelQuery extends StatsQuery {
  stages: string[];
}

export interface FunnelData {
  stage: string;
  value: number;
  rate?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  owner_id?: string | null;
  created_at?: string;
  updated_at?: string;
  has_permission?: boolean;
}

export interface TopProject {
  projectName: string;
  visitCount: number;
  uniqueVisitors: number;
}

// API 方法
export const apiService = {
  // 获取统计数据
  async getStats(params: StatsQuery): Promise<StatsData[]> {
    const data = await api.get('/stats', { 
      params,
      timeout: 60000  // 统计查询可能需要更长时间，设置为60秒
    });
    return data.data;
  },

  // 获取事件列表
  async getEventDefinitions(projectId: string): Promise<EventDefinition[]> {
    try {
      const data = await api.get('/event-definitions', {
        params: { projectId }
      });
      return data.data;
    } catch (error) {
      console.error('Error fetching event definitions:', error);
      throw error;
    }
  },

  // 创建事件定义
  async createEventDefinition(eventDef: Omit<EventDefinition, 'id'>): Promise<EventDefinition> {
    const data = await api.post('/event-definitions', eventDef);
    return data.data;
  },

  // 更新事件定义
  async updateEventDefinition(id: string, eventDef: Omit<EventDefinition, 'id'>): Promise<EventDefinition> {
    const data = await api.put(`/event-definitions/${id}`, eventDef);
    return data.data;
  },

  // 删除事件定义
  async deleteEventDefinition(id: string, projectId: string): Promise<void> {
    await api.delete(`/event-definitions/${id}`, {
      params: { projectId }
    });
  },

  // 获取事件分析数据
  async getEventAnalysis(params: EventAnalysisQuery): Promise<EventAnalysisData[]> {
    try {
      console.log('发送事件分析请求:', params);
      const data = await api.get('/events/analysis', {
        params: {
          ...params,
          events: params.events.join(',') // 将数组转换为逗号分隔的字符串
        }
      });
      return data.data;
    } catch (error) {
      console.error('Error fetching event analysis:', error);
      throw error;
    }
  },

  // 获取漏斗分析数据
  async getFunnelAnalysis(params: FunnelQuery): Promise<FunnelData[]> {
    try {
      console.log('发送漏斗分析请求:', params);
      const data = await api.get('/funnel/analysis', {
        params: {
          ...params,
          stages: params.stages.join(',') // 将数组转换为逗号分隔的字符串
        }
      });
      return data.data;
    } catch (error) {
      console.error('Error fetching funnel analysis:', error);
      throw error;
    }
  },

  // 获取今日概览数据
  async getDashboardOverview(projectId: string): Promise<{
    todayPV: number;
    todayUV: number;
    avgPages: number;
    avgDuration: number;
  }> {
    const data = await api.get('/dashboard/overview', {
      params: { projectId },
      timeout: 30000  // 大数据量时可能需要更长时间
    });
    return data.data;
  },

  // 创建项目
  async createProject(project: Omit<Project, 'id'>): Promise<Project> {
    const data = await api.post('/projects', project);
    return data.data;
  },

  // 获取项目列表
  async getProjects(): Promise<Project[]> {
    const data = await api.get('/projects');
    return data.data;
  },

  // 获取项目详情
  async getProjectDetail(projectId: string): Promise<Project> {
    const data = await api.get(`/projects/${projectId}`);
    return data.data;
  },

  // 获取Top 5访问项目数据
  async getTopProjects(params: {
    projectId: string;
    startDate: string;
    endDate: string;
  }): Promise<TopProject[]> {
    const data = await api.get('/top-projects', { 
      params,
      timeout: 30000  // 大数据量时可能需要更长时间
    });
    return data.data;
  },

  // 用户列表与角色
  async getUsers(): Promise<UserItem[]> {
    const data = await api.get('/users');
    return data.data;
    // 用户注册
  },

  async updateUserRole(id: string, role: 'Admin' | 'User'): Promise<void> {
    await api.put(`/users/${id}/role`, { role });
  },

  async register(credentials: { username: string; password: string; email: string }): Promise<{
    success: boolean;
    error?: string;
  }> {
    const data = await api.post('/register', credentials);
    return data as unknown as { success: boolean; error?: string };
  },

  // 用户登录
  async login(credentials: { username: string; password: string }): Promise<{
    success: boolean;
    user?: any;
    token?: string;
    error?: string;
  }> {
    const data = await api.post('/login', credentials);
    return data as unknown as { success: boolean; user?: any; token?: string; error?: string };
  },

  // AI总结设置
  async getAISummarySettings() {
    const data = await api.get('/ai-summary/settings');
    return data.data;
  },

  async updateAISummarySettings(settings: {
    enabled?: boolean;
    sendTime?: string;
    email?: string;
    projectIds?: string[];
  }) {
    const data = await api.post('/ai-summary/settings', settings);
    return data.data;
  },

  async sendAISummaryNow() {
    // AI总结需要处理大量数据，设置更长的超时时间（120秒）
    const data = await api.post('/ai-summary/send-now', {}, {
      timeout: 120000
    });
    return data;
  },

  async getSummaryProgress(taskId: string) {
    const data = await api.get(`/ai-summary/progress/${taskId}`);
    return data;
  },

  // 时序预测相关API
  async checkPredictionHealth() {
    const data = await api.get('/prediction/health');
    return data.data;
  },

  async predict(params: {
    projectId: string;
    metricType: 'pv' | 'uv' | 'conversion_rate';
    modelType?: 'lstm' | 'gru';
    days?: number;
  }) {
    // 预测需要训练模型，设置更长的超时时间（60秒）
    const data = await api.post('/prediction/predict', params, {
      timeout: 60000
    });
    return data;
  },

  async predictBatch(params: {
    projectId: string;
    metrics: Array<'pv' | 'uv' | 'conversion_rate'>;
    modelType?: 'lstm' | 'gru';
    days?: number;
  }) {
    // 批量预测需要更长时间，设置更长的超时时间（120秒）
    const data = await api.post('/prediction/predict-batch', params, {
      timeout: 120000
    });
    return data;
  },

  // 预测记录相关API
  async getPredictionRecords(params: {
    projectId?: string;
    metricType?: 'pv' | 'uv' | 'conversion_rate';
    modelType?: 'lstm' | 'gru';
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    const data = await api.get('/prediction/records', { params });
    return data.data;
  },

  async getPredictionRecord(id: string) {
    const data = await api.get(`/prediction/records/${id}`);
    return data.data;
  },

  async deletePredictionRecord(id: string) {
    const data = await api.delete(`/prediction/records/${id}`);
    return data;
  },

  // 性能分析相关API
  async getPerformanceAnalysis(params: {
    projectId: string;
    startDate: string;
    endDate: string;
    metrics: string[];
  }): Promise<{
    summary: Array<{
      metricName: string;
      avgValue: number;
      goodRate: number;
      totalCount: number;
      rating: 'good' | 'needs-improvement' | 'poor';
    }>;
    details: Array<{
      date: string;
      metricName: string;
      avgValue: number;
      p50: number;
      p75: number;
      p95: number;
      goodRate: number;
      totalCount: number;
    }>;
  }> {
    const data = await api.get('/performance/analysis', {
      params: {
        ...params,
        metrics: params.metrics.join(',')
      },
      timeout: 60000
    });
    return data.data;
  },

  // 项目权限管理API（仅Admin可访问）
  // 获取指定用户的项目权限列表
  async getUserProjectPermissions(userId: string): Promise<Project[]> {
    const data = await api.get(`/project-permissions/${userId}`);
    return data.data;
  },

  // 为用户分配项目权限
  async assignUserProjectPermission(userId: string, projectId: string): Promise<void> {
    await api.post('/project-permissions', { userId, projectId });
  },

  // 移除用户的项目权限
  async removeUserProjectPermission(userId: string, projectId: string): Promise<void> {
    await api.delete('/project-permissions', {
      params: { userId, projectId }
    });
  },

  // 批量更新用户的项目权限
  async updateUserProjectPermissions(userId: string, projectIds: string[]): Promise<void> {
    await api.put(`/project-permissions/${userId}`, { projectIds });
  }
}; 