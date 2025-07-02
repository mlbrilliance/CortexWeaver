#!/usr/bin/env node

/**
 * CLI utility for CortexWeaver 3.0 Prompt Improvement Workflow
 * 
 * This utility provides command-line access to the prompt improvement system:
 * - View version history
 * - Process pending approvals
 * - Apply improvements
 * - Rollback changes
 * - Generate reports
 */

import * as fs from 'fs';
import * as path from 'path';
import { PromptImprovementWorkflow } from '../prompt-improvement';
import { CognitiveCanvas } from '../cognitive-canvas';

interface CLIOptions {
  workspaceRoot?: string;
  command?: string;
  promptFile?: string;
  versionId?: string;
  format?: 'json' | 'table' | 'summary';
  hoursBack?: number;
  verbose?: boolean;
}

class PromptImprovementCLI {
  private workflow: PromptImprovementWorkflow | null = null;
  private options: CLIOptions;

  constructor(options: CLIOptions = {}) {
    this.options = {
      workspaceRoot: process.cwd(),
      format: 'table',
      hoursBack: 24,
      verbose: false,
      ...options
    };
  }

  async initialize(): Promise<void> {
    if (!this.options.workspaceRoot) {
      throw new Error('Workspace root is required');
    }

    // Create a mock cognitive canvas for CLI usage
    const cognitiveCanvas = new CognitiveCanvas({
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password',
      projectId: 'cli-session',
      sessionId: `cli-${Date.now()}`
    });

    this.workflow = new PromptImprovementWorkflow({
      workspaceRoot: this.options.workspaceRoot,
      cognitiveCanvas
    });
  }

  async run(): Promise<void> {
    if (!this.workflow) {
      await this.initialize();
    }

    const command = this.options.command || this.parseCommand();
    
    switch (command) {
      case 'history':
        await this.showVersionHistory();
        break;
      case 'status':
        await this.showStatus();
        break;
      case 'apply':
        await this.applyImprovements();
        break;
      case 'rollback':
        await this.rollbackVersion();
        break;
      case 'audit':
        await this.showAuditTrail();
        break;
      case 'changes':
        await this.showRecentChanges();
        break;
      case 'validate':
        await this.validateWorkspace();
        break;
      case 'help':
        this.showHelp();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        this.showHelp();
        process.exit(1);
    }
  }

  private parseCommand(): string {
    const args = process.argv.slice(2);
    return args[0] || 'help';
  }

  private async showVersionHistory(): Promise<void> {
    if (!this.workflow) return;

    const versions = await this.workflow.getVersionHistory(this.options.promptFile);
    
    if (this.options.format === 'json') {
      console.log(JSON.stringify(versions, null, 2));
      return;
    }

    if (versions.length === 0) {
      console.log('No version history found.');
      return;
    }

    console.log(`\n📋 Version History${this.options.promptFile ? ` for ${this.options.promptFile}` : ''}\n`);
    
    for (const version of versions.reverse()) {
      const statusIcon = this.getStatusIcon(version.status);
      const date = new Date(version.timestamp).toLocaleDateString();
      
      console.log(`${statusIcon} ${version.id}`);
      console.log(`   File: ${version.promptFile}`);
      console.log(`   Date: ${date}`);
      console.log(`   Status: ${version.status.toUpperCase()}`);
      console.log(`   Rationale: ${version.rationale}`);
      
      if (version.approvedBy) {
        console.log(`   Approved by: ${version.approvedBy} (${new Date(version.approvedAt!).toLocaleDateString()})`);
      }
      
      if (this.options.verbose && version.diff) {
        console.log(`   Diff preview: ${version.diff.substring(0, 100)}...`);
      }
      
      console.log('');
    }
  }

