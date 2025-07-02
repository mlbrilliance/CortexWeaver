import { Agent, AgentConfig, TaskResult } from '../../agent';
import * as fs from 'fs';
import * as path from 'path';

// Core interfaces for debugging functionality
export interface DebugAnalysis {
  errorType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location?: {
    file: string;
    line?: number;
    column?: number;
  };
  message: string;
  suggestedFixes: string[];
  rootCause?: string;
  relatedErrors?: string[];
}

export interface TestFailureAnalysis {
  testName: string;
  failureReason: string;
  expectedVsActual?: {
    expected: any;
    actual: any;
  };
  suggestedFixes: string[];
  relatedCode?: string[];
}

export interface DebugResult {
  success: boolean;
  analyses: DebugAnalysis[];
  testFailures: TestFailureAnalysis[];
  recommendations: string[];
  fixesApplied?: number;
  error?: string;
}

/**
 * DebuggerAgent - Refactored with simplified implementation
 * 
 * Analyzes errors, test failures, and provides debugging assistance.
 * The original 770-line implementation has been simplified to focus on core functionality.
 */
export class DebuggerAgent extends Agent {

  /**
   * Get the prompt template for debugging and error analysis
   */
  getPromptTemplate(): string {
    return `You are a Debugger Agent, an expert systems analyst specializing in error analysis, root cause identification, and solution development.

## Core Responsibilities
- Analyze error logs and stack traces to identify root causes
- Examine test failure patterns and provide diagnostic insights
- Generate actionable solutions and recommendations
- Identify systemic patterns that may indicate broader issues
- Provide clear, prioritized debugging guidance

## Input Context
**Error Logs:** {{errorLogs}}
**Test Results:** {{testResults}}
**Project Name:** {{projectName}}
**System Context:** {{systemContext}}
**Related Artifacts:** {{relatedArtifacts}}

## Analysis Framework
1. **Error Classification**: Categorize the error type (syntax, runtime, logic, infrastructure, etc.)
2. **Severity Assessment**: Determine impact level (low, medium, high, critical)
3. **Root Cause Analysis**: Identify the fundamental cause, not just symptoms
4. **Context Analysis**: Consider surrounding code, dependencies, and environment
5. **Pattern Recognition**: Look for recurring issues or systemic problems

## Solution Generation
Provide solutions in order of priority:
1. **Immediate Fixes**: Quick solutions to resolve the immediate issue
2. **Systematic Solutions**: Long-term fixes to prevent recurrence
3. **Preventive Measures**: Steps to avoid similar issues in the future

## Output Format
Structure your analysis as follows:
- **Root Cause**: Clear identification of the primary issue
- **Severity**: Impact assessment with justification
- **Evidence**: Key indicators that support your analysis
- **Immediate Actions**: Step-by-step resolution instructions
- **Long-term Recommendations**: Preventive measures and improvements
- **Related Issues**: Any connected problems to monitor

Focus on actionable insights that help developers resolve issues quickly while building more robust systems.`;
  }

  /**
   * Analyze error logs and provide debugging insights
   */
  async analyzeErrors(errorLogs: string[]): Promise<DebugAnalysis[]> {
    const analyses: DebugAnalysis[] = [];

    for (const log of errorLogs) {
      const analysis = this.parseErrorLog(log);
      if (analysis) {
        analyses.push(analysis);
      }
    }

    return analyses;
  }

  /**
   * Analyze test failures and provide fixes
   */
  async analyzeTestFailures(testResults: any[]): Promise<TestFailureAnalysis[]> {
    const failures: TestFailureAnalysis[] = [];

    for (const result of testResults) {
      if (result.status === 'failed') {
        failures.push({
          testName: result.name,
          failureReason: result.error || 'Unknown failure',
          expectedVsActual: result.expected && result.actual ? {
            expected: result.expected,
            actual: result.actual
          } : undefined,
          suggestedFixes: this.generateFixSuggestions(result),
          relatedCode: []
        });
      }
    }

    return failures;
  }

  /**
   * Execute debugging task
   */
  async executeTask(): Promise<DebugResult> {
    if (!this.currentTask) {
      throw new Error('No task available');
    }

    try {
      await this.reportProgress('started', 'Beginning debug analysis');

      const errorLogs = this.currentTask.errorLogs || [];
      const testResults = this.currentTask.testResults || [];

      // Perform analysis
      const errorAnalyses = await this.analyzeErrors(errorLogs);
      const testFailures = await this.analyzeTestFailures(testResults);

      // Generate recommendations
      const recommendations = this.generateRecommendations(errorAnalyses, testFailures);

      await this.reportProgress('completed', 'Debug analysis completed');

      return {
        success: true,
        analyses: errorAnalyses,
        testFailures,
        recommendations,
        fixesApplied: 0
      };
    } catch (error) {
      await this.reportProgress('error', `Debug analysis failed: ${(error as Error).message}`);
      return {
        success: false,
        analyses: [],
        testFailures: [],
        recommendations: [],
        error: (error as Error).message
      };
    }
  }

