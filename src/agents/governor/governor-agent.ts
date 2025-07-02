import * as path from 'path';
import * as fs from 'fs';
import { Agent, AgentConfig, TaskContext, TaskResult } from '../../agent';
import { ConfigService, ProjectConfig } from '../../config';
import { TaskData, PheromoneData } from '../../cognitive-canvas';
import { PersonaLoader, Persona, PersonaLoadResult } from '../../persona';
import { PromptImprovementWorkflow, ImprovementProposal, ApprovalStatus } from '../../prompt-improvement';

// Import modular components
import { CostMonitor } from './cost-monitor';
import { BudgetEnforcer } from './budget-enforcer';
import { QualityAnalyzer } from './quality-analyzer';
import { PheromoneManager } from './pheromone-manager';
import { PromptWorkflowManager } from './prompt-workflow-manager';
import { ReflectorCoordinator } from './reflector-coordinator';

// Import types
import {
  GovernorResult,
  GovernorAnalysisInput,
  CostData,
  BudgetEnforcement,
  QualityAnalysis,
  PheromoneInput,
  ImprovementProposals,
  PromptApprovalResult,
  ReflectorSpawnAnalysis,
  PromptUpdateAudit
} from './types';

/**
 * GovernorAgent (Meta-Strategist) monitors project costs, enforces budgets,
 * analyzes quality, provides strategic guidance through pheromones, and manages
 * the self-improvement loop through Reflector collaboration (V3.0).
 * 
 * This is the main orchestration class that uses modular components for specific functionality.
 */
export class GovernorAgent extends Agent {

  /**
   * Get the prompt template for Meta-Strategist oversight and governance
   */
  getPromptTemplate(): string {
    return `You are a Governor Agent (Meta-Strategist), an executive oversight system responsible for project governance, cost management, quality assurance, and strategic guidance.

## Core Responsibilities
- Monitor API costs and enforce budget constraints
- Analyze project quality metrics and test results
- Generate strategic pheromones for agent coordination
- Manage the self-improvement loop with Reflector collaboration
- Provide project-level oversight and recommendations
- Coordinate prompt evolution and persona optimization

## Input Context
**Cost Data:** {{costs}}
**Budget Configuration:** {{budget}}
**Test Results:** {{testResults}}
**Quality Metrics:** {{qualityMetrics}}
**Project Name:** {{projectName}}
**Agent Performance:** {{agentPerformance}}
**System Health:** {{systemHealth}}

## Governance Framework
1. **Cost Monitoring**: Track API usage, token consumption, and budget adherence
2. **Quality Analysis**: Evaluate test results, code quality, and project health
3. **Strategic Oversight**: Assess project trajectory and resource allocation
4. **Agent Coordination**: Generate guidance pheromones for agent behavior
5. **Improvement Management**: Coordinate with Reflector for system optimization
6. **Risk Assessment**: Identify potential issues and recommend mitigation strategies

## Decision Making
As the Meta-Strategist, make executive decisions on:
- **Budget Actions**: When to halt operations due to cost overruns
- **Quality Gates**: When quality metrics require intervention
- **Resource Allocation**: How to optimize agent task distribution
- **Reflector Spawning**: When system reflection and improvement is needed
- **Prompt Updates**: Approval/rejection of Reflector improvement proposals

## Pheromone Generation
Create strategic pheromones for:
- **Cost Optimization**: Guide agents to reduce API usage
- **Quality Improvement**: Direct focus to areas needing attention
- **Performance Enhancement**: Share successful patterns and practices
- **Risk Mitigation**: Warn about potential issues and failure patterns

## V3.0 Enhanced Features
- **Reflector Coordination**: Manage self-improvement cycles and proposal evaluation
- **Prompt Management**: Oversee prompt evolution and persona optimization
- **Enhanced Analytics**: Provide deep cost and performance insights
- **Strategic Planning**: Long-term project trajectory analysis

## Output Format
Provide governance recommendations in this structure:
- **Cost Assessment**: Current usage vs. budget with projections
- **Quality Status**: Test results analysis and quality scores
- **Strategic Actions**: Immediate and long-term recommendations
- **Pheromone Instructions**: Specific guidance for agent coordination
- **Risk Alerts**: Issues requiring immediate attention
- **Improvement Opportunities**: Areas for optimization

Focus on strategic oversight that balances cost efficiency, quality excellence, and project success while maintaining system adaptability and continuous improvement.`;
  }
  private configService: ConfigService | null = null;
  private projectConfig: ProjectConfig | null = null;
  private personaLoader: PersonaLoader | null = null;
  private promptImprovementWorkflow: PromptImprovementWorkflow | null = null;

