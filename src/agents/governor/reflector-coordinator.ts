import { CognitiveCanvas, PheromoneData } from '../../cognitive-canvas';
import { ReflectorSpawnAnalysis, GovernorAnalysisInput } from './types';

/**
 * ReflectorCoordinator handles Reflector agent spawning and coordination for the Governor agent
 */
export class ReflectorCoordinator {
  private lastReflectorSpawn: Date | null = null;
  private reflectorSpawnInterval: number = 3600000; // Default 1 hour

  constructor(
    private cognitiveCanvas: CognitiveCanvas | null,
    private config: any | null,
    private currentTask: any | null
  ) {}

  /**
   * Analyze whether a Reflector agent should be spawned
   */
  async analyzeReflectorSpawningNeeds(analysisData: GovernorAnalysisInput): Promise<ReflectorSpawnAnalysis> {
    const reasons: string[] = [];
    const focusAreas: string[] = [];
    const triggers: string[] = [];
    let priority: 'low' | 'medium' | 'high' = 'low';
    let recommendedInterval = this.reflectorSpawnInterval;
    
    // Check time-based spawning triggers
    const timeSinceLastSpawn = this.lastReflectorSpawn 
      ? Date.now() - this.lastReflectorSpawn.getTime()
      : Infinity;
    
    if (timeSinceLastSpawn > this.reflectorSpawnInterval) {
      triggers.push('scheduled_interval');
      reasons.push('scheduled reflection cycle due');
      focusAreas.push('periodic system analysis');
    }
    
    // Check for persistent quality issues
    if (analysisData.qualityData.passRate < 0.5) {
      triggers.push('quality_critical');
      reasons.push('critically low quality metrics require system reflection');
      focusAreas.push('quality improvement strategies', 'testing methodology optimization');
      priority = 'high';
      recommendedInterval = Math.min(recommendedInterval, 1800000); // 30 minutes for critical issues
    }
    
    // Check for repeated budget violations
    if (analysisData.budgetStatus.costLimitExceeded || analysisData.budgetStatus.tokenLimitExceeded) {
      triggers.push('budget_violation');
      reasons.push('budget violations indicate need for strategic optimization');
      focusAreas.push('cost optimization patterns', 'resource allocation efficiency');
      if (priority !== 'high') priority = 'medium';
      recommendedInterval = Math.min(recommendedInterval, 2700000); // 45 minutes for budget issues
    }
    
    // Check for system efficiency issues
    if (analysisData.costData.totalTokens > 50000) {
      triggers.push('efficiency_concern');
      reasons.push('high token usage suggests optimization opportunities');
      focusAreas.push('agent coordination efficiency', 'prompt optimization');
      if (priority === 'low') priority = 'medium';
    }
    
    // Check for adaptation opportunities via pheromone analysis
    try {
      const recentPheromones = await this.cognitiveCanvas?.getPheromonesByType('impasse');
      if (recentPheromones && recentPheromones.length > 3) {
        triggers.push('coordination_impasse');
        reasons.push('multiple agent impasses suggest need for system-wide reflection');
        focusAreas.push('agent coordination patterns', 'persona optimization', 'workflow improvement');
        priority = 'high';
        recommendedInterval = Math.min(recommendedInterval, 1800000); // 30 minutes for coordination issues
      }
      
      // Check for warning pheromone patterns
      const warningPheromones = await this.cognitiveCanvas?.getPheromonesByType('warn_pheromone');
      if (warningPheromones && warningPheromones.length > 5) {
        triggers.push('warning_pattern');
        reasons.push('high volume of warning pheromones indicates systemic issues');
        focusAreas.push('risk pattern analysis', 'preventive optimization');
        if (priority === 'low') priority = 'medium';
      }
    } catch (error) {
      console.warn('Failed to analyze pheromones for Reflector spawning:', error);
    }
    
    // Check for prompt improvement opportunities
    if (this.shouldAnalyzePromptPerformance()) {
      triggers.push('prompt_performance');
      reasons.push('prompt performance analysis indicates potential improvements');
      focusAreas.push('prompt effectiveness analysis', 'persona optimization');
      if (priority === 'low') priority = 'medium';
    }
    
    return {
      shouldSpawn: reasons.length > 0,
      reason: reasons.join('; '),
      priority,
      focusAreas,
      triggers,
      recommendedInterval
    };
  }

  /**
   * Create enhanced Reflector agent spawn request (V3.0)
   */
  async requestReflectorSpawn(spawningAnalysis: ReflectorSpawnAnalysis): Promise<void> {
    if (!spawningAnalysis.shouldSpawn || !this.cognitiveCanvas) {
      return;
    }

    try {
      // Update interval based on analysis
      this.reflectorSpawnInterval = spawningAnalysis.recommendedInterval;
      this.lastReflectorSpawn = new Date();

      // Create high-priority pheromone requesting Reflector agent
      const reflectorRequest: PheromoneData = {
        id: `reflector-request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'reflector_request',
        strength: spawningAnalysis.priority === 'high' ? 0.95 : spawningAnalysis.priority === 'medium' ? 0.8 : 0.6,
        context: 'system_reflection_needed',
        metadata: {
          reason: spawningAnalysis.reason,
          priority: spawningAnalysis.priority,
          focusAreas: spawningAnalysis.focusAreas,
          triggers: spawningAnalysis.triggers,
          requestedBy: this.config?.id,
          nextRecommendedSpawn: new Date(Date.now() + spawningAnalysis.recommendedInterval).toISOString(),
          analysisContext: {
            timestamp: new Date().toISOString(),
            projectId: this.currentTask?.projectId,
            taskId: this.currentTask?.id,
            version: '3.0'
          }
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (spawningAnalysis.priority === 'high' ? 14400000 : 7200000)).toISOString() // 4h for high, 2h for others
      };

      await this.cognitiveCanvas.createPheromone(reflectorRequest);
      
      console.log(`Governor requested Reflector agent spawn (V3.0): ${spawningAnalysis.reason}`);
      console.log(`Triggers: ${spawningAnalysis.triggers.join(', ')}`);
      console.log(`Next spawn recommended in: ${Math.round(spawningAnalysis.recommendedInterval / 60000)} minutes`);
    } catch (error) {
      console.error(`Failed to request Reflector spawn: ${(error as Error).message}`);
    }
  }

  /**
   * Check if prompt performance should be analyzed
   */
  private shouldAnalyzePromptPerformance(): boolean {
    // Implementation logic for prompt performance analysis
    // This is a placeholder that could be enhanced with actual performance metrics
    return false;
  }

  /**
   * Get the last reflector spawn time
   */
  getLastReflectorSpawn(): Date | null {
    return this.lastReflectorSpawn;
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