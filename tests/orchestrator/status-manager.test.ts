import { 
  StatusManager, 
  OrchestratorStatus, 
  ProjectProgress, 
  WorkflowProgress, 
  SessionStatus, 
  SystemHealth 
} from '../../src/orchestrator/status-manager';
import { CognitiveCanvas, TaskData } from '../../src/cognitive-canvas';
import { ClaudeClient, TokenUsageStats } from '../../src/claude-client';
import { SessionManager } from '../../src/session';
import { WorkflowManager } from '../../src/orchestrator/workflow-manager';

// Mock dependencies
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/claude-client');
jest.mock('../../src/session');
jest.mock('../../src/orchestrator/workflow-manager');

describe('StatusManager', () => {
  let statusManager: StatusManager;
  let mockCanvas: jest.Mocked<CognitiveCanvas>;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockWorkflowManager: jest.Mocked<WorkflowManager>;

  const mockTasks: TaskData[] = [
    {
      id: 'task-1',
      title: 'Architecture Design',
      description: 'Create system architecture',
      status: 'completed',
      agentType: 'Architect',
      priority: 1,
      projectId: 'project-123',
      createdAt: '2024-01-01T00:00:00Z',
      dependencies: []
    },
    {
      id: 'task-2',
      title: 'Core Implementation',
      description: 'Implement business logic',
      status: 'in_progress',
      agentType: 'Coder',
      priority: 2,
      projectId: 'project-123',
      createdAt: '2024-01-01T01:00:00Z',
      dependencies: ['task-1']
    },
    {
      id: 'task-3',
      title: 'Testing',
      description: 'Write comprehensive tests',
      status: 'pending',
      agentType: 'Coder',
      priority: 3,
      projectId: 'project-123',
      createdAt: '2024-01-01T02:00:00Z',
      dependencies: ['task-2']
    },
    {
      id: 'task-4',
      title: 'Failed Task',
      description: 'Task that failed',
      status: 'failed',
      agentType: 'Architect',
      priority: 4,
      projectId: 'project-123',
      createdAt: '2024-01-01T03:00:00Z',
      dependencies: []
    }
  ];

  const mockTokenUsage: TokenUsageStats = {
    totalTokens: 15000,
    inputTokens: 8000,
    outputTokens: 7000,
    cost: 45.50
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock CognitiveCanvas
    mockCanvas = {
      getTasksByProject: jest.fn().mockResolvedValue(mockTasks),
      getProjectById: jest.fn().mockResolvedValue({
        id: 'project-123',
        name: 'Test Project',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z'
      }),
      getTaskExecutions: jest.fn().mockResolvedValue([]),
      getProjectMetrics: jest.fn().mockResolvedValue({
        totalTasks: 4,
        completedTasks: 1,
        failedTasks: 1
      })
    } as any;

    // Mock ClaudeClient
    mockClaudeClient = {
      getTokenUsageStats: jest.fn().mockResolvedValue(mockTokenUsage),
      getCurrentBudget: jest.fn().mockResolvedValue({
        allocated: 100.00,
        used: 45.50,
        remaining: 54.50
      })
    } as any;

    // Mock SessionManager
    mockSessionManager = {
      getActiveSessions: jest.fn().mockResolvedValue([
        {
          id: 'session-1',
          taskId: 'task-2',
          worktreePath: '/workspace/task-2',
          createdAt: '2024-01-01T10:00:00Z',
          status: 'active',
          environment: { AGENT_TYPE: 'Coder' }
        }
      ]),
      getSessionStatus: jest.fn(),
      getSessionMetrics: jest.fn().mockResolvedValue({
        memoryUsage: 512,
        cpuUsage: 25.5,
        uptime: 3600
      })
    } as any;

    // Mock WorkflowManager
    mockWorkflowManager = {
      getWorkflowProgress: jest.fn().mockResolvedValue({
        taskId: 'task-2',
        currentStep: 'implementation',
        completedSteps: ['planning', 'design'],
        totalSteps: 5,
        stepProgress: 40
      }),
      getWorkflowSteps: jest.fn().mockResolvedValue([
        { id: 'step-1', name: 'Planning', status: 'completed' },
        { id: 'step-2', name: 'Design', status: 'completed' },
        { id: 'step-3', name: 'Implementation', status: 'in_progress' },
        { id: 'step-4', name: 'Testing', status: 'pending' },
        { id: 'step-5', name: 'Deployment', status: 'pending' }
      ]),
      isWorkflowComplete: jest.fn().mockReturnValue(false)
    } as any;

    statusManager = new StatusManager(
      mockCanvas,
      mockClaudeClient,
      mockSessionManager,
      mockWorkflowManager
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization and basic status', () => {
    it('should initialize with idle status', () => {
      expect(statusManager.getStatus()).toBe('idle');
      expect(statusManager.isRunning()).toBe(false);
    });

    it('should transition to initialized status', async () => {
      await statusManager.initialize('project-123');

      expect(statusManager.getStatus()).toBe('initialized');
      expect(statusManager.getCurrentProjectId()).toBe('project-123');
    });

    it('should transition to running status when started', async () => {
      await statusManager.initialize('project-123');
      await statusManager.start();

      expect(statusManager.getStatus()).toBe('running');
      expect(statusManager.isRunning()).toBe(true);
    });

    it('should transition to completed status when finished', async () => {
      await statusManager.initialize('project-123');
      await statusManager.start();
      await statusManager.complete();

      expect(statusManager.getStatus()).toBe('completed');
      expect(statusManager.isRunning()).toBe(false);
    });

    it('should handle error status transitions', async () => {
      const error = new Error('Test error');
      await statusManager.setError(error);

      expect(statusManager.getStatus()).toBe('error');
      expect(statusManager.getLastError()).toBe(error);
      expect(statusManager.isRunning()).toBe(false);
    });
  });

  describe('project progress tracking', () => {
    it('should calculate project progress correctly', async () => {
      const progress = await statusManager.getProjectProgress('project-123');

      expect(progress.projectId).toBe('project-123');
      expect(progress.totalTasks).toBe(4);
      expect(progress.completedTasks).toBe(1);
      expect(progress.runningTasks).toBe(1);
      expect(progress.pendingTasks).toBe(1);
      expect(progress.errorTasks).toBe(1);
      expect(progress.progressPercentage).toBe(25); // 1 completed out of 4 total
    });

    it('should handle empty project', async () => {
      mockCanvas.getTasksByProject.mockResolvedValue([]);

      const progress = await statusManager.getProjectProgress('empty-project');

      expect(progress.totalTasks).toBe(0);
      expect(progress.completedTasks).toBe(0);
      expect(progress.progressPercentage).toBe(0);
    });

    it('should calculate progress with paused tasks', async () => {
      const tasksWithPaused = [
        ...mockTasks,
        {
          id: 'task-5',
          title: 'Paused Task',
          description: 'Task that was paused',
          status: 'paused' as const,
          agentType: 'Governor',
          priority: 5,
          projectId: 'project-123',
          createdAt: '2024-01-01T04:00:00Z',
          dependencies: []
        }
      ];

      mockCanvas.getTasksByProject.mockResolvedValue(tasksWithPaused);

      const progress = await statusManager.getProjectProgress('project-123');

      expect(progress.pausedTasks).toBe(1);
      expect(progress.totalTasks).toBe(5);
    });

    it('should track progress over time', async () => {
      const initialProgress = await statusManager.getProjectProgress('project-123');
      
      // Simulate task completion
      mockTasks[2].status = 'completed';
      mockCanvas.getTasksByProject.mockResolvedValue(mockTasks);

      const updatedProgress = await statusManager.getProjectProgress('project-123');

      expect(updatedProgress.completedTasks).toBeGreaterThan(initialProgress.completedTasks);
      expect(updatedProgress.progressPercentage).toBeGreaterThan(initialProgress.progressPercentage);
    });
  });

  describe('workflow progress tracking', () => {
    it('should get workflow progress for active task', async () => {
      const progress = await statusManager.getWorkflowProgress('task-2');

      expect(progress.taskId).toBe('task-2');
      expect(progress.currentStep).toBe('implementation');
      expect(progress.completedSteps).toEqual(['planning', 'design']);
      expect(progress.totalSteps).toBe(5);
      expect(progress.stepProgress).toBe(40);
    });

    it('should handle workflow not found', async () => {
      mockWorkflowManager.getWorkflowProgress.mockResolvedValue(null);

      const progress = await statusManager.getWorkflowProgress('non-existent-task');

      expect(progress).toBeNull();
    });

    it('should track multiple workflow progresses', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];
      
      mockWorkflowManager.getWorkflowProgress.mockImplementation((taskId: string) => 
        Promise.resolve({
          taskId,
          currentStep: 'step-1',
          completedSteps: [],
          totalSteps: 3,
          stepProgress: 33
        })
      );

      const progresses = await statusManager.getMultipleWorkflowProgresses(taskIds);

      expect(progresses).toHaveLength(3);
      expect(progresses.every(p => p !== null)).toBe(true);
    });
  });

  describe('session status tracking', () => {
    it('should get active session statuses', async () => {
      const sessions = await statusManager.getActiveSessionStatuses();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe('session-1');
      expect(sessions[0].taskId).toBe('task-2');
      expect(sessions[0].agentType).toBe('Coder');
      expect(sessions[0].status).toBe('active');
    });

    it('should handle no active sessions', async () => {
      mockSessionManager.getActiveSessions.mockResolvedValue([]);

      const sessions = await statusManager.getActiveSessionStatuses();

      expect(sessions).toHaveLength(0);
    });

    it('should track session performance metrics', async () => {
      const metrics = await statusManager.getSessionMetrics('session-1');

      expect(metrics.memoryUsage).toBe(512);
      expect(metrics.cpuUsage).toBe(25.5);
      expect(metrics.uptime).toBe(3600);
    });

    it('should detect inactive sessions', async () => {
      const oldSession = {
        id: 'session-old',
        taskId: 'task-old',
        worktreePath: '/workspace/task-old',
        createdAt: '2024-01-01T00:00:00Z', // Very old
        status: 'active' as const,
        environment: {}
      };

      mockSessionManager.getActiveSessions.mockResolvedValue([oldSession]);

      const inactiveSessions = await statusManager.getInactiveSessions(3600000); // 1 hour threshold

      expect(inactiveSessions).toHaveLength(1);
      expect(inactiveSessions[0].sessionId).toBe('session-old');
    });
  });

  describe('system health monitoring', () => {
    it('should provide comprehensive system health status', async () => {
      await statusManager.initialize('project-123');
      await statusManager.start();

      const health = await statusManager.getSystemHealth();

      expect(health.orchestratorStatus).toBe('running');
      expect(health.activeSessionsCount).toBe(1);
      expect(health.totalTasksInProgress).toBe(1);
      expect(health.budgetUtilization).toBe(45.5); // Based on mock budget
      expect(health.errorRate).toBeGreaterThanOrEqual(0);
      expect(health.lastHealthCheck).toBeDefined();
    });

    it('should calculate error rate correctly', async () => {
      // Add more failed tasks to test error rate calculation
      const tasksWithMoreErrors = [
        ...mockTasks,
        {
          id: 'task-error-1',
          title: 'Error Task 1',
          description: 'Failed task',
          status: 'failed' as const,
          agentType: 'Architect',
          priority: 5,
          projectId: 'project-123',
          createdAt: '2024-01-01T05:00:00Z',
          dependencies: []
        },
        {
          id: 'task-error-2', 
          title: 'Error Task 2',
          description: 'Another failed task',
          status: 'failed' as const,
          agentType: 'Coder',
          priority: 6,
          projectId: 'project-123',
          createdAt: '2024-01-01T06:00:00Z',
          dependencies: []
        }
      ];

      mockCanvas.getTasksByProject.mockResolvedValue(tasksWithMoreErrors);

      const health = await statusManager.getSystemHealth();

      expect(health.errorRate).toBe(50); // 3 failed out of 6 total tasks
    });

    it('should detect system health issues', async () => {
      // Mock high resource usage
      mockSessionManager.getSessionMetrics.mockResolvedValue({
        memoryUsage: 8192, // High memory usage
        cpuUsage: 95.0, // High CPU usage
        uptime: 86400
      });

      const healthIssues = await statusManager.detectHealthIssues();

      expect(healthIssues).toContain('High memory usage detected');
      expect(healthIssues).toContain('High CPU usage detected');
    });

    it('should monitor budget utilization alerts', async () => {
      mockClaudeClient.getCurrentBudget.mockResolvedValue({
        allocated: 100.00,
        used: 95.00, // High usage
        remaining: 5.00
      });

      const health = await statusManager.getSystemHealth();

      expect(health.budgetUtilization).toBe(95);
      
      const alerts = await statusManager.getBudgetAlerts();
      expect(alerts).toContain('Budget utilization above 90%');
    });
  });

  describe('real-time status updates', () => {
    it('should emit status change events', async () => {
      const statusChangeHandler = jest.fn();
      statusManager.onStatusChange(statusChangeHandler);

      await statusManager.initialize('project-123');
      await statusManager.start();

      expect(statusChangeHandler).toHaveBeenCalledWith('initialized');
      expect(statusChangeHandler).toHaveBeenCalledWith('running');
    });

    it('should emit progress update events', async () => {
      const progressHandler = jest.fn();
      statusManager.onProgressUpdate(progressHandler);

      await statusManager.updateTaskProgress('task-2', 75);

      expect(progressHandler).toHaveBeenCalledWith({
        taskId: 'task-2',
        progress: 75,
        timestamp: expect.any(String)
      });
    });

    it('should debounce frequent updates', async () => {
      const progressHandler = jest.fn();
      statusManager.onProgressUpdate(progressHandler);

      // Send multiple rapid updates
      await Promise.all([
        statusManager.updateTaskProgress('task-2', 70),
        statusManager.updateTaskProgress('task-2', 75),
        statusManager.updateTaskProgress('task-2', 80)
      ]);

      // Should debounce and only emit the final update
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(progressHandler).toHaveBeenCalledTimes(1);
      expect(progressHandler).toHaveBeenCalledWith({
        taskId: 'task-2',
        progress: 80,
        timestamp: expect.any(String)
      });
    });
  });

  describe('status persistence and recovery', () => {
    it('should persist status to cognitive canvas', async () => {
      await statusManager.initialize('project-123');
      await statusManager.start();

      await statusManager.persistStatus();

      expect(mockCanvas.updateProjectStatus).toHaveBeenCalledWith('project-123', {
        orchestratorStatus: 'running',
        lastUpdated: expect.any(String),
        activeTasksCount: 1,
        totalTasksCount: 4
      });
    });

    it('should recover status from cognitive canvas', async () => {
      mockCanvas.getProjectStatus.mockResolvedValue({
        orchestratorStatus: 'running',
        projectId: 'project-123',
        lastUpdated: '2024-01-01T10:00:00Z',
        activeTasksCount: 2
      });

      await statusManager.recoverStatus('project-123');

      expect(statusManager.getStatus()).toBe('running');
      expect(statusManager.getCurrentProjectId()).toBe('project-123');
    });

    it('should handle status recovery failures gracefully', async () => {
      mockCanvas.getProjectStatus.mockRejectedValue(new Error('Recovery failed'));

      await statusManager.recoverStatus('project-123');

      // Should fall back to default status
      expect(statusManager.getStatus()).toBe('idle');
    });
  });

  describe('metrics and analytics', () => {
    it('should calculate task completion velocity', async () => {
      const completionTimes = [
        { taskId: 'task-1', completedAt: '2024-01-01T01:00:00Z', startedAt: '2024-01-01T00:00:00Z' },
        { taskId: 'task-2', completedAt: '2024-01-01T03:00:00Z', startedAt: '2024-01-01T01:00:00Z' }
      ];

      mockCanvas.getTaskCompletionHistory.mockResolvedValue(completionTimes);

      const velocity = await statusManager.getTaskCompletionVelocity('project-123');

      expect(velocity.averageCompletionTime).toBeDefined();
      expect(velocity.tasksPerHour).toBeDefined();
      expect(velocity.trend).toBeDefined();
    });

    it('should analyze agent performance', async () => {
      const agentMetrics = await statusManager.getAgentPerformanceMetrics('project-123');

      expect(agentMetrics).toHaveProperty('Architect');
      expect(agentMetrics).toHaveProperty('Coder');
      expect(agentMetrics.Architect.successRate).toBeDefined();
      expect(agentMetrics.Architect.averageTaskTime).toBeDefined();
    });

    it('should generate status reports', async () => {
      await statusManager.initialize('project-123');
      await statusManager.start();

      const report = await statusManager.generateStatusReport();

      expect(report.projectId).toBe('project-123');
      expect(report.orchestratorStatus).toBe('running');
      expect(report.projectProgress).toBeDefined();
      expect(report.systemHealth).toBeDefined();
      expect(report.activeWorkflows).toBeDefined();
      expect(report.generatedAt).toBeDefined();
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle canvas connection failures', async () => {
      mockCanvas.getTasksByProject.mockRejectedValue(new Error('Canvas connection failed'));

      const progress = await statusManager.getProjectProgress('project-123');

      expect(progress.totalTasks).toBe(0);
      expect(progress.errorTasks).toBe(0);
    });

    it('should handle session manager failures', async () => {
      mockSessionManager.getActiveSessions.mockRejectedValue(new Error('Session manager failed'));

      const sessions = await statusManager.getActiveSessionStatuses();

      expect(sessions).toHaveLength(0);
    });

    it('should gracefully handle workflow manager failures', async () => {
      mockWorkflowManager.getWorkflowProgress.mockRejectedValue(new Error('Workflow manager failed'));

      const progress = await statusManager.getWorkflowProgress('task-1');

      expect(progress).toBeNull();
    });

    it('should handle concurrent status updates', async () => {
      const promises = [
        statusManager.updateTaskProgress('task-1', 50),
        statusManager.updateTaskProgress('task-2', 75),
        statusManager.updateTaskProgress('task-3', 25)
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });
});