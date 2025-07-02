import { CortexError, ErrorSeverity, ErrorCategory, ErrorPhase, ImpasseDetails } from './types/error-types';
import { PheromoneData } from './cognitive-canvas';
import { AgentStatus, AgentConfig, TaskContext } from './types/agent-types';
import { TaskData } from './cognitive-canvas';
import { Message } from './claude-client';
import { SessionInfo } from './session';

export interface ErrorHandlingCapabilities {
  reportImpasse(reason: string, context?: Record<string, any>, urgency?: 'low' | 'medium' | 'high'): Promise<void>;
  handleError(error: Error): Promise<void>;
}

export class AgentErrorHandler {
  private config: AgentConfig | null = null;
  private cognitiveCanvas: any = null;
  private currentTask: TaskData | null = null;
  private taskContext: TaskContext | null = null;
  private status: AgentStatus = 'uninitialized';
  private conversationHistory: Message[] = [];
  private currentSession: SessionInfo | null = null;
  private lastError: Error | null = null;

  constructor(
    config: AgentConfig | null,
    cognitiveCanvas: any,
    currentTask: TaskData | null,
    taskContext: TaskContext | null,
    status: AgentStatus,
    conversationHistory: Message[],
    currentSession: SessionInfo | null,
    lastError: Error | null
  ) {
    this.config = config;
    this.cognitiveCanvas = cognitiveCanvas;
    this.currentTask = currentTask;
    this.taskContext = taskContext;
    this.status = status;
    this.conversationHistory = conversationHistory;
    this.currentSession = currentSession;
    this.lastError = lastError;
  }

