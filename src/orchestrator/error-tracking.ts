import { CognitiveCanvas } from '../cognitive-canvas';
import { ErrorContext } from './error-handler';

/**
 * ErrorTracking handles error statistics and tracking functionality
 */
export class ErrorTracking {
  private errorStats = new Map<string, { count: number; lastOccurrence: string }>();
  private recoveryStats = new Map<string, number>();

  constructor(private canvas: CognitiveCanvas) {}

  /**
   * Store error context in the cognitive canvas
   */
  async storeErrorContext(errorContext: ErrorContext): Promise<void> {
    try {
      await this.canvas.storeFailure({
        id: errorContext.id,
        type: errorContext.type,
        severity: errorContext.severity,
        message: errorContext.errorMessage,
        taskId: errorContext.taskId,
        step: errorContext.step,
        timestamp: errorContext.timestamp,
        metadata: errorContext.metadata
      });
    } catch (error) {
      console.warn('Failed to store error context:', error);
    }
  }

  /**
   * Track error occurrence for statistics
   */
  trackError(taskId: string, errorContext: ErrorContext): void {
    const errorKey = `${errorContext.type}_${errorContext.severity}`;
    const current = this.errorStats.get(errorKey) || { count: 0, lastOccurrence: '' };
    
    this.errorStats.set(errorKey, {
      count: current.count + 1,
      lastOccurrence: errorContext.timestamp
    });
    
    console.log(`Error tracked: ${errorKey} (count: ${current.count + 1})`);
  }

  /**
   * Track successful recovery
   */
  trackSuccessfulRecovery(taskId: string): void {
    const current = this.recoveryStats.get(taskId) || 0;
    this.recoveryStats.set(taskId, current + 1);
    console.log(`Recovery tracked for task ${taskId} (count: ${current + 1})`);
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Map<string, { count: number; lastOccurrence: string }> {
    return new Map(this.errorStats);
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): Map<string, number> {
    return new Map(this.recoveryStats);
  }

  /**
   * Clear statistics (useful for testing or reset)
   */
  clearStats(): void {
    this.errorStats.clear();
    this.recoveryStats.clear();
  }
}
