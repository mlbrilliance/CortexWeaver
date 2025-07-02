import { CognitiveCanvasBase } from './base';
import { CodeModuleData, TestData } from './types';
import { CognitiveCanvasValidators } from './validators';

export class CodeOperations extends CognitiveCanvasBase {
  // Code Module Management
  async createCodeModule(moduleData: CodeModuleData): Promise<CodeModuleData> {
    CognitiveCanvasValidators.validateCodeModuleData(moduleData);
    const result = await this.executeQuery<CodeModuleData>(
      'CREATE (cm:CodeModule {id: $id, name: $name, filePath: $filePath, type: $type, language: $language, projectId: $projectId, createdAt: $createdAt}) RETURN cm',
      moduleData, 'cm'
    );
    if (!result) {
      throw new Error('Failed to create code module');
    }
    return result;
  }

  async getCodeModule(id: string): Promise<CodeModuleData | null> {
    return this.executeQuery('MATCH (cm:CodeModule {id: $id}) RETURN cm', { id }, 'cm');
  }

  async updateCodeModule(id: string, updates: Partial<CodeModuleData>): Promise<CodeModuleData> {
    const updateData = { ...updates, id, updatedAt: new Date().toISOString() };
    const result = await this.executeQuery<CodeModuleData>(
      'MATCH (cm:CodeModule {id: $id}) SET cm += $updates RETURN cm',
      { id, updates: updateData }, 'cm'
    );
    if (!result) {
      throw new Error(`Code module with id ${id} not found`);
    }
    return result;
  }

  async getCodeModulesByProject(projectId: string): Promise<CodeModuleData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (cm:CodeModule {projectId: $projectId}) RETURN cm ORDER BY cm.createdAt',
      { projectId }
    );
    if (!result || !result.records) return [];
    return result.records.map((record: any) => record.get('cm').properties);
  }

  async deleteCodeModule(id: string): Promise<void> {
    await this.executeQuery(
      'MATCH (cm:CodeModule {id: $id}) DETACH DELETE cm',
      { id }
    );
  }

  // Test Management
  async createTest(testData: TestData): Promise<TestData> {
    CognitiveCanvasValidators.validateTestData(testData);
    const result = await this.executeQuery<TestData>(
      'CREATE (t:Test {id: $id, name: $name, filePath: $filePath, type: $type, framework: $framework, projectId: $projectId, createdAt: $createdAt}) RETURN t',
      testData, 't'
    );
    if (!result) {
      throw new Error('Failed to create test');
    }
    return result;
  }

  async getTest(id: string): Promise<TestData | null> {
    return this.executeQuery('MATCH (t:Test {id: $id}) RETURN t', { id }, 't');
  }

  async updateTest(id: string, updates: Partial<TestData>): Promise<TestData> {
    const updateData = { ...updates, id, updatedAt: new Date().toISOString() };
    const result = await this.executeQuery<TestData>(
      'MATCH (t:Test {id: $id}) SET t += $updates RETURN t',
      { id, updates: updateData }, 't'
    );
    if (!result) {
      throw new Error(`Test with id ${id} not found`);
    }
    return result;
  }

  async getTestsByProject(projectId: string): Promise<TestData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (t:Test {projectId: $projectId}) RETURN t ORDER BY t.createdAt',
      { projectId }
    );
    if (!result || !result.records) return [];
    return result.records.map((record: any) => record.get('t').properties);
  }

  async deleteTest(id: string): Promise<void> {
    await this.executeQuery(
      'MATCH (t:Test {id: $id}) DETACH DELETE t',
      { id }
    );
  }

  // Code Module to Test relationships
  async linkCodeModuleToTest(codeModuleId: string, testId: string): Promise<void> {
    await this.executeQuery(
      'MATCH (cm:CodeModule {id: $codeModuleId}), (t:Test {id: $testId}) CREATE (t)-[r:TESTS {linkedAt: $linkedAt}]->(cm) RETURN r',
      { codeModuleId, testId, linkedAt: new Date().toISOString() }
    );
  }

  // Create snapshot method implementation (required by base class)
  async createSnapshot(): Promise<string> {
    // This will be implemented in the main class
    throw new Error('createSnapshot must be implemented in the main CognitiveCanvas class');
  }
}