  /**
   * Report an impasse to the cognitive canvas
   */
  async reportImpasse(reason: string, context?: Record<string, any>, urgency: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
    if (!this.cognitiveCanvas || !this.config) {
      console.error('Cannot report impasse: Cognitive Canvas or config not available');
      return;
    }

    try {
      const strengthMap = { low: 0.6, medium: 0.8, high: 0.95 };
      const expiryMap = { low: 1800000, medium: 3600000, high: 7200000 }; // 30min, 1hr, 2hrs

      // Generate structured impasse details
      const impasseDetails = this.generateImpasseDetails(reason, urgency);
      
      // Create CortexError for impasse
      const cortexError = new CortexError(reason, {
        severity: this.mapUrgencyToSeverity(urgency),
        category: ErrorCategory.IMPASSE,
        context: {
          taskId: this.currentTask?.id,
          agentId: this.config.id,
          agentType: this.config.role,
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      const pheromoneData: PheromoneData = {
        id: `impasse-${this.config.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'impasse',
        strength: strengthMap[urgency],
        context: 'agent_impasse',
        metadata: {
          reason,
          urgency,
          agentId: this.config.id,
          agentRole: this.config.role,
          taskId: this.currentTask?.id || null,
          taskTitle: this.currentTask?.title || null,
          cortexError,
          impasseDetails,
          additionalContext: context || {},
          conversationLength: this.conversationHistory.length,
          lastError: this.lastError?.message || null,
          agentState: {
            status: this.status,
            hasActiveSession: this.currentSession !== null,
            conversationLength: this.conversationHistory.length
          }
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expiryMap[urgency]).toISOString()
      };

      await this.cognitiveCanvas.createPheromone(pheromoneData);
      
      console.warn(`Agent ${this.config.id} reported impasse: ${reason}`);
    } catch (error) {
      console.error(`Failed to report impasse: ${(error as Error).message}`);
    }
  }

  /**
   * Handle errors and attempt recovery
   */
  async handleError(error: Error): Promise<void> {
    // Convert regular errors to CortexError for enhanced handling
    let cortexError: CortexError;
    if (error instanceof CortexError) {
      cortexError = error;
    } else {
      cortexError = new CortexError(error.message, {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.AGENT_EXECUTION,
        context: {
          taskId: this.currentTask?.id,
          agentId: this.config?.id,
          agentType: this.config?.role,
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        },
        cause: error
      });
    }

    this.lastError = cortexError;

    // Report error as pheromone
    if (this.cognitiveCanvas && this.config) {
      try {
        const errorStrength = this.mapSeverityToStrength(cortexError.severity);
        
        const errorPheromone: PheromoneData = {
          id: `error-${this.config.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'error',
          strength: errorStrength,
          context: 'agent_error',
          metadata: {
            error: cortexError.message,
            agentId: this.config.id,
            taskId: this.currentTask?.id || null,
            cortexError: cortexError,
            severity: cortexError.severity,
            category: cortexError.category,
            stack: cortexError.stack,
            phase: cortexError.context.phase
          },
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7200000).toISOString() // 2 hours expiry
        };

        await this.cognitiveCanvas.createPheromone(errorPheromone);

        // Auto-report impasse for critical errors
        if (cortexError.severity === ErrorSeverity.CRITICAL) {
          await this.reportImpasse(
            `Critical error: ${cortexError.message}`,
            { originalError: error },
            'high'
          );
        }
      } catch (reportError) {
        console.warn(`Failed to report error: ${(reportError as Error).message}`);
      }
    }

    // Log error details
    console.error(`Agent ${this.config?.id} encountered error:`, cortexError);
  }

  /**
   * Generate structured impasse details
   */
  private generateImpasseDetails(reason: string, urgency: 'low' | 'medium' | 'high'): ImpasseDetails {
    const blockers = this.identifyBlockers(reason);
    const suggestedActions = this.generateSuggestions(reason, blockers);
    
    return {
      reason,
      agentState: {
        status: this.status,
        hasActiveSession: this.currentSession !== null,
        conversationLength: this.conversationHistory.length
      },
      taskProgress: this.estimateTaskProgress(),
      blockers,
      suggestedActions,
      urgency
    };
  }

  /**
   * Identify blockers from impasse reason
   */
  private identifyBlockers(reason: string): string[] {
    const blockers: string[] = [];
    const lowerReason = reason.toLowerCase();

    if (lowerReason.includes('dependencies') || lowerReason.includes('modules')) {
      blockers.push('Missing dependencies or modules');
    }
    if (lowerReason.includes('permission') || lowerReason.includes('access')) {
      blockers.push('Permission/access restrictions');
    }
    if (lowerReason.includes('network') || lowerReason.includes('connection')) {
      blockers.push('Network connectivity issues');
    }
    if (lowerReason.includes('resource') || lowerReason.includes('memory') || lowerReason.includes('disk')) {
      blockers.push('Resource availability constraints');
    }
    if (lowerReason.includes('configuration') || lowerReason.includes('config')) {
      blockers.push('Configuration or setup problems');
    }
    if (lowerReason.includes('undefined') || lowerReason.includes('null') || lowerReason.includes('variable')) {
      blockers.push('Code logic or variable reference errors');
    }
    if (lowerReason.includes('timeout') || lowerReason.includes('slow')) {
      blockers.push('Performance or timeout issues');
    }

    // If no specific blockers identified, add general category
    if (blockers.length === 0) {
      blockers.push('Unknown or complex issue requiring investigation');
    }

    return blockers;
  }

  /**
   * Generate suggested actions based on reason and blockers
   */
  private generateSuggestions(reason: string, blockers: string[]): string[] {
    const suggestions: string[] = [];

    for (const blocker of blockers) {
      if (blocker.includes('dependencies')) {
        suggestions.push('Check and install missing dependencies');
        suggestions.push('Verify package.json or requirements file');
      } else if (blocker.includes('permission')) {
        suggestions.push('Check file/directory permissions');
        suggestions.push('Verify authentication credentials');
      } else if (blocker.includes('network')) {
        suggestions.push('Check network connectivity');
        suggestions.push('Verify API endpoints and firewall settings');
      } else if (blocker.includes('resource')) {
        suggestions.push('Monitor system resources (memory, disk, CPU)');
        suggestions.push('Consider resource optimization or scaling');
      } else if (blocker.includes('configuration')) {
        suggestions.push('Review configuration files and environment variables');
        suggestions.push('Validate configuration syntax and values');
      } else if (blocker.includes('code logic')) {
        suggestions.push('Review variable declarations and scope');
        suggestions.push('Add debugging statements or error handling');
      } else if (blocker.includes('timeout')) {
        suggestions.push('Increase timeout values or optimize performance');
        suggestions.push('Consider asynchronous processing approaches');
      } else {
        suggestions.push('Perform step-by-step debugging');
        suggestions.push('Consult documentation or seek expert assistance');
      }
    }

    // Remove duplicates and limit to most relevant
    return [...new Set(suggestions)].slice(0, 5);
  }

  /**
   * Estimate task progress based on agent state
   */
  private estimateTaskProgress(): number {
    if (!this.currentTask) return 0;
    
    // Simple heuristic based on conversation length and status
    let progress = 0;
    
    if (this.conversationHistory.length > 0) {
      progress += Math.min(this.conversationHistory.length * 10, 50);
    }
    
    if (this.status === 'running' || this.status === 'impasse') {
      progress += 25;
    }
    
    return Math.min(progress, 90); // Never claim 100% when reporting impasse
  }

  /**
   * Map urgency to error severity
   */
  private mapUrgencyToSeverity(urgency: 'low' | 'medium' | 'high'): ErrorSeverity {
    switch (urgency) {
      case 'high': return ErrorSeverity.HIGH;
      case 'medium': return ErrorSeverity.MEDIUM;
      case 'low': return ErrorSeverity.LOW;
      default: return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Map error severity to pheromone strength
   */
  private mapSeverityToStrength(severity: ErrorSeverity): number {
    switch (severity) {
      case ErrorSeverity.CRITICAL: return 0.95;
      case ErrorSeverity.HIGH: return 0.8;
      case ErrorSeverity.MEDIUM: return 0.6;
      case ErrorSeverity.LOW: return 0.4;
      default: return 0.6;
    }
  }
}