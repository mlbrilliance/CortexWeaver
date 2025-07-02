import { ClaudeClient } from '../../claude-client';
import { CognitiveCanvas, TaskData } from '../../cognitive-canvas';
import { ProjectConfig } from '../../config';
import { CostData } from './types';

/**
 * CostMonitor handles cost tracking and analytics for the Governor agent
 */
export class CostMonitor {
  constructor(
    private claudeClient: ClaudeClient | null,
    private cognitiveCanvas: CognitiveCanvas | null,
    private projectConfig: ProjectConfig | null,
    private currentTask: any | null
  ) {}

  /**
   * Monitor project costs via Cognitive Canvas queries (V3.0 Enhanced)
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
      
      const baseCostData: CostData = {
        totalTokens: isNaN(totalTokens) ? 0 : totalTokens,
        totalCost: isNaN(totalCost) ? 0 : totalCost,
        breakdown: {
          claude: isNaN(claudeCost) ? 0 : claudeCost,
          gemini: isNaN(geminiCost) ? 0 : geminiCost
        }
      };

      // V3.0: Enhanced analytics
      try {
        const enhancedData = await this.calculateEnhancedCostAnalytics(baseCostData);
        return { ...baseCostData, ...enhancedData };
      } catch (error) {
        console.warn('Failed to calculate enhanced cost analytics:', error);
        return baseCostData;
      }
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
   * Calculate enhanced cost analytics (V3.0)
   */
  private async calculateEnhancedCostAnalytics(baseCostData: CostData): Promise<Partial<CostData>> {
    const analytics: Partial<CostData> = {};

    // Calculate hourly rate and projections
    const currentHour = new Date().getHours();
    const hoursElapsed = currentHour > 0 ? currentHour : 1;
    analytics.hourlyRate = baseCostData.totalCost / hoursElapsed;
    analytics.dailyProjection = analytics.hourlyRate * 24;

    // V3.0: Agent-level cost tracking via Cognitive Canvas
    if (this.cognitiveCanvas && this.currentTask) {
      try {
        const tasks = await this.cognitiveCanvas.getTasksByProject(this.currentTask.projectId);
        analytics.costByAgent = {};
        analytics.tokensByAgent = {};

        // Estimate cost per agent based on task completion
        const completedTasks = tasks.filter(t => t.status === 'completed');
        const avgCostPerTask = completedTasks.length > 0 ? baseCostData.totalCost / completedTasks.length : 0;
        const avgTokensPerTask = completedTasks.length > 0 ? baseCostData.totalTokens / completedTasks.length : 0;

        // Group by agent assignments (simplified - would need actual agent tracking)
        for (const task of completedTasks) {
          const agentType = task.metadata?.agentType || 'unknown';
          analytics.costByAgent![agentType] = (analytics.costByAgent![agentType] || 0) + avgCostPerTask;
          analytics.tokensByAgent![agentType] = (analytics.tokensByAgent![agentType] || 0) + avgTokensPerTask;
        }

        // Calculate efficiency metrics
        analytics.efficiency = {
          tokensPerTask: avgTokensPerTask,
          costPerTask: avgCostPerTask,
          successRateImpact: this.calculateSuccessRateImpact(tasks)
        };

      } catch (error) {
        console.warn('Failed to calculate agent-level cost analytics:', error);
      }
    }

    // Calculate cost trends (simplified - would need historical data)
    analytics.costTrend = {
      last24h: baseCostData.totalCost, // Simplified - same as current
      last7d: baseCostData.totalCost * 7, // Estimated
      projectedDaily: analytics.dailyProjection || 0,
      projectedWeekly: (analytics.dailyProjection || 0) * 7
    };

    return analytics;
  }

  /**
   * Calculate success rate impact on costs
   */
  private calculateSuccessRateImpact(tasks: TaskData[]): number {
    if (tasks.length === 0) return 0;

    const completedTasks = tasks.filter(t => t.status === 'completed');
    const failedTasks = tasks.filter(t => t.status === 'failed' || t.status === 'error');
    
    const successRate = completedTasks.length / tasks.length;
    const failureImpact = failedTasks.length * 0.5; // Assume failures cost 50% more to resolve
    
    return Math.max(0, 1 - (failureImpact / tasks.length)) * successRate;
  }
}