  private async showStatus(): Promise<void> {
    if (!this.workflow) return;

    const versions = await this.workflow.getVersionHistory();
    const auditTrail = await this.workflow.getAuditTrail();
    
    const stats = {
      total: versions.length,
      pending: versions.filter(v => v.status === 'pending').length,
      approved: versions.filter(v => v.status === 'approved').length,
      applied: versions.filter(v => v.status === 'applied').length,
      rejected: versions.filter(v => v.status === 'rejected').length,
      auditEntries: auditTrail.length
    };

    if (this.options.format === 'json') {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log('\n📊 Prompt Improvement Workflow Status\n');
    console.log(`Total Versions: ${stats.total}`);
    console.log(`├─ 🟡 Pending: ${stats.pending}`);
    console.log(`├─ 🟢 Approved: ${stats.approved}`);
    console.log(`├─ ✅ Applied: ${stats.applied}`);
    console.log(`└─ 🔴 Rejected: ${stats.rejected}`);
    console.log(`\nAudit Trail Entries: ${stats.auditEntries}`);

    if (stats.pending > 0) {
      console.log(`\n⚠️  ${stats.pending} improvements pending approval`);
    }

    if (stats.approved > 0) {
      console.log(`\n✨ ${stats.approved} improvements ready to apply`);
    }
  }

  private async applyImprovements(): Promise<void> {
    if (!this.workflow) return;

    const versions = await this.workflow.getVersionHistory();
    const approved = versions.filter(v => v.status === 'approved');

    if (approved.length === 0) {
      console.log('No approved improvements to apply.');
      return;
    }

    console.log(`\n🚀 Applying ${approved.length} approved improvements...\n`);

    let applied = 0;
    let failed = 0;

    for (const version of approved) {
      try {
        const result = await this.workflow.applyPromptImprovement(version);
        
        if (result.success) {
          console.log(`✅ Applied: ${version.promptFile}`);
          console.log(`   Version: ${version.id}`);
          console.log(`   Backup: ${result.backupPath}`);
          applied++;
        } else {
          console.log(`❌ Failed: ${version.promptFile} - ${result.error}`);
          failed++;
        }
      } catch (error) {
        console.log(`❌ Error: ${version.promptFile} - ${(error as Error).message}`);
        failed++;
      }
      
      console.log('');
    }

    console.log(`📈 Summary: ${applied} applied, ${failed} failed`);
  }

  private async rollbackVersion(): Promise<void> {
    if (!this.workflow) return;

    const { promptFile, versionId } = this.options;
    
    if (!promptFile || !versionId) {
      console.error('Both --prompt-file and --version-id are required for rollback');
      return;
    }

    try {
      const result = await this.workflow.rollbackToVersion(promptFile, versionId);
      
      if (result.success) {
        console.log(`✅ Successfully rolled back ${promptFile} to version ${versionId}`);
        if (result.newVersionId) {
          console.log(`📝 Created rollback version: ${result.newVersionId}`);
        }
      } else {
        console.log(`❌ Rollback failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Rollback error: ${(error as Error).message}`);
    }
  }

  private async showAuditTrail(): Promise<void> {
    if (!this.workflow) return;

    const auditTrail = await this.workflow.getAuditTrail(this.options.promptFile);
    
    if (this.options.format === 'json') {
      console.log(JSON.stringify(auditTrail, null, 2));
      return;
    }

    if (auditTrail.length === 0) {
      console.log('No audit trail entries found.');
      return;
    }

    console.log(`\n📋 Audit Trail${this.options.promptFile ? ` for ${this.options.promptFile}` : ''}\n`);
    
    for (const entry of auditTrail.reverse()) {
      const actionIcon = this.getActionIcon(entry.action);
      const date = new Date(entry.timestamp).toLocaleString();
      
      console.log(`${actionIcon} ${entry.action.toUpperCase()}`);
      console.log(`   File: ${entry.promptFile}`);
      console.log(`   By: ${entry.performedBy}`);
      console.log(`   Date: ${date}`);
      
      if (this.options.verbose && entry.details) {
        console.log(`   Details: ${JSON.stringify(entry.details, null, 4)}`);
      }
      
      console.log('');
    }
  }

  private async showRecentChanges(): Promise<void> {
    if (!this.workflow) return;

    const changes = await this.workflow.getRecentChanges(this.options.hoursBack);
    
    if (this.options.format === 'json') {
      console.log(JSON.stringify(changes, null, 2));
      return;
    }

    if (changes.length === 0) {
      console.log(`No changes in the last ${this.options.hoursBack} hours.`);
      return;
    }

    console.log(`\n🔄 Recent Changes (Last ${this.options.hoursBack} hours)\n`);
    
    for (const change of changes) {
      const reloadIcon = change.requires_reload ? '🔄' : '📝';
      const date = new Date(change.timestamp).toLocaleString();
      
      console.log(`${reloadIcon} ${change.promptFile}`);
      console.log(`   Action: ${change.action}`);
      console.log(`   Date: ${date}`);
      console.log(`   Version: ${change.versionId}`);
      
      if (change.requires_reload) {
        console.log('   🚨 Hot-reload required');
      }
      
      console.log('');
    }
  }

  private async validateWorkspace(): Promise<void> {
    if (!this.workflow) return;

    console.log('\n🔍 Validating workspace...\n');

    const workspaceRoot = this.options.workspaceRoot!;
    const promptsDir = path.join(workspaceRoot, 'prompts');
    const historyDir = path.join(workspaceRoot, '.cortex-history');

    let issues = 0;

    // Check prompts directory
    if (!fs.existsSync(promptsDir)) {
      console.log('❌ Prompts directory not found');
      issues++;
    } else {
      console.log('✅ Prompts directory found');
    }

    // Check history directory
    if (!fs.existsSync(historyDir)) {
      console.log('⚠️  History directory not found (will be created)');
    } else {
      console.log('✅ History directory found');
    }

    // Check version history file
    const versionsFile = path.join(historyDir, 'versions.json');
    if (fs.existsSync(versionsFile)) {
      try {
        const versions = await this.workflow.getVersionHistory();
        console.log(`✅ Version history valid (${versions.length} entries)`);
      } catch (error) {
        console.log('❌ Version history corrupted');
        issues++;
      }
    } else {
      console.log('📝 No version history (clean workspace)');
    }

    console.log(`\n📊 Validation complete: ${issues > 0 ? `${issues} issues found` : 'All checks passed'}`);
  }

  private getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: '🟡',
      approved: '🟢',
      applied: '✅',
      rejected: '🔴',
      rolled_back: '⏪'
    };
    return icons[status] || '❓';
  }

