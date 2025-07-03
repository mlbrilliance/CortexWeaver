import * as fs from 'fs';
import * as path from 'path';
import { ClaudeClient, ClaudeModel, SendMessageOptions, ClaudeResponse, Message } from './claude-client';
import { WorkspaceManager, CommandResult } from './workspace';
import { CognitiveCanvas, TaskData, PheromoneData } from './cognitive-canvas';
import { SessionManager, SessionInfo } from './session';
import { AgentConfig, TaskContext, TaskResult, AgentStatus } from './types/agent-types';
import { AgentErrorHandler } from './agent-error-handling';
import { AgentSessionManager } from './agent-session-management';

/**
 * Abstract base class for all CortexWeaver agents
 * Provides common functionality for specialized agent implementations
 */
export abstract class Agent {
  protected config: AgentConfig | null = null;
  protected claudeClient: ClaudeClient | null = null;
  protected workspace: WorkspaceManager | null = null;
  protected cognitiveCanvas: CognitiveCanvas | null = null;
  protected sessionManager: SessionManager | null = null;
  
  protected currentTask: TaskData | null = null;
  protected taskContext: TaskContext | null = null;
  protected status: AgentStatus = 'uninitialized';
  protected lastError: Error | null = null;
  protected currentSession: SessionInfo | null = null;
  protected conversationHistory: Message[] = [];

  // Helper components
  protected errorHandler: AgentErrorHandler | null = null;
  protected sessionMgr: AgentSessionManager | null = null;

  /**
   * Check if storage is available for persistence operations
   */
  protected isStorageAvailable(): boolean {
    return this.cognitiveCanvas !== null;
  }

  /**
   * Check if agent is in offline mode
   */
  protected isOfflineMode(): boolean {
    return !this.isStorageAvailable();
  }

  /**
   * Request storage connection if in offline mode
   */
  protected async requestStorageConnection(): Promise<boolean> {
    if (this.isStorageAvailable()) {
      return true;
    }
    
    console.log('📡 Agent requesting storage connection for persistence...');
    // This could trigger a workflow to help user configure MCP servers
    return false;
  }

