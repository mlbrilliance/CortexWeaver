import { Driver, Transaction, ManagedTransaction } from 'neo4j-driver';
import { 
  TaskData, 
  AgentData, 
  ContractData, 
  CodeModuleData, 
  TestData, 
  ArchitecturalDecisionData,
  KnowledgeGraph,
  ArtifactData
} from './types.js';
import { TransactionManager } from './transaction/transaction-manager.js';

export class QueryEngine {
  private transactionManager: TransactionManager;

  constructor(private driver: Driver, sharedTransactionManager?: TransactionManager) {
    this.transactionManager = sharedTransactionManager || new TransactionManager(driver);
  }

  private async executeReadQuery<T>(
    query: string, 
    params: any = {}
  ): Promise<T[]> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(query, params);
        return queryResult.records.map((record: any) => {
          const values = Array.from(record.values());
          const firstValue = values[0];
          return (firstValue && typeof firstValue === 'object' && 'properties' in firstValue) ? firstValue.properties : firstValue;
        }) as T[];
      }
    );
    return result.data;
  }

  private async executeReadSingleQuery<T>(
    query: string, 
    params: any = {},
    returnKey?: string
  ): Promise<T | null> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(query, params);
        if (queryResult.records.length === 0) return null;
        
        if (returnKey) {
          return queryResult.records[0].get(returnKey)?.properties || queryResult.records[0].get(returnKey);
        }
        
        const values = Array.from(queryResult.records[0].values());
        const firstValue = values[0];
        return (firstValue && typeof firstValue === 'object' && 'properties' in firstValue) ? firstValue.properties : firstValue;
      }
    );
    return result.data;
  }

  // Task Queries with Transaction Safety
  async getTasksByProject(projectId: string): Promise<TaskData[]> {
    return this.executeReadQuery<TaskData>(
      'MATCH (t:Task {projectId: $projectId}) RETURN t ORDER BY t.createdAt',
      { projectId }
    );
  }

  async getTaskDependencies(taskId: string): Promise<TaskData[]> {
    return this.executeReadQuery<TaskData>(
      'MATCH (t:Task {id: $taskId})-[:DEPENDS_ON]->(dep:Task) RETURN dep',
      { taskId }
    );
  }

  async findSimilarTasks(taskId: string, keywords: string[]): Promise<any[]> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(
          `MATCH (t1:Task {id: $taskId}) MATCH (t2:Task) 
           WHERE t2.id <> t1.id AND (ANY(keyword IN $keywords WHERE t2.title CONTAINS keyword OR t2.description CONTAINS keyword))
           RETURN t2, SIZE([keyword IN $keywords WHERE t2.title CONTAINS keyword OR t2.description CONTAINS keyword]) * 1.0 / SIZE($keywords) AS similarity
           ORDER BY similarity DESC LIMIT 10`,
          { taskId, keywords }
        );
        return queryResult.records.map((record: any) => ({
          ...record.get('t2').properties,
          similarity: record.get('similarity')
        }));
      }
    );
    return result.data;
  }

  // Agent Queries
  async getAgentAssignments(agentId: string): Promise<TaskData[]> {
    return this.executeReadQuery<TaskData>(
      'MATCH (a:Agent {id: $agentId})<-[:ASSIGNED_TO]-(t:Task) RETURN t',
      { agentId }
    );
  }

  // Contract Queries
  async getContractsByProject(projectId: string): Promise<ContractData[]> {
    return this.executeReadQuery<ContractData>(
      'MATCH (c:Contract {projectId: $projectId}) RETURN c ORDER BY c.createdAt',
      { projectId }
    );
  }

  async getContractImplementations(contractId: string): Promise<CodeModuleData[]> {
    return this.executeReadQuery<CodeModuleData>(
      'MATCH (c:Contract {id: $contractId})<-[:IMPLEMENTS|USES]-(cm:CodeModule) RETURN cm',
      { contractId }
    );
  }

  async getContractTests(contractId: string): Promise<TestData[]> {
    return this.executeReadQuery<TestData>(
      'MATCH (c:Contract {id: $contractId})<-[:VALIDATES|TESTS|TESTS_ENDPOINT]-(t:Test) RETURN t',
      { contractId }
    );
  }

  async getContractFeatures(contractId: string): Promise<TaskData[]> {
    return this.executeReadQuery<TaskData>(
      'MATCH (c:Contract {id: $contractId})-[:DEFINES]->(f:Task) RETURN f',
      { contractId }
    );
  }

  // FIXED: Contract Coverage with Proper Transaction Management
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
    // Use single transaction for all related data
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        // Get contract
        const contractResult = await tx.run('MATCH (c:Contract {id: $contractId}) RETURN c', { contractId });
        const contract = contractResult.records.length > 0 ? contractResult.records[0].get('c').properties : null;
        
        if (!contract) {
          throw new Error(`Contract with id ${contractId} not found`);
        }

        // Get all related data in single transaction
        const [implResult, testResult, featureResult] = await Promise.all([
          tx.run('MATCH (c:Contract {id: $contractId})<-[:IMPLEMENTS|USES]-(cm:CodeModule) RETURN cm', { contractId }),
          tx.run('MATCH (c:Contract {id: $contractId})<-[:VALIDATES|TESTS|TESTS_ENDPOINT]-(t:Test) RETURN t', { contractId }),
          tx.run('MATCH (c:Contract {id: $contractId})-[:DEFINES]->(f:Task) RETURN f', { contractId })
        ]);

        const implementations = implResult.records.map((record: any) => record.get('cm').properties);
        const tests = testResult.records.map((record: any) => record.get('t').properties);
        const features = featureResult.records.map((record: any) => record.get('f').properties);

        // For OpenAPI contracts, analyze endpoint coverage within same transaction
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
              // Query endpoint implementations and tests within same transaction
              const [endpointImplResult, endpointTestResult] = await Promise.all([
                tx.run(
                  `MATCH (c:Contract {id: $contractId})<-[:IMPLEMENTS]-(cm:CodeModule)-[:IMPLEMENTS_ENDPOINT {path: $path, method: $method}]->(:Endpoint)
                   RETURN cm, cm.functionName AS functionName`,
                  { contractId, path, method: method.toUpperCase() }
                ),
                tx.run(
                  `MATCH (c:Contract {id: $contractId})<-[:TESTS_ENDPOINT {path: $path, method: $method}]-(t:Test)
                   RETURN t`,
                  { contractId, path, method: method.toUpperCase() }
                )
              ]);

              const endpointImplementations = endpointImplResult.records.map((record: any) => ({
                module: record.get('cm').properties,
                functionName: record.get('functionName') || 'unknown'
              }));

              const endpointTests = endpointTestResult.records.map((record: any) => record.get('t').properties);
              
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
    );

    return result.data;
  }

  // Code Module Queries
  async getCodeModulesByProject(projectId: string): Promise<CodeModuleData[]> {
    return this.executeReadQuery<CodeModuleData>(
      'MATCH (cm:CodeModule {projectId: $projectId}) RETURN cm ORDER BY cm.createdAt',
      { projectId }
    );
  }

  async getCodeModuleContracts(moduleId: string): Promise<ContractData[]> {
    return this.executeReadQuery<ContractData>(
      'MATCH (cm:CodeModule {id: $moduleId})-[:IMPLEMENTS|USES]->(c:Contract) RETURN c',
      { moduleId }
    );
  }

  async getCodeModuleTests(moduleId: string): Promise<TestData[]> {
    return this.executeReadQuery<TestData>(
      'MATCH (cm:CodeModule {id: $moduleId})<-[:TESTS]-(t:Test) RETURN t',
      { moduleId }
    );
  }

  // Test Queries
  async getTestsByProject(projectId: string): Promise<TestData[]> {
    return this.executeReadQuery<TestData>(
      'MATCH (t:Test {projectId: $projectId}) RETURN t ORDER BY t.createdAt',
      { projectId }
    );
  }

  async getTestContracts(testId: string): Promise<ContractData[]> {
    return this.executeReadQuery<ContractData>(
      'MATCH (t:Test {id: $testId})-[:VALIDATES|TESTS|TESTS_ENDPOINT]->(c:Contract) RETURN c',
      { testId }
    );
  }

  // Architectural Decision Queries
  async getArchitecturalDecisionsByProject(projectId: string): Promise<ArchitecturalDecisionData[]> {
    return this.executeReadQuery<ArchitecturalDecisionData>(
      'MATCH (ad:ArchitecturalDecision {projectId: $projectId}) RETURN ad ORDER BY ad.createdAt',
      { projectId }
    );
  }

  // Endpoint-specific queries
  async getEndpointImplementations(contractId: string, path: string, method: string): Promise<Array<{module: CodeModuleData, functionName: string}>> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(
          `MATCH (c:Contract {id: $contractId})<-[:IMPLEMENTS]-(cm:CodeModule)-[:IMPLEMENTS_ENDPOINT {path: $path, method: $method}]->(:Endpoint)
           RETURN cm, cm.functionName AS functionName`,
          { contractId, path, method }
        );
        return queryResult.records.map((record: any) => ({
          module: record.get('cm').properties,
          functionName: record.get('functionName') || 'unknown'
        }));
      }
    );
    return result.data;
  }

  async getEndpointTests(contractId: string, path: string, method: string): Promise<TestData[]> {
    return this.executeReadQuery<TestData>(
      `MATCH (c:Contract {id: $contractId})<-[:TESTS_ENDPOINT {path: $path, method: $method}]-(t:Test)
       RETURN t`,
      { contractId, path, method }
    );
  }

  // FIXED: Project Knowledge Graph with Single Transaction
  async getProjectKnowledgeGraph(projectId: string): Promise<KnowledgeGraph> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        // Execute all queries within single transaction
        const [projectResult, tasksResult, agentsResult, pheromonesResult, 
               decisionsResult, contractsResult, codeModulesResult, testsResult] = await Promise.all([
          tx.run('MATCH (p:Project {id: $projectId}) RETURN p', { projectId }),
          tx.run('MATCH (t:Task {projectId: $projectId}) RETURN t', { projectId }),
          tx.run('MATCH (t:Task {projectId: $projectId})-[:ASSIGNED_TO]->(a:Agent) RETURN DISTINCT a', { projectId }),
          tx.run('MATCH (ph:Pheromone)-[:INFLUENCES]->(t:Task {projectId: $projectId}) RETURN DISTINCT ph', { projectId }),
          tx.run('MATCH (ad:ArchitecturalDecision {projectId: $projectId}) RETURN ad', { projectId }),
          tx.run('MATCH (c:Contract {projectId: $projectId}) RETURN c', { projectId }),
          tx.run('MATCH (cm:CodeModule {projectId: $projectId}) RETURN cm', { projectId }),
          tx.run('MATCH (t:Test {projectId: $projectId}) RETURN t', { projectId })
        ]);

        return {
          project: projectResult.records[0]?.get('p')?.properties || null,
          tasks: tasksResult.records.map((record: any) => record.get('t').properties),
          agents: agentsResult.records.map((record: any) => record.get('a').properties),
          pheromones: pheromonesResult.records.map((record: any) => record.get('ph').properties),
          architecturalDecisions: decisionsResult.records.map((record: any) => record.get('ad').properties),
          contracts: contractsResult.records.map((record: any) => record.get('c').properties),
          codeModules: codeModulesResult.records.map((record: any) => record.get('cm').properties),
          tests: testsResult.records.map((record: any) => record.get('t').properties)
        };
      }
    );

    return result.data;
  }

  // Artifact Queries
  async getArtifactsByTask(taskId: string): Promise<ArtifactData[]> {
    return this.executeReadQuery<ArtifactData>(
      'MATCH (t:Task {id: $taskId})-[:PRODUCES]->(a:Artifact) RETURN a',
      { taskId }
    );
  }

  // Link Operations using Write Transactions
  async linkContractToFeature(contractId: string, featureId: string): Promise<void> {
    await this.transactionManager.executeInWriteTransaction(async (tx: ManagedTransaction) => {
      await tx.run(
        'MATCH (c:Contract {id: $contractId}), (f:Task {id: $featureId}) CREATE (c)-[:DEFINES]->(f)',
        { contractId, featureId }
      );
      return true;
    });
  }

  async linkContractToCodeModule(contractId: string, moduleId: string): Promise<void> {
    await this.transactionManager.executeInWriteTransaction(async (tx: ManagedTransaction) => {
      await tx.run(
        'MATCH (c:Contract {id: $contractId}), (cm:CodeModule {id: $moduleId}) CREATE (cm)-[:IMPLEMENTS]->(c)',
        { contractId, moduleId }
      );
      return true;
    });
  }

  async linkContractToTest(contractId: string, testId: string): Promise<void> {
    await this.transactionManager.executeInWriteTransaction(async (tx: ManagedTransaction) => {
      await tx.run(
        'MATCH (c:Contract {id: $contractId}), (t:Test {id: $testId}) CREATE (t)-[:VALIDATES]->(c)',
        { contractId, testId }
      );
      return true;
    });
  }

  async linkCodeModuleToTest(moduleId: string, testId: string): Promise<void> {
    await this.transactionManager.executeInWriteTransaction(async (tx: ManagedTransaction) => {
      await tx.run(
        'MATCH (cm:CodeModule {id: $moduleId}), (t:Test {id: $testId}) CREATE (t)-[:TESTS]->(cm)',
        { moduleId, testId }
      );
      return true;
    });
  }

  async linkOpenAPIEndpointToFunction(contractId: string, path: string, method: string, moduleId: string, functionName: string): Promise<void> {
    await this.transactionManager.executeInWriteTransaction(async (tx: ManagedTransaction) => {
      await tx.run(
        `MATCH (c:Contract {id: $contractId}), (cm:CodeModule {id: $moduleId})
         MERGE (e:Endpoint {contractId: $contractId, path: $path, method: $method})
         CREATE (cm)-[:IMPLEMENTS_ENDPOINT {path: $path, method: $method, functionName: $functionName}]->(e)
         CREATE (e)-[:DEFINED_BY]->(c)`,
        { contractId, path, method, moduleId, functionName }
      );
      return true;
    });
  }

  async linkEndpointToTest(contractId: string, path: string, method: string, testId: string): Promise<void> {
    await this.transactionManager.executeInWriteTransaction(async (tx: ManagedTransaction) => {
      await tx.run(
        'MATCH (c:Contract {id: $contractId}), (t:Test {id: $testId}) CREATE (t)-[:TESTS_ENDPOINT {path: $path, method: $method}]->(c)',
        { contractId, path, method, testId }
      );
      return true;
    });
  }

  // Health check and metrics
  async healthCheck(): Promise<boolean> {
    return this.transactionManager.healthCheck();
  }

  getMetrics() {
    return this.transactionManager.getDetailedMetrics();
  }

  async close(): Promise<void> {
    await this.transactionManager.close();
  }
}