  // Modular components
  private costMonitor: CostMonitor | null = null;
  private budgetEnforcer: BudgetEnforcer | null = null;
  private qualityAnalyzer: QualityAnalyzer | null = null;
  private pheromoneManager: PheromoneManager | null = null;
  private promptWorkflowManager: PromptWorkflowManager | null = null;
  private reflectorCoordinator: ReflectorCoordinator | null = null;

  /**
   * Initialize the Governor agent with configuration
   */
  async initialize(config: AgentConfig): Promise<void> {
    await super.initialize(config);
    
    if (config.workspaceRoot) {
      this.configService = new ConfigService(config.workspaceRoot);
      this.projectConfig = this.configService.loadProjectConfig();
      
      // Initialize prompt improvement workflow
      if (this.cognitiveCanvas) {
        this.promptImprovementWorkflow = new PromptImprovementWorkflow({
          workspaceRoot: config.workspaceRoot,
          cognitiveCanvas: this.cognitiveCanvas
        });
      }
      
      // Initialize persona loader for dynamic prompt management
      this.personaLoader = new PersonaLoader({
        workspaceRoot: config.workspaceRoot,
        promptsDirectory: path.join(config.workspaceRoot, 'prompts'),
        enableHotReload: false,
        cacheTtl: 300000,
        validateFormat: true,
        fallbackToRaw: true
      });

      // Initialize modular components
      this.initializeModules();
    }
  }

  /**
   * Initialize all modular components
   */
  private initializeModules(): void {
    // Cost monitoring
    this.costMonitor = new CostMonitor(
      this.claudeClient,
      this.cognitiveCanvas,
      this.projectConfig,
      this.currentTask
    );

    // Budget enforcement
    this.budgetEnforcer = new BudgetEnforcer(this.projectConfig);

    // Quality analysis
    this.qualityAnalyzer = new QualityAnalyzer(
      this.cognitiveCanvas,
      this.currentTask
    );

    // Pheromone management
    this.pheromoneManager = new PheromoneManager(
      this.cognitiveCanvas,
      this.config,
      this.currentTask
    );

    // Prompt workflow management
    this.promptWorkflowManager = new PromptWorkflowManager(
      this.promptImprovementWorkflow,
      this.cognitiveCanvas,
      this.personaLoader,
      this.claudeClient,
      this.config,
      this.currentTask,
      this.createPheromones.bind(this),
      this.sendToClaude.bind(this),
      this.reportProgress.bind(this)
    );

    // Reflector coordination
    this.reflectorCoordinator = new ReflectorCoordinator(
      this.cognitiveCanvas,
      this.config,
      this.currentTask
    );
  }

  /**
   * Monitor project costs via Cognitive Canvas queries (V3.0 Enhanced)
   */
  async monitorCosts(): Promise<CostData> {
    if (!this.costMonitor) {
      throw new Error('Cost monitor not initialized');
    }
    return this.costMonitor.monitorCosts();
  }

  /**
   * Enforce budget limits from config.json
   */
  async enforceBudgets(costData: CostData): Promise<BudgetEnforcement> {
    if (!this.budgetEnforcer) {
      throw new Error('Budget enforcer not initialized');
    }
    return this.budgetEnforcer.enforceBudgets(costData);
  }

