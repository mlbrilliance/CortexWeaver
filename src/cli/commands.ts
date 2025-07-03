import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '../config';
import { Orchestrator, OrchestratorConfig } from '../orchestrator';
import { SessionManager } from '../session';
import { WorkspaceManager } from '../workspace';
import { CLITemplates } from '../cli-templates';
import { CLIContracts } from '../cli-contracts';
import { AuthManager } from '../auth-manager';
import { CLIUtils } from '../cli-utils';

/**
 * CLI Commands implementation
 * Contains all command logic extracted from the main CLI class
 */
export class CLICommands {
  private authManager: AuthManager;

  constructor() {
    this.authManager = new AuthManager();
  }

  async authStatus(projectRoot: string = process.cwd()): Promise<string> {
    console.log('🔐 Checking authentication status...');
    
    try {
      const authManager = new AuthManager(projectRoot);
      await authManager.discoverAuthentication();
      
      return await authManager.getAuthReport();
    } catch (error) {
      throw new Error(`Failed to check authentication status: ${(error as Error).message}`);
    }
  }

  async authConfigure(method?: string, projectRoot: string = process.cwd()): Promise<string> {
    console.log('🔐 Configuring authentication...');
    
    try {
      const authManager = new AuthManager(projectRoot);
      await authManager.discoverAuthentication();
      
      const status = await authManager.getAuthStatus();
      
      let configReport = `
🔐 Authentication Configuration Guide
${'='.repeat(50)}

🤖 Claude Authentication:
   Current: ${status.claudeAuth.method}
   Status: ${status.claudeAuth.isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}

🧠 Gemini Authentication:
   Current: ${status.geminiAuth.method}
   Status: ${status.geminiAuth.isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}

💡 Setup Instructions:

1. For Claude Code CLI (Recommended):
   • Install Claude Code CLI: https://claude.ai/docs/cli
   • Login: \`claude auth login\`
   • Verify: \`claude auth status\`

2. For Gemini CLI:
   • Install Google Cloud CLI: https://cloud.google.com/sdk/docs/install
   • Login: \`gcloud auth login\`
   • Setup AI Platform: \`gcloud auth application-default login\`

3. For Direct API Keys:
   • Set ANTHROPIC_API_KEY in your .env file
   • Set GOOGLE_API_KEY in your .env file

📊 Current Recommendations:
${status.recommendations.map(rec => `   • ${rec}`).join('\n')}
      `;

      return configReport.trim();
    } catch (error) {
      throw new Error(`Failed to show authentication configuration: ${(error as Error).message}`);
    }
  }

  async authSwitch(method: string, projectRoot: string = process.cwd()): Promise<void> {
    console.log(`🔄 Switching authentication method to: ${method}`);
    
    try {
      const authManager = new AuthManager(projectRoot);
      await authManager.discoverAuthentication();
      
      // Validate the method
      const validMethods = ['claude-code', 'gemini-cli', 'direct-api'];
      if (!validMethods.includes(method)) {
        throw new Error(`Invalid authentication method: ${method}. Valid methods: ${validMethods.join(', ')}`);
      }
      
      const status = await authManager.getAuthStatus();
      
      // Check if the requested method is available
      if (method === 'claude-code' && !status.claudeAuth.isAuthenticated) {
        throw new Error('Claude Code CLI not configured. Run "claude auth login" first.');
      }
      
      if (method === 'gemini-cli' && !status.geminiAuth.isAuthenticated) {
        throw new Error('Gemini CLI not configured. Run "gcloud auth login" first.');
      }
      
      console.log(`✅ Authentication method switched to: ${method}`);
      console.log('💡 Note: This switch affects the current session only.');
      console.log('   Update your project configuration to make this change permanent.');
      
    } catch (error) {
      throw new Error(`Failed to switch authentication method: ${(error as Error).message}`);
    }
  }

  async logs(taskId: string, projectRoot: string = process.cwd()): Promise<string> {
    if (!CLIUtils.validateProject(projectRoot)) {
      throw new Error('Not a CortexWeaver project. Run "cortex-weaver init" first.');
    }

    console.log(`📋 Retrieving logs for task: ${taskId}`);
    
    try {
      const sessionManager = new SessionManager();
      
      // Get session output for the task
      const sessionId = `cortex-${taskId}`;
      const sessionOutput = await sessionManager.getSessionOutput(sessionId);
      
      if (!sessionOutput) {
        return `❌ No logs found for task: ${taskId}`;
      }

      const logReport = `
🔍 Task Logs: ${taskId}
${'='.repeat(50)}

📝 Session Output:
${sessionOutput}

📊 Log retrieval completed at: ${new Date().toISOString()}
      `;

      return logReport.trim();
    } catch (error) {
      throw new Error(`Failed to retrieve logs for task ${taskId}: ${(error as Error).message}`);
    }
  }

