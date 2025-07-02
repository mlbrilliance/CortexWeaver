import { 
  ErrorHandler, 
  ErrorContext, 
  RecoveryStrategy, 
  ErrorHandlingResult 
} from '../../src/orchestrator/error-handler';
import { CognitiveCanvas } from '../../src/cognitive-canvas';
import { SessionManager } from '../../src/session';
import { CritiqueAgent, StructuredFeedback } from '../../src/agents/critique';
import { DebuggerAgent } from '../../src/agents/debugger';
import { AgentSpawner } from '../../src/orchestrator/agent-spawner';
import { WorkflowManager } from '../../src/orchestrator/workflow-manager';

// Mock dependencies
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/session');
jest.mock('../../src/agents/critique');
jest.mock('../../src/agents/debugger');
jest.mock('../../src/orchestrator/agent-spawner');
jest.mock('../../src/orchestrator/workflow-manager');

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let mockCanvas: jest.Mocked<CognitiveCanvas>;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockCritiqueAgent: jest.Mocked<CritiqueAgent>;
  let mockDebuggerAgent: jest.Mocked<DebuggerAgent>;
  let mockAgentSpawner: jest.Mocked<AgentSpawner>;
  let mockWorkflowManager: jest.Mocked<WorkflowManager>;

  const mockTaskFailure = {
    id: 'failure-123',
    type: 'system_failure' as const,
    taskId: 'task-456',
    agentType: 'Architect',
    errorMessage: 'TypeError: Cannot read properties of undefined',
    stackTrace: 'at ArchitectAgent.execute(architect.ts:123)',
    timestamp: '2024-01-01T10:00:00Z',
    severity: 'high' as const,
    projectId: 'project-789'
  };

  const mockStructuredFeedback: StructuredFeedback = {
    artifactId: 'artifact-123',
    overallSeverity: 'high',
    issues: [
      {
        severity: 'high',
        type: 'logic-error',
        location: 'function.processData',
        description: 'Null pointer exception',
        suggestion: 'Add null check before property access'
      }
    ],
    actionRequired: true,
    pauseDownstream: true,
    recommendations: ['Add input validation', 'Implement error handling'],
    resolutionSteps: ['Check input parameters', 'Add try-catch blocks'],
    priority: 'urgent',
    immediateAction: true
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock CognitiveCanvas
    mockCanvas = {
      createErrorRecord: jest.fn().mockResolvedValue('error-record-123'),
      getTaskById: jest.fn().mockResolvedValue({
        id: 'task-456',
        title: 'Test Task',
        status: 'failed',
        agentType: 'Architect',
        projectId: 'project-789'
      }),
      updateTaskStatus: jest.fn().mockResolvedValue(undefined),
      getErrorHistory: jest.fn().mockResolvedValue([]),
      createPheromone: jest.fn().mockResolvedValue('pheromone-123'),
      getProjectMetrics: jest.fn().mockResolvedValue({
        errorRate: 15,
        recentFailures: 3
      }),
      pauseDownstreamTasks: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock SessionManager
    mockSessionManager = {
      getSession: jest.fn().mockResolvedValue({
        id: 'session-456',
        taskId: 'task-456',
        status: 'error',
        worktreePath: '/workspace/task-456'
      }),
      terminateSession: jest.fn().mockResolvedValue(undefined),
      createSession: jest.fn().mockResolvedValue({
        id: 'new-session-789',
        taskId: 'task-456',
        status: 'active'
      })
    } as any;

    // Mock CritiqueAgent
    mockCritiqueAgent = {
      analyzeArtifact: jest.fn().mockResolvedValue({
        success: true,
        critique: {
          issues: [{ severity: 'medium', type: 'style-issue' }],
          overallQuality: 'fair',
          recommendations: ['Improve code style']
        }
      }),
      generateStructuredFeedback: jest.fn().mockResolvedValue(mockStructuredFeedback)
    } as any;

    // Mock DebuggerAgent
    mockDebuggerAgent = {
      analyzeFailure: jest.fn().mockResolvedValue({
        success: true,
        diagnostic: {
          rootCause: {
            category: 'validation',
            description: 'Missing input validation',
            confidence: 0.9
          },
          solutions: [
            {
              type: 'immediate',
              description: 'Add null checks',
              implementation: 'if (input) { ... }',
              priority: 'high'
            }
          ]
        }
      }),
      createWarnPheromone: jest.fn().mockResolvedValue({
        success: true,
        pheromone: { id: 'warn-pheromone-123' }
      })
    } as any;

    // Mock AgentSpawner
    mockAgentSpawner = {
      spawnSpecializedAgent: jest.fn().mockResolvedValue({
        success: true,
        agentType: 'Debugger',
        taskId: 'debug-task-123',
        sessionId: 'debug-session-456'
      }),
      cleanupAgent: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock WorkflowManager
    mockWorkflowManager = {
      getCurrentWorkflowStep: jest.fn().mockReturnValue({
        id: 'step-arch',
        name: 'Architecture',
        agentType: 'Architect'
      }),
      skipStep: jest.fn().mockResolvedValue(true),
      moveToNextStep: jest.fn().mockResolvedValue(undefined),
      pauseWorkflow: jest.fn().mockResolvedValue(undefined),
      resumeWorkflow: jest.fn().mockResolvedValue(undefined),
      canSkipStep: jest.fn().mockReturnValue(true)
    } as any;

    errorHandler = new ErrorHandler(
      mockCanvas,
      mockSessionManager,
      mockAgentSpawner,
      mockWorkflowManager,
      mockCritiqueAgent,
      mockDebuggerAgent
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleTaskFailure', () => {
    it('should handle system failure with retry strategy', async () => {
      mockCanvas.getErrorHistory.mockResolvedValue([]);

      const result = await errorHandler.handleTaskFailure('task-456', mockTaskFailure);

      expect(result.success).toBe(true);
      expect(result.strategy.type).toBe('retry');
      expect(mockCanvas.createErrorRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system_failure',
          taskId: 'task-456',
          severity: 'high'
        })
      );
    });

    it('should escalate after multiple retry failures', async () => {
      const previousFailures = [
        { id: 'fail-1', taskId: 'task-456', type: 'system_failure', timestamp: '2024-01-01T09:00:00Z' },
        { id: 'fail-2', taskId: 'task-456', type: 'system_failure', timestamp: '2024-01-01T09:30:00Z' }
      ];

      mockCanvas.getErrorHistory.mockResolvedValue(previousFailures);

      const result = await errorHandler.handleTaskFailure('task-456', mockTaskFailure);

      expect(result.strategy.type).toBe('spawn_helper');
      expect(result.escalated).toBe(true);
      expect(mockAgentSpawner.spawnSpecializedAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          agentType: 'Debugger',
          taskId: 'task-456'
        })
      );
    });

    it('should handle impasse with critique agent', async () => {
      const impasseFailure = {
        ...mockTaskFailure,
        type: 'impasse' as const,
        errorMessage: 'Agent reported impasse: Cannot proceed with current approach'
      };

      const result = await errorHandler.handleTaskFailure('task-456', impasseFailure);

      expect(mockCritiqueAgent.analyzeArtifact).toHaveBeenCalled();
      expect(result.strategy.type).toBe('spawn_helper');
    });

    it('should handle critique failure appropriately', async () => {
      const critiqueFailure = {
        ...mockTaskFailure,
        type: 'critique_failure' as const,
        errorMessage: 'Critique agent failed to analyze artifact'
      };

      const result = await errorHandler.handleTaskFailure('task-456', critiqueFailure);

      expect(result.strategy.type).toBe('skip_step');
      expect(mockWorkflowManager.skipStep).toHaveBeenCalledWith('task-456');
    });

    it('should pause downstream tasks for critical failures', async () => {
      const criticalFailure = {
        ...mockTaskFailure,
        severity: 'critical' as const,
        errorMessage: 'Critical system failure'
      };

      const result = await errorHandler.handleTaskFailure('task-456', criticalFailure);

      expect(result.strategy.type).toBe('pause_downstream');
      expect(mockCanvas.pauseDownstreamTasks).toHaveBeenCalledWith('task-456');
    });

    it('should handle timeout errors with session reset', async () => {
      const timeoutFailure = {
        ...mockTaskFailure,
        type: 'timeout' as const,
        errorMessage: 'Task execution timeout'
      };

      const result = await errorHandler.handleTaskFailure('task-456', timeoutFailure);

      expect(mockSessionManager.terminateSession).toHaveBeenCalledWith('task-456');
      expect(result.strategy.type).toBe('retry');
      expect(result.strategy.config.resetSession).toBe(true);
    });
  });

  describe('handleImpasse', () => {
    const impasseData = {
      taskId: 'task-456',
      agentType: 'Architect',
      reason: 'Cannot determine optimal architecture pattern',
      context: {
        attemptedApproaches: ['microservices', 'monolith'],
        constraints: ['performance', 'scalability']
      }
    };

    it('should analyze impasse with critique agent', async () => {
      const result = await errorHandler.handleImpasse(impasseData);

      expect(result.success).toBe(true);
      expect(mockCritiqueAgent.analyzeArtifact).toHaveBeenCalled();
      expect(mockCritiqueAgent.generateStructuredFeedback).toHaveBeenCalled();
    });

    it('should determine if downstream tasks should be paused', async () => {
      mockCritiqueAgent.generateStructuredFeedback.mockResolvedValue({
        ...mockStructuredFeedback,
        pauseDownstream: true,
        overallSeverity: 'critical'
      });

      const result = await errorHandler.handleImpasse(impasseData);

      expect(result.strategy.type).toBe('pause_downstream');
      expect(mockCanvas.pauseDownstreamTasks).toHaveBeenCalledWith('task-456');
    });

    it('should spawn helper agent for complex impasses', async () => {
      mockCritiqueAgent.generateStructuredFeedback.mockResolvedValue({
        ...mockStructuredFeedback,
        immediateAction: true,
        priority: 'urgent'
      });

      const result = await errorHandler.handleImpasse(impasseData);

      expect(result.strategy.type).toBe('spawn_helper');
      expect(mockAgentSpawner.spawnSpecializedAgent).toHaveBeenCalled();
    });

    it('should handle critique analysis failure', async () => {
      mockCritiqueAgent.analyzeArtifact.mockResolvedValue({
        success: false,
        error: 'Failed to analyze artifact'
      });

      const result = await errorHandler.handleImpasse(impasseData);

      expect(result.success).toBe(false);
      expect(result.strategy.type).toBe('escalate');
    });
  });

  describe('analyzeErrorPattern', () => {
    it('should identify recurring error patterns', async () => {
      const errorHistory = [
        { id: 'err-1', type: 'system_failure', errorMessage: 'TypeError: Cannot read properties', timestamp: '2024-01-01T09:00:00Z' },
        { id: 'err-2', type: 'system_failure', errorMessage: 'TypeError: Cannot read properties', timestamp: '2024-01-01T10:00:00Z' },
        { id: 'err-3', type: 'system_failure', errorMessage: 'TypeError: Cannot read properties', timestamp: '2024-01-01T11:00:00Z' }
      ];

      mockCanvas.getErrorHistory.mockResolvedValue(errorHistory);

      const pattern = await errorHandler.analyzeErrorPattern('task-456');

      expect(pattern.isRecurring).toBe(true);
      expect(pattern.frequency).toBe(3);
      expect(pattern.pattern).toContain('TypeError');
      expect(pattern.recommendation).toBeDefined();
    });

    it('should detect escalating error severity', async () => {
      const escalatingErrors = [
        { id: 'err-1', type: 'system_failure', severity: 'low', timestamp: '2024-01-01T09:00:00Z' },
        { id: 'err-2', type: 'system_failure', severity: 'medium', timestamp: '2024-01-01T10:00:00Z' },
        { id: 'err-3', type: 'system_failure', severity: 'high', timestamp: '2024-01-01T11:00:00Z' }
      ];

      mockCanvas.getErrorHistory.mockResolvedValue(escalatingErrors);

      const pattern = await errorHandler.analyzeErrorPattern('task-456');

      expect(pattern.escalating).toBe(true);
      expect(pattern.recommendation).toContain('immediate intervention');
    });

    it('should handle no error history', async () => {
      mockCanvas.getErrorHistory.mockResolvedValue([]);

      const pattern = await errorHandler.analyzeErrorPattern('task-456');

      expect(pattern.isRecurring).toBe(false);
      expect(pattern.frequency).toBe(0);
    });
  });

  describe('determineRecoveryStrategy', () => {
    it('should recommend retry for transient errors', () => {
      const errorContext: ErrorContext = {
        id: 'err-123',
        type: 'system_failure',
        severity: 'low',
        errorMessage: 'Network timeout',
        taskId: 'task-456',
        timestamp: '2024-01-01T10:00:00Z'
      };

      const strategy = errorHandler.determineRecoveryStrategy(errorContext, { frequency: 1 });

      expect(strategy.type).toBe('retry');
      expect(strategy.config.maxRetries).toBeDefined();
    });

    it('should recommend helper agent for complex errors', () => {
      const complexError: ErrorContext = {
        id: 'err-456',
        type: 'impasse',
        severity: 'high',
        errorMessage: 'Cannot resolve architectural constraints',
        taskId: 'task-456',
        timestamp: '2024-01-01T10:00:00Z'
      };

      const strategy = errorHandler.determineRecoveryStrategy(complexError, { frequency: 1 });

      expect(strategy.type).toBe('spawn_helper');
      expect(strategy.config.helperType).toBeDefined();
    });

    it('should recommend skip for non-critical workflow errors', () => {
      const workflowError: ErrorContext = {
        id: 'err-789',
        type: 'workflow_step_error',
        severity: 'medium',
        errorMessage: 'Optional step failed',
        taskId: 'task-456',
        timestamp: '2024-01-01T10:00:00Z',
        step: 'optional-validation'
      };

      mockWorkflowManager.canSkipStep.mockReturnValue(true);

      const strategy = errorHandler.determineRecoveryStrategy(workflowError, { frequency: 1 });

      expect(strategy.type).toBe('skip_step');
    });

    it('should recommend escalation for recurring critical errors', () => {
      const criticalError: ErrorContext = {
        id: 'err-critical',
        type: 'system_failure',
        severity: 'critical',
        errorMessage: 'Database connection failed',
        taskId: 'task-456',
        timestamp: '2024-01-01T10:00:00Z'
      };

      const strategy = errorHandler.determineRecoveryStrategy(criticalError, { frequency: 5, isRecurring: true });

      expect(strategy.type).toBe('escalate');
    });
  });

  describe('executeRecoveryStrategy', () => {
    it('should execute retry strategy', async () => {
      const retryStrategy: RecoveryStrategy = {
        type: 'retry',
        config: { maxRetries: 3, delay: 1000 }
      };

      const result = await errorHandler.executeRecoveryStrategy('task-456', retryStrategy);

      expect(result.success).toBe(true);
      expect(mockCanvas.updateTaskStatus).toHaveBeenCalledWith('task-456', 'pending');
    });

    it('should execute spawn helper strategy', async () => {
      const spawnStrategy: RecoveryStrategy = {
        type: 'spawn_helper',
        config: { helperType: 'Debugger', context: { errorAnalysis: true } }
      };

      const result = await errorHandler.executeRecoveryStrategy('task-456', spawnStrategy);

      expect(result.success).toBe(true);
      expect(mockAgentSpawner.spawnSpecializedAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          agentType: 'Debugger',
          taskId: 'task-456'
        })
      );
    });

    it('should execute skip step strategy', async () => {
      const skipStrategy: RecoveryStrategy = {
        type: 'skip_step',
        config: { reason: 'Non-critical step failed' }
      };

      const result = await errorHandler.executeRecoveryStrategy('task-456', skipStrategy);

      expect(result.success).toBe(true);
      expect(mockWorkflowManager.skipStep).toHaveBeenCalledWith('task-456');
    });

    it('should execute pause downstream strategy', async () => {
      const pauseStrategy: RecoveryStrategy = {
        type: 'pause_downstream',
        config: { reason: 'Critical dependency failed' }
      };

      const result = await errorHandler.executeRecoveryStrategy('task-456', pauseStrategy);

      expect(result.success).toBe(true);
      expect(mockCanvas.pauseDownstreamTasks).toHaveBeenCalledWith('task-456');
    });

    it('should handle escalation strategy', async () => {
      const escalateStrategy: RecoveryStrategy = {
        type: 'escalate',
        config: { level: 'human_intervention' }
      };

      const result = await errorHandler.executeRecoveryStrategy('task-456', escalateStrategy);

      expect(result.success).toBe(true);
      expect(result.escalated).toBe(true);
      expect(mockCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warn_pheromone',
          context: 'human-intervention-required'
        })
      );
    });
  });

  describe('createWarnPheromone', () => {
    it('should create appropriate warning pheromone', async () => {
      const errorContext: ErrorContext = {
        id: 'err-123',
        type: 'system_failure',
        severity: 'high',
        errorMessage: 'Memory allocation failed',
        taskId: 'task-456',
        timestamp: '2024-01-01T10:00:00Z'
      };

      await errorHandler.createWarnPheromone(errorContext);

      expect(mockCanvas.createPheromone).toHaveBeenCalledWith({
        type: 'warn_pheromone',
        context: 'system-failure-memory',
        strength: expect.any(Number),
        metadata: expect.objectContaining({
          errorType: 'system_failure',
          severity: 'high',
          taskId: 'task-456'
        }),
        ttl: expect.any(Number)
      });
    });

    it('should set appropriate pheromone strength based on severity', async () => {
      const criticalError: ErrorContext = {
        id: 'err-critical',
        type: 'system_failure',
        severity: 'critical',
        errorMessage: 'Critical system failure',
        taskId: 'task-456',
        timestamp: '2024-01-01T10:00:00Z'
      };

      await errorHandler.createWarnPheromone(criticalError);

      expect(mockCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          strength: 1.0 // Maximum strength for critical errors
        })
      );
    });

    it('should set appropriate TTL based on error type', async () => {
      const transientError: ErrorContext = {
        id: 'err-transient',
        type: 'timeout',
        severity: 'medium',
        errorMessage: 'Operation timeout',
        taskId: 'task-456',
        timestamp: '2024-01-01T10:00:00Z'
      };

      await errorHandler.createWarnPheromone(transientError);

      expect(mockCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          ttl: 3600000 // Shorter TTL for transient errors
        })
      );
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle debugger agent failure', async () => {
      mockDebuggerAgent.analyzeFailure.mockResolvedValue({
        success: false,
        error: 'Debugger analysis failed'
      });

      const result = await errorHandler.handleTaskFailure('task-456', mockTaskFailure);

      expect(result.success).toBe(true); // Should still handle gracefully
      expect(result.strategy.type).toBe('retry'); // Fall back to retry
    });

    it('should handle agent spawning failures', async () => {
      mockAgentSpawner.spawnSpecializedAgent.mockResolvedValue({
        success: false,
        error: 'Failed to spawn helper agent'
      });

      const spawnStrategy: RecoveryStrategy = {
        type: 'spawn_helper',
        config: { helperType: 'Debugger' }
      };

      const result = await errorHandler.executeRecoveryStrategy('task-456', spawnStrategy);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to spawn helper agent');
    });

    it('should handle canvas operation failures', async () => {
      mockCanvas.createErrorRecord.mockRejectedValue(new Error('Canvas operation failed'));

      const result = await errorHandler.handleTaskFailure('task-456', mockTaskFailure);

      // Should still attempt recovery despite canvas failure
      expect(result.success).toBe(true);
    });

    it('should handle concurrent error processing', async () => {
      const failures = [
        { ...mockTaskFailure, taskId: 'task-1' },
        { ...mockTaskFailure, taskId: 'task-2' },
        { ...mockTaskFailure, taskId: 'task-3' }
      ];

      const promises = failures.map((failure, index) =>
        errorHandler.handleTaskFailure(`task-${index + 1}`, failure)
      );

      const results = await Promise.all(promises);

      expect(results.every(r => r.success)).toBe(true);
      expect(mockCanvas.createErrorRecord).toHaveBeenCalledTimes(3);
    });
  });

  describe('performance and optimization', () => {
    it('should complete error handling within reasonable time', async () => {
      const startTime = Date.now();
      
      await errorHandler.handleTaskFailure('task-456', mockTaskFailure);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should efficiently analyze error patterns', async () => {
      const largeErrorHistory = Array.from({ length: 100 }, (_, i) => ({
        id: `err-${i}`,
        type: 'system_failure',
        errorMessage: `Error ${i}`,
        timestamp: new Date(Date.now() - i * 3600000).toISOString()
      }));

      mockCanvas.getErrorHistory.mockResolvedValue(largeErrorHistory);

      const startTime = Date.now();
      await errorHandler.analyzeErrorPattern('task-456');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should analyze efficiently
    });

    it('should cache error analysis results', async () => {
      await errorHandler.analyzeErrorPattern('task-456');
      await errorHandler.analyzeErrorPattern('task-456'); // Same task

      // Should cache results and not call canvas twice
      expect(mockCanvas.getErrorHistory).toHaveBeenCalledTimes(1);
    });
  });
});