  /**
   * Analyze test results and quality reports
   */
  async analyzeTestResults(): Promise<QualityAnalysis> {
    if (!this.qualityAnalyzer) {
      throw new Error('Quality analyzer not initialized');
    }
    return this.qualityAnalyzer.analyzeTestResults();
  }

  /**
   * Create guide and warning pheromones
   */
  async createPheromones(pheromones: PheromoneInput[]): Promise<void> {
    if (!this.pheromoneManager) {
      throw new Error('Pheromone manager not initialized');
    }
    return this.pheromoneManager.createPheromones(pheromones);
  }

  /**
   * Propose improvements to code standards or configuration
   */
  async proposeImprovements(analysisData: GovernorAnalysisInput): Promise<ImprovementProposals> {
    if (!this.pheromoneManager) {
      throw new Error('Pheromone manager not initialized');
    }
    return this.pheromoneManager.proposeImprovements(analysisData);
  }

  /**
   * Generate governor prompt with persona integration (V3.0)
   */
  private async generateGovernorPrompt(analysisData: GovernorAnalysisInput): Promise<string> {
    const context = {
      costData: JSON.stringify(analysisData.costData, null, 2),
      budgetStatus: JSON.stringify(analysisData.budgetStatus, null, 2),
      qualityData: JSON.stringify(analysisData.qualityData, null, 2),
      projectName: this.taskContext?.projectInfo?.name || 'Unknown Project',
      currentBudget: this.projectConfig?.budget || 'No budget configuration',
      qualityThresholds: 'No quality configuration available',
      v3Features: 'Reflector collaboration, prompt management, persona integration'
    };

    // V3.0: Try to load persona dynamically
    let basePrompt = this.getPromptTemplate(); // Fallback
    
    if (this.personaLoader) {
      try {
        const personaResult = await this.personaLoader.loadPersona('governor');
        if (personaResult.success && personaResult.persona) {
          basePrompt = this.personaLoader.generatePromptTemplate(personaResult.persona, context);
        }
      } catch (error) {
        console.warn('Failed to load governor persona, using fallback:', error);
      }
    }
    
    // Add specific governance context for V3.0
    const promptUpdateAudits = this.promptWorkflowManager?.getPromptUpdateAudits() || [];
    const lastReflectorSpawn = this.reflectorCoordinator?.getLastReflectorSpawn();
    
    return `${basePrompt}

## Current Analysis Context (V3.0)
**Cost Data:** ${context.costData}
**Budget Status:** ${context.budgetStatus}
**Quality Metrics:** ${context.qualityData}
**Prompt Updates Processed:** ${promptUpdateAudits.length}
**Last Reflector Spawn:** ${lastReflectorSpawn?.toISOString() || 'Never'}

## V3.0 Required Actions
1. Process any pending Reflector improvement proposals
2. Analyze the provided cost, budget, and quality data
3. Determine if Reflector agent spawning is needed
4. Generate appropriate pheromones for agent coordination
5. Propose improvements based on current metrics
6. Manage prompt evolution and persona optimization
7. Provide strategic recommendations for project optimization

Focus on strategic oversight, self-improvement loop management, cost optimization, and quality improvement.`;
  }

  /**
   * Enhanced execute task with Reflector spawning analysis and prompt management (V3.0)
   */
  async executeTask(): Promise<GovernorResult> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    await this.reportProgress('started', 'Beginning governor oversight analysis (V3.0)');

