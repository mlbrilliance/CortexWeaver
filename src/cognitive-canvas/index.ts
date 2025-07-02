import neo4j, { Driver } from 'neo4j-driver';
import { Neo4jConfig } from './types';
import { CoreOperations } from './core-operations';
import { QueryEngine } from './query-engine';
import { PheromoneManager } from './pheromone-manager';
import { AgentIntegration } from './agent-integration';
import { Persistence } from './persistence';

export class CognitiveCanvas {
  private driver: Driver;
  private autoSaveInterval?: NodeJS.Timeout;
  private snapshotsDir: string;

  // Modular components
  private coreOps: CoreOperations;
  private queryEngine: QueryEngine;
  private pheromoneManager: PheromoneManager;
  private agentIntegration: AgentIntegration;
  private persistence: Persistence;

  // Core Operations methods
  createProject!: CoreOperations['createProject'];
  getProject!: CoreOperations['getProject'];
  updateProjectStatus!: CoreOperations['updateProjectStatus'];
  createTask!: CoreOperations['createTask'];
  updateTaskStatus!: CoreOperations['updateTaskStatus'];
  createTaskDependency!: CoreOperations['createTaskDependency'];
  createAgent!: CoreOperations['createAgent'];
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
  getTasksByProject!: QueryEngine['getTasksByProject'];
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

  constructor(config: Neo4jConfig, snapshotsDir: string = './snapshots') {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password)
    );
    this.snapshotsDir = snapshotsDir;

    // Initialize modular components with shared driver
    this.coreOps = new CoreOperations(this.driver);
    this.queryEngine = new QueryEngine(this.driver);
    this.pheromoneManager = new PheromoneManager(this.driver);
    this.agentIntegration = new AgentIntegration(this.driver);
    this.persistence = new Persistence(this.driver, snapshotsDir);

    // Bind methods after components are initialized
    this.bindMethods();
  }

  private bindMethods(): void {
    // Core Operations - delegate to coreOps
    this.createProject = this.coreOps.createProject.bind(this.coreOps);
    this.getProject = this.coreOps.getProject.bind(this.coreOps);
    this.updateProjectStatus = this.coreOps.updateProjectStatus.bind(this.coreOps);
    this.createTask = this.coreOps.createTask.bind(this.coreOps);
    this.updateTaskStatus = this.coreOps.updateTaskStatus.bind(this.coreOps);
    this.createTaskDependency = this.coreOps.createTaskDependency.bind(this.coreOps);
    this.createAgent = this.coreOps.createAgent.bind(this.coreOps);
    this.assignAgentToTask = this.coreOps.assignAgentToTask.bind(this.coreOps);
    this.storeArchitecturalDecision = this.coreOps.storeArchitecturalDecision.bind(this.coreOps);
    this.createContract = this.coreOps.createContract.bind(this.coreOps);
    this.getContract = this.coreOps.getContract.bind(this.coreOps);
    this.updateContract = this.coreOps.updateContract.bind(this.coreOps);
    this.createCodeModule = this.coreOps.createCodeModule.bind(this.coreOps);
    this.getCodeModule = this.coreOps.getCodeModule.bind(this.coreOps);
    this.updateCodeModule = this.coreOps.updateCodeModule.bind(this.coreOps);
    this.createTest = this.coreOps.createTest.bind(this.coreOps);
    this.getTest = this.coreOps.getTest.bind(this.coreOps);
    this.updateTest = this.coreOps.updateTest.bind(this.coreOps);
    this.createPrototypeNode = this.coreOps.createPrototypeNode.bind(this.coreOps);
    this.linkPrototypeToContract = this.coreOps.linkPrototypeToContract.bind(this.coreOps);

    // Query Engine - delegate to queryEngine
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

    // Pheromone Manager - delegate to pheromoneManager
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

    // Agent Integration - delegate to agentIntegration
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

    // Persistence - delegate to persistence
    this.saveSnapshot = this.persistence.saveSnapshot.bind(this.persistence);
    this.loadSnapshot = this.persistence.loadSnapshot.bind(this.persistence);
    this.listSnapshots = this.persistence.listSnapshots.bind(this.persistence);
    this.restoreFromSnapshot = this.persistence.restoreFromSnapshot.bind(this.persistence);
  }

  async initializeSchema(): Promise<void> {
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
      await Promise.all(constraints.map(constraint => session.run(constraint)));
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
    await this.driver.close();
  }
}

// Re-export all types for backward compatibility
export * from './types';