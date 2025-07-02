import neo4j, { Driver } from 'neo4j-driver';
import { TransactionManager } from './transaction-manager.js';
import { Neo4jConfig } from '../types.js';

export class TestDatabaseManager {
  private driver: Driver | null = null;
  private transactionManager: TransactionManager | null = null;

  async setup(testDbConfig?: Partial<Neo4jConfig>): Promise<TransactionManager> {
    const config: Neo4jConfig = {
      uri: testDbConfig?.uri || 'bolt://localhost:7687',
      username: testDbConfig?.username || 'neo4j',
      password: testDbConfig?.password || 'cortexweaver',
      ...testDbConfig
    };

    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password)
    );

    this.transactionManager = new TransactionManager(this.driver);

    // Verify connection
    const isHealthy = await this.transactionManager.healthCheck();
    if (!isHealthy) {
      throw new Error('Failed to connect to test database');
    }

    // Initialize test schema
    await this.initializeTestSchema();

    return this.transactionManager;
  }

  async cleanup(): Promise<void> {
    if (this.transactionManager) {
      await this.clearTestData();
      await this.transactionManager.close();
      this.transactionManager = null;
    }

    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }

  async clearTestData(): Promise<void> {
    if (!this.transactionManager) {
      throw new Error('Test database not initialized');
    }

    await this.transactionManager.executeInWriteTransaction(async (tx) => {
      // Delete all nodes and relationships in test database
      await tx.run('MATCH (n) DETACH DELETE n');
      return true;
    });
  }

  async initializeTestSchema(): Promise<void> {
    if (!this.transactionManager) {
      throw new Error('Test database not initialized');
    }

    await this.transactionManager.executeInWriteTransaction(async (tx) => {
      const constraints = [
        'CREATE CONSTRAINT test_project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
        'CREATE CONSTRAINT test_task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE',
        'CREATE CONSTRAINT test_agent_id IF NOT EXISTS FOR (a:Agent) REQUIRE a.id IS UNIQUE',
        'CREATE CONSTRAINT test_contract_id IF NOT EXISTS FOR (c:Contract) REQUIRE c.id IS UNIQUE'
      ];

      for (const constraint of constraints) {
        try {
          await tx.run(constraint);
        } catch (error) {
          // Ignore constraint already exists errors
          if (!(error instanceof Error) || !error.message.includes('already exists')) {
            console.warn(`Failed to create constraint: ${constraint}`, error);
          }
        }
      }

      return true;
    });
  }

  async createTestData(): Promise<{
    projectId: string;
    taskIds: string[];
    agentIds: string[];
    contractIds: string[];
  }> {
    if (!this.transactionManager) {
      throw new Error('Test database not initialized');
    }

    const result = await this.transactionManager.executeInWriteTransaction(async (tx) => {
      const timestamp = new Date().toISOString();
      const projectId = `test-project-${Date.now()}`;

      // Create test project
      await tx.run(
        'CREATE (p:Project {id: $id, name: $name, description: $description, status: $status, createdAt: $createdAt})',
        {
          id: projectId,
          name: 'Test Project',
          description: 'Test project for transaction testing',
          status: 'active',
          createdAt: timestamp
        }
      );

      // Create test tasks
      const taskIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const taskId = `test-task-${Date.now()}-${i}`;
        taskIds.push(taskId);
        
        await tx.run(
          'CREATE (t:Task {id: $id, title: $title, description: $description, status: $status, priority: $priority, projectId: $projectId, createdAt: $createdAt})',
          {
            id: taskId,
            title: `Test Task ${i + 1}`,
            description: `Test task ${i + 1} description`,
            status: 'pending',
            priority: 'medium',
            projectId,
            createdAt: timestamp
          }
        );
      }

      // Create test agents
      const agentIds: string[] = [];
      for (let i = 0; i < 2; i++) {
        const agentId = `test-agent-${Date.now()}-${i}`;
        agentIds.push(agentId);
        
        await tx.run(
          'CREATE (a:Agent {id: $id, name: $name, role: $role, capabilities: $capabilities, status: $status, createdAt: $createdAt})',
          {
            id: agentId,
            name: `Test Agent ${i + 1}`,
            role: 'tester',
            capabilities: ['testing', 'validation'],
            status: 'active',
            createdAt: timestamp
          }
        );
      }

      // Create test contracts
      const contractIds: string[] = [];
      for (let i = 0; i < 2; i++) {
        const contractId = `test-contract-${Date.now()}-${i}`;
        contractIds.push(contractId);
        
        await tx.run(
          'CREATE (c:Contract {id: $id, name: $name, type: $type, version: $version, specification: $specification, projectId: $projectId, createdAt: $createdAt})',
          {
            id: contractId,
            name: `Test Contract ${i + 1}`,
            type: 'json-schema',
            version: '1.0.0',
            specification: `{"type": "object", "properties": {"test": {"type": "string"}}}`,
            projectId,
            createdAt: timestamp
          }
        );
      }

      return { projectId, taskIds, agentIds, contractIds };
    });

    return result.data;
  }

  getTransactionManager(): TransactionManager {
    if (!this.transactionManager) {
      throw new Error('Test database not initialized');
    }
    return this.transactionManager;
  }
}

export async function withTestDatabase<T>(
  testFn: (tm: TransactionManager) => Promise<T>,
  config?: Partial<Neo4jConfig>
): Promise<T> {
  const testDb = new TestDatabaseManager();
  try {
    const transactionManager = await testDb.setup(config);
    return await testFn(transactionManager);
  } finally {
    await testDb.cleanup();
  }
}

export function createTestSuite(suiteName: string) {
  return {
    async runTransactionTest<T>(
      testName: string,
      testFn: (tm: TransactionManager) => Promise<T>,
      config?: Partial<Neo4jConfig>
    ): Promise<T> {
      console.log(`Running test: ${suiteName} - ${testName}`);
      try {
        const result = await withTestDatabase(testFn, config);
        console.log(`✅ Test passed: ${suiteName} - ${testName}`);
        return result;
      } catch (error) {
        console.error(`❌ Test failed: ${suiteName} - ${testName}`, error);
        throw error;
      }
    }
  };
}