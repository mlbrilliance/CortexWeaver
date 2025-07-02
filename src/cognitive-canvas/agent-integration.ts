import { Driver } from 'neo4j-driver';
import { CritiqueAgentIntegration } from './agent-integration-critique';
import { DebuggerAgentIntegration } from './agent-integration-debugger';
import { KnowledgeUpdaterAgentIntegration } from './agent-integration-knowledge';
import { GeneralAgentIntegration } from './agent-integration-general';

/**
 * Main Agent Integration class that coordinates different agent-specific operations
 * Now uses modular approach with specialized classes for each agent type
 */
export class AgentIntegration {
  private critiqueAgent: CritiqueAgentIntegration;
  private debuggerAgent: DebuggerAgentIntegration;
  private knowledgeAgent: KnowledgeUpdaterAgentIntegration;
  private generalAgent: GeneralAgentIntegration;

  constructor(private driver: Driver) {
    this.critiqueAgent = new CritiqueAgentIntegration(driver);
    this.debuggerAgent = new DebuggerAgentIntegration(driver);
    this.knowledgeAgent = new KnowledgeUpdaterAgentIntegration(driver);
    this.generalAgent = new GeneralAgentIntegration(driver);
  }

  // ========== Critique Agent Methods ==========
  async getArtifactDetails(artifactId: string): Promise<any> {
    return this.critiqueAgent.getArtifactDetails(artifactId);
  }

  async createCritiqueNode(critiqueData: any): Promise<string> {
    return this.critiqueAgent.createCritiqueNode(critiqueData);
  }

  async linkCritiqueToArtifact(critiqueId: string, artifactId: string): Promise<void> {
    return this.critiqueAgent.linkCritiqueToArtifact(critiqueId, artifactId);
  }

  // ========== Debugger Agent Methods ==========
  async getFailureById(failureId: string): Promise<any> {
    return this.debuggerAgent.getFailureById(failureId);
  }

  async getRelatedArtifacts(failureId: string): Promise<any[]> {
    return this.debuggerAgent.getRelatedArtifacts(failureId);
  }

  async createDiagnosticNode(diagnosticData: any): Promise<string> {
    return this.debuggerAgent.createDiagnosticNode(diagnosticData);
  }

  async linkDiagnosticToFailure(diagnosticId: string, failureId: string): Promise<void> {
    return this.debuggerAgent.linkDiagnosticToFailure(diagnosticId, failureId);
  }

  async getFailureHistory(taskIdOrProjectId?: string, hoursBack?: number): Promise<any[]> {
    return this.debuggerAgent.getFailureHistory(taskIdOrProjectId, hoursBack);
  }

  async getAgentInteractions(taskIdOrProjectId: string, hoursBack?: number): Promise<any[]> {
    return this.debuggerAgent.getAgentInteractions(taskIdOrProjectId, hoursBack);
  }

  // ========== Knowledge Updater Agent Methods ==========
  async getTaskDetails(taskId: string): Promise<any> {
    return this.knowledgeAgent.getTaskDetails(taskId);
  }

  async getRelatedKnowledge(taskId: string): Promise<any[]> {
    return this.knowledgeAgent.getRelatedKnowledge(taskId);
  }

  async createKnowledgeExtraction(extractionData: any): Promise<string> {
    return this.knowledgeAgent.createKnowledgeExtraction(extractionData);
  }

  async linkKnowledgeToTask(knowledgeId: string, taskId: string): Promise<void> {
    return this.knowledgeAgent.linkKnowledgeToTask(knowledgeId, taskId);
  }

  async updatePheromoneStrengths(updates?: any): Promise<void> {
    return this.knowledgeAgent.updatePheromoneStrengths(updates);
  }

  async getProjectKnowledge(projectId: string): Promise<any[]> {
    return this.knowledgeAgent.getProjectKnowledge(projectId);
  }

  async validateKnowledgeConsistency(projectId: string): Promise<any[]> {
    return this.knowledgeAgent.validateKnowledgeConsistency(projectId);
  }

  async identifyKnowledgeGaps(projectId: string): Promise<any[]> {
    return this.knowledgeAgent.identifyKnowledgeGaps(projectId);
  }

  async updateProjectMetrics(projectId: string, metrics: any): Promise<void> {
    return this.knowledgeAgent.updateProjectMetrics(projectId, metrics);
  }

  // ========== General Agent Methods ==========
  async getProjectContext(projectId: string): Promise<any> {
    return this.generalAgent.getProjectContext(projectId);
  }

  async createKnowledgeEntry(projectId: string, entryData: {
    type: string;
    data?: any;
    timestamp: Date;
  }): Promise<void> {
    return this.generalAgent.createKnowledgeEntry(projectId, entryData);
  }

  async getKnowledgeEntriesByType(projectId: string, type: string): Promise<any[]> {
    return this.generalAgent.getKnowledgeEntriesByType(projectId, type);
  }

  async getKnowledgeEntriesByQuery(projectId: string, query: {
    type?: string;
    filter?: Record<string, any>;
  }): Promise<any[]> {
    return this.generalAgent.getKnowledgeEntriesByQuery(projectId, query);
  }

  // ========== Error Handling Integration Methods ==========
  /**
   * Store failure information for error tracking
   */
  async storeFailure(failureData: any): Promise<void> {
    return this.debuggerAgent.storeFailure(failureData);
  }

  /**
   * Get task retry count for recovery strategies
   */
  async getTaskRetryCount(taskId: string): Promise<{ count: number }> {
    return this.debuggerAgent.getTaskRetryCount(taskId);
  }

  /**
   * Store escalated error context for manual intervention
   */
  async storeEscalatedError(errorData: any): Promise<void> {
    return this.debuggerAgent.storeEscalatedError(errorData);
  }
}