  /**
   * Execute operation with storage fallback
   */
  protected async executeWithStorageFallback<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    if (this.isStorageAvailable()) {
      try {
        return await operation();
      } catch (error) {
        console.warn(`⚠️ Storage ${operationName} failed, using fallback:`, (error as Error).message);
        return await fallback();
      }
    } else {
      console.log(`📝 Executing ${operationName} in offline mode`);
      return await fallback();
    }
  }

  /**
   * Initialize the agent with configuration
   */
  async initialize(config: AgentConfig): Promise<void> {
    this.validateConfig(config);
    
    this.config = config;
    
    // Initialize Claude client
    this.claudeClient = new ClaudeClient({
      apiKey: config.claudeConfig.apiKey,
      defaultModel: config.claudeConfig.defaultModel || ClaudeModel.SONNET,
      maxTokens: config.claudeConfig.maxTokens || 4096,
      temperature: config.claudeConfig.temperature || 0.7
    });

    // Initialize workspace manager
    this.workspace = new WorkspaceManager(config.workspaceRoot);

    // Initialize cognitive canvas - use shared instance if provided
    if (config.cognitiveCanvas) {
      this.cognitiveCanvas = config.cognitiveCanvas;
    } else if (config.cognitiveCanvasConfig) {
      this.cognitiveCanvas = new CognitiveCanvas(config.cognitiveCanvasConfig);
    } else {
      // Allow agents to work without cognitive canvas for offline mode
      console.log('⚠️ Agent initialized without cognitive canvas - offline mode enabled');
      this.cognitiveCanvas = null;
    }

    // Initialize session manager
    this.sessionManager = new SessionManager();

    // Initialize helper components
    this.errorHandler = new AgentErrorHandler(
      this.config,
      this.cognitiveCanvas,
      this.currentTask,
      this.taskContext,
      this.status,
      this.conversationHistory,
      this.currentSession,
      this.lastError
    );

    this.sessionMgr = new AgentSessionManager(
      this.config,
      this.sessionManager,
      this.workspace,
      this.currentTask,
      this.currentSession,
      this.status,
      this.conversationHistory,
      this.lastError,
      this.taskContext
    );

    this.status = 'initialized';
  }

  /**
   * Receive a task assignment with context
   */
  async receiveTask(task: TaskData, context: TaskContext): Promise<void> {
    if (this.currentTask && this.status !== 'completed') {
      throw new Error('Agent already has an assigned task');
    }

    this.currentTask = task;
    this.taskContext = context;
    this.status = 'assigned';
    this.lastError = null;
    this.conversationHistory = [];

    // Update helper components
    this.updateHelperComponents();

    // Report task assignment
    await this.reportProgress('assigned', `Received task: ${task.title}`);
  }

  /**
   * Execute the assigned task
   */
  async run(): Promise<TaskResult> {
    if (!this.currentTask) {
      throw new Error('No task assigned');
    }

    this.status = 'running';
    this.updateHelperComponents();
    
    try {
      await this.reportProgress('started', 'Beginning task execution');
      
      // Execute the specific agent implementation
      const result = await this.executeTask();
      
      this.status = 'completed';
      await this.reportProgress('completed', 'Task execution completed successfully');
      
      return {
        success: true,
        result,
        metadata: {
          taskId: this.currentTask.id,
          agentId: this.config!.id,
          completedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      this.status = 'error';
      this.lastError = error as Error;
      
      await this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Abstract method to be implemented by specific agents
   */
  abstract executeTask(): Promise<any>;

  /**
   * Abstract method to get agent-specific prompt template
   */
  abstract getPromptTemplate(): string;

  /**
   * Send message to Claude API
   */
  async sendToClaude(message: string, options: Partial<SendMessageOptions> = {}): Promise<ClaudeResponse> {
    if (!this.claudeClient) {
      throw new Error('Claude client not initialized');
    }

    try {
      const defaultOptions: SendMessageOptions = {
        model: this.config!.claudeConfig.defaultModel || ClaudeModel.SONNET,
        maxTokens: this.config!.claudeConfig.maxTokens || 4096,
        temperature: this.config!.claudeConfig.temperature || 0.7,
        conversationHistory: this.conversationHistory,
        ...options
      };

      const response = await this.claudeClient.sendMessage(message, defaultOptions);
      
      // Update conversation history
      this.conversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: response.content }
      );

      return response;
    } catch (error) {
      throw new Error(`Claude API error: ${(error as Error).message}`);
    }
  }

  /**
   * Read file from workspace
   */
  async readFile(filePath: string): Promise<string> {
    try {
      const fullPath = path.resolve(this.config!.workspaceRoot, filePath);
      return fs.readFileSync(fullPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file: ${(error as Error).message}`);
    }
  }

  /**
   * Write file to workspace
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const fullPath = path.resolve(this.config!.workspaceRoot, filePath);
      const directory = path.dirname(fullPath);
      
      // Ensure directory exists
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
      
      fs.writeFileSync(fullPath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write file: ${(error as Error).message}`);
    }
  }

  /**
   * Execute command in workspace
   */
  async executeCommand(command: string): Promise<CommandResult> {
    if (!this.workspace || !this.currentTask) {
      throw new Error('Workspace not initialized or no current task');
    }

    return await this.workspace.executeCommand(this.currentTask.id, command);
  }

  /**
   * Report progress to Cognitive Canvas
   */
  async reportProgress(status: string, details: string, strength: number = 0.5): Promise<void> {
    if (!this.cognitiveCanvas || !this.config) {
      return;
    }

    try {
      const pheromoneData: PheromoneData = {
        id: `progress-${this.config.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'progress',
        strength,
        context: status,
        metadata: {
          details,
          agentId: this.config.id,
          taskId: this.currentTask?.id || null
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour expiry
      };

      await this.cognitiveCanvas.createPheromone(pheromoneData);
    } catch (error) {
      // Don't throw on progress reporting errors, silently continue
    }
  }

  /**
   * Report impasse - delegated to error handler
   */
  async reportImpasse(reason: string, context?: Record<string, any>, urgency: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
    if (this.errorHandler) {
      await this.errorHandler.reportImpasse(reason, context, urgency);
      this.status = 'impasse';
    }
  }

  /**
   * Handle errors - delegated to error handler
   */
  async handleError(error: Error): Promise<void> {
    this.lastError = error;
    this.status = 'error';
    this.updateHelperComponents();
    
    if (this.errorHandler) {
      await this.errorHandler.handleError(error);
    }
  }

  /**
   * Create session - delegated to session manager
   */
  async createSession(): Promise<SessionInfo> {
    if (!this.sessionMgr) {
      throw new Error('Session manager not initialized');
    }
    
    const session = await this.sessionMgr.createSession();
    this.currentSession = session;
    this.updateHelperComponents();
    return session;
  }

  /**
   * Run command in session - delegated to session manager
   */
  async runInSession(command: string): Promise<any> {
    if (!this.sessionMgr) {
      throw new Error('Session manager not initialized');
    }
    
    return await this.sessionMgr.runInSession(command);
  }

  /**
   * Format prompt template with context variables
   */
  formatPrompt(template: string, context: Record<string, any>): string {
    if (this.sessionMgr) {
      return this.sessionMgr.formatPrompt(template, context);
    }
    
    let formatted = template;
    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{{${key}}}`;
      formatted = formatted.replace(new RegExp(placeholder, 'g'), String(value));
    }
    return formatted;
  }

  /**
   * Reset agent state
   */
  async reset(): Promise<void> {
    this.currentTask = null;
    this.taskContext = null;
    this.status = this.config ? 'initialized' : 'uninitialized';
    this.lastError = null;
    this.conversationHistory = [];
    
    // Reset session
    if (this.sessionMgr) {
      await this.sessionMgr.reset();
    }
    this.currentSession = null;
    
    this.updateHelperComponents();
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AgentConfig>): void {
    if (!this.config) {
      throw new Error('Agent not initialized');
    }

    Object.assign(this.config, updates);
    this.updateHelperComponents();
  }

  // Getter methods
  getId(): string {
    return this.config?.id || '';
  }

  getRole(): string {
    return this.config?.role || '';
  }

  getCapabilities(): string[] {
    return this.config?.capabilities || [];
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  getCurrentTask(): TaskData | null {
    return this.currentTask;
  }

  getTaskContext(): TaskContext | null {
    return this.taskContext;
  }

  getLastError(): Error | null {
    return this.lastError;
  }

  /**
   * Set the last error (primarily for testing purposes)
   */
  setLastError(error: Error | null): void {
    this.lastError = error;
    this.updateHelperComponents();
  }

  getConfig(): AgentConfig | null {
    return this.config;
  }

  getWorkspace(): WorkspaceManager | null {
    return this.workspace;
  }

  getCognitiveCanvas(): CognitiveCanvas | null {
    return this.cognitiveCanvas;
  }

  setStatus(status: AgentStatus): void {
    this.status = status;
    this.updateHelperComponents();
  }

  /**
   * Update helper components with current state
   */
  private updateHelperComponents(): void {
    if (this.errorHandler) {
      this.errorHandler = new AgentErrorHandler(
        this.config,
        this.cognitiveCanvas,
        this.currentTask,
        this.taskContext,
        this.status,
        this.conversationHistory,
        this.currentSession,
        this.lastError
      );
    }

    if (this.sessionMgr) {
      this.sessionMgr = new AgentSessionManager(
        this.config,
        this.sessionManager,
        this.workspace,
        this.currentTask,
        this.currentSession,
        this.status,
        this.conversationHistory,
        this.lastError,
        this.taskContext
      );
    }
  }

  /**
   * Validate agent configuration
   */
  private validateConfig(config: AgentConfig): void {
    if (!config.id || config.id.trim() === '') {
      throw new Error('Agent ID is required');
    }

    if (!config.role || config.role.trim() === '') {
      throw new Error('Agent role is required');
    }

    if (!config.capabilities || config.capabilities.length === 0) {
      throw new Error('Agent capabilities are required');
    }

    if (!config.claudeConfig?.apiKey) {
      throw new Error('Claude API key is required');
    }

    if (!config.workspaceRoot) {
      throw new Error('Workspace root is required');
    }

    // Cognitive Canvas is optional - allow offline mode
    // if (!config.cognitiveCanvasConfig?.uri) {
    //   throw new Error('Cognitive Canvas configuration is required');
    // }
  }
}