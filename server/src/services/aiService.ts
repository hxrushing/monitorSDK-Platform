import OpenAI from 'openai';

export interface SummaryData {
  projectId: string;
  projectName: string;
  date: string;
  stats: {
    pv: number;
    uv: number;
    avgPages: number;
    avgDuration: number;
  };
  topEvents: Array<{
    eventName: string;
    count: number;
    users: number;
  }>;
  trends: {
    pvChange: number;
    uvChange: number;
  };
}

export class AIService {
  private client: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({
        apiKey: apiKey,
      });
    } else {
      console.warn('未配置 OPENAI_API_KEY，AI 功能将不可用');
    }
  }

  async generateSummary(data: SummaryData[]): Promise<string> {
    if (!this.client) {
      // 如果没有配置AI，返回基础总结
      return this.generateBasicSummary(data);
    }

    try {
      const prompt = this.buildPrompt(data);
      
      const completion = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的数据分析助手，擅长用简洁、专业的中文总结数据分析结果。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const summary = completion.choices[0]?.message?.content || '';
      return summary || this.generateBasicSummary(data);
    } catch (error) {
      console.error('AI生成总结失败:', error);
      // 如果AI调用失败，返回基础总结
      return this.generateBasicSummary(data);
    }
  }

  private buildPrompt(data: SummaryData[]): string {
    let prompt = '请根据以下数据分析结果，生成一份专业、简洁的每日数据总结报告。\n\n';
    
    data.forEach((project) => {
      prompt += `项目：${project.projectName}\n`;
      prompt += `日期：${project.date}\n`;
      prompt += `数据概览：\n`;
      prompt += `- 页面访问量(PV)：${project.stats.pv}\n`;
      prompt += `- 独立访客数(UV)：${project.stats.uv}\n`;
      prompt += `- 人均访问页面数：${project.stats.avgPages}\n`;
      prompt += `- 平均停留时间：${project.stats.avgDuration}分钟\n`;
      
      if (project.trends) {
        prompt += `趋势分析：\n`;
        prompt += `- PV变化：${project.trends.pvChange > 0 ? '+' : ''}${(project.trends.pvChange * 100).toFixed(2)}%\n`;
        prompt += `- UV变化：${project.trends.uvChange > 0 ? '+' : ''}${(project.trends.uvChange * 100).toFixed(2)}%\n`;
      }
      
      if (project.topEvents && project.topEvents.length > 0) {
        prompt += `热门事件：\n`;
        project.topEvents.forEach((event, index) => {
          prompt += `${index + 1}. ${event.eventName}：${event.count}次（${event.users}个用户）\n`;
        });
      }
      
      prompt += '\n';
    });
    
    prompt += '请用专业、简洁的中文总结这些数据，包括关键指标、趋势分析和建议。';
    
    return prompt;
  }

  private generateBasicSummary(data: SummaryData[]): string {
    let summary = '<h2>每日数据总结报告</h2>\n\n';
    
    data.forEach((project) => {
      summary += `<h3>${project.projectName}</h3>\n`;
      summary += `<p><strong>日期：</strong>${project.date}</p>\n`;
      summary += `<ul>\n`;
      summary += `<li>页面访问量(PV)：${project.stats.pv}</li>\n`;
      summary += `<li>独立访客数(UV)：${project.stats.uv}</li>\n`;
      summary += `<li>人均访问页面数：${project.stats.avgPages}</li>\n`;
      summary += `<li>平均停留时间：${project.stats.avgDuration}分钟</li>\n`;
      summary += `</ul>\n`;
      
      if (project.trends) {
        summary += `<p><strong>趋势分析：</strong></p>\n`;
        summary += `<ul>\n`;
        summary += `<li>PV变化：${project.trends.pvChange > 0 ? '+' : ''}${(project.trends.pvChange * 100).toFixed(2)}%</li>\n`;
        summary += `<li>UV变化：${project.trends.uvChange > 0 ? '+' : ''}${(project.trends.uvChange * 100).toFixed(2)}%</li>\n`;
        summary += `</ul>\n`;
      }
      
      if (project.topEvents && project.topEvents.length > 0) {
        summary += `<p><strong>热门事件：</strong></p>\n`;
        summary += `<ul>\n`;
        project.topEvents.forEach((event) => {
          summary += `<li>${event.eventName}：${event.count}次（${event.users}个用户）</li>\n`;
        });
        summary += `</ul>\n`;
      }
      
      summary += '\n';
    });
    
    return summary;
  }
}

