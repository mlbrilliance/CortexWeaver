import { TaskData } from '../../cognitive-canvas';
import { ApprovalStatus } from '../../prompt-improvement';

/**
 * Extended TaskData interface to include metadata
 */
export interface TaskDataWithMetadata extends TaskData {
  metadata?: {
    testResults?: {
      passed: number;
      failed: number;
    };
    [key: string]: any;
  };
}

/**
 * Interface for cost monitoring data (V3.0 Enhanced)
 */
export interface CostData {
  totalTokens: number;
  totalCost: number;
  breakdown: {
    claude: number;
    gemini: number;
  };
  // V3.0 enhancements
  hourlyRate?: number;
  dailyProjection?: number;
  costByAgent?: Record<string, number>;
  tokensByAgent?: Record<string, number>;
  costTrend?: {
    last24h: number;
    last7d: number;
    projectedDaily: number;
    projectedWeekly: number;
  };
  efficiency?: {
    tokensPerTask: number;
    costPerTask: number;
    successRateImpact: number;
  };
}

/**
 * Interface for budget enforcement results
 */
export interface BudgetEnforcement {
  tokenLimitExceeded: boolean;
  costLimitExceeded: boolean;
  allowContinue: boolean;
  warnings: string[];
  recommendations: string[];
}

/**
 * Interface for quality analysis results
 */
export interface QualityAnalysis {
  totalTests: number;
  passRate: number;
  qualityScore: number;
  issues: string[];
  recommendations: string[];
}

/**
 * Interface for pheromone data
 */
export interface PheromoneInput {
  type: 'guide_pheromone' | 'warn_pheromone';
  message: string;
  strength: number;
  context: string;
}

/**
 * Interface for improvement proposals
 */
export interface ImprovementProposals {
  codeStandards: string[];
  configChanges: string[];
  priority: 'low' | 'medium' | 'high';
  rationale: string;
}

/**
 * Interface for prompt improvement proposals from Reflector
 */
export interface PromptImprovement {
  file: string;
  diff: string;
  rationale: string;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Interface for prompt update audit trail
 */
export interface PromptUpdateAudit {
  id: string;
  filePath: string;
  originalContent: string;
  updatedContent: string;
  diff: string;
  reason: string;
  approvedBy: string;
  reflectorProposal?: PromptImprovement;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
}

/**
 * Interface for Reflector spawning analysis
 */
export interface ReflectorSpawnAnalysis {
  shouldSpawn: boolean;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  focusAreas: string[];
  triggers: string[];
  recommendedInterval: number; // in milliseconds
}

/**
 * Interface for governor analysis input
 */
export interface GovernorAnalysisInput {
  costData: CostData;
  qualityData: QualityAnalysis;
  budgetStatus: BudgetEnforcement;
}

/**
 * Interface for prompt approval results
 */
export interface PromptApprovalResult {
  proposalsReviewed: number;
  approved: number;
  rejected: number;
  pendingReview: number;
  approvalDetails: Array<{
    proposalId: string;
    decision: ApprovalStatus;
    rationale: string;
  }>;
}

/**
 * Interface for governor execution results
 */
export interface GovernorResult {
  costMonitoring: CostData;
  budgetEnforcement: BudgetEnforcement;
  qualityAnalysis: QualityAnalysis;
  pheromones: PheromoneInput[];
  improvements: ImprovementProposals;
  promptApprovals?: PromptApprovalResult;
}