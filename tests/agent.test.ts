import * as fs from 'fs';
import { Agent } from '../src/agent';
import { ClaudeClient, ClaudeModel } from '../src/claude-client';
import { WorkspaceManager } from '../src/workspace';
import { CognitiveCanvas } from '../src/cognitive-canvas';
import { SessionManager } from '../src/session';

// Mock dependencies
jest.mock('../src/claude-client');
jest.mock('../src/workspace');
jest.mock('../src/cognitive-canvas');
jest.mock('../src/session');
jest.mock('fs');

describe('Agent Base Class', () => {
  let agent: TestAgent;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockCognitiveCanvas: jest.Mocked<CognitiveCanvas>;
  let mockSessionManager: jest.Mocked<SessionManager>;

  // Test implementation of abstract Agent class
  class TestAgent extends Agent {
    async executeTask(): Promise<any> {
      return { success: true, result: 'test completed' };
    }

    getPromptTemplate(): string {
      return 'Test agent prompt template with context: {{context}}';
    }
  }

  const mockConfig = {
    id: 'test-agent-1',
    role: 'tester',
    capabilities: ['testing', 'validation'],
    claudeConfig: {
      apiKey: 'test-api-key',
      defaultModel: ClaudeModel.SONNET
    },
    workspaceRoot: '/test/workspace',
    cognitiveCanvasConfig: {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'test'
    }
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock constructor implementations
    mockClaudeClient = {
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Test response',
        tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        model: 'claude-3-sonnet-20240229'
      }),
      getConfiguration: jest.fn(),
      updateConfiguration: jest.fn(),
      sendMessageStream: jest.fn(),
      getTokenUsage: jest.fn(),
      resetTokenUsage: jest.fn(),
      setDefaultModel: jest.fn(),
      getAvailableModels: jest.fn()
    } as any;

    (ClaudeClient as jest.MockedClass<typeof ClaudeClient>).mockImplementation(() => mockClaudeClient);

    mockWorkspace = {
      executeCommand: jest.fn().mockResolvedValue({
        stdout: 'command output',
        stderr: '',
        exitCode: 0
      }),
      getWorktreePath: jest.fn().mockReturnValue('/test/workspace/task-1'),
      getProjectRoot: jest.fn(),
      createWorktree: jest.fn(),
      removeWorktree: jest.fn(),
      listWorktrees: jest.fn(),
      commitChanges: jest.fn(),
      mergeToBranch: jest.fn(),
      getWorktreeStatus: jest.fn()
    } as any;

    (WorkspaceManager as jest.MockedClass<typeof WorkspaceManager>).mockImplementation(() => mockWorkspace);

    mockCognitiveCanvas = {
      createPheromone: jest.fn().mockResolvedValue({
        id: 'pheromone-1',
        type: 'progress',
        strength: 0.8,
        context: 'test context',
        metadata: {},
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }),
      initializeSchema: jest.fn(),
      createProject: jest.fn(),
      getProject: jest.fn(),
      updateProjectStatus: jest.fn(),
      createTask: jest.fn(),
      createTaskDependency: jest.fn(),
      getTasksByProject: jest.fn(),
      getTaskDependencies: jest.fn(),
      createAgent: jest.fn(),
      assignAgentToTask: jest.fn(),
      getAgentAssignments: jest.fn(),
      linkPheromoneToTask: jest.fn(),
      getPheromonesByType: jest.fn(),
      cleanExpiredPheromones: jest.fn(),
      storeArchitecturalDecision: jest.fn(),
      getArchitecturalDecisionsByProject: jest.fn(),
      getProjectKnowledgeGraph: jest.fn(),
      findSimilarTasks: jest.fn(),
      close: jest.fn()
    } as any;

    (CognitiveCanvas as jest.MockedClass<typeof CognitiveCanvas>).mockImplementation(() => mockCognitiveCanvas);

    mockSessionManager = {
      createSession: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        taskId: 'task-1',
        status: 'running',
        createdAt: new Date()
      }),
      runCommandInSession: jest.fn(),
      attachToSession: jest.fn(),
      killSession: jest.fn(),
      listSessions: jest.fn(),
      getSessionStatus: jest.fn(),
      listActiveTmuxSessions: jest.fn(),
      startAgentInSession: jest.fn(),
      monitorSession: jest.fn(),
      getSessionOutput: jest.fn(),
      cleanupDeadSessions: jest.fn()
    } as any;

    (SessionManager as jest.MockedClass<typeof SessionManager>).mockImplementation(() => mockSessionManager);

    const fs = require('fs');
    fs.readFileSync = jest.fn().mockReturnValue('test file content');
    fs.writeFileSync = jest.fn();
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();

    agent = new TestAgent();
  });

  describe('Initialization', () => {
    it('should initialize agent with valid configuration', async () => {
      await expect(agent.initialize(mockConfig)).resolves.not.toThrow();
      expect(agent.getId()).toBe(mockConfig.id);
      expect(agent.getRole()).toBe(mockConfig.role);
      expect(agent.getCapabilities()).toEqual(mockConfig.capabilities);
      expect(agent.getStatus()).toBe('initialized');
    });

    it('should validate configuration', async () => {
      await expect(agent.initialize({ ...mockConfig, id: '' }))
        .rejects.toThrow('Agent ID is required');
      await expect(agent.initialize({ ...mockConfig, role: '' }))
        .rejects.toThrow('Agent role is required');
      await expect(agent.initialize({ ...mockConfig, capabilities: [] }))
        .rejects.toThrow('Agent capabilities are required');
    });
  });

  describe('Task Management', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
    });

    it('should receive task with context', async () => {
      const task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'A test task',
        status: 'pending',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const context = {
        projectInfo: { name: 'Test Project' },
        dependencies: [],
        files: ['test.ts']
      };

      await expect(agent.receiveTask(task, context)).resolves.not.toThrow();
      expect(agent.getCurrentTask()).toEqual(task);
      expect(agent.getTaskContext()).toEqual(context);
      expect(agent.getStatus()).toBe('assigned');
    });

    it('should reject task when already assigned', async () => {
      const task1 = {
        id: 'task-1',
        title: 'First Task',
        description: 'Description',
        status: 'pending',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const task2 = {
        id: 'task-2',
        title: 'Second Task',
        description: 'Description',
        status: 'pending',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await agent.receiveTask(task1, {});
      await expect(agent.receiveTask(task2, {})).rejects.toThrow('Agent already has an assigned task');
    });

    it('should execute task and return result', async () => {
      const task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'A test task',
        status: 'pending',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await agent.receiveTask(task, {});
      const result = await agent.run();
      
      expect(result).toEqual({
        success: true,
        result: { success: true, result: 'test completed' },
        metadata: {
          taskId: task.id,
          agentId: mockConfig.id,
          completedAt: expect.any(String)
        }
      });
      expect(agent.getStatus()).toBe('completed');
    });

    it('should handle task execution errors', async () => {
      class ErrorAgent extends Agent {
        async executeTask(): Promise<any> {
          throw new Error('Task execution failed');
        }
        getPromptTemplate(): string {
          return 'Error test template';
        }
      }

      const errorAgent = new ErrorAgent();
      await errorAgent.initialize(mockConfig);

      const task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'A test task',
        status: 'pending',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await errorAgent.receiveTask(task, {});
      
      await expect(errorAgent.run()).rejects.toThrow('Task execution failed');
      expect(errorAgent.getStatus()).toBe('error');
    });
  });

  describe('Claude API Integration', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
    });

    it('should send message to Claude and handle responses', async () => {
      const response = await agent.sendToClaude('Test message', { systemPrompt: 'System context' });
      
      expect(mockClaudeClient.sendMessage).toHaveBeenCalledWith('Test message', 
        expect.objectContaining({
          systemPrompt: 'System context',
          model: ClaudeModel.SONNET,
          conversationHistory: expect.any(Array)
        })
      );
      expect(response.content).toBe('Test response');
    });

    it('should handle Claude API errors', async () => {
      mockClaudeClient.sendMessage.mockRejectedValue(new Error('API Error'));
      await expect(agent.sendToClaude('test')).rejects.toThrow('Claude API error: API Error');
    });
  });

  describe('Workspace Operations', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
    });

    it('should handle file operations', async () => {
      const fs = require('fs');
      fs.readFileSync.mockReturnValue('test content');

      const result = await agent.readFile('test.ts');
      expect(result).toBe('test content');

      await agent.writeFile('test.ts', 'new content');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should execute commands in workspace', async () => {
      const task = { id: 'task-1', title: 'Test Task', description: 'A test task', 
                    status: 'pending', priority: 'high', projectId: 'project-1', 
                    createdAt: new Date().toISOString() };

      await agent.receiveTask(task, {});
      const result = await agent.executeCommand('npm test');
      expect(result.exitCode).toBe(0);
    });

    it('should handle file operation errors', async () => {
      const fs = require('fs');
      fs.readFileSync.mockImplementation(() => { throw new Error('File not found'); });
      await expect(agent.readFile('nonexistent.ts')).rejects.toThrow('Failed to read file: File not found');
    });
  });

  describe('Progress Reporting', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
    });

    it('should report progress with different levels', async () => {
      await agent.reportProgress('in_progress', 'Working on implementation');
      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'progress',
          strength: 0.5,
          context: 'in_progress',
          metadata: expect.objectContaining({ details: 'Working on implementation' })
        })
      );

      await agent.reportProgress('completed', 'Task finished', 0.9);
      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({ strength: 0.9, context: 'completed' })
      );
    });

    it('should handle progress reporting errors gracefully', async () => {
      mockCognitiveCanvas.createPheromone.mockRejectedValue(new Error('Canvas error'));
      await expect(agent.reportProgress('test', 'test')).resolves.not.toThrow();
    });
  });

  describe('Impasse Reporting', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
    });

    it('should report impasse with different urgency levels', async () => {
      await agent.reportImpasse('Unable to resolve dependency conflict');
      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'impasse',
          strength: 0.8,
          metadata: expect.objectContaining({
            reason: 'Unable to resolve dependency conflict',
            urgency: 'medium'
          })
        })
      );

      await agent.reportImpasse('Critical failure', { errorCode: 500 }, 'high');
      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          strength: 0.95,
          metadata: expect.objectContaining({
            urgency: 'high',
            additionalContext: { errorCode: 500 }
          })
        })
      );
    });

    it('should include context when available', async () => {
      const task = { id: 'task-1', title: 'Test Task', description: 'A test task', 
                    status: 'pending', priority: 'high', projectId: 'project-1', 
                    createdAt: new Date().toISOString() };

      await agent.receiveTask(task, {});
      agent['conversationHistory'] = [{ role: 'user', content: 'msg' }, { role: 'assistant', content: 'reply' }];
      agent.setLastError(new Error('Previous error'));

      await agent.reportImpasse('Stuck on task');

      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            taskId: task.id,
            conversationLength: 2,
            lastError: 'Previous error'
          })
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockCognitiveCanvas.createPheromone.mockRejectedValue(new Error('Canvas error'));
      await expect(agent.reportImpasse('Test impasse')).resolves.not.toThrow();

      agent['cognitiveCanvas'] = null;
      await expect(agent.reportImpasse('Test impasse')).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
    });

    it('should handle errors and report as pheromones', async () => {
      const error = new Error('Test error');
      await agent.handleError(error);
      
      expect(agent.getStatus()).toBe('error');
      expect(agent.getLastError()).toBe(error);
      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          strength: 0.8,
          metadata: expect.objectContaining({ error: error.message })
        })
      );
    });

    it('should reset and recover', async () => {
      await agent.handleError(new Error('Recoverable error'));
      expect(agent.getStatus()).toBe('error');
      
      await agent.reset();
      expect(agent.getStatus()).toBe('initialized');
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
    });

    it('should create and manage sessions', async () => {
      const task = { id: 'task-1', title: 'Test Task', description: 'A test task', 
                    status: 'pending', priority: 'high', projectId: 'project-1', 
                    createdAt: new Date().toISOString() };

      await agent.receiveTask(task, {});
      await agent.createSession();
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(task.id, expect.any(String));

      mockSessionManager.runCommandInSession = jest.fn().mockResolvedValue({
        output: 'success', exitCode: 0, timestamp: new Date() });
      
      const result = await agent.runInSession('npm install');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Prompt Template Processing', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
    });

    it('should format prompts and handle templates', async () => {
      const formatted = agent.formatPrompt('Working on {{project}} for {{task}}', 
                                          { project: 'TestProject', task: 'implementation' });
      expect(formatted).toBe('Working on TestProject for implementation');

      expect(agent.getPromptTemplate()).toBe('Test agent prompt template with context: {{context}}');

      const partial = agent.formatPrompt('Project: {{project}}, Task: {{missing}}', { project: 'Test' });
      expect(partial).toBe('Project: Test, Task: {{missing}}');
    });
  });

  describe('Configuration Management', () => {
    it('should manage configuration updates', async () => {
      await agent.initialize(mockConfig);
      
      agent.updateConfig({ capabilities: ['testing', 'validation', 'deployment'] });
      expect(agent.getCapabilities()).toEqual(['testing', 'validation', 'deployment']);

      const config = agent.getConfig();
      expect(config!.id).toBe(mockConfig.id);
      expect(config!.role).toBe(mockConfig.role);
    });
  });

  describe('Status Management', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
    });

    it('should manage status transitions and reset', async () => {
      expect(agent.getStatus()).toBe('initialized');

      const task = { id: 'task-1', title: 'Test Task', description: 'A test task', 
                    status: 'pending', priority: 'high', projectId: 'project-1', 
                    createdAt: new Date().toISOString() };

      await agent.receiveTask(task, {});
      expect(agent.getStatus()).toBe('assigned');

      agent.setStatus('running');
      expect(agent.getStatus()).toBe('running');

      await agent.run();
      expect(agent.getStatus()).toBe('completed');

      await agent.reset();
      expect(agent.getStatus()).toBe('initialized');
      expect(agent.getCurrentTask()).toBeNull();
    });
  });

  // Persona functionality tests removed for 1.0.0 release compliance
  // Persona features are implemented but not integrated into base Agent class
});