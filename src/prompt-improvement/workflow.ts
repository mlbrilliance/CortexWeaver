/**
 * Prompt Improvement Workflow Management
 * 
 * Contains core workflow management functionality extracted from optimizer.ts
 * This is a simplified module to maintain 500-line compliance.
 * The full implementation remains in optimizer.ts until further refactoring is needed.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CognitiveCanvas, PheromoneData } from '../cognitive-canvas';
import {
  PromptVersion,
  ImprovementProposal,
  SubmissionResult,
  ApprovalResult,
  ApplicationResult,
  RollbackResult,
  ValidationResult,
  AuditTrailEntry,
  ChangeNotification,
  PromptVersionStatus,
  ApprovalStatus,
  ImprovementPriority
} from './types';

export class PromptWorkflowManager {
  private cognitiveCanvas: CognitiveCanvas;
  private workspaceRoot: string;
  private promptsDir: string;
  private historyDir: string;
  private backupDir: string;
  private versionsFile: string;
  private auditFile: string;

  constructor(
    cognitiveCanvas: CognitiveCanvas,
    workspaceRoot: string,
    promptsDir?: string,
    historyDir?: string,
    backupDir?: string
  ) {
    this.cognitiveCanvas = cognitiveCanvas;
    this.workspaceRoot = workspaceRoot;
    this.promptsDir = promptsDir || path.join(workspaceRoot, 'prompts');
    this.historyDir = historyDir || path.join(workspaceRoot, '.cortex', 'prompt-history');
    this.backupDir = backupDir || path.join(workspaceRoot, '.cortex', 'prompt-backups');
    this.versionsFile = path.join(this.historyDir, 'versions.json');
    this.auditFile = path.join(this.historyDir, 'audit.json');
    
    this.initializeDirectories();
  }

  /**
   * Initialize required directories for prompt management
   */
  private initializeDirectories(): void {
    const dirs = [this.promptsDir, this.historyDir, this.backupDir];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    
    // Initialize versions file if it doesn't exist
    if (!fs.existsSync(this.versionsFile)) {
      fs.writeFileSync(this.versionsFile, JSON.stringify([], null, 2));
    }
    
    // Initialize audit file if it doesn't exist
    if (!fs.existsSync(this.auditFile)) {
      fs.writeFileSync(this.auditFile, JSON.stringify([], null, 2));
    }
  }

  /**
   * Submit improvement proposal for approval
   */
  async submitForApproval(proposal: ImprovementProposal): Promise<SubmissionResult> {
    try {
      // Validate proposal
      const validation = this.validateProposal(proposal);
      if (!validation.isValid) {
        return {
          submitted: false,
          proposalId: proposal.id,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Store proposal
      const versions = await this.getVersionHistory();
      const version: PromptVersion = {
        id: proposal.id,
        promptFile: proposal.promptFile,
        originalContent: proposal.originalContent,
        improvedContent: proposal.improvedContent,
        diff: proposal.diff,
        rationale: proposal.rationale,
        timestamp: proposal.submittedAt,
        status: 'pending'
      };

      versions.push(version);
      await this.saveVersionHistory(versions);

      // Add audit entry
      await this.addAuditEntry({
        id: `audit-${Date.now()}`,
        promptFile: proposal.promptFile,
        action: 'proposed',
        timestamp: new Date().toISOString(),
        performedBy: proposal.submittedBy,
        details: { proposalId: proposal.id, priority: proposal.priority }
      });

      // Create pheromone for approval tracking
      const pheromone: PheromoneData = {
        id: `proposal-${proposal.id}`,
        type: 'prompt_improvement_pending',
        strength: 0.8,
        context: 'approval_needed',
        metadata: {
          proposalId: proposal.id,
          promptFile: proposal.promptFile,
          priority: proposal.priority,
          submittedBy: proposal.submittedBy
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };

      await this.cognitiveCanvas.createPheromone(pheromone);

      return {
        submitted: true,
        proposalId: proposal.id,
        pheromoneId: pheromone.id
      };

    } catch (error) {
      return {
        submitted: false,
        proposalId: proposal.id,
        error: (error as Error).message
      };
    }
  }

  /**
   * Validate improvement proposal
   */
  private validateProposal(proposal: ImprovementProposal): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!proposal.id) errors.push('Proposal ID is required');
    if (!proposal.promptFile) errors.push('Prompt file is required');
    if (!proposal.improvedContent) errors.push('Improved content is required');
    if (!proposal.rationale) errors.push('Rationale is required');

    // Check if prompt file exists
    const promptPath = path.join(this.promptsDir, proposal.promptFile);
    if (!fs.existsSync(promptPath)) {
      errors.push(`Prompt file does not exist: ${proposal.promptFile}`);
    }

    // Validate content differences
    if (proposal.originalContent === proposal.improvedContent) {
      warnings.push('No changes detected between original and improved content');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get version history
   */
  async getVersionHistory(): Promise<PromptVersion[]> {
    try {
      const data = fs.readFileSync(this.versionsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Failed to load version history:', (error as Error).message);
      return [];
    }
  }

  /**
   * Save version history
   */
  private async saveVersionHistory(versions: PromptVersion[]): Promise<void> {
    fs.writeFileSync(this.versionsFile, JSON.stringify(versions, null, 2));
  }

  /**
   * Save single version to history
   */
  async saveVersionToHistory(version: PromptVersion): Promise<void> {
    try {
      const versions = await this.getVersionHistory();
      versions.push(version);
      await this.saveVersionHistory(versions);
    } catch (error) {
      console.warn('Failed to save version to history:', (error as Error).message);
    }
  }

  /**
   * Add entry to audit trail
   */
  async addAuditEntry(entry: AuditTrailEntry): Promise<void> {
    try {
      const auditEntries = await this.getAuditTrail();
      auditEntries.push(entry);
      
      fs.writeFileSync(this.auditFile, JSON.stringify(auditEntries, null, 2));
    } catch (error) {
      console.warn('Failed to add audit entry:', (error as Error).message);
    }
  }

  /**
   * Get audit trail for a specific prompt or all prompts
   */
  async getAuditTrail(promptFile?: string): Promise<AuditTrailEntry[]> {
    try {
      if (!fs.existsSync(this.auditFile)) {
        return [];
      }
      
      const data = fs.readFileSync(this.auditFile, 'utf-8');
      const auditEntries: AuditTrailEntry[] = JSON.parse(data);
      
      if (promptFile) {
        return auditEntries.filter(entry => entry.promptFile === promptFile);
      }
      
      return auditEntries;
    } catch (error) {
      console.warn('Failed to load audit trail:', (error as Error).message);
      return [];
    }
  }
}