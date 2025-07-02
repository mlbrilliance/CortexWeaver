/**
 * Enhanced Error Recovery System Tests
 * 
 * Tests comprehensive error handling, CodeSavant integration, and recovery mechanisms
 */

import { ErrorRecoverySystem } from '../src/error-recovery';
import { CodeSavant } from '../src/code-savant';
import { CognitiveCanvas } from '../src/cognitive-canvas';
import {
  CortexError,
  ErrorSeverity,
  ErrorCategory,
  ErrorPhase,
  RecoveryStrategy
} from '../src/types/error-types';

describe('Enhanced Error Recovery System', () => {
  let errorRecovery: ErrorRecoverySystem;
  let mockCanvas: jest.Mocked<CognitiveCanvas>;
  let mockCodeSavant: jest.Mocked<CodeSavant>;

  beforeEach(() => {
    // Mock CognitiveCanvas
    mockCanvas = {
      createPheromone: jest.fn().mockResolvedValue(undefined),
      getPheromonesByType: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock CodeSavant
    mockCodeSavant = {
      analyzeProblem: jest.fn().mockResolvedValue('Analysis complete'),
      generateSuggestions: jest.fn().mockResolvedValue(['Suggestion 1', 'Suggestion 2']),
      identifyRootCause: jest.fn().mockResolvedValue('Root cause identified')
    } as any;

    errorRecovery = new ErrorRecoverySystem(mockCanvas, mockCodeSavant);
  });

  describe('Error Classification and Recovery Strategy', () => {
    it('should classify network errors for retry strategy', () => {
      const networkError = new CortexError('Connection timeout', {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.NETWORK,
        context: {
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      expect(networkError.getRecoveryStrategy()).toBe(RecoveryStrategy.RETRY);
      expect(networkError.retryable).toBe(true);
      expect(networkError.maxRetries).toBe(5); // Network errors get more retries
    });

    it('should classify impasse errors for CodeSavant strategy', () => {
      const impasseError = new CortexError('Agent reached impasse', {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.IMPASSE,
        context: {
          taskId: 'task-123',
          agentId: 'agent-456',
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      expect(impasseError.getRecoveryStrategy()).toBe(RecoveryStrategy.CODESAVANT);
      expect(impasseError.retryable).toBe(true);
      expect(impasseError.maxRetries).toBe(1); // Impasse gets only one CodeSavant attempt
    });

    it('should classify resource exhaustion for fallback strategy', () => {
      const resourceError = new CortexError('Out of memory', {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.RESOURCE_EXHAUSTION,
        context: {
          phase: ErrorPhase.AGENT_SPAWN,
          timestamp: new Date().toISOString()
        }
      });

      expect(resourceError.getRecoveryStrategy()).toBe(RecoveryStrategy.FALLBACK);
    });

    it('should classify data corruption for escalation', () => {
      const corruptionError = new CortexError('Database corruption detected', {
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DATA_CORRUPTION,
        context: {
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      expect(corruptionError.getRecoveryStrategy()).toBe(RecoveryStrategy.ESCALATE);
      expect(corruptionError.shouldEscalateToHuman()).toBe(true);
    });
  });

  describe('Retry Strategy with Intelligent Backoff', () => {
    it('should execute retry strategy with exponential backoff', async () => {
      const error = new CortexError('Temporary service unavailable', {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.NETWORK,
        context: {
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        },
        backoffStrategy: 'exponential'
      });

      let operationCount = 0;
      const operation = jest.fn().mockImplementation(async () => {
        operationCount++;
        if (operationCount <= 2) {
          throw new Error('Still failing');
        }
        return 'Success';
      });

      const result = await errorRecovery.recoverFromError(error, operation);

      expect(result.success).toBe(true);
      expect(result.attempts).toHaveLength(3);
      expect(result.attempts[0].success).toBe(false);
      expect(result.attempts[1].success).toBe(false);
      expect(result.attempts[2].success).toBe(true);
      expect(result.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
    });

    it('should respect max retry limits', async () => {
      const error = new CortexError('Persistent failure', {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.NETWORK,
        context: {
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        },
        maxRetries: 2
      });

      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      const result = await errorRecovery.recoverFromError(error, operation);

      expect(result.success).toBe(false);
      expect(result.attempts).toHaveLength(2);
      expect(result.attempts.every(attempt => !attempt.success)).toBe(true);
      expect(result.finalError).toBeDefined();
    });

    it('should apply jitter to prevent thundering herd', async () => {
      const error = new CortexError('Rate limited', {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.NETWORK,
        context: {
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Rate limited'))
        .mockResolvedValueOnce('Success');

      const startTime = Date.now();
      const result = await errorRecovery.recoverFromError(error, operation);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeGreaterThan(1000); // Should have some delay due to backoff
      expect(result.attempts).toHaveLength(2);
    });
  });

  describe('CodeSavant Integration Strategy', () => {
    it('should execute CodeSavant strategy for impasse errors', async () => {
      const impasseError = new CortexError('Cannot proceed with implementation', {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.IMPASSE,
        context: {
          taskId: 'task-123',
          agentId: 'coder-agent',
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        },
        metadata: {
          taskDescription: 'Implement user authentication',
          failedCode: 'function authenticate(user) { /* incomplete */ }'
        }
      });

      const operation = jest.fn().mockResolvedValue('Success with CodeSavant guidance');

      const result = await errorRecovery.recoverFromError(impasseError, operation);

      expect(result.success).toBe(true);
      expect(result.recoveryStrategy).toBe(RecoveryStrategy.CODESAVANT);
      expect(result.suggestions).toEqual(['Suggestion 1', 'Suggestion 2']);
      
      // Verify CodeSavant was called with correct parameters
      expect(mockCodeSavant.analyzeProblem).toHaveBeenCalledWith(
        'Implement user authentication',
        'function authenticate(user) { /* incomplete */ }',
        'Cannot proceed with implementation'
      );
      expect(mockCodeSavant.generateSuggestions).toHaveBeenCalled();
      expect(mockCodeSavant.identifyRootCause).toHaveBeenCalled();
    });

    it('should escalate to human when CodeSavant fails', async () => {
      const impasseError = new CortexError('Complex architectural decision needed', {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.IMPASSE,
        context: {
          taskId: 'task-456',
          agentId: 'architect-agent',
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      // Make CodeSavant fail
      mockCodeSavant.analyzeProblem.mockRejectedValue(new Error('CodeSavant analysis failed'));
      
      const operation = jest.fn().mockResolvedValue('Should not reach here');

      const result = await errorRecovery.recoverFromError(impasseError, operation);

      expect(result.success).toBe(false);
      expect(result.escalationRequired).toBe(true);
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0].success).toBe(false);
      expect(impasseError.metadata.codeSavantFailed).toBe(true);
    });

    it('should store CodeSavant analysis as pheromones', async () => {
      const impasseError = new CortexError('Database schema design issue', {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.IMPASSE,
        context: {
          taskId: 'task-789',
          agentId: 'architect-agent',
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      const operation = jest.fn().mockResolvedValue('Success');

      await errorRecovery.recoverFromError(impasseError, operation);

      // Verify CodeSavant pheromone was stored
      expect(mockCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'codesavant_analysis',
          context: 'impasse_resolution',
          metadata: expect.objectContaining({
            errorId: impasseError.id,
            rootCause: 'Root cause identified',
            suggestions: ['Suggestion 1', 'Suggestion 2']
          })
        })
      );
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should open circuit breaker after repeated failures', async () => {
      const error = new CortexError('Service consistently failing', {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.INFRASTRUCTURE,
        context: {
          agentType: 'test-agent',
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      const operation = jest.fn().mockRejectedValue(new Error('Service down'));

      // Trigger multiple failures to open circuit breaker
      for (let i = 0; i < 6; i++) {
        const result = await errorRecovery.recoverFromError(error, operation);
        expect(result.success).toBe(false);
        
        // After 5 failures, circuit should be open
        if (i >= 4) {
          expect(result.escalationRequired).toBe(true);
        }
      }

      const stats = errorRecovery.getRecoveryStatistics();
      expect(stats.circuitBreakerStates.size).toBeGreaterThan(0);
    });

    it('should close circuit breaker after timeout', async () => {
      const error = new CortexError('Service temporarily down', {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.NETWORK,
        context: {
          agentType: 'test-agent',
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      // Mock time progression for circuit breaker timeout
      jest.useFakeTimers();

      const operation = jest.fn()
        .mockRejectedValue(new Error('Service down'))
        .mockRejectedValue(new Error('Service down'))
        .mockRejectedValue(new Error('Service down'))
        .mockRejectedValue(new Error('Service down'))
        .mockRejectedValue(new Error('Service down'))
        .mockResolvedValue('Service recovered');

      // Open circuit breaker
      for (let i = 0; i < 5; i++) {
        await errorRecovery.recoverFromError(error, operation);
      }

      // Advance time to close circuit breaker
      jest.advanceTimersByTime(61000); // 61 seconds

      // Circuit should be closed and operation should succeed
      const result = await errorRecovery.recoverFromError(error, operation);
      expect(result.success).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('Error Learning and Pattern Recognition', () => {
    it('should learn from successful recovery patterns', async () => {
      const networkError = new CortexError('Connection timeout', {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.NETWORK,
        context: {
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce('Success');

      // First recovery creates learning data
      const result1 = await errorRecovery.recoverFromError(networkError, operation);
      expect(result1.success).toBe(true);

      // Second similar error should apply learned strategy
      const similarError = new CortexError('Another connection timeout', {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.NETWORK,
        context: {
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      const operation2 = jest.fn().mockResolvedValue('Success with learned strategy');
      const result2 = await errorRecovery.recoverFromError(similarError, operation2);

      expect(result2.success).toBe(true);
      
      const stats = errorRecovery.getRecoveryStatistics();
      expect(stats.learningDatabase.size).toBeGreaterThan(0);
      expect(stats.successRate).toBe(1.0);
    });

    it('should store recovery pheromones for learning', async () => {
      const error = new CortexError('Test error for learning', {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.AGENT_EXECUTION,
        context: {
          taskId: 'learning-task',
          agentId: 'learning-agent',
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      const operation = jest.fn().mockResolvedValue('Success');

      await errorRecovery.recoverFromError(error, operation);

      // Verify recovery pheromone was stored
      expect(mockCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error_recovery',
          context: 'error_recovery',
          metadata: expect.objectContaining({
            errorId: error.id,
            errorCategory: ErrorCategory.AGENT_EXECUTION,
            success: true,
            escalationRequired: false
          })
        })
      );
    });
  });

  describe('Fallback Strategy', () => {
    it('should execute fallback strategy for resource exhaustion', async () => {
      const resourceError = new CortexError('Memory exhausted', {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.RESOURCE_EXHAUSTION,
        context: {
          phase: ErrorPhase.AGENT_SPAWN,
          timestamp: new Date().toISOString()
        }
      });

      const operation = jest.fn().mockResolvedValue('Success with reduced resources');

      const result = await errorRecovery.recoverFromError(resourceError, operation);

      expect(result.success).toBe(true);
      expect(result.recoveryStrategy).toBe(RecoveryStrategy.FALLBACK);
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0].strategy).toBe(RecoveryStrategy.FALLBACK);
    });

    it('should wait for resource availability in fallback mode', async () => {
      const resourceError = new CortexError('CPU overload', {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.RESOURCE_EXHAUSTION,
        context: {
          phase: ErrorPhase.AGENT_SPAWN,
          timestamp: new Date().toISOString()
        }
      });

      const operation = jest.fn().mockResolvedValue('Success after waiting');

      const startTime = Date.now();
      const result = await errorRecovery.recoverFromError(resourceError, operation);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeGreaterThan(5000); // Should wait for resources
    });
  });

  describe('Human Escalation', () => {
    it('should escalate critical errors to human intervention', async () => {
      const criticalError = new CortexError('System integrity compromised', {
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.DATA_CORRUPTION,
        context: {
          projectId: 'critical-project',
          taskId: 'critical-task',
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      const operation = jest.fn().mockResolvedValue('Should not execute');

      const result = await errorRecovery.recoverFromError(criticalError, operation);

      expect(result.success).toBe(false);
      expect(result.escalationRequired).toBe(true);
      expect(result.recoveryStrategy).toBe(RecoveryStrategy.ESCALATE);

      // Verify escalation pheromone was stored
      expect(mockCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'human_escalation',
          context: 'human_intervention_required',
          metadata: expect.objectContaining({
            errorId: criticalError.id,
            severity: ErrorSeverity.CRITICAL,
            urgency: 'critical'
          })
        })
      );
    });

    it('should determine appropriate escalation urgency', async () => {
      const highSeverityError = new CortexError('High severity issue', {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.INFRASTRUCTURE,
        context: {
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      const operation = jest.fn().mockRejectedValue(new Error('Non-recoverable'));

      const result = await errorRecovery.recoverFromError(highSeverityError, operation);

      // Should escalate with appropriate urgency
      expect(result.escalationRequired).toBe(false); // High severity infrastructure errors should retry first
      
      // Test critical error that should escalate immediately
      const criticalError = new CortexError('Critical system failure', {
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.INFRASTRUCTURE,
        context: {
          phase: ErrorPhase.INITIALIZATION,
          timestamp: new Date().toISOString()
        }
      });

      const criticalResult = await errorRecovery.recoverFromError(criticalError, operation);
      expect(criticalResult.escalationRequired).toBe(true);
    });
  });

  describe('Recovery Statistics and Monitoring', () => {
    it('should provide comprehensive recovery statistics', async () => {
      // Execute several recovery operations
      const errors = [
        new CortexError('Network error 1', {
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.NETWORK,
          context: { phase: ErrorPhase.TASK_EXECUTION, timestamp: new Date().toISOString() }
        }),
        new CortexError('Agent execution error', {
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.AGENT_EXECUTION,
          context: { phase: ErrorPhase.TASK_EXECUTION, timestamp: new Date().toISOString() }
        })
      ];

      const successOperation = jest.fn().mockResolvedValue('Success');
      const failOperation = jest.fn().mockRejectedValue(new Error('Permanent failure'));

      await errorRecovery.recoverFromError(errors[0], successOperation);
      await errorRecovery.recoverFromError(errors[1], failOperation);

      const stats = errorRecovery.getRecoveryStatistics();

      expect(stats.totalRecoveries).toBeGreaterThan(0);
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeLessThanOrEqual(1);
      expect(stats.averageAttempts).toBeGreaterThan(0);
      expect(stats.circuitBreakerStates).toBeDefined();
      expect(stats.learningDatabase).toBeDefined();
    });

    it('should track error patterns for analysis', async () => {
      const repeatError = new CortexError('Recurring network issue', {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.NETWORK,
        context: {
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      const operation = jest.fn().mockResolvedValue('Success');

      // Execute same pattern multiple times
      await errorRecovery.recoverFromError(repeatError, operation);
      await errorRecovery.recoverFromError(repeatError, operation);

      const stats = errorRecovery.getRecoveryStatistics();
      expect(stats.learningDatabase.size).toBeGreaterThan(0);
      
      // Check that we have learning data for this pattern
      const patterns = Array.from(stats.learningDatabase.values());
      const networkPattern = patterns.find(p => p.errorPattern.includes('network'));
      expect(networkPattern).toBeDefined();
      expect(networkPattern?.usage_count).toBeGreaterThan(1);
    });
  });
});