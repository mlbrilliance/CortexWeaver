import neo4j, { Driver } from 'neo4j-driver';
import { TransactionManager } from './transaction/transaction-manager.js';
import { StorageManager } from '../storage/index.js';
import { Neo4jConfig } from './types';
import { CoreOperations } from './core-operations';
import { QueryEngine } from './query-engine';
import { PheromoneManager } from './pheromone-manager';
import { AgentIntegration } from './agent-integration';
import { Persistence } from './persistence';

export class CognitiveCanvas {
  private driver: Driver | null = null;
  private autoSaveInterval?: NodeJS.Timeout;
  private snapshotsDir: string;

  // Modular components
  private coreOps!: CoreOperations;
  private queryEngine!: QueryEngine;
  private pheromoneManager!: PheromoneManager;
  private agentIntegration!: AgentIntegration;
  private persistence!: Persistence;

  // Core Operations methods
  createProject!: CoreOperations['createProject'];
  getProject!: CoreOperations['getProject'];
  getAllProjects!: CoreOperations['getAllProjects'];
  getProjectCount!: CoreOperations['getProjectCount'];
  updateProjectStatus!: CoreOperations['updateProjectStatus'];
  createTask!: CoreOperations['createTask'];
  updateTaskStatus!: CoreOperations['updateTaskStatus'];
  createTaskDependency!: CoreOperations['createTaskDependency'];
  createAgent!: CoreOperations['createAgent'];
  getTasksWithStatus!: CoreOperations['getTasksWithStatus'];
  getAgentsWithStatus!: CoreOperations['getAgentsWithStatus'];
  getTasksByProject!: CoreOperations['getTasksByProject'];
  getAgentsByProject!: CoreOperations['getAgentsByProject'];
  assignAgentToTask!: CoreOperations['assignAgentToTask'];
  storeArchitecturalDecision!: CoreOperations['storeArchitecturalDecision'];
  createContract!: CoreOperations['createContract'];
  getContract!: CoreOperations['getContract'];
  updateContract!: CoreOperations['updateContract'];
  createCodeModule!: CoreOperations['createCodeModule'];
  getCodeModule!: CoreOperations['getCodeModule'];
  updateCodeModule!: CoreOperations['updateCodeModule'];
  createTest!: CoreOperations['createTest'];
  getTest!: CoreOperations['getTest'];
  updateTest!: CoreOperations['updateTest'];
  createPrototypeNode!: CoreOperations['createPrototypeNode'];
  linkPrototypeToContract!: CoreOperations['linkPrototypeToContract'];

  // Query Engine methods
  getTaskDependencies!: QueryEngine['getTaskDependencies'];
  findSimilarTasks!: QueryEngine['findSimilarTasks'];
  getAgentAssignments!: QueryEngine['getAgentAssignments'];
  getContractsByProject!: QueryEngine['getContractsByProject'];
  getContractImplementations!: QueryEngine['getContractImplementations'];
  getContractTests!: QueryEngine['getContractTests'];
  getContractFeatures!: QueryEngine['getContractFeatures'];
  getContractCoverage!: QueryEngine['getContractCoverage'];
  getCodeModulesByProject!: QueryEngine['getCodeModulesByProject'];
  getCodeModuleContracts!: QueryEngine['getCodeModuleContracts'];
  getCodeModuleTests!: QueryEngine['getCodeModuleTests'];
  getTestsByProject!: QueryEngine['getTestsByProject'];
  getTestContracts!: QueryEngine['getTestContracts'];
  getArchitecturalDecisionsByProject!: QueryEngine['getArchitecturalDecisionsByProject'];
  getEndpointImplementations!: QueryEngine['getEndpointImplementations'];
  getEndpointTests!: QueryEngine['getEndpointTests'];
  getProjectKnowledgeGraph!: QueryEngine['getProjectKnowledgeGraph'];
  getArtifactsByTask!: QueryEngine['getArtifactsByTask'];
  linkContractToFeature!: QueryEngine['linkContractToFeature'];
  linkContractToCodeModule!: QueryEngine['linkContractToCodeModule'];
  linkContractToTest!: QueryEngine['linkContractToTest'];
  linkCodeModuleToTest!: QueryEngine['linkCodeModuleToTest'];
  linkOpenAPIEndpointToFunction!: QueryEngine['linkOpenAPIEndpointToFunction'];
  linkEndpointToTest!: QueryEngine['linkEndpointToTest'];

