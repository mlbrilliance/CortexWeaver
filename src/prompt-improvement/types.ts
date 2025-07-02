/**
 * Prompt Improvement Types and Interfaces
 * 
 * Contains all type definitions used by the Prompt Improvement system
 */

/**
 * Status of a prompt version in the improvement workflow
 */
export type PromptVersionStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'rolled_back';

/**
 * Approval status for improvement proposals
 */
export type ApprovalStatus = 'approved' | 'rejected';

/**
 * Priority levels for improvement proposals
 */
export type ImprovementPriority = 'low' | 'medium' | 'high';

/**
 * Represents a versioned prompt with its improvement history
 */
export interface PromptVersion {
  id: string;
  promptFile: string;
  originalContent: string;
  improvedContent: string;
  diff: string;
  rationale: string;
  timestamp: string;
  status: PromptVersionStatus;
  approvedBy?: string;
  approvedAt?: string;
  appliedAt?: string;
  rollbackReason?: string;
}

/**
 * Represents an improvement proposal from Reflector agent
 */
export interface ImprovementProposal {
  id: string;
  promptFile: string;
  originalContent: string;
  improvedContent: string;
  diff: string;
  rationale: string;
  priority: ImprovementPriority;
  submittedBy: string;
  submittedAt: string;
  status: PromptVersionStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  comments?: string;
}

/**
 * Result of submitting a proposal for approval
 */
export interface SubmissionResult {
  submitted: boolean;
  proposalId: string;
  pheromoneId?: string;
  error?: string;
}

/**
 * Result of processing an approval decision
 */
export interface ApprovalResult {
  approved: boolean;
  proposalId: string;
  reviewedBy: string;
  comments?: string;
  timestamp: string;
}

/**
 * Result of applying a prompt improvement
 */
export interface ApplicationResult {
  success: boolean;
  versionId: string;
  backupPath?: string;
  error?: string;
}

/**
 * Result of rolling back to a previous version
 */
export interface RollbackResult {
  success: boolean;
  rolledBackTo: string;
  newVersionId?: string;
  error?: string;
}

/**
 * Validation result for improvement proposals
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Audit trail entry for tracking all prompt changes
 */
export interface AuditTrailEntry {
  id: string;
  promptFile: string;
  action: 'proposed' | 'approved' | 'rejected' | 'applied' | 'rolled_back';
  timestamp: string;
  performedBy: string;
  details: Record<string, any>;
  performanceImpact?: {
    beforeMetrics?: Record<string, number>;
    afterMetrics?: Record<string, number>;
  };
}

/**
 * Change notification for hot-reloading systems
 */
export interface ChangeNotification {
  promptFile: string;
  versionId: string;
  action: string;
  timestamp: string;
  requires_reload: boolean;
}