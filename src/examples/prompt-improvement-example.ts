/**
 * Example usage of the Prompt Improvement Workflow system
 * 
 * This example demonstrates how to:
 * 1. Initialize the workflow
 * 2. Process improvement proposals from Reflector
 * 3. Handle Governor approvals
 * 4. Apply improvements and maintain version history
 * 5. Support rollback functionality
 */

import { PromptImprovementWorkflow, ImprovementProposal } from '../prompt-improvement';
import { CognitiveCanvas } from '../cognitive-canvas';

/**
 * Example: Setting up the prompt improvement workflow
 */
async function initializeWorkflow(): Promise<PromptImprovementWorkflow> {
  // Mock cognitive canvas for example
  const cognitiveCanvas = new CognitiveCanvas({
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    username: process.env.NEO4J_USERNAME || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
    projectId: 'example-project',
    sessionId: 'example-session'
  });

  const workflow = new PromptImprovementWorkflow({
    workspaceRoot: '/path/to/workspace',
    cognitiveCanvas
  });

  return workflow;
}

/**
 * Example: Processing Reflector improvement proposals
 */
async function processReflectorProposals() {
  const workflow = await initializeWorkflow();

  // Example proposals from Reflector agent
  const reflectorProposals = [
    {
      file: 'agents/architect.md',
      diff: `--- agents/architect.md
+++ agents/architect.md
@@ -1,4 +1,5 @@
 You are an expert software architect.
-Design scalable systems.
+Design scalable and maintainable systems.
+Consider security implications in all designs.
 Follow best practices.`,
      rationale: 'Added emphasis on maintainability and security based on recent performance analysis',
      priority: 'medium' as const
    },
    {
      file: 'agents/coder.md',
      diff: `--- agents/coder.md
+++ agents/coder.md
@@ -2,3 +2,4 @@
 Write clean, efficient code.
 Follow coding standards.
+Include comprehensive error handling.`,
      rationale: 'Added error handling requirement based on failure pattern analysis',
      priority: 'high' as const
    }
  ];

  // Process proposals through workflow
  const processedProposals = await workflow.processReflectorProposals(reflectorProposals);
  
  console.log(`Processed ${processedProposals.length} proposals:`);
  processedProposals.forEach(proposal => {
    console.log(`- ${proposal.promptFile}: ${proposal.status} (${proposal.priority} priority)`);
  });

  return processedProposals;
}

/**
 * Example: Simulating Governor approval process
 */
async function simulateGovernorApprovals() {
  const workflow = await initializeWorkflow();

  // Simulate Governor responses to approval requests
  const approvalResponses = [
    {
      proposalId: 'reflector-1234567890-abc123def',
      approved: true,
      comments: 'Good improvement that addresses security concerns'
    },
    {
      proposalId: 'reflector-0987654321-def456ghi',
      approved: false,
      comments: 'Changes too broad, needs more specific rationale'
    }
  ];

  for (const response of approvalResponses) {
    const result = await workflow.processApproval(
      response.proposalId,
      response.approved ? 'approved' : 'rejected',
      'governor',
      response.comments
    );

    console.log(`Approval processed: ${result.proposalId} - ${result.approved ? 'APPROVED' : 'REJECTED'}`);
    console.log(`Rationale: ${result.comments}`);
  }
}

/**
 * Example: Applying approved improvements
 */
async function applyApprovedImprovements() {
  const workflow = await initializeWorkflow();

  // Get approved versions
  const versions = await workflow.getVersionHistory();
  const approvedVersions = versions.filter(v => v.status === 'approved');

  for (const version of approvedVersions) {
    try {
      const result = await workflow.applyPromptImprovement(version);
      
      if (result.success) {
        console.log(`Applied improvement to ${version.promptFile}`);
        console.log(`Backup created at: ${result.backupPath}`);
      } else {
        console.error(`Failed to apply improvement: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error applying improvement:`, error);
    }
  }
}

/**
 * Example: Version history and rollback
 */
async function demonstrateVersionControl() {
  const workflow = await initializeWorkflow();

  // Get version history for a specific prompt
  const promptFile = 'agents/architect.md';
  const history = await workflow.getVersionHistory(promptFile);

  console.log(`Version history for ${promptFile}:`);
  history.forEach(version => {
    console.log(`- ${version.id}: ${version.status} (${version.timestamp})`);
    console.log(`  Rationale: ${version.rationale}`);
  });

  // Example rollback to previous version
  if (history.length > 1) {
    const targetVersion = history[history.length - 2]; // Previous version
    const rollbackResult = await workflow.rollbackToVersion(promptFile, targetVersion.id);

    if (rollbackResult.success) {
      console.log(`Rolled back to version ${rollbackResult.rolledBackTo}`);
    } else {
      console.error(`Rollback failed: ${rollbackResult.error}`);
    }
  }
}

/**
 * Example: Validation and audit trail
 */
async function demonstrateValidationAndAudit() {
  const workflow = await initializeWorkflow();

  // Example validation of improvement proposal
  const testProposal: ImprovementProposal = {
    id: 'test-proposal-123',
    promptFile: 'agents/test.md',
    originalContent: 'You are a test agent.',
    improvedContent: 'You are a comprehensive test agent with advanced capabilities.',
    diff: 'mock diff',
    rationale: 'Enhanced agent capabilities',
    priority: 'medium',
    submittedBy: 'reflector',
    submittedAt: new Date().toISOString(),
    status: 'pending'
  };

  const validation = await workflow.validateImprovement(testProposal);
  console.log('Validation result:', validation);

  // Get audit trail
  const auditTrail = await workflow.getAuditTrail('agents/test.md');
  console.log('Audit trail entries:', auditTrail.length);
  
  auditTrail.forEach(entry => {
    console.log(`- ${entry.action} by ${entry.performedBy} at ${entry.timestamp}`);
  });
}

/**
 * Example: Hot-reload integration
 */
async function demonstrateHotReload() {
  const workflow = await initializeWorkflow();

  // Get recent changes for hot-reload systems
  const recentChanges = await workflow.getRecentChanges(24); // Last 24 hours
  
  console.log('Recent changes requiring hot-reload:');
  recentChanges.forEach(change => {
    console.log(`- ${change.promptFile}: ${change.action} at ${change.timestamp}`);
    if (change.requires_reload) {
      console.log('  → Hot-reload required');
    }
  });
}

/**
 * Complete workflow example
 */
async function completeWorkflowExample() {
  console.log('=== CortexWeaver 3.0 Prompt Improvement Workflow Example ===\n');

  try {
    console.log('1. Processing Reflector proposals...');
    await processReflectorProposals();
    console.log('');

    console.log('2. Simulating Governor approvals...');
    await simulateGovernorApprovals();
    console.log('');

    console.log('3. Applying approved improvements...');
    await applyApprovedImprovements();
    console.log('');

    console.log('4. Demonstrating version control...');
    await demonstrateVersionControl();
    console.log('');

    console.log('5. Validation and audit trail...');
    await demonstrateValidationAndAudit();
    console.log('');

    console.log('6. Hot-reload integration...');
    await demonstrateHotReload();
    console.log('');

    console.log('=== Workflow example completed successfully ===');
  } catch (error) {
    console.error('Workflow example failed:', error);
  }
}

// Export for use in other modules
export {
  initializeWorkflow,
  processReflectorProposals,
  simulateGovernorApprovals,
  applyApprovedImprovements,
  demonstrateVersionControl,
  demonstrateValidationAndAudit,
  demonstrateHotReload,
  completeWorkflowExample
};

// Run example if this file is executed directly
if (require.main === module) {
  completeWorkflowExample().catch(console.error);
}