  // Pheromone Manager methods
  createPheromone!: PheromoneManager['createPheromone'];
  createGuidePheromone!: PheromoneManager['createGuidePheromone'];
  createWarnPheromone!: PheromoneManager['createWarnPheromone'];
  queryPheromones!: PheromoneManager['queryPheromones'];
  linkPheromoneToTask!: PheromoneManager['linkPheromoneToTask'];
  getPheromonesByType!: PheromoneManager['getPheromonesByType'];
  getContextPheromones!: PheromoneManager['getContextPheromones'];
  analyzePatternCorrelations!: PheromoneManager['analyzePatternCorrelations'];
  analyzeTemporalPatterns!: PheromoneManager['analyzeTemporalPatterns'];
  getPheromoneAnalysis!: PheromoneManager['getPheromoneAnalysis'];
  applyPheromoneDecay!: PheromoneManager['applyPheromoneDecay'];
  cleanExpiredPheromones!: PheromoneManager['cleanExpiredPheromones'];

  // Agent Integration methods
  getArtifactDetails!: AgentIntegration['getArtifactDetails'];
  createCritiqueNode!: AgentIntegration['createCritiqueNode'];
  linkCritiqueToArtifact!: AgentIntegration['linkCritiqueToArtifact'];
  getFailureById!: AgentIntegration['getFailureById'];
  getRelatedArtifacts!: AgentIntegration['getRelatedArtifacts'];
  createDiagnosticNode!: AgentIntegration['createDiagnosticNode'];
  linkDiagnosticToFailure!: AgentIntegration['linkDiagnosticToFailure'];
  getFailureHistory!: AgentIntegration['getFailureHistory'];
  getAgentInteractions!: AgentIntegration['getAgentInteractions'];
  getTaskDetails!: AgentIntegration['getTaskDetails'];
  getRelatedKnowledge!: AgentIntegration['getRelatedKnowledge'];
  createKnowledgeExtraction!: AgentIntegration['createKnowledgeExtraction'];
  getProjectContext!: AgentIntegration['getProjectContext'];
  linkKnowledgeToTask!: AgentIntegration['linkKnowledgeToTask'];
  updatePheromoneStrengths!: AgentIntegration['updatePheromoneStrengths'];
  getProjectKnowledge!: AgentIntegration['getProjectKnowledge'];
  validateKnowledgeConsistency!: AgentIntegration['validateKnowledgeConsistency'];
  identifyKnowledgeGaps!: AgentIntegration['identifyKnowledgeGaps'];
  updateProjectMetrics!: AgentIntegration['updateProjectMetrics'];
  createKnowledgeEntry!: AgentIntegration['createKnowledgeEntry'];
  getKnowledgeEntriesByType!: AgentIntegration['getKnowledgeEntriesByType'];
  getKnowledgeEntriesByQuery!: AgentIntegration['getKnowledgeEntriesByQuery'];
  storeFailure!: AgentIntegration['storeFailure'];
  getTaskRetryCount!: AgentIntegration['getTaskRetryCount'];
  storeEscalatedError!: AgentIntegration['storeEscalatedError'];

  // Persistence methods
  saveSnapshot!: Persistence['saveSnapshot'];
  loadSnapshot!: Persistence['loadSnapshot'];
  listSnapshots!: Persistence['listSnapshots'];
  restoreFromSnapshot!: Persistence['restoreFromSnapshot'];