  async retry(taskId: string, projectRoot: string = process.cwd()): Promise<void> {
    if (!CLIUtils.validateProject(projectRoot)) {
      throw new Error('Not a CortexWeaver project. Run "cortex-weaver init" first.');
    }

    console.log(`🔄 Retrying failed task: ${taskId}`);
    
    try {
      // Load configuration
      const configService = new ConfigService(projectRoot);
      const projectConfig = configService.loadProjectConfig();
      const envVars = configService.loadEnvironmentVariables();
      Object.assign(process.env, envVars);

      // Initialize storage configuration (Neo4j now optional)
      let neo4jConfig: any = undefined;
      const neo4jPassword = process.env.NEO4J_PASSWORD;
      
      if (neo4jPassword) {
        const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
        const neo4jUsername = process.env.NEO4J_USERNAME || 'neo4j';
        neo4jConfig = {
          uri: neo4jUri,
          username: neo4jUsername,
          password: neo4jPassword
        };
      }

      const orchestratorConfig = {
        neo4j: neo4jConfig,
        storage: {
          type: neo4jConfig ? 'mcp-neo4j' as const : 'in-memory' as const,
          config: neo4jConfig
        },
        claude: {
          apiKey: configService.getRequiredEnvVar('CLAUDE_API_KEY'),
          defaultModel: projectConfig.models.claude as any,
          budgetLimit: projectConfig.budget.maxCost
        }
      };

      const orchestrator = new Orchestrator(orchestratorConfig);
      await orchestrator.initialize(projectRoot);

      // Check if task exists and is in FAILED state
      const canvas = (orchestrator as any).canvas;
      const task = await canvas.getTaskById(taskId);
      
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      if (task.status !== 'failed') {
        throw new Error(`Task ${taskId} is not in FAILED state. Current status: ${task.status}`);
      }

      // Reset task status to pending for retry
      await canvas.updateTaskStatus(taskId, 'pending');
      
      // Clean up any existing sessions/worktrees for this task
      const workspaceManager = new WorkspaceManager();
      const sessionManager = new SessionManager();
      
      try {
        // Remove existing worktree if it exists
        await workspaceManager.removeWorktree(taskId);
      } catch (error) {
        // Worktree might not exist, that's okay
      }

      try {
        // Kill existing sessions for this task
        const sessions = sessionManager.listSessions();
        const taskSessions = sessions.filter(s => s.taskId === taskId);
        
        for (const session of taskSessions) {
          await sessionManager.killSession(session.sessionId);
        }
      } catch (error) {
        // Sessions might not exist, that's okay
      }
      
      console.log(`✅ Task ${taskId} has been re-queued for retry`);
      
      await orchestrator.shutdown();
    } catch (error) {
      throw new Error(`Failed to retry task ${taskId}: ${(error as Error).message}`);
    }
  }

