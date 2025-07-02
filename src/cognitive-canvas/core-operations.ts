import { Driver, Session } from 'neo4j-driver';
import { 
  ProjectData, 
  TaskData, 
  AgentData, 
  ArchitecturalDecisionData,
  ContractData,
  CodeModuleData,
  TestData,
  ArtifactData,
  FailureData,
  DiagnosticData,
  PatternData,
  PrototypeData
} from './types';

export class CoreOperations {
  constructor(private driver: Driver) {}

  private async executeQuery<T>(query: string, params: any = {}, returnKey?: string): Promise<T | null> {
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

  // Project Operations
  async createProject(projectData: ProjectData): Promise<ProjectData> {
    this.validateProjectData(projectData);
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

  // Task Operations
  async createTask(taskData: TaskData): Promise<TaskData> {
    this.validateTaskData(taskData);
    const result = await this.executeQuery<TaskData>(
      'CREATE (t:Task {id: $id, title: $title, description: $description, status: $status, priority: $priority, projectId: $projectId, createdAt: $createdAt}) RETURN t',
      taskData, 't'
    );
    if (!result) {
      throw new Error('Failed to create task');
    }
    return result;
  }

  async updateTaskStatus(taskId: string, status: string): Promise<TaskData> {
    const result = await this.executeQuery<TaskData>(
      'MATCH (t:Task {id: $id}) SET t.status = $status, t.updatedAt = $updatedAt RETURN t',
      { 
        id: taskId, 
        status, 
        updatedAt: new Date().toISOString() 
      }, 
      't'
    );
    
    if (!result) {
      throw new Error(`Task with id ${taskId} not found`);
    }
    
    return result;
  }

  async createTaskDependency(fromTaskId: string, toTaskId: string): Promise<void> {
    await this.executeQuery(
      'MATCH (t1:Task {id: $fromTaskId}), (t2:Task {id: $toTaskId}) CREATE (t1)-[r:DEPENDS_ON]->(t2) RETURN r',
      { fromTaskId, toTaskId }
    );
  }

  // Agent Operations
  async createAgent(agentData: AgentData): Promise<AgentData> {
    this.validateAgentData(agentData);
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

  // Architectural Decisions
  async storeArchitecturalDecision(decisionData: ArchitecturalDecisionData): Promise<ArchitecturalDecisionData> {
    this.validateArchitecturalDecisionData(decisionData);
    const result = await this.executeQuery<ArchitecturalDecisionData>(
      'CREATE (ad:ArchitecturalDecision {id: $id, title: $title, description: $description, rationale: $rationale, status: $status, projectId: $projectId, createdAt: $createdAt}) RETURN ad',
      decisionData, 'ad'
    );
    if (!result) {
      throw new Error('Failed to store architectural decision');
    }
    return result;
  }

  // Contract Management
  async createContract(contractData: ContractData): Promise<ContractData> {
    this.validateContractData(contractData);
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

  // Code Module Management
  async createCodeModule(moduleData: CodeModuleData): Promise<CodeModuleData> {
    this.validateCodeModuleData(moduleData);
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

  // Test Management
  async createTest(testData: TestData): Promise<TestData> {
    this.validateTestData(testData);
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

  // Prototype Management
  async createPrototypeNode(prototypeData: {
    contractId: string;
    pseudocode: string;
    flowDiagram: string;
    outputPath: string;
  }): Promise<string> {
    const id = `prototype-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();
    
    const result = await this.executeQuery<PrototypeData>(
      'CREATE (p:Prototype {id: $id, contractId: $contractId, pseudocode: $pseudocode, flowDiagram: $flowDiagram, outputPath: $outputPath, createdAt: $createdAt}) RETURN p',
      {
        id,
        contractId: prototypeData.contractId,
        pseudocode: prototypeData.pseudocode,
        flowDiagram: prototypeData.flowDiagram,
        outputPath: prototypeData.outputPath,
        createdAt
      },
      'p'
    );
    
    if (!result) {
      throw new Error('Failed to create prototype node');
    }
    
    return id;
  }

  async linkPrototypeToContract(prototypeId: string, contractId: string): Promise<void> {
    await this.executeQuery(
      'MATCH (p:Prototype {id: $prototypeId}), (c:Contract {id: $contractId}) CREATE (p)-[r:PROTOTYPES {linkedAt: $linkedAt}]->(c) RETURN r',
      { 
        prototypeId, 
        contractId, 
        linkedAt: new Date().toISOString() 
      }
    );
  }

  // Validation methods
  private validateRequiredFields(data: any, fields: string[], type: string): void {
    if (!fields.every(field => data[field] !== undefined && data[field] !== null)) {
      throw new Error(`Missing required ${type} fields: ${fields.join(', ')}`);
    }
  }

  private validateProjectData(data: any): void {
    this.validateRequiredFields(data, ['id', 'name', 'description', 'status', 'createdAt'], 'project');
  }

  private validateTaskData(data: any): void {
    this.validateRequiredFields(data, ['id', 'title', 'description', 'status', 'priority', 'projectId', 'createdAt'], 'task');
  }

  private validateAgentData(data: any): void {
    this.validateRequiredFields(data, ['id', 'name', 'role', 'capabilities', 'status', 'createdAt'], 'agent');
  }

  private validateArchitecturalDecisionData(data: any): void {
    this.validateRequiredFields(data, ['id', 'title', 'description', 'rationale', 'status', 'projectId', 'createdAt'], 'architectural decision');
  }

  private validateContractData(data: any): void {
    this.validateRequiredFields(data, ['id', 'name', 'type', 'version', 'specification', 'projectId', 'createdAt'], 'contract');
    const validTypes = ['openapi', 'json-schema', 'property-definition'];
    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid contract type: ${data.type}. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  private validateCodeModuleData(data: any): void {
    this.validateRequiredFields(data, ['id', 'name', 'filePath', 'type', 'language', 'projectId', 'createdAt'], 'code module');
    const validTypes = ['function', 'class', 'module', 'component'];
    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid code module type: ${data.type}. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  private validateTestData(data: any): void {
    this.validateRequiredFields(data, ['id', 'name', 'filePath', 'type', 'framework', 'projectId', 'createdAt'], 'test');
    const validTypes = ['unit', 'integration', 'e2e', 'contract'];
    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid test type: ${data.type}. Must be one of: ${validTypes.join(', ')}`);
    }
  }
}