import * as path from 'path';
import { Agent, AgentConfig, TaskContext, TaskResult } from '../agent';
import { ConfigService, ProjectConfig } from '../config';
import { TaskData } from '../cognitive-canvas';

/**
 * Extended TaskData interface to include metadata
 */
interface TaskDataWithMetadata extends TaskData {
  metadata?: {
    testResults?: {
      passed: number;
      failed: number;
    };
    [key: string]: any;
  };
}

/**
 * Interface for cost monitoring data
 */
interface CostData {
  totalTokens: number;
  totalCost: number;
  breakdown: {
    claude: number;
    gemini: number;
  };
}

/**
 * Interface for budget enforcement results
 */
interface BudgetEnforcement {
  tokenLimitExceeded: boolean;
  costLimitExceeded: boolean;
  allowContinue: boolean;
  warnings: string[];
  recommendations: string[];
}

/**
 * Interface for quality analysis results
 */
interface QualityAnalysis {
  totalTests: number;
  passRate: number;
  qualityScore: number;
  issues: string[];
  recommendations: string[];
}

/**
 * Interface for pheromone data
 */
interface PheromoneInput {
  type: 'guide_pheromone' | 'warn_pheromone';
  message: string;
  strength: number;
  context: string;
}

/**
 * Interface for improvement proposals
 */
interface ImprovementProposals {
  codeStandards: string[];
  configChanges: string[];
  priority: 'low' | 'medium' | 'high';
  rationale: string;
}

/**
 * Interface for governor analysis input
 */
interface GovernorAnalysisInput {
  costData: CostData;
  qualityData: QualityAnalysis;
  budgetStatus: BudgetEnforcement;
}

/**
 * Interface for governor execution results
 */
interface GovernorResult {
  costMonitoring: CostData;
  budgetEnforcement: BudgetEnforcement;
  qualityAnalysis: QualityAnalysis;
  pheromones: PheromoneInput[];
  improvements: ImprovementProposals;
}

/**
 * GovernorAgent (Meta-Strategist) monitors project costs, enforces budgets,
 * analyzes quality, and provides strategic guidance through pheromones.
 */
export class GovernorAgent extends Agent {
  private configService: ConfigService | null = null;
  private projectConfig: ProjectConfig | null = null;

  /**
   * Initialize the Governor agent with configuration
   */
  async initialize(config: AgentConfig): Promise<void> {
    await super.initialize(config);
    
    if (config.workspaceRoot) {
      this.configService = new ConfigService(config.workspaceRoot);
      this.projectConfig = this.configService.loadProjectConfig();
    }
  }

  /**
   * Execute governor oversight task
   */
  async executeTask(): Promise<GovernorResult> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    await this.reportProgress('started', 'Beginning governor oversight analysis');

