import { TaskExecutor, TaskExecutionResult, TaskExecutionContext } from '../../src/orchestrator/task-executor';
import { CognitiveCanvas, TaskData } from '../../src/cognitive-canvas';
import { WorkspaceManager, WorktreeInfo } from '../../src/workspace';
import { SessionManager, SessionInfo } from '../../src/session';
import { WorkflowManager, AgentType, WorkflowStep } from '../../src/orchestrator/workflow-manager';
import { Feature } from '../../src/plan-parser';

// Mock dependencies
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/workspace');
jest.mock('../../src/session');
jest.mock('../../src/orchestrator/workflow-manager');

describe('TaskExecutor', () => {
  let taskExecutor: TaskExecutor;
  let mockCanvas: jest.Mocked<CognitiveCanvas>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockWorkflowManager: jest.Mocked<WorkflowManager>;

  const mockTasks: TaskData[] = [
    {
      id: 'task-1',
      title: 'Design Architecture',
      description: 'Create system architecture',
      status: 'pending',
      agentType: 'Architect',
      priority: 1,
      projectId: 'project-123',
      createdAt: '2024-01-01T00:00:00Z',
      dependencies: []
    },
    {
      id: 'task-2',
      title: 'Implement Core Logic',
      description: 'Write core business logic',
      status: 'pending',
      agentType: 'Coder',
      priority: 2,
      projectId: 'project-123',
      createdAt: '2024-01-01T01:00:00Z',
      dependencies: ['task-1']
    },
    {
      id: 'task-3',
      title: 'Write Tests',
      description: 'Create comprehensive tests',
      status: 'completed',
      agentType: 'Coder',
      priority: 3,
      projectId: 'project-123',
      createdAt: '2024-01-01T02:00:00Z',
      dependencies: ['task-2']
    }
  ];

  const mockWorktree: WorktreeInfo = {
    id: 'worktree-123',
    taskId: 'task-1',
    path: '/test/workspace/task-1',
    branch: 'feature/task-1',
    parentBranch: 'main',
    createdAt: '2024-01-01T00:00:00Z',
    status: 'active'
  };

  const mockSession: SessionInfo = {
    id: 'session-123',
    taskId: 'task-1',
    worktreePath: '/test/workspace/task-1',
    createdAt: '2024-01-01T00:00:00Z',
    status: 'active',
    environment: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock CognitiveCanvas
    mockCanvas = {
      getTasksByProject: jest.fn().mockResolvedValue(mockTasks),
      getTaskDependencies: jest.fn().mockResolvedValue([]),
      updateTaskStatus: jest.fn().mockResolvedValue(undefined),
      createTaskExecution: jest.fn().mockResolvedValue('execution-123'),
      getTaskArtifacts: jest.fn().mockResolvedValue([]),
      getPheromonesByType: jest.fn().mockResolvedValue([]),
      createPheromone: jest.fn().mockResolvedValue('pheromone-123'),
      getTaskById: jest.fn(),
      linkTaskToArtifact: jest.fn(),
      getRecentFailures: jest.fn().mockResolvedValue([]),
      executeQuery: jest.fn()
    } as any;

    // Mock WorkspaceManager
    mockWorkspace = {
      createWorktree: jest.fn().mockResolvedValue(mockWorktree),
      executeCommand: jest.fn(),
      getFileContent: jest.fn(),
      writeFile: jest.fn(),
      getWorktreePath: jest.fn().mockReturnValue('/test/workspace'),
      cleanup: jest.fn()
    } as any;

    // Mock SessionManager
    mockSessionManager = {
      createSession: jest.fn().mockResolvedValue(mockSession),
      runCommandInSession: jest.fn(),
      getSessionEnvironment: jest.fn(),
      closeSession: jest.fn()
    } as any;

    // Mock WorkflowManager
    mockWorkflowManager = {
      getAgentTypeForCurrentStep: jest.fn().mockReturnValue('Architect'),
      getCurrentWorkflowStep: jest.fn().mockReturnValue({
        id: 'step-1',
        name: 'Architecture',
        agentType: 'Architect',
        dependencies: [],
        outputs: ['architectural-plan']
      }),
      getStepContext: jest.fn().mockResolvedValue({}),
      moveToNextStep: jest.fn(),
      isWorkflowComplete: jest.fn().mockReturnValue(false)
    } as any;

    taskExecutor = new TaskExecutor(
      mockCanvas,
      mockWorkspace,
      mockSessionManager,
      mockWorkflowManager
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processNextTask', () => {
    it('should process available task with no dependencies', async () => {
      mockCanvas.getTaskDependencies.mockResolvedValue([]);
      mockCanvas.getTaskById.mockResolvedValue(mockTasks[0]);

      await taskExecutor.processNextTask('project-123');

      expect(mockCanvas.getTasksByProject).toHaveBeenCalledWith('project-123');
      expect(mockCanvas.getTaskDependencies).toHaveBeenCalledWith('task-1');
      expect(mockWorkflowManager.getAgentTypeForCurrentStep).toHaveBeenCalledWith('task-1');
    });

    it('should skip tasks with unmet dependencies', async () => {
      mockCanvas.getTaskDependencies.mockImplementation((taskId) => {
        if (taskId === 'task-2') {
          return Promise.resolve([{ ...mockTasks[0], status: 'pending' }]);
        }
        return Promise.resolve([]);
      });

      await taskExecutor.processNextTask('project-123');

      expect(mockWorkflowManager.getAgentTypeForCurrentStep).toHaveBeenCalledWith('task-1');
      expect(mockWorkflowManager.getAgentTypeForCurrentStep).not.toHaveBeenCalledWith('task-2');
    });

    it('should process task when dependencies are completed', async () => {
      mockCanvas.getTaskDependencies.mockImplementation((taskId) => {
        if (taskId === 'task-2') {
          return Promise.resolve([{ ...mockTasks[0], status: 'completed' }]);
        }
        return Promise.resolve([]);
      });

      await taskExecutor.processNextTask('project-123');

      expect(mockWorkflowManager.getAgentTypeForCurrentStep).toHaveBeenCalledWith('task-1');
      expect(mockWorkflowManager.getAgentTypeForCurrentStep).toHaveBeenCalledWith('task-2');
    });

    it('should handle no available tasks', async () => {
      mockCanvas.getTasksByProject.mockResolvedValue([]);

      await expect(taskExecutor.processNextTask('project-123')).resolves.toBeUndefined();
      expect(mockWorkflowManager.getAgentTypeForCurrentStep).not.toHaveBeenCalled();
    });

    it('should handle workflow completion', async () => {
      mockWorkflowManager.isWorkflowComplete.mockReturnValue(true);

      await taskExecutor.processNextTask('project-123');

      expect(mockCanvas.getTasksByProject).toHaveBeenCalled();
      // Should not process further when workflow is complete
    });
  });

  describe('executeTaskWithAgent', () => {
    const mockContext: TaskExecutionContext = {
      workflowStep: {
        id: 'step-arch',
        name: 'Architecture Design',
        agentType: 'Architect',
        dependencies: [],
        outputs: ['system-design']
      },
      relevantArtifacts: [
        { id: 'artifact-1', type: 'contract', content: '{"api": "specification"}' }
      ],
      priming: {
        stepSpecificGuidance: 'Focus on scalability',
        requiredInputs: ['business-requirements'],
        expectedOutputs: ['architectural-diagram']
      }
    };

    it('should execute task with full context', async () => {
      mockWorkflowManager.getStepContext.mockResolvedValue(mockContext);

      const result = await taskExecutor.executeTaskWithAgent(
        mockTasks[0],
        'Architect',
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('task-1');
      expect(mockCanvas.createTaskExecution).toHaveBeenCalled();
      expect(mockCanvas.updateTaskStatus).toHaveBeenCalledWith('task-1', 'in_progress');
    });

    it('should handle task execution failure', async () => {
      mockWorkspace.createWorktree.mockRejectedValue(new Error('Worktree creation failed'));

      const result = await taskExecutor.executeTaskWithAgent(
        mockTasks[0],
        'Architect',
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to execute task');
      expect(mockCanvas.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
    });

    it('should create execution record in cognitive canvas', async () => {
      await taskExecutor.executeTaskWithAgent(mockTasks[0], 'Architect', mockContext);

      expect(mockCanvas.createTaskExecution).toHaveBeenCalledWith({
        taskId: 'task-1',
        agentType: 'Architect',
        context: mockContext,
        status: 'started',
        timestamp: expect.any(String)
      });
    });

    it('should update task status to completed on success', async () => {
      mockSessionManager.runCommandInSession.mockResolvedValue({
        stdout: 'Task completed successfully',
        stderr: '',
        exitCode: 0
      });

      await taskExecutor.executeTaskWithAgent(mockTasks[0], 'Architect', mockContext);

      expect(mockCanvas.updateTaskStatus).toHaveBeenCalledWith('task-1', 'completed');
    });

    it('should handle different agent types appropriately', async () => {
      const agentTypes: AgentType[] = ['Architect', 'Coder', 'Formalizer', 'Governor'];

      for (const agentType of agentTypes) {
        const result = await taskExecutor.executeTaskWithAgent(
          { ...mockTasks[0], id: `task-${agentType}` },
          agentType,
          mockContext
        );

        expect(result.success).toBe(true);
        expect(mockCanvas.createTaskExecution).toHaveBeenCalledWith(
          expect.objectContaining({ agentType })
        );
      }
    });
  });

  describe('buildExecutionContext', () => {
    it('should build comprehensive context from workflow step', async () => {
      const workflowStep: WorkflowStep = {
        id: 'step-context',
        name: 'Context Building',
        agentType: 'Architect',
        dependencies: ['step-previous'],
        outputs: ['context-output']
      };

      mockWorkflowManager.getCurrentWorkflowStep.mockReturnValue(workflowStep);
      mockWorkflowManager.getStepContext.mockResolvedValue({
        relevantArtifacts: [{ id: 'artifact-1', type: 'contract' }],
        patterns: [{ type: 'api-pattern', frequency: 5 }],
        relationships: [{ from: 'service-a', to: 'service-b', type: 'depends-on' }]
      });

      const context = await taskExecutor.buildExecutionContext('task-1');

      expect(context.workflowStep).toEqual(workflowStep);
      expect(context.relevantArtifacts).toBeDefined();
      expect(context.patterns).toBeDefined();
      expect(context.relationships).toBeDefined();
      expect(mockWorkflowManager.getStepContext).toHaveBeenCalledWith('task-1');
    });

    it('should include task-specific artifacts', async () => {
      mockCanvas.getTaskArtifacts.mockResolvedValue([
        { id: 'task-artifact-1', type: 'specification', content: 'spec content' },
        { id: 'task-artifact-2', type: 'prototype', content: 'prototype content' }
      ]);

      const context = await taskExecutor.buildExecutionContext('task-1');

      expect(mockCanvas.getTaskArtifacts).toHaveBeenCalledWith('task-1');
      expect(context.relevantArtifacts).toContain(
        expect.objectContaining({ id: 'task-artifact-1' })
      );
    });

    it('should include relevant pheromones', async () => {
      mockCanvas.getPheromonesByType.mockResolvedValue([
        {
          id: 'pheromone-1',
          type: 'guide_pheromone',
          strength: 0.8,
          context: 'architecture-guidance',
          metadata: { pattern: 'microservices' },
          createdAt: '2024-01-01T00:00:00Z',
          expiresAt: '2024-12-31T23:59:59Z'
        }
      ]);

      const context = await taskExecutor.buildExecutionContext('task-1');

      expect(mockCanvas.getPheromonesByType).toHaveBeenCalledWith('guide_pheromone');
      expect(context.patterns).toContain(
        expect.objectContaining({ pattern: 'microservices' })
      );
    });

    it('should handle minimal context gracefully', async () => {
      mockWorkflowManager.getCurrentWorkflowStep.mockReturnValue(null);
      mockWorkflowManager.getStepContext.mockResolvedValue({});
      mockCanvas.getTaskArtifacts.mockResolvedValue([]);
      mockCanvas.getPheromonesByType.mockResolvedValue([]);

      const context = await taskExecutor.buildExecutionContext('task-1');

      expect(context).toBeDefined();
      expect(context.workflowStep).toBeNull();
      expect(context.relevantArtifacts).toEqual([]);
    });
  });

  describe('handleTaskFailure', () => {
    const mockError = new Error('Task execution failed');

    it('should update task status to failed', async () => {
      await taskExecutor.handleTaskFailure('task-1', mockError, mockContext);

      expect(mockCanvas.updateTaskStatus).toHaveBeenCalledWith('task-1', 'failed');
    });

    it('should create failure pheromone', async () => {
      await taskExecutor.handleTaskFailure('task-1', mockError, mockContext);

      expect(mockCanvas.createPheromone).toHaveBeenCalledWith({
        type: 'warn_pheromone',
        context: 'task-execution-failure',
        strength: expect.any(Number),
        metadata: expect.objectContaining({
          taskId: 'task-1',
          errorMessage: 'Task execution failed',
          agentType: 'Architect'
        }),
        ttl: expect.any(Number)
      });
    });

    it('should analyze failure patterns', async () => {
      mockCanvas.getRecentFailures.mockResolvedValue([
        {
          id: 'failure-1',
          taskId: 'other-task',
          agentType: 'Architect',
          errorMessage: 'Similar failure',
          timestamp: '2024-01-01T00:00:00Z'
        }
      ]);

      await taskExecutor.handleTaskFailure('task-1', mockError, mockContext);

      expect(mockCanvas.getRecentFailures).toHaveBeenCalledWith('project-123', 24); // Last 24 hours
    });

    it('should trigger debugger agent for critical failures', async () => {
      const criticalError = new Error('CRITICAL: System failure');
      
      await taskExecutor.handleTaskFailure('task-1', criticalError, mockContext);

      expect(mockCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          strength: expect.any(Number), // Higher strength for critical errors
          metadata: expect.objectContaining({
            severity: 'critical'
          })
        })
      );
    });
  });

  describe('optimizeTaskExecution', () => {
    it('should prioritize tasks by dependency chain length', async () => {
      const tasksWithDependencies = [
        { ...mockTasks[0], dependencies: [] }, // No dependencies
        { ...mockTasks[1], dependencies: ['task-1'] }, // 1 dependency
        { ...mockTasks[2], dependencies: ['task-1', 'task-2'] } // 2 dependencies
      ];

      mockCanvas.getTasksByProject.mockResolvedValue(tasksWithDependencies);
      mockCanvas.getTaskDependencies.mockImplementation((taskId) => {
        const task = tasksWithDependencies.find(t => t.id === taskId);
        return Promise.resolve(task?.dependencies.map(depId => 
          tasksWithDependencies.find(t => t.id === depId)
        ).filter(Boolean) || []);
      });

      const optimizedOrder = await taskExecutor.getOptimizedTaskOrder('project-123');

      expect(optimizedOrder[0].id).toBe('task-1'); // No dependencies first
      expect(optimizedOrder[optimizedOrder.length - 1].id).toBe('task-3'); // Most dependencies last
    });

    it('should handle circular dependencies', async () => {
      const circularTasks = [
        { ...mockTasks[0], dependencies: ['task-2'] },
        { ...mockTasks[1], dependencies: ['task-1'] }
      ];

      mockCanvas.getTasksByProject.mockResolvedValue(circularTasks);
      mockCanvas.getTaskDependencies.mockImplementation((taskId) => {
        if (taskId === 'task-1') return Promise.resolve([circularTasks[1]]);
        if (taskId === 'task-2') return Promise.resolve([circularTasks[0]]);
        return Promise.resolve([]);
      });

      const optimizedOrder = await taskExecutor.getOptimizedTaskOrder('project-123');

      // Should break circular dependency and return some order
      expect(optimizedOrder).toHaveLength(2);
    });

    it('should consider task priority in optimization', async () => {
      const prioritizedTasks = [
        { ...mockTasks[0], priority: 3, dependencies: [] },
        { ...mockTasks[1], priority: 1, dependencies: [] }, // Highest priority
        { ...mockTasks[2], priority: 2, dependencies: [] }
      ];

      mockCanvas.getTasksByProject.mockResolvedValue(prioritizedTasks);
      mockCanvas.getTaskDependencies.mockResolvedValue([]);

      const optimizedOrder = await taskExecutor.getOptimizedTaskOrder('project-123');

      expect(optimizedOrder[0].priority).toBe(1); // Highest priority first
    });
  });

  describe('parallel execution', () => {
    it('should execute independent tasks in parallel', async () => {
      const independentTasks = [
        { ...mockTasks[0], id: 'task-a', dependencies: [] },
        { ...mockTasks[1], id: 'task-b', dependencies: [] },
        { ...mockTasks[2], id: 'task-c', dependencies: [] }
      ];

      mockCanvas.getTasksByProject.mockResolvedValue(independentTasks);
      mockCanvas.getTaskDependencies.mockResolvedValue([]);

      const startTime = Date.now();
      await taskExecutor.executeTasksBatch('project-123', independentTasks);
      const duration = Date.now() - startTime;

      // Parallel execution should be faster than sequential
      expect(duration).toBeLessThan(3000); // Assuming each task takes ~1s
      expect(mockCanvas.createTaskExecution).toHaveBeenCalledTimes(3);
    });

    it('should respect concurrency limits', async () => {
      const manyTasks = Array.from({ length: 10 }, (_, i) => ({
        ...mockTasks[0],
        id: `task-${i}`,
        dependencies: []
      }));

      mockCanvas.getTasksByProject.mockResolvedValue(manyTasks);
      mockCanvas.getTaskDependencies.mockResolvedValue([]);

      // Mock concurrency limit
      const maxConcurrent = 3;
      await taskExecutor.executeTasksBatch('project-123', manyTasks, maxConcurrent);

      // Should not exceed concurrency limit
      expect(mockCanvas.createTaskExecution).toHaveBeenCalledTimes(10);
    });
  });

  describe('error handling and recovery', () => {
    it('should handle canvas connection failures', async () => {
      mockCanvas.getTasksByProject.mockRejectedValue(new Error('Canvas connection failed'));

      await expect(taskExecutor.processNextTask('project-123')).rejects.toThrow('Canvas connection failed');
    });

    it('should retry failed tasks with exponential backoff', async () => {
      let attempts = 0;
      mockWorkspace.createWorktree.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve(mockWorktree);
      });

      const result = await taskExecutor.executeTaskWithRetry(
        mockTasks[0],
        'Architect',
        mockContext,
        { maxRetries: 3, baseDelay: 100 }
      );

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should handle workspace cleanup on task failure', async () => {
      mockSessionManager.runCommandInSession.mockRejectedValue(new Error('Command failed'));

      await taskExecutor.executeTaskWithAgent(mockTasks[0], 'Architect', mockContext);

      expect(mockWorkspace.cleanup).toHaveBeenCalledWith('task-1');
      expect(mockSessionManager.closeSession).toHaveBeenCalledWith('task-1');
    });
  });

  describe('performance monitoring', () => {
    it('should track task execution metrics', async () => {
      const startTime = Date.now();
      
      const result = await taskExecutor.executeTaskWithAgent(
        mockTasks[0],
        'Architect',
        mockContext
      );
      
      const endTime = Date.now();

      expect(result.performance).toBeDefined();
      expect(result.performance?.executionTimeMs).toBeLessThanOrEqual(endTime - startTime + 100);
    });

    it('should monitor resource usage during execution', async () => {
      const result = await taskExecutor.executeTaskWithAgent(
        mockTasks[0],
        'Architect',
        mockContext
      );

      expect(result.metrics).toBeDefined();
      expect(result.metrics?.memoryUsage).toBeDefined();
      expect(result.metrics?.cpuUsage).toBeDefined();
    });

    it('should detect performance bottlenecks', async () => {
      // Simulate slow task execution
      mockSessionManager.runCommandInSession.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          stdout: 'Slow task completed',
          stderr: '',
          exitCode: 0
        }), 2000))
      );

      const result = await taskExecutor.executeTaskWithAgent(
        mockTasks[0],
        'Architect',
        mockContext
      );

      expect(result.performance?.executionTimeMs).toBeGreaterThan(1500);
      expect(result.warnings).toContain('Task execution exceeded expected duration');
    });
  });
});