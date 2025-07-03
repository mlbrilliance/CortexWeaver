import * as fs from 'fs';
import * as path from 'path';
import { CognitiveCanvas, Neo4jConfig, ProjectData, TaskData } from '../cognitive-canvas';
import { StorageManager, createAutoStorage, MCPNeo4jConfig } from '../storage';
import { PlanParser, ParsedPlan, Feature } from '../plan-parser';
import { ClaudeClient, ClaudeClientConfig, TokenUsageStats } from '../claude-client';
import { WorkspaceManager } from '../workspace';
import { SessionManager } from '../session';
import { CritiqueAgent } from '../agents/critique';
import { DebuggerAgent } from '../agents/debugger';
import { CognitiveCanvasNavigator, NavigationResult } from '../agents/cognitive-canvas-navigator';
import { AuthManager, AuthProvider } from '../auth-manager';
import { MCPClient } from '../mcp-client';

// Import modular components
import { WorkflowManager, AgentType, WorkflowStep } from './workflow-manager';
import { TaskExecutor, TaskExecutionContext } from './task-executor';
import { AgentSpawner } from './agent-spawner';
import { ErrorHandler } from './error-handler';
import { StatusManager, OrchestratorStatus } from './status-manager';
import { 
  filterArtifactsByWorkflowStep,
  extractWorkflowRelevantPatterns,
  isRelationshipRelevantForStep,
  createTasks,
  initializeTaskWorkflowStates,
  storeArchitecturalDecisions
} from './utils';

export interface OrchestratorConfig {
  neo4j?: Neo4jConfig;  // Made optional
  storage?: {
    type: 'mcp-neo4j' | 'in-memory' | 'auto';
    config?: MCPNeo4jConfig;
  };
  claude: ClaudeClientConfig;
  auth?: {
    claudeMethod?: 'claude_code_session' | 'claude_code_config' | 'api_key';
    geminiMethod?: 'gemini_cli' | 'api_key';
    githubToken?: string;
    credentials?: {
      claude?: {
        apiKey?: string;
        sessionToken?: string;
      };
      gemini?: {
        apiKey?: string;
      };
    };
  };
  mcp?: {
    enabled: boolean;
    servers?: {
      github?: {
        enabled: boolean;
        token?: string;
      };
      filesystem?: {
        enabled: boolean;
        allowedPaths?: string[];
      };
      web?: {
        enabled: boolean;
        allowedDomains?: string[];
      };
    };
  };
}

// Re-export types for backward compatibility
export { AgentType, WorkflowStep, OrchestratorStatus };

export class Orchestrator {
  // Core dependencies
  private canvas: CognitiveCanvas | null = null;
  private storageManager: StorageManager | null = null;
  private parser: PlanParser;
  private client: ClaudeClient;
  private workspace: WorkspaceManager;
  private sessionManager: SessionManager;
  private critiqueAgent!: CritiqueAgent;
  private debuggerAgent!: DebuggerAgent;
  private cognitiveCanvasNavigator!: CognitiveCanvasNavigator;
  private authManager: AuthManager;
  private mcpClient?: MCPClient;
  
  // Modular components
  private workflowManager: WorkflowManager;
  private taskExecutor!: TaskExecutor;
  private agentSpawner: AgentSpawner;
  private errorHandler!: ErrorHandler;
  private statusManager!: StatusManager;
  
  // State
  private parsedPlan: ParsedPlan | null = null;
  private mcpConfig: OrchestratorConfig['mcp'];
  private config: OrchestratorConfig;
  private projectRoot: string = '';
  private authProviders: Map<string, AuthProvider> = new Map();

