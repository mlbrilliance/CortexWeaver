import { CognitiveCanvasBase } from './base';
import { AgentData, TaskData } from './types';
import { CognitiveCanvasValidators } from './validators';

export class AgentOperations extends CognitiveCanvasBase {
  async createAgent(agentData: AgentData): Promise<AgentData> {
    CognitiveCanvasValidators.validateAgentData(agentData);
    const result = await this.executeQuery<AgentData>(
      'CREATE (a:Agent {id: $id, name: $name, role: $role, capabilities: $capabilities, status: $status, createdAt: $createdAt}) RETURN a',
      agentData, 'a'
    );
    if (!result) {
      throw new Error('Failed to create agent');
    }
    return result;
  }

  async assignAgentToTask(agentId: string, taskId: string): Promise<void> {
    await this.executeQuery(
      'MATCH (a:Agent {id: $agentId}), (t:Task {id: $taskId}) CREATE (t)-[r:ASSIGNED_TO {assignedAt: $assignedAt}]->(a) RETURN r',
      { agentId, taskId, assignedAt: new Date().toISOString() }
    );
  }

  async getAgentAssignments(agentId: string): Promise<TaskData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (t:Task)-[:ASSIGNED_TO]->(a:Agent {id: $agentId}) RETURN t',
      { agentId }
    );
    if (!result || !result.records) return [];
    return result.records.map((record: any) => record.get('t').properties);
  }

  async getAgent(id: string): Promise<AgentData | null> {
    return this.executeQuery('MATCH (a:Agent {id: $id}) RETURN a', { id }, 'a');
  }

  async updateAgentStatus(id: string, status: string): Promise<AgentData> {
    const result = await this.executeQuery<AgentData>(
      'MATCH (a:Agent {id: $id}) SET a.status = $status RETURN a',
      { id, status }, 'a'
    );
    if (!result) {
      throw new Error(`Agent with id ${id} not found`);
    }
    return result;
  }

  async listAgents(): Promise<AgentData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (a:Agent) RETURN a ORDER BY a.createdAt'
    );
    if (!result || !result.records) return [];
    return result.records.map((record: any) => record.get('a').properties);
  }

  async deleteAgent(id: string): Promise<void> {
    await this.executeQuery(
      'MATCH (a:Agent {id: $id}) DETACH DELETE a',
      { id }
    );
  }

  // Create snapshot method implementation (required by base class)
  async createSnapshot(): Promise<string> {
    // This will be implemented in the main class
    throw new Error('createSnapshot must be implemented in the main CognitiveCanvas class');
  }
}