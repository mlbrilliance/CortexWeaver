import { Neo4jError } from 'neo4j-driver';
import { ErrorContext, ErrorRecoveryAction, RetryStrategy, DEFAULT_RETRY_STRATEGY } from './types.js';

export class Neo4jErrorHandler {
  private retryStrategies: Map<string, RetryStrategy> = new Map();

  constructor() {
    this.initializeDefaultStrategies();
  }

  async handleTransactionError(
    error: Error, 
    context: ErrorContext
  ): Promise<ErrorRecoveryAction> {
    if (this.isDeadlockError(error)) {
      return { 
        action: 'RETRY', 
        delay: this.calculateBackoffDelay(context.retryCount),
        reason: 'Deadlock detected - retrying with backoff' 
      };
    }
    
    if (this.isTransientConnectionError(error)) {
      return { 
        action: 'RECONNECT_AND_RETRY', 
        delay: 1000 + (context.retryCount * 500),
        reason: 'Transient connection error - reconnecting' 
      };
    }
    
    if (this.isConstraintViolationError(error)) {
      return { 
        action: 'FAIL_FAST', 
        reason: 'Data integrity violation - cannot retry' 
      };
    }

    if (this.isSessionExpiredError(error)) {
      return { 
        action: 'RETRY', 
        delay: 100,
        reason: 'Session expired - retrying with new session' 
      };
    }

    if (this.isTransactionConflictError(error)) {
      return { 
        action: 'RETRY', 
        delay: this.calculateBackoffDelay(context.retryCount, 50, 2000),
        reason: 'Transaction conflict - retrying with exponential backoff' 
      };
    }

    if (this.isTemporaryError(error)) {
      return { 
        action: 'RETRY', 
        delay: this.calculateBackoffDelay(context.retryCount),
        reason: 'Temporary error - retrying' 
      };
    }
    
    return { 
      action: 'FAIL', 
      reason: `Unrecoverable error: ${error.message}` 
    };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    strategy: RetryStrategy = DEFAULT_RETRY_STRATEGY,
    context?: Partial<ErrorContext>
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= strategy.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        const errorContext: ErrorContext = {
          operation: context?.operation || 'unknown',
          retryCount: attempt,
          sessionId: context?.sessionId || 'unknown',
          timestamp: new Date(),
          params: context?.params
        };

        const recoveryAction = await this.handleTransactionError(lastError, errorContext);
        
        if (recoveryAction.action === 'FAIL_FAST' || 
            recoveryAction.action === 'FAIL' || 
            attempt === strategy.maxRetries) {
          throw lastError;
        }
        
        if (recoveryAction.delay) {
          await this.sleep(recoveryAction.delay);
        }
      }
    }
    
    throw lastError!;
  }

  isRetryableError(error: Error): boolean {
    return this.isDeadlockError(error) ||
           this.isTransientConnectionError(error) ||
           this.isSessionExpiredError(error) ||
           this.isTransactionConflictError(error) ||
           this.isTemporaryError(error);
  }

  private isDeadlockError(error: Error): boolean {
    if (error instanceof Neo4jError) {
      return error.code === 'Neo.TransientError.Transaction.DeadlockDetected';
    }
    return error.message.toLowerCase().includes('deadlock');
  }

  private isTransientConnectionError(error: Error): boolean {
    if (error instanceof Neo4jError) {
      return error.code?.startsWith('Neo.TransientError.Network') ||
             error.code === 'Neo.TransientError.General.DatabaseUnavailable';
    }
    
    const message = error.message.toLowerCase();
    return message.includes('connection refused') ||
           message.includes('connection reset') ||
           message.includes('connection timeout') ||
           message.includes('network error') ||
           message.includes('socket');
  }

  private isConstraintViolationError(error: Error): boolean {
    if (error instanceof Neo4jError) {
      return error.code?.startsWith('Neo.ClientError.Schema.ConstraintValidationFailed') ||
             error.code?.startsWith('Neo.ClientError.Schema.ConstraintViolation');
    }
    
    const message = error.message.toLowerCase();
    return message.includes('constraint') ||
           message.includes('unique') ||
           message.includes('already exists');
  }

  private isSessionExpiredError(error: Error): boolean {
    if (error instanceof Neo4jError) {
      return error.code === 'Neo.ClientError.Transaction.InvalidBookmark' ||
             error.code === 'Neo.ClientError.Request.Invalid';
    }
    
    const message = error.message.toLowerCase();
    return message.includes('session') && message.includes('expired') ||
           message.includes('session closed') ||
           message.includes('invalid session');
  }

  private isTransactionConflictError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('open transaction') ||
           message.includes('transaction conflict') ||
           message.includes('concurrent modification');
  }

  private isTemporaryError(error: Error): boolean {
    if (error instanceof Neo4jError) {
      return error.code?.startsWith('Neo.TransientError');
    }
    
    const message = error.message.toLowerCase();
    return message.includes('temporary') ||
           message.includes('timeout') ||
           message.includes('busy') ||
           message.includes('overload');
  }

  private calculateBackoffDelay(
    retryCount: number, 
    baseDelay: number = 100, 
    maxDelay: number = 5000
  ): number {
    const exponentialDelay = baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializeDefaultStrategies(): void {
    // Default strategy for most operations
    this.retryStrategies.set('default', DEFAULT_RETRY_STRATEGY);
    
    // More aggressive strategy for critical operations
    this.retryStrategies.set('critical', {
      maxRetries: 5,
      baseDelay: 50,
      maxDelay: 10000,
      exponentialBackoff: true,
      jitter: true
    });
    
    // Conservative strategy for non-critical operations
    this.retryStrategies.set('conservative', {
      maxRetries: 2,
      baseDelay: 200,
      maxDelay: 2000,
      exponentialBackoff: false,
      jitter: false
    });
  }

  setRetryStrategy(name: string, strategy: RetryStrategy): void {
    this.retryStrategies.set(name, strategy);
  }

  getRetryStrategy(name: string): RetryStrategy | undefined {
    return this.retryStrategies.get(name);
  }
}