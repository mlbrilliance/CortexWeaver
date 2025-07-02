/**
 * Context Primer Core Module
 * 
 * Contains the main context priming orchestration logic
 */

import { CognitiveCanvas, TaskData, PheromoneData, ArchitecturalDecisionData, ContractData, CodeModuleData } from '../cognitive-canvas';
import { AgentType } from '../orchestrator';
import { WorkspaceManager } from '../workspace';
import { ContextData, ContextPrimingOptions } from './types';
import { ContextAnalysis } from './analysis';

export class ContextPrimerCore {
  private canvas: CognitiveCanvas;
  private workspace: WorkspaceManager;
  private analysis: ContextAnalysis;

  constructor(canvas: CognitiveCanvas, workspace: WorkspaceManager, contractsPath: string = './contracts') {
    this.canvas = canvas;
    this.workspace = workspace;
    this.analysis = new ContextAnalysis(contractsPath);
  }

  async primeContext(
    task: TaskData, 
    agentType: AgentType, 
    projectId: string,
    options: ContextPrimingOptions = {}
  ): Promise<ContextData> {
    const defaults: ContextPrimingOptions = {
      maxCodeModules: 10,
      maxPheromones: 5,
      maxSimilarTasks: 3,
      maxWorkspaceFiles: 15,
      maxContractSnippets: 8,
      includeTests: true,
      includeDocs: true
    };

    const opts = { ...defaults, ...options };

    // Fetch context data in parallel for performance
    const [
      architecturalDecisions,
      allCodeModules,
      allContracts,
      allPheromones,
      dependencies,
      workspaceFiles,
      contractSnippets
    ] = await Promise.all([
      this.getArchitecturalDecisions(projectId),
      this.getCodeModules(projectId),
      this.getContracts(projectId),
      this.getRelevantPheromones(task, agentType, opts.maxPheromones!),
      this.getTaskDependencies(task.id),
      this.getRelevantWorkspaceFiles(task, agentType, opts),
      this.getRelevantContractSnippets(task, agentType, opts.maxContractSnippets!)
    ]);

    // Filter and prioritize code modules based on relevance to task and agent type
    const codeModules = this.analysis.prioritizeCodeModules(allCodeModules, task, agentType, opts.maxCodeModules!);

    // Filter contracts based on relevance
    const contracts = this.analysis.prioritizeContracts(allContracts, task, agentType);

    // Find similar tasks for learning
    const similarTasks = await this.findSimilarTasks(task, opts.maxSimilarTasks!);

    return {
      architecturalDecisions,
      codeModules,
      contracts,
      pheromones: allPheromones,
      dependencies,
      similarTasks,
      workspaceFiles,
      contractSnippets
    };
  }

  private async getArchitecturalDecisions(projectId: string): Promise<ArchitecturalDecisionData[]> {
    try {
      return await this.canvas.getArchitecturalDecisionsByProject(projectId);
    } catch (error) {
      console.warn('Failed to fetch architectural decisions:', error);
      return [];
    }
  }

  private async getCodeModules(projectId: string): Promise<CodeModuleData[]> {
    try {
      return await this.canvas.getCodeModulesByProject(projectId);
    } catch (error) {
      console.warn('Failed to fetch code modules:', error);
      return [];
    }
  }

  private async getContracts(projectId: string): Promise<ContractData[]> {
    try {
      return await this.canvas.getContractsByProject(projectId);
    } catch (error) {
      console.warn('Failed to fetch contracts:', error);
      return [];
    }
  }

  private async getRelevantPheromones(
    task: TaskData, 
    agentType: AgentType, 
    maxCount: number
  ): Promise<PheromoneData[]> {
    try {
      // Use the enhanced pheromone system to get context-relevant pheromones
      const taskComplexity = this.analysis.estimateTaskComplexity(task);
      const taskContext = task.title + ' ' + task.description;
      
      const contextPheromones = await this.canvas.getContextPheromones(
        agentType,
        taskContext,
        taskComplexity
      );
      
      // Combine guides and warnings, prioritizing guides but including warnings for balance
      const allPheromones = [
        ...contextPheromones.guides,
        ...contextPheromones.warnings.slice(0, Math.max(1, Math.floor(maxCount * 0.3))) // Max 30% warnings
      ];
      
      // If we don't have enough from context search, fall back to legacy types for backwards compatibility
      if (allPheromones.length < maxCount) {
        const legacyTypes = this.analysis.getPheromoneTypesForAgent(agentType);
        const legacyPheromones: PheromoneData[] = [];
        
        for (const type of legacyTypes) {
          const pheromones = await this.canvas.getPheromonesByType(type);
          legacyPheromones.push(...pheromones);
        }
        
        // Add legacy pheromones that aren't already included
        const existingIds = new Set(allPheromones.map(p => p.id));
        const newLegacyPheromones = legacyPheromones
          .filter(p => !existingIds.has(p.id))
          .slice(0, maxCount - allPheromones.length);
        
        allPheromones.push(...newLegacyPheromones);
      }

      // Sort by strength and relevance, then limit
      return allPheromones
        .sort((a, b) => b.strength - a.strength)
        .slice(0, maxCount);
    } catch (error) {
      console.warn('Failed to fetch pheromones:', error);
      return [];
    }
  }

  private async getTaskDependencies(taskId: string): Promise<TaskData[]> {
    try {
      return await this.canvas.getTaskDependencies(taskId);
    } catch (error) {
      console.warn('Failed to fetch task dependencies:', error);
      return [];
    }
  }

  private async findSimilarTasks(task: TaskData, maxCount: number): Promise<Array<TaskData & { similarity: number }>> {
    try {
      // Extract keywords from task title and description
      const keywords = this.analysis.extractKeywords(task.title + ' ' + task.description);
      return await this.canvas.findSimilarTasks(task.id, keywords);
    } catch (error) {
      console.warn('Failed to find similar tasks:', error);
      return [];
    }
  }

  private async getRelevantWorkspaceFiles(
    task: TaskData, 
    agentType: AgentType, 
    options: ContextPrimingOptions
  ) {
    try {
      const projectRoot = this.workspace.getProjectRoot();
      const files = await this.analysis.scanWorkspaceFiles(projectRoot);
      
      // Filter and score files based on relevance to task and agent type
      const relevantFiles = files
        .map(file => ({
          ...file,
          relevanceScore: this.analysis.calculateFileRelevance(file, task, agentType)
        }))
        .filter(file => {
          if (!options.includeTests && file.type === 'test') return false;
          if (!options.includeDocs && file.type === 'documentation') return false;
          return file.relevanceScore > 0.1; // Minimum relevance threshold
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, options.maxWorkspaceFiles || 15);

      return relevantFiles;
    } catch (error) {
      console.warn('Failed to scan workspace files:', error);
      return [];
    }
  }

  private async getRelevantContractSnippets(
    task: TaskData, 
    agentType: AgentType, 
    maxCount: number
  ) {
    try {
      const snippets = await this.analysis.extractContractSnippets();
      
      // Score and filter snippets based on relevance
      const relevantSnippets = snippets
        .map(snippet => ({
          ...snippet,
          relevanceScore: this.analysis.calculateContractRelevance(snippet, task, agentType)
        }))
        .filter(snippet => snippet.relevanceScore > 0.1)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxCount);

      return relevantSnippets;
    } catch (error) {
      console.warn('Failed to extract contract snippets:', error);
      return [];
    }
  }
}