    try {
      // Update all module references with current state
      this.updateModuleReferences();

      // V3.0: Process any pending Reflector improvement proposals first
      if (this.promptWorkflowManager) {
        await this.promptWorkflowManager.processReflectorProposals();
      }
      
      // V3.0: Process prompt improvement workflow approvals
      const promptApprovals = this.promptWorkflowManager 
        ? await this.promptWorkflowManager.processPromptApprovalWorkflow()
        : this.getEmptyPromptApprovalResult();
      
      // Monitor API costs
      const costData = await this.monitorCosts();
      
      // Enforce budget limits
      const budgetStatus = await this.enforceBudgets(costData);
      
      // Analyze test results and quality
      const qualityData = await this.analyzeTestResults();
      
      // Create analysis data structure
      const analysisData: GovernorAnalysisInput = {
        costData,
        qualityData,
        budgetStatus
      };
      
      // V3.0: Enhanced Reflector spawning analysis
      const reflectorAnalysis = this.reflectorCoordinator
        ? await this.reflectorCoordinator.analyzeReflectorSpawningNeeds(analysisData)
        : this.getEmptyReflectorAnalysis();
      
      // Request Reflector spawn if needed
      if (reflectorAnalysis.shouldSpawn && this.reflectorCoordinator) {
        await this.reflectorCoordinator.requestReflectorSpawn(reflectorAnalysis);
      }
      
      // Generate pheromones based on analysis (now using persona-enhanced prompts)
      const pheromones = this.pheromoneManager
        ? await this.pheromoneManager.generatePheromones(costData, budgetStatus, qualityData)
        : [];
      
      if (pheromones.length > 0) {
        await this.createPheromones(pheromones);
      }
      
      // Propose improvements
      const improvements = await this.proposeImprovements(analysisData);
      
      await this.reportProgress('completed', 'Governor oversight analysis completed (V3.0)');
      
      // V3.0: Enhanced result with additional metadata
      const result: GovernorResult = {
        costMonitoring: costData,
        budgetEnforcement: budgetStatus,
        qualityAnalysis: qualityData,
        pheromones,
        improvements,
        promptApprovals
      };

      // Add V3.0 specific metadata to result
      const promptUpdateAudits = this.promptWorkflowManager?.getPromptUpdateAudits() || [];
      const lastReflectorSpawn = this.reflectorCoordinator?.getLastReflectorSpawn();
      
      (result as any).v3Metadata = {
        reflectorSpawnAnalysis: reflectorAnalysis,
        promptUpdatesProcessed: promptUpdateAudits.length,
        lastReflectorSpawn: lastReflectorSpawn?.toISOString(),
        nextRecommendedSpawn: reflectorAnalysis.shouldSpawn 
          ? new Date(Date.now() + reflectorAnalysis.recommendedInterval).toISOString()
          : null,
        personaLoaderActive: !!this.personaLoader,
        version: '3.0'
      };
      
      return result;
    } catch (error) {
      await this.reportProgress('error', `Governor analysis failed (V3.0): ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Update module references when state changes
   */
  private updateModuleReferences(): void {
    this.budgetEnforcer?.updateProjectConfig(this.projectConfig);
    this.qualityAnalyzer?.updateReferences(this.cognitiveCanvas, this.currentTask);
    this.pheromoneManager?.updateReferences(this.cognitiveCanvas, this.config, this.currentTask);
    this.promptWorkflowManager?.updateReferences(
      this.promptImprovementWorkflow,
      this.cognitiveCanvas,
      this.personaLoader,
      this.claudeClient,
      this.config,
      this.currentTask
    );
    this.reflectorCoordinator?.updateReferences(this.cognitiveCanvas, this.config, this.currentTask);
  }

  /**
   * Get empty prompt approval result for fallback
   */
  private getEmptyPromptApprovalResult(): PromptApprovalResult {
    return {
      proposalsReviewed: 0,
      approved: 0,
      rejected: 0,
      pendingReview: 0,
      approvalDetails: []
    };
  }

  /**
   * Get empty reflector analysis for fallback
   */
  private getEmptyReflectorAnalysis(): ReflectorSpawnAnalysis {
    return {
      shouldSpawn: false,
      reason: 'Reflector coordinator not available',
      priority: 'low',
      focusAreas: [],
      triggers: [],
      recommendedInterval: 3600000
    };
  }

  /**
   * Get audit trail for prompt updates (V3.0)
   */
  getPromptUpdateAudits(): PromptUpdateAudit[] {
    return this.promptWorkflowManager?.getPromptUpdateAudits() || [];
  }
}