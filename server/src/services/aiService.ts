import OpenAI from 'openai';
import { encoding_for_model, get_encoding, type Tiktoken } from 'tiktoken';

// Node.js 16 需要 fetch polyfill
let fetchPolyfill: any = null;
if (typeof globalThis.fetch === 'undefined') {
  try {
    fetchPolyfill = require('node-fetch');
    globalThis.fetch = fetchPolyfill.default || fetchPolyfill;
  } catch (e) {
    console.warn('[AIService] node-fetch not found, OpenAI may not work');
  }
}

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
  private readonly ESTIMATED_CHARS_PER_TOKEN = 3; // 降级方案：粗略估算：1 token ≈ 3-4 字符（中文）
  
  // Token 编码器缓存
  private encoderCache: Map<string, Tiktoken> = new Map();
  private useAccurateTokenEstimation: boolean = true;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE;
    const timeoutMs = parseInt(process.env.OPENAI_TIMEOUT_MS || '120000'); // 增加默认超时时间到120秒

    if (apiKey) {
      const clientConfig: any = {
        apiKey: apiKey,
        baseURL,
        timeout: timeoutMs,
      };
      
      // Node.js 16 需要传递 fetch
      if (fetchPolyfill) {
        clientConfig.fetch = fetchPolyfill.default || fetchPolyfill;
      } else if (typeof globalThis.fetch !== 'undefined') {
        clientConfig.fetch = globalThis.fetch;
      }
      
      this.client = new OpenAI(clientConfig);

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
   * 获取指定模型的 token 编码器
   */
  private getEncoder(model: string): Tiktoken | null {
    try {
      // 尝试从缓存获取
      if (this.encoderCache.has(model)) {
        return this.encoderCache.get(model)!;
      }

      // 根据模型名称获取对应的编码器
      // tiktoken 支持多种模型，这里处理常见的模型
      let encoder: Tiktoken | null = null;

      // 尝试使用 encoding_for_model（推荐方式）
      try {
        encoder = encoding_for_model(model as any);
      } catch (error) {
        // 如果模型名称不被识别，尝试使用默认编码器
        console.warn(`[AIService] 无法识别模型 ${model}，使用默认编码器`);
        try {
          // 对于 gpt-3.5-turbo 和 gpt-4，使用 cl100k_base 编码
          encoder = get_encoding('cl100k_base');
        } catch (e) {
          console.error('[AIService] 无法初始化编码器:', e);
          return null;
        }
      }

      // 缓存编码器
      if (encoder) {
        this.encoderCache.set(model, encoder);
      }

      return encoder;
    } catch (error) {
      console.error('[AIService] 获取编码器失败:', error);
      return null;
    }
  }

  /**
   * 估算 prompt 的 token 数量（使用 tiktoken 进行准确估算）
   * @param text 要估算的文本
   * @param model 模型名称（可选，用于选择正确的编码器）
   * @returns token 数量
   */
  private estimateTokens(text: string, model?: string): number {
    // 如果禁用了准确估算，使用降级方案
    if (!this.useAccurateTokenEstimation) {
      return Math.ceil(text.length / this.ESTIMATED_CHARS_PER_TOKEN);
    }

    // 获取模型名称（默认使用环境变量中的模型）
    const modelName = model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    
    try {
      const encoder = this.getEncoder(modelName);
      
      if (encoder) {
        // 使用 tiktoken 进行准确的 token 计数
        const tokens = encoder.encode(text);
        const count = tokens.length;
        
        // 释放编码器（tiktoken 编码器不需要手动释放，但我们可以记录使用情况）
        return count;
      } else {
        // 如果无法获取编码器，降级到简单估算
        console.warn('[AIService] 无法获取编码器，使用降级方案估算 token');
        this.useAccurateTokenEstimation = false;
        return Math.ceil(text.length / this.ESTIMATED_CHARS_PER_TOKEN);
      }
    } catch (error) {
      // 如果 tiktoken 出现任何错误，降级到简单估算
      console.error('[AIService] Token 估算失败，使用降级方案:', error);
      this.useAccurateTokenEstimation = false;
      return Math.ceil(text.length / this.ESTIMATED_CHARS_PER_TOKEN);
    }
  }

  /**
   * 估算消息数组的总 token 数量（包括 system 和 user 消息）
   */
  private estimateMessagesTokens(messages: Array<{ role: string; content: string }>, model?: string): number {
    const modelName = model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    
    try {
      const encoder = this.getEncoder(modelName);
      
      if (encoder) {
        // 计算所有消息的 token 数
        // 注意：每个消息还需要额外的格式 token（约 4 tokens per message）
        let totalTokens = 0;
        
        for (const message of messages) {
          const contentTokens = encoder.encode(message.content).length;
          // 每条消息大约需要 4 个额外 token（role, content 等格式）
          totalTokens += contentTokens + 4;
        }
        
        // 最后还需要 2 个 token 用于结束
        totalTokens += 2;
        
        return totalTokens;
      } else {
        // 降级方案：简单估算
        const totalText = messages.map(m => m.content).join(' ');
        return Math.ceil(totalText.length / this.ESTIMATED_CHARS_PER_TOKEN) + messages.length * 4 + 2;
      }
    } catch (error) {
      // 降级方案
      const totalText = messages.map(m => m.content).join(' ');
      return Math.ceil(totalText.length / this.ESTIMATED_CHARS_PER_TOKEN) + messages.length * 4 + 2;
    }
  }

  /**
   * 将数据分批处理，避免超过 token 限制
   */
  private splitDataIntoBatches(data: SummaryData[]): SummaryData[][] {
    const batches: SummaryData[][] = [];
    let currentBatch: SummaryData[] = [];
    let currentBatchTokens = 0;

    const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

    for (const project of data) {
      const projectPrompt = this.buildPrompt([project]);
      const projectTokens = this.estimateTokens(projectPrompt, model);

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
    const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    const prompt = this.buildPrompt(data);
    const systemMessage = '你是一个专业的数据分析助手，擅长用简洁、专业的中文总结数据分析结果。';
    
    // 使用更准确的 token 估算（包括 system 和 user 消息）
    const estimatedTotalTokens = this.estimateMessagesTokens(
      [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt }
      ],
      model
    );
    
    const needsBatching = data.length > this.MAX_PROJECTS_PER_BATCH || estimatedTotalTokens > this.MAX_PROMPT_TOKENS;

    if (needsBatching) {
      console.log(`[AIService] 数据量较大（${data.length} 个项目，约 ${estimatedTotalTokens} tokens），将分批处理`);
      return this.generateSummaryInBatches(data);
    }

    try {
      const prompt = this.buildPrompt(data);
      const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
      const systemMessage = '你是一个专业的数据分析助手，擅长用简洁、专业的中文总结数据分析结果。';
      
      // 使用更准确的 token 估算
      const actualTokens = this.estimateMessagesTokens(
        [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        model
      );

      console.log(`[AIService] 生成总结，数据量：${data.length} 个项目，约 ${actualTokens} tokens（使用${this.useAccurateTokenEstimation ? '准确' : '降级'}估算）`);

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
        const systemMessage = '你是一个专业的数据分析助手，擅长用简洁、专业的中文总结数据分析结果。';
        
        // 记录该批次的 token 估算
        const batchTokens = this.estimateMessagesTokens(
          [
            { role: 'system', content: systemMessage },
            { role: 'user', content: prompt }
          ],
          model
        );
        console.log(`[AIService] 第 ${i + 1} 批 token 估算：约 ${batchTokens} tokens`);

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
    const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    const combinedTokens = this.estimateTokens(combinedSummary, model);
    
    if (combinedTokens > 2000) {
      try {
        const finalPrompt = `以下是多个项目的数据总结，请生成一份简洁的总览报告：\n\n${combinedSummary}\n\n请用简洁的中文总结关键信息。`;
        const systemMessage = '你是一个专业的数据分析助手，擅长用简洁、专业的中文总结数据分析结果。';
        
        const finalTokens = this.estimateMessagesTokens(
          [
            { role: 'system', content: systemMessage },
            { role: 'user', content: finalPrompt }
          ],
          model
        );
        console.log(`[AIService] 合并总结 token 数：${combinedTokens}，生成总览 token 估算：${finalTokens}`);
        
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
      const avgPages = typeof project.stats.avgPages === 'number' ? project.stats.avgPages : 0;
      const avgDuration = typeof project.stats.avgDuration === 'number' ? project.stats.avgDuration : 0;
      prompt += `核心指标：PV=${project.stats.pv}, UV=${project.stats.uv}, 人均页面=${avgPages.toFixed(1)}, 停留=${avgDuration.toFixed(1)}分钟\n`;
      
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
      const avgPages = typeof project.stats.avgPages === 'number' ? project.stats.avgPages : 0;
      const avgDuration = typeof project.stats.avgDuration === 'number' ? project.stats.avgDuration : 0;
      summary += `<li>人均访问页面数：${avgPages}</li>\n`;
      summary += `<li>平均停留时间：${avgDuration}分钟</li>\n`;
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

