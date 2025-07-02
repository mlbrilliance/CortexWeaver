import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '../config';
import { Orchestrator, OrchestratorConfig } from '../orchestrator';
import { ClaudeClientConfig } from '../claude-client';
import { SessionManager } from '../session';
import { WorkspaceManager } from '../workspace';
import { AuthManager } from '../auth-manager';
import { CLIUtils } from '../cli-utils';

/**
 * CLI Validators and Status operations
 * Contains project validation, status checking, and monitoring functionality
 */
export class CLIValidators {

  async status(projectRoot: string = process.cwd()): Promise<string> {
    if (!CLIUtils.validateProject(projectRoot)) {
      return 'Error: Not a CortexWeaver project. Run "cortex-weaver init" first.';
    }

    console.log('📊 Gathering project status...');

    try {
      // Load configuration for real-time status
      const configService = new ConfigService(projectRoot);
      let taskStatus = null;
      let orchestratorStatus = 'Not Running';
      let activeTasks = 0;
      let completedTasks = 0;
      let failedTasks = 0;
      let impasseTasks = 0;
      let runningTasks = 0;

      try {
        // Try to get real-time task information
        const projectConfig = configService.loadProjectConfig();
        const envVars = configService.loadEnvironmentVariables();
        
        if (envVars.NEO4J_PASSWORD && envVars.CLAUDE_API_KEY) {
          Object.assign(process.env, envVars);
          
          const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
          const neo4jUsername = process.env.NEO4J_USERNAME || 'neo4j';
          const neo4jPassword = configService.getRequiredEnvVar('NEO4J_PASSWORD');

          const orchestratorConfig = {
            neo4j: {
              uri: neo4jUri,
              username: neo4jUsername,
              password: neo4jPassword
            },
            claude: {
              apiKey: configService.getRequiredEnvVar('CLAUDE_API_KEY'),
              defaultModel: projectConfig.models.claude as any,
              budgetLimit: projectConfig.budget.maxCost
            }
          };

          const orchestrator = new Orchestrator(orchestratorConfig);
          await orchestrator.initialize(projectRoot);
          
          orchestratorStatus = orchestrator.getStatus();
          
          // Get all tasks from all projects
          const canvas = (orchestrator as any).canvas;
          const projects = await canvas.getAllProjects();
          let allTasks: any[] = [];

          for (const project of projects) {
            const projectTasks = await canvas.getTasksByProject(project.id);
            allTasks = allTasks.concat(projectTasks);
          }
          
          // Count tasks by status
          activeTasks = allTasks.filter(t => t.status === 'pending').length;
          runningTasks = allTasks.filter(t => t.status === 'running').length;
          completedTasks = allTasks.filter(t => t.status === 'completed').length;
          failedTasks = allTasks.filter(t => t.status === 'failed').length;
          impasseTasks = allTasks.filter(t => t.status === 'impasse').length;
          
          taskStatus = allTasks;
          await orchestrator.shutdown();
        }
      } catch (error) {
        // If we can't connect to get real-time status, continue with basic status
        console.log('⚠️  Could not retrieve real-time task status');
      }

      // Check contracts directory structure
      const contractsPath = path.join(projectRoot, 'contracts');
      const contractsFiles = {
        readme: fs.existsSync(path.join(contractsPath, 'README.md')),
        openapi: fs.existsSync(path.join(contractsPath, 'api', 'openapi.yaml')),
        schemas: fs.readdirSync(path.join(contractsPath, 'schemas', 'models')).length > 0,
        properties: fs.readdirSync(path.join(contractsPath, 'properties', 'invariants')).length > 0,
        examples: fs.readdirSync(path.join(contractsPath, 'examples', 'requests')).length > 0
      };

      const contractsStatus = Object.entries(contractsFiles)
        .map(([key, exists]) => `${exists ? '✅' : '❌'} ${key}`)
        .join('\n');

      // Check session status
      const sessionManager = new SessionManager();
      const activeSessions = await sessionManager.listActiveTmuxSessions();

      let statusReport = `
🎯 CortexWeaver Project Status - Enhanced View
${'='.repeat(50)}

📁 Project Information:
   Root: ${projectRoot}
   Configuration: ${path.join(projectRoot, '.cortexweaver', 'config.json')}
   Plan File: ${path.join(projectRoot, 'plan.md')}
   Contracts Directory: ${contractsPath}

🤖 Orchestrator Status: ${orchestratorStatus}
📊 Active Sessions: ${activeSessions.length}

📋 Task Management Status:
   🔄 RUNNING: ${runningTasks}
   ✅ COMPLETED: ${completedTasks}
   ❌ FAILED: ${failedTasks}
   🚧 IMPASSE: ${impasseTasks}
   ⏳ PENDING: ${activeTasks}
   📊 TOTAL: ${runningTasks + completedTasks + failedTasks + impasseTasks + activeTasks}

📋 Specification-Driven Development Status:
${contractsStatus}
`;

      // Add detailed task information if available
      if (taskStatus && taskStatus.length > 0) {
        statusReport += `\n🔍 Recent Task Activity:\n`;
        
        // Show recent tasks (last 5)
        const recentTasks = taskStatus
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);

        for (const task of recentTasks) {
          const statusIcon = this.getTaskStatusIcon(task.status);
          statusReport += `   ${statusIcon} ${task.title} (${task.status})\n`;
        }
      }

      // Add session information if any active
      if (activeSessions.length > 0) {
        statusReport += `\n🔗 Active Sessions:\n`;
        activeSessions.forEach(session => {
          statusReport += `   📺 ${session}\n`;
        });
      }

      statusReport += `
💡 Next Steps:
1. ${taskStatus ? 'Monitor running tasks with: cortex-weaver logs <task-id>' : 'Define formal contracts in /contracts directory'}
2. ${taskStatus ? 'Check failed tasks and retry with: cortex-weaver retry <task-id>' : 'Use SDD workflow: Spec Writer → Formalizer → Architect → Coder → Testers'}
3. ${taskStatus ? 'View all agent personas with: cortex-weaver list-agents' : 'Run: cortex-weaver start'}

📊 Real-time monitoring active • Last updated: ${new Date().toISOString()}
      `;

      return statusReport.trim();
    } catch (error) {
      throw new Error(`Failed to get project status: ${(error as Error).message}`);
    }
  }

  async start(projectRoot: string = process.cwd()): Promise<void> {
    // 1. Validate CortexWeaver project
    if (!CLIUtils.validateProject(projectRoot)) {
      throw new Error('Not a CortexWeaver project. Run "cortex-weaver init" first.');
    }

    console.log('🔍 Validating project setup...');

    // 2. Initialize AuthManager and validate authentication
    console.log('🔐 Validating authentication...');
    const authManager = new AuthManager(projectRoot);
    await authManager.discoverAuthentication();
    
    const authStatus = await authManager.getAuthStatus();
    
    if (!authStatus.claudeAuth.isAuthenticated) {
      console.log('❌ Claude authentication not configured');
      console.log('Run "cortex-weaver auth configure" to set up authentication');
      throw new Error('Claude authentication required. Run "cortex-weaver auth configure" first.');
    }

    console.log(`✅ Using Claude ${authStatus.claudeAuth.method} authentication`);
    
    // Get authentication credentials
    const claudeCredentials = await authManager.getClaudeCredentials();
    
    // Load configuration and environment variables  
    const configService = new ConfigService(projectRoot);
    const projectConfig = configService.loadProjectConfig();
    
    // Load environment variables from .env file
    const envVars = configService.loadEnvironmentVariables();
    
    // Override process.env with loaded variables for validation
    Object.assign(process.env, envVars);

    // 3. Get authentication credentials (API key or session token)
    const claudeConfig: Partial<ClaudeClientConfig> = {};
    if (claudeCredentials?.apiKey) {
      claudeConfig.apiKey = claudeCredentials.apiKey;
    } else if (claudeCredentials?.sessionToken) {
      claudeConfig.sessionToken = claudeCredentials.sessionToken;
    } else {
      throw new Error('No valid Claude credentials found');
    }

    // 4. Validate required environment variables
    try {
      const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
      const neo4jUsername = process.env.NEO4J_USERNAME || 'neo4j';
      const neo4jPassword = configService.getRequiredEnvVar('NEO4J_PASSWORD');

      // 5. Create Orchestrator configuration
      const orchestratorConfig: OrchestratorConfig = {
        neo4j: {
          uri: neo4jUri,
          username: neo4jUsername,
          password: neo4jPassword
        },
        claude: {
          ...claudeConfig,
          defaultModel: projectConfig.models.claude as any,
          budgetLimit: projectConfig.budget.maxCost
        }
      };

      console.log('🚀 Initializing Orchestrator...');

      // 6. Initialize Orchestrator with project root
      const orchestrator = new Orchestrator(orchestratorConfig);
      
      // Set up signal handlers for graceful shutdown
      const shutdownHandler = async (signal: string) => {
        console.log(`\n⚠️  Received ${signal}. Shutting down gracefully...`);
        try {
          await orchestrator.shutdown();
          console.log('✅ Orchestrator shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', (error as Error).message);
          process.exit(1);
        }
      };

      process.on('SIGINT', () => shutdownHandler('SIGINT'));
      process.on('SIGTERM', () => shutdownHandler('SIGTERM'));

      try {
        // 7. Initialize Orchestrator with project path
        await orchestrator.initialize(projectRoot);
        console.log('✅ Orchestrator initialized successfully');

        // 8. Budget validation before starting
        const tokenUsage = orchestrator.getTokenUsage();
        if (tokenUsage.estimatedCost > projectConfig.budget.maxCost) {
          console.log(`⚠️  Current usage ($${tokenUsage.estimatedCost.toFixed(2)}) approaches budget limit ($${projectConfig.budget.maxCost})`);
          console.log('📊 Budget monitoring will continue during orchestration');
        }

        console.log('🎯 Starting orchestration loop...');
        console.log('📊 Real-time status monitoring enabled');
        console.log('💡 Use Ctrl+C to stop gracefully');

        // 9. Start orchestration loop with proper error handling
        await orchestrator.start();

        // 10. Provide final status
        const finalStatus = orchestrator.getStatus();
        const finalUsage = orchestrator.getTokenUsage();
        
        console.log(`\n🏁 Orchestration completed with status: ${finalStatus}`);
        console.log(`📊 Final token usage: ${finalUsage.totalTokens} tokens ($${finalUsage.estimatedCost.toFixed(2)})`);

      } catch (error) {
        console.error('❌ Orchestration error:', (error as Error).message);
        await orchestrator.shutdown();
        throw error;
      }

    } catch (error) {
      if ((error as Error).message.includes('Required environment variable')) {
        throw new Error(`Missing required configuration: ${(error as Error).message}`);
      }
      throw error;
    }
  }

  async attach(sessionId: string): Promise<string> {
    const sessionManager = new SessionManager();
    
    try {
      return await sessionManager.attachToSession(sessionId);
    } catch (error) {
      throw new Error('Session not found');
    }
  }

  async merge(projectRoot: string = process.cwd(), taskId: string): Promise<void> {
    // Validate CortexWeaver project
    if (!CLIUtils.validateProject(projectRoot)) {
      throw new Error('Not a CortexWeaver project. Run "cortex-weaver init" first.');
    }

    console.log(`🔀 Merging task ${taskId} to main branch...`);

    const workspaceManager = new WorkspaceManager(projectRoot);
    
    try {
      // Check if worktree exists
      const worktrees = await workspaceManager.listWorktrees();
      const targetWorktree = worktrees.find(w => w.id === taskId);
      
      if (!targetWorktree) {
        throw new Error(`Worktree for task ${taskId} not found`);
      }

      // Check if worktree is clean
      const status = await workspaceManager.getWorktreeStatus(taskId);
      if (!status.clean) {
        console.log('⚠️  Uncommitted changes found. Committing them first...');
        await workspaceManager.commitChanges(taskId, `Auto-commit before merge for task ${taskId}`);
      }

      // Merge to main branch
      await workspaceManager.mergeToBranch(taskId, 'main');
      
      // Remove the worktree after successful merge
      await workspaceManager.removeWorktree(taskId);
      
      console.log(`✅ Successfully merged task ${taskId} to main branch`);
    } catch (error) {
      console.error(`❌ Failed to merge task ${taskId}:`, (error as Error).message);
      throw error;
    }
  }

  async cleanup(projectRoot: string = process.cwd()): Promise<string> {
    if (!CLIUtils.validateProject(projectRoot)) {
      return 'Error: Not a CortexWeaver project. Run "cortex-weaver init" first.';
    }

    console.log('🧹 Starting cleanup process...');
    
    const sessionManager = new SessionManager();
    const workspaceManager = new WorkspaceManager(projectRoot);
    
    let cleanedSessions = 0;
    let cleanedWorktrees = 0;
    let errors: string[] = [];

    try {
      // Clean up dead tmux sessions
      console.log('🔍 Cleaning up dead sessions...');
      await sessionManager.cleanupDeadSessions();
      
      // Get all active sessions and check for orphaned ones
      const activeSessions = await sessionManager.listActiveTmuxSessions();
      const sessionList = sessionManager.listSessions();
      
      for (const session of sessionList) {
        if (!activeSessions.includes(session.sessionId)) {
          try {
            await sessionManager.killSession(session.sessionId);
            cleanedSessions++;
          } catch (error) {
            errors.push(`Failed to clean session ${session.sessionId}: ${(error as Error).message}`);
          }
        }
      }

      // Clean up orphaned worktrees
      console.log('🔍 Cleaning up orphaned worktrees...');
      const worktrees = await workspaceManager.listWorktrees();
      
      for (const worktree of worktrees) {
        // Check if worktree directory exists but has no active session
        const hasActiveSession = activeSessions.some(s => s.includes(worktree.id));
        
        if (!hasActiveSession) {
          try {
            // Check if worktree has uncommitted changes
            const status = await workspaceManager.getWorktreeStatus(worktree.id);
            
            if (!status.clean) {
              console.log(`⚠️  Worktree ${worktree.id} has uncommitted changes - skipping cleanup`);
              continue;
            }
            
            await workspaceManager.removeWorktree(worktree.id);
            cleanedWorktrees++;
          } catch (error) {
            errors.push(`Failed to clean worktree ${worktree.id}: ${(error as Error).message}`);
          }
        }
      }

    } catch (error) {
      errors.push(`General cleanup error: ${(error as Error).message}`);
    }

    // Report results
    const report = `
🧹 Cleanup completed!

📊 Summary:
- Sessions cleaned: ${cleanedSessions}
- Worktrees cleaned: ${cleanedWorktrees}
- Errors encountered: ${errors.length}

${errors.length > 0 ? `⚠️  Errors:\n${errors.map(e => `  - ${e}`).join('\n')}` : ''}
    `;

    if (errors.length > 0) {
      errors.forEach(error => console.warn(`⚠️  ${error}`));
    }

    console.log(report);
    return report.trim();
  }

  private getTaskStatusIcon(status: string): string {
    const iconMap: Record<string, string> = {
      'pending': '⏳',
      'running': '🔄',
      'completed': '✅',
      'failed': '❌',
      'impasse': '🚧',
      'error': '⚠️'
    };
    
    return iconMap[status] || '❓';
  }
}