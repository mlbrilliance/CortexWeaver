import { CognitiveCanvasBase } from './base';
import { TaskData } from './types';
import { CognitiveCanvasValidators } from './validators';

export class TaskOperations extends CognitiveCanvasBase {
  async createTask(taskData: TaskData): Promise<TaskData> {
    CognitiveCanvasValidators.validateTaskData(taskData);
    const result = await this.executeQuery<TaskData>(
      'CREATE (t:Task {id: $id, title: $title, description: $description, status: $status, priority: $priority, projectId: $projectId, createdAt: $createdAt}) RETURN t',
      taskData, 't'
    );
    if (!result) {
      throw new Error('Failed to create task');
    }
    return result;
  }

  async createTaskDependency(fromTaskId: string, toTaskId: string): Promise<void> {
    await this.executeQuery(
      'MATCH (t1:Task {id: $fromTaskId}), (t2:Task {id: $toTaskId}) CREATE (t1)-[r:DEPENDS_ON]->(t2) RETURN r',
      { fromTaskId, toTaskId }
    );
  }

  async getTasksByProject(projectId: string): Promise<TaskData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (t:Task {projectId: $projectId}) RETURN t ORDER BY t.createdAt',
      { projectId }
    );
    if (!result || !result.records) return [];
    return result.records.map((record: any) => record.get('t').properties);
  }

  async getTaskDependencies(taskId: string): Promise<TaskData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (t:Task {id: $taskId})-[:DEPENDS_ON]->(dep:Task) RETURN dep',
      { taskId }
    );
    if (!result || !result.records) return [];
    return result.records.map((record: any) => record.get('dep').properties);
  }

  async updateTaskStatus(id: string, status: string): Promise<TaskData> {
    const result = await this.executeQuery<TaskData>(
      'MATCH (t:Task {id: $id}) SET t.status = $status, t.updatedAt = $updatedAt RETURN t',
      { id, status, updatedAt: new Date().toISOString() }, 't'
    );
    if (!result) {
      throw new Error(`Task with id ${id} not found`);
    }
    return result;
  }

  async getTask(id: string): Promise<TaskData | null> {
    return this.executeQuery('MATCH (t:Task {id: $id}) RETURN t', { id }, 't');
  }

  async deleteTask(id: string): Promise<void> {
    await this.executeQuery(
      'MATCH (t:Task {id: $id}) DETACH DELETE t',
      { id }
    );
  }

  // Create snapshot method implementation (required by base class)
  async createSnapshot(): Promise<string> {
    // This will be implemented in the main class
    throw new Error('createSnapshot must be implemented in the main CognitiveCanvas class');
  }
}