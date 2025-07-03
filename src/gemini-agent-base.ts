/**
 * Gemini Agent Base Class
 * Base class for all CortexWeaver agents that use Google Gemini CLI
 */

import * as fs from 'fs';
import * as path from 'path';
import { GeminiClient, GeminiResponse, GeminiSessionOptions } from './gemini-client';
import { WorkspaceManager, CommandResult } from './workspace';
import { CognitiveCanvas, TaskData, PheromoneData } from './cognitive-canvas';
import { SessionManager, SessionInfo } from './session';
import { AgentConfig, TaskContext, TaskResult, AgentStatus } from './types/agent-types';
import { AgentErrorHandler } from './agent-error-handling';
import { AgentSessionManager } from './agent-session-management';

/**
 * Gemini-specific agent configuration
 */
export interface GeminiAgentConfig extends AgentConfig {
  geminiConfig: {
    apiKey?: string;
    useApiKey?: boolean;
    timeout?: number;
    maxRetries?: number;
    systemPrompt?: string;
  };
}

/**
 * Abstract base class for all CortexWeaver Gemini agents
 */
export abstract class GeminiAgent {
  protected config: GeminiAgentConfig | null = null;
  protected geminiClient: GeminiClient | null = null;
  protected workspace: WorkspaceManager | null = null;
  protected cognitiveCanvas: CognitiveCanvas | null = null;
  protected sessionManager: SessionManager | null = null;
  
  protected currentTask: TaskData | null = null;
  protected taskContext: TaskContext | null = null;
  protected status: AgentStatus = 'uninitialized';
  protected lastError: Error | null = null;
  protected currentSession: SessionInfo | null = null;
  protected conversationHistory: Array<{prompt: string; response: string}> = [];

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
   * Initialize the Gemini agent with configuration
   */
  async initialize(config: GeminiAgentConfig): Promise<void> {
    this.validateConfig(config);
    
    this.config = config;
    
    // Initialize Gemini client
    this.geminiClient = new GeminiClient({
      apiKey: config.geminiConfig.apiKey,
      useApiKey: config.geminiConfig.useApiKey,
      timeout: config.geminiConfig.timeout || 30000,
      maxRetries: config.geminiConfig.maxRetries || 2
    });

    // Check Gemini CLI availability
    const geminiAvailable = await this.geminiClient.checkGeminiAvailability();
    if (!geminiAvailable) {
      console.warn('⚠️ Gemini CLI not available. Install with: npm install -g @google/gemini-cli');
    }

    console.log(`🤖 ${config.role.toUpperCase()} (${config.id}) - Initialized with Gemini CLI`);

    // Initialize workspace manager
    this.workspace = new WorkspaceManager(config.workspaceRoot);

    // Initialize cognitive canvas - use shared instance if provided
    if (config.cognitiveCanvas) {
      this.cognitiveCanvas = config.cognitiveCanvas;
    } else if (config.cognitiveCanvasConfig) {
      this.cognitiveCanvas = new CognitiveCanvas(config.cognitiveCanvasConfig);
    } else {
      console.log('⚠️ Gemini agent initialized without cognitive canvas - offline mode enabled');
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
      this.conversationHistory.map(h => ({ role: 'user' as const, content: h.prompt })),
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
      this.conversationHistory.map(h => ({ role: 'user' as const, content: h.prompt })),
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
      throw new Error('Gemini agent already has an assigned task');
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
      throw new Error('No task assigned to Gemini agent');
    }

    this.status = 'running';
    this.updateHelperComponents();
    
    try {
      await this.reportProgress('started', 'Beginning task execution with Gemini');
      
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
          completedAt: new Date().toISOString(),
          aiProvider: 'gemini'
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
   * Abstract method to be implemented by specific Gemini agents
   */
  abstract executeTask(): Promise<any>;

  /**
   * Abstract method to get agent-specific prompt template
   */
  abstract getPromptTemplate(): string;

  /**
   * Send message to Gemini CLI
   */
  async sendToGemini(message: string, options: Partial<GeminiSessionOptions> = {}): Promise<GeminiResponse> {
    if (!this.geminiClient) {
      throw new Error('Gemini client not initialized');
    }

    try {
      const agentId = this.config?.id || 'unknown';
      const role = this.config?.role || 'agent';
      
      console.log(`🤖 ${role.toUpperCase()} (${agentId}) - Processing with Gemini CLI...`);
      console.log(`📝 Input: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);

      const defaultOptions: GeminiSessionOptions = {
        systemPrompt: this.config?.geminiConfig.systemPrompt || this.getPromptTemplate(),
        ...options
      };

      // Use interactive mode for better response handling
      const response = await this.geminiClient.sendMessageInteractive(message, defaultOptions);
      
      if (response.success) {
        console.log(`✅ ${role.toUpperCase()} (${agentId}) - Gemini task completed!`);
        console.log(`📤 Output: ${response.content.substring(0, 150)}${response.content.length > 150 ? '...' : ''}`);
        console.log(`⏱️ Execution time: ${response.executionTime}ms`);
      } else {
        console.log(`❌ ${role.toUpperCase()} (${agentId}) - Gemini error: ${response.error}`);
      }
      
      console.log('─'.repeat(80));
      
      // Update conversation history
      this.conversationHistory.push({
        prompt: message,
        response: response.content
      });

      return response;
    } catch (error) {
      console.log(`❌ ${this.config?.role?.toUpperCase() || 'GEMINI_AGENT'} (${this.config?.id}) - Error: ${(error as Error).message}`);
      throw new Error(`Gemini CLI error: ${(error as Error).message}`);
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
        content: `Gemini agent ${this.config.id} progress: ${details}`,
        strength,
        context: status,
        metadata: {
          details,
          agentId: this.config.id,
          taskId: this.currentTask?.id || null,
          aiProvider: 'gemini'
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
  updateConfig(updates: Partial<GeminiAgentConfig>): void {
    if (!this.config) {
      throw new Error('Gemini agent not initialized');
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

  getConfig(): GeminiAgentConfig | null {
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
        this.conversationHistory.map(h => ({ role: 'user' as const, content: h.prompt })),
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
        this.conversationHistory.map(h => ({ role: 'user' as const, content: h.prompt })),
        this.lastError,
        this.taskContext
      );
    }
  }

  /**
   * Validate Gemini agent configuration
   */
  private validateConfig(config: GeminiAgentConfig): void {
    if (!config.id || config.id.trim() === '') {
      throw new Error('Gemini agent ID is required');
    }

    if (!config.role || config.role.trim() === '') {
      throw new Error('Gemini agent role is required');
    }

    if (!config.capabilities || config.capabilities.length === 0) {
      throw new Error('Gemini agent capabilities are required');
    }

    if (!config.workspaceRoot) {
      throw new Error('Workspace root is required');
    }

    if (!config.geminiConfig) {
      throw new Error('Gemini configuration is required');
    }
  }
}