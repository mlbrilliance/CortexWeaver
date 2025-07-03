import { 
  StorageProvider, 
  QueryResult, 
  TransactionFunction, 
  TransactionContext,
  BatchOperation, 
  StorageMetrics, 
  InMemoryConfig,
  GraphNode,
  GraphRelationship,
  GraphData,
  QueryError
} from '../types.js';
import * as fs from 'fs/promises';

/**
 * In-memory storage provider for offline development
 * Provides basic graph operations without requiring a database
 */
export class InMemoryProvider implements StorageProvider {
  readonly type = 'in-memory';
  private nodes = new Map<string, GraphNode>();
  private relationships = new Map<string, GraphRelationship>();
  private config: Required<InMemoryConfig>;
  private connected = false;
  private metrics: StorageMetrics;
  private nextNodeId = 1;
  private nextRelId = 1;

  constructor(config: InMemoryConfig = {}) {
    this.config = {
      maxNodes: 10000,
      maxRelationships: 50000,
      enablePersistence: false,
      persistencePath: './cortexweaver-memory.json',
      ...config
    };

    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageExecutionTime: 0,
      connectionStatus: 'disconnected'
    };
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    try {
      this.metrics.connectionStatus = 'connecting';
      
      // Load persisted data if enabled
      if (this.config.enablePersistence) {
        await this.loadPersistedData();
      }
      
      this.connected = true;
      this.metrics.connectionStatus = 'connected';
      
      console.log('✅ In-memory storage initialized');
    } catch (error) {
      this.metrics.connectionStatus = 'error';
      this.metrics.lastError = (error as Error).message;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Persist data if enabled
      if (this.config.enablePersistence && this.connected) {
        await this.persistData();
      }
      
      this.connected = false;
      this.metrics.connectionStatus = 'disconnected';
      
      console.log('✅ In-memory storage disconnected');
    } catch (error) {
      console.error('Error persisting in-memory data:', error);
      this.connected = false;
      this.metrics.connectionStatus = 'disconnected';
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.connected;
  }

  async executeQuery<T>(query: string, params: Record<string, any> = {}): Promise<QueryResult<T>> {
    this.ensureConnected();
    
    const startTime = Date.now();
    this.metrics.totalQueries++;

    try {
      const result = await this.processQuery(query, params);
      
      const executionTime = Date.now() - startTime;
      this.updateSuccessMetrics(executionTime);

      return {
        data: result as T,
        metadata: {
          executionTime,
          recordCount: Array.isArray(result) ? result.length : 1,
          sessionId: `memory-${Date.now()}`
        }
      };
    } catch (error) {
      this.metrics.failedQueries++;
      this.metrics.lastError = (error as Error).message;
      
      throw new QueryError(
        `In-memory query execution failed: ${(error as Error).message}`,
        this.type,
        error as Error
      );
    }
  }

  async executeReadQuery<T>(query: string, params: Record<string, any> = {}): Promise<QueryResult<T>> {
    return this.executeQuery<T>(query, params);
  }

  async executeWriteQuery<T>(query: string, params: Record<string, any> = {}): Promise<QueryResult<T>> {
    return this.executeQuery<T>(query, params);
  }

  async executeInTransaction<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>> {
    return this.executeTransactionInternal(operation);
  }

  async executeInReadTransaction<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>> {
    return this.executeTransactionInternal(operation);
  }

  async executeInWriteTransaction<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>> {
    return this.executeTransactionInternal(operation);
  }

  private async executeTransactionInternal<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>> {
    this.ensureConnected();
    
    const startTime = Date.now();
    this.metrics.totalQueries++;

    try {
      // Create a snapshot for rollback capability
      const nodeSnapshot = new Map(this.nodes);
      const relSnapshot = new Map(this.relationships);

      const txContext: TransactionContext = {
        run: async <U>(query: string, params?: Record<string, any>) => {
          const result = await this.processQuery(query, params || {});
          return result as U;
        },
        rollback: async () => {
          // Restore from snapshot
          this.nodes = nodeSnapshot;
          this.relationships = relSnapshot;
        }
      };

      const result = await operation(txContext);
      
      const executionTime = Date.now() - startTime;
      this.updateSuccessMetrics(executionTime);

      return {
        data: result,
        metadata: {
          executionTime,
          recordCount: 1,
          sessionId: `memory-tx-${Date.now()}`
        }
      };
    } catch (error) {
      this.metrics.failedQueries++;
      this.metrics.lastError = (error as Error).message;
      
      throw new QueryError(
        `In-memory transaction failed: ${(error as Error).message}`,
        this.type,
        error as Error
      );
    }
  }

  async executeBatch<T>(operations: BatchOperation[]): Promise<QueryResult<T[]>> {
    this.ensureConnected();
    
    const startTime = Date.now();
    this.metrics.totalQueries += operations.length;

    try {
      const results: T[] = [];
      
      for (const operation of operations) {
        const result = await this.processQuery(operation.query, operation.params || {});
        results.push(result as T);
      }
      
      const executionTime = Date.now() - startTime;
      this.updateSuccessMetrics(executionTime);

      return {
        data: results,
        metadata: {
          executionTime,
          recordCount: results.length,
          sessionId: `memory-batch-${Date.now()}`
        }
      };
    } catch (error) {
      this.metrics.failedQueries += operations.length;
      this.metrics.lastError = (error as Error).message;
      
      throw new QueryError(
        `In-memory batch execution failed: ${(error as Error).message}`,
        this.type,
        error as Error
      );
    }
  }