  private getActionIcon(action: string): string {
    const icons: Record<string, string> = {
      proposed: '📝',
      approved: '✅',
      rejected: '❌',
      applied: '🚀',
      rolled_back: '⏪'
    };
    return icons[action] || '📄';
  }

  private showHelp(): void {
    console.log(`
CortexWeaver 3.0 Prompt Improvement CLI

USAGE:
  cortex-prompts <command> [options]

COMMANDS:
  history      Show version history
  status       Show workflow status
  apply        Apply approved improvements
  rollback     Rollback to a specific version
  audit        Show audit trail
  changes      Show recent changes
  validate     Validate workspace
  help         Show this help message

OPTIONS:
  --workspace-root <path>    Workspace root directory (default: current)
  --prompt-file <file>       Target specific prompt file
  --version-id <id>          Target specific version ID
  --format <json|table>      Output format (default: table)
  --hours-back <hours>       Hours back for recent changes (default: 24)
  --verbose                  Show detailed information

EXAMPLES:
  cortex-prompts status
  cortex-prompts history --prompt-file agents/architect.md
  cortex-prompts apply --verbose
  cortex-prompts rollback --prompt-file agents/coder.md --version-id abc123
  cortex-prompts changes --hours-back 48 --format json
  cortex-prompts audit --prompt-file agents/governor.md

For more information, see the documentation at:
https://github.com/cortexweaver/cortexweaver/docs/prompt-improvement-workflow.md
`);
  }
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--workspace-root':
        options.workspaceRoot = args[++i];
        break;
      case '--prompt-file':
        options.promptFile = args[++i];
        break;
      case '--version-id':
        options.versionId = args[++i];
        break;
      case '--format':
        options.format = args[++i] as 'json' | 'table';
        break;
      case '--hours-back':
        options.hoursBack = parseInt(args[++i], 10);
        break;
      case '--verbose':
        options.verbose = true;
        break;
      default:
        if (!arg.startsWith('--')) {
          options.command = arg;
        }
        break;
    }
  }

  try {
    const cli = new PromptImprovementCLI(options);
    await cli.run();
  } catch (error) {
    console.error(`❌ Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { PromptImprovementCLI };