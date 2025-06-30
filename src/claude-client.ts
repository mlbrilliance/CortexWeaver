import Anthropic from '@anthropic-ai/sdk';

export enum ClaudeModel {
  OPUS = 'claude-3-opus-20240229',
  SONNET = 'claude-3-sonnet-20240229',
  HAIKU = 'claude-3-haiku-20240307'
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ClaudeResponse {
  content: string;
  tokenUsage: TokenUsage;
  model: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface SendMessageOptions {
  systemPrompt?: string;
  conversationHistory?: Message[];
  model?: ClaudeModel;
  maxTokens?: number;
  temperature?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ClaudeClientConfig {
  apiKey: string;
  defaultModel?: ClaudeModel;
  maxTokens?: number;
  temperature?: number;
  budgetLimit?: number;
  budgetWarningThreshold?: number;
}

export interface TokenUsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  requestCount: number;
  estimatedCost: number;
}

export interface StreamingResponse {
  [Symbol.asyncIterator](): AsyncIterator<string>;
}

// Pricing per 1M tokens (as of 2024)
const MODEL_PRICING = {
  [ClaudeModel.OPUS]: { input: 15.00, output: 75.00 },
  [ClaudeModel.SONNET]: { input: 3.00, output: 15.00 },
  [ClaudeModel.HAIKU]: { input: 0.25, output: 1.25 }
};

export class ClaudeClient {
  private anthropic: Anthropic;
  private config: Required<ClaudeClientConfig>;
  private tokenUsage: TokenUsageStats;

  constructor(config: ClaudeClientConfig) {
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('API key is required');
    }

    this.config = {
      apiKey: config.apiKey,
      defaultModel: config.defaultModel || ClaudeModel.SONNET,
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.7,
      budgetLimit: config.budgetLimit || Infinity,
      budgetWarningThreshold: config.budgetWarningThreshold || 0.8
    };

    this.anthropic = new Anthropic({
      apiKey: this.config.apiKey
    });

    this.tokenUsage = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      requestCount: 0,
      estimatedCost: 0
    };
  }

  getConfiguration(): Required<ClaudeClientConfig> {
    return { ...this.config };
  }

  updateConfiguration(updates: Partial<ClaudeClientConfig>): void {
    if (updates.temperature !== undefined) {
      if (updates.temperature < 0 || updates.temperature > 1) {
        throw new Error('Temperature must be between 0 and 1');
      }
    }

    if (updates.maxTokens !== undefined) {
      if (updates.maxTokens <= 0) {
        throw new Error('Max tokens must be positive');
      }
    }

    Object.assign(this.config, updates);
  }

  async sendMessage(message: string, options: SendMessageOptions = {}): Promise<ClaudeResponse> {
    await this.checkBudgetLimit();

    const model = options.model || this.config.defaultModel;
    const maxTokens = options.maxTokens || this.config.maxTokens;
    const temperature = options.temperature || this.config.temperature;
    const maxRetries = options.maxRetries || 0;
    const retryDelay = options.retryDelay || 1000;

    const messages: Message[] = [
      ...(options.conversationHistory || []),
      { role: 'user', content: message }
    ];

    const requestPayload: any = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages
    };

    if (options.systemPrompt) {
      requestPayload.system = options.systemPrompt;
    }

    let lastError: Error;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.anthropic.messages.create(requestPayload);
        
        if (!response || !response.content || !Array.isArray(response.content)) {
          throw new Error('Invalid response format');
        }

        const textContent = response.content
          .filter(block => 'text' in block)
          .map(block => (block as any).text)
          .join('');

        const tokenUsage: TokenUsage = {
          inputTokens: response.usage?.input_tokens || 0,
          outputTokens: response.usage?.output_tokens || 0,
          totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
        };

        this.updateTokenUsage(tokenUsage, model);

        return {
          content: textContent,
          tokenUsage,
          model: response.model
        };
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries && this.isRetryableError(error)) {
          await this.delay(retryDelay);
          continue;
        }
        
        throw error;
      }
    }

    throw lastError!;
  }

  async sendMessageStream(message: string, options: SendMessageOptions = {}): Promise<StreamingResponse> {
    await this.checkBudgetLimit();

    const model = options.model || this.config.defaultModel;
    const maxTokens = options.maxTokens || this.config.maxTokens;
    const temperature = options.temperature || this.config.temperature;

    const messages: Message[] = [
      ...(options.conversationHistory || []),
      { role: 'user', content: message }
    ];

    const requestPayload: any = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages
    };

    if (options.systemPrompt) {
      requestPayload.system = options.systemPrompt;
    }

    const stream = await this.anthropic.messages.stream(requestPayload);

    return {
      [Symbol.asyncIterator]: async function* () {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && 'text' in chunk.delta) {
            yield chunk.delta.text;
          }
        }
      }
    };
  }

  getTokenUsage(): TokenUsageStats {
    return { ...this.tokenUsage };
  }

  resetTokenUsage(): void {
    this.tokenUsage = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      requestCount: 0,
      estimatedCost: 0
    };
  }

  setDefaultModel(model: ClaudeModel): void {
    if (!Object.values(ClaudeModel).includes(model)) {
      throw new Error('Invalid model');
    }
    this.config.defaultModel = model;
  }

  getAvailableModels(): ClaudeModel[] {
    return Object.values(ClaudeModel);
  }

  private updateTokenUsage(usage: TokenUsage, model: ClaudeModel): void {
    this.tokenUsage.totalInputTokens += usage.inputTokens;
    this.tokenUsage.totalOutputTokens += usage.outputTokens;
    this.tokenUsage.totalTokens += usage.totalTokens;
    this.tokenUsage.requestCount += 1;

    // Calculate cost
    const pricing = MODEL_PRICING[model];
    const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
    this.tokenUsage.estimatedCost += inputCost + outputCost;

    // Check budget warning
    if (this.config.budgetLimit < Infinity) {
      const budgetUsedRatio = this.tokenUsage.estimatedCost / this.config.budgetLimit;
      if (budgetUsedRatio >= this.config.budgetWarningThreshold && budgetUsedRatio < 1) {
        console.warn(`Budget warning: ${(budgetUsedRatio * 100).toFixed(1)}% of budget used`);
      }
    }
  }

  private async checkBudgetLimit(): Promise<void> {
    if (this.config.budgetLimit < Infinity && this.tokenUsage.estimatedCost >= this.config.budgetLimit) {
      throw new Error('Budget limit exceeded');
    }
  }

  private isRetryableError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    return errorMessage.includes('rate limit') || 
           errorMessage.includes('timeout') || 
           errorMessage.includes('server error');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}