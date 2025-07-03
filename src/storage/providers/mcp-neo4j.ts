import { 
  StorageProvider, 
  QueryResult, 
  TransactionFunction, 
  TransactionContext,
  BatchOperation, 
  StorageMetrics, 
  MCPNeo4jConfig,
  ConnectionError,
  QueryError,
  GraphData
} from '../types.js';
import { MCPClient } from '../../mcp-client/index.js';

/**
 * MCP-based Neo4j storage provider
 * Uses MCP (Model Context Protocol) client to communicate with Neo4j
 * instead of direct database connections
 */
export class MCPNeo4jProvider implements StorageProvider {
  readonly type = 'mcp-neo4j';
  private mcpClient: MCPClient;
  private config: MCPNeo4jConfig;
  private connected = false;
  private metrics: StorageMetrics;
  private retryCount = 0;

  constructor(config: MCPNeo4jConfig) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      connectionTimeout: 10000,
      ...config
    };

    this.mcpClient = new MCPClient({
      neo4j: {
        uri: config.uri,
        username: config.username,
        password: config.password,
        mcpServerUrl: config.mcpServerUrl
      }
    });

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
      
      // Use MCP client to establish connection
      await this.mcpClient.connectToNeo4j();
      
      // Test connection with a simple executeCypherQuery
      await this.healthCheck();
      
      this.connected = true;
      this.metrics.connectionStatus = 'connected';
      this.retryCount = 0;
      
      console.log('✅ Connected to Neo4j via MCP');
    } catch (error) {
      this.connected = false;
      this.metrics.connectionStatus = 'error';
      this.metrics.lastError = (error as Error).message;
      
      throw new ConnectionError(
        `Failed to connect to Neo4j via MCP: ${(error as Error).message}`,
        this.type,
        error as Error
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.connected) {
        await this.mcpClient.disconnect();
        this.connected = false;
        this.metrics.connectionStatus = 'disconnected';
        console.log('✅ Disconnected from Neo4j via MCP');
      }
    } catch (error) {
      console.error('Error disconnecting from Neo4j via MCP:', error);
      throw new ConnectionError(
        `Failed to disconnect from Neo4j via MCP: ${(error as Error).message}`,
        this.type,
        error as Error
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.mcpClient.executeCypherQuery('RETURN 1 as health', {});
      return result.records.length > 0 && result.records[0].health === 1;
    } catch (error) {
      return false;
    }
  }

  async executeQuery<T>(executeCypherQuery: string, params: Record<string, any> = {}): Promise<QueryResult<T>> {
    this.ensureConnected();
    
    const startTime = Date.now();
    this.metrics.totalQueries++;

    try {
      const result = await this.mcpClient.executeCypherQuery(executeCypherQuery, params);
      
      const executionTime = Date.now() - startTime;
      this.updateSuccessMetrics(executionTime);

      return {
        data: result as T,
        metadata: {
          executionTime,
          recordCount: Array.isArray(result.records) ? result.records.length : 1,
          sessionId: `mcp-${Date.now()}`
        }
      };
    } catch (error) {
      this.metrics.failedQueries++;
      this.metrics.lastError = (error as Error).message;
      
      throw new QueryError(
        `Query execution failed: ${(error as Error).message}`,
        this.type,
        error as Error
      );
    }
  }

  async executeReadQuery<T>(executeCypherQuery: string, params: Record<string, any> = {}): Promise<QueryResult<T>> {
    // For MCP, we don't differentiate between read/write at the provider level
    // The MCP server handles transaction management
    return this.executeQuery<T>(executeCypherQuery, params);
  }

  async executeWriteQuery<T>(executeCypherQuery: string, params: Record<string, any> = {}): Promise<QueryResult<T>> {
    // For MCP, we don't differentiate between read/write at the provider level
    // The MCP server handles transaction management
    return this.executeQuery<T>(executeCypherQuery, params);
  }

  async executeInTransaction<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>> {
    return this.executeTransactionInternal(operation, 'WRITE');
  }

  async executeInReadTransaction<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>> {
    return this.executeTransactionInternal(operation, 'READ');
  }

  async executeInWriteTransaction<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>> {
    return this.executeTransactionInternal(operation, 'WRITE');
  }

  private async executeTransactionInternal<T>(
    operation: TransactionFunction<T>, 
    mode: 'READ' | 'WRITE'
  ): Promise<QueryResult<T>> {
    this.ensureConnected();
    
    const startTime = Date.now();
    this.metrics.totalQueries++;

    try {
      // Create transaction context that delegates to MCP client
      const txContext: TransactionContext = {
        run: async <U>(executeCypherQuery: string, params?: Record<string, any>) => {
          const result = await this.mcpClient.executeCypherQuery(executeCypherQuery, params || {});
          return result as U;
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
          sessionId: `mcp-tx-${Date.now()}`
        }
      };
    } catch (error) {
      this.metrics.failedQueries++;
      this.metrics.lastError = (error as Error).message;
      
      throw new QueryError(
        `Transaction execution failed: ${(error as Error).message}`,
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
      
      // Execute operations sequentially for MCP
      // TODO: Add parallel execution support if MCP server supports it
      for (const operation of operations) {
        const result = await this.mcpClient.executeCypherQuery(operation.query, operation.params || {});
        results.push(result as T);
      }
      
      const executionTime = Date.now() - startTime;
      this.updateSuccessMetrics(executionTime);

      return {
        data: results,
        metadata: {
          executionTime,
          recordCount: results.length,
          sessionId: `mcp-batch-${Date.now()}`
        }
      };
    } catch (error) {
      this.metrics.failedQueries += operations.length;
      this.metrics.lastError = (error as Error).message;
      
      throw new QueryError(
        `Batch execution failed: ${(error as Error).message}`,
        this.type,
        error as Error
      );
    }
  }

  async initializeSchema(): Promise<void> {
    this.ensureConnected();
    
    const constraints = [
      'CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
      'CREATE CONSTRAINT task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE',
      'CREATE CONSTRAINT agent_id IF NOT EXISTS FOR (a:Agent) REQUIRE a.id IS UNIQUE',
      'CREATE CONSTRAINT pheromone_id IF NOT EXISTS FOR (ph:Pheromone) REQUIRE ph.id IS UNIQUE',
      'CREATE CONSTRAINT contract_id IF NOT EXISTS FOR (c:Contract) REQUIRE c.id IS UNIQUE',
      'CREATE CONSTRAINT code_module_id IF NOT EXISTS FOR (cm:CodeModule) REQUIRE cm.id IS UNIQUE',
      'CREATE CONSTRAINT test_id IF NOT EXISTS FOR (t:Test) REQUIRE t.id IS UNIQUE'
    ];

    for (const constraint of constraints) {
      try {
        await this.mcpClient.executeCypherQuery(constraint, {});
      } catch (error) {
        // Ignore constraint already exists errors
        if (!(error as Error).message.includes('already exists')) {
          throw error;
        }
      }
    }
  }

  async exportData(): Promise<GraphData> {
    this.ensureConnected();
    
    // Export all nodes and relationships
    const nodesResult = await this.mcpClient.executeCypherQuery('MATCH (n) RETURN n', {});
    const relsResult = await this.mcpClient.executeCypherQuery(
      'MATCH ()-[r]->() RETURN startNode(r) as start, endNode(r) as end, type(r) as type, properties(r) as props, id(r) as id',
      {}
    );

    const nodes = nodesResult.records.map(record => ({
      id: record.n.identity.toString(),
      labels: record.n.labels,
      properties: record.n.properties
    }));

    const relationships = relsResult.records.map(record => ({
      id: record.id.toString(),
      type: record.type,
      startNode: record.start.identity.toString(),
      endNode: record.end.identity.toString(),
      properties: record.props || {}
    }));

    return {
      nodes,
      relationships,
      metadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        nodeCount: nodes.length,
        relationshipCount: relationships.length
      }
    };
  }

  async importData(data: GraphData): Promise<void> {
    this.ensureConnected();
    
    // Clear existing data
    await this.mcpClient.executeCypherQuery('MATCH (n) DETACH DELETE n', {});

    // Import nodes
    for (const node of data.nodes) {
      const labels = node.labels.join(':');
      await this.mcpClient.executeCypherQuery(
        `CREATE (n:${labels}) SET n = $properties`,
        { properties: node.properties }
      );
    }

    // Import relationships
    for (const rel of data.relationships) {
      const startNodeProps = data.nodes.find(n => n.id === rel.startNode)?.properties;
      const endNodeProps = data.nodes.find(n => n.id === rel.endNode)?.properties;
      
      if (startNodeProps?.id && endNodeProps?.id) {
        await this.mcpClient.executeCypherQuery(
          `MATCH (start {id: $startId}), (end {id: $endId})
           CREATE (start)-[r:${rel.type}]->(end)
           SET r = $props`,
          {
            startId: startNodeProps.id,
            endId: endNodeProps.id,
            props: rel.properties
          }
        );
      }
    }
  }

  getMetrics(): StorageMetrics {
    return { ...this.metrics };
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new ConnectionError('Not connected to Neo4j via MCP', this.type);
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