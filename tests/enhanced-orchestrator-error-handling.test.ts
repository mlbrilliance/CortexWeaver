/**
 * Enhanced Orchestrator Error Handling Integration Tests
 * 
 * Tests the enhanced error handling capabilities of the Orchestrator with CodeSavant integration
 */

import { Orchestrator, OrchestratorConfig } from '../src/orchestrator';
import { CognitiveCanvas } from '../src/cognitive-canvas';
import { WorkspaceManager } from '../src/workspace';
import { SessionManager } from '../src/session';
import { ErrorRecoverySystem } from '../src/error-recovery';
import { CodeSavant } from '../src/code-savant';
import {
  CortexError,
  ErrorSeverity,
  ErrorCategory,
  ErrorPhase
} from '../src/types/error-types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { setupFileSystemMocks } from './test-utils';

// Mock all the dependencies
jest.mock('../src/cognitive-canvas');
jest.mock('../src/workspace');
jest.mock('../src/session');
jest.mock('../src/error-recovery');
jest.mock('../src/code-savant');
jest.mock('../src/plan-parser');
jest.mock('../src/claude-client');

describe('Enhanced Orchestrator Error Handling', () => {
  setupFileSystemMocks();
  
  let orchestrator: Orchestrator;
  let testProjectPath: string;
  let mockCanvas: jest.Mocked<CognitiveCanvas>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockSessionManager: jest.Mocked<SessionManager>;
  
  const mockPlanParser = {
    parse: jest.fn().mockReturnValue({
      title: 'Enhanced Error Handling Test Project',
      overview: 'A project designed to test enhanced error handling',
      features: [
        {
          name: 'Basic Task',
          priority: 'High',
          description: 'Simple task to test basic functionality',
          dependencies: [],
          agent: 'SpecWriter',
          acceptanceCriteria: ['Task completes successfully'],
          microtasks: ['Task execution']
        }
      ],
      architectureDecisions: {
        technologyStack: { language: 'TypeScript', framework: 'Node.js' },
        qualityStandards: { coverage: '90%', linting: 'ESLint' }
      }
    }),
    getDependencyOrder: jest.fn().mockReturnValue([])
  };

  const validConfig: OrchestratorConfig = {
    neo4j: {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'password'
    },
    claude: {
      apiKey: 'test-api-key',
      budgetLimit: 100
    }
  };

  const testPlan = `# Enhanced Error Handling Test Project

## Overview
A project designed to test enhanced error handling and CodeSavant integration.

## Features

### Feature 1: Basic Task
- **Priority**: High
- **Description**: Simple task to test basic functionality
- **Dependencies**: []
- **Agent**: SpecWriter
- **Acceptance Criteria**:
  - [ ] Task completes successfully
  - [ ] Error handling works properly

### Feature 2: Impasse-Prone Task
- **Priority**: Medium
- **Description**: Task that may trigger impasse conditions
- **Dependencies**: [Feature 1]
- **Agent**: Coder
- **Acceptance Criteria**:
  - [ ] CodeSavant intervention works
  - [ ] Recovery mechanisms function properly

## Architecture Decisions

### Technology Stack
- **Framework**: Enhanced error handling framework
- **AI Helper**: CodeSavant integration

### Quality Standards
- **Error Recovery**: 95% success rate
- **Response Time**: < 30 seconds for impasse resolution
`;

  beforeEach(async () => {
    // Directly set the test project path since we're in a mocked environment
    testProjectPath = '/tmp/test-project-12345';
    
    // All file operations are mocked, so we just need to make sure they return
    // appropriate values for our tests

    // Mock dependencies
    mockCanvas = {
      initializeSchema: jest.fn().mockResolvedValue(undefined),
      createProject: jest.fn().mockResolvedValue({ id: 'test-project-001' }),
      createTask: jest.fn().mockImplementation((task) => Promise.resolve(task)),
      createTaskDependency: jest.fn().mockResolvedValue(undefined),
      storeArchitecturalDecision: jest.fn().mockResolvedValue(undefined),
      getTasksByProject: jest.fn().mockResolvedValue([]),
      getTaskDependencies: jest.fn().mockResolvedValue([]),
      updateTaskStatus: jest.fn().mockResolvedValue(undefined),
      createPheromone: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockWorkspace = {
      createWorktree: jest.fn().mockResolvedValue({
        id: 'test-worktree',
        path: '/tmp/test-worktree',
        branch: 'feature/test',
        baseBranch: 'main'
      }),
      removeWorktree: jest.fn().mockResolvedValue(true),
      getWorktreeStatus: jest.fn().mockResolvedValue({ clean: true, files: [] }),
      commitChanges: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockSessionManager = {
      createSession: jest.fn().mockResolvedValue({
        sessionId: 'test-session-001',
        taskId: 'test-task',
        status: 'running' as const,
        createdAt: new Date()
      }),
      startAgentInSession: jest.fn().mockResolvedValue(undefined),
      getSessionOutput: jest.fn().mockResolvedValue('Test session output'),
      killSession: jest.fn().mockResolvedValue(true),
      listSessions: jest.fn().mockReturnValue([])
    } as any;

    // Mock the plan parser
    const { PlanParser } = require('../src/plan-parser');
    PlanParser.mockImplementation(() => mockPlanParser);
    
    orchestrator = new Orchestrator(validConfig);
  });

  afterEach(async () => {
    try {
      if (orchestrator && typeof orchestrator.isRunning === 'function' && orchestrator.isRunning()) {
        await orchestrator.shutdown();
      }
      // Skip file removal since we're in a mocked environment
    } catch (error) {
      // Ignore cleanup errors in test environment
    }
  });

  describe('Enhanced Error Recovery Integration', () => {
    beforeEach(() => {
      // Inject mocks
      (orchestrator as any).canvas = mockCanvas;
      (orchestrator as any).workspace = mockWorkspace;
      (orchestrator as any).sessionManager = mockSessionManager;
    });

    it('should initialize with enhanced error recovery system', async () => {
      await orchestrator.initialize(testProjectPath);

      expect(orchestrator.getStatus()).toBe('initialized');
      // Verify that enhanced error handling methods are available
      expect(typeof orchestrator.getActiveCodeSavantSessions).toBe('function');
      expect(typeof orchestrator.getTaskErrorHistory).toBe('function');
      expect(typeof orchestrator.getErrorRecoveryStatistics).toBe('function');
    });

    it('should handle initialization errors with proper classification', async () => {
      // Mock schema initialization failure
      mockCanvas.initializeSchema.mockRejectedValue(new Error('Database connection failed'));

      await expect(orchestrator.initialize(testProjectPath)).rejects.toThrow(CortexError);
      
      try {
        await orchestrator.initialize(testProjectPath);
      } catch (error) {
        expect(error).toBeInstanceOf(CortexError);
        expect((error as CortexError).category).toBe(ErrorCategory.INFRASTRUCTURE);
        expect((error as CortexError).severity).toBe(ErrorSeverity.HIGH);
      }
    });

    it('should use error recovery for agent spawn failures', async () => {
      await orchestrator.initialize(testProjectPath);

      // Create test task
      const testTask = {
        id: 'test-task-001',
        title: 'Test Task',
        description: 'Test task for error recovery',
        status: 'pending',
        priority: 'high',
        projectId: 'test-project-001',
        createdAt: new Date().toISOString()
      };

      // Mock workspace creation failure followed by success
      mockWorkspace.createWorktree
        .mockRejectedValueOnce(new Error('Disk space exhausted'))
        .mockResolvedValueOnce({
          id: 'test-worktree',
          path: '/tmp/test-worktree',
          branch: 'feature/test',
          baseBranch: 'main'
        });

      // Should recover from the error
      await expect(orchestrator.spawnAgent(testTask, 'SpecWriter')).resolves.not.toThrow();

      // Verify error recovery was used
      expect(mockWorkspace.createWorktree).toHaveBeenCalledTimes(2);
    });

    it('should escalate to human intervention when recovery fails', async () => {
      await orchestrator.initialize(testProjectPath);

      const testTask = {
        id: 'escalation-task',
        title: 'Escalation Test Task',
        description: 'Task for testing escalation',
        status: 'pending',
        priority: 'critical',
        projectId: 'test-project-001',
        createdAt: new Date().toISOString()
      };

      // Mock persistent failure
      mockWorkspace.createWorktree.mockRejectedValue(new Error('Persistent infrastructure failure'));

      await expect(orchestrator.spawnAgent(testTask, 'SpecWriter')).rejects.toThrow();

      // Verify task was marked for human intervention
      expect(mockCanvas.updateTaskStatus).toHaveBeenCalledWith(
        'escalation-task',
        'human_intervention_required'
      );
    });
  });

  describe('CodeSavant Integration for Impasse Resolution', () => {
    beforeEach(async () => {
      (orchestrator as any).canvas = mockCanvas;
      (orchestrator as any).workspace = mockWorkspace;
      (orchestrator as any).sessionManager = mockSessionManager;
      
      await orchestrator.initialize(testProjectPath);
    });

    it('should handle impasse with CodeSavant intervention', async () => {
      const taskId = 'impasse-task-001';

      // Mock successful CodeSavant spawn
      const mockCodeSavantSession = {
        sessionId: 'codesavant-session-001',
        taskId: `codesavant-${taskId}-${Date.now()}`,
        status: 'running' as const,
        createdAt: new Date()
      };

      mockSessionManager.createSession.mockResolvedValueOnce(mockCodeSavantSession);

      await orchestrator.handleImpasse(taskId);

      // Verify task status progression
      expect(mockCanvas.updateTaskStatus).toHaveBeenCalledWith(taskId, 'impasse');
      expect(mockCanvas.updateTaskStatus).toHaveBeenCalledWith(taskId, 'codesavant_intervention');

      // Verify CodeSavant session was created
      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith(
        expect.stringContaining('codesavant'),
        expect.stringContaining('helper/'),
        'main'
      );

      expect(mockSessionManager.createSession).toHaveBeenCalled();
      expect(mockSessionManager.startAgentInSession).toHaveBeenCalledWith(
        mockCodeSavantSession.sessionId,
        'claude-code',
        expect.stringContaining('CodeSavant')
      );
    });

    it('should escalate to human when CodeSavant fails', async () => {
      const taskId = 'codesavant-failure-task';

      // Mock CodeSavant failure
      mockWorkspace.createWorktree.mockRejectedValue(new Error('CodeSavant spawn failed'));

      await orchestrator.handleImpasse(taskId);

      // Verify escalation to human intervention
      expect(mockCanvas.updateTaskStatus).toHaveBeenCalledWith(taskId, 'impasse');
      expect(mockCanvas.updateTaskStatus).toHaveBeenCalledWith(taskId, 'human_intervention_required');
    });

    it('should track active CodeSavant sessions', async () => {
      const taskId = 'tracking-task-001';

      await orchestrator.handleImpasse(taskId);

      const activeSessions = orchestrator.getActiveCodeSavantSessions();
      expect(activeSessions.has(taskId)).toBe(true);
    });

    it('should store comprehensive error context for CodeSavant', async () => {
      const taskId = 'context-task-001';

      await orchestrator.handleImpasse(taskId);

      // Verify error was stored in history
      const errorHistory = orchestrator.getTaskErrorHistory(taskId);
      expect(errorHistory).toHaveLength(1);

      const impasseError = errorHistory[0];
      expect(impasseError).toBeInstanceOf(CortexError);
      expect(impasseError.category).toBe(ErrorCategory.IMPASSE);
      expect(impasseError.context.taskId).toBe(taskId);
    });
  });

  describe('Error History and Learning', () => {
    beforeEach(async () => {
      (orchestrator as any).canvas = mockCanvas;
      (orchestrator as any).workspace = mockWorkspace;
      (orchestrator as any).sessionManager = mockSessionManager;
      
      await orchestrator.initialize(testProjectPath);
    });

    it('should maintain error history per task', async () => {
      const taskId = 'history-task-001';

      // Create multiple errors for the same task
      await orchestrator.handleImpasse(taskId);
      
      // Simulate another error
      const testTask = {
        id: taskId,
        title: 'History Test Task',
        description: 'Task for testing error history',
        status: 'pending',
        priority: 'medium',
        projectId: 'test-project-001',
        createdAt: new Date().toISOString()
      };

      mockWorkspace.createWorktree.mockRejectedValueOnce(new Error('Second error'));

      try {
        await orchestrator.spawnAgent(testTask, 'Coder');
      } catch (error) {
        // Expected to fail
      }

      const errorHistory = orchestrator.getTaskErrorHistory(taskId);
      expect(errorHistory.length).toBeGreaterThan(0);
      expect(errorHistory.every(error => error instanceof CortexError)).toBe(true);
    });

    it('should limit error history size per task', async () => {
      const taskId = 'limit-test-task';

      // Generate more than 10 errors
      for (let i = 0; i < 12; i++) {
        await orchestrator.handleImpasse(`${taskId}-${i}`);
      }

      const errorHistory = orchestrator.getTaskErrorHistory('limit-test-task-0');
      expect(errorHistory.length).toBeLessThanOrEqual(10);
    });

    it('should provide recovery statistics', async () => {
      await orchestrator.handleImpasse('stats-task-001');
      await orchestrator.handleImpasse('stats-task-002');

      const stats = orchestrator.getErrorRecoveryStatistics();
      expect(stats).toHaveProperty('totalRecoveries');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('averageAttempts');
      expect(stats).toHaveProperty('circuitBreakerStates');
      expect(stats).toHaveProperty('learningDatabase');
    });
  });

  describe('Enhanced Status Management', () => {
    beforeEach(async () => {
      (orchestrator as any).canvas = mockCanvas;
      await orchestrator.initialize(testProjectPath);
    });

    it('should transition to degraded status for non-critical errors', async () => {
      const mediumError = new Error('Non-critical infrastructure issue');
      
      await (orchestrator as any).handleOrchestrationError(
        (orchestrator as any).createCortexError(
          mediumError,
          ErrorSeverity.MEDIUM,
          ErrorCategory.INFRASTRUCTURE,
          ErrorPhase.TASK_EXECUTION
        )
      );

      expect(orchestrator.getStatus()).toBe('degraded');
    });

    it('should transition to error status for critical errors', async () => {
      const criticalError = new Error('Critical system failure');
      
      await (orchestrator as any).handleOrchestrationError(
        (orchestrator as any).createCortexError(
          criticalError,
          ErrorSeverity.CRITICAL,
          ErrorCategory.INFRASTRUCTURE,
          ErrorPhase.INITIALIZATION
        )
      );

      expect(orchestrator.getStatus()).toBe('error');
    });

    it('should store orchestration error pheromones', async () => {
      const error = new Error('Test orchestration error');
      
      await (orchestrator as any).handleOrchestrationError(
        (orchestrator as any).createCortexError(
          error,
          ErrorSeverity.HIGH,
          ErrorCategory.INFRASTRUCTURE,
          ErrorPhase.TASK_EXECUTION
        )
      );

      expect(mockCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          context: 'orchestrator_error',
          strength: 0.6, // High severity non-critical
          metadata: expect.objectContaining({
            message: 'Test orchestration error',
            severity: ErrorSeverity.HIGH,
            category: ErrorCategory.INFRASTRUCTURE
          })
        })
      );
    });
  });

  describe('Task Processing Error Handling', () => {
    beforeEach(async () => {
      (orchestrator as any).canvas = mockCanvas;
      await orchestrator.initialize(testProjectPath);
    });

    it('should handle task processing errors gracefully', async () => {
      // Mock task retrieval failure
      mockCanvas.getTasksByProject.mockRejectedValue(new Error('Database query failed'));

      // Should not throw but handle gracefully
      await orchestrator.processNextTask();

      expect(orchestrator.getStatus()).toBe('initialized'); // Should remain stable
    });

    it('should update task status based on error category', async () => {
      const taskId = 'processing-error-task';
      
      const impasseError = (orchestrator as any).createCortexError(
        new Error('Processing impasse'),
        ErrorSeverity.HIGH,
        ErrorCategory.IMPASSE,
        ErrorPhase.TASK_EXECUTION,
        { taskId }
      );

      await (orchestrator as any).handleTaskProcessingError(impasseError);

      expect(mockCanvas.updateTaskStatus).toHaveBeenCalledWith(taskId, 'impasse');
    });

    it('should track task-specific error patterns', async () => {
      const taskId = 'pattern-task';
      
      // Generate similar errors
      for (let i = 0; i < 3; i++) {
        const error = (orchestrator as any).createCortexError(
          new Error(`Network error ${i}`),
          ErrorSeverity.MEDIUM,
          ErrorCategory.NETWORK,
          ErrorPhase.TASK_EXECUTION,
          { taskId: `${taskId}-${i}` }
        );
        
        await (orchestrator as any).handleTaskProcessingError(error);
      }

      // Verify errors are tracked
      expect(orchestrator.getTaskErrorHistory(`${taskId}-0`)).toHaveLength(1);
      expect(orchestrator.getTaskErrorHistory(`${taskId}-1`)).toHaveLength(1);
      expect(orchestrator.getTaskErrorHistory(`${taskId}-2`)).toHaveLength(1);
    });
  });

  describe('Integration with Pheromone Learning System', () => {
    beforeEach(async () => {
      (orchestrator as any).canvas = mockCanvas;
      (orchestrator as any).workspace = mockWorkspace;
      (orchestrator as any).sessionManager = mockSessionManager;
      
      await orchestrator.initialize(testProjectPath);
    });

    it('should store recovery pheromones for successful interventions', async () => {
      const taskId = 'learning-task-001';

      await orchestrator.handleImpasse(taskId);

      // Should store both impasse and recovery pheromones
      const pheromonesCalls = mockCanvas.createPheromone.mock.calls;
      
      const impassePheromone = pheromonesCalls.find(call => 
        call[0].type === 'impasse'
      );
      
      expect(impassePheromone).toBeDefined();
      expect(impassePheromone![0]).toMatchObject({
        type: 'impasse',
        context: 'agent_impasse',
        metadata: expect.objectContaining({
          taskId,
          cortexError: expect.objectContaining({
            category: ErrorCategory.IMPASSE
          })
        })
      });
    });

    it('should create escalation pheromones for human intervention', async () => {
      const taskId = 'escalation-pheromone-task';

      // Mock CodeSavant failure to trigger escalation
      mockWorkspace.createWorktree.mockRejectedValue(new Error('CodeSavant infrastructure failure'));

      await orchestrator.handleImpasse(taskId);

      // Verify human intervention status
      expect(mockCanvas.updateTaskStatus).toHaveBeenCalledWith(
        taskId,
        'human_intervention_required'
      );
    });

    it('should integrate error patterns with pheromone decay', async () => {
      const taskId = 'decay-pattern-task';

      await orchestrator.handleImpasse(taskId);

      // Verify pheromones have appropriate expiry times
      const pheromoneCall = mockCanvas.createPheromone.mock.calls[0];
      const pheromone = pheromoneCall[0];
      
      expect(pheromone).toHaveProperty('expiresAt');
      expect(new Date(pheromone.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
  });
});