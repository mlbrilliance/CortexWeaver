/**
 * Error Recovery System - Main Entry Point
 * 
 * This file serves as the main entry point for the Error Recovery System, now refactored
 * to use a modular structure to maintain the 500-line limit per file.
 * 
 * Modular structure:
 * - error-recovery/core.ts - Main recovery orchestration, circuit breakers, and learning
 * - error-recovery/strategies.ts - Individual recovery strategy implementations
 */

import {
  CortexError,
  ErrorRecoveryResult,
  RetryConfiguration,
  ErrorLearningData,
  CircuitBreakerState
} from './types/error-types';
import { CodeSavant } from './code-savant';
import { CognitiveCanvas } from './cognitive-canvas';
import { ErrorRecoveryCore } from './error-recovery/core';

/**
 * Enhanced Error Recovery System for CortexWeaver V3.0
 * Implements intelligent retry logic, CodeSavant integration, and learning mechanisms
 */
export class ErrorRecoverySystem {
  private core: ErrorRecoveryCore;

  constructor(
    cognitiveCanvas: CognitiveCanvas,
    codeSavant?: CodeSavant
  ) {
    this.core = new ErrorRecoveryCore(cognitiveCanvas, codeSavant);
  }

  /**
   * Main error recovery orchestration method
   */
  async recoverFromError(
    error: CortexError,
    operation: () => Promise<any>,
    config?: Partial<RetryConfiguration>
  ): Promise<ErrorRecoveryResult> {
    return this.core.recoverFromError(error, operation, config);
  }

  /**
   * Get recovery statistics for monitoring
   */
  getRecoveryStatistics(): {
    totalRecoveries: number;
    successRate: number;
    averageAttempts: number;
    circuitBreakerStates: Map<string, CircuitBreakerState>;
    learningDatabase: Map<string, ErrorLearningData>;
  } {
    return this.core.getRecoveryStatistics();
  }
}

// Re-export modular components for direct access
export { ErrorRecoveryCore } from './error-recovery/core';
export { ErrorRecoveryStrategies } from './error-recovery/strategies';