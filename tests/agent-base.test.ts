import { Agent } from '../src/agent-base';
import { ClaudeClient, ClaudeModel, ClaudeResponse, Message } from '../src/claude-client';
import { WorkspaceManager, CommandResult } from '../src/workspace';
import { CognitiveCanvas, TaskData, PheromoneData } from '../src/cognitive-canvas';
import { SessionManager, SessionInfo } from '../src/session';
import { AgentConfig, TaskContext, TaskResult, AgentStatus } from '../src/types/agent-types';
import { AgentErrorHandler } from '../src/agent-error-handling';
import { AgentSessionManager } from '../src/agent-session-management';

// Mock dependencies
jest.mock('../src/claude-client');
jest.mock('../src/workspace');
jest.mock('../src/cognitive-canvas');
jest.mock('../src/session');
jest.mock('../src/agent-error-handling');
jest.mock('../src/agent-session-management');

// Create a concrete implementation for testing
class TestAgent extends Agent {
  async executeTask(task: TaskData, context: TaskContext): Promise<TaskResult> {
    return {
      success: true,
      taskId: task.id,
      output: 'Test execution completed',
      artifacts: [],
      duration: 1000
    };
  }

  getPromptTemplate(): string {
    return 'You are a test agent. Task: {{task}}';
  }

  formatPrompt(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] || match);
  }

  getId(): string {
    return this.config?.id || 'test-agent';
  }

  getRole(): string {
    return this.config?.role || 'TestAgent';
  }

  getCapabilities(): string[] {
    return this.config?.capabilities || ['testing'];
  }

  getStatus(): AgentStatus {
    return this.status;
  }
}

