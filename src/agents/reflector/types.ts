import { TaskData } from '../../cognitive-canvas';
import { ImprovementPriority } from '../../prompt-improvement';

/**
 * Interface for performance pattern analysis results
 */
export interface PerformancePattern {
  pattern: string;
  successRate?: number;
  failureRate?: number;
  avgPerformance?: {
    executionTime: number;
    memoryUsage?: number;
    testPassRate?: number;
  };
  commonIssues?: string[];
  frequency: number;
}

/**
 * Interface for pattern analysis results
 */
export interface PatternAnalysis {
  successPatterns: PerformancePattern[];
  failurePatterns: PerformancePattern[];
  correlations: {
    promptVersions: Record<string, { successRate: number; sampleSize: number }>;
    codePatterns: Record<string, { successRate: number; avgPerformance: any }>;
    timeBasedTrends: Array<{ period: string; successRate: number; patterns: string[] }>;
  };
}

/**
 * Interface for pheromone generation input
 */
export interface PheromoneInput {
  type: 'guide_pheromone' | 'warn_pheromone';
  strength: number;
  context: string;
  message: string;
}

/**
 * Interface for prompt analysis results
 */
export interface PromptAnalysis {
  promptVersions: Record<string, {
    successRate: number;
    avgExecutionTime: number;
    sampleSize: number;
    lastUsed: string;
  }>;
  underperforming: Array<{
    version: string;
    issues: string[];
    suggestedImprovements: string[];
  }>;
  recommendations: string[];
}

/**
 * Interface for prompt improvement proposals
 */
export interface PromptImprovement {
  file: string;
  diff: string;
  rationale: string;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Interface for prompt improvements collection
 */
export interface PromptImprovements {
  proposals: PromptImprovement[];
}

/**
 * Interface for Governor submission results
 */
export interface GovernorSubmission {
  submitted: boolean;
  proposals: PromptImprovement[];
  pheromoneId?: string;
}

/**
 * Interface for persona update proposals
 */
export interface PersonaUpdateProposal {
  agentName: string;
  filePath: string;
  currentVersion: string;
  proposedChanges: {
    section: string;
    currentContent: string;
    proposedContent: string;
    rationale: string;
  }[];
  priority: 'low' | 'medium' | 'high';
  triggeredBy: string; // What triggered this update suggestion
}

/**
 * Interface for persona update results
 */
export interface PersonaUpdateResult {
  updatesProposed: number;
  updatesApplied: number;
  proposals: PersonaUpdateProposal[];
  agentsNotified: string[];
}

/**
 * Interface for complete reflection results
 */
export interface ReflectionResult {
  performanceAnalysis: PatternAnalysis;
  pheromones: PheromoneInput[];
  promptImprovements?: PromptImprovements;
  personaUpdates?: PersonaUpdateResult;
  governorSubmission?: GovernorSubmission;
  workflowResults?: {
    proposalsProcessed: number;
    successfulSubmissions: number;
    errors: string[];
  };
}

/**
 * Extended TaskData interface with metadata
 */
export interface TaskDataWithMetadata extends TaskData {
  metadata?: {
    testResults?: { passed: number; failed: number };
    performance?: { executionTime: number; memoryUsage?: number };
    codePattern?: string;
    promptVersion?: string;
    failureReason?: string;
    [key: string]: any;
  };
}