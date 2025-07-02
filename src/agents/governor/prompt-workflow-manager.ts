import * as fs from 'fs';
import * as path from 'path';
import { CognitiveCanvas, PheromoneData } from '../../cognitive-canvas';
import { PromptImprovementWorkflow, ApprovalStatus } from '../../prompt-improvement';
import { PersonaLoader } from '../../persona';
import { ClaudeClient } from '../../claude-client';
import { 
  PromptApprovalResult, 
  PromptImprovement, 
  PromptUpdateAudit 
} from './types';

/**
 * PromptWorkflowManager handles prompt improvement workflow and proposal processing for the Governor agent
 */
export class PromptWorkflowManager {
  private promptUpdateAudits: Map<string, PromptUpdateAudit> = new Map();

  constructor(
    private promptImprovementWorkflow: PromptImprovementWorkflow | null,
    private cognitiveCanvas: CognitiveCanvas | null,
    private personaLoader: PersonaLoader | null,
    private claudeClient: ClaudeClient | null,
    private config: any | null,
    private currentTask: any | null,
    private createPheromones: (pheromones: any[]) => Promise<void>,
    private sendToClaude: (prompt: string, options?: any) => Promise<any>,
    private reportProgress: (status: string, message: string) => Promise<void>
  ) {}

  /**
   * Process prompt improvement workflow approvals (V3.0)
   */
  async processPromptApprovalWorkflow(): Promise<PromptApprovalResult> {
    const result: PromptApprovalResult = {
      proposalsReviewed: 0,
      approved: 0,
      rejected: 0,
      pendingReview: 0,
      approvalDetails: []
    };

    if (!this.promptImprovementWorkflow || !this.cognitiveCanvas) {
      return result;
    }

    try {
      // Get approval request pheromones
      const approvalRequests = await this.cognitiveCanvas.getPheromonesByType('approval_request');
      const promptApprovalRequests = approvalRequests.filter(p => 
        p.context === 'prompt_improvement_approval' && 
        p.metadata?.requiresApproval === true
      );

      for (const request of promptApprovalRequests) {
        const proposalId = request.metadata?.proposalId;
        if (!proposalId) continue;

        result.proposalsReviewed++;

        try {
          // Evaluate the proposal using Claude for intelligent review
          const approvalDecision = await this.evaluatePromptProposalWithWorkflow(request);
          
          // Process the approval through workflow
          await this.promptImprovementWorkflow.processApproval(
            proposalId,
            approvalDecision.decision,
            'governor',
            approvalDecision.rationale
          );

          // Track results
          if (approvalDecision.decision === 'approved') {
            result.approved++;
          } else {
            result.rejected++;
          }

          result.approvalDetails.push({
            proposalId,
            decision: approvalDecision.decision,
            rationale: approvalDecision.rationale
          });

          // Create response pheromone
          await this.createApprovalResponsePheromone(proposalId, approvalDecision);

        } catch (error) {
          console.warn(`Failed to process approval for proposal ${proposalId}:`, error);
          result.pendingReview++;
        }
      }

      if (result.proposalsReviewed > 0) {
        await this.reportProgress('info', 
          `Processed ${result.proposalsReviewed} prompt improvement proposals: ${result.approved} approved, ${result.rejected} rejected`
        );
      }

    } catch (error) {
      console.warn('Failed to process prompt approval workflow:', error);
    }

    return result;
  }

  /**
   * Evaluate prompt proposal using intelligent analysis
   */
  private async evaluatePromptProposalWithWorkflow(approvalRequest: PheromoneData): Promise<{
    decision: ApprovalStatus;
    rationale: string;
  }> {
    const metadata = approvalRequest.metadata;
    const priority = metadata?.priority || 'medium';
    const rationale = metadata?.rationale || '';
    const diffPreview = metadata?.diffPreview || '';

    // Auto-approve low-risk improvements
    if (priority === 'low' && diffPreview.length < 100) {
      return {
        decision: 'approved',
        rationale: 'Auto-approved: Low-risk improvement with minimal changes'
      };
    }

    // Use Claude for intelligent evaluation of medium/high priority changes
    if (this.claudeClient) {
      try {
        const evaluationPrompt = `Evaluate this prompt improvement proposal for approval:

PRIORITY: ${priority}
RATIONALE: ${rationale}
DIFF PREVIEW: ${diffPreview}

Consider:
1. Does the improvement align with best practices?
2. Are the changes safe and beneficial?
3. Is the rationale sound?
4. Are there any risks?

Respond with APPROVED or REJECTED followed by a brief rationale.`;

        const response = await this.sendToClaude(evaluationPrompt, {
          maxTokens: 200,
          temperature: 0.1
        });

        const decision = response.content.toLowerCase().includes('approved') ? 'approved' : 'rejected';
        const extractedRationale = response.content.split('\n').slice(1).join(' ').trim() || rationale;

        return {
          decision: decision as ApprovalStatus,
          rationale: extractedRationale
        };
      } catch (error) {
        console.warn('Failed to get Claude evaluation, using rule-based approval:', error);
      }
    }

    // Fallback to rule-based evaluation
    if (priority === 'high' && !rationale.toLowerCase().includes('critical')) {
      return {
        decision: 'rejected',
        rationale: 'High-priority change without clear critical justification'
      };
    }

    return {
      decision: 'approved',
      rationale: 'Approved based on standard evaluation criteria'
    };
  }