    try {
      // Monitor API costs
      const costData = await this.monitorCosts();
      
      // Enforce budget limits
      const budgetStatus = await this.enforceBudgets(costData);
      
      // Analyze test results and quality
      const qualityData = await this.analyzeTestResults();
      
      // Generate pheromones based on analysis
      const pheromones = await this.generatePheromones(costData, budgetStatus, qualityData);
      await this.createPheromones(pheromones);
      
      // Propose improvements
      const improvements = await this.proposeImprovements({
        costData,
        qualityData,
        budgetStatus
      });
      
      await this.reportProgress('completed', 'Governor oversight analysis completed');
      
      return {
        costMonitoring: costData,
        budgetEnforcement: budgetStatus,
        qualityAnalysis: qualityData,
        pheromones,
        improvements
      };
    } catch (error) {
      await this.reportProgress('error', `Governor analysis failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get governor-specific prompt template
   */
  getPromptTemplate(): string {
    return `Meta-Strategist Governor for project oversight and strategic guidance.

TASK: {{task}} | CONTEXT: {{context}} | PROJECT: {{projectName}}
COSTS: {{costs}} | BUDGET: {{budget}} | TESTS: {{testResults}}

Responsibilities: Cost monitoring, budget enforcement, quality analysis, strategic guidance via pheromones, improvement proposals.
Focus on strategic oversight and optimization.`;
  }

  /**
   * Monitor project costs via Cognitive Canvas queries
   */
  async monitorCosts(): Promise<CostData> {
    try {
      const claudeUsage = this.claudeClient?.getTokenUsage();
      
      // Default values for missing or invalid data
      const totalTokens = Math.max(0, claudeUsage?.totalTokens || 0);
      const totalCost = Math.max(0, claudeUsage?.estimatedCost || 0);
      
      // Calculate breakdown based on project config
      const claudeCost = totalCost * 0.8; // Estimate 80% Claude usage
      const geminiCost = totalCost * 0.2; // Estimate 20% Gemini usage
      
      return {
        totalTokens: isNaN(totalTokens) ? 0 : totalTokens,
        totalCost: isNaN(totalCost) ? 0 : totalCost,
        breakdown: {
          claude: isNaN(claudeCost) ? 0 : claudeCost,
          gemini: isNaN(geminiCost) ? 0 : geminiCost
        }
      };
    } catch (error) {
      // Return safe defaults on error
      return {
        totalTokens: 0,
        totalCost: 0,
        breakdown: { claude: 0, gemini: 0 }
      };
    }
  }

  /**
   * Enforce budget limits from config.json
   */
  async enforceBudgets(costData: CostData): Promise<BudgetEnforcement> {
    if (!this.projectConfig) {
      return {
        tokenLimitExceeded: false,
        costLimitExceeded: false,
        allowContinue: true,
        warnings: [],
        recommendations: []
      };
    }

    const tokenLimit = this.projectConfig.budget.maxTokens;
    const costLimit = this.projectConfig.budget.maxCost;
    
    const tokenUtilization = costData.totalTokens / tokenLimit;
    const costUtilization = costData.totalCost / costLimit;
    
    const tokenLimitExceeded = costData.totalTokens > tokenLimit;
    const costLimitExceeded = costData.totalCost > costLimit;
    
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // Check for approaching limits (90% threshold)
    if (tokenUtilization >= 0.9) {
      warnings.push('approaching token limit');
    }
    if (costUtilization >= 0.9) {
      warnings.push('approaching cost limit');
    }
    
    // Generate recommendations based on usage
    if (tokenLimitExceeded || tokenUtilization > 0.8) {
      recommendations.push('reduce token usage');
      recommendations.push('optimize prompt efficiency');
    }
    if (costLimitExceeded || costUtilization > 0.8) {
      recommendations.push('consider increasing budget');
      recommendations.push('use more cost-effective models');
    }
    
    return {
      tokenLimitExceeded,
      costLimitExceeded,
      allowContinue: !tokenLimitExceeded && !costLimitExceeded,
      warnings,
      recommendations
    };
  }

  /**
   * Analyze test results and quality reports
   */
  async analyzeTestResults(): Promise<QualityAnalysis> {
    if (!this.cognitiveCanvas || !this.currentTask) {
      return {
        totalTests: 0,
        passRate: 0,
        qualityScore: 0,
        issues: [],
        recommendations: []
      };
    }

    try {
      const tasks = await this.cognitiveCanvas.getTasksByProject(this.currentTask.projectId) as TaskDataWithMetadata[];
      
      let totalTests = 0;
      let passedTests = 0;
      const issues: string[] = [];
      const recommendations: string[] = [];
      
      for (const task of tasks) {
        const testResults = task.metadata?.testResults;
        if (testResults) {
          const passed = testResults.passed || 0;
          const failed = testResults.failed || 0;
          totalTests += passed + failed;
          passedTests += passed;
          
          // Identify quality issues
          const taskPassRate = (passed + failed) > 0 ? passed / (passed + failed) : 0;
          if (taskPassRate < 0.7) {
            issues.push(`low test pass rate in ${task.title}`);
          }
        }
      }
      
      const passRate = totalTests > 0 ? passedTests / totalTests : 0;
      const qualityScore = this.calculateQualityScore(passRate, totalTests, issues.length);
      
      // Generate recommendations
      if (passRate < 0.7) {
        issues.push('low test pass rate');
        recommendations.push('improve test coverage');
        recommendations.push('fix failing tests');
      }
      if (totalTests === 0) {
        issues.push('no test data available');
        recommendations.push('implement testing framework');
      }
      
      return {
        totalTests,
        passRate,
        qualityScore,
        issues,
        recommendations
      };
    } catch (error) {
      // Re-throw error to be caught by executeTask
      throw new Error(`Quality analysis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Create guide and warning pheromones
   */
  async createPheromones(pheromones: PheromoneInput[]): Promise<void> {
    if (!this.cognitiveCanvas) {
      return;
    }

    try {
      for (const pheromone of pheromones) {
        const pheromoneData = {
          id: `${pheromone.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: pheromone.type,
          strength: pheromone.strength,
          context: pheromone.context,
          metadata: {
            message: pheromone.message,
            agentId: this.config?.id,
            taskId: this.currentTask?.id,
            createdBy: 'governor'
          },
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour expiry
        };
        
        await this.cognitiveCanvas.createPheromone(pheromoneData);
      }
    } catch (error) {
      console.warn('Failed to create pheromones:', (error as Error).message);
    }
  }

  /**
   * Propose improvements to code standards or configuration
   */
  async proposeImprovements(analysisData: GovernorAnalysisInput): Promise<ImprovementProposals> {
    const codeStandards: string[] = [];
    const configChanges: string[] = [];
    let priority: 'low' | 'medium' | 'high' = 'low';
    
    // Analyze cost issues
    if (analysisData.budgetStatus.tokenLimitExceeded || analysisData.budgetStatus.costLimitExceeded) {
      priority = 'high';
      configChanges.push('increase budget limits');
      codeStandards.push('implement prompt caching');
      codeStandards.push('optimize API call frequency');
    }
    
    // Analyze quality issues
    if (analysisData.qualityData.passRate < 0.7) {
      if (priority !== 'high') priority = 'medium';
      codeStandards.push('improve test coverage');
      codeStandards.push('implement code review process');
      codeStandards.push('add quality gates');
    }
    
    // Generate warnings for approaching limits
    if (analysisData.budgetStatus.warnings.length > 0) {
      if (priority === 'low') priority = 'medium';
      codeStandards.push('monitor usage patterns');
      configChanges.push('adjust budget alerts');
    }
    
    const rationale = this.buildRationale(analysisData);
    
    return {
      codeStandards,
      configChanges,
      priority,
      rationale
    };
  }

  /**
   * Generate pheromones based on analysis results
   */
  private async generatePheromones(costData: CostData, budgetStatus: BudgetEnforcement, qualityData: QualityAnalysis): Promise<PheromoneInput[]> {
    const pheromones: PheromoneInput[] = [];
    
    if (budgetStatus.costLimitExceeded) {
      pheromones.push({ type: 'warn_pheromone', message: 'Budget limit exceeded - reduce API calls', strength: 0.9, context: 'budget_critical' });
    } else if (budgetStatus.warnings.length > 0) {
      pheromones.push({ type: 'warn_pheromone', message: 'Budget limit approaching - optimize usage', strength: 0.7, context: 'budget_warning' });
    }
    
    if (qualityData.passRate < 0.5) {
      pheromones.push({ type: 'warn_pheromone', message: 'Test coverage is critically low', strength: 0.8, context: 'quality_warning' });
    } else if (qualityData.passRate > 0.9) {
      pheromones.push({ type: 'guide_pheromone', message: 'Excellent test coverage - maintain standards', strength: 0.6, context: 'quality_praise' });
    }
    
    if (costData.totalTokens > 10000) {
      pheromones.push({ type: 'guide_pheromone', message: 'Use caching to reduce API calls', strength: 0.6, context: 'optimization' });
    }
    
    return pheromones;
  }

  /**
   * Calculate quality score and build rationale
   */
  private calculateQualityScore(passRate: number, totalTests: number, issueCount: number): number {
    if (totalTests === 0) return 0;
    let score = passRate + (totalTests > 0 ? 0.1 : 0) - (issueCount * 0.1);
    return Math.max(0, Math.min(1, score));
  }

  private buildRationale(analysisData: GovernorAnalysisInput): string {
    const reasons: string[] = [];
    if (analysisData.budgetStatus.tokenLimitExceeded) reasons.push('token budget exceeded');
    if (analysisData.budgetStatus.costLimitExceeded) reasons.push('cost budget exceeded');
    if (analysisData.qualityData.passRate < 0.7) reasons.push('low test pass rate');
    if (analysisData.qualityData.totalTests === 0) reasons.push('no test coverage');
    return reasons.length > 0 ? `Improvements needed due to: ${reasons.join(', ')}` : 'Proactive improvements to maintain project health';
  }
}