/**
 * Error Recovery Core Module
 * 
 * Contains the main error recovery orchestration logic, circuit breakers, and learning mechanisms
 */

import {
  CortexError,
  ErrorSeverity,
  ErrorCategory,
  RecoveryStrategy,
  ErrorRecoveryResult,
  RetryConfiguration,
  ErrorLearningData,
  CircuitBreakerState
} from '../types/error-types';
import { CodeSavant } from '../code-savant';
import { CognitiveCanvas, PheromoneData } from '../cognitive-canvas';
import { ErrorRecoveryStrategies } from './strategies';

export class ErrorRecoveryCore {
  private strategies: ErrorRecoveryStrategies;
  private cognitiveCanvas: CognitiveCanvas;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private learningDatabase: Map<string, ErrorLearningData> = new Map();
  private activeRecoveries: Map<string, ErrorRecoveryResult> = new Map();

  private readonly defaultRetryConfig: RetryConfiguration = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterMs: 500,
    shouldRetry: (error: CortexError, attemptNumber: number) => {
      return error.retryable && attemptNumber <= error.maxRetries;
    }
  };

  constructor(
    cognitiveCanvas: CognitiveCanvas,
    codeSavant?: CodeSavant
  ) {
    this.cognitiveCanvas = cognitiveCanvas;
    this.strategies = new ErrorRecoveryStrategies(cognitiveCanvas, codeSavant);
  }

  /**
   * Main error recovery orchestration method
   */
  async recoverFromError(
    error: CortexError,
    operation: () => Promise<any>,
    config?: Partial<RetryConfiguration>
  ): Promise<ErrorRecoveryResult> {
    const recoveryId = `recovery-${error.id}`;
    console.log(`Starting error recovery for ${error.id}: ${error.message}`);

    const result: ErrorRecoveryResult = {
      success: false,
      recoveryStrategy: error.getRecoveryStrategy(),
      attempts: [],
      escalationRequired: false,
      learningData: {}
    };

    this.activeRecoveries.set(recoveryId, result);

    try {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen(error)) {
        console.log(`Circuit breaker open for ${error.category}, skipping recovery`);
        result.escalationRequired = true;
        return result;
      }

      // Apply learning from previous similar errors
      const learningData = this.findSimilarErrorLearning(error);
      if (learningData) {
        result.recoveryStrategy = learningData.successfulRecoveryStrategy;
        console.log(`Applying learned recovery strategy: ${result.recoveryStrategy}`);
      }

      // Execute recovery strategy
      switch (result.recoveryStrategy) {
        case RecoveryStrategy.RETRY:
          result.success = await this.strategies.executeRetryStrategy(
            error, 
            operation, 
            result, 
            { ...this.defaultRetryConfig, ...config }
          );
          break;

        case RecoveryStrategy.CODESAVANT:
          result.success = await this.strategies.executeCodeSavantStrategy(error, operation, result);
          break;

        case RecoveryStrategy.FALLBACK:
          result.success = await this.strategies.executeFallbackStrategy(error, operation, result);
          break;

        case RecoveryStrategy.ESCALATE:
          result.escalationRequired = true;
          await this.strategies.escalateToHuman(error, result);
          break;

        case RecoveryStrategy.ABORT:
          console.log(`Aborting operation due to non-recoverable error: ${error.message}`);
          result.finalError = error;
          break;

        default:
          result.success = await this.strategies.executeRetryStrategy(
            error, 
            operation, 
            result, 
            { ...this.defaultRetryConfig, ...config }
          );
      }

      // Update learning database
      if (result.success) {
        this.updateLearningDatabase(error, result.recoveryStrategy);
        this.updateCircuitBreaker(error, true);
      } else {
        this.updateCircuitBreaker(error, false);
        // Check if circuit breaker should trigger escalation
        if (this.shouldEscalateAfterFailure(error)) {
          result.escalationRequired = true;
        }
      }

      // Store recovery pheromone
      await this.storeRecoveryPheromone(error, result);

    } catch (recoveryError) {
      console.error(`Error during recovery process: ${recoveryError}`);
      result.finalError = new CortexError(
        `Recovery process failed: ${(recoveryError as Error).message}`,
        {
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.INFRASTRUCTURE,
          context: error.context,
          cause: recoveryError as Error
        }
      );
    } finally {
      this.activeRecoveries.delete(recoveryId);
    }

    return result;
  }

  /**
   * Check if circuit breaker is open for error category
   */
  private isCircuitBreakerOpen(error: CortexError): boolean {
    const key = `${error.category}-${error.context.agentType || 'unknown'}`;
    const breaker = this.circuitBreakers.get(key);
    
    if (!breaker) return false;
    
    if (breaker.isOpen) {
      const now = Date.now();
      if (now >= breaker.nextAttemptTime) {
        // Try to close circuit breaker
        breaker.isOpen = false;
        breaker.failureCount = 0;
        return false;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Update circuit breaker state
   */
  private updateCircuitBreaker(error: CortexError, success: boolean): void {
    const key = `${error.category}-${error.context.agentType || 'unknown'}`;
    let breaker = this.circuitBreakers.get(key);
    
    if (!breaker) {
      breaker = {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        threshold: 5,
        timeout: 60000 // 1 minute
      };
      this.circuitBreakers.set(key, breaker);
    }

    if (success) {
      breaker.failureCount = 0;
      breaker.isOpen = false;
    } else {
      breaker.failureCount++;
      breaker.lastFailureTime = Date.now();
      
      if (breaker.failureCount >= breaker.threshold) {
        breaker.isOpen = true;
        breaker.nextAttemptTime = Date.now() + breaker.timeout;
        console.log(`Circuit breaker opened for ${key}`);
      }
    }
  }

  /**
   * Find similar error learning data
   */
  private findSimilarErrorLearning(error: CortexError): ErrorLearningData | null {
    const pattern = this.generateErrorPattern(error);
    return this.learningDatabase.get(pattern) || null;
  }

  /**
   * Update learning database with successful recovery
   */
  private updateLearningDatabase(error: CortexError, strategy: RecoveryStrategy): void {
    const pattern = this.generateErrorPattern(error);
    const existing = this.learningDatabase.get(pattern);
    
    if (existing) {
      existing.usage_count++;
      existing.success_rate = (existing.success_rate * (existing.usage_count - 1) + 1) / existing.usage_count;
      existing.lastUsed = new Date().toISOString();
    } else {
      this.learningDatabase.set(pattern, {
        errorPattern: pattern,
        successfulRecoveryStrategy: strategy,
        contextSimilarity: 1.0,
        applicabilityScore: 1.0,
        usage_count: 1,
        success_rate: 1.0,
        lastUsed: new Date().toISOString()
      });
    }
  }

  /**
   * Generate error pattern for learning
   */
  private generateErrorPattern(error: CortexError): string {
    return `${error.category}-${error.severity}-${error.context.phase}`;
  }

  /**
   * Store recovery pheromone for learning
   */
  private async storeRecoveryPheromone(
    error: CortexError,
    result: ErrorRecoveryResult
  ): Promise<void> {
    try {
      const pheromone: PheromoneData = {
        id: `recovery-${error.id}`,
        type: 'error_recovery',
        strength: result.success ? 0.7 : 0.3,
        context: 'error_recovery',
        metadata: {
          errorId: error.id,
          errorCategory: error.category,
          errorSeverity: error.severity,
          recoveryStrategy: result.recoveryStrategy,
          success: result.success,
          attemptCount: result.attempts.length,
          escalationRequired: result.escalationRequired,
          taskId: error.context.taskId,
          agentType: error.context.agentId
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7200000).toISOString() // 2 hours
      };

      await this.cognitiveCanvas.createPheromone(pheromone);
    } catch (pheromoneError) {
      console.warn('Failed to store recovery pheromone:', pheromoneError);
    }
  }

  /**
   * Check if failure should trigger escalation
   */
  private shouldEscalateAfterFailure(error: CortexError): boolean {
    const key = `${error.category}-${error.context.agentType || 'unknown'}`;
    const breaker = this.circuitBreakers.get(key);
    
    return breaker ? breaker.isOpen : false;
  }

  /**
   * Get recovery statistics for monitoring
   */
  getRecoveryStatistics(): {
    totalRecoveries: number;
    successRate: number;
    averageAttempts: number;
    circuitBreakerStates: Map<string, CircuitBreakerState>;
    learningDatabase: Map<string, ErrorLearningData>;
  } {
    const totalRecoveries = this.learningDatabase.size;
    const successfulRecoveries = Array.from(this.learningDatabase.values())
      .filter(data => data.success_rate > 0).length;
    
    const averageAttempts = Array.from(this.learningDatabase.values())
      .reduce((sum, data) => sum + data.usage_count, 0) / (totalRecoveries || 1);

    return {
      totalRecoveries,
      successRate: totalRecoveries > 0 ? successfulRecoveries / totalRecoveries : 0,
      averageAttempts,
      circuitBreakerStates: new Map(this.circuitBreakers),
      learningDatabase: new Map(this.learningDatabase)
    };
  }
}