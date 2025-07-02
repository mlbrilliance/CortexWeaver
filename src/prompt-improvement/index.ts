import * as path from 'path';
import { CognitiveCanvas } from '../cognitive-canvas';
import { PromptAnalyzer } from './analyzer';
import { 
  PromptOptimizer, 
  PromptVersion, 
  ImprovementProposal, 
  ApprovalStatus,
  ImprovementPriority,
  SubmissionResult,
  ApprovalResult,
  ApplicationResult,
  RollbackResult,
  ValidationResult,
  AuditTrailEntry,
  ChangeNotification
} from './optimizer';

// Re-export types for backward compatibility
export type { 
  PromptVersionStatus,
  ApprovalStatus,
  ImprovementPriority,
  PromptVersion,
  ImprovementProposal,
  SubmissionResult,
  ApprovalResult,
  ApplicationResult,
  RollbackResult,
  ValidationResult,
  AuditTrailEntry,
  ChangeNotification
} from './optimizer';

/**
 * Configuration for the prompt improvement workflow
 */
export interface PromptImprovementConfig {
  workspaceRoot: string;
  cognitiveCanvas: CognitiveCanvas;
  promptsDir?: string;
  historyDir?: string;
  backupDir?: string;
}

/**
 * Comprehensive prompt improvement workflow system that handles:
 * - Diff generation for prompt changes
 * - Approval workflow between Reflector and Governor agents
 * - Version tracking with rollback capability
 * - Validation of improvements
 * - Hot-reloading support
 * - Complete audit trail
 */
export class PromptImprovementWorkflow {
  private analyzer: PromptAnalyzer;
  private optimizer: PromptOptimizer;
  private workspaceRoot: string;

  constructor(config: PromptImprovementConfig) {
    this.workspaceRoot = config.workspaceRoot;
    this.analyzer = new PromptAnalyzer();
    this.optimizer = new PromptOptimizer(
      config.cognitiveCanvas,
      config.workspaceRoot,
      config.promptsDir,
      config.historyDir,
      config.backupDir
    );
  }

  /**
   * Get the workspace root directory
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  /**
   * Generate unified diff between original and improved content
   */
  async generateUnifiedDiff(originalContent: string, improvedContent: string, filename: string): Promise<string> {
    return this.analyzer.generateUnifiedDiff(originalContent, improvedContent, filename);
  }

  /**
   * Create a new prompt version with improvement tracking
   */
  async createPromptVersion(
    promptFile: string,
    originalContent: string,
    improvedContent: string,
    rationale: string,
    submittedBy: string = 'system'
  ): Promise<PromptVersion> {
    const versionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const diff = await this.generateUnifiedDiff(originalContent, improvedContent, promptFile);
    
    const version: PromptVersion = {
      id: versionId,
      promptFile,
      originalContent,
      improvedContent,
      diff,
      rationale,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    
    // Save to version history
    await this.optimizer.saveVersionToHistory(version);
    
    // Create audit trail entry
    await this.optimizer.addAuditEntry({
      id: `audit-${versionId}`,
      promptFile,
      action: 'proposed',
      timestamp: version.timestamp,
      performedBy: submittedBy,
      details: {
        versionId,
        rationale,
        diffLength: diff.length
      }
    });
    
    return version;
  }

  /**
   * Get version history for all prompts or specific prompt
   */
  async getVersionHistory(promptFile?: string): Promise<PromptVersion[]> {
    return this.optimizer.getVersionHistory(promptFile);
  }

  /**
   * Submit improvement proposal to Governor for approval
   */
  async submitForApproval(proposal: ImprovementProposal): Promise<SubmissionResult> {
    return this.optimizer.submitForApproval(proposal);
  }

  /**
   * Process approval/rejection from Governor
   */
  async processApproval(
    proposalId: string,
    decision: ApprovalStatus,
    reviewedBy: string,
    comments?: string
  ): Promise<ApprovalResult> {
    return this.optimizer.processApproval(proposalId, decision, reviewedBy, comments);
  }

  /**
   * Apply approved prompt improvement
   */
  async applyPromptImprovement(version: PromptVersion): Promise<ApplicationResult> {
    return this.optimizer.applyPromptImprovement(version);
  }

  /**
   * Rollback to a previous version
   */
  async rollbackToVersion(promptFile: string, versionId: string): Promise<RollbackResult> {
    return this.optimizer.rollbackToVersion(promptFile, versionId);
  }

  /**
   * Validate improvement proposal
   */
  async validateImprovement(proposal: ImprovementProposal): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check if prompt file exists
    const promptPath = path.resolve(this.workspaceRoot, 'prompts', proposal.promptFile);
    const fs = await import('fs');
    if (!fs.existsSync(promptPath)) {
      errors.push('Prompt file does not exist');
    }
    
    // Use analyzer for content validation
    const contentValidation = this.analyzer.validateContent(proposal.originalContent, proposal.improvedContent);
    
    if (!contentValidation.hasContent) {
      if (!proposal.originalContent.trim()) {
        errors.push('Original content is empty');
      }
      if (!proposal.improvedContent.trim()) {
        errors.push('Improved content is empty');
      }
    }
    
    if (!contentValidation.hasChanges) {
      warnings.push('No changes detected between original and improved content');
    }
    
    // Validate diff format
    if (!proposal.diff.includes('---') || !proposal.diff.includes('+++')) {
      errors.push('Invalid diff format');
    }
    
    // Validate rationale
    if (!proposal.rationale.trim()) {
      errors.push('Rationale is required');
    }
    
    // Analyze diff for complexity warnings
    const diffAnalysis = this.analyzer.analyzeDiff(proposal.diff);
    if (diffAnalysis.complexity === 'high') {
      warnings.push('High complexity changes detected - review carefully');
    }
    
    // Check for potential issues using content metrics
    const contentMetrics = this.analyzer.compareContentMetrics(proposal.originalContent, proposal.improvedContent);
    if (Math.abs(contentMetrics.wordCountDelta) > proposal.originalContent.split(/\s+/).length * 2) {
      warnings.push('Improved content is significantly different in length from original');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get recent changes for hot-reload systems
   */
  async getRecentChanges(hoursBack: number = 24): Promise<ChangeNotification[]> {
    return this.optimizer.getRecentChanges(hoursBack);
  }

  /**
   * Process improvement proposals from Reflector agent
   */
  async processReflectorProposals(proposals: Array<{
    file: string;
    diff: string;
    rationale: string;
    priority: ImprovementPriority;
  }>): Promise<ImprovementProposal[]> {
    return this.optimizer.processReflectorProposals(proposals);
  }

  /**
   * Process Governor approval responses
   */
  async processGovernorResponses(): Promise<Array<{
    proposalId: string;
    approved: boolean;
    comments?: string;
  }>> {
    return this.optimizer.processGovernorResponses();
  }

  /**
   * Get audit trail for a specific prompt or all prompts
   */
  async getAuditTrail(promptFile?: string): Promise<AuditTrailEntry[]> {
    return this.optimizer.getAuditTrail(promptFile);
  }

  /**
   * Get analyzer instance for advanced analysis
   */
  getAnalyzer(): PromptAnalyzer {
    return this.analyzer;
  }

  /**
   * Get optimizer instance for advanced workflow management
   */
  getOptimizer(): PromptOptimizer {
    return this.optimizer;
  }
}