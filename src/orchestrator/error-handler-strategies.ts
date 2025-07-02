import { CognitiveCanvas } from '../cognitive-canvas';
import { SessionManager } from '../session';
import { AgentSpawner } from './agent-spawner';
import { WorkflowManager } from './workflow-manager';
import { CortexError, ErrorCategory, ErrorPhase, ErrorSeverity } from '../types/error-types';

export interface ErrorContext {
  id: string;
  type: 'system_failure' | 'workflow_step_error' | 'impasse' | 'critique_failure' | 'timeout';
  severity: 'low' | 'medium' | 'high' | 'critical';
  errorMessage: string;
  step?: string;
  taskId: string;
  timestamp: string;
  metadata?: any;
}

export interface RecoveryStrategy {
  type: 'retry' | 'spawn_helper' | 'skip_step' | 'escalate' | 'pause_downstream';
  config: any;
}

export interface ErrorHandlingResult {
  success: boolean;
  strategy: RecoveryStrategy;
  message: string;
  escalated?: boolean;
}

/**
 * Error Handler Strategy Manager
 * Contains recovery strategy implementations and error context management
 */
export class ErrorHandlerStrategies {
  // State tracking for enhanced error handling
  private activeCodeSavantSessions = new Set<string>();
  private taskErrorHistories = new Map<string, any[]>();
  private recoveryStatistics = {
    totalRecoveries: 0,
    successfulRecoveries: 0,
    averageAttempts: 0,
    circuitBreakerStates: new Map<string, string>(),
    learningDatabase: new Map<string, any>()
  };

  constructor(
    private canvas: CognitiveCanvas,
    private sessionManager: SessionManager,
    private agentSpawner: AgentSpawner,
    private workflowManager: WorkflowManager
  ) {}

  /**
   * Store error context in cognitive canvas
   */
  async storeErrorContext(errorContext: ErrorContext): Promise<void> {
    try {
      await this.canvas.createPheromone({
        id: errorContext.id,
        type: 'error_pheromone',
        context: `error_${errorContext.type}_${errorContext.severity}`,
        strength: this.getSeverityStrength(errorContext.severity),
        metadata: errorContext,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Expires in 7 days
      });
    } catch (error) {
      console.error('Failed to store error context:', error);
    }
  }

  /**
   * Determine recovery strategy based on error context
   */
  async determineRecoveryStrategy(
    errorContext: ErrorContext, 
    diagnosticResult?: any
  ): Promise<RecoveryStrategy> {
    // Critical failures need immediate escalation and specialized handling
    if (errorContext.severity === 'critical') {
      if (errorContext.type === 'system_failure') {
        return {
          type: 'spawn_helper',
          config: { agent: 'Debugger', analysis: diagnosticResult }
        };
      }
    }

    // Workflow step errors might benefit from helper agents
    if (errorContext.type === 'workflow_step_error') {
      if (this.workflowManager.isErrorRecoveryEnabled(errorContext.taskId)) {
        return {
          type: 'spawn_helper',
          config: { agent: 'CodeSavant' }
        };
      }
    }

    // Impasse situations always get CodeSavant
    if (errorContext.type === 'impasse') {
      return {
        type: 'spawn_helper',
        config: { agent: 'CodeSavant' }
      };
    }

    // Default to escalation
    return {
      type: 'escalate',
      config: { reason: 'No specific recovery strategy available' }
    };
  }

  /**
   * Execute recovery strategy
   */
  async executeRecoveryStrategy(
    taskId: string,
    strategy: RecoveryStrategy,
    errorContext: ErrorContext
  ): Promise<ErrorHandlingResult> {
    switch (strategy.type) {
      case 'spawn_helper':
        return await this.executeSpawnHelper(taskId, strategy.config, errorContext);
      
      case 'retry':
        return await this.executeRetry(taskId, strategy.config);
      
      case 'pause_downstream':
        return await this.executePauseDownstream(taskId, strategy.config);
      
      case 'escalate':
      default:
        return {
          success: false,
          strategy,
          message: `Escalated error for task ${taskId}: ${errorContext.errorMessage}`,
          escalated: true
        };
    }
  }

