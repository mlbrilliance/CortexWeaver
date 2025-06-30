import * as fs from 'fs';
import * as path from 'path';
import { ClaudeClient, ClaudeModel, SendMessageOptions, ClaudeResponse, Message } from './claude-client';
import { WorkspaceManager, CommandResult } from './workspace';
import { CognitiveCanvas, TaskData, PheromoneData } from './cognitive-canvas';
export { TaskData } from './cognitive-canvas';
import { SessionManager, SessionInfo, CommandOutput } from './session';

export interface AgentConfig {
  id: string;
  role: string;
  capabilities: string[];
  claudeConfig: {
    apiKey: string;
    defaultModel?: ClaudeModel;
    maxTokens?: number;
    temperature?: number;
  };
  workspaceRoot: string;
  cognitiveCanvasConfig: {
    uri: string;
    username: string;
    password: string;
  };
}

export interface TaskContext {
  projectInfo?: any;
  dependencies?: any[];
  files?: string[];
  [key: string]: any;
}

export interface TaskResult {
  success: boolean;
  result?: any;
  error?: string;
  artifacts?: string[];
  metadata?: Record<string, any>;
}

export type AgentStatus = 'uninitialized' | 'initialized' | 'assigned' | 'running' | 'completed' | 'error' | 'idle';

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

    // Initialize cognitive canvas
    this.cognitiveCanvas = new CognitiveCanvas(config.cognitiveCanvasConfig);

    // Initialize session manager
    this.sessionManager = new SessionManager();

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
      // Don't throw on progress reporting errors, just log
      console.warn(`Failed to report progress: ${(error as Error).message}`);
    }
  }

  /**
   * Report impasse - when agent is stuck and needs help
   */
  async reportImpasse(reason: string, context?: Record<string, any>, urgency: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
    if (!this.cognitiveCanvas || !this.config) {
      console.error('Cannot report impasse: Cognitive Canvas or config not available');
      return;
    }

    try {
      const strengthMap = { low: 0.6, medium: 0.8, high: 0.95 };
      const expiryMap = { low: 1800000, medium: 3600000, high: 7200000 }; // 30min, 1hr, 2hrs

      const pheromoneData: PheromoneData = {
        id: `impasse-${this.config.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'impasse',
        strength: strengthMap[urgency],
        context: 'agent_impasse',
        metadata: {
          reason,
          urgency,
          agentId: this.config.id,
          agentRole: this.config.role,
          taskId: this.currentTask?.id || null,
          taskTitle: this.currentTask?.title || null,
          additionalContext: context || {},
          conversationLength: this.conversationHistory.length,
          lastError: this.lastError?.message || null
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expiryMap[urgency]).toISOString()
      };

      await this.cognitiveCanvas.createPheromone(pheromoneData);
      
      // Also update agent status to indicate impasse state
      this.status = 'error';
      console.warn(`Agent ${this.config.id} reported impasse: ${reason}`);
    } catch (error) {
      console.error(`Failed to report impasse: ${(error as Error).message}`);
    }
  }

  /**
   * Handle errors and attempt recovery
   */
  async handleError(error: Error): Promise<void> {
    this.lastError = error;
    this.status = 'error';

    // Report error as pheromone
    if (this.cognitiveCanvas && this.config) {
      try {
        const errorPheromone: PheromoneData = {
          id: `error-${this.config.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'error',
          strength: 0.8,
          context: 'agent_error',
          metadata: {
            error: error.message,
            agentId: this.config.id,
            taskId: this.currentTask?.id || null,
            stack: error.stack
          },
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7200000).toISOString() // 2 hours expiry
        };

        await this.cognitiveCanvas.createPheromone(errorPheromone);
      } catch (reportError) {
        console.warn(`Failed to report error: ${(reportError as Error).message}`);
      }
    }

    // Log error details
    console.error(`Agent ${this.config?.id} encountered error:`, error);
  }

  /**
   * Create a session for task execution
   */
  async createSession(): Promise<SessionInfo> {
    if (!this.sessionManager || !this.currentTask || !this.workspace) {
      throw new Error('Session manager, task, or workspace not available');
    }

    const workspacePath = this.workspace.getWorktreePath(this.currentTask.id);
    this.currentSession = await this.sessionManager.createSession(this.currentTask.id, workspacePath);
    
    return this.currentSession;
  }

  /**
   * Run command in session
   */
  async runInSession(command: string): Promise<CommandOutput> {
    if (!this.sessionManager || !this.currentSession) {
      throw new Error('No active session');
    }

    return await this.sessionManager.runCommandInSession(this.currentSession.sessionId, command);
  }

  /**
   * Format prompt template with context variables
   */
  formatPrompt(template: string, context: Record<string, any>): string {
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
    
    // Clean up session if exists
    if (this.currentSession && this.sessionManager) {
      try {
        await this.sessionManager.killSession(this.currentSession.sessionId);
      } catch (error) {
        console.warn(`Failed to clean up session: ${(error as Error).message}`);
      }
      this.currentSession = null;
    }
  }

  /**
   * Update agent configuration
   */
  updateConfig(updates: Partial<AgentConfig>): void {
    if (!this.config) {
      throw new Error('Agent not initialized');
    }

    Object.assign(this.config, updates);
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

  getConfig(): AgentConfig | null {
    return this.config;
  }

  setStatus(status: AgentStatus): void {
    this.status = status;
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

    if (!config.cognitiveCanvasConfig?.uri) {
      throw new Error('Cognitive Canvas configuration is required');
    }
  }
}