import { CognitiveCanvas } from '../cognitive-canvas';
import { AgentSpawner } from './agent-spawner';
import { WorkflowManager } from './workflow-manager';
import { ErrorContext, RecoveryStrategy, ErrorHandlingResult } from './error-handler';

/**
 * RecoveryStrategies handles different recovery strategies for error handling
 */
export class RecoveryStrategies {
  constructor(
    private canvas: CognitiveCanvas,
    private agentSpawner: AgentSpawner,
    private workflowManager: WorkflowManager
  ) {}

  /**
   * Determine appropriate recovery strategy based on error context
   */
  async determineRecoveryStrategy(errorContext: ErrorContext, diagnosticResult?: any): Promise<RecoveryStrategy> {
    // Check task retry count first
    const retryCount = await this.getTaskRetryCount(errorContext.taskId);
    
    switch (errorContext.type) {
      case 'timeout':
        if (retryCount < 2) {
          return { type: 'retry', config: { delay: 5000 } };
        } else {
          return { type: 'spawn_helper', config: { agent: 'CodeSavant' } };
        }
        
      case 'system_failure':
        if (errorContext.severity === 'critical') {
          return { type: 'escalate', config: {} };
        } else if (retryCount < 1) {
          return { type: 'retry', config: { delay: 2000 } };
        } else {
          return { type: 'spawn_helper', config: { agent: 'Debugger' } };
        }
        
      case 'workflow_step_error':
        if (retryCount < 2) {
          return { type: 'retry', config: { delay: 3000 } };
        } else {
          return { type: 'skip_step', config: { reason: 'Max retries exceeded' } };
        }
        
      case 'impasse':
        return { type: 'spawn_helper', config: { agent: 'CodeSavant' } };
        
      case 'critique_failure':
        if (errorContext.severity === 'high') {
          return { type: 'pause_downstream', config: { duration: 300000 } }; // 5 minutes
        } else {
          return { type: 'spawn_helper', config: { agent: 'Critique' } };
        }
        
      default:
        return { type: 'escalate', config: {} };
    }
  }

  /**
   * Execute the determined recovery strategy
   */
  async executeRecoveryStrategy(
    taskId: string, 
    strategy: RecoveryStrategy, 
    errorContext: ErrorContext
  ): Promise<ErrorHandlingResult> {
    try {
      switch (strategy.type) {
        case 'retry':
          return await this.executeRetryStrategy(taskId, strategy.config, errorContext);
          
        case 'spawn_helper':
          return await this.executeSpawnHelperStrategy(taskId, strategy.config, errorContext);
          
        case 'skip_step':
          return await this.executeSkipStepStrategy(taskId, strategy.config, errorContext);
          
        case 'escalate':
          return await this.executeEscalateStrategy(taskId, strategy.config, errorContext);
          
        case 'pause_downstream':
          return await this.executePauseDownstreamStrategy(taskId, strategy.config, errorContext);
          
        default:
          throw new Error(`Unknown recovery strategy: ${strategy.type}`);
      }
    } catch (error) {
      return {
        success: false,
        strategy,
        message: `Recovery strategy execution failed: ${(error as Error).message}`,
        escalated: true
      };
    }
  }

  private async executeRetryStrategy(taskId: string, config: any, errorContext: ErrorContext): Promise<ErrorHandlingResult> {
    console.log(`Executing retry strategy for task ${taskId} with delay ${config.delay}ms`);
    
    if (config.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, config.delay));
    }
    
    // Mark task for retry in workflow manager
    await this.workflowManager.markTaskForRetry(taskId, errorContext.step);
    
    return {
      success: true,
      strategy: { type: 'retry', config },
      message: `Task ${taskId} marked for retry after ${config.delay}ms delay`
    };
  }

  private async executeSpawnHelperStrategy(taskId: string, config: any, errorContext: ErrorContext): Promise<ErrorHandlingResult> {
    console.log(`Spawning ${config.agent} helper for task ${taskId}`);
    
    let spawnResult;
    switch (config.agent) {
      case 'CodeSavant':
        spawnResult = await this.agentSpawner.spawnCodeSavant(taskId, errorContext.errorMessage);
        break;
      case 'Debugger':
        spawnResult = await this.agentSpawner.spawnDebugger(taskId, errorContext);
        break;
      case 'Critique':
        spawnResult = await this.agentSpawner.spawnCritique(taskId, errorContext);
        break;
      default:
        throw new Error(`Unknown helper agent: ${config.agent}`);
    }
    
    if (spawnResult.success) {
      return {
        success: true,
        strategy: { type: 'spawn_helper', config },
        message: `${config.agent} helper spawned successfully for task ${taskId}`
      };
    } else {
      return {
        success: false,
        strategy: { type: 'spawn_helper', config },
        message: `Failed to spawn ${config.agent}: ${spawnResult.error}`,
        escalated: true
      };
    }
  }

  private async executeSkipStepStrategy(taskId: string, config: any, errorContext: ErrorContext): Promise<ErrorHandlingResult> {
    console.log(`Skipping step for task ${taskId}: ${config.reason}`);
    
    await this.workflowManager.skipCurrentStep(taskId, config.reason);
    
    return {
      success: true,
      strategy: { type: 'skip_step', config },
      message: `Skipped current step for task ${taskId}: ${config.reason}`
    };
  }

  private async executeEscalateStrategy(taskId: string, config: any, errorContext: ErrorContext): Promise<ErrorHandlingResult> {
    console.log(`Escalating error for task ${taskId}`);
    
    // Store escalated error context
    await this.canvas.storeEscalatedError({
      taskId,
      errorContext,
      escalatedAt: new Date().toISOString(),
      requiresManualIntervention: true
    });
    
    return {
      success: false,
      strategy: { type: 'escalate', config },
      message: `Error escalated for manual intervention: ${errorContext.errorMessage}`,
      escalated: true
    };
  }

  private async executePauseDownstreamStrategy(taskId: string, config: any, errorContext: ErrorContext): Promise<ErrorHandlingResult> {
    console.log(`Pausing downstream tasks for ${config.duration}ms due to task ${taskId} error`);
    
    await this.workflowManager.pauseDownstreamTasks(taskId, config.duration);
    
    return {
      success: true,
      strategy: { type: 'pause_downstream', config },
      message: `Downstream tasks paused for ${config.duration}ms`
    };
  }

  private async getTaskRetryCount(taskId: string): Promise<number> {
    try {
      const retryData = await this.canvas.getTaskRetryCount(taskId);
      return retryData?.count || 0;
    } catch (error) {
      console.warn(`Failed to get retry count for task ${taskId}:`, error);
      return 0;
    }
  }
}
