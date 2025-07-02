import { CognitiveCanvas } from '../../cognitive-canvas';
import { QualityAnalysis, TaskDataWithMetadata } from './types';

/**
 * QualityAnalyzer handles test results and quality analysis for the Governor agent
 */
export class QualityAnalyzer {
  constructor(
    private cognitiveCanvas: CognitiveCanvas | null,
    private currentTask: any | null
  ) {}

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
   * Calculate quality score based on test results
   */
  private calculateQualityScore(passRate: number, totalTests: number, issueCount: number): number {
    if (totalTests === 0) return 0;
    let score = passRate + (totalTests > 0 ? 0.1 : 0) - (issueCount * 0.1);
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Update cognitive canvas and current task references
   */
  updateReferences(cognitiveCanvas: CognitiveCanvas | null, currentTask: any | null): void {
    this.cognitiveCanvas = cognitiveCanvas;
    this.currentTask = currentTask;
  }
}