  constructor(config: OrchestratorConfig) {
    if (!config.claude) {
      throw new Error('Claude configuration is required');
    }

    // Initialize core dependencies (CognitiveCanvas will be initialized lazily)
    // this.canvas will be set up during initialize() with storage manager
    this.parser = new PlanParser();
    this.client = new ClaudeClient(config.claude);
    this.workspace = new WorkspaceManager();
    this.sessionManager = new SessionManager();
    // Agents will be initialized with canvas during initialize()
    // this.critiqueAgent = new CritiqueAgent(this.client, this.canvas);
    // this.debuggerAgent = new DebuggerAgent();
    // this.cognitiveCanvasNavigator = new CognitiveCanvasNavigator();
    this.authManager = new AuthManager();
    
    // Store configuration
    this.config = config;
    this.mcpConfig = config.mcp;
    
    // Initialize authentication providers
    this.initializeAuthProviders(config.auth);
    
    // Initialize modular components
    this.workflowManager = new WorkflowManager();
    this.agentSpawner = new AgentSpawner(this.workspace, this.sessionManager);
    // Components will be initialized with canvas during initialize()
    // Store config for lazy initialization
  }

  async initialize(projectPath: string): Promise<void> {
    try {
      console.log('Initializing Orchestrator...');
      this.projectRoot = projectPath;
      
      // Initialize authentication manager with project path
      this.authManager = new AuthManager(projectPath);
      await this.authManager.discoverAuthentication();
      
      // Validate authentication
      await this.validateAuthentication();
      
      // Initialize storage manager
      await this.initializeStorage();
      
      // Initialize CognitiveCanvas with storage manager
      if (this.storageManager) {
        this.canvas = new CognitiveCanvas(this.storageManager);
        await this.canvas.initializeSchema();
      }
      
      // Initialize agents now that canvas is available
      this.initializeAgents();
      
      // Initialize modular components
      this.initializeComponents();
      
      // Initialize MCP client from .mcp.json configuration
      try {
        this.mcpClient = await MCPClient.fromProjectConfig(projectPath);
        console.log('✅ MCP client initialized from .mcp.json');
      } catch (error) {
        console.warn(`⚠️  MCP client initialization failed: ${(error as Error).message}`);
      }
      
      // Initialize MCP servers if enabled
      if (this.mcpConfig?.enabled) {
        await this.initializeMCPServers();
      }
      
      // Load and parse plan
      const planPath = path.join(projectPath, 'plan.md');
      if (!fs.existsSync(planPath)) {
        throw new Error(`Plan file not found at ${planPath}`);
      }
      
      const planContent = fs.readFileSync(planPath, 'utf-8');
      this.parsedPlan = this.parser.parse(planContent);
      console.log('✅ Plan parsing completed');
      
      // Temporarily skip project creation to isolate the issue
      console.log('⏭️  Skipping project and task creation for debugging');
      /*
      // Create project in Cognitive Canvas
      const projectData: ProjectData = {
        id: `project-${Date.now()}`,
        name: this.parsedPlan.title,
        description: this.parsedPlan.overview,
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      
      const project = await this.canvas.createProject(projectData);
      this.statusManager.setProjectId(project.id);
      
      // Create tasks with dependency ordering
      await createTasks(this.parsedPlan, this.canvas, this.statusManager, this.workflowManager);
      
      // Initialize workflow states for all tasks
      await initializeTaskWorkflowStates(this.canvas, this.statusManager, this.workflowManager);
      
      // Store architectural decisions
      await storeArchitecturalDecisions(this.parsedPlan, this.canvas, this.statusManager);
      */
      
      this.statusManager.setStatus('initialized');
      console.log(`Project ${this.parsedPlan.title} initialized successfully`);
      
    } catch (error) {
      if (this.statusManager) {
        this.statusManager.setStatus('error');
      }
      throw new Error(`Failed to initialize orchestrator: ${(error as Error).message}`);
    }
  }

