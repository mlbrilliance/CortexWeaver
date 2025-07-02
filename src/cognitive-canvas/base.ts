import neo4j, { Driver, Session } from 'neo4j-driver';
import { Neo4jConfig } from './types';

export abstract class CognitiveCanvasBase {
  protected driver: Driver;
  protected autoSaveInterval?: NodeJS.Timeout;
  protected snapshotsDir: string;

  constructor(config: Neo4jConfig, snapshotsDir: string = './snapshots') {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password)
    );
    this.snapshotsDir = snapshotsDir;
  }

  async initializeSchema(): Promise<void> {
    const session = this.driver.session();
    try {
      const constraints = [
        'CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
        'CREATE CONSTRAINT task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE',
        'CREATE CONSTRAINT agent_id IF NOT EXISTS FOR (a:Agent) REQUIRE a.id IS UNIQUE',
        'CREATE CONSTRAINT pheromone_id IF NOT EXISTS FOR (ph:Pheromone) REQUIRE ph.id IS UNIQUE',
        'CREATE CONSTRAINT contract_id IF NOT EXISTS FOR (c:Contract) REQUIRE c.id IS UNIQUE',
        'CREATE CONSTRAINT code_module_id IF NOT EXISTS FOR (cm:CodeModule) REQUIRE cm.id IS UNIQUE',
        'CREATE CONSTRAINT test_id IF NOT EXISTS FOR (t:Test) REQUIRE t.id IS UNIQUE'
      ];
      await Promise.all(constraints.map(constraint => session.run(constraint)));
    } finally {
      await session.close();
    }
  }

  protected async executeQuery<T>(query: string, params: any = {}, returnKey?: string): Promise<T | null> {
    const session = this.driver.session();
    try {
      const result = await session.run(query, params);
      if (!returnKey) return result as T;
      if (result.records.length === 0) return null;
      return result.records[0].get(returnKey).properties;
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
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