import { ClaudeClient, ClaudeModel, TokenUsage, StreamingResponse } from '../src/claude-client';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');

describe('ClaudeClient', () => {
  let mockAnthropic: any;
  let client: ClaudeClient;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock Anthropic constructor and methods
    const MockAnthropic = jest.requireMock('@anthropic-ai/sdk').Anthropic;
    mockAnthropic = {
      messages: {
        create: jest.fn(),
        stream: jest.fn()
      }
    };
    MockAnthropic.mockImplementation(() => mockAnthropic);

    // Create client instance
    client = new ClaudeClient({
      apiKey: 'test-api-key',
      defaultModel: ClaudeModel.SONNET,
      maxTokens: 1000,
      temperature: 0.7
    });
  });

  describe('initialization', () => {
    it('should initialize with valid configuration', () => {
      expect(client).toBeInstanceOf(ClaudeClient);
      expect(client.getConfiguration().defaultModel).toBe(ClaudeModel.SONNET);
      expect(client.getConfiguration().maxTokens).toBe(1000);
      expect(client.getConfiguration().temperature).toBe(0.7);
    });

    it('should throw error with invalid API key', () => {
      expect(() => {
        new ClaudeClient({
          apiKey: '',
          defaultModel: ClaudeModel.SONNET
        });
      }).toThrow('API key is required');
    });

    it('should use default values when not provided', () => {
      const defaultClient = new ClaudeClient({
        apiKey: 'test-key'
      });
      
      const config = defaultClient.getConfiguration();
      expect(config.defaultModel).toBe(ClaudeModel.SONNET);
      expect(config.maxTokens).toBe(4096);
      expect(config.temperature).toBe(0.7);
    });
  });

  describe('message sending', () => {
    it('should send simple message and return response', async () => {
      const mockResponse = {
        content: [{ text: 'Hello! How can I help you?' }],
        usage: { input_tokens: 10, output_tokens: 8 },
        model: 'claude-3-sonnet-20240229'
      };
      
      mockAnthropic.messages.create.mockResolvedValue(mockResponse);

      const result = await client.sendMessage('Hello');

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [{ role: 'user', content: 'Hello' }]
      });
      
      expect(result.content).toBe('Hello! How can I help you?');
      expect(result.tokenUsage.inputTokens).toBe(10);
      expect(result.tokenUsage.outputTokens).toBe(8);
    });

    it('should send message with system prompt', async () => {
      const mockResponse = {
        content: [{ text: 'I understand.' }],
        usage: { input_tokens: 15, output_tokens: 3 },
        model: 'claude-3-sonnet-20240229'
      };
      
      mockAnthropic.messages.create.mockResolvedValue(mockResponse);

      await client.sendMessage('Task for you', {
        systemPrompt: 'You are a helpful coding assistant.'
      });

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        temperature: 0.7,
        system: 'You are a helpful coding assistant.',
        messages: [{ role: 'user', content: 'Task for you' }]
      });
    });

    it('should send message with conversation history', async () => {
      const mockResponse = {
        content: [{ text: 'Sure, I can help with that.' }],
        usage: { input_tokens: 25, output_tokens: 7 },
        model: 'claude-3-sonnet-20240229'
      };
      
      mockAnthropic.messages.create.mockResolvedValue(mockResponse);

      const conversationHistory = [
        { role: 'user' as const, content: 'What is TypeScript?' },
        { role: 'assistant' as const, content: 'TypeScript is a superset of JavaScript.' }
      ];

      await client.sendMessage('Can you help me with a TypeScript project?', {
        conversationHistory
      });

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [
          ...conversationHistory,
          { role: 'user', content: 'Can you help me with a TypeScript project?' }
        ]
      });
    });

    it('should override model for specific message', async () => {
      const mockResponse = {
        content: [{ text: 'Quick response' }],
        usage: { input_tokens: 5, output_tokens: 2 },
        model: 'claude-3-haiku-20240307'
      };
      
      mockAnthropic.messages.create.mockResolvedValue(mockResponse);

      await client.sendMessage('Quick question', {
        model: ClaudeModel.HAIKU
      });

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [{ role: 'user', content: 'Quick question' }]
      });
    });
  });

  describe('streaming responses', () => {
    it('should handle streaming response', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { text: 'Hello' } };
          yield { type: 'content_block_delta', delta: { text: ' world' } };
          yield { type: 'message_delta', delta: { usage: { output_tokens: 2 } } };
        }
      };

      mockAnthropic.messages.stream.mockResolvedValue(mockStream);

      const stream = await client.sendMessageStream('Hello');
      const chunks: string[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' world']);
      expect(mockAnthropic.messages.stream).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [{ role: 'user', content: 'Hello' }]
      });
    });

    it('should handle streaming with system prompt and options', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { text: 'Streaming response' } };
        }
      };

      mockAnthropic.messages.stream.mockResolvedValue(mockStream);

      await client.sendMessageStream('Code this', {
        systemPrompt: 'You are a coding assistant.',
        model: ClaudeModel.OPUS,
        maxTokens: 2000
      });

      expect(mockAnthropic.messages.stream).toHaveBeenCalledWith({
        model: 'claude-3-opus-20240229',
        max_tokens: 2000,
        temperature: 0.7,
        system: 'You are a coding assistant.',
        messages: [{ role: 'user', content: 'Code this' }]
      });
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API rate limit exceeded');
      mockAnthropic.messages.create.mockRejectedValue(apiError);

      await expect(client.sendMessage('Hello')).rejects.toThrow('API rate limit exceeded');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network timeout');
      mockAnthropic.messages.create.mockRejectedValue(networkError);

      await expect(client.sendMessage('Hello')).rejects.toThrow('Network timeout');
    });

    it('should handle malformed responses', async () => {
      const malformedResponse = { invalid: 'response' };
      mockAnthropic.messages.create.mockResolvedValue(malformedResponse);

      await expect(client.sendMessage('Hello')).rejects.toThrow('Invalid response format');
    });
  });

  describe('token usage tracking', () => {
    it('should track token usage correctly', async () => {
      const mockResponse1 = {
        content: [{ text: 'Response 1' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-3-sonnet-20240229'
      };
      
      const mockResponse2 = {
        content: [{ text: 'Response 2' }],
        usage: { input_tokens: 15, output_tokens: 8 },
        model: 'claude-3-sonnet-20240229'
      };

      mockAnthropic.messages.create
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      await client.sendMessage('First message');
      await client.sendMessage('Second message');

      const usage = client.getTokenUsage();
      expect(usage.totalInputTokens).toBe(25);
      expect(usage.totalOutputTokens).toBe(13);
      expect(usage.totalTokens).toBe(38);
      expect(usage.requestCount).toBe(2);
    });

    it('should reset token usage', async () => {
      const mockResponse = {
        content: [{ text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-3-sonnet-20240229'
      };

      mockAnthropic.messages.create.mockResolvedValue(mockResponse);
      await client.sendMessage('Message');

      client.resetTokenUsage();
      const usage = client.getTokenUsage();
      
      expect(usage.totalInputTokens).toBe(0);
      expect(usage.totalOutputTokens).toBe(0);
      expect(usage.totalTokens).toBe(0);
      expect(usage.requestCount).toBe(0);
    });

    it('should calculate cost estimates', async () => {
      const mockResponse = {
        content: [{ text: 'Response' }],
        usage: { input_tokens: 1000, output_tokens: 500 },
        model: 'claude-3-sonnet-20240229'
      };

      mockAnthropic.messages.create.mockResolvedValue(mockResponse);
      await client.sendMessage('Message');

      const usage = client.getTokenUsage();
      expect(usage.estimatedCost).toBeGreaterThan(0);
    });
  });

  describe('model switching', () => {
    it('should switch default model', () => {
      client.setDefaultModel(ClaudeModel.OPUS);
      expect(client.getConfiguration().defaultModel).toBe(ClaudeModel.OPUS);
    });

    it('should validate model selection', () => {
      expect(() => {
        client.setDefaultModel('invalid-model' as ClaudeModel);
      }).toThrow('Invalid model');
    });

    it('should get available models', () => {
      const models = client.getAvailableModels();
      expect(models).toContain(ClaudeModel.OPUS);
      expect(models).toContain(ClaudeModel.SONNET);
      expect(models).toContain(ClaudeModel.HAIKU);
    });
  });

  describe('rate limiting and retry logic', () => {
    it('should retry on rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      const successResponse = {
        content: [{ text: 'Success after retry' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-3-sonnet-20240229'
      };

      mockAnthropic.messages.create
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue(successResponse);

      const result = await client.sendMessage('Hello', { maxRetries: 3 });
      expect(result.content).toBe('Success after retry');
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      mockAnthropic.messages.create.mockRejectedValue(rateLimitError);

      await expect(
        client.sendMessage('Hello', { maxRetries: 2 })
      ).rejects.toThrow('Rate limit exceeded');
      
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should respect retry delay', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      const successResponse = {
        content: [{ text: 'Success' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-3-sonnet-20240229'
      };

      mockAnthropic.messages.create
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue(successResponse);

      const startTime = Date.now();
      await client.sendMessage('Hello', { maxRetries: 1, retryDelay: 100 });
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      client.updateConfiguration({
        maxTokens: 2000,
        temperature: 0.5
      });

      const config = client.getConfiguration();
      expect(config.maxTokens).toBe(2000);
      expect(config.temperature).toBe(0.5);
    });

    it('should validate configuration updates', () => {
      expect(() => {
        client.updateConfiguration({
          temperature: 2.5 // Invalid temperature
        });
      }).toThrow('Temperature must be between 0 and 1');

      expect(() => {
        client.updateConfiguration({
          maxTokens: -100 // Invalid max tokens
        });
      }).toThrow('Max tokens must be positive');
    });
  });

  describe('budget management', () => {
    it('should enforce budget limits', async () => {
      // Reset mocks for this test
      jest.clearAllMocks();
      
      const mockResponse = {
        content: [{ text: 'Expensive response' }],
        usage: { input_tokens: 10000, output_tokens: 5000 },
        model: 'claude-3-opus-20240229'
      };

      mockAnthropic.messages.create.mockResolvedValue(mockResponse);

      const budgetClient = new ClaudeClient({
        apiKey: 'test-key',
        budgetLimit: 0.01 // Very low budget
      });

      // First request should succeed
      await budgetClient.sendMessage('Hello');

      // Second request should fail due to budget
      await expect(
        budgetClient.sendMessage('Another expensive request')
      ).rejects.toThrow('Budget limit exceeded');
    });

    it('should warn when approaching budget limit', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Create a response that will trigger the warning
      // Cost calculation: (5000/1M * $15) + (5000/1M * $75) = $0.075 + $0.375 = $0.45
      // But the pricing in the code shows different values. Let's set a low budget.
      const mockResponse = {
        content: [{ text: 'Response' }],
        usage: { input_tokens: 5000, output_tokens: 5000 },
        model: 'claude-3-opus-20240229'
      };

      // Setup the mock for the new client
      const MockAnthropic = jest.requireMock('@anthropic-ai/sdk').Anthropic;
      const mockAnthropicInstance = {
        messages: {
          create: jest.fn().mockResolvedValue(mockResponse)
        }
      };
      MockAnthropic.mockImplementation(() => mockAnthropicInstance);

      const budgetClient = new ClaudeClient({
        apiKey: 'test-key',
        budgetLimit: 0.1, // $0.1 budget - this should trigger warning since cost is $0.09
        budgetWarningThreshold: 0.8 // Warning at 80% = $0.08
      });

      await budgetClient.sendMessage('Hello');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Budget warning')
      );

      consoleSpy.mockRestore();
    });
  });
});