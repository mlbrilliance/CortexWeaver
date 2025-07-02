import { Driver, Transaction, Session, ManagedTransaction } from 'neo4j-driver';
import { 
  ITransactionManager, 
  TransactionOptions, 
  TransactionFunction, 
  ReadTransactionFunction, 
  WriteTransactionFunction,
  BatchOperation, 
  Neo4jOperationResult, 
  TransactionMetrics,
  DEFAULT_TRANSACTION_OPTIONS 
} from './types.js';
import { SessionPool } from './session-pool.js';
import { Neo4jErrorHandler } from './error-handler.js';
import { CircuitBreaker } from './circuit-breaker.js';

export class TransactionManager implements ITransactionManager {
  private driver: Driver;
  private sessionPool: SessionPool;
  private errorHandler: Neo4jErrorHandler;
  private circuitBreaker: CircuitBreaker;
  private metrics: TransactionMetrics;

  constructor(driver: Driver) {
    this.driver = driver;
    this.sessionPool = new SessionPool(driver);
    this.errorHandler = new Neo4jErrorHandler();
    this.circuitBreaker = new CircuitBreaker();
    
    this.metrics = {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      averageExecutionTime: 0,
      retryCount: 0,
      deadlockCount: 0
    };
  }

  async executeInTransaction<T>(
    operation: TransactionFunction<T>,
    options: TransactionOptions = {}
  ): Promise<Neo4jOperationResult<T>> {
    const mergedOptions = { ...DEFAULT_TRANSACTION_OPTIONS, ...options };
    
    return this.circuitBreaker.execute(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        return this.executeTransactionInternal(
          operation, 
          mergedOptions, 
          'READ_WRITE'
        );
      }, mergedOptions.retryStrategy!);
    });
  }

  async executeInReadTransaction<T>(
    operation: ReadTransactionFunction<T>,
    options: TransactionOptions = {}
  ): Promise<Neo4jOperationResult<T>> {
    const mergedOptions = { ...DEFAULT_TRANSACTION_OPTIONS, ...options, readonly: true };
    
    return this.circuitBreaker.execute(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        return this.executeTransactionInternal(
          operation, 
          mergedOptions, 
          'READ'
        );
      }, mergedOptions.retryStrategy!);
    });
  }

  async executeInWriteTransaction<T>(
    operation: WriteTransactionFunction<T>,
    options: TransactionOptions = {}
  ): Promise<Neo4jOperationResult<T>> {
    const mergedOptions = { ...DEFAULT_TRANSACTION_OPTIONS, ...options, readonly: false };
    
    return this.circuitBreaker.execute(async () => {
      return this.errorHandler.executeWithRetry(async () => {
        return this.executeTransactionInternal(
          operation, 
          mergedOptions, 
          'WRITE'
        );
      }, mergedOptions.retryStrategy!);
    });
  }

  async executeBatch<T>(
    operations: BatchOperation[],
    options: TransactionOptions = {}
  ): Promise<Neo4jOperationResult<T[]>> {
    const mergedOptions = { ...DEFAULT_TRANSACTION_OPTIONS, ...options };

    return this.executeInWriteTransaction(async (tx: ManagedTransaction) => {
      const results: T[] = [];
      
      // Sort operations by priority
      const sortedOperations = this.sortOperationsByPriority(operations);
      
      for (const operation of sortedOperations) {
        const result = await tx.run(operation.query, operation.params);
        results.push(result.records as T);
      }
      
      return results;
    }, mergedOptions);
  }

  private async executeTransactionInternal<T>(
    operation: TransactionFunction<T>,
    options: TransactionOptions,
    mode: 'READ' | 'WRITE' | 'READ_WRITE'
  ): Promise<Neo4jOperationResult<T>> {
    const startTime = Date.now();
    const session = await this.sessionPool.acquire();
    const sessionId = this.generateOperationId();

    try {
      this.metrics.totalTransactions++;
      
      let result: T;
      
      if (mode === 'READ') {
        result = await session.executeRead(operation, { timeout: options.timeout });
      } else if (mode === 'WRITE') {
        result = await session.executeWrite(operation, { timeout: options.timeout });
      } else {
        // READ_WRITE mode - use writeTransaction for safety
        result = await session.executeWrite(operation, { timeout: options.timeout });
      }

      const executionTime = Date.now() - startTime;
      this.updateSuccessMetrics(executionTime);

      return {
        data: result,
        metrics: {
          executionTime,
          recordCount: this.extractRecordCount(result),
          sessionId
        }
      };

    } catch (error) {
      this.updateFailureMetrics(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      await this.sessionPool.release(session);
    }
  }

  private sortOperationsByPriority(operations: BatchOperation[]): BatchOperation[] {
    const priorityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
    
    return operations.sort((a, b) => {
      const aPriority = priorityOrder[a.priority || 'MEDIUM'];
      const bPriority = priorityOrder[b.priority || 'MEDIUM'];
      return aPriority - bPriority;
    });
  }

  private extractRecordCount(result: any): number {
    if (result && typeof result === 'object') {
      if (Array.isArray(result)) {
        return result.length;
      }
      if (result.records && Array.isArray(result.records)) {
        return result.records.length;
      }
    }
    return 1;
  }

  private updateSuccessMetrics(executionTime: number): void {
    this.metrics.successfulTransactions++;
    
    // Update average execution time using exponential moving average
    const alpha = 0.1;
    this.metrics.averageExecutionTime = 
      (1 - alpha) * this.metrics.averageExecutionTime + alpha * executionTime;
  }

  private updateFailureMetrics(error: Error): void {
    this.metrics.failedTransactions++;
    
    if (this.errorHandler.isRetryableError(error)) {
      this.metrics.retryCount++;
    }
    
    if (error.message.toLowerCase().includes('deadlock')) {
      this.metrics.deadlockCount++;
    }
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getMetrics(): TransactionMetrics {
    return { ...this.metrics };
  }

  getDetailedMetrics() {
    return {
      transaction: this.getMetrics(),
      session: this.sessionPool.getMetrics(),
      circuitBreaker: this.circuitBreaker.getMetrics()
    };
  }

  async close(): Promise<void> {
    await this.sessionPool.close();
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.executeInReadTransaction(async (tx: ManagedTransaction) => {
        const result = await tx.run('RETURN 1 as health');
        return result.records[0]?.get('health') === 1;
      });
      
      return result.data;
    } catch {
      return false;
    }
  }

  // Manual controls for testing and administration
  getCircuitBreakerState() {
    return this.circuitBreaker.getState();
  }

  forceCircuitBreakerOpen(): void {
    this.circuitBreaker.forceOpen();
  }

  forceCircuitBreakerClosed(): void {
    this.circuitBreaker.forceClose();
  }

  resetMetrics(): void {
    this.metrics = {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      averageExecutionTime: 0,
      retryCount: 0,
      deadlockCount: 0
    };
  }
}