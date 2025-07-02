import { CognitiveCanvas, PheromoneData } from '../../cognitive-canvas';
import { PatternAnalysis, PheromoneInput } from './types';

/**
 * PheromoneGenerator handles pheromone creation and management for the Reflector agent
 */
export class PheromoneGenerator {
  constructor(
    private cognitiveCanvas: CognitiveCanvas | null,
    private config: any | null,
    private currentTask: any | null
  ) {}

  /**
   * Generate guide and warning pheromones based on pattern analysis
   */
  async generatePheromones(patterns: PatternAnalysis): Promise<PheromoneInput[]> {
    const pheromones: PheromoneInput[] = [];

    // Generate guide pheromones for successful patterns
    patterns.successPatterns.forEach(pattern => {
      if (pattern.successRate && pattern.successRate > 0.8) {
        pheromones.push({
          type: 'guide_pheromone',
          strength: Math.min(0.9, pattern.successRate),
          context: `pattern_success_${pattern.pattern}`,
          message: `Pattern '${pattern.pattern}' shows high success rate (${Math.round(pattern.successRate * 100)}%). Recommended approach for similar tasks.`
        });
      }
    });

    // Generate warning pheromones for failure patterns
    patterns.failurePatterns.forEach(pattern => {
      if (pattern.failureRate && pattern.failureRate > 0.6) {
        pheromones.push({
          type: 'warn_pheromone',
          strength: Math.min(0.9, pattern.failureRate),
          context: `pattern_failure_${pattern.pattern}`,
          message: `Pattern '${pattern.pattern}' has high failure rate (${Math.round(pattern.failureRate * 100)}%). Avoid or revise approach. Common issues: ${pattern.commonIssues?.join(', ') || 'Multiple issues'}.`
        });
      }
    });

    // Generate pheromones for prompt version correlations
    Object.entries(patterns.correlations.promptVersions).forEach(([version, data]) => {
      if (data.successRate > 0.85 && data.sampleSize >= 3) {
        pheromones.push({
          type: 'guide_pheromone',
          strength: 0.7,
          context: `prompt_version_${version}`,
          message: `Prompt version '${version}' shows excellent results (${Math.round(data.successRate * 100)}% success rate). Consider using for similar tasks.`
        });
      } else if (data.successRate < 0.4 && data.sampleSize >= 3) {
        pheromones.push({
          type: 'warn_pheromone',
          strength: 0.8,
          context: `prompt_version_${version}`,
          message: `Prompt version '${version}' underperforming (${Math.round(data.successRate * 100)}% success rate). Requires revision or replacement.`
        });
      }
    });

    return pheromones;
  }

  /**
   * Create pheromones in Cognitive Canvas
   */
  async createPheromones(pheromones: PheromoneInput[]): Promise<void> {
    if (!this.cognitiveCanvas) {
      return;
    }

    try {
      for (const pheromone of pheromones) {
        const pheromoneData: PheromoneData = {
          id: `${pheromone.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: pheromone.type,
          strength: pheromone.strength,
          context: pheromone.context,
          metadata: {
            message: pheromone.message,
            agentId: this.config?.id,
            taskId: this.currentTask?.id,
            createdBy: 'reflector',
            analysisType: 'performance_pattern'
          },
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7200000).toISOString() // 2 hours expiry
        };
        
        await this.cognitiveCanvas.createPheromone(pheromoneData);
      }
    } catch (error) {
      console.warn('Failed to create pheromones:', (error as Error).message);
    }
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