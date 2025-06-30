import neo4j, { Driver, Session, Result } from 'neo4j-driver';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
}

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TaskData {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  projectId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AgentData {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  status: string;
  createdAt: string;
}

export interface PheromoneData {
  id: string;
  type: string;
  strength: number;
  context: string;
  metadata: Record<string, any>;
  createdAt: string;
  expiresAt: string;
}

export interface ArchitecturalDecisionData {
  id: string;
  title: string;
  description: string;
  rationale: string;
  status: string;
  projectId: string;
  createdAt: string;
}

export interface ContractData {
  id: string;
  name: string;
  type: 'openapi' | 'json-schema' | 'property-definition';
  version: string;
  specification: Record<string, any>;
  description?: string;
  projectId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CodeModuleData {
  id: string;
  name: string;
  filePath: string;
  type: 'function' | 'class' | 'module' | 'component';
  language: string;
  projectId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TestData {
  id: string;
  name: string;
  filePath: string;
  type: 'unit' | 'integration' | 'e2e' | 'contract';
  framework: string;
  projectId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface KnowledgeGraph {
  project: any;
  tasks: any[];
  agents: any[];
  pheromones: any[];
  decisions: any[];
  contracts: any[];
  codeModules: any[];
  tests: any[];
}

export interface SnapshotData {
  version: string;
  timestamp: string;
  metadata: {
    totalNodes: number;
    totalRelationships: number;
    nodeTypes: Record<string, number>;
  };
  nodes: Array<{
    id: string;
    labels: string[];
    properties: Record<string, any>;
  }>;
  relationships: Array<{
    id: string;
    startNode: string;
    endNode: string;
    type: string;
    properties: Record<string, any>;
  }>;
}

export class CognitiveCanvas {
  private driver: Driver;
  private autoSaveInterval?: NodeJS.Timeout;
  private snapshotsDir: string;

  constructor(config: Neo4jConfig, snapshotsDir: string = './snapshots') {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password)
    );
    this.snapshotsDir = snapshotsDir;
  }

  async initializeSchema(): Promise<void> {
    const session = this.driver.session();
    try {
      const constraints = [
        'CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
        'CREATE CONSTRAINT task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE',
        'CREATE CONSTRAINT agent_id IF NOT EXISTS FOR (a:Agent) REQUIRE a.id IS UNIQUE',
        'CREATE CONSTRAINT pheromone_id IF NOT EXISTS FOR (ph:Pheromone) REQUIRE ph.id IS UNIQUE',
        'CREATE CONSTRAINT contract_id IF NOT EXISTS FOR (c:Contract) REQUIRE c.id IS UNIQUE',
        'CREATE CONSTRAINT code_module_id IF NOT EXISTS FOR (cm:CodeModule) REQUIRE cm.id IS UNIQUE',
        'CREATE CONSTRAINT test_id IF NOT EXISTS FOR (t:Test) REQUIRE t.id IS UNIQUE'
      ];
      await Promise.all(constraints.map(constraint => session.run(constraint)));
    } finally {
      await session.close();
    }
  }

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
    return result.records.map((record: any) => record.get('t').properties);
  }

  async getTaskDependencies(taskId: string): Promise<TaskData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (t:Task {id: $taskId})-[:DEPENDS_ON]->(dep:Task) RETURN dep',
      { taskId }
    );
    return result.records.map((record: any) => record.get('dep').properties);
  }

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

  async getAgentAssignments(agentId: string): Promise<TaskData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (a:Agent {id: $agentId})<-[:ASSIGNED_TO]-(t:Task) RETURN t',
      { agentId }
    );
    return result.records.map((record: any) => record.get('t').properties);
  }

  // Pheromone System
  async createPheromone(pheromoneData: PheromoneData): Promise<PheromoneData> {
    this.validatePheromoneData(pheromoneData);
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
    return result.records.map((record: any) => record.get('ph').properties);
  }

  async cleanExpiredPheromones(): Promise<number> {
    const result = await this.executeQuery<any>(
      'MATCH (ph:Pheromone) WHERE ph.expiresAt <= $now DETACH DELETE ph',
      { now: new Date().toISOString() }
    );
    return result.summary.counters.updates().nodesDeleted;
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

  async getContractsByProject(projectId: string): Promise<ContractData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (c:Contract {projectId: $projectId}) RETURN c ORDER BY c.createdAt',
      { projectId }
    );
    return result.records.map((record: any) => record.get('c').properties);
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

  async getCodeModulesByProject(projectId: string): Promise<CodeModuleData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (cm:CodeModule {projectId: $projectId}) RETURN cm ORDER BY cm.createdAt',
      { projectId }
    );
    return result.records.map((record: any) => record.get('cm').properties);
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

  async getTestsByProject(projectId: string): Promise<TestData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (t:Test {projectId: $projectId}) RETURN t ORDER BY t.createdAt',
      { projectId }
    );
    return result.records.map((record: any) => record.get('t').properties);
  }

  // Contract Relationships
  async linkContractToFeature(contractId: string, featureId: string): Promise<void> {
    await this.executeQuery(
      'MATCH (c:Contract {id: $contractId}), (f:Task {id: $featureId}) CREATE (c)-[r:DEFINES {linkedAt: $linkedAt}]->(f) RETURN r',
      { contractId, featureId, linkedAt: new Date().toISOString() }
    );
  }

  async linkContractToCodeModule(contractId: string, codeModuleId: string, relationshipType: 'IMPLEMENTS' | 'USES' = 'IMPLEMENTS'): Promise<void> {
    await this.executeQuery(
      `MATCH (c:Contract {id: $contractId}), (cm:CodeModule {id: $codeModuleId}) CREATE (cm)-[r:${relationshipType} {linkedAt: $linkedAt}]->(c) RETURN r`,
      { contractId, codeModuleId, linkedAt: new Date().toISOString() }
    );
  }

  async linkContractToTest(contractId: string, testId: string, relationshipType: 'VALIDATES' | 'TESTS' = 'VALIDATES'): Promise<void> {
    await this.executeQuery(
      `MATCH (c:Contract {id: $contractId}), (t:Test {id: $testId}) CREATE (t)-[r:${relationshipType} {linkedAt: $linkedAt}]->(c) RETURN r`,
      { contractId, testId, linkedAt: new Date().toISOString() }
    );
  }

  async linkCodeModuleToTest(codeModuleId: string, testId: string): Promise<void> {
    await this.executeQuery(
      'MATCH (cm:CodeModule {id: $codeModuleId}), (t:Test {id: $testId}) CREATE (t)-[r:TESTS {linkedAt: $linkedAt}]->(cm) RETURN r',
      { codeModuleId, testId, linkedAt: new Date().toISOString() }
    );
  }

  // OpenAPI Endpoint Specific Relationships
  async linkOpenAPIEndpointToFunction(contractId: string, endpointPath: string, httpMethod: string, codeModuleId: string, functionName: string): Promise<void> {
    await this.executeQuery(
      'MATCH (c:Contract {id: $contractId}), (cm:CodeModule {id: $codeModuleId}) CREATE (cm)-[r:IMPLEMENTS_ENDPOINT {endpointPath: $endpointPath, httpMethod: $httpMethod, functionName: $functionName, linkedAt: $linkedAt}]->(c) RETURN r',
      { contractId, endpointPath, httpMethod, codeModuleId, functionName, linkedAt: new Date().toISOString() }
    );
  }

  async linkEndpointToTest(contractId: string, endpointPath: string, httpMethod: string, testId: string): Promise<void> {
    await this.executeQuery(
      'MATCH (c:Contract {id: $contractId}), (t:Test {id: $testId}) CREATE (t)-[r:TESTS_ENDPOINT {endpointPath: $endpointPath, httpMethod: $httpMethod, linkedAt: $linkedAt}]->(c) RETURN r',
      { contractId, endpointPath, httpMethod, testId, linkedAt: new Date().toISOString() }
    );
  }

  // Contract Relationship Queries
  async getContractImplementations(contractId: string): Promise<CodeModuleData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (c:Contract {id: $contractId})<-[:IMPLEMENTS|USES]-(cm:CodeModule) RETURN cm',
      { contractId }
    );
    return result.records.map((record: any) => record.get('cm').properties);
  }

  async getContractTests(contractId: string): Promise<TestData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (c:Contract {id: $contractId})<-[:VALIDATES|TESTS|TESTS_ENDPOINT]-(t:Test) RETURN t',
      { contractId }
    );
    return result.records.map((record: any) => record.get('t').properties);
  }

  async getContractFeatures(contractId: string): Promise<TaskData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (c:Contract {id: $contractId})-[:DEFINES]->(f:Task) RETURN f',
      { contractId }
    );
    return result.records.map((record: any) => record.get('f').properties);
  }

  async getCodeModuleContracts(codeModuleId: string): Promise<ContractData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (cm:CodeModule {id: $codeModuleId})-[:IMPLEMENTS|USES]->(c:Contract) RETURN c',
      { codeModuleId }
    );
    return result.records.map((record: any) => record.get('c').properties);
  }

  async getTestContracts(testId: string): Promise<ContractData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (t:Test {id: $testId})-[:VALIDATES|TESTS|TESTS_ENDPOINT]->(c:Contract) RETURN c',
      { testId }
    );
    return result.records.map((record: any) => record.get('c').properties);
  }

  async getCodeModuleTests(codeModuleId: string): Promise<TestData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (cm:CodeModule {id: $codeModuleId})<-[:TESTS]-(t:Test) RETURN t',
      { codeModuleId }
    );
    return result.records.map((record: any) => record.get('t').properties);
  }

  // OpenAPI Endpoint Specific Queries
  async getEndpointImplementations(contractId: string, endpointPath: string, httpMethod: string): Promise<Array<{module: CodeModuleData, functionName: string}>> {
    const result = await this.executeQuery<any>(
      'MATCH (c:Contract {id: $contractId})<-[r:IMPLEMENTS_ENDPOINT {endpointPath: $endpointPath, httpMethod: $httpMethod}]-(cm:CodeModule) RETURN cm, r.functionName as functionName',
      { contractId, endpointPath, httpMethod }
    );
    return result.records.map((record: any) => ({
      module: record.get('cm').properties,
      functionName: record.get('functionName')
    }));
  }

  async getEndpointTests(contractId: string, endpointPath: string, httpMethod: string): Promise<TestData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (c:Contract {id: $contractId})<-[:TESTS_ENDPOINT {endpointPath: $endpointPath, httpMethod: $httpMethod}]-(t:Test) RETURN t',
      { contractId, endpointPath, httpMethod }
    );
    return result.records.map((record: any) => record.get('t').properties);
  }

  async getContractCoverage(contractId: string): Promise<{
    contract: ContractData | null;
    implementations: CodeModuleData[];
    tests: TestData[];
    features: TaskData[];
    endpointCoverage: Array<{
      path: string;
      method: string;
      implementations: Array<{module: CodeModuleData, functionName: string}>;
      tests: TestData[];
    }>;
  }> {
    const contract = await this.getContract(contractId);
    if (!contract) {
      throw new Error(`Contract with id ${contractId} not found`);
    }

    const [implementations, tests, features] = await Promise.all([
      this.getContractImplementations(contractId),
      this.getContractTests(contractId),
      this.getContractFeatures(contractId)
    ]);

    // For OpenAPI contracts, analyze endpoint coverage
    const endpointCoverage: Array<{
      path: string;
      method: string;
      implementations: Array<{module: CodeModuleData, functionName: string}>;
      tests: TestData[];
    }> = [];

    if (contract.type === 'openapi' && contract.specification?.paths) {
      const paths = contract.specification.paths;
      for (const [path, pathObj] of Object.entries(paths)) {
        for (const method of Object.keys(pathObj as any)) {
          const endpointImplementations = await this.getEndpointImplementations(contractId, path, method.toUpperCase());
          const endpointTests = await this.getEndpointTests(contractId, path, method.toUpperCase());
          
          endpointCoverage.push({
            path,
            method: method.toUpperCase(),
            implementations: endpointImplementations,
            tests: endpointTests
          });
        }
      }
    }

    return {
      contract,
      implementations,
      tests,
      features,
      endpointCoverage
    };
  }

  async getArchitecturalDecisionsByProject(projectId: string): Promise<ArchitecturalDecisionData[]> {
    const result = await this.executeQuery<any>(
      'MATCH (ad:ArchitecturalDecision {projectId: $projectId}) RETURN ad ORDER BY ad.createdAt DESC',
      { projectId }
    );
    return result.records.map((record: any) => record.get('ad').properties);
  }

  // Knowledge Queries
  async getProjectKnowledgeGraph(projectId: string): Promise<KnowledgeGraph> {
    const executeQuery = async (query: string) => {
      const session = this.driver.session();
      try {
        return await session.run(query, { projectId });
      } finally {
        await session.close();
      }
    };

    const [projectResult, tasksResult, agentsResult, pheromonesResult, decisionsResult, contractsResult, codeModulesResult, testsResult] = await Promise.all([
      executeQuery('MATCH (p:Project {id: $projectId}) RETURN p'),
      executeQuery('MATCH (t:Task {projectId: $projectId}) RETURN t'),
      executeQuery('MATCH (t:Task {projectId: $projectId})-[:ASSIGNED_TO]->(a:Agent) RETURN DISTINCT a'),
      executeQuery('MATCH (ph:Pheromone)-[:INFLUENCES]->(t:Task {projectId: $projectId}) RETURN DISTINCT ph'),
      executeQuery('MATCH (ad:ArchitecturalDecision {projectId: $projectId}) RETURN ad'),
      executeQuery('MATCH (c:Contract {projectId: $projectId}) RETURN c'),
      executeQuery('MATCH (cm:CodeModule {projectId: $projectId}) RETURN cm'),
      executeQuery('MATCH (t:Test {projectId: $projectId}) RETURN t')
    ]);

    return {
      project: projectResult.records[0]?.get('p').properties || null,
      tasks: tasksResult.records.map(record => record.get('t').properties),
      agents: agentsResult.records.map(record => record.get('a').properties),
      pheromones: pheromonesResult.records.map(record => record.get('ph').properties),
      decisions: decisionsResult.records.map(record => record.get('ad').properties),
      contracts: contractsResult.records.map(record => record.get('c').properties),
      codeModules: codeModulesResult.records.map(record => record.get('cm').properties),
      tests: testsResult.records.map(record => record.get('t').properties)
    };
  }

  async findSimilarTasks(taskId: string, keywords: string[]): Promise<any[]> {
    const result = await this.executeQuery<any>(
      `MATCH (t1:Task {id: $taskId}) MATCH (t2:Task) 
       WHERE t2.id <> t1.id AND (ANY(keyword IN $keywords WHERE t2.title CONTAINS keyword OR t2.description CONTAINS keyword))
       RETURN t2, SIZE([keyword IN $keywords WHERE t2.title CONTAINS keyword OR t2.description CONTAINS keyword]) * 1.0 / SIZE($keywords) AS similarity
       ORDER BY similarity DESC LIMIT 10`,
      { taskId, keywords }
    );
    return result.records.map((record: any) => ({ ...record.get('t2').properties, similarity: record.get('similarity') }));
  }

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
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    this.autoSaveInterval = setInterval(async () => {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `auto-save-${timestamp}.json`;
        const filepath = path.join(this.snapshotsDir, filename);
        await this.saveSnapshot(filepath);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 60000); // Auto-save every minute
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

  async close(): Promise<void> {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    await this.driver.close();
  }

  // Private validation methods
  private validateSnapshotFormat(snapshot: any): void {
    const required = ['version', 'timestamp', 'metadata', 'nodes', 'relationships'];
    if (!required.every(field => snapshot[field] !== undefined)) {
      throw new Error('Invalid snapshot format: missing required fields');
    }
    if (!Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.relationships)) {
      throw new Error('Invalid snapshot format: nodes and relationships must be arrays');
    }
  }

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

  private validatePheromoneData(data: any): void {
    this.validateRequiredFields(data, ['id', 'type', 'strength', 'context', 'metadata', 'createdAt', 'expiresAt'], 'pheromone');
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