  /**
   * Parse error log entry
   */
  private parseErrorLog(log: string): DebugAnalysis | null {
    if (!log || log.trim().length === 0) {
      return null;
    }

    // Simplified error parsing
    let errorType = 'Unknown Error';
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    
    if (log.toLowerCase().includes('error')) {
      errorType = 'Runtime Error';
      severity = 'high';
    } else if (log.toLowerCase().includes('warning')) {
      errorType = 'Warning';
      severity = 'low';
    } else if (log.toLowerCase().includes('critical') || log.toLowerCase().includes('fatal')) {
      errorType = 'Critical Error';
      severity = 'critical';
    }

    return {
      errorType,
      severity,
      message: log.trim(),
      suggestedFixes: this.generateErrorFixes(log),
      rootCause: this.identifyRootCause(log)
    };
  }

  /**
   * Generate fix suggestions for errors
   */
  private generateErrorFixes(log: string): string[] {
    const fixes: string[] = [];

    if (log.toLowerCase().includes('undefined')) {
      fixes.push('Check for undefined variables');
      fixes.push('Add null/undefined checks');
    }

    if (log.toLowerCase().includes('syntax')) {
      fixes.push('Review code syntax');
      fixes.push('Check for missing brackets or semicolons');
    }

    if (log.toLowerCase().includes('module') || log.toLowerCase().includes('import')) {
      fixes.push('Verify module imports');
      fixes.push('Check module installation');
    }

    if (fixes.length === 0) {
      fixes.push('Review error context');
      fixes.push('Check related documentation');
    }

    return fixes;
  }

  /**
   * Generate fix suggestions for test failures
   */
  private generateFixSuggestions(testResult: any): string[] {
    const fixes: string[] = [];

    if (testResult.error?.includes('assertion')) {
      fixes.push('Review test assertions');
      fixes.push('Check expected vs actual values');
    }

    if (testResult.error?.includes('timeout')) {
      fixes.push('Increase test timeout');
      fixes.push('Optimize test performance');
    }

    if (fixes.length === 0) {
      fixes.push('Review test implementation');
      fixes.push('Check test data and setup');
    }

    return fixes;
  }

  /**
   * Identify root cause of error
   */
  private identifyRootCause(log: string): string | undefined {
    if (log.toLowerCase().includes('network')) {
      return 'Network connectivity issue';
    }
    if (log.toLowerCase().includes('permission')) {
      return 'Permission or access rights issue';
    }
    if (log.toLowerCase().includes('memory')) {
      return 'Memory or resource constraint';
    }
    return undefined;
  }

  /**
   * Generate debugging recommendations
   */
  private generateRecommendations(
    errorAnalyses: DebugAnalysis[],
    testFailures: TestFailureAnalysis[]
  ): string[] {
    const recommendations: string[] = [];

    if (errorAnalyses.length > 0) {
      recommendations.push('Address identified errors by priority');
      if (errorAnalyses.some(e => e.severity === 'critical')) {
        recommendations.push('Focus on critical errors first');
      }
    }

    if (testFailures.length > 0) {
      recommendations.push('Fix failing tests to improve code reliability');
      if (testFailures.length > 5) {
        recommendations.push('Consider refactoring tests for better maintainability');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('No critical issues identified');
      recommendations.push('Continue monitoring for potential issues');
    }

    return recommendations;
  }

  /**
   * Analyze failure for orchestrator integration
   */
  async analyzeFailure(errorLog: string, context?: Record<string, any>): Promise<DebugAnalysis> {
    const analysis = this.parseErrorLog(errorLog);
    if (analysis) {
      return analysis;
    }

    // Fallback analysis
    return {
      errorType: 'Unknown Failure',
      severity: 'medium',
      message: errorLog,
      suggestedFixes: ['Review error context', 'Check system logs'],
      rootCause: 'Analysis could not determine root cause'
    };
  }

  /**
   * Create warning pheromone for orchestrator integration
   */
  async createWarnPheromone(message: string, taskId?: string): Promise<void> {
    if (!this.cognitiveCanvas || !this.config) {
      console.warn('Cannot create warning pheromone: Cognitive Canvas or config not available');
      return;
    }

    try {
      const pheromoneData = {
        id: `warn-${this.config.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'warning',
        strength: 0.7,
        context: 'debug_warning',
        metadata: {
          message,
          agentId: this.config.id,
          taskId: taskId || this.currentTask?.id || null,
          source: 'debugger'
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1800000).toISOString() // 30 minutes
      };

      await this.cognitiveCanvas.createPheromone(pheromoneData);
    } catch (error) {
      console.error(`Failed to create warning pheromone: ${(error as Error).message}`);
    }
  }
}