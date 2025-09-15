import axios from 'axios';
import type { EventDefinition } from '@/types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 10000,
});

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
    const { data } = await api.get('/stats', { params });
    return data.data;
  },

  // 获取事件列表
  async getEventDefinitions(projectId: string): Promise<EventDefinition[]> {
    try {
      const { data } = await api.get('/event-definitions', {
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
    const { data } = await api.post('/event-definitions', eventDef);
    return data.data;
  },

  // 更新事件定义
  async updateEventDefinition(id: string, eventDef: Omit<EventDefinition, 'id'>): Promise<EventDefinition> {
    const { data } = await api.put(`/event-definitions/${id}`, eventDef);
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
      const { data } = await api.get('/events/analysis', {
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
      const { data } = await api.get('/funnel/analysis', {
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
    const { data } = await api.get('/dashboard/overview', {
      params: { projectId }
    });
    return data.data;
  },

  // 创建项目
  async createProject(project: Omit<Project, 'id'>): Promise<Project> {
    const { data } = await api.post('/projects', project);
    return data.data;
  },

  // 获取项目列表
  async getProjects(): Promise<Project[]> {
    const { data } = await api.get('/projects');
    return data.data;
  },

  // 获取Top 5访问项目数据
  async getTopProjects(params: {
    projectId: string;
    startDate: string;
    endDate: string;
  }): Promise<TopProject[]> {
    const { data } = await api.get('/top-projects', { params });
    return data.data;
  },

  // 用户注册
  async register(credentials: { username: string; password: string; email: string }) {
    const { data } = await api.post('/register', credentials);
    return data;
  },

  // 用户登录
  async login(credentials: { username: string; password: string }) {
    const { data } = await api.post('/login', credentials);
    return data;
  }
}; 