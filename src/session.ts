import { exec } from 'child_process';
import { promisify } from 'util';

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

  constructor() {
    // Initialize session manager
  }

  async createSession(taskId: string, workingDirectory: string): Promise<SessionInfo> {
    const sessionId = `cortex-${taskId}-${Date.now()}`;
    
    try {
      // Create detached tmux session
      await execAsync(`tmux new-session -d -s ${sessionId} -c ${workingDirectory}`);
      
      const sessionInfo: SessionInfo = {
        sessionId,
        taskId,
        status: 'running',
        createdAt: new Date()
      };
      
      this.sessions.set(sessionId, sessionInfo);
      return sessionInfo;
    } catch (error) {
      throw new Error(`Failed to create tmux session: ${(error as Error).message}`);
    }
  }

  async runCommandInSession(sessionId: string, command: string): Promise<CommandOutput> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      // Check if session exists
      await this.checkSessionExists(sessionId);
      
      // Send command to tmux session
      await execAsync(`tmux send-keys -t ${sessionId} "${command}" Enter`);
      
      // Wait a bit for command to execute
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Capture the output (this is simplified - real implementation would need better output handling)
      const { stdout } = await execAsync(`tmux capture-pane -t ${sessionId} -p`);
      
      return {
        output: stdout,
        exitCode: 0, // Simplified - real implementation would track actual exit codes
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
    try {
      await execAsync(`tmux kill-session -t ${sessionId}`);
      this.sessions.delete(sessionId);
      return true;
    } catch (error) {
      // Session might not exist
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
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      // Write prompt to a temporary file
      const promptFile = `/tmp/prompt-${sessionId}.txt`;
      await execAsync(`echo "${prompt.replace(/"/g, '\\"')}" > ${promptFile}`);
      
      // Start the agent with the prompt
      const fullCommand = `${agentCommand} -p --dangerously-skip-permissions < ${promptFile}`;
      await execAsync(`tmux send-keys -t ${sessionId} "${fullCommand}" Enter`);
      
      console.log(`Started agent in session ${sessionId}`);
    } catch (error) {
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
    const activeSessions = await this.listActiveTmuxSessions();
    
    for (const [sessionId, sessionInfo] of this.sessions.entries()) {
      if (!activeSessions.includes(sessionId)) {
        this.sessions.delete(sessionId);
        console.log(`Cleaned up dead session: ${sessionId}`);
      }
    }
  }
}