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
  // 配置常量
  private readonly MAX_PROJECTS_PER_BATCH = parseInt(process.env.AI_MAX_PROJECTS_PER_BATCH || '10'); // 每批最多处理的项目数
  private readonly MAX_PROMPT_TOKENS = parseInt(process.env.AI_MAX_PROMPT_TOKENS || '3000'); // 最大 prompt token 数（保守估计）
  private readonly ESTIMATED_CHARS_PER_TOKEN = 3; // 粗略估算：1 token ≈ 3-4 字符（中文）

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE;
    const timeoutMs = parseInt(process.env.OPENAI_TIMEOUT_MS || '120000'); // 增加默认超时时间到120秒

    if (apiKey) {
      this.client = new OpenAI({
        apiKey: apiKey,
        baseURL,
        timeout: timeoutMs,
      } as any);

      console.log('[AIService] OpenAI 客户端初始化', {
        baseURL: baseURL || 'default',
        timeoutMs,
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        maxProjectsPerBatch: this.MAX_PROJECTS_PER_BATCH,
        maxPromptTokens: this.MAX_PROMPT_TOKENS,
      });
    } else {
      console.warn('未配置 OPENAI_API_KEY，AI 功能将不可用');
    }
  }

  private async generateWithRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        const code = err?.code || err?.name || 'UNKNOWN';
        const status = err?.status;
        const isTimeout =
          code?.toString().includes('Timeout') ||
          err?.message?.toLowerCase?.().includes('timeout') ||
          status === 408;
        const isNetwork =
          code === 'ECONNRESET' ||
          code === 'EAI_AGAIN' ||
          code === 'ENOTFOUND' ||
          code === 'ECONNREFUSED' ||
          code === 'ETIMEDOUT';
        if (attempt < retries && (isTimeout || isNetwork)) {
          const backoff = 1000 * Math.pow(2, attempt);
          console.warn(`[AIService] 调用失败（${code}/${status}），${backoff}ms 后重试，第 ${attempt + 1}/${retries} 次`);
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
        break;
      }
    }
    throw lastError;
  }

  /**
   * 估算 prompt 的 token 数量（粗略估算）
   */
  private estimateTokens(text: string): number {
    // 粗略估算：中文约 1.5-2 字符/token，英文约 4 字符/token
    // 这里使用保守估算：平均 3 字符/token
    return Math.ceil(text.length / this.ESTIMATED_CHARS_PER_TOKEN);
  }

  /**
   * 将数据分批处理，避免超过 token 限制
   */
  private splitDataIntoBatches(data: SummaryData[]): SummaryData[][] {
    const batches: SummaryData[][] = [];
    let currentBatch: SummaryData[] = [];
    let currentBatchTokens = 0;

    for (const project of data) {
      const projectPrompt = this.buildPrompt([project]);
      const projectTokens = this.estimateTokens(projectPrompt);

      // 如果单个项目就超过限制，仍然添加（至少保证每个项目都能处理）
      if (currentBatch.length >= this.MAX_PROJECTS_PER_BATCH || 
          (currentBatchTokens + projectTokens > this.MAX_PROMPT_TOKENS && currentBatch.length > 0)) {
        batches.push(currentBatch);
        currentBatch = [project];
        currentBatchTokens = projectTokens;
      } else {
        currentBatch.push(project);
        currentBatchTokens += projectTokens;
      }
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  async generateSummary(data: SummaryData[]): Promise<string> {
    if (!this.client) {
      // 如果没有配置AI，返回基础总结
      return this.generateBasicSummary(data);
    }

    // 检查数据量
    if (data.length === 0) {
      return this.generateBasicSummary(data);
    }

    // 如果数据量太大，进行分批处理
    const estimatedTotalTokens = this.estimateTokens(this.buildPrompt(data));
    const needsBatching = data.length > this.MAX_PROJECTS_PER_BATCH || estimatedTotalTokens > this.MAX_PROMPT_TOKENS;

    if (needsBatching) {
      console.log(`[AIService] 数据量较大（${data.length} 个项目，约 ${estimatedTotalTokens} tokens），将分批处理`);
      return this.generateSummaryInBatches(data);
    }

    try {
      const prompt = this.buildPrompt(data);
      const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
      const actualTokens = this.estimateTokens(prompt);

      console.log(`[AIService] 生成总结，数据量：${data.length} 个项目，约 ${actualTokens} tokens`);

      const completion = await this.generateWithRetry(() =>
        this.client!.chat.completions.create({
          model,
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
          max_tokens: 2000, // 增加输出 token 限制
        })
      );

      const summary = completion.choices[0]?.message?.content || '';
      return summary || this.generateBasicSummary(data);
    } catch (error: any) {
      console.error('AI生成总结失败:', error);
      
      // 检查是否是 token 超限错误
      if (error?.message?.includes('token') || error?.status === 400) {
        console.warn('[AIService] 可能是 token 超限，尝试分批处理');
        if (data.length > 1) {
          return this.generateSummaryInBatches(data);
        }
      }
      
      console.error('[AIService] 可能的原因：\n- 无法访问 OpenAI（网络或代理）\n- 模型名称不正确\n- baseURL 配置不匹配（如使用 Azure/代理）\n- 超时时间过短，可设置 OPENAI_TIMEOUT_MS\n- 需要配置系统代理（HTTP(S)_PROXY/NO_PROXY）\n- 数据量过大，超过 token 限制');
      // 如果AI调用失败，返回基础总结
      return this.generateBasicSummary(data);
    }
  }

  /**
   * 分批生成总结并合并
   */
  private async generateSummaryInBatches(data: SummaryData[]): Promise<string> {
    const batches = this.splitDataIntoBatches(data);
    console.log(`[AIService] 分为 ${batches.length} 批处理`);

    const summaries: string[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[AIService] 处理第 ${i + 1}/${batches.length} 批，包含 ${batch.length} 个项目`);

      try {
        const prompt = this.buildPrompt(batch);
        const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

        const completion = await this.generateWithRetry(() =>
          this.client!.chat.completions.create({
            model,
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
            max_tokens: 2000,
          })
        );

        const batchSummary = completion.choices[0]?.message?.content || '';
        if (batchSummary) {
          summaries.push(batchSummary);
        }
      } catch (error) {
        console.error(`[AIService] 第 ${i + 1} 批处理失败:`, error);
        // 如果某批失败，使用基础总结作为后备
        summaries.push(this.generateBasicSummary(batch));
      }

      // 批次之间稍作延迟，避免 API 限流
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 合并所有批次的总结
    if (summaries.length === 0) {
      return this.generateBasicSummary(data);
    }

    if (summaries.length === 1) {
      return summaries[0];
    }

    // 如果有多个批次，生成一个总览总结
    const combinedSummary = summaries.join('\n\n---\n\n');
    
    // 如果合并后的总结太长，尝试让 AI 再次总结
    if (this.estimateTokens(combinedSummary) > 2000) {
      try {
        const finalPrompt = `以下是多个项目的数据总结，请生成一份简洁的总览报告：\n\n${combinedSummary}\n\n请用简洁的中文总结关键信息。`;
        const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
        
        const completion = await this.generateWithRetry(() =>
          this.client!.chat.completions.create({
            model,
            messages: [
              {
                role: 'system',
                content: '你是一个专业的数据分析助手，擅长用简洁、专业的中文总结数据分析结果。',
              },
              {
                role: 'user',
                content: finalPrompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 2000,
          })
        );

        return completion.choices[0]?.message?.content || combinedSummary;
      } catch (error) {
        console.error('[AIService] 生成总览总结失败，返回原始合并结果:', error);
        return combinedSummary;
      }
    }

    return combinedSummary;
  }

  private buildPrompt(data: SummaryData[]): string {
    // 优化 prompt，使其更简洁
    let prompt = '请根据以下数据分析结果，生成一份专业、简洁的每日数据总结报告。\n\n';
    
    data.forEach((project, index) => {
      if (data.length > 1) {
        prompt += `【项目 ${index + 1}】${project.projectName}\n`;
      } else {
        prompt += `项目：${project.projectName}\n`;
      }
      prompt += `日期：${project.date}\n`;
      prompt += `核心指标：PV=${project.stats.pv}, UV=${project.stats.uv}, 人均页面=${project.stats.avgPages.toFixed(1)}, 停留=${project.stats.avgDuration.toFixed(1)}分钟\n`;
      
      if (project.trends) {
        const pvChangeStr = project.trends.pvChange > 0 ? '+' : '';
        const uvChangeStr = project.trends.uvChange > 0 ? '+' : '';
        prompt += `趋势：PV${pvChangeStr}${(project.trends.pvChange * 100).toFixed(1)}%, UV${uvChangeStr}${(project.trends.uvChange * 100).toFixed(1)}%\n`;
      }
      
      // 只显示 Top 3 事件，减少数据量
      if (project.topEvents && project.topEvents.length > 0) {
        const top3Events = project.topEvents.slice(0, 3);
        prompt += `热门事件：${top3Events.map(e => `${e.eventName}(${e.count}次)`).join(', ')}\n`;
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

