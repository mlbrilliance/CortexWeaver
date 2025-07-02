import { CognitiveCanvas } from '../cognitive-canvas';
import { SessionManager } from '../session';
import { CritiqueAgent, StructuredFeedback } from '../agents/critique';
import { DebuggerAgent } from '../agents/debugger';
import { AgentSpawner } from './agent-spawner';
import { WorkflowManager } from './workflow-manager';
import { ErrorHandlerStrategies, ErrorContext, RecoveryStrategy, ErrorHandlingResult } from './error-handler-strategies';

// Re-export types for backward compatibility
export { ErrorContext, RecoveryStrategy, ErrorHandlingResult } from './error-handler-strategies';

export class ErrorHandler {
  private strategies: ErrorHandlerStrategies;

  constructor(
    private canvas: CognitiveCanvas,
    private sessionManager: SessionManager,
    private agentSpawner: AgentSpawner,
    private workflowManager: WorkflowManager,
    private critiqueAgent: CritiqueAgent,
    private debuggerAgent: DebuggerAgent
  ) {
    this.strategies = new ErrorHandlerStrategies(
      canvas,
      sessionManager,
      agentSpawner,
      workflowManager
    );
  }

  /**
   * Handle task failure with appropriate recovery strategy
   */
  async handleTaskFailure(taskId: string, failure: any): Promise<ErrorHandlingResult> {
    try {
      console.log(`Handling task failure for task: ${taskId}`);

      const errorContext: ErrorContext = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: failure.type || 'system_failure',
        severity: failure.severity || 'medium',
        errorMessage: failure.errorMessage || failure.toString(),
        step: failure.step,
        taskId,
        timestamp: new Date().toISOString(),
        metadata: failure.metadata
      };

      // Store error context for analysis
      await this.strategies.storeErrorContext(errorContext);
      
      // Track error for statistics
      this.strategies.trackError(taskId, errorContext);

      // Analyze failure with Debugger agent if available
      let diagnosticResult = null;
      try {
        diagnosticResult = await this.debuggerAgent.analyzeFailure(errorContext.errorMessage);
      } catch (debugError) {
        console.warn('Debugger analysis failed:', debugError);
      }

      // Determine recovery strategy
      const strategy = await this.strategies.determineRecoveryStrategy(errorContext, diagnosticResult);

      // Execute recovery strategy
      const result = await this.strategies.executeRecoveryStrategy(taskId, strategy, errorContext);

      // Create warning pheromone if needed
      if (diagnosticResult && diagnosticResult.severity !== 'low') {
        await this.debuggerAgent.createWarnPheromone(
          `${diagnosticResult.errorType}: ${diagnosticResult.message}`,
          taskId
        );
      }

      return result;

    } catch (error) {
      console.error(`Error handling task failure for ${taskId}:`, error);
      return {
        success: false,
        strategy: { type: 'escalate', config: {} },
        message: `Failed to handle error: ${(error as Error).message}`,
        escalated: true
      };
    }
  }

  /**
   * Handle impasse situations
   */
  async handleImpasse(taskId: string): Promise<ErrorHandlingResult> {
    try {
      console.log(`Handling impasse for task: ${taskId}`);
      
      // Create error context for impasse
      const impasseError = {
        id: `impasse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'impasse',
        severity: 'medium',
        errorMessage: `Agent reported impasse for task ${taskId}`,
        taskId,
        timestamp: new Date().toISOString(),
        metadata: { phase: 'task_execution', agent_type: 'unknown' }
      };
      
      // Track the error
      this.strategies.trackError(taskId, impasseError);
      
      // Get context from original agent's session
      const sessionOutput = await this.strategies.getSessionOutput(taskId);
      
      // Spawn CodeSavant helper
      const spawnResult = await this.agentSpawner.spawnCodeSavant(taskId, sessionOutput);
      
      if (spawnResult.success) {
        // Track active CodeSavant session
        this.strategies.addCodeSavantSession(taskId);
        this.strategies.trackSuccessfulRecovery(taskId);
        
        return {
          success: true,
          strategy: { type: 'spawn_helper', config: { agent: 'CodeSavant' } },
          message: `CodeSavant helper spawned for task ${taskId}`
        };
      } else {
        return {
          success: false,
          strategy: { type: 'escalate', config: {} },
          message: `Failed to spawn CodeSavant: ${spawnResult.error}`,
          escalated: true
        };
      }
      
    } catch (error) {
      console.error(`Failed to handle impasse for task ${taskId}:`, error);
      return {
        success: false,
        strategy: { type: 'escalate', config: {} },
        message: `Impasse handling failed: ${(error as Error).message}`,
        escalated: true
      };
    }
  }

  /**
   * Perform critique check for task
   */
  async performCritiqueCheck(taskId: string): Promise<boolean> {
    try {
      // Check if critique is required for current workflow step
      if (!this.workflowManager.isCritiqueRequired(taskId)) {
        return true; // Skip critique for steps that don't require it
      }

      // Get recent artifacts for this task
      const artifacts = await this.canvas.getArtifactsByTask(taskId);
      if (artifacts.length === 0) {
        return true; // No artifacts to critique yet
      }

      // Analyze the most recent artifact
      const latestArtifact = artifacts[artifacts.length - 1];
      const critiqueResult = await this.critiqueAgent.analyzeArtifact(latestArtifact.id);

      if (!critiqueResult.success) {
        console.warn(`Critique analysis failed for task ${taskId}:`, critiqueResult.error);
        return true; // Continue if critique fails
      }

      // Generate structured feedback
      const feedback = await this.critiqueAgent.generateStructuredFeedback(
        latestArtifact.id,
        critiqueResult.critique!,
        this.strategies.determineSeverity(critiqueResult.critique!.issues || [])
      );

      // Log critique findings for monitoring
      console.log(`Critique analysis for task ${taskId}: ${feedback.overallSeverity} severity, ${feedback.issues.length} issues found`);

      // Enhanced pause logic with workflow step awareness
      if (feedback.pauseDownstream) {
        console.log(`Critique recommends pausing downstream tasks for task ${taskId}`);
        await this.strategies.pauseDownstreamTasks(taskId, feedback.overallSeverity);
        
        // Store critique feedback in canvas for later review
        await this.canvas.createCritiqueNode({
          artifactId: latestArtifact.id,
          critique: critiqueResult.critique!,
          severity: feedback.overallSeverity,
          feedback: feedback,
          actionTaken: 'paused_downstream'
        });
        
        return false;
      }

      // Store positive critique results as well for learning
      if (feedback.overallSeverity === 'low' && feedback.issues.length === 0) {
        const workflowState = this.workflowManager.getTaskWorkflowState(taskId);
        await this.canvas.createPheromone({
          id: `pheromone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'success_pheromone',
          context: `critique_success_${workflowState?.currentStep || 'unknown'}`,
          strength: 0.8,
          metadata: {
            taskId,
            artifactId: latestArtifact.id,
            workflowStep: workflowState?.currentStep,
            timestamp: new Date().toISOString()
          },
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Expires in 24 hours
        });
      }

      return true;
    } catch (error) {
      console.error(`Error performing critique check for task ${taskId}:`, error);
      return true; // Continue on error
    }
  }

  /**
   * Get active CodeSavant sessions for compatibility
   */
  getActiveCodeSavantSessions(): Set<string> {
    return this.strategies.getActiveCodeSavantSessions();
  }

  /**
   * Get error history for a specific task
   */
  getTaskErrorHistory(taskId: string): any[] {
    return this.strategies.getTaskErrorHistory(taskId);
  }

  /**
   * Get error recovery statistics
   */
  getErrorRecoveryStatistics(): any {
    return this.strategies.getErrorRecoveryStatistics();
  }

}