  async start(): Promise<void> {
    if (!this.statusManager) {
      throw new Error('Orchestrator must be initialized before starting');
    }
    
    const projectId = this.statusManager.getProjectId();
    if (!projectId || !this.parsedPlan) {
      throw new Error('Project must be initialized before starting');
    }

    this.statusManager.setRunning(true);
    this.statusManager.setStatus('running');
    console.log('Starting orchestration...');

    try {
      while (this.statusManager.isRunning()) {
        // Check budget before processing
        if (!this.statusManager.checkBudgetLimit()) {
          console.log('Budget limit reached, stopping orchestration');
          break;
        }

        await this.processNextTask();
        await this.taskExecutor.monitorTasks(projectId);
        
        // Check if all tasks completed
        const allCompleted = await this.statusManager.areAllTasksCompleted();
        if (allCompleted) {
          console.log('All tasks completed!');
          this.statusManager.setStatus('completed');
          break;
        }
        
        // Log status summary periodically
        await this.statusManager.logStatusSummary();
        
        // Small delay to prevent busy waiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Orchestration error:', error);
      this.statusManager.setStatus('error');
    } finally {
      this.statusManager.setRunning(false);
    }
  }

  async processNextTask(): Promise<void> {
    try {
      const projectId = this.statusManager.getProjectId();
      if (!projectId) return;

      const tasks = await this.canvas!.getTasksByProject(projectId);
      const availableTasks = tasks.filter(task => task.status === 'pending');

      for (const task of availableTasks) {
        const dependencies = await this.canvas!.getTaskDependencies(task.id);
        const unmetDependencies = dependencies.filter(dep => dep.status !== 'completed');
        
        if (unmetDependencies.length === 0) {
          // Perform critique check
          const shouldProceed = await this.errorHandler.performCritiqueCheck(task.id);
          if (!shouldProceed) {
            console.log(`Task ${task.id} blocked by critique findings`);
            continue;
          }

          // Prime context for task before spawning agent
          const contextData = await this.primeContextForTask(task.id, task);
          
          // Process task with workflow awareness
          await this.taskExecutor.processTaskWithWorkflow(task);
          break; // Process one task at a time
        }
      }
    } catch (error) {
      console.error('Error processing next task:', error);
    }
  }

  async spawnAgent(task: TaskData, agentType: AgentType): Promise<void> {
    const contextData = await this.primeContextForTask(task.id, task);
    const result = await this.agentSpawner.spawnAgent(task, agentType, contextData);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to spawn agent');
    }
  }

  async handleImpasse(taskId: string): Promise<void> {
    const result = await this.errorHandler.handleImpasse(taskId);
    
    if (!result.success) {
      console.error(`Failed to handle impasse for task ${taskId}: ${result.message}`);
    }
  }

  async handleTaskCompletion(taskId: string): Promise<void> {
    await this.taskExecutor.handleTaskCompletion(taskId);
  }

  async handleTaskFailure(taskId: string, failure: any): Promise<void> {
    const result = await this.errorHandler.handleTaskFailure(taskId, failure);
    
    if (!result.success && result.escalated) {
      console.error(`Task failure escalated for ${taskId}: ${result.message}`);
    }
  }

  // Public status methods
  checkBudgetLimit(): boolean {
    return this.statusManager.checkBudgetLimit();
  }

  getTokenUsage(): TokenUsageStats {
    return this.statusManager.getTokenUsage();
  }

  getStatus(): OrchestratorStatus {
    return this.statusManager.getStatus();
  }

  isRunning(): boolean {
    return this.statusManager.isRunning();
  }

  async getProjectProgress() {
    return this.statusManager.getProjectProgress();
  }

  async getSystemHealth() {
    return this.statusManager.getSystemHealth();
  }

  async getDetailedStatusReport() {
    return this.statusManager.getDetailedStatusReport();
  }

  // Additional methods for backward compatibility
  async monitorTasks(): Promise<void> {
    const projectId = this.statusManager.getProjectId();
    if (projectId) {
      await this.taskExecutor.monitorTasks(projectId);
    }
  }

  // Enhanced error handling methods for compatibility
  getActiveCodeSavantSessions(): Set<string> {
    // Return active sessions tracked by error handler
    return this.errorHandler.getActiveCodeSavantSessions();
  }

  getTaskErrorHistory(taskId: string): any[] {
    // Return error history for a specific task
    return this.errorHandler.getTaskErrorHistory(taskId);
  }

