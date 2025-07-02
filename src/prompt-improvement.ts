// Backward compatibility layer - delegates to modular implementation
export {
  PromptImprovementWorkflow,
  type PromptImprovementConfig,
  type PromptVersionStatus,
  type ApprovalStatus,
  type ImprovementPriority,
  type PromptVersion,
  type ImprovementProposal,
  type SubmissionResult,
  type ApprovalResult,
  type ApplicationResult,
  type RollbackResult,
  type ValidationResult,
  type AuditTrailEntry,
  type ChangeNotification
} from './prompt-improvement/index';