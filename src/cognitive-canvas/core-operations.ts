import { Driver, Transaction, ManagedTransaction } from 'neo4j-driver';
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
} from './types.js';
import { TransactionManager } from './transaction/transaction-manager.js';
import { TransactionOptions, BatchOperation } from './transaction/types.js';

export class CoreOperations {
  private transactionManager: TransactionManager;

  constructor(private driver: Driver, sharedTransactionManager?: TransactionManager) {
    this.transactionManager = sharedTransactionManager || new TransactionManager(driver);
  }

  private async executeQuery<T>(
    query: string, 
    params: any = {}, 
    returnKey?: string,
    options?: TransactionOptions
  ): Promise<T | null> {
    const result = await this.transactionManager.executeInTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(query, params);
        if (!returnKey) return queryResult as T;
        if (queryResult.records.length === 0) return null;
        return queryResult.records[0].get(returnKey).properties;
      },
      options
    );
    return result.data;
  }

  private async executeReadQuery<T>(
    query: string, 
    params: any = {}, 
    returnKey?: string
  ): Promise<T | null> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(query, params);
        if (!returnKey) return queryResult as T;
        if (queryResult.records.length === 0) return null;
        return queryResult.records[0].get(returnKey).properties;
      }
    );
    return result.data;
  }

  private async executeWriteQuery<T>(
    query: string, 
    params: any = {}, 
    returnKey?: string,
    options?: TransactionOptions
  ): Promise<T | null> {
    const result = await this.transactionManager.executeInWriteTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(query, params);
        if (!returnKey) return queryResult as T;
        if (queryResult.records.length === 0) return null;
        return queryResult.records[0].get(returnKey).properties;
      },
      options
    );
    return result.data;
  }

  // Project Operations
  async createProject(projectData: ProjectData): Promise<ProjectData> {
    this.validateProjectData(projectData);
    const result = await this.executeWriteQuery<ProjectData>(
      'CREATE (p:Project {id: $id, name: $name, description: $description, status: $status, createdAt: $createdAt}) RETURN p',
      projectData, 'p'
    );
    if (!result) {
      throw new Error('Failed to create project');
    }
    return result;
  }

  async getProject(id: string): Promise<ProjectData | null> {
    return this.executeReadQuery('MATCH (p:Project {id: $id}) RETURN p', { id }, 'p');
  }

  async updateProjectStatus(id: string, status: string): Promise<ProjectData> {
    const result = await this.executeWriteQuery<ProjectData>(
      'MATCH (p:Project {id: $id}) SET p.status = $status, p.updatedAt = $updatedAt RETURN p',
      { id, status, updatedAt: new Date().toISOString() }, 'p'
    );
    if (!result) {
      throw new Error(`Project with id ${id} not found`);
    }
    return result;
  }

  // Task Operations with Transaction Safety
  async createTask(taskData: TaskData): Promise<TaskData> {
    this.validateTaskData(taskData);
    const result = await this.executeWriteQuery<TaskData>(
      'CREATE (t:Task {id: $id, title: $title, description: $description, status: $status, priority: $priority, projectId: $projectId, createdAt: $createdAt}) RETURN t',
      taskData, 't'
    );
    if (!result) {
      throw new Error('Failed to create task');
    }
    return result;
  }

  async updateTaskStatus(taskId: string, status: string): Promise<TaskData> {
    const result = await this.executeWriteQuery<TaskData>(
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
    await this.executeWriteQuery(
      'MATCH (t1:Task {id: $fromTaskId}), (t2:Task {id: $toTaskId}) CREATE (t1)-[r:DEPENDS_ON]->(t2) RETURN r',
      { fromTaskId, toTaskId }
    );
  }

  // Batch task creation for improved performance
  async createTasksBatch(tasksData: TaskData[]): Promise<TaskData[]> {
    const operations: BatchOperation[] = tasksData.map(taskData => ({
      query: 'CREATE (t:Task {id: $id, title: $title, description: $description, status: $status, priority: $priority, projectId: $projectId, createdAt: $createdAt}) RETURN t',
      params: taskData,
      operation: 'WRITE' as const,
      priority: 'HIGH' as const
    }));

    const result = await this.transactionManager.executeBatch(operations);
    return result.data.map((records: any) => records[0]?.get('t')?.properties).filter(Boolean);
  }

  // Agent Operations
  async createAgent(agentData: AgentData): Promise<AgentData> {
    this.validateAgentData(agentData);
    const result = await this.executeWriteQuery<AgentData>(
      'CREATE (a:Agent {id: $id, name: $name, role: $role, capabilities: $capabilities, status: $status, createdAt: $createdAt}) RETURN a',
      agentData, 'a'
    );
    if (!result) {
      throw new Error('Failed to create agent');
    }
    return result;
  }

  async assignAgentToTask(agentId: string, taskId: string): Promise<void> {
    // Use transaction to ensure both agent and task exist
    await this.transactionManager.executeInWriteTransaction(async (tx: ManagedTransaction) => {
      // Verify both entities exist
      const agentCheck = await tx.run('MATCH (a:Agent {id: $agentId}) RETURN a', { agentId });
      const taskCheck = await tx.run('MATCH (t:Task {id: $taskId}) RETURN t', { taskId });
      
      if (agentCheck.records.length === 0) {
        throw new Error(`Agent with id ${agentId} not found`);
      }
      if (taskCheck.records.length === 0) {
        throw new Error(`Task with id ${taskId} not found`);
      }
      
      // Create assignment relationship
      await tx.run(
        'MATCH (a:Agent {id: $agentId}), (t:Task {id: $taskId}) CREATE (t)-[r:ASSIGNED_TO {assignedAt: $assignedAt}]->(a) RETURN r',
        { agentId, taskId, assignedAt: new Date().toISOString() }
      );
      
      return true;
    });
  }

  // Architectural Decisions
  async storeArchitecturalDecision(decisionData: ArchitecturalDecisionData): Promise<ArchitecturalDecisionData> {
    this.validateArchitecturalDecisionData(decisionData);
    const result = await this.executeWriteQuery<ArchitecturalDecisionData>(
      'CREATE (ad:ArchitecturalDecision {id: $id, title: $title, description: $description, rationale: $rationale, status: $status, projectId: $projectId, createdAt: $createdAt}) RETURN ad',
      decisionData, 'ad'
    );
    if (!result) {
      throw new Error('Failed to store architectural decision');
    }
    return result;
  }

  // Contract Management with Transaction Safety
  async createContract(contractData: ContractData): Promise<ContractData> {
    this.validateContractData(contractData);
    const result = await this.executeWriteQuery<ContractData>(
      'CREATE (c:Contract {id: $id, name: $name, type: $type, version: $version, specification: $specification, description: $description, projectId: $projectId, createdAt: $createdAt}) RETURN c',
      contractData, 'c'
    );
    if (!result) {
      throw new Error('Failed to create contract');
    }
    return result;
  }

  async getContract(id: string): Promise<ContractData | null> {
    return this.executeReadQuery('MATCH (c:Contract {id: $id}) RETURN c', { id }, 'c');
  }

  async updateContract(id: string, updates: Partial<ContractData>): Promise<ContractData> {
    const updateData = { ...updates, id, updatedAt: new Date().toISOString() };
    const result = await this.executeWriteQuery<ContractData>(
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
    const result = await this.executeWriteQuery<CodeModuleData>(
      'CREATE (cm:CodeModule {id: $id, name: $name, filePath: $filePath, type: $type, language: $language, projectId: $projectId, createdAt: $createdAt}) RETURN cm',
      moduleData, 'cm'
    );
    if (!result) {
      throw new Error('Failed to create code module');
    }
    return result;
  }

  async getCodeModule(id: string): Promise<CodeModuleData | null> {
    return this.executeReadQuery('MATCH (cm:CodeModule {id: $id}) RETURN cm', { id }, 'cm');
  }

  async updateCodeModule(id: string, updates: Partial<CodeModuleData>): Promise<CodeModuleData> {
    const updateData = { ...updates, id, updatedAt: new Date().toISOString() };
    const result = await this.executeWriteQuery<CodeModuleData>(
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
    const result = await this.executeWriteQuery<TestData>(
      'CREATE (t:Test {id: $id, name: $name, filePath: $filePath, type: $type, framework: $framework, projectId: $projectId, createdAt: $createdAt}) RETURN t',
      testData, 't'
    );
    if (!result) {
      throw new Error('Failed to create test');
    }
    return result;
  }

  async getTest(id: string): Promise<TestData | null> {
    return this.executeReadQuery('MATCH (t:Test {id: $id}) RETURN t', { id }, 't');
  }

  async updateTest(id: string, updates: Partial<TestData>): Promise<TestData> {
    const updateData = { ...updates, id, updatedAt: new Date().toISOString() };
    const result = await this.executeWriteQuery<TestData>(
      'MATCH (t:Test {id: $id}) SET t += $updates RETURN t',
      { id, updates: updateData }, 't'
    );
    if (!result) {
      throw new Error(`Test with id ${id} not found`);
    }
    return result;
  }

  // Prototype Management with improved transaction safety
  async createPrototypeNode(prototypeData: {
    contractId: string;
    pseudocode: string;
    flowDiagram: string;
    outputPath: string;
  }): Promise<string> {
    const id = `prototype-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();
    
    const result = await this.transactionManager.executeInWriteTransaction(async (tx: ManagedTransaction) => {
      // Verify contract exists
      const contractCheck = await tx.run('MATCH (c:Contract {id: $contractId}) RETURN c', { contractId: prototypeData.contractId });
      if (contractCheck.records.length === 0) {
        throw new Error(`Contract with id ${prototypeData.contractId} not found`);
      }
      
      // Create prototype node
      const result = await tx.run(
        'CREATE (p:Prototype {id: $id, contractId: $contractId, pseudocode: $pseudocode, flowDiagram: $flowDiagram, outputPath: $outputPath, createdAt: $createdAt}) RETURN p',
        {
          id,
          contractId: prototypeData.contractId,
          pseudocode: prototypeData.pseudocode,
          flowDiagram: prototypeData.flowDiagram,
          outputPath: prototypeData.outputPath,
          createdAt
        }
      );
      
      if (result.records.length === 0) {
        throw new Error('Failed to create prototype node');
      }
      
      return id;
    });
    
    return result.data;
  }

  async linkPrototypeToContract(prototypeId: string, contractId: string): Promise<void> {
    await this.transactionManager.executeInWriteTransaction(async (tx: ManagedTransaction) => {
      // Verify both entities exist
      const prototypeCheck = await tx.run('MATCH (p:Prototype {id: $prototypeId}) RETURN p', { prototypeId });
      const contractCheck = await tx.run('MATCH (c:Contract {id: $contractId}) RETURN c', { contractId });
      
      if (prototypeCheck.records.length === 0) {
        throw new Error(`Prototype with id ${prototypeId} not found`);
      }
      if (contractCheck.records.length === 0) {
        throw new Error(`Contract with id ${contractId} not found`);
      }
      
      // Create link
      await tx.run(
        'MATCH (p:Prototype {id: $prototypeId}), (c:Contract {id: $contractId}) CREATE (p)-[r:PROTOTYPES {linkedAt: $linkedAt}]->(c) RETURN r',
        { 
          prototypeId, 
          contractId, 
          linkedAt: new Date().toISOString() 
        }
      );
      
      return true;
    });
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

  // Transaction Manager access for advanced operations
  getTransactionManager(): TransactionManager {
    return this.transactionManager;
  }

  // Project management operations
  async getAllProjects(): Promise<ProjectData[]> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(
          'MATCH (p:Project) RETURN p ORDER BY p.createdAt DESC'
        );
        return queryResult.records.map(record => record.get('p').properties);
      }
    );
    return result.data;
  }

  async getProjectCount(): Promise<number> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run('MATCH (p:Project) RETURN count(p) as count');
        return queryResult.records[0].get('count').toNumber();
      }
    );
    return result.data;
  }

  async getTasksByProject(projectId: string): Promise<TaskData[]> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(
          'MATCH (t:Task {projectId: $projectId}) RETURN t ORDER BY t.createdAt',
          { projectId }
        );
        return queryResult.records.map(record => record.get('t').properties);
      }
    );
    return result.data;
  }

  async getAgentsByProject(projectId: string): Promise<AgentData[]> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(
          `MATCH (p:Project {id: $projectId})<-[:*]-(a:Agent) 
           RETURN DISTINCT a ORDER BY a.createdAt`,
          { projectId }
        );
        return queryResult.records.map(record => record.get('a').properties);
      }
    );
    return result.data;
  }

  async getTasksWithStatus(status?: string): Promise<TaskData[]> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        let query = 'MATCH (t:Task)';
        let params = {};
        
        if (status) {
          query += ' WHERE t.status = $status';
          params = { status };
        }
        
        query += ' RETURN t ORDER BY t.createdAt DESC';
        
        const queryResult = await tx.run(query, params);
        return queryResult.records.map(record => record.get('t').properties);
      }
    );
    return result.data;
  }

  async getAgentsWithStatus(status?: string): Promise<AgentData[]> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        let query = 'MATCH (a:Agent)';
        let params = {};
        
        if (status) {
          query += ' WHERE a.status = $status';
          params = { status };
        }
        
        query += ' RETURN a ORDER BY a.createdAt DESC';
        
        const queryResult = await tx.run(query, params);
        return queryResult.records.map(record => record.get('a').properties);
      }
    );
    return result.data;
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    return this.transactionManager.healthCheck();
  }

  // Metrics access
  getMetrics() {
    return this.transactionManager.getDetailedMetrics();
  }

  // Cleanup method
  async close(): Promise<void> {
    await this.transactionManager.close();
  }
}