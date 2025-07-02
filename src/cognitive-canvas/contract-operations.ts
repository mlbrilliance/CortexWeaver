import { CognitiveCanvasBase } from './base';
import { ContractData, ArchitecturalDecisionData } from './types';
import { CognitiveCanvasValidators } from './validators';

export class ContractOperations extends CognitiveCanvasBase {
  async createContract(contractData: ContractData): Promise<ContractData> {
    CognitiveCanvasValidators.validateContractData(contractData);
    const result = await this.executeQuery<ContractData>(
      'CREATE (c:Contract {id: $id, name: $name, type: $type, version: $version, specification: $specification, description: $description, projectId: $projectId, createdAt: $createdAt}) RETURN c',
      contractData, 'c'
    );
    if (!result) {
      throw new Error('Failed to create contract');
    }
    return result;
  }

  async getContract(id: string): Promise<ContractData | null> {
    return this.executeQuery('MATCH (c:Contract {id: $id}) RETURN c', { id }, 'c');
  }

  async updateContract(id: string, updates: Partial<ContractData>): Promise<ContractData> {
    const updateData = { ...updates, id, updatedAt: new Date().toISOString() };
    const result = await this.executeQuery<ContractData>(
      'MATCH (c:Contract {id: $id}) SET c += $updates RETURN c',
      { id, updates: updateData }, 'c'
    );
    if (!result) {
      throw new Error(`Contract with id ${id} not found`);
    }
    return result;
  }

  async getContractsByProject(projectId: string): Promise<ContractData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (c:Contract {projectId: $projectId}) RETURN c ORDER BY c.createdAt',
      { projectId }
    );
    if (!result || !result.records) return [];
    return result.records.map((record: any) => record.get('c').properties);
  }

  async deleteContract(id: string): Promise<void> {
    await this.executeQuery(
      'MATCH (c:Contract {id: $id}) DETACH DELETE c',
      { id }
    );
  }

  async listContracts(): Promise<ContractData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (c:Contract) RETURN c ORDER BY c.createdAt DESC'
    );
    if (!result || !result.records) return [];
    return result.records.map((record: any) => record.get('c').properties);
  }

  // Architectural Decisions
  async storeArchitecturalDecision(decisionData: ArchitecturalDecisionData): Promise<ArchitecturalDecisionData> {
    CognitiveCanvasValidators.validateArchitecturalDecisionData(decisionData);
    const result = await this.executeQuery<ArchitecturalDecisionData>(
      'CREATE (ad:ArchitecturalDecision {id: $id, title: $title, description: $description, rationale: $rationale, status: $status, projectId: $projectId, createdAt: $createdAt}) RETURN ad',
      decisionData, 'ad'
    );
    if (!result) {
      throw new Error('Failed to store architectural decision');
    }
    return result;
  }

  async getArchitecturalDecision(id: string): Promise<ArchitecturalDecisionData | null> {
    return this.executeQuery('MATCH (ad:ArchitecturalDecision {id: $id}) RETURN ad', { id }, 'ad');
  }

  async getArchitecturalDecisionsByProject(projectId: string): Promise<ArchitecturalDecisionData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (ad:ArchitecturalDecision {projectId: $projectId}) RETURN ad ORDER BY ad.createdAt',
      { projectId }
    );
    if (!result || !result.records) return [];
    return result.records.map((record: any) => record.get('ad').properties);
  }

  // Create snapshot method implementation (required by base class)
  async createSnapshot(): Promise<string> {
    // This will be implemented in the main class
    throw new Error('createSnapshot must be implemented in the main CognitiveCanvas class');
  }
}