  // Constructor overloads for backward compatibility and new storage system
  constructor(configOrStorage: Neo4jConfig | StorageManager, snapshotsDir: string = './snapshots') {
    this.snapshotsDir = snapshotsDir;

    if (configOrStorage instanceof StorageManager) {
      // New storage-based initialization
      this.initializeWithStorageManager(configOrStorage);
    } else {
      // Legacy Neo4j config initialization
      this.initializeWithNeo4jConfig(configOrStorage);
    }

    // Bind methods after components are initialized
    this.bindMethods();
  }

  private initializeWithStorageManager(storageManager: StorageManager): void {
    // For storage manager, we don't need a direct driver
    // Components will use the storage abstraction
    this.driver = null as any; // Will be deprecated
    
    // Create storage-aware implementations
    this.coreOps = this.createStorageAwareCoreOps(storageManager);
    this.queryEngine = {} as QueryEngine; // TODO: Implement
    this.pheromoneManager = {} as PheromoneManager; // TODO: Implement
    this.agentIntegration = {} as AgentIntegration; // TODO: Implement
    this.persistence = {} as Persistence; // TODO: Implement
  }

  private createStorageAwareCoreOps(storageManager: StorageManager): any {
    return {
      createProject: async (projectData: any) => {
        // Delegate to storage manager
        const result = await storageManager.executeQuery(
          `CREATE (p:Project {id: $id, name: $name, description: $description, status: $status, createdAt: $createdAt}) RETURN p`,
          projectData
        );
        return { id: projectData.id, ...projectData };
      },
      getProject: async (id: string) => {
        const result = await storageManager.executeQuery(
          `MATCH (p:Project {id: $id}) RETURN p`,
          { id }
        );
        // Handle both Neo4j-style and storage abstraction results
        if ((result.data as any)?.records?.[0]) {
          const record = (result.data as any).records[0];
          // Check if this is a Neo4j-style record with .get() method
          if (typeof record.get === 'function') {
            return record.get('p').properties;
          }
          // Storage abstraction record - return properties directly
          return record.properties || record;
        }
        return result.data;
      },
      getAllProjects: async () => {
        const result = await storageManager.executeQuery(`MATCH (p:Project) RETURN p`);
        // Handle both Neo4j-style and storage abstraction results
        if ((result.data as any)?.records) {
          return (result.data as any).records.map((r: any) => {
            // Check if this is a Neo4j-style record with .get() method
            if (typeof r.get === 'function') {
              return r.get('p').properties;
            }
            // Storage abstraction record - return properties directly
            return r.properties || r;
          });
        }
        // Storage abstraction result
        return Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
      },
      getProjectCount: async () => {
        const result = await storageManager.executeQuery(`MATCH (p:Project) RETURN count(p) as count`);
        // Handle both Neo4j-style and storage abstraction results
        return (result.data as any)?.records?.[0]?.get?.('count')?.toNumber?.() || (result.data as any)?.count || 0;
      },
      updateProjectStatus: async (id: string, status: string) => {
        await storageManager.executeQuery(
          `MATCH (p:Project {id: $id}) SET p.status = $status`,
          { id, status }
        );
        return true;
      },
      createTask: async (taskData: any) => {
        const result = await storageManager.executeQuery(
          `CREATE (t:Task {id: $id, title: $title, description: $description, status: $status, priority: $priority, projectId: $projectId, createdAt: $createdAt}) RETURN t`,
          taskData
        );
        return { id: taskData.id, ...taskData };
      },
      createTaskDependency: async (taskId: string, dependencyTaskId: string) => {
        await storageManager.executeQuery(
          `MATCH (t:Task {id: $taskId}), (d:Task {id: $dependencyTaskId}) CREATE (t)-[:DEPENDS_ON]->(d)`,
          { taskId, dependencyTaskId }
        );
        return true;
      },
      getTasksByProject: async (projectId: string) => {
        const result = await storageManager.executeQuery(
          `MATCH (t:Task {projectId: $projectId}) RETURN t`,
          { projectId }
        );
        return (result.data as any)?.records?.map((r: any) => r.get('t').properties) || result.data || [];
      },
      getTaskDependencies: async (taskId: string) => {
        const result = await storageManager.executeQuery(
          `MATCH (t:Task {id: $taskId})-[:DEPENDS_ON]->(d:Task) RETURN d`,
          { taskId }
        );
        return (result.data as any)?.records?.map((r: any) => r.get('d').properties) || result.data || [];
      },
      storeArchitecturalDecision: async (decision: any) => {
        const result = await storageManager.executeQuery(
          `CREATE (ad:ArchitecturalDecision {id: $id, title: $title, description: $description, rationale: $rationale, createdAt: $createdAt}) RETURN ad`,
          decision
        );
        return { id: decision.id, ...decision };
      },
      getArtifactsByTask: async (taskId: string) => {
        const result = await storageManager.executeQuery(
          `MATCH (t:Task {id: $taskId})-[:HAS_ARTIFACT]->(a:Artifact) RETURN a`,
          { taskId }
        );
        return (result.data as any)?.records?.map((r: any) => r.get('a').properties) || result.data || [];
      },
      createPheromone: async (pheromoneData: any) => {
        const result = await storageManager.executeQuery(
          `CREATE (ph:Pheromone {id: $id, type: $type, content: $content, strength: $strength, createdAt: $createdAt}) RETURN ph`,
          pheromoneData
        );
        return { id: pheromoneData.id, ...pheromoneData };
      }
    };
  }