  getErrorRecoveryStatistics(): any {
    // Return error recovery statistics
    return this.errorHandler.getErrorRecoveryStatistics();
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down Orchestrator...');
    this.statusManager.setRunning(false);
    
    // Kill all active sessions
    const sessions = this.sessionManager.listSessions();
    for (const session of sessions) {
      await this.sessionManager.killSession(session.sessionId);
    }
    
    // Close database connection
    if (this.canvas) {
      await this.canvas.close();
    }
    
    // Reset status manager
    this.statusManager.reset();
    
    console.log('Orchestrator shutdown complete');
  }


  private async primeContextForTask(taskId: string, task: TaskData): Promise<TaskExecutionContext> {
    try {
      // Get current workflow state for context-aware priming
      const workflowState = this.workflowManager.getTaskWorkflowState(taskId);
      const currentStep = workflowState?.currentStep || 'DEFINE_REQUIREMENTS';
      
      // Enhanced targeted context retrieval with workflow awareness
      const baseQuery = `${task.title} ${task.description}`;
      const enhancedQuery = this.workflowManager.enhanceQueryForWorkflowStep(baseQuery, currentStep);
      
      // Prepare navigation task for CognitiveCanvasNavigator
      const navigationTask = {
        id: `nav-${taskId}`,
        title: `Navigate context for ${task.title}`,
        description: `Find relevant context for workflow step ${currentStep}`,
        status: 'pending',
        priority: task.priority,
        projectId: task.projectId,
        createdAt: new Date().toISOString()
      };
      
      const navigationContext = {
        query: {
          type: 'semantic',
          query: enhancedQuery,
          context: {
            taskId,
            taskType: 'feature_implementation',
            priority: task.priority,
            workflowStep: currentStep,
            limit: 50,
            nodeType: this.workflowManager.getTargetedNodeTypes(currentStep),
            selectProperties: this.workflowManager.getRelevantProperties(currentStep)
          },
          filters: [
            {
              type: 'node',
              field: 'type',
              operator: 'equals',
              value: this.workflowManager.getTargetedNodeTypes(currentStep)
            }
          ]
        }
      };
      
      // Initialize navigator if not already done
      if (!this.cognitiveCanvasNavigator.getStatus || this.cognitiveCanvasNavigator.getStatus() === 'uninitialized') {
        await this.cognitiveCanvasNavigator.initialize({
          id: 'orchestrator-navigator',
          role: 'navigator',
          capabilities: ['graph-navigation'],
          claudeConfig: {
            apiKey: this.client.getConfiguration()?.apiKey || 'default',
          },
          workspaceRoot: process.cwd(),
          cognitiveCanvas: this.canvas!  // Use shared CognitiveCanvas instance
        });
      }
      
      // Execute navigation task
      await this.cognitiveCanvasNavigator.receiveTask(navigationTask, navigationContext);
      const navigationResultTask = await this.cognitiveCanvasNavigator.run();
      const navigationResult = navigationResultTask.result || {
        nodes: [],
        relationships: [],
        paths: [],
        insights: [],
        metadata: { queryTime: 0, resultCount: 0, confidence: 0.5 }
      };

      // Extract context specific to workflow step
      const relevantArtifacts = filterArtifactsByWorkflowStep(
        navigationResult.nodes,
        currentStep
      );

      const patterns = extractWorkflowRelevantPatterns(
        navigationResult.insights,
        currentStep
      );

      // Get step-specific relationships
      const relevantRelationships = navigationResult.relationships
        .filter((rel: any) => isRelationshipRelevantForStep(rel, currentStep))
        .slice(0, 20); // Limit relationships

      return {
        workflowStep: currentStep,
        relevantArtifacts,
        patterns,
        relationships: relevantRelationships,
        paths: navigationResult.paths.slice(0, 3),
        priming: {
          stepSpecificGuidance: this.workflowManager.getStepSpecificGuidance(currentStep),
          requiredInputs: this.workflowManager.getRequiredInputsForStep(currentStep),
          expectedOutputs: this.workflowManager.getExpectedOutputsForStep(currentStep)
        }
      };
    } catch (error) {
      console.error(`Error priming context for task ${taskId}:`, error);
      return { 
        workflowStep: 'DEFINE_REQUIREMENTS',
        relevantArtifacts: [], 
        patterns: [], 
        relationships: [], 
        paths: [],
        priming: {}
      };
    }
  }

