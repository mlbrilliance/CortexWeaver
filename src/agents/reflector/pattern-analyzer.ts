import { CognitiveCanvas } from '../../cognitive-canvas';
import { 
  PatternAnalysis, 
  PerformancePattern, 
  TaskDataWithMetadata 
} from './types';

/**
 * PatternAnalyzer handles performance pattern analysis for the Reflector agent
 */
export class PatternAnalyzer {
  constructor(
    private cognitiveCanvas: CognitiveCanvas | null,
    private currentTask: any | null
  ) {}

  /**
   * Analyze performance patterns from historical task data
   */
  async analyzePerformancePatterns(): Promise<PatternAnalysis> {
    if (!this.cognitiveCanvas || !this.currentTask) {
      throw new Error('Cognitive Canvas or current task not available');
    }

    try {
      // Get historical task data
      const tasks = await this.cognitiveCanvas.getTasksByProject(this.currentTask.projectId) as TaskDataWithMetadata[];
      
      if (!tasks || tasks.length === 0) {
        return {
          successPatterns: [],
          failurePatterns: [],
          correlations: {
            promptVersions: {},
            codePatterns: {},
            timeBasedTrends: []
          }
        };
      }

      // Analyze patterns
      const patterns = this.extractPatterns(tasks);
      const successPatterns = this.analyzeSuccessPatterns(patterns, tasks);
      const failurePatterns = this.analyzeFailurePatterns(patterns, tasks);
      const correlations = this.analyzeCorrelations(tasks);

      return {
        successPatterns,
        failurePatterns,
        correlations
      };
    } catch (error) {
      throw new Error(`Performance pattern analysis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Extract patterns from task metadata
   */
  private extractPatterns(tasks: TaskDataWithMetadata[]): Set<string> {
    const patterns = new Set<string>();
    tasks.forEach(task => {
      if (task.metadata?.codePattern) {
        patterns.add(task.metadata.codePattern);
      }
    });
    return patterns;
  }

  /**
   * Analyze successful patterns and their performance metrics
   */
  private analyzeSuccessPatterns(patterns: Set<string>, tasks: TaskDataWithMetadata[]): PerformancePattern[] {
    const successPatterns: PerformancePattern[] = [];

    patterns.forEach(pattern => {
      const patternTasks = tasks.filter(t => t.metadata?.codePattern === pattern);
      const successfulTasks = patternTasks.filter(t => t.status === 'completed');
      
      if (successfulTasks.length > 0) {
        const successRate = successfulTasks.length / patternTasks.length;
        const avgExecutionTime = successfulTasks.reduce((sum, task) => 
          sum + (task.metadata?.performance?.executionTime || 0), 0) / successfulTasks.length;
        
        const avgMemoryUsage = successfulTasks.reduce((sum, task) => 
          sum + (task.metadata?.performance?.memoryUsage || 0), 0) / successfulTasks.length;

        const testPassRates = successfulTasks
          .filter(t => t.metadata?.testResults)
          .map(t => {
            const tests = t.metadata!.testResults!;
            return tests.passed / (tests.passed + tests.failed);
          });
        
        const avgTestPassRate = testPassRates.length > 0 
          ? testPassRates.reduce((sum, rate) => sum + rate, 0) / testPassRates.length 
          : 0;

        successPatterns.push({
          pattern,
          successRate,
          avgPerformance: {
            executionTime: avgExecutionTime,
            memoryUsage: avgMemoryUsage || undefined,
            testPassRate: avgTestPassRate || undefined
          },
          frequency: patternTasks.length
        });
      }
    });

    return successPatterns.sort((a, b) => (b.successRate || 0) - (a.successRate || 0));
  }

  /**
   * Analyze failure patterns and common issues
   */
  private analyzeFailurePatterns(patterns: Set<string>, tasks: TaskDataWithMetadata[]): PerformancePattern[] {
    const failurePatterns: PerformancePattern[] = [];

    patterns.forEach(pattern => {
      const patternTasks = tasks.filter(t => t.metadata?.codePattern === pattern);
      const failedTasks = patternTasks.filter(t => t.status === 'failed' || t.status === 'error');
      
      if (failedTasks.length > 0) {
        const failureRate = failedTasks.length / patternTasks.length;
        const commonIssues = Array.from(new Set(failedTasks
          .map(t => t.metadata?.failureReason)
          .filter((reason): reason is string => reason !== undefined)));

        failurePatterns.push({
          pattern,
          failureRate,
          commonIssues,
          frequency: patternTasks.length
        });
      }
    });

    return failurePatterns.sort((a, b) => (b.failureRate || 0) - (a.failureRate || 0));
  }

  /**
   * Analyze correlations between patterns, prompts, and performance
   */
  private analyzeCorrelations(tasks: TaskDataWithMetadata[]): PatternAnalysis['correlations'] {
    const promptVersions: Record<string, { successRate: number; sampleSize: number }> = {};
    const codePatterns: Record<string, { successRate: number; avgPerformance: any }> = {};

    // Analyze prompt versions
    tasks.forEach(task => {
      const promptVersion = task.metadata?.promptVersion;
      if (promptVersion) {
        if (!promptVersions[promptVersion]) {
          promptVersions[promptVersion] = { successRate: 0, sampleSize: 0 };
        }
        const data = promptVersions[promptVersion];
        data.sampleSize++;
        const isSuccess = task.status === 'completed';
        data.successRate = ((data.successRate * (data.sampleSize - 1)) + (isSuccess ? 1 : 0)) / data.sampleSize;
      }
    });

    // Analyze code patterns
    tasks.forEach(task => {
      const codePattern = task.metadata?.codePattern;
      if (codePattern) {
        if (!codePatterns[codePattern]) {
          codePatterns[codePattern] = { successRate: 0, avgPerformance: {} };
        }
        const data = codePatterns[codePattern];
        const isSuccess = task.status === 'completed';
        data.successRate = isSuccess ? 1 : 0; // Simplified - would need proper running average
        if (task.metadata?.performance) {
          data.avgPerformance = task.metadata.performance;
        }
      }
    });

    // Analyze time-based trends
    const timeBasedTrends = this.analyzeTimeBasedTrends(tasks);

    return {
      promptVersions,
      codePatterns,
      timeBasedTrends
    };
  }

  /**
   * Analyze time-based performance trends
   */
  private analyzeTimeBasedTrends(tasks: TaskDataWithMetadata[]): Array<{ period: string; successRate: number; patterns: string[] }> {
    const trends: Array<{ period: string; successRate: number; patterns: string[] }> = [];
    
    // Group tasks by time periods (simplified implementation)
    const now = new Date();
    const periods = [
      { name: 'last_hour', cutoff: new Date(now.getTime() - 3600000) },
      { name: 'last_day', cutoff: new Date(now.getTime() - 86400000) },
      { name: 'last_week', cutoff: new Date(now.getTime() - 604800000) }
    ];

    for (const period of periods) {
      const periodTasks = tasks.filter(task => {
        const taskTime = new Date(task.createdAt);
        return taskTime >= period.cutoff;
      });

      if (periodTasks.length > 0) {
        const successfulTasks = periodTasks.filter(t => t.status === 'completed');
        const successRate = successfulTasks.length / periodTasks.length;
        const patterns = Array.from(new Set(periodTasks
          .map(t => t.metadata?.codePattern)
          .filter((pattern): pattern is string => pattern !== undefined)
        ));

        trends.push({
          period: period.name,
          successRate,
          patterns
        });
      }
    }

    return trends;
  }

  /**
   * Update references for dependency injection
   */
  updateReferences(cognitiveCanvas: CognitiveCanvas | null, currentTask: any | null): void {
    this.cognitiveCanvas = cognitiveCanvas;
    this.currentTask = currentTask;
  }
}