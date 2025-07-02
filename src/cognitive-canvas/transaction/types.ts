import { Transaction, Session, Driver, ManagedTransaction } from 'neo4j-driver';

export interface TransactionOptions {
  timeout?: number;
  retryStrategy?: RetryStrategy;
  isolationLevel?: 'READ_COMMITTED' | 'READ_UNCOMMITTED';
  maxRetries?: number;
  readonly?: boolean;
}

export interface RetryStrategy {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
  jitter: boolean;
}

export interface BatchOperation {
  query: string;
  params: any;
  operation: 'READ' | 'WRITE';
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SessionPoolConfig {
  maxPoolSize: number;
  minPoolSize: number;
  acquireTimeout: number;
  idleTimeout: number;
  maxLifetime: number;
}

export interface ErrorContext {
  operation: string;
  retryCount: number;
  sessionId: string;
  timestamp: Date;
  params?: any;
}

export interface ErrorRecoveryAction {
  action: 'RETRY' | 'RECONNECT_AND_RETRY' | 'FAIL_FAST' | 'FAIL';
  delay?: number;
  reason?: string;
}

export interface TransactionMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  averageExecutionTime: number;
  retryCount: number;
  deadlockCount: number;
}

export interface SessionMetrics {
  activeSessions: number;
  pooledSessions: number;
  totalSessionsCreated: number;
  sessionAcquisitionTime: number;
}

export interface Neo4jOperationResult<T = any> {
  data: T;
  metrics: {
    executionTime: number;
    recordCount: number;
    sessionId: string;
  };
}

export type TransactionFunction<T> = (tx: ManagedTransaction) => Promise<T>;
export type ReadTransactionFunction<T> = (tx: ManagedTransaction) => Promise<T>;
export type WriteTransactionFunction<T> = (tx: ManagedTransaction) => Promise<T>;

export interface ITransactionManager {
  executeInTransaction<T>(
    operation: TransactionFunction<T>,
    options?: TransactionOptions
  ): Promise<Neo4jOperationResult<T>>;

  executeInReadTransaction<T>(
    operation: ReadTransactionFunction<T>,
    options?: TransactionOptions
  ): Promise<Neo4jOperationResult<T>>;

  executeInWriteTransaction<T>(
    operation: WriteTransactionFunction<T>,
    options?: TransactionOptions
  ): Promise<Neo4jOperationResult<T>>;

  executeBatch<T>(
    operations: BatchOperation[],
    options?: TransactionOptions
  ): Promise<Neo4jOperationResult<T[]>>;

  getMetrics(): TransactionMetrics;
  close(): Promise<void>;
}

export interface ISessionPool {
  acquire(): Promise<Session>;
  release(session: Session): Promise<void>;
  getMetrics(): SessionMetrics;
  close(): Promise<void>;
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  minimumThroughput: number;
}

export const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxRetries: 3,
  baseDelay: 100,
  maxDelay: 5000,
  exponentialBackoff: true,
  jitter: true
};

export const DEFAULT_SESSION_POOL_CONFIG: SessionPoolConfig = {
  maxPoolSize: 50,
  minPoolSize: 5,
  acquireTimeout: 10000,
  idleTimeout: 300000, // 5 minutes
  maxLifetime: 3600000 // 1 hour
};

export const DEFAULT_TRANSACTION_OPTIONS: TransactionOptions = {
  timeout: 30000,
  retryStrategy: DEFAULT_RETRY_STRATEGY,
  maxRetries: 3,
  readonly: false
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 60000,
  monitoringPeriod: 10000,
  minimumThroughput: 10
};