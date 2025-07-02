import { SessionManager, SessionInfo, CommandOutput } from './session';
import { WorkspaceManager } from './workspace';
import { TaskData } from './cognitive-canvas';
import { AgentConfig, AgentStatus } from './types/agent-types';
import { Message } from './claude-client';

export interface SessionManagementCapabilities {
  createSession(): Promise<SessionInfo>;
  runInSession(command: string): Promise<CommandOutput>;
  reset(): Promise<void>;
}

export class AgentSessionManager {
  private config: AgentConfig | null = null;
  private sessionManager: SessionManager | null = null;
  private workspace: WorkspaceManager | null = null;
  private currentTask: TaskData | null = null;
  private currentSession: SessionInfo | null = null;
  private status: AgentStatus = 'uninitialized';
  private conversationHistory: Message[] = [];
  private lastError: Error | null = null;
  private taskContext: any = null;

  constructor(
    config: AgentConfig | null,
    sessionManager: SessionManager | null,
    workspace: WorkspaceManager | null,
    currentTask: TaskData | null,
    currentSession: SessionInfo | null,
    status: AgentStatus,
    conversationHistory: Message[],
    lastError: Error | null,
    taskContext: any
  ) {
    this.config = config;
    this.sessionManager = sessionManager;
    this.workspace = workspace;
    this.currentTask = currentTask;
    this.currentSession = currentSession;
    this.status = status;
    this.conversationHistory = conversationHistory;
    this.lastError = lastError;
    this.taskContext = taskContext;
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
   * Get current session info
   */
  getCurrentSession(): SessionInfo | null {
    return this.currentSession;
  }

  /**
   * Check if session is active
   */
  hasActiveSession(): boolean {
    return this.currentSession !== null;
  }
}