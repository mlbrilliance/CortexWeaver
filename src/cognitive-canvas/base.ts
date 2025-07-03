import neo4j, { Driver, Session, ManagedTransaction } from 'neo4j-driver';
import { Neo4jConfig } from './types';
import { TransactionManager } from './transaction/transaction-manager.js';

export abstract class CognitiveCanvasBase {
  protected driver: Driver;
  protected transactionManager: TransactionManager;
  protected autoSaveInterval?: NodeJS.Timeout;
  protected snapshotsDir: string;

  constructor(config: Neo4jConfig, snapshotsDir: string = './snapshots') {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password)
    );
    this.transactionManager = new TransactionManager(this.driver);
    this.snapshotsDir = snapshotsDir;
  }

  async initializeSchema(): Promise<void> {
    const constraints = [
      'CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
      'CREATE CONSTRAINT task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE',
      'CREATE CONSTRAINT agent_id IF NOT EXISTS FOR (a:Agent) REQUIRE a.id IS UNIQUE',
      'CREATE CONSTRAINT pheromone_id IF NOT EXISTS FOR (ph:Pheromone) REQUIRE ph.id IS UNIQUE',
      'CREATE CONSTRAINT contract_id IF NOT EXISTS FOR (c:Contract) REQUIRE c.id IS UNIQUE',
      'CREATE CONSTRAINT code_module_id IF NOT EXISTS FOR (cm:CodeModule) REQUIRE cm.id IS UNIQUE',
      'CREATE CONSTRAINT test_id IF NOT EXISTS FOR (t:Test) REQUIRE t.id IS UNIQUE'
    ];
    
    await this.transactionManager.executeInWriteTransaction(async (tx: ManagedTransaction) => {
      await Promise.all(constraints.map(constraint => tx.run(constraint)));
      return true;
    });
  }

  protected async executeQuery<T>(query: string, params: any = {}, returnKey?: string): Promise<T | null> {
    const result = await this.transactionManager.executeInTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(query, params);
        if (!returnKey) return queryResult as T;
        if (queryResult.records.length === 0) return null;
        return queryResult.records[0].get(returnKey).properties;
      }
    );
    return result.data;
  }

  async close(): Promise<void> {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    await this.transactionManager.close();
    await this.driver.close();
  }

  async startAutoSave(intervalMs: number = 60000): Promise<void> {
    this.autoSaveInterval = setInterval(async () => {
      try {
        await this.createSnapshot();
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, intervalMs);
  }

  async stopAutoSave(): Promise<void> {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = undefined;
    }
  }

  // Abstract method to be implemented by the main class
  abstract createSnapshot(): Promise<string>;
}