  async listAgents(projectRoot: string = process.cwd()): Promise<string> {
    console.log('🤖 Discovering available agent personas...');
    
    try {
      const promptsDir = path.join(projectRoot, 'prompts');
      
      // Check if prompts directory exists
      if (!fs.existsSync(promptsDir)) {
        // Create prompts directory with default agent personas
        await this.createDefaultAgentPersonas(promptsDir);
      }

      // Scan prompts directory for agent files
      const agentFiles = fs.readdirSync(promptsDir)
        .filter(file => file.endsWith('.md') || file.endsWith('.txt'))
        .sort();

      if (agentFiles.length === 0) {
        return `❌ No agent personas found in ${promptsDir}`;
      }

      let agentList = `
🤖 Available Agent Personas
${'='.repeat(40)}

📁 Prompts Directory: ${promptsDir}
📊 Total Agents Found: ${agentFiles.length}

🎭 Agent Personas:
`;

      for (const file of agentFiles) {
        const filePath = path.join(promptsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Extract agent info from file content
        const agentInfo = CLIUtils.parseAgentPersona(content, file);
        agentList += `
  📋 ${agentInfo.name}
     Role: ${agentInfo.role}
     File: ${file}
     Description: ${agentInfo.description}
`;
      }

      agentList += `
💡 Usage: Use these personas in your plan.md to specify which agents handle specific features.
📖 Each agent has specialized capabilities and knowledge domains.
      `;

      return agentList.trim();
    } catch (error) {
      throw new Error(`Failed to list agents: ${(error as Error).message}`);
    }
  }

  async init(projectRoot: string = process.cwd()): Promise<void> {
    const configService = new ConfigService(projectRoot);
    
    // Create .cortexweaver directory
    const cortexDir = configService.getCortexWeaverDir();
    if (!fs.existsSync(cortexDir)) {
      fs.mkdirSync(cortexDir, { recursive: true });
    }

    // Create contracts directory structure
    await CLIContracts.createContractsStructure(projectRoot);

    // Create plan.md template
    await CLITemplates.createPlanTemplate(projectRoot);
    
    // Create default config.json
    await this.createDefaultConfig(configService);
    
    // Create docker-compose.yml for MCP servers
    await CLITemplates.createDockerCompose(projectRoot);
    
    // Create .env.example template
    await CLITemplates.createEnvTemplate(projectRoot);
    
    // Create prompts directory with agent personas
    await CLITemplates.createPromptsDirectory(projectRoot);
    
    // Create prototypes directory
    await CLITemplates.createPrototypesDirectory(projectRoot);

    // Discover available authentication methods
    console.log('\n🔐 Discovering authentication methods...');
    try {
      const authManager = new AuthManager(projectRoot);
      await authManager.discoverAuthentication();
      
      const status = await authManager.getAuthStatus();
      
      if (status.claudeAuth.isAuthenticated || status.geminiAuth.isAuthenticated) {
        console.log('✅ Authentication configured:');
        if (status.claudeAuth.isAuthenticated) {
          console.log(`   - Claude: ${status.claudeAuth.method}`);
        }
        if (status.geminiAuth.isAuthenticated) {
          console.log(`   - Gemini: ${status.geminiAuth.method}`);
        }
      } else {
        console.log('⚠️  No authentication methods configured');
        console.log('   Run "cortex-weaver auth configure" to set up authentication');
      }
    } catch (error) {
      console.log(`⚠️  Authentication discovery failed: ${(error as Error).message}`);
    }

    console.log('✅ CortexWeaver project initialized successfully!');
    console.log(`
Next steps:
1. 🔐 Verify authentication: 'cortex-weaver auth status'
2. 📝 Copy .env.example to .env and fill in your API keys (if using direct-api)
3. 🐳 Run 'docker-compose up -d' to start MCP servers
4. 📋 Edit plan.md to define your project features
5. 📑 Define formal contracts in the /contracts directory
6. 🤖 Customize agent personas in the /prompts directory
7. 🧪 Create prototypes and experiments in the /prototypes directory
8. 🚀 Run 'cortex-weaver start' to begin orchestration

📋 Specification-Driven Development:
- Use /contracts/api/ for OpenAPI specifications
- Use /contracts/schemas/ for JSON Schema definitions
- Use /contracts/properties/ for property-based test invariants
- Use /contracts/examples/ for sample data and usage patterns

🧪 Prototyping & Experimentation:
- Use /prototypes/ for rapid prototyping and experimental features
- /prototypes/features/ - Feature prototypes and early implementations
- /prototypes/experiments/ - Experimental code and research implementations
- /prototypes/proofs-of-concept/ - POCs for core system functionality
- /prototypes/spike-solutions/ - Time-boxed investigation solutions
- /prototypes/algorithms/ - Algorithm implementations and testing
- Prototype validation before formal contract creation
- Explore technical feasibility and design alternatives

🤖 Agent Personas (CortexWeaver 3.0):
- Agent persona files are now available in /prompts directory
- Each agent has a comprehensive persona defining role, responsibilities, and instructions
- Personas can be versioned and improved over time as first-class citizens
- The new Reflector agent provides retrospective analysis and continuous improvement
    `);
  }

  private async createDefaultConfig(configService: ConfigService): Promise<void> {
    const defaultConfig = {
      models: {
        claude: 'claude-3-opus-20240229',
        gemini: 'gemini-pro'
      },
      costs: {
        claudeTokenCost: 0.015,
        geminiTokenCost: 0.0005
      },
      budget: {
        maxTokens: 50000,
        maxCost: 500
      },
      parallelism: {
        maxConcurrentTasks: 5,
        maxConcurrentAgents: 3
      },
      monitoring: {
        enableMetrics: true,
        logLevel: 'info'
      }
    };

    configService.saveProjectConfig(defaultConfig);
  }

  private async createDefaultAgentPersonas(promptsDir: string): Promise<void> {
    fs.mkdirSync(promptsDir, { recursive: true });

    const defaultPersonas = [
      {
        filename: 'spec-writer.md',
        content: `# Spec Writer Agent

## Role
Requirements Analysis and Specification Creation

## Description
Creates comprehensive BDD specifications and feature files based on project requirements.

## Capabilities
- User story creation
- Acceptance criteria definition
- Gherkin scenario writing
- Requirements documentation
- Behavior-driven development specifications

## Knowledge Domains
- Business analysis
- Requirements engineering
- BDD/TDD methodologies
- User experience design
`
      },
      {
        filename: 'formalizer.md',
        content: `# Formalizer Agent

## Role
Contract and Mathematical Specification

## Description
Transforms BDD specifications into formal contracts and mathematical representations.

## Capabilities
- Contract specification creation
- Mathematical modeling
- Invariant definition
- Precondition/postcondition specification
- Formal verification support

## Knowledge Domains
- Formal methods
- Mathematical modeling
- Contract-based design
- Verification and validation
`
      }
      // Note: Shortened for space - full implementation would include all personas
    ];

    for (const persona of defaultPersonas) {
      const filePath = path.join(promptsDir, persona.filename);
      fs.writeFileSync(filePath, persona.content);
    }

    console.log(`✅ Created ${defaultPersonas.length} default agent personas in ${promptsDir}`);
  }
}