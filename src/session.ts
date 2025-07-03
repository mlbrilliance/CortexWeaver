import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

export interface SessionInfo {
  sessionId: string;
  taskId: string;
  status: 'running' | 'stopped' | 'error';
  createdAt: Date;
}

export interface CommandOutput {
  output: string;
  exitCode: number;
  timestamp: Date;
}

export class SessionManager {
  private sessions: Map<string, SessionInfo> = new Map();
  private sessionLocks: Map<string, Promise<any>> = new Map();
  private cleanupIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isShuttingDown: boolean = false;

  constructor() {
    // Initialize session manager with proper cleanup
    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());
  }

  async createSession(taskId: string, workingDirectory: string): Promise<SessionInfo> {
    if (this.isShuttingDown) {
      throw new Error('Session manager is shutting down');
    }

    const sessionId = `cortex-${taskId}-${Date.now()}`;
    
    // Prevent concurrent session creation for the same task
    const lockKey = `create-${taskId}`;
    if (this.sessionLocks.has(lockKey)) {
      await this.sessionLocks.get(lockKey);
    }
    
    const createPromise = this._createSessionInternal(sessionId, taskId, workingDirectory);
    this.sessionLocks.set(lockKey, createPromise);
    
    try {
      const result = await createPromise;
      return result;
    } finally {
      this.sessionLocks.delete(lockKey);
    }
  }

  private async _createSessionInternal(sessionId: string, taskId: string, workingDirectory: string): Promise<SessionInfo> {
    try {
      // Validate working directory exists
      if (!fs.existsSync(workingDirectory)) {
        throw new Error(`Working directory does not exist: ${workingDirectory}`);
      }
      
      // Create detached tmux session with proper error handling
      await execAsync(`tmux new-session -d -s ${sessionId} -c "${workingDirectory}"`);
      
      const sessionInfo: SessionInfo = {
        sessionId,
        taskId,
        status: 'running',
        createdAt: new Date()
      };
      
      this.sessions.set(sessionId, sessionInfo);
      
      // Set up automatic cleanup for the session
      this.setupSessionCleanup(sessionId);
      
      return sessionInfo;
    } catch (error) {
      // Clean up on failure
      this.sessions.delete(sessionId);
      throw new Error(`Failed to create tmux session: ${(error as Error).message}`);
    }
  }

  async runCommandInSession(sessionId: string, command: string, timeout: number = 30000): Promise<CommandOutput> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      // Check if session exists
      await this.checkSessionExists(sessionId);
      
      // Create a unique marker to detect command completion
      const marker = `CMD_COMPLETE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Send command with completion marker
      await execAsync(`tmux send-keys -t ${sessionId} "${command.replace(/"/g, '\\"')}; echo '${marker}'" Enter`);
      
      // Poll for command completion with timeout
      const startTime = Date.now();
      let output = '';
      let exitCode = 0;
      
      while (Date.now() - startTime < timeout) {
        const { stdout } = await execAsync(`tmux capture-pane -t ${sessionId} -p`);
        output = stdout;
        
        if (output.includes(marker)) {
          // Extract actual command output (everything before the marker)
          const lines = output.split('\n');
          const markerIndex = lines.findIndex(line => line.includes(marker));
          
          if (markerIndex >= 0) {
            output = lines.slice(0, markerIndex).join('\n');
            break;
          }
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Check for timeout
      if (Date.now() - startTime >= timeout) {
        throw new Error(`Command execution timeout after ${timeout}ms`);
      }
      
      return {
        output: output.trim(),
        exitCode,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to run command in session: ${(error as Error).message}`);
    }
  }

  async attachToSession(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      await this.checkSessionExists(sessionId);
      return `tmux attach-session -t ${sessionId}`;
    } catch (error) {
      throw new Error(`Session ${sessionId} not found or not running`);
    }
  }

  async killSession(sessionId: string): Promise<boolean> {
    // Clear any cleanup intervals for this session
    const interval = this.cleanupIntervals.get(sessionId);
    if (interval) {
      clearTimeout(interval);
      this.cleanupIntervals.delete(sessionId);
    }
    
    // Wait for any pending operations on this session
    const lockKey = `start-${sessionId}`;
    if (this.sessionLocks.has(lockKey)) {
      try {
        await this.sessionLocks.get(lockKey);
      } catch (error) {
        // Ignore errors from pending operations during shutdown
      }
    }
    
    try {
      await execAsync(`tmux kill-session -t ${sessionId}`);
      this.sessions.delete(sessionId);
      return true;
    } catch (error) {
      // Session might not exist, still remove from tracking
      this.sessions.delete(sessionId);
      return false;
    }
  }

  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  async getSessionStatus(sessionId: string): Promise<string | null> {
    try {
      await this.checkSessionExists(sessionId);
      const session = this.sessions.get(sessionId);
      return session ? session.status : null;
    } catch (error) {
      return null;
    }
  }

  private async checkSessionExists(sessionId: string): Promise<boolean> {
    try {
      await execAsync(`tmux has-session -t ${sessionId}`);
      return true;
    } catch (error) {
      throw new Error(`Session ${sessionId} does not exist`);
    }
  }

  async listActiveTmuxSessions(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}"');
      return stdout.trim().split('\n').filter(name => name.startsWith('cortex-'));
    } catch (error) {
      // No tmux sessions running
      return [];
    }
  }

  async startAgentInSession(sessionId: string, agentCommand: string, prompt: string): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Session manager is shutting down');
    }

    // Prevent concurrent agent starts in the same session
    const lockKey = `start-${sessionId}`;
    if (this.sessionLocks.has(lockKey)) {
      await this.sessionLocks.get(lockKey);
    }
    
    const startPromise = this._startAgentInternal(sessionId, agentCommand, prompt);
    this.sessionLocks.set(lockKey, startPromise);
    
    try {
      await startPromise;
    } finally {
      this.sessionLocks.delete(lockKey);
    }
  }

  private async _startAgentInternal(sessionId: string, agentCommand: string, prompt: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Check if session is still alive
    try {
      await this.checkSessionExists(sessionId);
    } catch (error) {
      // Update session status and clean up
      session.status = 'error';
      this.sessions.delete(sessionId);
      throw new Error(`Session ${sessionId} is no longer active`);
    }

    let promptFile: string | null = null;
    
    try {
      // Create secure temporary file for prompt
      promptFile = `/tmp/prompt-${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.txt`;
      const escapedPrompt = prompt.replace(/'/g, "'\"'\"'"); // Escape single quotes for shell
      
      // Write prompt file atomically
      await execAsync(`echo '${escapedPrompt}' > ${promptFile} && chmod 600 ${promptFile}`);
      
      // Verify the prompt file was created and is readable
      const { stdout: fileCheck } = await execAsync(`test -r ${promptFile} && echo "exists"`);
      if (!fileCheck.includes('exists')) {
        throw new Error('Failed to create or verify prompt file');
      }
      
      // Start the agent with the prompt, ensuring proper command execution
      let fullCommand: string;
      
      // Check if this is a Gemini agent based on the command
      if (agentCommand.includes('gemini') || agentCommand === 'gemini') {
        // For Gemini CLI, use different command format
        fullCommand = `${agentCommand} -p < ${promptFile}`;
      } else {
        // For Claude Code agents
        fullCommand = `${agentCommand} -p --dangerously-skip-permissions < ${promptFile}`;
      }
      
      await execAsync(`tmux send-keys -t ${sessionId} '${fullCommand}' Enter`);
      
      console.log(`Started agent in session ${sessionId} with command: ${agentCommand}`);
      
      // Schedule prompt file cleanup with proper error handling
      setTimeout(async () => {
        if (promptFile) {
          try {
            await execAsync(`rm -f ${promptFile}`);
          } catch (cleanupError) {
            console.warn(`Failed to cleanup prompt file ${promptFile}: ${cleanupError}`);
          }
        }
      }, 5000);
      
    } catch (error) {
      // Clean up prompt file immediately on error
      if (promptFile) {
        try {
          await execAsync(`rm -f ${promptFile}`);
        } catch (cleanupError) {
          console.warn(`Failed to cleanup prompt file after error: ${cleanupError}`);
        }
      }
      throw new Error(`Failed to start agent: ${(error as Error).message}`);
    }
  }

  async monitorSession(sessionId: string, callback: (output: string) => void): Promise<void> {
    // This would be used to monitor session output in real-time
    // Implementation would depend on specific monitoring requirements
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Simplified monitoring - real implementation would use proper tmux monitoring
      console.log(`Monitoring session ${sessionId}...`);
      
      // This is a placeholder - real implementation would set up continuous monitoring
      setInterval(async () => {
        try {
          const { stdout } = await execAsync(`tmux capture-pane -t ${sessionId} -p`);
          callback(stdout);
        } catch (error) {
          console.error(`Error monitoring session: ${error}`);
        }
      }, 5000); // Check every 5 seconds
      
    } catch (error) {
      throw new Error(`Failed to monitor session: ${(error as Error).message}`);
    }
  }

  async getSessionOutput(sessionId: string, lines: number = 100): Promise<string> {
    try {
      await this.checkSessionExists(sessionId);
      const { stdout } = await execAsync(`tmux capture-pane -t ${sessionId} -p -S -${lines}`);
      return stdout;
    } catch (error) {
      throw new Error(`Failed to get session output: ${(error as Error).message}`);
    }
  }

  async cleanupDeadSessions(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    try {
      const activeSessions = await this.listActiveTmuxSessions();
      
      for (const [sessionId, sessionInfo] of this.sessions.entries()) {
        if (!activeSessions.includes(sessionId)) {
          // Clear any cleanup intervals for dead sessions
          const interval = this.cleanupIntervals.get(sessionId);
          if (interval) {
            clearTimeout(interval);
            this.cleanupIntervals.delete(sessionId);
          }
          
          this.sessions.delete(sessionId);
          console.log(`Cleaned up dead session: ${sessionId}`);
        }
      }
    } catch (error) {
      console.warn(`Error during session cleanup: ${error}`);
    }
  }

  private setupSessionCleanup(sessionId: string): void {
    // Set up automatic cleanup after 1 hour of inactivity
    const cleanup = setTimeout(async () => {
      console.log(`Auto-cleaning up session ${sessionId} after timeout`);
      await this.killSession(sessionId);
    }, 60 * 60 * 1000); // 1 hour
    
    this.cleanupIntervals.set(sessionId, cleanup);
  }

  private async gracefulShutdown(): Promise<void> {
    console.log('Starting graceful shutdown of SessionManager...');
    this.isShuttingDown = true;
    
    // Clear all cleanup intervals
    for (const interval of this.cleanupIntervals.values()) {
      clearTimeout(interval);
    }
    this.cleanupIntervals.clear();
    
    // Kill all active sessions
    const sessions = Array.from(this.sessions.keys());
    const killPromises = sessions.map(sessionId => 
      this.killSession(sessionId).catch(error => 
        console.warn(`Failed to kill session ${sessionId}:`, error)
      )
    );
    
    await Promise.allSettled(killPromises);
    
    // Clear session locks
    this.sessionLocks.clear();
    
    console.log('SessionManager graceful shutdown complete');
  }

  // Health check method
  async healthCheck(): Promise<{ healthy: boolean; sessionCount: number; activeSessionCount: number }> {
    try {
      const activeSessions = await this.listActiveTmuxSessions();
      return {
        healthy: !this.isShuttingDown,
        sessionCount: this.sessions.size,
        activeSessionCount: activeSessions.length
      };
    } catch (error) {
      return {
        healthy: false,
        sessionCount: this.sessions.size,
        activeSessionCount: 0
      };
    }
  }
}