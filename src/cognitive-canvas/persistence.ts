import { Driver } from 'neo4j-driver';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SnapshotData } from './types';

export class Persistence {
  constructor(private driver: Driver, private snapshotsDir: string = './snapshots') {}

  async saveSnapshot(filepath: string): Promise<void> {
    const snapshotDir = path.dirname(filepath);
    await fs.mkdir(snapshotDir, { recursive: true });

    const nodesSession = this.driver.session();
    let nodes: any[] = [];
    try {
      const nodesResult = await nodesSession.run('MATCH (n) RETURN n');
      nodes = nodesResult.records.map(record => {
        const node = record.get('n');
        return {
          id: node.identity.low ? node.identity.low.toString() : Math.random().toString(36).substring(7),
          labels: node.labels,
          properties: node.properties
        };
      });
    } finally {
      await nodesSession.close();
    }

    const relsSession = this.driver.session();
    let relationships: any[] = [];
    try {
      const relsResult = await relsSession.run('MATCH ()-[r]->() RETURN startNode(r) as start, endNode(r) as end, type(r) as type, properties(r) as props');
      relationships = relsResult.records.map(record => {
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
    } finally {
      await relsSession.close();
    }

    const nodeTypes: Record<string, number> = {};
    nodes.forEach(node => {
      node.labels.forEach((label: string) => {
        nodeTypes[label] = (nodeTypes[label] || 0) + 1;
      });
    });

    const snapshot: SnapshotData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      metadata: {
        totalNodes: nodes.length,
        totalRelationships: relationships.length,
        nodeTypes
      },
      nodes,
      relationships
    };

    await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  async loadSnapshot(filepath: string): Promise<void> {
    const data = await fs.readFile(filepath, 'utf8');
    const snapshot: SnapshotData = JSON.parse(data);

    this.validateSnapshotFormat(snapshot);

    // Clear existing data
    const clearSession = this.driver.session();
    try {
      await clearSession.run('MATCH (n) DETACH DELETE n');
    } finally {
      await clearSession.close();
    }

    // Batch create nodes
    const batchSize = 100;
    for (let i = 0; i < snapshot.nodes.length; i += batchSize) {
      const batch = snapshot.nodes.slice(i, i + batchSize);
      const nodeSession = this.driver.session();
      try {
        for (const node of batch) {
          const labels = node.labels.join(':');
          const query = `CREATE (n:${labels}) SET n = $properties`;
          await nodeSession.run(query, { properties: node.properties });
        }
      } finally {
        await nodeSession.close();
      }
    }

    // Create relationships using property matching (simpler and more reliable)
    for (const rel of snapshot.relationships) {
      const relSession = this.driver.session();
      try {
        const startNodeProps = snapshot.nodes.find(n => n.id === rel.startNode)?.properties;
        const endNodeProps = snapshot.nodes.find(n => n.id === rel.endNode)?.properties;
        
        if (startNodeProps && endNodeProps) {
          const query = `
            MATCH (start), (end)
            WHERE start = $startProps AND end = $endProps
            CREATE (start)-[r:${rel.type}]->(end)
            SET r = $properties
          `;
          await relSession.run(query, {
            startProps: startNodeProps,
            endProps: endNodeProps,
            properties: rel.properties
          });
        }
      } finally {
        await relSession.close();
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