describe('Agent (Base Class)', () => {
  let testAgent: TestAgent;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockCognitiveCanvas: jest.Mocked<CognitiveCanvas>;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockErrorHandler: jest.Mocked<AgentErrorHandler>;
  let mockSessionMgr: jest.Mocked<AgentSessionManager>;

  const mockConfig: AgentConfig = {
    id: 'test-agent-001',
    role: 'TestAgent',
    capabilities: ['testing', 'validation', 'analysis'],
    claudeConfig: {
      apiKey: 'test-api-key',
      defaultModel: ClaudeModel.SONNET,
      maxTokens: 4096,
      temperature: 0.7
    },
    workspaceRoot: '/test/workspace',
    cognitiveCanvasConfig: {
      uri: 'neo4j://localhost:7687',
      username: 'neo4j',
      password: 'password'
    }
  };

  const mockTask: TaskData = {
    id: 'task-123',
    title: 'Test Task',
    description: 'A test task for agent execution',
    status: 'pending',
    priority: 'high',
    projectId: 'project-456',
    createdAt: '2024-01-01T00:00:00Z',
    dependencies: []
  };

  const mockContext: TaskContext = {
    projectId: 'project-456',
    userId: 'user-123',
    sessionId: 'session-789',
    environment: {
      NODE_ENV: 'test',
      WORKSPACE_ROOT: '/test/workspace'
    },
    metadata: {
      priority: 'high',
      timeout: 30000
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ClaudeClient
    mockClaudeClient = {
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Test response from Claude',
        tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        model: 'claude-3-sonnet-20240229'
      }),
      getTokenUsageStats: jest.fn(),
      getCurrentBudget: jest.fn()
    } as any;

    // Mock WorkspaceManager
    mockWorkspace = {
      executeCommand: jest.fn().mockResolvedValue({
        success: true,
        stdout: 'Command executed successfully',
        stderr: '',
        exitCode: 0
      }),
      getWorktreePath: jest.fn().mockReturnValue('/test/workspace'),
      createWorktree: jest.fn(),
      cleanup: jest.fn(),
      getFileContent: jest.fn(),
      writeFile: jest.fn()
    } as any;

    // Mock CognitiveCanvas
    mockCognitiveCanvas = {
      createPheromone: jest.fn().mockResolvedValue({
        id: 'pheromone-123',
        type: 'guide_pheromone',
        strength: 0.8,
        context: 'test-context',
        metadata: {},
        createdAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-12-31T23:59:59Z'
      }),
      initializeSchema: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      updateTaskStatus: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock SessionManager
    mockSessionManager = {
      createSession: jest.fn().mockResolvedValue({
        id: 'session-123',
        taskId: 'task-123',
        status: 'running',
        createdAt: new Date(),
        environment: {}
      }),
      closeSession: jest.fn().mockResolvedValue(undefined),
      runCommandInSession: jest.fn()
    } as any;

    // Mock error handler
    mockErrorHandler = {
      handleError: jest.fn().mockResolvedValue(undefined),
      reportImpasse: jest.fn().mockResolvedValue(undefined),
      createErrorPheromone: jest.fn().mockResolvedValue('error-pheromone-123')
    } as any;

    // Mock session manager
    mockSessionMgr = {
      startTask: jest.fn().mockResolvedValue(undefined),
      endTask: jest.fn().mockResolvedValue(undefined),
      pauseTask: jest.fn().mockResolvedValue(undefined),
      resumeTask: jest.fn().mockResolvedValue(undefined),
      updateProgress: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock constructors
    (ClaudeClient as jest.MockedClass<typeof ClaudeClient>).mockImplementation(() => mockClaudeClient);
    (WorkspaceManager as jest.MockedClass<typeof WorkspaceManager>).mockImplementation(() => mockWorkspace);
    (CognitiveCanvas as jest.MockedClass<typeof CognitiveCanvas>).mockImplementation(() => mockCognitiveCanvas);
    (SessionManager as jest.MockedClass<typeof SessionManager>).mockImplementation(() => mockSessionManager);
    (AgentErrorHandler as jest.MockedClass<typeof AgentErrorHandler>).mockImplementation(() => mockErrorHandler);
    (AgentSessionManager as jest.MockedClass<typeof AgentSessionManager>).mockImplementation(() => mockSessionMgr);

    testAgent = new TestAgent();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await testAgent.initialize(mockConfig);

      expect(testAgent.getId()).toBe('test-agent-001');
      expect(testAgent.getRole()).toBe('TestAgent');
      expect(testAgent.getCapabilities()).toEqual(['testing', 'validation', 'analysis']);
      expect(testAgent.getStatus()).toBe('initialized');
    });

    it('should validate config before initialization', async () => {
      const invalidConfig = { ...mockConfig, id: '' };

      await expect(testAgent.initialize(invalidConfig as any))
        .rejects.toThrow('Invalid agent configuration');
    });

    it('should initialize Claude client with correct parameters', async () => {
      await testAgent.initialize(mockConfig);

      expect(ClaudeClient).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        defaultModel: ClaudeModel.SONNET,
        maxTokens: 4096,
        temperature: 0.7
      });
    });

    it('should initialize workspace manager with workspace root', async () => {
      await testAgent.initialize(mockConfig);

      expect(WorkspaceManager).toHaveBeenCalledWith('/test/workspace');
    });

    it('should initialize cognitive canvas with config', async () => {
      await testAgent.initialize(mockConfig);

      expect(CognitiveCanvas).toHaveBeenCalledWith();
      expect(mockCognitiveCanvas.initializeSchema).toHaveBeenCalledWith(mockConfig.cognitiveCanvasConfig);
    });

    it('should initialize error and session handlers', async () => {
      await testAgent.initialize(mockConfig);

      expect(AgentErrorHandler).toHaveBeenCalledWith(mockConfig, mockCognitiveCanvas);
      expect(AgentSessionManager).toHaveBeenCalledWith(mockConfig, mockCognitiveCanvas);
    });

    it('should handle initialization errors gracefully', async () => {
      (ClaudeClient as jest.MockedClass<typeof ClaudeClient>).mockImplementation(() => {
        throw new Error('Claude client initialization failed');
      });

      await expect(testAgent.initialize(mockConfig))
        .rejects.toThrow('Claude client initialization failed');
    });

    it('should set status to initialized after successful setup', async () => {
      expect(testAgent.getStatus()).toBe('uninitialized');
      
      await testAgent.initialize(mockConfig);
      
      expect(testAgent.getStatus()).toBe('initialized');
    });
  });

  describe('task execution', () => {
    beforeEach(async () => {
      await testAgent.initialize(mockConfig);
    });

    it('should execute task successfully', async () => {
      const result = await testAgent.executeTask(mockTask, mockContext);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('task-123');
      expect(result.output).toBe('Test execution completed');
      expect(mockSessionMgr.startTask).toHaveBeenCalledWith(mockTask, mockContext);
      expect(mockSessionMgr.endTask).toHaveBeenCalledWith(mockTask, result);
    });

    it('should handle task execution errors', async () => {
      const error = new Error('Task execution failed');
      jest.spyOn(testAgent, 'executeTask').mockRejectedValue(error);

      await expect(testAgent.executeTask(mockTask, mockContext))
        .rejects.toThrow('Task execution failed');
    });

    it('should update task status in cognitive canvas', async () => {
      await testAgent.executeTask(mockTask, mockContext);

      expect(mockCognitiveCanvas.updateTaskStatus).toHaveBeenCalledWith(
        'task-123',
        'in_progress'
      );
    });

    it('should track current task during execution', async () => {
      const executionPromise = testAgent.executeTask(mockTask, mockContext);
      
      // Task should be set as current during execution
      expect((testAgent as any).currentTask).toBe(mockTask);
      expect((testAgent as any).taskContext).toBe(mockContext);
      
      await executionPromise;
    });

    it('should handle task timeout', async () => {
      const timeoutContext = { ...mockContext, metadata: { ...mockContext.metadata, timeout: 100 } };
      
      // Mock a long-running task
      jest.spyOn(testAgent, 'executeTask').mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          taskId: mockTask.id,
          output: 'Delayed result',
          artifacts: [],
          duration: 200
        }), 200))
      );

      const result = await testAgent.executeTask(mockTask, timeoutContext);
      
      // Should handle timeout appropriately
      expect(result).toBeDefined();
    });
  });

  describe('Claude interaction', () => {
    beforeEach(async () => {
      await testAgent.initialize(mockConfig);
    });

    it('should send messages to Claude', async () => {
      const message = 'Test message to Claude';
      const response = await testAgent.sendMessage(message);

      expect(mockClaudeClient.sendMessage).toHaveBeenCalledWith(message, undefined);
      expect(response.content).toBe('Test response from Claude');
    });

    it('should send messages with options', async () => {
      const message = 'Test message';
      const options = { maxTokens: 2000, temperature: 0.5 };
      
      await testAgent.sendMessage(message, options);

      expect(mockClaudeClient.sendMessage).toHaveBeenCalledWith(message, options);
    });

    it('should handle Claude client errors', async () => {
      mockClaudeClient.sendMessage.mockRejectedValue(new Error('Claude API error'));

      await expect(testAgent.sendMessage('Test message'))
        .rejects.toThrow('Claude API error');
    });

    it('should maintain conversation history', async () => {
      await testAgent.sendMessage('First message');
      await testAgent.sendMessage('Second message');

      const history = testAgent.getConversationHistory();
      
      expect(history).toHaveLength(4); // 2 user messages + 2 assistant responses
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await testAgent.initialize(mockConfig);
    });

    it('should handle errors through error handler', async () => {
      const error = new Error('Test error');
      
      await testAgent.handleError(error);

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, mockContext);
    });

    it('should report impasses', async () => {
      const reason = 'Cannot proceed with current approach';
      
      await testAgent.reportImpasse(reason);

      expect(mockErrorHandler.reportImpasse).toHaveBeenCalledWith(reason);
    });

    it('should track last error', async () => {
      const error = new Error('Test error');
      
      await testAgent.handleError(error);

      expect(testAgent.getLastError()).toBe(error);
    });

    it('should create error pheromones', async () => {
      const error = new Error('Test error');
      
      await testAgent.handleError(error);

      expect(mockErrorHandler.createErrorPheromone).toHaveBeenCalled();
    });
  });

  describe('session management', () => {
    beforeEach(async () => {
      await testAgent.initialize(mockConfig);
    });

    it('should manage task sessions', async () => {
      await testAgent.executeTask(mockTask, mockContext);

      expect(mockSessionMgr.startTask).toHaveBeenCalledWith(mockTask, mockContext);
      expect(mockSessionMgr.endTask).toHaveBeenCalled();
    });

    it('should pause and resume tasks', async () => {
      await testAgent.pauseCurrentTask();
      expect(mockSessionMgr.pauseTask).toHaveBeenCalled();

      await testAgent.resumeCurrentTask();
      expect(mockSessionMgr.resumeTask).toHaveBeenCalled();
    });

    it('should update task progress', async () => {
      const progress = 0.75;
      
      await testAgent.updateProgress(progress);

      expect(mockSessionMgr.updateProgress).toHaveBeenCalledWith(progress);
    });

    it('should handle session creation errors', async () => {
      mockSessionManager.createSession.mockRejectedValue(new Error('Session creation failed'));

      // Should handle gracefully and continue with task execution
      const result = await testAgent.executeTask(mockTask, mockContext);
      
      expect(result.success).toBe(true); // Task should still succeed
    });
  });

  describe('workspace operations', () => {
    beforeEach(async () => {
      await testAgent.initialize(mockConfig);
    });

    it('should execute commands in workspace', async () => {
      const command = 'npm test';
      
      const result = await testAgent.executeCommand(command);

      expect(mockWorkspace.executeCommand).toHaveBeenCalledWith(command);
      expect(result.success).toBe(true);
    });

    it('should read files from workspace', async () => {
      const filePath = '/test/file.txt';
      const content = 'Test file content';
      mockWorkspace.getFileContent.mockResolvedValue(content);

      const result = await testAgent.readFile(filePath);

      expect(mockWorkspace.getFileContent).toHaveBeenCalledWith(filePath);
      expect(result).toBe(content);
    });

    it('should write files to workspace', async () => {
      const filePath = '/test/output.txt';
      const content = 'Generated content';

      await testAgent.writeFile(filePath, content);

      expect(mockWorkspace.writeFile).toHaveBeenCalledWith(filePath, content);
    });

    it('should handle workspace command failures', async () => {
      mockWorkspace.executeCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'Command failed',
        exitCode: 1
      });

      const result = await testAgent.executeCommand('failing-command');

      expect(result.success).toBe(false);
      expect(result.stderr).toBe('Command failed');
    });
  });

  describe('pheromone creation', () => {
    beforeEach(async () => {
      await testAgent.initialize(mockConfig);
    });

    it('should create guide pheromones', async () => {
      const context = 'successful-approach';
      const metadata = { strategy: 'test-driven-development' };

      await testAgent.createGuidePheromone(context, metadata);

      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith({
        type: 'guide_pheromone',
        context: 'successful-approach',
        strength: expect.any(Number),
        metadata: expect.objectContaining({
          agentId: 'test-agent-001',
          strategy: 'test-driven-development'
        }),
        ttl: expect.any(Number)
      });
    });

    it('should create warn pheromones', async () => {
      const context = 'failed-approach';
      const metadata = { error: 'timeout' };

      await testAgent.createWarnPheromone(context, metadata);

      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith({
        type: 'warn_pheromone',
        context: 'failed-approach',
        strength: expect.any(Number),
        metadata: expect.objectContaining({
          agentId: 'test-agent-001',
          error: 'timeout'
        }),
        ttl: expect.any(Number)
      });
    });

    it('should set appropriate pheromone strength', async () => {
      await testAgent.createGuidePheromone('test-context', {}, 0.9);

      const call = mockCognitiveCanvas.createPheromone.mock.calls[0][0];
      expect(call.strength).toBe(0.9);
    });
  });

  describe('cleanup and lifecycle', () => {
    beforeEach(async () => {
      await testAgent.initialize(mockConfig);
    });

    it('should cleanup resources on shutdown', async () => {
      await testAgent.shutdown();

      expect(mockCognitiveCanvas.close).toHaveBeenCalled();
      expect(mockSessionManager.closeSession).toHaveBeenCalled();
      expect(testAgent.getStatus()).toBe('shutdown');
    });

    it('should handle cleanup errors gracefully', async () => {
      mockCognitiveCanvas.close.mockRejectedValue(new Error('Cleanup failed'));

      // Should not throw
      await expect(testAgent.shutdown()).resolves.not.toThrow();
    });

    it('should prevent operations after shutdown', async () => {
      await testAgent.shutdown();

      await expect(testAgent.executeTask(mockTask, mockContext))
        .rejects.toThrow('Agent has been shutdown');
    });
  });

  describe('status management', () => {
    it('should track status throughout lifecycle', async () => {
      expect(testAgent.getStatus()).toBe('uninitialized');

      await testAgent.initialize(mockConfig);
      expect(testAgent.getStatus()).toBe('initialized');

      // Status changes during task execution would be tested in concrete implementations
      
      await testAgent.shutdown();
      expect(testAgent.getStatus()).toBe('shutdown');
    });

    it('should provide status information', () => {
      expect(testAgent.getStatus()).toBeDefined();
      expect(['uninitialized', 'initialized', 'running', 'error', 'shutdown']).toContain(testAgent.getStatus());
    });
  });

  describe('prompt handling', () => {
    beforeEach(async () => {
      await testAgent.initialize(mockConfig);
    });

    it('should format prompts with variables', () => {
      const template = 'Hello {{name}}, your task is {{task}}';
      const variables = { name: 'Agent', task: 'testing' };

      const formatted = testAgent.formatPrompt(template, variables);

      expect(formatted).toBe('Hello Agent, your task is testing');
    });

    it('should handle missing variables in prompt', () => {
      const template = 'Hello {{name}}, your task is {{task}}';
      const variables = { name: 'Agent' }; // Missing 'task'

      const formatted = testAgent.formatPrompt(template, variables);

      expect(formatted).toBe('Hello Agent, your task is {{task}}');
    });

    it('should provide prompt template', () => {
      const template = testAgent.getPromptTemplate();

      expect(template).toBeDefined();
      expect(typeof template).toBe('string');
      expect(template.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle operations before initialization', async () => {
      await expect(testAgent.executeTask(mockTask, mockContext))
        .rejects.toThrow('Agent not initialized');
    });

    it('should handle null/undefined task', async () => {
      await testAgent.initialize(mockConfig);

      await expect(testAgent.executeTask(null as any, mockContext))
        .rejects.toThrow();
    });

    it('should handle malformed config', async () => {
      const malformedConfig = { ...mockConfig, claudeConfig: null };

      await expect(testAgent.initialize(malformedConfig as any))
        .rejects.toThrow();
    });

    it('should handle concurrent task execution', async () => {
      await testAgent.initialize(mockConfig);

      const task1 = { ...mockTask, id: 'task-1' };
      const task2 = { ...mockTask, id: 'task-2' };

      // Should handle concurrent execution appropriately
      const promises = [
        testAgent.executeTask(task1, mockContext),
        testAgent.executeTask(task2, mockContext)
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle very large task contexts', async () => {
      await testAgent.initialize(mockConfig);

      const largeContext = {
        ...mockContext,
        metadata: {
          ...mockContext.metadata,
          largeData: 'x'.repeat(100000) // 100KB of data
        }
      };

      const result = await testAgent.executeTask(mockTask, largeContext);

      expect(result.success).toBe(true);
    });
  });
});