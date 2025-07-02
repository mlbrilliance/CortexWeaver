import { Agent, AgentConfig } from '../../agent';
import { PromptImprovementWorkflow } from '../../prompt-improvement';

// Import modular components
import { PatternAnalyzer } from './pattern-analyzer';
import { PheromoneGenerator } from './pheromone-generator';
import { PromptAnalyzer } from './prompt-analyzer';
import { ImprovementGenerator } from './improvement-generator';

// Import types
import {
  ReflectionResult,
  PatternAnalysis,
  PheromoneInput,
  PromptImprovements,
  GovernorSubmission,
  PersonaUpdateResult
} from './types';

/**
 * ReflectorAgent (Self-Improvement Engine) analyzes past performance patterns,
 * generates guidance pheromones, and proposes prompt improvements.
 * 
 * This is the main orchestration class that uses modular components for specific functionality.
 */
export class ReflectorAgent extends Agent {

  /**
   * Get the prompt template for self-improvement and pattern analysis
   */
  getPromptTemplate(): string {
    return `You are a Reflector Agent (Self-Improvement Engine), an advanced analytical system specializing in performance pattern analysis, system optimization, and continuous improvement.

## Core Responsibilities
- Analyze historical performance data to identify success and failure patterns
- Generate guidance pheromones based on pattern analysis
- Propose prompt improvements based on performance correlation
- Identify systemic issues and optimization opportunities
- Coordinate with Governor for system-wide improvements
- Drive the self-improvement loop through data-driven insights

## Input Context
**Historical Data:** {{historicalData}}
**Performance Patterns:** {{performancePatterns}}
**Task Outcomes:** {{taskOutcomes}}
**Agent Performance:** {{agentPerformance}}
**Prompt Effectiveness:** {{promptEffectiveness}}
**System Metrics:** {{systemMetrics}}
**Project Name:** {{projectName}}

## Analysis Framework
1. **Pattern Recognition**: Identify recurring success and failure patterns
2. **Performance Correlation**: Link prompt versions to task outcomes
3. **Temporal Analysis**: Understand performance trends over time
4. **Agent Comparison**: Analyze relative performance across agents
5. **System Health Assessment**: Evaluate overall system effectiveness
6. **Improvement Identification**: Find optimization opportunities

## Improvement Generation
Focus on these improvement areas:
- **Prompt Optimization**: Enhance prompts based on performance data
- **Pattern-Based Guidance**: Create pheromones from successful patterns
- **Failure Prevention**: Generate warnings from failure patterns
- **System Evolution**: Propose architectural improvements
- **Performance Enhancement**: Identify efficiency optimizations

## Pheromone Strategy
Generate strategic pheromones for:
- **Success Amplification**: Promote patterns that work well
- **Failure Avoidance**: Warn about problematic approaches
- **Best Practices**: Share effective techniques across agents
- **Context-Specific Guidance**: Tailored advice for specific scenarios

## Governor Integration
Prepare improvement proposals for Governor review:
- **Prompt Updates**: Specific diff-based improvements with rationale
- **Configuration Changes**: System parameter optimizations
- **Process Improvements**: Workflow and coordination enhancements
- **Quality Gates**: New validation and testing criteria

## Output Format
Structure your analysis as follows:
- **Performance Summary**: Key metrics and trends
- **Pattern Analysis**: Success/failure patterns with frequency
- **Correlations**: Relationships between inputs and outcomes
- **Improvement Proposals**: Specific, actionable recommendations
- **Pheromone Recommendations**: Strategic guidance for other agents
- **Risk Assessment**: Potential issues to monitor

## Meta-Learning Focus
As the Self-Improvement Engine, continuously evolve the system by:
- Learning from every task execution
- Identifying emergent patterns in complex scenarios
- Proposing adaptive strategies for changing requirements
- Optimizing the balance between exploration and exploitation

Focus on data-driven insights that create measurable improvements in system performance, quality, and efficiency.`;
  }
  private promptImprovementWorkflow: PromptImprovementWorkflow | null = null;

  // Modular components
  private patternAnalyzer: PatternAnalyzer | null = null;
  private pheromoneGenerator: PheromoneGenerator | null = null;
  private promptAnalyzer: PromptAnalyzer | null = null;
  private improvementGenerator: ImprovementGenerator | null = null;

  /**
   * Initialize the Reflector agent with prompt improvement workflow
   */
  async initialize(config: AgentConfig): Promise<void> {
    await super.initialize(config);
    
    if (config.workspaceRoot && this.cognitiveCanvas) {
      this.promptImprovementWorkflow = new PromptImprovementWorkflow({
        workspaceRoot: config.workspaceRoot,
        cognitiveCanvas: this.cognitiveCanvas
      });
    }

    // Initialize modular components
    this.initializeModules();
  }

