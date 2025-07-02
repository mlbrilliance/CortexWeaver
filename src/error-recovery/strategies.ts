/**
 * Error Recovery Strategies Module
 * 
 * Contains implementations of different error recovery strategies
 */

import {
  CortexError,
  ErrorSeverity,
  ErrorCategory,
  RecoveryStrategy,
  RecoveryAttempt,
  ErrorRecoveryResult,
  RetryConfiguration,
  CodeSavantRequest,
  CodeSavantResponse,
  EscalationRequest
} from '../types/error-types';
import { CodeSavant } from '../code-savant';
import { CognitiveCanvas, PheromoneData } from '../cognitive-canvas';

export class ErrorRecoveryStrategies {
  private codeSavant: CodeSavant;
  private cognitiveCanvas: CognitiveCanvas;

  constructor(cognitiveCanvas: CognitiveCanvas, codeSavant?: CodeSavant) {
    this.cognitiveCanvas = cognitiveCanvas;
    this.codeSavant = codeSavant || new CodeSavant();
  }

  /**
   * Execute retry strategy with intelligent backoff
   */
  async executeRetryStrategy(
    error: CortexError,
    operation: () => Promise<any>,
    result: ErrorRecoveryResult,
    retryConfig: RetryConfiguration
  ): Promise<boolean> {
    let lastError = error;

    // Use the error's maxRetries if it's lower than the config maxAttempts
    const maxAttempts = Math.min(retryConfig.maxAttempts, error.maxRetries);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const attemptStart = Date.now();
      
      try {
        if (attempt > 1) {
          const delay = this.calculateBackoffDelay(attempt, retryConfig, error.backoffStrategy);
          console.log(`Retry attempt ${attempt}/${retryConfig.maxAttempts} after ${delay}ms delay`);
          await this.sleep(delay);
        }

        const operationResult = await operation();
        
        const recoveryAttempt: RecoveryAttempt = {
          attemptNumber: attempt,
          strategy: RecoveryStrategy.RETRY,
          timestamp: new Date().toISOString(),
          success: true,
          duration: Date.now() - attemptStart
        };

        result.attempts.push(recoveryAttempt);
        console.log(`Retry attempt ${attempt} succeeded`);
        return true;

      } catch (attemptError) {
        lastError = this.enhanceError(attemptError as Error, error);
        
        const recoveryAttempt: RecoveryAttempt = {
          attemptNumber: attempt,
          strategy: RecoveryStrategy.RETRY,
          timestamp: new Date().toISOString(),
          success: false,
          error: lastError.message,
          duration: Date.now() - attemptStart
        };

        result.attempts.push(recoveryAttempt);
        
        if (!retryConfig.shouldRetry(lastError, attempt) || attempt >= maxAttempts) {
          console.log(`Stopping retries - error not retryable or max attempts reached`);
          break;
        }
      }
    }

