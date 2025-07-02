/**
 * Enhanced Error Types for CortexWeaver V3.0
 * Provides comprehensive error handling, classification, and recovery mechanisms
 */

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  INFRASTRUCTURE = 'infrastructure',
  AGENT_EXECUTION = 'agent_execution',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  NETWORK = 'network',
  DATA_CORRUPTION = 'data_corruption',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  TIMEOUT = 'timeout',
  DEPENDENCY = 'dependency',
  IMPASSE = 'impasse'
}

export enum RecoveryStrategy {
  RETRY = 'retry',
  CODESAVANT = 'codesavant',
  ESCALATE = 'escalate',
  FALLBACK = 'fallback',
  ABORT = 'abort',
  IGNORE = 'ignore'
}

export enum ErrorPhase {
  INITIALIZATION = 'initialization',
  TASK_ASSIGNMENT = 'task_assignment',
  AGENT_SPAWN = 'agent_spawn',
  TASK_EXECUTION = 'task_execution',
  RESULT_PROCESSING = 'result_processing',
  CLEANUP = 'cleanup'
}

export interface ErrorContext {
  taskId?: string;
  agentId?: string;
  agentType?: string;
  projectId?: string;
  sessionId?: string;
  phase: ErrorPhase;
  timestamp: string;
  additionalData?: Record<string, any>;
}

export interface RecoveryAttempt {
  attemptNumber: number;
  strategy: RecoveryStrategy;
  timestamp: string;
  success: boolean;
  error?: string;
  duration: number;
  metadata?: Record<string, any>;
}

export interface ImpasseDetails {
  reason: string;
  agentState: Record<string, any>;
  taskProgress: number; // 0-100
  blockers: string[];
  suggestedActions: string[];
  urgency: 'low' | 'medium' | 'high';
}

export interface ErrorRecoveryResult {
  success: boolean;
  recoveryStrategy: RecoveryStrategy;
  attempts: RecoveryAttempt[];
  finalError?: CortexError;
  suggestions?: string[];
  escalationRequired: boolean;
  learningData?: Record<string, any>;
}

export class CortexError extends Error {
  public readonly id: string;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly context: ErrorContext;
  public readonly retryable: boolean;
  public readonly maxRetries: number;
  public readonly backoffStrategy: 'linear' | 'exponential' | 'fixed';
  public readonly cause?: Error;
  public readonly metadata: Record<string, any>;

  constructor(
    message: string,
    options: {
      severity: ErrorSeverity;
      category: ErrorCategory;
      context: ErrorContext;
      retryable?: boolean;
      maxRetries?: number;
      backoffStrategy?: 'linear' | 'exponential' | 'fixed';
      cause?: Error;
      metadata?: Record<string, any>;
    }
  ) {
    super(message);
    this.name = 'CortexError';
    this.id = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.severity = options.severity;
    this.category = options.category;
    this.context = options.context;
    this.retryable = options.retryable ?? true;
    this.maxRetries = options.maxRetries ?? this.getDefaultMaxRetries();
    this.backoffStrategy = options.backoffStrategy ?? 'exponential';
    this.cause = options.cause;
    this.metadata = options.metadata ?? {};

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CortexError);
    }
  }

  private getDefaultMaxRetries(): number {
    switch (this.category) {
      case ErrorCategory.NETWORK:
        return 5;
      case ErrorCategory.INFRASTRUCTURE:
        return 3;
      case ErrorCategory.AGENT_EXECUTION:
        return 2;
      case ErrorCategory.IMPASSE:
        return 1; // CodeSavant intervention
      default:
        return 3;
    }
  }

  public shouldEscalateToHuman(): boolean {
    return (
      this.severity === ErrorSeverity.CRITICAL ||
      this.category === ErrorCategory.DATA_CORRUPTION ||
      (this.category === ErrorCategory.IMPASSE && this.metadata.codeSavantFailed)
    );
  }

  public getRecoveryStrategy(): RecoveryStrategy {
    if (!this.retryable) {
      return RecoveryStrategy.ABORT;
    }

    // Critical errors in critical phases should escalate immediately
    if (this.severity === ErrorSeverity.CRITICAL && 
        (this.context.phase === ErrorPhase.INITIALIZATION || 
         this.category === ErrorCategory.DATA_CORRUPTION)) {
      return RecoveryStrategy.ESCALATE;
    }

    switch (this.category) {
      case ErrorCategory.IMPASSE:
        return RecoveryStrategy.CODESAVANT;
      case ErrorCategory.NETWORK:
      case ErrorCategory.TIMEOUT:
        return RecoveryStrategy.RETRY;
      case ErrorCategory.RESOURCE_EXHAUSTION:
        return RecoveryStrategy.FALLBACK;
      case ErrorCategory.DATA_CORRUPTION:
        return RecoveryStrategy.ESCALATE;
      default:
        return RecoveryStrategy.RETRY;
    }
  }

  public toJSON(): Record<string, any> {
    return {
      id: this.id,
      message: this.message,
      severity: this.severity,
      category: this.category,
      context: this.context,
      retryable: this.retryable,
      maxRetries: this.maxRetries,
      backoffStrategy: this.backoffStrategy,
      metadata: this.metadata,
      stack: this.stack,
      cause: this.cause?.message
    };
  }
}

export interface RetryConfiguration {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs: number;
  shouldRetry: (error: CortexError, attemptNumber: number) => boolean;
}

export interface CodeSavantRequest {
  taskId: string;
  originalError: CortexError;
  agentType: string;
  taskDescription: string;
  failedAttempts: RecoveryAttempt[];
  context: {
    codeModules?: string[];
    errorLogs?: string[];
    stackTrace?: string;
    systemState?: Record<string, any>;
  };
}

export interface CodeSavantResponse {
  analysisId: string;
  rootCause: string;
  suggestions: string[];
  alternativeApproach?: string;
  codeExamples?: string[];
  confidence: number; // 0-100
  estimatedComplexity: 'low' | 'medium' | 'high';
  requiresHumanIntervention: boolean;
}

export interface EscalationRequest {
  errorId: string;
  taskId: string;
  projectId: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  summary: string;
  context: ErrorContext;
  recoveryAttempts: RecoveryAttempt[];
  codeSavantResponse?: CodeSavantResponse;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  expectedResolutionTime?: string;
}

export interface ErrorLearningData {
  errorPattern: string;
  successfulRecoveryStrategy: RecoveryStrategy;
  contextSimilarity: number;
  applicabilityScore: number;
  usage_count: number;
  success_rate: number;
  lastUsed: string;
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  threshold: number;
  timeout: number;
}

export interface HealthCheckResult {
  component: string;
  healthy: boolean;
  latency?: number;
  errorRate?: number;
  lastCheck: string;
  details?: Record<string, any>;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  components: HealthCheckResult[];
  issues: string[];
  recommendations: string[];
  lastUpdate: string;
}