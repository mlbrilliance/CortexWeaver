import { CognitiveCanvasBase } from './base';
import { ProjectData } from './types';
import { CognitiveCanvasValidators } from './validators';

export class ProjectOperations extends CognitiveCanvasBase {
  async createProject(projectData: ProjectData): Promise<ProjectData> {
    CognitiveCanvasValidators.validateProjectData(projectData);
    const result = await this.executeQuery<ProjectData>(
      'CREATE (p:Project {id: $id, name: $name, description: $description, status: $status, createdAt: $createdAt}) RETURN p',
      projectData, 'p'
    );
    if (!result) {
      throw new Error('Failed to create project');
    }
    return result;
  }

  async getProject(id: string): Promise<ProjectData | null> {
    return this.executeQuery('MATCH (p:Project {id: $id}) RETURN p', { id }, 'p');
  }

  async updateProjectStatus(id: string, status: string): Promise<ProjectData> {
    const result = await this.executeQuery<ProjectData>(
      'MATCH (p:Project {id: $id}) SET p.status = $status, p.updatedAt = $updatedAt RETURN p',
      { id, status, updatedAt: new Date().toISOString() }, 'p'
    );
    if (!result) {
      throw new Error(`Project with id ${id} not found`);
    }
    return result;
  }

  async deleteProject(id: string): Promise<void> {
    await this.executeQuery(
      'MATCH (p:Project {id: $id}) DETACH DELETE p',
      { id }
    );
  }

  async listProjects(): Promise<ProjectData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (p:Project) RETURN p ORDER BY p.createdAt DESC'
    );
    if (!result || !result.records) return [];
    return result.records.map((record: any) => record.get('p').properties);
  }

  // Create snapshot method implementation (required by base class)
  async createSnapshot(): Promise<string> {
    // This will be implemented in the main class
    throw new Error('createSnapshot must be implemented in the main CognitiveCanvas class');
  }
}