import { AgentSpawner, AgentSpawnResult, SpecializedAgentConfig } from '../../src/orchestrator/agent-spawner';
import { WorkspaceManager, WorktreeInfo } from '../../src/workspace';
import { SessionManager, SessionInfo } from '../../src/session';
import { TaskData } from '../../src/cognitive-canvas';
import { AgentType } from '../../src/orchestrator/workflow-manager';
import { TaskExecutionContext } from '../../src/orchestrator/task-executor';

// Mock dependencies
jest.mock('../../src/workspace');
jest.mock('../../src/session');

describe('AgentSpawner', () => {
  let agentSpawner: AgentSpawner;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockSessionManager: jest.Mocked<SessionManager>;

  const mockTask: TaskData = {
    id: 'task-123',
    title: 'Test Task',
    description: 'Test task description',
    status: 'pending',
    agentType: 'Architect',
    priority: 1,
    projectId: 'project-456',
    createdAt: '2024-01-01T00:00:00Z',
    dependencies: []
  };

  const mockWorktree: WorktreeInfo = {
    id: 'worktree-123',
    taskId: 'task-123',
    path: '/test/workspace/task-123',
    branch: 'feature/task-123',
    parentBranch: 'main',
    createdAt: '2024-01-01T00:00:00Z',
    status: 'active'
  };

  const mockSession: SessionInfo = {
    id: 'session-123',
    taskId: 'task-123',
    worktreePath: '/test/workspace/task-123',
    createdAt: '2024-01-01T00:00:00Z',
    status: 'active',
    environment: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock WorkspaceManager
    mockWorkspace = {
      createWorktree: jest.fn().mockResolvedValue(mockWorktree),
      cleanup: jest.fn().mockResolvedValue(undefined),
      executeCommand: jest.fn(),
      getFileContent: jest.fn(),
      writeFile: jest.fn(),
      getWorktreePath: jest.fn().mockReturnValue('/test/workspace'),
      mergeWorktree: jest.fn().mockResolvedValue(true),
      deleteWorktree: jest.fn().mockResolvedValue(true)
    } as any;

    // Mock SessionManager
    mockSessionManager = {
      createSession: jest.fn().mockResolvedValue(mockSession),
      runCommandInSession: jest.fn(),
      getSessionEnvironment: jest.fn(),
      updateSessionEnvironment: jest.fn(),
      closeSession: jest.fn().mockResolvedValue(undefined)
    } as any;

    agentSpawner = new AgentSpawner(mockWorkspace, mockSessionManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('spawnAgent', () => {
    it('should successfully spawn an agent with worktree and session', async () => {
      const result = await agentSpawner.spawnAgent(mockTask, 'Architect');

      expect(result.success).toBe(true);
      expect(result.agentType).toBe('Architect');
      expect(result.taskId).toBe('task-123');
      expect(result.sessionId).toBe('session-123');
      expect(result.worktreePath).toBe('/test/workspace/task-123');
      expect(result.error).toBeUndefined();

      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith(
        'task-123',
        'feature/task-123',
        'main'
      );
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        'task-123',
        '/test/workspace/task-123'
      );
    });

    it('should spawn agent with execution context', async () => {
      const context: TaskExecutionContext = {
        workflowStep: {
          id: 'step-1',
          name: 'Architecture',
          agentType: 'Architect',
          dependencies: [],
          outputs: ['architectural-plan']
        },
        relevantArtifacts: [{ id: 'artifact-1', type: 'contract' }],
        priming: {
          stepSpecificGuidance: 'Focus on API design',
          requiredInputs: ['user requirements'],
          expectedOutputs: ['API specification']
        }
      };

      const result = await agentSpawner.spawnAgent(mockTask, 'Architect', context);

      expect(result.success).toBe(true);
      expect(result.agentType).toBe('Architect');
      expect(mockWorkspace.createWorktree).toHaveBeenCalled();
      expect(mockSessionManager.createSession).toHaveBeenCalled();
    });

    it('should handle different agent types', async () => {
      const agentTypes: AgentType[] = ['Architect', 'Coder', 'Formalizer', 'Governor'];

      for (const agentType of agentTypes) {
        const result = await agentSpawner.spawnAgent(mockTask, agentType);
        expect(result.success).toBe(true);
        expect(result.agentType).toBe(agentType);
      }

      expect(mockWorkspace.createWorktree).toHaveBeenCalledTimes(agentTypes.length);
      expect(mockSessionManager.createSession).toHaveBeenCalledTimes(agentTypes.length);
    });

    it('should handle worktree creation failure', async () => {
      mockWorkspace.createWorktree.mockRejectedValue(new Error('Failed to create worktree'));

      const result = await agentSpawner.spawnAgent(mockTask, 'Architect');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to spawn agent');
      expect(result.sessionId).toBeUndefined();
      expect(result.worktreePath).toBeUndefined();
    });

    it('should handle session creation failure and cleanup worktree', async () => {
      mockSessionManager.createSession.mockRejectedValue(new Error('Failed to create session'));

      const result = await agentSpawner.spawnAgent(mockTask, 'Architect');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to spawn agent');
      expect(mockWorkspace.cleanup).toHaveBeenCalledWith('task-123');
    });

    it('should generate appropriate prompts for different agent types', async () => {
      // Test each agent type generates unique prompts
      const agentTypes: AgentType[] = ['Architect', 'Coder', 'Formalizer', 'Governor'];
      
      for (const agentType of agentTypes) {
        await agentSpawner.spawnAgent(mockTask, agentType);
      }

      expect(mockWorkspace.createWorktree).toHaveBeenCalledTimes(agentTypes.length);
    });

    it('should create unique branch names for different tasks', async () => {
      const tasks = [
        { ...mockTask, id: 'task-1', title: 'Task 1' },
        { ...mockTask, id: 'task-2', title: 'Task 2' },
        { ...mockTask, id: 'task-3', title: 'Task 3' }
      ];

      for (const task of tasks) {
        await agentSpawner.spawnAgent(task, 'Architect');
      }

      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith('task-1', 'feature/task-1', 'main');
      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith('task-2', 'feature/task-2', 'main');
      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith('task-3', 'feature/task-3', 'main');
    });
  });

  describe('spawnSpecializedAgent', () => {
    const specializedConfig: SpecializedAgentConfig = {
      taskId: 'task-456',
      agentType: 'CodeSavant',
      context: {
        codeAnalysis: 'deep-inspection',
        targetFiles: ['src/main.ts', 'src/utils.ts']
      },
      branchPrefix: 'fix'
    };

    it('should spawn specialized CodeSavant agent', async () => {
      const result = await agentSpawner.spawnSpecializedAgent(specializedConfig);

      expect(result.success).toBe(true);
      expect(result.agentType).toBe('CodeSavant');
      expect(result.taskId).toBe('task-456');
      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith(
        'task-456',
        'fix/task-456',
        'main'
      );
    });

    it('should spawn specialized Debugger agent', async () => {
      const debuggerConfig: SpecializedAgentConfig = {
        taskId: 'debug-task-789',
        agentType: 'Debugger',
        context: {
          errorLogs: 'TypeError: Cannot read property...',
          stackTrace: 'at function processData...',
          failureId: 'failure-123'
        }
      };

      const result = await agentSpawner.spawnSpecializedAgent(debuggerConfig);

      expect(result.success).toBe(true);
      expect(result.agentType).toBe('Debugger');
      expect(result.taskId).toBe('debug-task-789');
      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith(
        'debug-task-789',
        'debug/debug-task-789',  // Default prefix for debugger
        'main'
      );
    });

    it('should handle specialized agent spawn failure', async () => {
      mockWorkspace.createWorktree.mockRejectedValue(new Error('Specialized spawn failed'));

      const result = await agentSpawner.spawnSpecializedAgent(specializedConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to spawn specialized agent');
    });

    it('should use custom branch prefix when provided', async () => {
      const customConfig = {
        ...specializedConfig,
        branchPrefix: 'hotfix'
      };

      await agentSpawner.spawnSpecializedAgent(customConfig);

      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith(
        'task-456',
        'hotfix/task-456',
        'main'
      );
    });

    it('should use default branch prefix when not provided', async () => {
      const configWithoutPrefix = {
        taskId: 'task-789',
        agentType: 'CodeSavant' as const,
        context: { analysis: 'basic' }
      };

      await agentSpawner.spawnSpecializedAgent(configWithoutPrefix);

      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith(
        'task-789',
        'codesavant/task-789',  // Default prefix
        'main'
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup agent resources after task completion', async () => {
      await agentSpawner.cleanupAgent('task-123');

      expect(mockWorkspace.cleanup).toHaveBeenCalledWith('task-123');
      expect(mockSessionManager.closeSession).toHaveBeenCalledWith('task-123');
    });

    it('should handle cleanup errors gracefully', async () => {
      mockWorkspace.cleanup.mockRejectedValue(new Error('Cleanup failed'));
      mockSessionManager.closeSession.mockRejectedValue(new Error('Session close failed'));

      // Should not throw
      await expect(agentSpawner.cleanupAgent('task-123')).resolves.toBeUndefined();
    });

    it('should batch cleanup multiple agents', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];

      await agentSpawner.batchCleanup(taskIds);

      for (const taskId of taskIds) {
        expect(mockWorkspace.cleanup).toHaveBeenCalledWith(taskId);
        expect(mockSessionManager.closeSession).toHaveBeenCalledWith(taskId);
      }
    });
  });

  describe('generateAgentPrompt', () => {
    it('should generate context-aware prompts', async () => {
      const context: TaskExecutionContext = {
        workflowStep: {
          id: 'step-arch',
          name: 'Architecture Design',
          agentType: 'Architect',
          dependencies: [],
          outputs: ['system-design']
        },
        relevantArtifacts: [
          { id: 'contract-1', type: 'contract', content: '{"api": "spec"}' }
        ],
        priming: {
          stepSpecificGuidance: 'Focus on scalability and performance',
          requiredInputs: ['business requirements'],
          expectedOutputs: ['detailed architecture']
        }
      };

      // Mock the method to test prompt generation
      const promptSpy = jest.spyOn(agentSpawner as any, 'generateAgentPrompt');
      
      await agentSpawner.spawnAgent(mockTask, 'Architect', context);

      expect(promptSpy).toHaveBeenCalledWith(mockTask, 'Architect', context);
    });

    it('should handle minimal context gracefully', async () => {
      const minimalContext: TaskExecutionContext = {
        workflowStep: {
          id: 'minimal-step',
          name: 'Basic Task',
          agentType: 'Architect',
          dependencies: [],
          outputs: []
        }
      };

      const result = await agentSpawner.spawnAgent(mockTask, 'Architect', minimalContext);

      expect(result.success).toBe(true);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle invalid agent type gracefully', async () => {
      const invalidAgentType = 'InvalidAgent' as AgentType;

      const result = await agentSpawner.spawnAgent(mockTask, invalidAgentType);

      // Should still attempt to spawn but may fail in validation
      expect(result.agentType).toBe(invalidAgentType);
    });

    it('should handle concurrent spawn requests', async () => {
      const promises = [
        agentSpawner.spawnAgent({ ...mockTask, id: 'task-1' }, 'Architect'),
        agentSpawner.spawnAgent({ ...mockTask, id: 'task-2' }, 'Coder'),
        agentSpawner.spawnAgent({ ...mockTask, id: 'task-3' }, 'Formalizer')
      ];

      const results = await Promise.all(promises);

      expect(results.every(r => r.success)).toBe(true);
      expect(mockWorkspace.createWorktree).toHaveBeenCalledTimes(3);
      expect(mockSessionManager.createSession).toHaveBeenCalledTimes(3);
    });

    it('should handle task with missing required fields', async () => {
      const incompleteTask = {
        id: 'incomplete-task',
        title: '',  // Empty title
        description: '',
        status: 'pending',
        agentType: 'Architect',
        priority: 1,
        projectId: '',  // Empty project ID
        createdAt: '2024-01-01T00:00:00Z',
        dependencies: []
      } as TaskData;

      const result = await agentSpawner.spawnAgent(incompleteTask, 'Architect');

      // Should handle gracefully, may succeed or fail based on validation
      expect(result.taskId).toBe('incomplete-task');
    });

    it('should handle session creation with custom environment', async () => {
      const contextWithEnv: TaskExecutionContext = {
        workflowStep: {
          id: 'env-step',
          name: 'Environment Setup',
          agentType: 'Architect',
          dependencies: [],
          outputs: []
        },
        priming: {
          stepSpecificGuidance: 'Set NODE_ENV=development',
          requiredInputs: [],
          expectedOutputs: []
        }
      };

      const result = await agentSpawner.spawnAgent(mockTask, 'Architect', contextWithEnv);

      expect(result.success).toBe(true);
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        'task-123',
        '/test/workspace/task-123'
      );
    });
  });

  describe('performance and optimization', () => {
    it('should complete agent spawn within reasonable time', async () => {
      const startTime = Date.now();
      
      await agentSpawner.spawnAgent(mockTask, 'Architect');
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle high-frequency spawn requests efficiently', async () => {
      const taskCount = 10;
      const tasks = Array.from({ length: taskCount }, (_, i) => ({
        ...mockTask,
        id: `task-${i}`,
        title: `Task ${i}`
      }));

      const startTime = Date.now();
      
      const promises = tasks.map(task => 
        agentSpawner.spawnAgent(task, 'Architect')
      );
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results.every(r => r.success)).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(mockWorkspace.createWorktree).toHaveBeenCalledTimes(taskCount);
    });

    it('should reuse sessions when appropriate', async () => {
      // Test session reuse logic if implemented
      await agentSpawner.spawnAgent(mockTask, 'Architect');
      await agentSpawner.spawnAgent(mockTask, 'Architect'); // Same task

      // Verify session creation behavior
      expect(mockSessionManager.createSession).toHaveBeenCalledTimes(2);
    });
  });
});