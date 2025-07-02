import { CognitiveCanvas } from '../../cognitive-canvas';
import { 
  PheromoneInput, 
  CostData, 
  BudgetEnforcement, 
  QualityAnalysis, 
  ImprovementProposals, 
  GovernorAnalysisInput 
} from './types';

/**
 * PheromoneManager handles pheromone creation and improvement proposals for the Governor agent
 */
export class PheromoneManager {
  constructor(
    private cognitiveCanvas: CognitiveCanvas | null,
    private config: any | null,
    private currentTask: any | null
  ) {}

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
  async generatePheromones(costData: CostData, budgetStatus: BudgetEnforcement, qualityData: QualityAnalysis): Promise<PheromoneInput[]> {
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
   * Build rationale for improvement proposals
   */
  private buildRationale(analysisData: GovernorAnalysisInput): string {
    const reasons: string[] = [];
    if (analysisData.budgetStatus.tokenLimitExceeded) reasons.push('token budget exceeded');
    if (analysisData.budgetStatus.costLimitExceeded) reasons.push('cost budget exceeded');
    if (analysisData.qualityData.passRate < 0.7) reasons.push('low test pass rate');
    if (analysisData.qualityData.totalTests === 0) reasons.push('no test coverage');
    return reasons.length > 0 ? `Improvements needed due to: ${reasons.join(', ')}` : 'Proactive improvements to maintain project health';
  }

  /**
   * Update references for dependency injection
   */
  updateReferences(cognitiveCanvas: CognitiveCanvas | null, config: any | null, currentTask: any | null): void {
    this.cognitiveCanvas = cognitiveCanvas;
    this.config = config;
    this.currentTask = currentTask;
  }
}