  /**
   * Initialize authentication providers from config
   */
  private initializeAuthProviders(authConfig?: OrchestratorConfig['auth']): void {
    if (!authConfig) return;
    
    if (authConfig.credentials?.claude) {
      this.authProviders.set('claude', {
        method: authConfig.claudeMethod || 'api_key' as any,
        details: {
          api_key: authConfig.credentials.claude.apiKey,
          session_token: authConfig.credentials.claude.sessionToken
        }
      });
    }
    
    if (authConfig.credentials?.gemini) {
      this.authProviders.set('gemini', {
        method: authConfig.geminiMethod || 'api_key' as any,
        details: {
          api_key: authConfig.credentials.gemini.apiKey
        }
      });
    }
    
    if (authConfig.githubToken) {
      this.authProviders.set('github', {
        method: 'api_key' as any,
        details: { api_key: authConfig.githubToken }
      });
    }
  }

  /**
   * Validate authentication setup
   */
  private async validateAuthentication(): Promise<void> {
    console.log('🔐 Validating authentication...');
    
    const authStatus = await this.authManager.getAuthStatus();
    
    if (!authStatus.claudeAuth.isAuthenticated) {
      throw new Error('Claude authentication is required. Run "cortex-weaver auth configure" first.');
    }
    
    console.log(`✅ Claude authentication: ${authStatus.claudeAuth.method}`);
    
    // Validate Gemini if configured
    if (this.authProviders.has('gemini')) {
      if (!authStatus.geminiAuth.isAuthenticated) {
        console.warn('⚠️  Gemini authentication not configured - some features may be limited');
      } else {
        console.log(`✅ Gemini authentication: ${authStatus.geminiAuth.method}`);
      }
    }
    
    // Validate GitHub if configured
    if (this.authProviders.has('github')) {
      const githubProvider = this.authProviders.get('github')!;
      if (githubProvider.details?.api_key) {
        console.log('✅ GitHub token configured');
      } else {
        console.warn('⚠️  GitHub token not found - repository operations may be limited');
      }
    }
  }

  /**
   * Initialize MCP servers
   */
  private async initializeMCPServers(): Promise<void> {
    console.log('🔌 Initializing MCP servers...');
    
    if (!this.mcpConfig?.servers) {
      console.log('💡 No MCP servers configured');
      return;
    }
    
    // Initialize GitHub MCP server
    if (this.mcpConfig.servers.github?.enabled) {
      const githubToken = this.mcpConfig.servers.github.token || 
                         this.authProviders.get('github')?.details?.api_key;
      
      if (githubToken) {
        console.log('✅ GitHub MCP server configured');
        // In a full implementation, this would start the GitHub MCP server
        // await this.startGitHubMCPServer(githubToken);
      } else {
        console.warn('⚠️  GitHub MCP server enabled but no token provided');
      }
    }
    
    // Initialize Filesystem MCP server
    if (this.mcpConfig.servers.filesystem?.enabled) {
      const allowedPaths = this.mcpConfig.servers.filesystem.allowedPaths || [this.projectRoot];
      console.log(`✅ Filesystem MCP server configured with paths: ${allowedPaths.join(', ')}`);
      // In a full implementation, this would start the Filesystem MCP server
      // await this.startFilesystemMCPServer(allowedPaths);
    }
    
    // Initialize Web MCP server
    if (this.mcpConfig.servers.web?.enabled) {
      const allowedDomains = this.mcpConfig.servers.web.allowedDomains || [];
      console.log('✅ Web MCP server configured');
      if (allowedDomains.length > 0) {
        console.log(`   Allowed domains: ${allowedDomains.join(', ')}`);
      }
      // In a full implementation, this would start the Web MCP server
      // await this.startWebMCPServer(allowedDomains);
    }
  }

