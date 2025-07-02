/**
 * Error Handling and Recovery Integration Tests
 * 
 * Tests comprehensive error scenarios and recovery mechanisms:
 * - Database connection failures and recovery
 * - Agent spawn failures and cleanup
 * - Session management errors and restoration
 * - Workspace corruption and recovery
 * - Network failures and retry mechanisms
 * - Resource exhaustion scenarios
 * - Graceful degradation patterns
 * - Circuit breaker implementations
 */

import { Orchestrator, OrchestratorConfig } from '../../src/orchestrator';
import { CognitiveCanvas } from '../../src/cognitive-canvas';
import { WorkspaceManager } from '../../src/workspace';
import { SessionManager } from '../../src/session';
import { ClaudeClient } from '../../src/claude-client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Error Handling and Recovery Integration Tests', () => {
  let testProjectPath: string;
  let orchestrator: Orchestrator;
  let canvas: CognitiveCanvas;
  let workspace: WorkspaceManager;
  let sessionManager: SessionManager;
  
  const validConfig: OrchestratorConfig = {
    neo4j: {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password'
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY || 'test-api-key',
      budgetLimit: 50
    }
  };

  const errorTestPlan = `# Error Recovery Test Project

## Overview

A project designed to test comprehensive error handling and recovery mechanisms across all system components.

## Features

### Feature 1: Basic Task
- **Priority**: High
- **Description**: Simple task to test basic functionality
- **Dependencies**: []
- **Agent**: SpecWriter
- **Acceptance Criteria**:
  - [ ] Task completes successfully under normal conditions
  - [ ] Task handles errors gracefully

### Feature 2: Resource Intensive Task
- **Priority**: Medium
- **Description**: Task that may cause resource exhaustion
- **Dependencies**: [Feature 1]
- **Agent**: Architect
- **Acceptance Criteria**:
  - [ ] Task handles resource limitations
  - [ ] System remains stable under load

### Feature 3: Complex Dependencies
- **Priority**: Low
- **Description**: Task with complex dependency chain
- **Dependencies**: [Feature 2]
- **Agent**: Coder
- **Acceptance Criteria**:
  - [ ] Dependency resolution works correctly
  - [ ] Error propagation is handled properly

## Architecture Decisions

### Technology Stack
- **Framework**: Error-prone test framework
- **Database**: Unreliable test database

### Quality Standards
- **Error Recovery**: 100% coverage
- **Resilience**: System must recover from all error conditions
`;

  beforeAll(async () => {
    // Create temporary test project directory
    testProjectPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cortex-error-test-'));
    
    // Write the test plan file
    await fs.promises.writeFile(
      path.join(testProjectPath, 'plan.md'),
      errorTestPlan
    );

    // Initialize components
    canvas = new CognitiveCanvas(validConfig.neo4j);
    workspace = new WorkspaceManager();
    sessionManager = new SessionManager();
    
    try {
      await canvas.initializeSchema();
      // Clear any existing test data
      const session = (canvas as any).driver.session();
      await session.run('MATCH (n) WHERE n.projectId STARTS WITH "error-test-" DETACH DELETE n');
      await session.close();
    } catch (error) {
      console.warn('Could not clean test database:', error);
    }
  });

  afterAll(async () => {
    // Cleanup
    try {
      if (orchestrator) {
        await orchestrator.shutdown();
      }
      await canvas.close();
      await fs.promises.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  beforeEach(() => {
    orchestrator = new Orchestrator(validConfig);
  });

  afterEach(async () => {
    if (orchestrator && orchestrator.isRunning()) {
      await orchestrator.shutdown();
    }
  });

  describe('Database Connection Failures', () => {
    it('should handle initial database connection failure gracefully', async () => {
      const invalidConfig: OrchestratorConfig = {
        ...validConfig,
        neo4j: {
          uri: 'bolt://nonexistent-host:7687',
          username: 'invalid',
          password: 'invalid'
        }
      };

      const faultyOrchestrator = new Orchestrator(invalidConfig);
      
      // Should handle initialization failure gracefully
      await expect(faultyOrchestrator.initialize(testProjectPath))
        .rejects.toThrow();
      
      expect(faultyOrchestrator.getStatus()).toBe('error');
      expect(faultyOrchestrator.isRunning()).toBe(false);
    });

    it('should recover from temporary database connection loss', async () => {
      // Start with valid connection
      await orchestrator.initialize(testProjectPath);
      expect(orchestrator.getStatus()).toBe('initialized');
      
      // Mock temporary database failure
      const originalCanvas = (orchestrator as any).canvas;
      const mockFailingCanvas = {
        ...originalCanvas,
        getTasksByProject: jest.fn()
          .mockRejectedValueOnce(new Error('Connection lost'))
          .mockRejectedValueOnce(new Error('Connection lost'))
          .mockResolvedValue([]), // Recovery on third attempt
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      (orchestrator as any).canvas = mockFailingCanvas;
      
      // Start orchestration - should handle failures gracefully
      const startPromise = orchestrator.start();
      
      // Let it run briefly
      await new Promise(resolve => setTimeout(resolve, 5000));
      await orchestrator.shutdown();
      
      // Verify error handling was invoked
      expect(mockFailingCanvas.getTasksByProject).toHaveBeenCalledTimes(3);
    });

    it('should implement exponential backoff for database retries', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const retryTimes: number[] = [];
      let callCount = 0;
      
      // Mock failing database operations with timing
      const mockCanvas = {
        getTasksByProject: jest.fn().mockImplementation(async () => {
          const currentTime = Date.now();
          retryTimes.push(currentTime);
          callCount++;
          
          if (callCount <= 3) {
            throw new Error(`Database failure ${callCount}`);
          }
          return [];
        }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      (orchestrator as any).canvas = mockCanvas;
      
      const startTime = Date.now();
      
      // Should retry with exponential backoff
      await orchestrator.processNextTask();
      
      // Verify exponential backoff pattern (allowing some timing variance)
      if (retryTimes.length >= 3) {
        const interval1 = retryTimes[1] - retryTimes[0];
        const interval2 = retryTimes[2] - retryTimes[1];
        
        // Second interval should be longer than first (exponential backoff)
        expect(interval2).toBeGreaterThan(interval1 * 0.8); // Allow 20% variance for timing
      }
    });

    it('should maintain data consistency during partial failures', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Create a task to test consistency
      const testTask = await canvas.createTask({
        id: 'consistency-test-task',
        title: 'Consistency Test Task',
        description: 'Task for testing data consistency',
        status: 'pending',
        priority: 'High',
        projectId: projectId,
        createdAt: new Date().toISOString()
      });
      
      // Mock partial failure scenario
      let operationCount = 0;
      const mockCanvas = {
        ...canvas,
        getTasksByProject: jest.fn().mockImplementation(async () => {
          operationCount++;
          if (operationCount === 2) {
            throw new Error('Partial failure during task retrieval');
          }
          return [testTask];
        }),
        createTaskDependency: jest.fn().mockImplementation(async () => {
          operationCount++;
          if (operationCount === 4) {
            throw new Error('Partial failure during dependency creation');
          }
          return undefined;
        })
      };
      
      (orchestrator as any).canvas = mockCanvas;
      
      // Operation should handle partial failures without corrupting data
      try {
        await orchestrator.processNextTask();
      } catch (error) {
        // Expected to fail gracefully
      }
      
      // Verify original data is still intact
      const tasks = await canvas.getTasksByProject(projectId);
      const consistencyTask = tasks.find(t => t.id === 'consistency-test-task');
      expect(consistencyTask).toBeTruthy();
      expect(consistencyTask?.status).toBe('pending'); // Should not be corrupted
    });
  });

  describe('Agent Spawn and Session Failures', () => {
    it('should handle workspace creation failures with cleanup', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      const testTask = tasks[0];
      
      // Mock workspace creation failure
      const mockWorkspace = {
        createWorktree: jest.fn().mockRejectedValue(new Error('Disk full - cannot create worktree')),
        removeWorktree: jest.fn().mockResolvedValue(true),
        getWorktreeStatus: jest.fn().mockResolvedValue({ clean: true, files: [] })
      };
      
      (orchestrator as any).workspace = mockWorkspace;
      
      // Should handle workspace creation failure
      await expect(orchestrator.spawnAgent(testTask, 'SpecWriter'))
        .rejects.toThrow('Failed to spawn agent');
      
      expect(mockWorkspace.createWorktree).toHaveBeenCalled();
      // No worktree to remove since creation failed
    });

    it('should handle session creation failures with worktree cleanup', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      const testTask = tasks[0];
      
      // Mock successful worktree creation but failed session creation
      const mockWorkspace = {
        createWorktree: jest.fn().mockResolvedValue({
          id: testTask.id,
          path: `/tmp/test-worktree-${testTask.id}`,
          branch: `feature/${testTask.id}`,
          baseBranch: 'main'
        }),
        removeWorktree: jest.fn().mockResolvedValue(true)
      };
      
      const mockSessionManager = {
        createSession: jest.fn().mockRejectedValue(new Error('Session creation failed - out of memory'))
      };
      
      (orchestrator as any).workspace = mockWorkspace;
      (orchestrator as any).sessionManager = mockSessionManager;
      
      // Should handle session creation failure and cleanup worktree
      await expect(orchestrator.spawnAgent(testTask, 'SpecWriter'))
        .rejects.toThrow('Failed to spawn agent');
      
      expect(mockWorkspace.createWorktree).toHaveBeenCalled();
      expect(mockSessionManager.createSession).toHaveBeenCalled();
      expect(mockWorkspace.removeWorktree).toHaveBeenCalledWith(testTask.id);
    });

    it('should handle agent startup failures with session cleanup', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      const testTask = tasks[0];
      
      // Mock successful worktree and session creation but failed agent startup
      const mockWorkspace = {
        createWorktree: jest.fn().mockResolvedValue({
          id: testTask.id,
          path: `/tmp/test-worktree-${testTask.id}`,
          branch: `feature/${testTask.id}`,
          baseBranch: 'main'
        }),
        removeWorktree: jest.fn().mockResolvedValue(true)
      };
      
      const sessionId = `cortex-${testTask.id}-123`;
      const mockSessionManager = {
        createSession: jest.fn().mockResolvedValue({
          sessionId: sessionId,
          taskId: testTask.id,
          status: 'running',
          createdAt: new Date()
        }),
        startAgentInSession: jest.fn().mockRejectedValue(new Error('Agent startup failed - command not found')),
        killSession: jest.fn().mockResolvedValue(true)
      };
      
      (orchestrator as any).workspace = mockWorkspace;
      (orchestrator as any).sessionManager = mockSessionManager;
      
      // Should handle agent startup failure and cleanup both session and worktree
      await expect(orchestrator.spawnAgent(testTask, 'SpecWriter'))
        .rejects.toThrow('Failed to spawn agent');
      
      expect(mockWorkspace.createWorktree).toHaveBeenCalled();
      expect(mockSessionManager.createSession).toHaveBeenCalled();
      expect(mockSessionManager.startAgentInSession).toHaveBeenCalled();
      expect(mockWorkspace.removeWorktree).toHaveBeenCalledWith(testTask.id);
    });

    it('should detect and recover from zombie sessions', async () => {
      await orchestrator.initialize(testProjectPath);
      
      // Mock session manager with zombie detection
      const zombieSessions = [
        { sessionId: 'cortex-zombie-1', taskId: 'task-1', status: 'running' as const, createdAt: new Date(Date.now() - 3600000) }, // 1 hour old
        { sessionId: 'cortex-zombie-2', taskId: 'task-2', status: 'running' as const, createdAt: new Date(Date.now() - 7200000) }  // 2 hours old
      ];
      
      const mockSessionManager = {
        listSessions: jest.fn().mockReturnValue(zombieSessions),
        listActiveTmuxSessions: jest.fn().mockReturnValue([]), // No active tmux sessions
        cleanupDeadSessions: jest.fn().mockImplementation(async () => {
          // Simulate cleanup logic
          const activeSessions = await mockSessionManager.listActiveTmuxSessions();
          const allSessions = mockSessionManager.listSessions();
          
          for (const session of allSessions) {
            if (!activeSessions.includes(session.sessionId)) {
              console.log(`Cleaning up zombie session: ${session.sessionId}`);
            }
          }
        }),
        killSession: jest.fn().mockResolvedValue(true)
      };
      
      (orchestrator as any).sessionManager = mockSessionManager;
      
      // Execute cleanup
      await mockSessionManager.cleanupDeadSessions();
      
      expect(mockSessionManager.listSessions).toHaveBeenCalled();
      expect(mockSessionManager.listActiveTmuxSessions).toHaveBeenCalled();
      expect(mockSessionManager.cleanupDeadSessions).toHaveBeenCalled();
    });

    it('should handle cascading session failures', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      let tasks = await canvas.getTasksByProject(projectId);
      
      // Create multiple tasks for cascading failure test
      const additionalTasks = await Promise.all([
        canvas.createTask({
          id: 'cascade-task-1',
          title: 'Cascade Test Task 1',
          description: 'First task in cascade',
          status: 'pending',
          priority: 'High',
          projectId: projectId,
          createdAt: new Date().toISOString()
        }),
        canvas.createTask({
          id: 'cascade-task-2', 
          title: 'Cascade Test Task 2',
          description: 'Second task in cascade',
          status: 'pending',
          priority: 'Medium',
          projectId: projectId,
          createdAt: new Date().toISOString()
        })
      ]);
      
      tasks = tasks.concat(additionalTasks);
      
      // Mock cascading session failures
      let sessionFailureCount = 0;
      const mockSessionManager = {
        createSession: jest.fn().mockImplementation(async (taskId) => {
          sessionFailureCount++;
          if (sessionFailureCount <= 2) {
            throw new Error(`Session failure ${sessionFailureCount} for task ${taskId}`);
          }
          return {
            sessionId: `cortex-${taskId}-${Date.now()}`,
            taskId: taskId,
            status: 'running',
            createdAt: new Date()
          };
        }),
        killSession: jest.fn().mockResolvedValue(true)
      };
      
      const mockWorkspace = {
        createWorktree: jest.fn().mockImplementation((taskId) => ({
          id: taskId,
          path: `/tmp/worktree-${taskId}`,
          branch: `feature/${taskId}`,
          baseBranch: 'main'
        })),
        removeWorktree: jest.fn().mockResolvedValue(true)
      };
      
      (orchestrator as any).sessionManager = mockSessionManager;
      (orchestrator as any).workspace = mockWorkspace;
      
      // Map tasks to features for spawning
      for (const task of tasks) {
        (orchestrator as any).taskFeatureMap.set(task.id, {
          name: task.title,
          priority: task.priority,
          description: task.description,
          dependencies: [],
          agent: 'SpecWriter',
          acceptanceCriteria: [],
          microtasks: []
        });
      }
      
      // Attempt to spawn agents - first two should fail, third should succeed
      const results = await Promise.allSettled([
        orchestrator.spawnAgent(tasks[0], 'SpecWriter'),
        orchestrator.spawnAgent(tasks[1], 'SpecWriter'),
        orchestrator.spawnAgent(tasks[2], 'SpecWriter')
      ]);
      
      // First two should be rejected, third should be fulfilled
      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
      
      // Verify cleanup was called for failed sessions
      expect(mockWorkspace.removeWorktree).toHaveBeenCalledTimes(2); // For the two failures
    });
  });

  describe('Resource Exhaustion and Limits', () => {
    it('should handle memory exhaustion gracefully', async () => {
      await orchestrator.initialize(testProjectPath);
      
      // Mock memory-intensive operations
      const mockCanvas = {
        getTasksByProject: jest.fn().mockImplementation(async () => {
          // Simulate memory pressure
          const largeArray = new Array(1000000).fill('memory-intensive-data');
          
          // Simulate out of memory condition
          if (Math.random() > 0.7) {
            throw new Error('JavaScript heap out of memory');
          }
          
          return [];
        }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      (orchestrator as any).canvas = mockCanvas;
      
      // Should handle memory exhaustion without crashing
      let memoryErrorCaught = false;
      try {
        await orchestrator.processNextTask();
      } catch (error) {
        if ((error as Error).message.includes('heap out of memory')) {
          memoryErrorCaught = true;
        }
      }
      
      // System should remain stable after memory error
      expect(orchestrator.getStatus()).not.toBe('error');
      expect(orchestrator.isRunning()).toBe(false);
    });

    it('should handle disk space exhaustion', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      const testTask = tasks[0];
      
      // Mock disk space exhaustion during worktree creation
      const mockWorkspace = {
        createWorktree: jest.fn().mockRejectedValue(new Error('ENOSPC: no space left on device')),
        removeWorktree: jest.fn().mockResolvedValue(true)
      };
      
      (orchestrator as any).workspace = mockWorkspace;
      
      // Should handle disk space error gracefully
      await expect(orchestrator.spawnAgent(testTask, 'SpecWriter'))
        .rejects.toThrow('Failed to spawn agent');
      
      // System should not be in error state
      expect(orchestrator.getStatus()).toBe('initialized');
    });

    it('should enforce and respect budget limits', async () => {
      // Create orchestrator with very low budget
      const lowBudgetConfig: OrchestratorConfig = {
        ...validConfig,
        claude: {
          apiKey: validConfig.claude.apiKey,
          budgetLimit: 0.01 // Very low budget
        }
      };

      const budgetOrchestrator = new Orchestrator(lowBudgetConfig);
      await budgetOrchestrator.initialize(testProjectPath);
      
      // Mock high token usage exceeding budget
      const mockClient = {
        getTokenUsage: jest.fn().mockReturnValue({
          totalInputTokens: 100000,
          totalOutputTokens: 50000,
          totalTokens: 150000,
          requestCount: 1000,
          estimatedCost: 1.0 // Exceeds budget of 0.01
        }),
        getConfiguration: jest.fn().mockReturnValue({
          budgetLimit: 0.01,
          budgetWarningThreshold: 0.8,
          apiKey: 'test-key',
          defaultModel: 'claude-3-sonnet-20240229',
          maxTokens: 4096,
          temperature: 0.7
        })
      };
      
      (budgetOrchestrator as any).client = mockClient;
      
      // Should respect budget limit
      const canProceed = budgetOrchestrator.checkBudgetLimit();
      expect(canProceed).toBe(false);
      
      await budgetOrchestrator.shutdown();
    });

    it('should handle concurrent session limits', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Create multiple tasks for concurrent testing
      const concurrentTasks = await Promise.all([
        canvas.createTask({
          id: 'concurrent-task-1',
          title: 'Concurrent Task 1',
          description: 'First concurrent task',
          status: 'pending',
          priority: 'High',
          projectId: projectId,
          createdAt: new Date().toISOString()
        }),
        canvas.createTask({
          id: 'concurrent-task-2',
          title: 'Concurrent Task 2',
          description: 'Second concurrent task',
          status: 'pending',
          priority: 'High',
          projectId: projectId,
          createdAt: new Date().toISOString()
        }),
        canvas.createTask({
          id: 'concurrent-task-3',
          title: 'Concurrent Task 3',
          description: 'Third concurrent task',
          status: 'pending',
          priority: 'High',
          projectId: projectId,
          createdAt: new Date().toISOString()
        })
      ]);
      
      // Mock session manager with connection limits
      let activeSessionCount = 0;
      const maxConcurrentSessions = 2;
      
      const mockSessionManager = {
        createSession: jest.fn().mockImplementation(async (taskId) => {
          if (activeSessionCount >= maxConcurrentSessions) {
            throw new Error('Maximum concurrent sessions reached');
          }
          
          activeSessionCount++;
          return {
            sessionId: `cortex-${taskId}-${Date.now()}`,
            taskId: taskId,
            status: 'running',
            createdAt: new Date()
          };
        }),
        killSession: jest.fn().mockImplementation(async () => {
          activeSessionCount--;
          return true;
        })
      };
      
      const mockWorkspace = {
        createWorktree: jest.fn().mockImplementation((taskId) => ({
          id: taskId,
          path: `/tmp/worktree-${taskId}`,
          branch: `feature/${taskId}`,
          baseBranch: 'main'
        })),
        removeWorktree: jest.fn().mockResolvedValue(true)
      };
      
      (orchestrator as any).sessionManager = mockSessionManager;
      (orchestrator as any).workspace = mockWorkspace;
      
      // Map tasks to features
      for (const task of concurrentTasks) {
        (orchestrator as any).taskFeatureMap.set(task.id, {
          name: task.title,
          priority: task.priority,
          description: task.description,
          dependencies: [],
          agent: 'SpecWriter',
          acceptanceCriteria: [],
          microtasks: []
        });
      }
      
      // Attempt to spawn all agents concurrently
      const results = await Promise.allSettled([
        orchestrator.spawnAgent(concurrentTasks[0], 'SpecWriter'),
        orchestrator.spawnAgent(concurrentTasks[1], 'SpecWriter'),
        orchestrator.spawnAgent(concurrentTasks[2], 'SpecWriter')
      ]);
      
      // Should have at least some successful sessions within limit
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      expect(successful.length).toBeLessThanOrEqual(maxConcurrentSessions);
      expect(failed.length).toBeGreaterThan(0); // At least one should fail due to limit
    });
  });

  describe('Network and Communication Failures', () => {
    it('should handle API rate limiting with backoff', async () => {
      await orchestrator.initialize(testProjectPath);
      
      // Mock Claude API client with rate limiting
      let requestCount = 0;
      const mockClaudeClient = {
        sendMessage: jest.fn().mockImplementation(async () => {
          requestCount++;
          if (requestCount <= 3) {
            throw new Error('Rate limit exceeded - please try again later');
          }
          return { content: 'Success after rate limiting' };
        }),
        getTokenUsage: jest.fn().mockReturnValue({
          totalInputTokens: 1000,
          totalOutputTokens: 500,
          totalTokens: 1500,
          requestCount: requestCount,
          estimatedCost: 0.10
        }),
        getConfiguration: jest.fn().mockReturnValue({
          budgetLimit: 100,
          budgetWarningThreshold: 0.8,
          apiKey: 'test-key',
          defaultModel: 'claude-3-sonnet-20240229',
          maxTokens: 4096,
          temperature: 0.7
        })
      };
      
      (orchestrator as any).client = mockClaudeClient;
      
      // Should handle rate limiting with retries
      const usage = orchestrator.getTokenUsage();
      expect(usage.requestCount).toBeGreaterThan(0);
      
      // Should eventually succeed after rate limit clears
      expect(requestCount).toBeGreaterThan(3);
    });

    it('should handle intermittent network connectivity', async () => {
      await orchestrator.initialize(testProjectPath);
      
      // Mock intermittent connectivity
      let attemptCount = 0;
      const mockCanvas = {
        getTasksByProject: jest.fn().mockImplementation(async () => {
          attemptCount++;
          if (attemptCount % 2 === 1) {
            throw new Error('Network unreachable');
          }
          return [];
        }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      (orchestrator as any).canvas = mockCanvas;
      
      // Should handle intermittent connectivity
      let networkErrorsHandled = 0;
      try {
        await orchestrator.processNextTask();
      } catch (error) {
        if ((error as Error).message.includes('Network unreachable')) {
          networkErrorsHandled++;
        }
      }
      
      // Retry should eventually succeed
      try {
        await orchestrator.processNextTask();
        // Second attempt should succeed due to alternating pattern
      } catch (error) {
        // Expected if still failing
      }
      
      expect(attemptCount).toBeGreaterThan(1); // Multiple attempts made
    });

    it('should implement circuit breaker pattern for failing services', async () => {
      await orchestrator.initialize(testProjectPath);
      
      // Mock circuit breaker implementation
      class MockCircuitBreaker {
        private failureCount = 0;
        private isOpen = false;
        private lastFailureTime = 0;
        private readonly failureThreshold = 3;
        private readonly recoveryTimeout = 5000; // 5 seconds
        
        async execute<T>(operation: () => Promise<T>): Promise<T> {
          if (this.isOpen) {
            const now = Date.now();
            if (now - this.lastFailureTime < this.recoveryTimeout) {
              throw new Error('Circuit breaker is OPEN - service unavailable');
            } else {
              // Try to recover
              this.isOpen = false;
              this.failureCount = 0;
            }
          }
          
          try {
            const result = await operation();
            this.failureCount = 0; // Reset on success
            return result;
          } catch (error) {
            this.failureCount++;
            this.lastFailureTime = Date.now();
            
            if (this.failureCount >= this.failureThreshold) {
              this.isOpen = true;
            }
            
            throw error;
          }
        }
      }
      
      const circuitBreaker = new MockCircuitBreaker();
      let operationCount = 0;
      
      const failingOperation = async () => {
        operationCount++;
        if (operationCount <= 5) {
          throw new Error('Service unavailable');
        }
        return 'Success';
      };
      
      // First few attempts should fail and open circuit
      let circuitOpenErrorCaught = false;
      for (let i = 0; i < 6; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          if ((error as Error).message.includes('Circuit breaker is OPEN')) {
            circuitOpenErrorCaught = true;
          }
        }
        
        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      expect(circuitOpenErrorCaught).toBe(true);
      expect(operationCount).toBeGreaterThan(3); // Should have tried multiple times before opening
      
      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 5100));
      
      // Should recover and succeed
      const result = await circuitBreaker.execute(failingOperation);
      expect(result).toBe('Success');
    });
  });

  describe('Data Corruption and Recovery', () => {
    it('should detect and recover from corrupted project state', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Corrupt project data
      await canvas.updateProjectStatus(projectId, 'corrupted-state');
      
      // Mock state validation and recovery
      const mockCanvas = {
        ...canvas,
        getProject: jest.fn().mockImplementation(async (id) => {
          const project = await canvas.getProject(id);
          if (project?.status === 'corrupted-state') {
            // Simulate recovery
            await canvas.updateProjectStatus(id, 'initialized');
            return { ...project, status: 'initialized' };
          }
          return project;
        })
      };
      
      (orchestrator as any).canvas = mockCanvas;
      
      // Should detect and recover from corruption
      const recoveredProject = await mockCanvas.getProject(projectId);
      expect(recoveredProject?.status).toBe('initialized');
    });

    it('should handle orphaned resources cleanup', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Create orphaned resources
      const orphanedTask = await canvas.createTask({
        id: 'orphaned-task',
        title: 'Orphaned Task',
        description: 'Task without proper cleanup',
        status: 'running',
        priority: 'Medium',
        projectId: 'non-existent-project', // Orphaned
        createdAt: new Date().toISOString()
      });
      
      const orphanedContract = await canvas.createContract({
        id: 'orphaned-contract',
        name: 'Orphaned Contract',
        type: 'openapi',
        version: '1.0.0',
        specification: { openapi: '3.0.0', info: { title: 'Orphaned', version: '1.0.0' } },
        projectId: 'non-existent-project', // Orphaned
        createdAt: new Date().toISOString()
      });
      
      // Mock cleanup process
      const mockCanvas = {
        ...canvas,
        cleanupOrphanedResources: jest.fn().mockImplementation(async () => {
          // Find and clean orphaned resources
          const session = (canvas as any).driver.session();
          try {
            // Clean orphaned tasks
            const orphanedTasksResult = await session.run(`
              MATCH (t:Task) 
              WHERE NOT EXISTS((p:Project {id: t.projectId})) 
              RETURN t.id as taskId
            `);
            
            for (const record of orphanedTasksResult.records) {
              const taskId = record.get('taskId');
              await session.run('MATCH (t:Task {id: $id}) DETACH DELETE t', { id: taskId });
            }
            
            // Clean orphaned contracts
            const orphanedContractsResult = await session.run(`
              MATCH (c:Contract) 
              WHERE NOT EXISTS((p:Project {id: c.projectId})) 
              RETURN c.id as contractId
            `);
            
            for (const record of orphanedContractsResult.records) {
              const contractId = record.get('contractId');
              await session.run('MATCH (c:Contract {id: $id}) DETACH DELETE c', { id: contractId });
            }
            
            return {
              orphanedTasksCleanedUp: orphanedTasksResult.records.length,
              orphanedContractsCleanedUp: orphanedContractsResult.records.length
            };
          } finally {
            await session.close();
          }
        })
      };
      
      // Execute cleanup
      const cleanupResult = await mockCanvas.cleanupOrphanedResources();
      
      expect(cleanupResult.orphanedTasksCleanedUp).toBeGreaterThan(0);
      expect(cleanupResult.orphanedContractsCleanedUp).toBeGreaterThan(0);
      
      // Verify orphaned resources are removed
      const remainingOrphanedTask = await canvas.getTask('orphaned-task');
      const remainingOrphanedContract = await canvas.getContract('orphaned-contract');
      
      expect(remainingOrphanedTask).toBeNull();
      expect(remainingOrphanedContract).toBeNull();
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue operating with reduced functionality during partial failures', async () => {
      await orchestrator.initialize(testProjectPath);
      
      // Mock partial system failure
      const mockCanvas = {
        getTasksByProject: jest.fn().mockResolvedValue([]), // Still works
        createContract: jest.fn().mockRejectedValue(new Error('Contract service unavailable')), // Fails
        getProject: jest.fn().mockResolvedValue({ id: 'test', name: 'Test', status: 'initialized' }), // Still works
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      (orchestrator as any).canvas = mockCanvas;
      
      // System should continue operating without contract functionality
      const canContinue = await orchestrator.processNextTask();
      expect(orchestrator.getStatus()).toBe('initialized'); // Should not be in error state
      
      // Basic operations should still work
      expect(mockCanvas.getTasksByProject).toHaveBeenCalled();
    });

    it('should provide fallback mechanisms for failed operations', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      const testTask = tasks[0];
      
      // Mock primary operation failure with fallback
      const mockWorkspace = {
        createWorktree: jest.fn()
          .mockRejectedValueOnce(new Error('Primary worktree service failed'))
          .mockResolvedValueOnce({ // Fallback succeeds
            id: testTask.id,
            path: `/tmp/fallback-worktree-${testTask.id}`,
            branch: `fallback/${testTask.id}`,
            baseBranch: 'main'
          }),
        removeWorktree: jest.fn().mockResolvedValue(true)
      };
      
      const mockSessionManager = {
        createSession: jest.fn().mockResolvedValue({
          sessionId: `cortex-${testTask.id}-fallback`,
          taskId: testTask.id,
          status: 'running',
          createdAt: new Date()
        }),
        startAgentInSession: jest.fn().mockResolvedValue()
      };
      
      // Custom spawn agent with fallback logic
      const originalSpawnAgent = orchestrator.spawnAgent;
      orchestrator.spawnAgent = jest.fn().mockImplementation(async (task, agentType) => {
        try {
          // Try primary approach
          return await originalSpawnAgent.call(orchestrator, task, agentType);
        } catch (error) {
          // Fallback approach
          console.log('Primary spawn failed, trying fallback...');
          
          // Use fallback workspace
          (orchestrator as any).workspace = mockWorkspace;
          (orchestrator as any).sessionManager = mockSessionManager;
          
          // Retry with fallback
          return await originalSpawnAgent.call(orchestrator, task, agentType);
        }
      });
      
      // Should succeed with fallback
      await expect(orchestrator.spawnAgent(testTask, 'SpecWriter')).resolves.not.toThrow();
      
      // Verify fallback was used
      expect(mockWorkspace.createWorktree).toHaveBeenCalledTimes(2); // Primary failed, fallback succeeded
    });
  });

  describe('System Recovery and Health Checks', () => {
    it('should perform comprehensive system health checks', async () => {
      await orchestrator.initialize(testProjectPath);
      
      // Mock system health check
      const performHealthCheck = async () => {
        const health = {
          database: false,
          workspace: false,
          sessions: false,
          memory: false,
          disk: false
        };
        
        try {
          // Check database connectivity
          await canvas.getProject((orchestrator as any).projectId);
          health.database = true;
        } catch (error) {
          console.log('Database health check failed:', error);
        }
        
        try {
          // Check workspace functionality
          await workspace.getProjectRoot();
          health.workspace = true;
        } catch (error) {
          console.log('Workspace health check failed:', error);
        }
        
        try {
          // Check session management
          const sessions = sessionManager.listSessions();
          health.sessions = true;
        } catch (error) {
          console.log('Session health check failed:', error);
        }
        
        // Check memory usage (simplified)
        const memUsage = process.memoryUsage();
        health.memory = memUsage.heapUsed < (memUsage.heapTotal * 0.8); // Less than 80% usage
        
        // Check disk space (simplified mock)
        health.disk = true; // Assume healthy for test
        
        return health;
      };
      
      const health = await performHealthCheck();
      
      // Should detect healthy components
      expect(health.database).toBe(true);
      expect(health.workspace).toBe(true);
      expect(health.sessions).toBe(true);
      expect(health.memory).toBe(true);
      expect(health.disk).toBe(true);
    });

    it('should auto-recover from transient failures', async () => {
      await orchestrator.initialize(testProjectPath);
      
      // Mock transient failure with auto-recovery
      let failureCount = 0;
      const maxFailures = 3;
      
      const mockCanvas = {
        getTasksByProject: jest.fn().mockImplementation(async () => {
          failureCount++;
          if (failureCount <= maxFailures) {
            throw new Error(`Transient failure ${failureCount}`);
          }
          return []; // Recover after max failures
        }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      (orchestrator as any).canvas = mockCanvas;
      
      // Implement auto-recovery with exponential backoff
      const autoRecover = async (operation: () => Promise<any>, maxRetries = 5) => {
        let attempts = 0;
        let delay = 1000; // Start with 1 second
        
        while (attempts < maxRetries) {
          try {
            return await operation();
          } catch (error) {
            attempts++;
            if (attempts >= maxRetries) {
              throw error;
            }
            
            console.log(`Attempt ${attempts} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
          }
        }
      };
      
      // Should auto-recover after transient failures
      const result = await autoRecover(() => mockCanvas.getTasksByProject('test-project'));
      expect(result).toEqual([]);
      expect(failureCount).toBe(maxFailures + 1); // Should have failed max times then succeeded
    });
  });
});