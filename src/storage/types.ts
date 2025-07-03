// Storage abstraction types for CortexWeaver
// Provides pluggable storage backends (MCP Neo4j, in-memory, etc.)

export interface QueryResult<T = any> {
  data: T;
  metadata?: {
    executionTime?: number;
    recordCount?: number;
    sessionId?: string;
  };
}

export interface TransactionContext {
  run<T = any>(query: string, params?: Record<string, any>): Promise<T>;
  commit?(): Promise<void>;
  rollback?(): Promise<void>;
}

export type TransactionFunction<T> = (tx: TransactionContext) => Promise<T>;

export interface StorageProvider {
  readonly type: string;
  readonly isConnected: boolean;
  
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;
  
  // Query execution
  executeQuery<T>(query: string, params?: Record<string, any>): Promise<QueryResult<T>>;
  executeReadQuery<T>(query: string, params?: Record<string, any>): Promise<QueryResult<T>>;
  executeWriteQuery<T>(query: string, params?: Record<string, any>): Promise<QueryResult<T>>;
  
  // Transaction management
  executeInTransaction<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>>;
  executeInReadTransaction<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>>;
  executeInWriteTransaction<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>>;
  
  // Batch operations
  executeBatch<T>(operations: BatchOperation[]): Promise<QueryResult<T[]>>;
  
  // Schema management
  initializeSchema?(): Promise<void>;
  
  // Data migration
  exportData?(): Promise<any>;
  importData?(data: any): Promise<void>;
  
  // Metrics and monitoring
  getMetrics?(): StorageMetrics;
}

export interface BatchOperation {
  query: string;
  params?: Record<string, any>;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface StorageMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageExecutionTime: number;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastError?: string;
}

export interface StorageConfig {
  type: 'mcp-neo4j' | 'in-memory' | 'mock';
  config?: MCPNeo4jConfig | InMemoryConfig | MockConfig;
}

export interface MCPNeo4jConfig {
  uri: string;
  username: string;
  password: string;
  mcpServerUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
  connectionTimeout?: number;
}

export interface InMemoryConfig {
  maxNodes?: number;
  maxRelationships?: number;
  enablePersistence?: boolean;
  persistencePath?: string;
}

export interface MockConfig {
  simulateLatency?: boolean;
  latencyMs?: number;
  failureRate?: number;
}

export interface StorageConnectionEvent {
  type: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';
  provider: string;
  timestamp: Date;
  error?: Error;
  metadata?: Record<string, any>;
}

export type StorageEventListener = (event: StorageConnectionEvent) => void;

export interface StorageManager {
  readonly currentProvider: StorageProvider | null;
  readonly isConnected: boolean;
  
  // Provider management
  setProvider(provider: StorageProvider): Promise<void>;
  getProvider(): StorageProvider | null;
  switchProvider(config: StorageConfig): Promise<void>;
  
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  
  // Event handling
  on(event: string, listener: StorageEventListener): void;
  off(event: string, listener: StorageEventListener): void;
  
  // Data migration
  migrateData(fromProvider: StorageProvider, toProvider: StorageProvider): Promise<void>;
  
  // Proxy methods (delegate to current provider)
  executeQuery<T>(query: string, params?: Record<string, any>): Promise<QueryResult<T>>;
  executeInTransaction<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>>;
  executeInReadTransaction<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>>;
  executeInWriteTransaction<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>>;
}

// Node and relationship types for in-memory storage
export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface GraphRelationship {
  id: string;
  type: string;
  startNode: string;
  endNode: string;
  properties: Record<string, any>;
}

export interface GraphData {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  metadata?: {
    version: string;
    timestamp: string;
    nodeCount: number;
    relationshipCount: number;
  };
}

// Error types
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly originalError?: Error,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export class ConnectionError extends StorageError {
  constructor(message: string, provider: string, originalError?: Error) {
    super(message, provider, originalError, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
  }
}

export class QueryError extends StorageError {
  constructor(message: string, provider: string, originalError?: Error) {
    super(message, provider, originalError, 'QUERY_ERROR');
    this.name = 'QueryError';
  }
}

export class MigrationError extends StorageError {
  constructor(message: string, provider: string, originalError?: Error) {
    super(message, provider, originalError, 'MIGRATION_ERROR');
    this.name = 'MigrationError';
  }
}