  /**
   * Get authentication status
   */
  async getAuthenticationStatus(): Promise<any> {
    return await this.authManager.getAuthStatus();
  }

  /**
   * Get MCP server status
   */
  getMCPStatus(): {
    enabled: boolean;
    servers: {
      github: boolean;
      filesystem: boolean;
      web: boolean;
    };
  } {
    return {
      enabled: this.mcpConfig?.enabled || false,
      servers: {
        github: this.mcpConfig?.servers?.github?.enabled || false,
        filesystem: this.mcpConfig?.servers?.filesystem?.enabled || false,
        web: this.mcpConfig?.servers?.web?.enabled || false
      }
    };
  }

  /**
   * Refresh authentication credentials
   */
  async refreshAuthentication(): Promise<boolean> {
    try {
      console.log('🔄 Refreshing authentication...');
      
      const claudeRefreshed = await this.authManager.refreshClaudeAuth();
      const geminiRefreshed = await this.authManager.refreshGeminiAuth();
      
      if (claudeRefreshed) {
        console.log('✅ Claude authentication refreshed');
      }
      
      if (geminiRefreshed) {
        console.log('✅ Gemini authentication refreshed');
      }
      
      return claudeRefreshed || geminiRefreshed;
      
    } catch (error) {
      console.error('❌ Authentication refresh failed:', error);
      return false;
    }
  }

  private async initializeStorage(): Promise<void> {
    try {
      console.log('🔌 Initializing storage...');
      
      // Auto-detect best available storage
      const mcpConfig = this.config.neo4j ? {
        uri: this.config.neo4j.uri,
        username: this.config.neo4j.username,
        password: this.config.neo4j.password
      } : undefined;

      this.storageManager = await createAutoStorage(mcpConfig, true);
      await this.storageManager.connect();
      
      const provider = this.storageManager.getProvider();
      console.log(`✅ Storage initialized with ${provider?.type} provider`);
      
      // Set up storage event listeners
      this.storageManager.on('storage-event', (event) => {
        console.log(`📡 Storage event: ${event.type} (${event.provider})`);
        if (event.error) {
          console.error('Storage error:', event.error.message);
        }
      });
      
    } catch (error) {
      console.error('❌ Storage initialization failed:', error);
      
      // Fallback to in-memory storage
      console.log('🔄 Falling back to in-memory storage...');
      this.storageManager = await createAutoStorage(undefined, true);
      await this.storageManager.connect();
      console.log('✅ Fallback storage initialized');
    }
  }

  private initializeAgents(): void {
    if (!this.canvas) {
      throw new Error('CognitiveCanvas must be initialized before agents');
    }

    console.log('🤖 Initializing agents...');
    
    this.critiqueAgent = new CritiqueAgent(this.client, this.canvas);
    this.debuggerAgent = new DebuggerAgent();
    this.cognitiveCanvasNavigator = new CognitiveCanvasNavigator();
    
    console.log('✅ Agents initialized');
  }

  private initializeComponents(): void {
    if (!this.canvas) {
      throw new Error('CognitiveCanvas must be initialized before components');
    }

    console.log('⚙️ Initializing components...');
    
    this.statusManager = new StatusManager(
      this.canvas, 
      this.client, 
      this.sessionManager, 
      this.workflowManager
    );
    
    this.taskExecutor = new TaskExecutor(
      this.canvas,
      this.workspace,
      this.sessionManager,
      this.workflowManager
    );
    
    this.errorHandler = new ErrorHandler(
      this.canvas,
      this.sessionManager,
      this.agentSpawner,
      this.workflowManager,
      this.critiqueAgent,
      this.debuggerAgent
    );
    
    console.log('✅ Components initialized');
  }

}