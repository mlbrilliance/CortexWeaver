// Transaction Management Infrastructure
// This module provides comprehensive Neo4j transaction management with connection pooling,
// error handling, retry logic, and circuit breaker patterns.

export { TransactionManager } from './transaction-manager.js';
export { SessionPool } from './session-pool.js';
export { CircuitBreaker } from './circuit-breaker.js';
export { Neo4jErrorHandler } from './error-handler.js';
export { withTestDatabase, TestDatabaseManager } from './test-utils.js';

export type {
  TransactionOptions,
  RetryStrategy,
  BatchOperation,
  SessionPoolConfig,
  ErrorContext,
  ErrorRecoveryAction,
  TransactionMetrics,
  SessionMetrics,
  Neo4jOperationResult,
  TransactionFunction,
  ReadTransactionFunction,
  WriteTransactionFunction,
  ITransactionManager,
  ISessionPool,
  CircuitBreakerState,
  CircuitBreakerConfig
} from './types.js';

export {
  DEFAULT_RETRY_STRATEGY,
  DEFAULT_SESSION_POOL_CONFIG,
  DEFAULT_TRANSACTION_OPTIONS,
  DEFAULT_CIRCUIT_BREAKER_CONFIG
} from './types.js';