  /**
   * Create approval response pheromone for workflow communication
   */
  private async createApprovalResponsePheromone(proposalId: string, decision: {
    decision: ApprovalStatus;
    rationale: string;
  }): Promise<void> {
    if (!this.cognitiveCanvas) return;

    try {
      const responsePheromone: PheromoneData = {
        id: `approval-response-${proposalId}`,
        type: 'approval_response',
        strength: decision.decision === 'approved' ? 0.8 : 0.6,
        context: 'prompt_improvement_response',
        metadata: {
          proposalId,
          decision: decision.decision,
          comments: decision.rationale,
          reviewedBy: 'governor',
          reviewedAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour
      };

      await this.cognitiveCanvas.createPheromone(responsePheromone);
    } catch (error) {
      console.warn('Failed to create approval response pheromone:', error);
    }
  }

  /**
   * Check for and process Reflector improvement proposals (V3.0)
   */
  async processReflectorProposals(): Promise<void> {
    if (!this.cognitiveCanvas) {
      return;
    }

    try {
      // Get improvement proposal pheromones from Reflector
      const proposalPheromones = await this.cognitiveCanvas.getPheromonesByType('guide_pheromone');
      const improvementProposals = proposalPheromones.filter(p => 
        p.context === 'improvement_proposal' && 
        p.metadata?.proposals &&
        p.metadata?.agentId !== this.config?.id // Not from this Governor instance
      );

      for (const proposalPheromone of improvementProposals) {
        await this.reviewAndProcessPromptProposals(proposalPheromone.metadata.proposals, proposalPheromone.id);
      }
    } catch (error) {
      console.warn('Failed to process Reflector proposals:', error);
    }
  }

  /**
   * Review and approve/reject prompt improvement proposals from Reflector (V3.0)
   */
  private async reviewAndProcessPromptProposals(
    proposals: PromptImprovement[], 
    pheromoneId: string
  ): Promise<void> {
    if (!proposals || proposals.length === 0) {
      return;
    }

    for (const proposal of proposals) {
      try {
        // Auto-approve based on priority and risk assessment
        const approvalDecision = await this.evaluatePromptProposal(proposal);
        
        if (approvalDecision.approved) {
          await this.applyPromptUpdate(proposal, approvalDecision.reason, pheromoneId);
        } else {
          await this.rejectPromptProposal(proposal, approvalDecision.reason, pheromoneId);
        }
      } catch (error) {
        console.error(`Failed to process proposal for ${proposal.file}:`, error);
      }
    }
  }

  /**
   * Evaluate whether to approve a prompt improvement proposal (V3.0)
   */
  private async evaluatePromptProposal(proposal: PromptImprovement): Promise<{
    approved: boolean;
    reason: string;
  }> {
    // Auto-approve high-priority proposals with clear rationale
    if (proposal.priority === 'high' && proposal.rationale.length > 50) {
      return {
        approved: true,
        reason: 'High priority proposal with detailed rationale - auto-approved'
      };
    }

    // Auto-approve medium priority if file exists and rationale is comprehensive
    if (proposal.priority === 'medium' && proposal.rationale.length > 30) {
      const fileExists = fs.existsSync(proposal.file);
      if (fileExists) {
        return {
          approved: true,
          reason: 'Medium priority proposal for existing file with good rationale - auto-approved'
        };
      }
    }

    // Reject if file doesn't exist or rationale is insufficient
    if (!fs.existsSync(proposal.file)) {
      return {
        approved: false,
        reason: 'Target file does not exist'
      };
    }

    if (proposal.rationale.length < 20) {
      return {
        approved: false,
        reason: 'Insufficient rationale provided'
      };
    }

    // Default to approval for low-priority changes with basic validation
    return {
      approved: true,
      reason: 'Low-risk change approved with basic validation'
    };
  }

  /**
   * Apply an approved prompt update (V3.0)
   */
  private async applyPromptUpdate(
    proposal: PromptImprovement, 
    approvalReason: string,
    pheromoneId: string
  ): Promise<void> {
    try {
      // Read current content
      const originalContent = fs.readFileSync(proposal.file, 'utf-8');
      
      // Apply diff (simplified approach - in production would use proper diff parsing)
      const updatedContent = await this.applyDiffToContent(originalContent, proposal.diff);
      
      // Create audit trail
      const auditId = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const audit: PromptUpdateAudit = {
        id: auditId,
        filePath: proposal.file,
        originalContent,
        updatedContent,
        diff: proposal.diff,
        reason: approvalReason,
        approvedBy: this.config?.id || 'governor',
        reflectorProposal: proposal,
        timestamp: new Date().toISOString(),
        status: 'approved'
      };

      this.promptUpdateAudits.set(auditId, audit);

      // Write updated content
      fs.writeFileSync(proposal.file, updatedContent, 'utf-8');
      audit.status = 'applied';

      // Invalidate persona cache if this is a persona file
      if (this.personaLoader) {
        const agentName = path.basename(proposal.file, '.md');
        // Force reload on next access by clearing cache (implementation would depend on PersonaLoader internals)
      }

      console.log(`Applied prompt update to ${proposal.file}: ${proposal.rationale}`);
      
      // Create success pheromone
      await this.createPheromones([{
        type: 'guide_pheromone',
        message: `Prompt update applied successfully to ${proposal.file}`,
        strength: 0.7,
        context: 'prompt_update_success'
      }]);

    } catch (error) {
      console.error(`Failed to apply prompt update to ${proposal.file}:`, error);
      
      // Create warning pheromone
      await this.createPheromones([{
        type: 'warn_pheromone',
        message: `Failed to apply prompt update to ${proposal.file}: ${(error as Error).message}`,
        strength: 0.8,
        context: 'prompt_update_failure'
      }]);
    }
  }

  /**
   * Reject a prompt improvement proposal (V3.0)
   */
  private async rejectPromptProposal(
    proposal: PromptImprovement,
    rejectionReason: string,
    pheromoneId: string
  ): Promise<void> {
    const auditId = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const audit: PromptUpdateAudit = {
      id: auditId,
      filePath: proposal.file,
      originalContent: fs.existsSync(proposal.file) ? fs.readFileSync(proposal.file, 'utf-8') : '',
      updatedContent: '',
      diff: proposal.diff,
      reason: rejectionReason,
      approvedBy: this.config?.id || 'governor',
      reflectorProposal: proposal,
      timestamp: new Date().toISOString(),
      status: 'rejected'
    };

    this.promptUpdateAudits.set(auditId, audit);

    console.log(`Rejected prompt proposal for ${proposal.file}: ${rejectionReason}`);
    
    // Create informational pheromone
    await this.createPheromones([{
      type: 'guide_pheromone',
      message: `Prompt proposal rejected for ${proposal.file}: ${rejectionReason}`,
      strength: 0.5,
      context: 'prompt_proposal_rejected'
    }]);
  }

  /**
   * Apply diff to content (simplified implementation)
   */
  private async applyDiffToContent(originalContent: string, diff: string): Promise<string> {
    // Simplified diff application - in production would use proper diff parsing library
    // For now, we'll assume the diff contains the new content or specific replacements
    
    if (diff.includes('+++') && diff.includes('---')) {
      // Parse unified diff format
      const lines = diff.split('\n');
      let result = originalContent;
      
      for (const line of lines) {
        if (line.startsWith('- ')) {
          const oldLine = line.substring(2);
          result = result.replace(oldLine, '');
        } else if (line.startsWith('+ ')) {
          const newLine = line.substring(2);
          result = result + '\n' + newLine;
        }
      }
      
      return result.trim();
    } else {
      // Assume diff contains improvement suggestions as comments
      return originalContent + '\n\n' + diff;
    }
  }

  /**
   * Get audit trail for prompt updates (V3.0)
   */
  getPromptUpdateAudits(): PromptUpdateAudit[] {
    return Array.from(this.promptUpdateAudits.values());
  }

  /**
   * Update references for dependency injection
   */
  updateReferences(
    promptImprovementWorkflow: PromptImprovementWorkflow | null,
    cognitiveCanvas: CognitiveCanvas | null,
    personaLoader: PersonaLoader | null,
    claudeClient: ClaudeClient | null,
    config: any | null,
    currentTask: any | null
  ): void {
    this.promptImprovementWorkflow = promptImprovementWorkflow;
    this.cognitiveCanvas = cognitiveCanvas;
    this.personaLoader = personaLoader;
    this.claudeClient = claudeClient;
    this.config = config;
    this.currentTask = currentTask;
  }
}