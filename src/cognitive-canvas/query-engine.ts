import { Driver, Session } from 'neo4j-driver';
import { 
  TaskData, 
  AgentData, 
  ContractData, 
  CodeModuleData, 
  TestData, 
  ArchitecturalDecisionData,
  KnowledgeGraph,
  ArtifactData
} from './types';

export class QueryEngine {
  constructor(private driver: Driver) {}

  // Task Queries
  async getTasksByProject(projectId: string): Promise<TaskData[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (t:Task {projectId: $projectId}) RETURN t ORDER BY t.createdAt',
        { projectId }
      );
      return result.records.map((record: any) => record.get('t').properties);
    } finally {
      await session.close();
    }
  }

  async getTaskDependencies(taskId: string): Promise<TaskData[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (t:Task {id: $taskId})-[:DEPENDS_ON]->(dep:Task) RETURN dep',
        { taskId }
      );
      return result.records.map((record: any) => record.get('dep').properties);
    } finally {
      await session.close();
    }
  }

  async findSimilarTasks(taskId: string, keywords: string[]): Promise<any[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (t1:Task {id: $taskId}) MATCH (t2:Task) 
         WHERE t2.id <> t1.id AND (ANY(keyword IN $keywords WHERE t2.title CONTAINS keyword OR t2.description CONTAINS keyword))
         RETURN t2, SIZE([keyword IN $keywords WHERE t2.title CONTAINS keyword OR t2.description CONTAINS keyword]) * 1.0 / SIZE($keywords) AS similarity
         ORDER BY similarity DESC LIMIT 10`,
        { taskId, keywords }
      );
      return result.records.map((record: any) => ({ ...record.get('t2').properties, similarity: record.get('similarity') }));
    } finally {
      await session.close();
    }
  }

  // Agent Queries
  async getAgentAssignments(agentId: string): Promise<TaskData[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (a:Agent {id: $agentId})<-[:ASSIGNED_TO]-(t:Task) RETURN t',
        { agentId }
      );
      return result.records.map((record: any) => record.get('t').properties);
    } finally {
      await session.close();
    }
  }

  // Contract Queries
  async getContractsByProject(projectId: string): Promise<ContractData[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (c:Contract {projectId: $projectId}) RETURN c ORDER BY c.createdAt',
        { projectId }
      );
      return result.records.map((record: any) => record.get('c').properties);
    } finally {
      await session.close();
    }
  }

  async getContractImplementations(contractId: string): Promise<CodeModuleData[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (c:Contract {id: $contractId})<-[:IMPLEMENTS|USES]-(cm:CodeModule) RETURN cm',
        { contractId }
      );
      return result.records.map((record: any) => record.get('cm').properties);
    } finally {
      await session.close();
    }
  }

  async getContractTests(contractId: string): Promise<TestData[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (c:Contract {id: $contractId})<-[:VALIDATES|TESTS|TESTS_ENDPOINT]-(t:Test) RETURN t',
        { contractId }
      );
      return result.records.map((record: any) => record.get('t').properties);
    } finally {
      await session.close();
    }
  }

  async getContractFeatures(contractId: string): Promise<TaskData[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (c:Contract {id: $contractId})-[:DEFINES]->(f:Task) RETURN f',
        { contractId }
      );
      return result.records.map((record: any) => record.get('f').properties);
    } finally {
      await session.close();
    }
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
    const session = this.driver.session();
    try {
      // Get contract
      const contractResult = await session.run('MATCH (c:Contract {id: $contractId}) RETURN c', { contractId });
      const contract = contractResult.records.length > 0 ? contractResult.records[0].get('c').properties : null;
      
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
    } finally {
      await session.close();
    }
  }

  // Code Module Queries
  async getCodeModulesByProject(projectId: string): Promise<CodeModuleData[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (cm:CodeModule {projectId: $projectId}) RETURN cm ORDER BY cm.createdAt',
        { projectId }
      );
      return result.records.map((record: any) => record.get('cm').properties);
    } finally {
      await session.close();
    }
  }

  async getCodeModuleContracts(codeModuleId: string): Promise<ContractData[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (cm:CodeModule {id: $codeModuleId})-[:IMPLEMENTS|USES]->(c:Contract) RETURN c',
        { codeModuleId }
      );
      return result.records.map((record: any) => record.get('c').properties);
    } finally {
      await session.close();
    }
  }

  async getCodeModuleTests(codeModuleId: string): Promise<TestData[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (cm:CodeModule {id: $codeModuleId})<-[:TESTS]-(t:Test) RETURN t',
        { codeModuleId }
      );
      return result.records.map((record: any) => record.get('t').properties);
    } finally {
      await session.close();
    }
  }

  // Test Queries
  async getTestsByProject(projectId: string): Promise<TestData[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (t:Test {projectId: $projectId}) RETURN t ORDER BY t.createdAt',
        { projectId }
      );
      return result.records.map((record: any) => record.get('t').properties);
    } finally {
      await session.close();
    }
  }

  async getTestContracts(testId: string): Promise<ContractData[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (t:Test {id: $testId})-[:VALIDATES|TESTS|TESTS_ENDPOINT]->(c:Contract) RETURN c',
        { testId }
      );
      return result.records.map((record: any) => record.get('c').properties);
    } finally {
      await session.close();
    }
  }

  // Architectural Decisions
  async getArchitecturalDecisionsByProject(projectId: string): Promise<ArchitecturalDecisionData[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (ad:ArchitecturalDecision {projectId: $projectId}) RETURN ad ORDER BY ad.createdAt DESC',
        { projectId }
      );
      return result.records.map((record: any) => record.get('ad').properties);
    } finally {
      await session.close();
    }
  }

  // OpenAPI Specific Queries
  async getEndpointImplementations(contractId: string, endpointPath: string, httpMethod: string): Promise<Array<{module: CodeModuleData, functionName: string}>> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (c:Contract {id: $contractId})<-[r:IMPLEMENTS_ENDPOINT {endpointPath: $endpointPath, httpMethod: $httpMethod}]-(cm:CodeModule) RETURN cm, r.functionName as functionName',
        { contractId, endpointPath, httpMethod }
      );
      return result.records.map((record: any) => ({
        module: record.get('cm').properties,
        functionName: record.get('functionName')
      }));
    } finally {
      await session.close();
    }
  }

  async getEndpointTests(contractId: string, endpointPath: string, httpMethod: string): Promise<TestData[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (c:Contract {id: $contractId})<-[:TESTS_ENDPOINT {endpointPath: $endpointPath, httpMethod: $httpMethod}]-(t:Test) RETURN t',
        { contractId, endpointPath, httpMethod }
      );
      return result.records.map((record: any) => record.get('t').properties);
    } finally {
      await session.close();
    }
  }

  // Knowledge Graph
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

  // Artifact Queries
  async getArtifactsByTask(taskId: string): Promise<ArtifactData[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (t:Task {id: $taskId})-[:HAS_ARTIFACT]->(a:Artifact)
        RETURN a
        ORDER BY a.createdAt ASC
      `, { taskId });

      return result.records.map(record => record.get('a').properties as ArtifactData);
    } finally {
      await session.close();
    }
  }

  // Relationship Creation Methods
  async linkContractToFeature(contractId: string, featureId: string): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        'MATCH (c:Contract {id: $contractId}), (f:Task {id: $featureId}) CREATE (c)-[r:DEFINES {linkedAt: $linkedAt}]->(f) RETURN r',
        { contractId, featureId, linkedAt: new Date().toISOString() }
      );
    } finally {
      await session.close();
    }
  }

  async linkContractToCodeModule(contractId: string, codeModuleId: string, relationshipType: 'IMPLEMENTS' | 'USES' = 'IMPLEMENTS'): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (c:Contract {id: $contractId}), (cm:CodeModule {id: $codeModuleId}) CREATE (cm)-[r:${relationshipType} {linkedAt: $linkedAt}]->(c) RETURN r`,
        { contractId, codeModuleId, linkedAt: new Date().toISOString() }
      );
    } finally {
      await session.close();
    }
  }

  async linkContractToTest(contractId: string, testId: string, relationshipType: 'VALIDATES' | 'TESTS' = 'VALIDATES'): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (c:Contract {id: $contractId}), (t:Test {id: $testId}) CREATE (t)-[r:${relationshipType} {linkedAt: $linkedAt}]->(c) RETURN r`,
        { contractId, testId, linkedAt: new Date().toISOString() }
      );
    } finally {
      await session.close();
    }
  }

  async linkCodeModuleToTest(codeModuleId: string, testId: string): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        'MATCH (cm:CodeModule {id: $codeModuleId}), (t:Test {id: $testId}) CREATE (t)-[r:TESTS {linkedAt: $linkedAt}]->(cm) RETURN r',
        { codeModuleId, testId, linkedAt: new Date().toISOString() }
      );
    } finally {
      await session.close();
    }
  }

  async linkOpenAPIEndpointToFunction(contractId: string, endpointPath: string, httpMethod: string, codeModuleId: string, functionName: string): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        'MATCH (c:Contract {id: $contractId}), (cm:CodeModule {id: $codeModuleId}) CREATE (cm)-[r:IMPLEMENTS_ENDPOINT {endpointPath: $endpointPath, httpMethod: $httpMethod, functionName: $functionName, linkedAt: $linkedAt}]->(c) RETURN r',
        { contractId, endpointPath, httpMethod, codeModuleId, functionName, linkedAt: new Date().toISOString() }
      );
    } finally {
      await session.close();
    }
  }

  async linkEndpointToTest(contractId: string, endpointPath: string, httpMethod: string, testId: string): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        'MATCH (c:Contract {id: $contractId}), (t:Test {id: $testId}) CREATE (t)-[r:TESTS_ENDPOINT {endpointPath: $endpointPath, httpMethod: $httpMethod, linkedAt: $linkedAt}]->(c) RETURN r',
        { contractId, endpointPath, httpMethod, testId, linkedAt: new Date().toISOString() }
      );
    } finally {
      await session.close();
    }
  }
}