  /**
   * Execute spawn helper strategy
   */
  private async executeSpawnHelper(
    taskId: string,
    config: any,
    errorContext: ErrorContext
  ): Promise<ErrorHandlingResult> {
    try {
      let spawnResult;
      
      if (config.agent === 'Debugger') {
        spawnResult = await this.agentSpawner.spawnDebugger(taskId, errorContext);
      } else if (config.agent === 'CodeSavant') {
        const sessionOutput = await this.getSessionOutput(taskId);
        spawnResult = await this.agentSpawner.spawnCodeSavant(taskId, sessionOutput);
      } else {
        throw new Error(`Unknown helper agent type: ${config.agent}`);
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
    } catch (error) {
      return {
        success: false,
        strategy: { type: 'spawn_helper', config },
        message: `Helper spawn failed: ${(error as Error).message}`,
        escalated: true
      };
    }
  }

  /**
   * Execute retry strategy
   */
  private async executeRetry(taskId: string, config: any): Promise<ErrorHandlingResult> {
    // Implementation would depend on retry logic
    return {
      success: true,
      strategy: { type: 'retry', config },
      message: `Retry strategy executed for task ${taskId}`
    };
  }

  /**
   * Execute pause downstream strategy
   */
  private async executePauseDownstream(taskId: string, config: any): Promise<ErrorHandlingResult> {
    try {
      // Get task project ID
      const tasks = await this.canvas.getTasksByProject(config.projectId || 'unknown');
      const task = tasks.find(t => t.id === taskId);
      
      if (task) {
        await this.pauseDownstreamTasks(taskId, config.severity || 'medium');
        return {
          success: true,
          strategy: { type: 'pause_downstream', config },
          message: `Downstream tasks paused for task ${taskId}`
        };
      } else {
        return {
          success: false,
          strategy: { type: 'pause_downstream', config },
          message: `Could not find task ${taskId} to pause downstream tasks`
        };
      }
    } catch (error) {
      return {
        success: false,
        strategy: { type: 'pause_downstream', config },
        message: `Failed to pause downstream tasks: ${(error as Error).message}`
      };
    }
  }

  /**
   * Pause downstream tasks based on severity
   */
  async pauseDownstreamTasks(taskId: string, severity: string): Promise<void> {
    try {
      console.log(`Pausing downstream tasks due to ${severity} severity issues`);
      
      // Get project ID from task
      const tasks = await this.canvas.getTasksByProject('*'); // Would need actual project ID
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      // Get all tasks for the project
      const projectTasks = await this.canvas.getTasksByProject(task.projectId);
      
      // Identify tasks that should be paused based on severity
      const tasksToControl = projectTasks.filter(t => {
        const workflowState = this.workflowManager.getTaskWorkflowState(t.id);
        if (!workflowState) return false;
        
        // Pause downstream tasks based on severity level
        if (severity === 'high') {
          // High severity: pause all tasks not yet started
          return t.status === 'pending';
        } else if (severity === 'medium') {
          // Medium severity: pause only architecture and implementation tasks
          return ['DESIGN_ARCHITECTURE', 'IMPLEMENT_CODE', 'EXECUTE_TESTS'].includes(workflowState.currentStep) && 
                 t.status === 'pending';
        }
        return false;
      });
      
      // Mark tasks as paused
      for (const t of tasksToControl) {
        await this.canvas.updateTaskStatus(t.id, 'paused');
        console.log(`Paused task ${t.id} due to ${severity} severity critique issues`);
      }
      
      // Store critique pause reason in canvas for tracking
      await this.canvas.createPheromone({
        id: `pheromone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'pause_pheromone',
        context: `critique_pause_${severity}`,
        strength: severity === 'high' ? 0.9 : 0.7,
        metadata: {
          reason: 'critique_issues',
          severity,
          timestamp: new Date().toISOString(),
          affectedTasks: tasksToControl.map(t => t.id)
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Expires in 7 days
      });
      
    } catch (error) {
      console.error('Error pausing downstream tasks:', error);
    }
  }

  /**
   * Get session output for task
   */
  async getSessionOutput(taskId: string): Promise<string> {
    try {
      const originalSessionId = `cortex-${taskId}-*`;
      return await this.sessionManager.getSessionOutput(originalSessionId);
    } catch (error) {
      console.warn('Could not retrieve session output:', error);
      return 'No session output available';
    }
  }

  /**
   * Determine severity from critique issues
   */
  determineSeverity(issues: Array<{ severity: string }>): 'low' | 'medium' | 'high' {
    if (issues.some(issue => issue.severity === 'high')) {
      return 'high';
    }
    if (issues.some(issue => issue.severity === 'medium')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Get strength value for severity level
   */
  private getSeverityStrength(severity: string): number {
    switch (severity) {
      case 'critical': return 1.0;
      case 'high': return 0.8;
      case 'medium': return 0.6;
      case 'low': return 0.4;
      default: return 0.5;
    }
  }

  /**
   * Get active CodeSavant sessions for compatibility
   */
  getActiveCodeSavantSessions(): Set<string> {
    return this.activeCodeSavantSessions;
  }

  /**
   * Get error history for a specific task
   */
  getTaskErrorHistory(taskId: string): any[] {
    return this.taskErrorHistories.get(taskId) || [];
  }

  /**
   * Get error recovery statistics
   */
  getErrorRecoveryStatistics(): any {
    return {
      totalRecoveries: this.recoveryStatistics.totalRecoveries,
      successRate: this.recoveryStatistics.totalRecoveries > 0 
        ? this.recoveryStatistics.successfulRecoveries / this.recoveryStatistics.totalRecoveries 
        : 0,
      averageAttempts: this.recoveryStatistics.averageAttempts,
      circuitBreakerStates: Object.fromEntries(this.recoveryStatistics.circuitBreakerStates),
      learningDatabase: Object.fromEntries(this.recoveryStatistics.learningDatabase)
    };
  }

  /**
   * Track error for history and statistics
   */
  trackError(taskId: string, errorData: any): void {
    // Create CortexError instance for history
    const cortexError = new CortexError(
      errorData.errorMessage || errorData.message || 'Unknown error',
      {
        severity: errorData.severity || ErrorSeverity.MEDIUM,
        category: ErrorCategory.AGENT_EXECUTION,
        context: {
          taskId,
          agentId: 'unknown',
          agentType: 'unknown',
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: errorData.timestamp || new Date().toISOString()
        },
        retryable: true,
        maxRetries: 2,
        backoffStrategy: 'exponential',
        cause: new Error(errorData.errorMessage || 'Unknown error'),
        metadata: errorData.metadata || {}
      }
    );

    // Add to task error history
    if (!this.taskErrorHistories.has(taskId)) {
      this.taskErrorHistories.set(taskId, []);
    }
    this.taskErrorHistories.get(taskId)!.push(cortexError);

    // Update statistics
    this.recoveryStatistics.totalRecoveries++;
  }

  /**
   * Track successful recovery
   */
  trackSuccessfulRecovery(taskId: string): void {
    this.recoveryStatistics.successfulRecoveries++;
  }

  /**
   * Add new CodeSavant session to tracking
   */
  addCodeSavantSession(taskId: string): void {
    this.activeCodeSavantSessions.add(taskId);
  }
}