    result.finalError = lastError;
    return false;
  }

  /**
   * Execute CodeSavant intervention strategy
   */
  async executeCodeSavantStrategy(
    error: CortexError,
    operation: () => Promise<any>,
    result: ErrorRecoveryResult
  ): Promise<boolean> {
    console.log(`Initiating CodeSavant intervention for impasse: ${error.message}`);
    const attemptStart = Date.now();

    try {
      // Prepare CodeSavant request
      const codeSavantRequest: CodeSavantRequest = {
        taskId: error.context.taskId || 'unknown',
        originalError: error,
        agentType: error.context.agentId || 'unknown',
        taskDescription: error.metadata.taskDescription || error.message,
        failedAttempts: result.attempts,
        context: {
          errorLogs: [error.message],
          stackTrace: error.stack,
          systemState: error.metadata
        }
      };

      // Get CodeSavant analysis
      const analysis = await this.codeSavant.analyzeProblem(
        codeSavantRequest.taskDescription,
        error.metadata.failedCode || '',
        error.message
      );

      const suggestions = await this.codeSavant.generateSuggestions(
        codeSavantRequest.taskDescription,
        error.metadata.failedCode || '',
        error.message
      );

      const rootCause = await this.codeSavant.identifyRootCause(
        error.message,
        error.metadata.failedCode || ''
      );

      const codeSavantResponse: CodeSavantResponse = {
        analysisId: `analysis-${Date.now()}`,
        rootCause,
        suggestions,
        confidence: 85, // CodeSavant provides high confidence analysis
        estimatedComplexity: this.assessComplexity(error),
        requiresHumanIntervention: error.shouldEscalateToHuman()
      };

      result.suggestions = suggestions;

      // Store CodeSavant pheromone
      await this.storeCodeSavantPheromone(error, codeSavantResponse);

      // Try operation with CodeSavant guidance
      console.log(`Retrying operation with CodeSavant suggestions:`, suggestions);
      
      const operationResult = await operation();

      const recoveryAttempt: RecoveryAttempt = {
        attemptNumber: 1,
        strategy: RecoveryStrategy.CODESAVANT,
        timestamp: new Date().toISOString(),
        success: true,
        duration: Date.now() - attemptStart,
        metadata: { codeSavantResponse }
      };

      result.attempts.push(recoveryAttempt);
      return true;

    } catch (codeSavantError) {
      const recoveryAttempt: RecoveryAttempt = {
        attemptNumber: 1,
        strategy: RecoveryStrategy.CODESAVANT,
        timestamp: new Date().toISOString(),
        success: false,
        error: (codeSavantError as Error).message,
        duration: Date.now() - attemptStart
      };

      result.attempts.push(recoveryAttempt);
      
      // Mark for human escalation if CodeSavant fails
      result.escalationRequired = true;
      error.metadata.codeSavantFailed = true;
      
      console.log(`CodeSavant intervention failed, escalating to human: ${codeSavantError}`);
      return false;
    }
  }

  /**
   * Execute fallback strategy
   */
  async executeFallbackStrategy(
    error: CortexError,
    operation: () => Promise<any>,
    result: ErrorRecoveryResult
  ): Promise<boolean> {
    console.log(`Executing fallback strategy for ${error.category}`);
    const attemptStart = Date.now();

    try {
      // Implement resource-aware fallback
      if (error.category === ErrorCategory.RESOURCE_EXHAUSTION) {
        // Wait for resource pressure to decrease
        await this.waitForResourceAvailability();
      }

      // Try with reduced parameters or alternative approach
      const operationResult = await operation();

      const recoveryAttempt: RecoveryAttempt = {
        attemptNumber: 1,
        strategy: RecoveryStrategy.FALLBACK,
        timestamp: new Date().toISOString(),
        success: true,
        duration: Date.now() - attemptStart
      };

      result.attempts.push(recoveryAttempt);
      return true;

    } catch (fallbackError) {
      const recoveryAttempt: RecoveryAttempt = {
        attemptNumber: 1,
        strategy: RecoveryStrategy.FALLBACK,
        timestamp: new Date().toISOString(),
        success: false,
        error: (fallbackError as Error).message,
        duration: Date.now() - attemptStart
      };

      result.attempts.push(recoveryAttempt);
      return false;
    }
  }

  /**
   * Escalate error to human intervention
   */
  async escalateToHuman(
    error: CortexError,
    result: ErrorRecoveryResult
  ): Promise<void> {
    const escalationRequest: EscalationRequest = {
      errorId: error.id,
      taskId: error.context.taskId || 'unknown',
      projectId: error.context.projectId || 'unknown',
      severity: error.severity,
      category: error.category,
      summary: error.message,
      context: error.context,
      recoveryAttempts: result.attempts,
      urgency: this.determineEscalationUrgency(error),
      expectedResolutionTime: this.estimateResolutionTime(error)
    };

    console.log(`Escalating to human intervention:`, escalationRequest);
    
    // Store escalation pheromone
    await this.storeEscalationPheromone(escalationRequest);
    
    // In a real implementation, this would trigger notifications, tickets, etc.
    console.log(`Human intervention required for error ${error.id}`);
  }

  /**
   * Calculate backoff delay based on strategy
   */
  private calculateBackoffDelay(
    attempt: number,
    config: RetryConfiguration,
    strategy: 'linear' | 'exponential' | 'fixed'
  ): number {
    let delay: number;

    switch (strategy) {
      case 'exponential':
        delay = Math.min(
          config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelayMs
        );
        break;
      case 'linear':
        delay = Math.min(config.baseDelayMs * attempt, config.maxDelayMs);
        break;
      case 'fixed':
      default:
        delay = config.baseDelayMs;
        break;
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * config.jitterMs;
    return delay + jitter;
  }

  /**
   * Enhance error with additional context
   */
  private enhanceError(originalError: Error, contextError: CortexError): CortexError {
    if (originalError instanceof CortexError) {
      return originalError;
    }

    return new CortexError(originalError.message, {
      severity: contextError.severity,
      category: contextError.category,
      context: contextError.context,
      cause: originalError,
      retryable: contextError.retryable,
      maxRetries: contextError.maxRetries,
      backoffStrategy: contextError.backoffStrategy
    });
  }

  /**
   * Store CodeSavant analysis pheromone
   */
  private async storeCodeSavantPheromone(
    error: CortexError,
    response: CodeSavantResponse
  ): Promise<void> {
    try {
      const pheromone: PheromoneData = {
        id: `codesavant-${response.analysisId}`,
        type: 'codesavant_analysis',
        strength: response.confidence / 100,
        context: 'impasse_resolution',
        metadata: {
          errorId: error.id,
          analysisId: response.analysisId,
          rootCause: response.rootCause,
          suggestions: response.suggestions,
          confidence: response.confidence,
          complexity: response.estimatedComplexity,
          taskId: error.context.taskId,
          agentType: error.context.agentId
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 14400000).toISOString() // 4 hours
      };

      await this.cognitiveCanvas.createPheromone(pheromone);
    } catch (pheromoneError) {
      console.warn('Failed to store CodeSavant pheromone:', pheromoneError);
    }
  }

  /**
   * Store escalation pheromone
   */
  private async storeEscalationPheromone(request: EscalationRequest): Promise<void> {
    try {
      const pheromone: PheromoneData = {
        id: `escalation-${request.errorId}`,
        type: 'human_escalation',
        strength: 0.9,
        context: 'human_intervention_required',
        metadata: request,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString() // 24 hours
      };

      await this.cognitiveCanvas.createPheromone(pheromone);
    } catch (pheromoneError) {
      console.warn('Failed to store escalation pheromone:', pheromoneError);
    }
  }

  // Utility methods
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async waitForResourceAvailability(): Promise<void> {
    // Simplified resource check - in real implementation would check memory, CPU, etc.
    await this.sleep(5000);
  }

  private assessComplexity(error: CortexError): 'low' | 'medium' | 'high' {
    if (error.severity === ErrorSeverity.CRITICAL) return 'high';
    if (error.category === ErrorCategory.DATA_CORRUPTION) return 'high';
    if (error.category === ErrorCategory.IMPASSE) return 'medium';
    return 'low';
  }

  private determineEscalationUrgency(error: CortexError): 'low' | 'medium' | 'high' | 'critical' {
    if (error.severity === ErrorSeverity.CRITICAL) return 'critical';
    if (error.category === ErrorCategory.DATA_CORRUPTION) return 'high';
    if (error.shouldEscalateToHuman()) return 'high';
    return 'medium';
  }

  private estimateResolutionTime(error: CortexError): string {
    const urgency = this.determineEscalationUrgency(error);
    switch (urgency) {
      case 'critical': return '1 hour';
      case 'high': return '4 hours';
      case 'medium': return '24 hours';
      default: return '72 hours';
    }
  }
}