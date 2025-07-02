import { ProjectConfig } from '../../config';
import { BudgetEnforcement, CostData } from './types';

/**
 * BudgetEnforcer handles budget limits and enforcement for the Governor agent
 */
export class BudgetEnforcer {
  constructor(private projectConfig: ProjectConfig | null) {}

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
   * Update project config reference
   */
  updateProjectConfig(projectConfig: ProjectConfig | null): void {
    this.projectConfig = projectConfig;
  }
}