  async initializeSchema(): Promise<void> {
    // No-op for in-memory storage
    console.log('📝 Schema initialization skipped for in-memory storage');
  }

  async exportData(): Promise<GraphData> {
    return {
      nodes: Array.from(this.nodes.values()),
      relationships: Array.from(this.relationships.values()),
      metadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        nodeCount: this.nodes.size,
        relationshipCount: this.relationships.size
      }
    };
  }

  async importData(data: GraphData): Promise<void> {
    this.nodes.clear();
    this.relationships.clear();

    // Import nodes
    for (const node of data.nodes) {
      this.nodes.set(node.id, node);
    }

    // Import relationships
    for (const rel of data.relationships) {
      this.relationships.set(rel.id, rel);
    }

    // Update ID counters
    this.nextNodeId = Math.max(...data.nodes.map(n => parseInt(n.id) || 0), 0) + 1;
    this.nextRelId = Math.max(...data.relationships.map(r => parseInt(r.id) || 0), 0) + 1;
  }

  getMetrics(): StorageMetrics {
    return { 
      ...this.metrics,
      connectionStatus: this.connected ? 'connected' : 'disconnected'
    };
  }

  // Simple query processor for basic Cypher-like operations
  private async processQuery(query: string, params: Record<string, any>): Promise<any> {
    const normalizedQuery = query.trim().toUpperCase();

    // CREATE operations
    if (normalizedQuery.startsWith('CREATE')) {
      return this.processCreateQuery(query, params);
    }
    
    // MATCH operations
    if (normalizedQuery.startsWith('MATCH')) {
      return this.processMatchQuery(query, params);
    }
    
    // Return simple result for other queries
    if (normalizedQuery.includes('RETURN 1')) {
      return { records: [{ health: 1 }] };
    }
    
    // DELETE operations
    if (normalizedQuery.includes('DELETE') || normalizedQuery.includes('DETACH DELETE')) {
      this.nodes.clear();
      this.relationships.clear();
      return { records: [] };
    }

    // Default empty result
    return { records: [] };
  }

  private processCreateQuery(query: string, params: Record<string, any>): any {
    // Simple CREATE node pattern
    if (query.includes('CREATE (') && !query.includes(')-[')) {
      const node = this.createNode(params);
      return { records: [node] };
    }
    
    // CREATE relationship pattern
    if (query.includes(')-[') && query.includes(']->')) {
      const rel = this.createRelationship(query, params);
      return { records: [rel] };
    }

    return { records: [] };
  }

  private processMatchQuery(query: string, params: Record<string, any>): any {
    // Simple MATCH all nodes
    if (query.includes('MATCH (n)') && query.includes('RETURN')) {
      return { records: Array.from(this.nodes.values()) };
    }

    // MATCH by ID
    if (params.id) {
      const node = this.nodes.get(params.id);
      return { records: node ? [node] : [] };
    }

    // Return all nodes by default
    return { records: Array.from(this.nodes.values()) };
  }

  private createNode(params: Record<string, any>): GraphNode {
    const id = params.id || `node-${this.nextNodeId++}`;
    const labels = params.labels || ['Node'];
    const properties = { ...params, id };

    const node: GraphNode = {
      id,
      labels: Array.isArray(labels) ? labels : [labels],
      properties
    };

    this.nodes.set(id, node);
    return node;
  }

  private createRelationship(query: string, params: Record<string, any>): GraphRelationship {
    const id = `rel-${this.nextRelId++}`;
    const type = params.type || 'RELATED_TO';
    const startNode = params.startNode || 'unknown';
    const endNode = params.endNode || 'unknown';

    const rel: GraphRelationship = {
      id,
      type,
      startNode,
      endNode,
      properties: params.properties || {}
    };

    this.relationships.set(id, rel);
    return rel;
  }

  private async loadPersistedData(): Promise<void> {
    try {
      const data = await fs.readFile(this.config.persistencePath, 'utf-8');
      const graphData: GraphData = JSON.parse(data);
      await this.importData(graphData);
      console.log(`📂 Loaded ${graphData.nodes.length} nodes and ${graphData.relationships.length} relationships from disk`);
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      console.log('📂 Starting with empty in-memory storage');
    }
  }

  private async persistData(): Promise<void> {
    try {
      const data = await this.exportData();
      await fs.writeFile(this.config.persistencePath, JSON.stringify(data, null, 2));
      console.log(`💾 Persisted ${data.nodes.length} nodes and ${data.relationships.length} relationships to disk`);
    } catch (error) {
      console.error('Failed to persist in-memory data:', error);
    }
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new QueryError('In-memory storage not connected', this.type);
    }
  }

  private updateSuccessMetrics(executionTime: number): void {
    this.metrics.successfulQueries++;
    
    // Update average execution time using exponential moving average
    const alpha = 0.1;
    this.metrics.averageExecutionTime = 
      (1 - alpha) * this.metrics.averageExecutionTime + alpha * executionTime;
  }
}