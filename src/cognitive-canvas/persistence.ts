import { Driver, ManagedTransaction } from 'neo4j-driver';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SnapshotData } from './types';
import { TransactionManager } from './transaction/transaction-manager.js';

export class Persistence {
  private transactionManager: TransactionManager;
  
  constructor(private driver: Driver, private snapshotsDir: string = './snapshots', sharedTransactionManager?: TransactionManager) {
    this.transactionManager = sharedTransactionManager || new TransactionManager(driver);
  }

  async saveSnapshot(filepath: string): Promise<void> {
    const snapshotDir = path.dirname(filepath);
    await fs.mkdir(snapshotDir, { recursive: true });

    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        // Get nodes
        const nodesResult = await tx.run('MATCH (n) RETURN n');
        const nodes = nodesResult.records.map(record => {
          const node = record.get('n');
          return {
            id: node.identity.low ? node.identity.low.toString() : Math.random().toString(36).substring(7),
            labels: node.labels,
            properties: node.properties
          };
        });
        
        // Get relationships
        const relsResult = await tx.run('MATCH ()-[r]->() RETURN startNode(r) as start, endNode(r) as end, type(r) as type, properties(r) as props');
        const relationships = relsResult.records.map(record => {
          const startNode = record.get('start');
          const endNode = record.get('end');
          return {
            id: Math.random().toString(36).substring(7), // Generate temp ID
            startNode: startNode.identity.low ? startNode.identity.low.toString() : Math.random().toString(36).substring(7),
            endNode: endNode.identity.low ? endNode.identity.low.toString() : Math.random().toString(36).substring(7),
            type: record.get('type'),
            properties: record.get('props')
          };
        });
        
        return { nodes, relationships };
      }
    );

    const nodeTypes: Record<string, number> = {};
    result.data.nodes.forEach(node => {
      node.labels.forEach((label: string) => {
        nodeTypes[label] = (nodeTypes[label] || 0) + 1;
      });
    });

    const snapshot: SnapshotData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      metadata: {
        totalNodes: result.data.nodes.length,
        totalRelationships: result.data.relationships.length,
        nodeTypes
      },
      nodes: result.data.nodes,
      relationships: result.data.relationships
    };

    await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  async loadSnapshot(filepath: string): Promise<void> {
    const data = await fs.readFile(filepath, 'utf8');
    const snapshot: SnapshotData = JSON.parse(data);

    this.validateSnapshotFormat(snapshot);

    // Clear existing data
    await this.transactionManager.executeInWriteTransaction(
      async (tx: ManagedTransaction) => {
        await tx.run('MATCH (n) DETACH DELETE n');
        return true;
      }
    );

    // Batch create nodes
    const batchSize = 100;
    for (let i = 0; i < snapshot.nodes.length; i += batchSize) {
      const batch = snapshot.nodes.slice(i, i + batchSize);
      
      await this.transactionManager.executeInWriteTransaction(
        async (tx: ManagedTransaction) => {
          for (const node of batch) {
            const labels = node.labels.join(':');
            const query = `CREATE (n:${labels}) SET n = $properties`;
            await tx.run(query, { properties: node.properties });
          }
          return true;
        }
      );
    }

    // Create relationships using property matching (simpler and more reliable)
    for (const rel of snapshot.relationships) {
      const startNodeProps = snapshot.nodes.find(n => n.id === rel.startNode)?.properties;
      const endNodeProps = snapshot.nodes.find(n => n.id === rel.endNode)?.properties;
      
      if (startNodeProps && endNodeProps) {
        await this.transactionManager.executeInWriteTransaction(
          async (tx: ManagedTransaction) => {
            const query = `
              MATCH (start), (end)
              WHERE start = $startProps AND end = $endProps
              CREATE (start)-[r:${rel.type}]->(end)
              SET r = $properties
            `;
            await tx.run(query, {
              startProps: startNodeProps,
              endProps: endNodeProps,
              properties: rel.properties
            });
            return true;
          }
        );
      }
    }
  }

  async autoSaveSnapshot(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `auto-save-${timestamp}.json`;
    const filepath = path.join(this.snapshotsDir, filename);
    await this.saveSnapshot(filepath);
  }

  async listSnapshots(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.snapshotsDir);
      return files.filter(file => file.endsWith('.json'));
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async restoreFromSnapshot(filepath: string): Promise<void> {
    await this.loadSnapshot(filepath);
    // Note: Schema initialization should be called separately by the main class
  }

  private validateSnapshotFormat(snapshot: any): void {
    const required = ['version', 'timestamp', 'metadata', 'nodes', 'relationships'];
    if (!required.every(field => snapshot[field] !== undefined)) {
      throw new Error('Invalid snapshot format: missing required fields');
    }
    if (!Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.relationships)) {
      throw new Error('Invalid snapshot format: nodes and relationships must be arrays');
    }
  }
}