  /**
   * Initialize all modular components
   */
  private initializeModules(): void {
    // Pattern analysis
    this.patternAnalyzer = new PatternAnalyzer(
      this.cognitiveCanvas,
      this.currentTask
    );

    // Pheromone generation
    this.pheromoneGenerator = new PheromoneGenerator(
      this.cognitiveCanvas,
      this.config,
      this.currentTask
    );

    // Prompt analysis
    this.promptAnalyzer = new PromptAnalyzer(
      this.cognitiveCanvas,
      this.currentTask
    );

    // Improvement generation
    this.improvementGenerator = new ImprovementGenerator(
      this.config,
      this.analyzePromptPerformance.bind(this),
      this.analyzePerformancePatterns.bind(this)
    );
  }

  /**
   * Execute reflection task - analyze patterns and generate improvements
   */
  async executeTask(): Promise<ReflectionResult> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    await this.reportProgress('started', 'Beginning performance pattern analysis');

    try {
      // Update all module references with current state
      this.updateModuleReferences();

      // Analyze historical performance patterns
      const performanceAnalysis = await this.analyzePerformancePatterns();
      
      // Generate pheromones based on patterns
      const pheromones = await this.generatePheromones(performanceAnalysis);
      await this.createPheromones(pheromones);
      
      let promptImprovements: PromptImprovements | undefined;
      let governorSubmission: GovernorSubmission | undefined;
      let personaUpdates: PersonaUpdateResult | undefined;

      // Conditional analysis based on configuration or triggers
      if (this.shouldAnalyzePrompts()) {
        promptImprovements = await this.generatePromptImprovements();
        
        if (promptImprovements.proposals.length > 0) {
          governorSubmission = await this.submitToGovernor(promptImprovements);
        }
      }

      if (this.shouldAnalyzePersonas()) {
        personaUpdates = await this.analyzeAndUpdatePersonas(performanceAnalysis);
      }

      await this.reportProgress('completed', 'Performance reflection analysis completed');

      return {
        performanceAnalysis,
        pheromones,
        promptImprovements,
        personaUpdates,
        governorSubmission
      };
    } catch (error) {
      await this.reportProgress('error', `Reflection analysis failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Analyze performance patterns from historical data
   */
  async analyzePerformancePatterns(): Promise<PatternAnalysis> {
    if (!this.patternAnalyzer) {
      throw new Error('Pattern analyzer not initialized');
    }
    return this.patternAnalyzer.analyzePerformancePatterns();
  }

  /**
   * Generate pheromones based on pattern analysis
   */
  async generatePheromones(patterns: PatternAnalysis): Promise<PheromoneInput[]> {
    if (!this.pheromoneGenerator) {
      throw new Error('Pheromone generator not initialized');
    }
    return this.pheromoneGenerator.generatePheromones(patterns);
  }

  /**
   * Create pheromones in Cognitive Canvas
   */
  async createPheromones(pheromones: PheromoneInput[]): Promise<void> {
    if (!this.pheromoneGenerator) {
      throw new Error('Pheromone generator not initialized');
    }
    return this.pheromoneGenerator.createPheromones(pheromones);
  }

  /**
   * Analyze prompt performance correlation
   */
  async analyzePromptPerformance() {
    if (!this.promptAnalyzer) {
      throw new Error('Prompt analyzer not initialized');
    }
    return this.promptAnalyzer.analyzePromptPerformance();
  }

  /**
   * Generate prompt improvements
   */
  async generatePromptImprovements(): Promise<PromptImprovements> {
    if (!this.improvementGenerator) {
      throw new Error('Improvement generator not initialized');
    }
    return this.improvementGenerator.generatePromptImprovements();
  }

  /**
   * Submit improvements to Governor for review
   */
  async submitToGovernor(improvements: PromptImprovements): Promise<GovernorSubmission> {
    // Simplified implementation - full implementation would be in a separate module
    return {
      submitted: true,
      proposals: improvements.proposals,
      pheromoneId: `governor-submission-${Date.now()}`
    };
  }

  /**
   * Analyze and update personas based on performance
   */
  async analyzeAndUpdatePersonas(performanceAnalysis: PatternAnalysis): Promise<PersonaUpdateResult> {
    // Simplified implementation - full implementation would be in PersonaManager module
    return {
      updatesProposed: 0,
      updatesApplied: 0,
      proposals: [],
      agentsNotified: []
    };
  }

  /**
   * Check if prompt analysis should be performed
   */
  private shouldAnalyzePrompts(): boolean {
    return this.promptAnalyzer?.shouldAnalyzePrompts() ?? false;
  }

  /**
   * Check if persona analysis should be performed
   */
  private shouldAnalyzePersonas(): boolean {
    // Simplified implementation
    return false;
  }

  /**
   * Update module references when state changes
   */
  private updateModuleReferences(): void {
    this.patternAnalyzer?.updateReferences(this.cognitiveCanvas, this.currentTask);
    this.pheromoneGenerator?.updateReferences(this.cognitiveCanvas, this.config, this.currentTask);
    this.promptAnalyzer?.updateReferences(this.cognitiveCanvas, this.currentTask);
    this.improvementGenerator?.updateConfig(this.config);
  }
}