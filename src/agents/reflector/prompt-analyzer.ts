import { CognitiveCanvas } from '../../cognitive-canvas';
import { 
  PromptAnalysis, 
  TaskDataWithMetadata 
} from './types';

/**
 * PromptAnalyzer handles prompt performance analysis for the Reflector agent
 */
export class PromptAnalyzer {
  constructor(
    private cognitiveCanvas: CognitiveCanvas | null,
    private currentTask: any | null
  ) {}

  /**
   * Analyze prompt performance correlation
   */
  async analyzePromptPerformance(): Promise<PromptAnalysis> {
    if (!this.cognitiveCanvas || !this.currentTask) {
      return {
        promptVersions: {},
        underperforming: [],
        recommendations: []
      };
    }

    try {
      const tasks = await this.cognitiveCanvas.getTasksByProject(this.currentTask.projectId) as TaskDataWithMetadata[];
      
      const promptVersions: Record<string, {
        successRate: number;
        avgExecutionTime: number;
        sampleSize: number;
        lastUsed: string;
      }> = {};

      const underperforming: Array<{
        version: string;
        issues: string[];
        suggestedImprovements: string[];
      }> = [];

      // Analyze prompt versions
      tasks.forEach(task => {
        const promptVersion = task.metadata?.promptVersion;
        if (!promptVersion) return;

        if (!promptVersions[promptVersion]) {
          promptVersions[promptVersion] = {
            successRate: 0,
            avgExecutionTime: 0,
            sampleSize: 0,
            lastUsed: task.createdAt
          };
        }

        const data = promptVersions[promptVersion];
        data.sampleSize++;
        
        const isSuccess = task.status === 'completed' && 
          (!task.metadata?.testResults || (task.metadata.testResults.passed / (task.metadata.testResults.passed + task.metadata.testResults.failed)) > 0.7);
        
        data.successRate = ((data.successRate * (data.sampleSize - 1)) + (isSuccess ? 1 : 0)) / data.sampleSize;
        
        if (task.metadata?.performance?.executionTime) {
          data.avgExecutionTime = ((data.avgExecutionTime * (data.sampleSize - 1)) + task.metadata.performance.executionTime) / data.sampleSize;
        }
        
        if (task.createdAt > data.lastUsed) {
          data.lastUsed = task.createdAt;
        }
      });

      // Identify underperforming prompts
      Object.entries(promptVersions).forEach(([version, data]) => {
        if (data.successRate < 0.6 && data.sampleSize >= 3) {
          const issues: string[] = [];
          const suggestedImprovements: string[] = [];

          if (data.successRate < 0.4) {
            issues.push('Very low success rate');
            suggestedImprovements.push('Complete prompt rewrite recommended');
          } else {
            issues.push('Below average success rate');
            suggestedImprovements.push('Refine prompt clarity and specificity');
          }

          if (data.avgExecutionTime > 200) {
            issues.push('High execution time');
            suggestedImprovements.push('Optimize for efficiency and reduce complexity');
          }

          underperforming.push({
            version,
            issues,
            suggestedImprovements
          });
        }
      });

      const recommendations = this.generatePromptRecommendations(promptVersions, underperforming);

      return {
        promptVersions,
        underperforming,
        recommendations
      };
    } catch (error) {
      console.warn('Prompt performance analysis failed:', (error as Error).message);
      return {
        promptVersions: {},
        underperforming: [],
        recommendations: []
      };
    }
  }

  /**
   * Generate recommendations based on prompt analysis
   */
  private generatePromptRecommendations(
    promptVersions: Record<string, any>,
    underperforming: Array<any>
  ): string[] {
    const recommendations: string[] = [];

    if (underperforming.length > 0) {
      recommendations.push('Review and revise underperforming prompt versions');
      recommendations.push('Consider A/B testing new prompt variations');
    }

    const highPerformingVersions = Object.entries(promptVersions)
      .filter(([_, data]) => data.successRate > 0.8 && data.sampleSize >= 3)
      .map(([version, _]) => version);

    if (highPerformingVersions.length > 0) {
      recommendations.push(`Replicate successful patterns from versions: ${highPerformingVersions.join(', ')}`);
    }

    if (Object.keys(promptVersions).length > 5) {
      recommendations.push('Consider consolidating prompt versions to reduce complexity');
    }

    return recommendations;
  }

  /**
   * Check if prompt analysis should be performed
   */
  shouldAnalyzePrompts(): boolean {
    // Simplified criteria - could be enhanced with actual performance metrics
    return true;
  }

  /**
   * Update references for dependency injection
   */
  updateReferences(cognitiveCanvas: CognitiveCanvas | null, currentTask: any | null): void {
    this.cognitiveCanvas = cognitiveCanvas;
    this.currentTask = currentTask;
  }
}