  private initializeWithNeo4jConfig(config: Neo4jConfig): void {
    // Legacy initialization for backward compatibility
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password)
    );

    // Create single shared transaction manager
    const sharedTransactionManager = new TransactionManager(this.driver);

    // Initialize modular components with shared transaction manager
    this.coreOps = new CoreOperations(this.driver, sharedTransactionManager);
    this.queryEngine = new QueryEngine(this.driver, sharedTransactionManager);
    this.pheromoneManager = new PheromoneManager(this.driver, sharedTransactionManager);
    this.agentIntegration = new AgentIntegration(this.driver, sharedTransactionManager);
    this.persistence = new Persistence(this.driver, this.snapshotsDir, sharedTransactionManager);
  }

  private bindMethods(): void {
    // Skip method binding when using StorageManager (components are placeholders)
    if (!this.coreOps.createProject) {
      return;
    }
    
    // Helper function to safely bind methods
    const safeBind = (source: any, methodName: string, target: any) => {
      if (source && typeof source[methodName] === 'function') {
        target[methodName] = source[methodName].bind(source);
      }
    };
    
    // Core Operations - delegate to coreOps (safe binding)
    safeBind(this.coreOps, 'createProject', this);
    safeBind(this.coreOps, 'getProject', this);
    safeBind(this.coreOps, 'getAllProjects', this);
    safeBind(this.coreOps, 'getProjectCount', this);
    safeBind(this.coreOps, 'updateProjectStatus', this);
    safeBind(this.coreOps, 'createTask', this);
    safeBind(this.coreOps, 'updateTaskStatus', this);
    safeBind(this.coreOps, 'createTaskDependency', this);
    safeBind(this.coreOps, 'createAgent', this);
    safeBind(this.coreOps, 'getTasksWithStatus', this);
    safeBind(this.coreOps, 'getAgentsWithStatus', this);
    safeBind(this.coreOps, 'getTasksByProject', this);
    safeBind(this.coreOps, 'getAgentsByProject', this);
    safeBind(this.coreOps, 'assignAgentToTask', this);
    safeBind(this.coreOps, 'storeArchitecturalDecision', this);
    safeBind(this.coreOps, 'createContract', this);
    safeBind(this.coreOps, 'getContract', this);
    safeBind(this.coreOps, 'updateContract', this);
    safeBind(this.coreOps, 'createCodeModule', this);
    safeBind(this.coreOps, 'getCodeModule', this);
    safeBind(this.coreOps, 'updateCodeModule', this);
    safeBind(this.coreOps, 'createTest', this);
    safeBind(this.coreOps, 'getTest', this);
    safeBind(this.coreOps, 'updateTest', this);
    safeBind(this.coreOps, 'createPrototypeNode', this);
    safeBind(this.coreOps, 'linkPrototypeToContract', this);

    // Handle getTaskDependencies based on which path we're using
    if (typeof (this.coreOps as any).getTaskDependencies === 'function') {
      // StorageManager path - bind from coreOps (storage-aware implementation)
      this.getTaskDependencies = (this.coreOps as any).getTaskDependencies.bind(this.coreOps);
    }

    // Handle getArtifactsByTask from storage-aware implementation
    if (typeof (this.coreOps as any).getArtifactsByTask === 'function') {
      this.getArtifactsByTask = (this.coreOps as any).getArtifactsByTask.bind(this.coreOps);
    }

    // Handle createPheromone from storage-aware implementation
    if (typeof (this.coreOps as any).createPheromone === 'function') {
      this.createPheromone = (this.coreOps as any).createPheromone.bind(this.coreOps);
    }

    // Query Engine - only bind if queryEngine is properly initialized (not an empty object)
    if (this.queryEngine && typeof this.queryEngine.getTasksByProject === 'function') {
      this.getTasksByProject = this.queryEngine.getTasksByProject.bind(this.queryEngine);
      this.getTaskDependencies = this.queryEngine.getTaskDependencies.bind(this.queryEngine);
      this.findSimilarTasks = this.queryEngine.findSimilarTasks.bind(this.queryEngine);
      this.getAgentAssignments = this.queryEngine.getAgentAssignments.bind(this.queryEngine);
      this.getContractsByProject = this.queryEngine.getContractsByProject.bind(this.queryEngine);
      this.getContractImplementations = this.queryEngine.getContractImplementations.bind(this.queryEngine);
      this.getContractTests = this.queryEngine.getContractTests.bind(this.queryEngine);
      this.getContractFeatures = this.queryEngine.getContractFeatures.bind(this.queryEngine);
      this.getContractCoverage = this.queryEngine.getContractCoverage.bind(this.queryEngine);
      this.getCodeModulesByProject = this.queryEngine.getCodeModulesByProject.bind(this.queryEngine);
      this.getCodeModuleContracts = this.queryEngine.getCodeModuleContracts.bind(this.queryEngine);
      this.getCodeModuleTests = this.queryEngine.getCodeModuleTests.bind(this.queryEngine);
      this.getTestsByProject = this.queryEngine.getTestsByProject.bind(this.queryEngine);
      this.getTestContracts = this.queryEngine.getTestContracts.bind(this.queryEngine);
      this.getArchitecturalDecisionsByProject = this.queryEngine.getArchitecturalDecisionsByProject.bind(this.queryEngine);
      this.getEndpointImplementations = this.queryEngine.getEndpointImplementations.bind(this.queryEngine);
      this.getEndpointTests = this.queryEngine.getEndpointTests.bind(this.queryEngine);
      this.getProjectKnowledgeGraph = this.queryEngine.getProjectKnowledgeGraph.bind(this.queryEngine);
      this.getArtifactsByTask = this.queryEngine.getArtifactsByTask.bind(this.queryEngine);
      this.linkContractToFeature = this.queryEngine.linkContractToFeature.bind(this.queryEngine);
      this.linkContractToCodeModule = this.queryEngine.linkContractToCodeModule.bind(this.queryEngine);
      this.linkContractToTest = this.queryEngine.linkContractToTest.bind(this.queryEngine);
      this.linkCodeModuleToTest = this.queryEngine.linkCodeModuleToTest.bind(this.queryEngine);
      this.linkOpenAPIEndpointToFunction = this.queryEngine.linkOpenAPIEndpointToFunction.bind(this.queryEngine);
      this.linkEndpointToTest = this.queryEngine.linkEndpointToTest.bind(this.queryEngine);
    }

    // Pheromone Manager - only bind if properly initialized
    if (this.pheromoneManager && typeof this.pheromoneManager.createPheromone === 'function') {
      this.createPheromone = this.pheromoneManager.createPheromone.bind(this.pheromoneManager);
      this.createGuidePheromone = this.pheromoneManager.createGuidePheromone.bind(this.pheromoneManager);
      this.createWarnPheromone = this.pheromoneManager.createWarnPheromone.bind(this.pheromoneManager);
      this.queryPheromones = this.pheromoneManager.queryPheromones.bind(this.pheromoneManager);
      this.linkPheromoneToTask = this.pheromoneManager.linkPheromoneToTask.bind(this.pheromoneManager);
      this.getPheromonesByType = this.pheromoneManager.getPheromonesByType.bind(this.pheromoneManager);
      this.getContextPheromones = this.pheromoneManager.getContextPheromones.bind(this.pheromoneManager);
      this.analyzePatternCorrelations = this.pheromoneManager.analyzePatternCorrelations.bind(this.pheromoneManager);
      this.analyzeTemporalPatterns = this.pheromoneManager.analyzeTemporalPatterns.bind(this.pheromoneManager);
      this.getPheromoneAnalysis = this.pheromoneManager.getPheromoneAnalysis.bind(this.pheromoneManager);
      this.applyPheromoneDecay = this.pheromoneManager.applyPheromoneDecay.bind(this.pheromoneManager);
      this.cleanExpiredPheromones = this.pheromoneManager.cleanExpiredPheromones.bind(this.pheromoneManager);
    }

    // Agent Integration - only bind if properly initialized
    if (this.agentIntegration && typeof this.agentIntegration.getArtifactDetails === 'function') {
      this.getArtifactDetails = this.agentIntegration.getArtifactDetails.bind(this.agentIntegration);
      this.createCritiqueNode = this.agentIntegration.createCritiqueNode.bind(this.agentIntegration);
      this.linkCritiqueToArtifact = this.agentIntegration.linkCritiqueToArtifact.bind(this.agentIntegration);
      this.getFailureById = this.agentIntegration.getFailureById.bind(this.agentIntegration);
      this.getRelatedArtifacts = this.agentIntegration.getRelatedArtifacts.bind(this.agentIntegration);
      this.createDiagnosticNode = this.agentIntegration.createDiagnosticNode.bind(this.agentIntegration);
      this.linkDiagnosticToFailure = this.agentIntegration.linkDiagnosticToFailure.bind(this.agentIntegration);
      this.getFailureHistory = this.agentIntegration.getFailureHistory.bind(this.agentIntegration);
      this.getAgentInteractions = this.agentIntegration.getAgentInteractions.bind(this.agentIntegration);
      this.getTaskDetails = this.agentIntegration.getTaskDetails.bind(this.agentIntegration);
      this.getRelatedKnowledge = this.agentIntegration.getRelatedKnowledge.bind(this.agentIntegration);
      this.createKnowledgeExtraction = this.agentIntegration.createKnowledgeExtraction.bind(this.agentIntegration);
      this.getProjectContext = this.agentIntegration.getProjectContext.bind(this.agentIntegration);
      this.linkKnowledgeToTask = this.agentIntegration.linkKnowledgeToTask.bind(this.agentIntegration);
      this.updatePheromoneStrengths = this.agentIntegration.updatePheromoneStrengths.bind(this.agentIntegration);
      this.getProjectKnowledge = this.agentIntegration.getProjectKnowledge.bind(this.agentIntegration);
      this.validateKnowledgeConsistency = this.agentIntegration.validateKnowledgeConsistency.bind(this.agentIntegration);
      this.identifyKnowledgeGaps = this.agentIntegration.identifyKnowledgeGaps.bind(this.agentIntegration);
      this.updateProjectMetrics = this.agentIntegration.updateProjectMetrics.bind(this.agentIntegration);
      this.createKnowledgeEntry = this.agentIntegration.createKnowledgeEntry.bind(this.agentIntegration);
      this.getKnowledgeEntriesByType = this.agentIntegration.getKnowledgeEntriesByType.bind(this.agentIntegration);
      this.getKnowledgeEntriesByQuery = this.agentIntegration.getKnowledgeEntriesByQuery.bind(this.agentIntegration);
      this.storeFailure = this.agentIntegration.storeFailure.bind(this.agentIntegration);
      this.getTaskRetryCount = this.agentIntegration.getTaskRetryCount.bind(this.agentIntegration);
      this.storeEscalatedError = this.agentIntegration.storeEscalatedError.bind(this.agentIntegration);
    }

    // Persistence - only bind if properly initialized
    if (this.persistence && typeof this.persistence.saveSnapshot === 'function') {
      this.saveSnapshot = this.persistence.saveSnapshot.bind(this.persistence);
      this.loadSnapshot = this.persistence.loadSnapshot.bind(this.persistence);
      this.listSnapshots = this.persistence.listSnapshots.bind(this.persistence);
      this.restoreFromSnapshot = this.persistence.restoreFromSnapshot.bind(this.persistence);
    }
  }

  async initializeSchema(): Promise<void> {
    // Use storage-agnostic schema initialization
    // For now, use legacy initialization as we transition to storage abstraction
    await this.initializeSchemaDirect();
  }

  // Legacy schema initialization for backward compatibility
  private async initializeSchemaDirect(): Promise<void> {
    if (!this.driver) {
      console.log('📝 Skipping direct schema initialization - using storage abstraction');
      return;
    }
    
    const session = this.driver.session();
    try {
      const constraints = [
        'CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
        'CREATE CONSTRAINT task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE',
        'CREATE CONSTRAINT agent_id IF NOT EXISTS FOR (a:Agent) REQUIRE a.id IS UNIQUE',
        'CREATE CONSTRAINT pheromone_id IF NOT EXISTS FOR (ph:Pheromone) REQUIRE ph.id IS UNIQUE',
        'CREATE CONSTRAINT guide_pheromone_id IF NOT EXISTS FOR (gp:guide_pheromone) REQUIRE gp.id IS UNIQUE',
        'CREATE CONSTRAINT warn_pheromone_id IF NOT EXISTS FOR (wp:warn_pheromone) REQUIRE wp.id IS UNIQUE',
        'CREATE CONSTRAINT contract_id IF NOT EXISTS FOR (c:Contract) REQUIRE c.id IS UNIQUE',
        'CREATE CONSTRAINT code_module_id IF NOT EXISTS FOR (cm:CodeModule) REQUIRE cm.id IS UNIQUE',
        'CREATE CONSTRAINT test_id IF NOT EXISTS FOR (t:Test) REQUIRE t.id IS UNIQUE'
      ];
      
      // Execute constraints sequentially to avoid conflicts
      for (const constraint of constraints) {
        try {
          await session.run(constraint);
        } catch (error) {
          // Log but don't fail if constraint already exists
          if (!(error instanceof Error) || !error.message.includes('already exists')) {
            throw error;
          }
        }
      }
    } finally {
      await session.close();
    }
  }


  async autoSaveSnapshot(): Promise<void> {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    this.autoSaveInterval = setInterval(async () => {
      try {
        await this.persistence.autoSaveSnapshot();
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 60000); // Auto-save every minute
  }

  async close(): Promise<void> {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    if (this.driver) {
      await this.driver.close();
    }
  }
}

// Re-export all types for backward compatibility
export * from './types';