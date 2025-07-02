import { CognitiveCanvasBase } from './base';
import { PheromoneData } from './types';
import { CognitiveCanvasValidators } from './validators';

export class PheromoneOperations extends CognitiveCanvasBase {
  async createPheromone(pheromoneData: PheromoneData): Promise<PheromoneData> {
    CognitiveCanvasValidators.validatePheromoneData(pheromoneData);
    const result = await this.executeQuery<PheromoneData>(
      'CREATE (ph:Pheromone {id: $id, type: $type, strength: $strength, context: $context, metadata: $metadata, createdAt: $createdAt, expiresAt: $expiresAt}) RETURN ph',
      pheromoneData, 'ph'
    );
    if (!result) {
      throw new Error('Failed to create pheromone');
    }
    return result;
  }

  async linkPheromoneToTask(pheromoneId: string, taskId: string): Promise<void> {
    await this.executeQuery(
      'MATCH (ph:Pheromone {id: $pheromoneId}), (t:Task {id: $taskId}) CREATE (ph)-[r:INFLUENCES]->(t) RETURN r',
      { pheromoneId, taskId }
    );
  }

  async getPheromonesByType(type: string): Promise<PheromoneData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (ph:Pheromone {type: $type}) WHERE ph.expiresAt > $now RETURN ph ORDER BY ph.strength DESC',
      { type, now: new Date().toISOString() }
    );
    if (!result || !result.records) return [];
    return result.records.map((record: any) => record.get('ph').properties);
  }

  async cleanExpiredPheromones(): Promise<number> {
    const result = await this.executeQuery<any>(
      'MATCH (ph:Pheromone) WHERE ph.expiresAt <= $now DETACH DELETE ph',
      { now: new Date().toISOString() }
    );
    return result?.summary?.counters?.updates()?.nodesDeleted || 0;
  }

  async updatePheromoneStrength(id: string, strength: number): Promise<PheromoneData> {
    const result = await this.executeQuery<PheromoneData>(
      'MATCH (ph:Pheromone {id: $id}) SET ph.strength = $strength RETURN ph',
      { id, strength }, 'ph'
    );
    if (!result) {
      throw new Error(`Pheromone with id ${id} not found`);
    }
    return result;
  }

  async getPheromone(id: string): Promise<PheromoneData | null> {
    return this.executeQuery('MATCH (ph:Pheromone {id: $id}) RETURN ph', { id }, 'ph');
  }

  async listActivePheromones(): Promise<PheromoneData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (ph:Pheromone) WHERE ph.expiresAt > $now RETURN ph ORDER BY ph.strength DESC',
      { now: new Date().toISOString() }
    );
    if (!result || !result.records) return [];
    return result.records.map((record: any) => record.get('ph').properties);
  }

  // Create snapshot method implementation (required by base class)
  async createSnapshot(): Promise<string> {
    // This will be implemented in the main class
    throw new Error('createSnapshot must be implemented in the main CognitiveCanvas class');
  }
}