import { CognitiveCanvasBase } from './base';
import { SnapshotData, KnowledgeGraph, FailureData, DiagnosticData, PatternData, ArtifactData } from './types';
import { CognitiveCanvasValidators } from './validators';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Session } from 'neo4j-driver';

export class AnalyticsOperations extends CognitiveCanvasBase {
  // Snapshot Management
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
          id: Math.random().toString(36).substring(7),
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

    // Create relationships using property matching
    for (const rel of snapshot.relationships) {
      const relSession = this.driver.session();
      try {
        const startNodeProps = snapshot.nodes.find(n => n.id === rel.startNode)?.properties;
        const endNodeProps = snapshot.nodes.find(n => n.id === rel.endNode)?.properties;
        
        if (startNodeProps && endNodeProps && startNodeProps.id && endNodeProps.id) {
          const query = `
            MATCH (start {id: $startId}), (end {id: $endId})
            CREATE (start)-[r:${rel.type}]->(end)
            SET r = $props
          `;
          await relSession.run(query, {
            startId: startNodeProps.id,
            endId: endNodeProps.id,
            props: rel.properties || {}
          });
        }
      } finally {
        await relSession.close();
      }
    }
  }

  async createSnapshot(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `snapshot-${timestamp}.json`;
    const filepath = path.join(this.snapshotsDir, filename);
    await this.saveSnapshot(filepath);
    return filepath;
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
    await this.initializeSchema();
  }

  // Failure and Diagnostic Management
  async storeFailure(failureData: FailureData): Promise<FailureData> {
    CognitiveCanvasValidators.validateFailureData(failureData);
    const result = await this.executeQuery<FailureData>(
      'CREATE (f:Failure {id: $id, message: $message, stack: $stack, stackTrace: $stackTrace, context: $context, severity: $severity, type: $type, agentId: $agentId, errorMessage: $errorMessage, timestamp: $timestamp, taskId: $taskId, projectId: $projectId, createdAt: $createdAt}) RETURN f',
      failureData, 'f'
    );
    if (!result) {
      throw new Error('Failed to store failure');
    }
    return result;
  }

  async storeDiagnostic(diagnosticData: DiagnosticData): Promise<DiagnosticData> {
    CognitiveCanvasValidators.validateDiagnosticData(diagnosticData);
    const result = await this.executeQuery<DiagnosticData>(
      'CREATE (d:Diagnostic {id: $id, rootCause: $rootCause, solution: $solution, confidence: $confidence, considerations: $considerations, failureId: $failureId, createdAt: $createdAt}) RETURN d',
      diagnosticData, 'd'
    );
    if (!result) {
      throw new Error('Failed to store diagnostic');
    }
    return result;
  }

  async storePattern(patternData: PatternData): Promise<PatternData> {
    CognitiveCanvasValidators.validatePatternData(patternData);
    const result = await this.executeQuery<PatternData>(
      'CREATE (p:Pattern {id: $id, type: $type, pattern: $pattern, context: $context, frequency: $frequency, taskOutcome: $taskOutcome, projectId: $projectId, createdAt: $createdAt}) RETURN p',
      patternData, 'p'
    );
    if (!result) {
      throw new Error('Failed to store pattern');
    }
    return result;
  }

  async storeArtifact(artifactData: ArtifactData): Promise<ArtifactData> {
    CognitiveCanvasValidators.validateArtifactData(artifactData);
    const result = await this.executeQuery<ArtifactData>(
      'CREATE (a:Artifact {id: $id, type: $type, name: $name, data: $data, content: $content, projectId: $projectId, createdAt: $createdAt}) RETURN a',
      artifactData, 'a'
    );
    if (!result) {
      throw new Error('Failed to store artifact');
    }
    return result;
  }

  // Analytics queries
  async getKnowledgeGraph(projectId: string): Promise<KnowledgeGraph> {
    const project = await this.executeQuery('MATCH (p:Project {id: $id}) RETURN p', { id: projectId }, 'p');
    
    const tasks = await this.executeQuery<any>('MATCH (t:Task {projectId: $projectId}) RETURN t', { projectId });
    const agents = await this.executeQuery<any>('MATCH (a:Agent) RETURN a');
    const pheromones = await this.executeQuery<any>('MATCH (ph:Pheromone) RETURN ph');
    const decisions = await this.executeQuery<any>('MATCH (ad:ArchitecturalDecision {projectId: $projectId}) RETURN ad', { projectId });
    const contracts = await this.executeQuery<any>('MATCH (c:Contract {projectId: $projectId}) RETURN c', { projectId });
    const codeModules = await this.executeQuery<any>('MATCH (cm:CodeModule {projectId: $projectId}) RETURN cm', { projectId });
    const tests = await this.executeQuery<any>('MATCH (t:Test {projectId: $projectId}) RETURN t', { projectId });

    return {
      project: project,
      tasks: tasks?.records?.map((r: any) => r.get('t').properties) || [],
      agents: agents?.records?.map((r: any) => r.get('a').properties) || [],
      pheromones: pheromones?.records?.map((r: any) => r.get('ph').properties) || [],
      architecturalDecisions: decisions?.records?.map((r: any) => r.get('ad').properties) || [],
      contracts: contracts?.records?.map((r: any) => r.get('c').properties) || [],
      codeModules: codeModules?.records?.map((r: any) => r.get('cm').properties) || [],
      tests: tests?.records?.map((r: any) => r.get('t').properties) || []
    };
  }

  // Validation
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