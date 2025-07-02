import { TaskData } from '../cognitive-canvas';
import { WorkspaceManager } from '../workspace';
import { SessionManager } from '../session';
import { AgentType } from './workflow-manager';
import { TaskExecutionContext } from './task-executor';
import { AgentPromptGenerator } from './agent-prompt-generator';

export interface AgentSpawnResult {
  success: boolean;
  agentType: AgentType;
  taskId: string;
  sessionId?: string;
  worktreePath?: string;
  error?: string;
}

export interface SpecializedAgentConfig {
  taskId: string;
  agentType: 'CodeSavant' | 'Debugger';
  context: any;
  branchPrefix?: string;
}

export class AgentSpawner {
  private promptGenerator: AgentPromptGenerator;

  constructor(
    private workspace: WorkspaceManager,
    private sessionManager: SessionManager
  ) {
    this.promptGenerator = new AgentPromptGenerator();
  }

  /**
   * Spawn regular agent for task execution
   */
  async spawnAgent(
    task: TaskData, 
    agentType: AgentType, 
    context?: TaskExecutionContext
  ): Promise<AgentSpawnResult> {
    try {
      console.log(`Spawning ${agentType} agent for task: ${task.title}`);
      
      // Create worktree for isolated work
      const branchName = `feature/${task.id}`;
      const worktree = await this.workspace.createWorktree(task.id, branchName, 'main');
      
      try {
        // Create session for agent
        const session = await this.sessionManager.createSession(task.id, worktree.path);
        
        // Generate agent prompt with context
        const prompt = this.promptGenerator.generateAgentPrompt(task, agentType, context);
        
        // Start agent in session with required flags
        await this.sessionManager.startAgentInSession(
          session.sessionId,
          'claude-code',
          prompt
        );
        
        console.log(`${agentType} agent started for task ${task.id}`);
        
        return {
          success: true,
          agentType,
          taskId: task.id,
          sessionId: session.sessionId,
          worktreePath: worktree.path
        };
        
      } catch (sessionError) {
        // Cleanup worktree on session failure
        await this.workspace.removeWorktree(task.id);
        throw sessionError;
      }
      
    } catch (error) {
      const errorMessage = `Failed to spawn agent for task ${task.id}: ${(error as Error).message}`;
      console.error(errorMessage);
      
      return {
        success: false,
        agentType,
        taskId: task.id,
        error: errorMessage
      };
    }
  }

  /**
   * Spawn CodeSavant helper agent for impasse situations
   */
  async spawnCodeSavant(taskId: string, originalContext: string): Promise<AgentSpawnResult> {
    try {
      console.log(`Spawning CodeSavant helper for task: ${taskId}`);
      
      // Create CodeSavant helper session
      const codeSavantTaskId = `codesavant-${taskId}`;
      const branchName = `helper/${codeSavantTaskId}`;
      
      // Create worktree for CodeSavant
      const worktree = await this.workspace.createWorktree(
        codeSavantTaskId,
        branchName,
        'main'
      );
      
      try {
        // Create session for CodeSavant
        const session = await this.sessionManager.createSession(
          codeSavantTaskId,
          worktree.path
        );
        
        // Generate specialized CodeSavant prompt
        const prompt = this.promptGenerator.generateCodeSavantPrompt(taskId, originalContext);
        
        // Start CodeSavant with analysis focus
        await this.sessionManager.startAgentInSession(
          session.sessionId,
          'claude-code',
          prompt
        );
        
        console.log(`CodeSavant helper spawned for task ${taskId}`);
        
        return {
          success: true,
          agentType: 'CodeSavant' as any,
          taskId: codeSavantTaskId,
          sessionId: session.sessionId,
          worktreePath: worktree.path
        };
        
      } catch (sessionError) {
        await this.workspace.removeWorktree(codeSavantTaskId);
        throw sessionError;
      }
      
    } catch (error) {
      const errorMessage = `Failed to spawn CodeSavant for task ${taskId}: ${(error as Error).message}`;
      console.error(errorMessage);
      
      return {
        success: false,
        agentType: 'CodeSavant' as any,
        taskId,
        error: errorMessage
      };
    }
  }

  /**
   * Spawn Debugger agent for failure analysis
   */
  async spawnDebugger(taskId: string, failure: any): Promise<AgentSpawnResult> {
    try {
      console.log(`Spawning Debugger agent for task failure: ${taskId}`);
      
      // Create dedicated debugging task
      const debuggerTaskId = `debugger-${taskId}`;
      const branchName = `debug/${debuggerTaskId}`;
      
      // Create worktree for Debugger
      const worktree = await this.workspace.createWorktree(
        debuggerTaskId,
        branchName,
        'main'
      );
      
      try {
        // Create session for Debugger
        const session = await this.sessionManager.createSession(
          debuggerTaskId,
          worktree.path
        );
        
        // Generate specialized Debugger prompt
        const prompt = this.promptGenerator.generateDebuggerPrompt(taskId, failure);
        
        // Start Debugger with analysis focus
        await this.sessionManager.startAgentInSession(
          session.sessionId,
          'claude-code',
          prompt
        );
        
        console.log(`Debugger agent spawned for task ${taskId}`);
        
        return {
          success: true,
          agentType: 'Debugger',
          taskId: debuggerTaskId,
          sessionId: session.sessionId,
          worktreePath: worktree.path
        };
        
      } catch (sessionError) {
        await this.workspace.removeWorktree(debuggerTaskId);
        throw sessionError;
      }
      
    } catch (error) {
      const errorMessage = `Failed to spawn Debugger agent for task ${taskId}: ${(error as Error).message}`;
      console.error(errorMessage);
      
      return {
        success: false,
        agentType: 'Debugger',
        taskId,
        error: errorMessage
      };
    }
  }

  /**
   * Cleanup agent resources
   */
  async cleanupAgent(taskId: string): Promise<void> {
    try {
      // Kill sessions
      const sessions = this.sessionManager.listSessions();
      const taskSessions = sessions.filter(s => s.taskId === taskId);
      
      for (const session of taskSessions) {
        await this.sessionManager.killSession(session.sessionId);
      }
      
      // Remove worktree
      await this.workspace.removeWorktree(taskId);
      
      console.log(`Cleaned up agent resources for task ${taskId}`);
      
    } catch (error) {
      console.error(`Error cleaning up agent for task ${taskId}:`, error);
    }
  }


  /**
   * Spawn Critique agent for failure analysis
   */
  async spawnCritique(taskId: string, errorContext: any): Promise<AgentSpawnResult> {
    try {
      console.log(`Spawning Critique agent for task failure: ${taskId}`);
      
      // Create dedicated critique task
      const critiqueTaskId = `critique-${taskId}`;
      const branchName = `critique/${critiqueTaskId}`;
      
      // Create worktree for Critique
      const worktree = await this.workspace.createWorktree(
        critiqueTaskId,
        branchName,
        'main'
      );
      
      try {
        // Create session for Critique
        const session = await this.sessionManager.createSession(
          critiqueTaskId,
          worktree.path
        );
        
        // Generate specialized Critique prompt
        const prompt = this.promptGenerator.generateCritiquePrompt(taskId, errorContext);
        
        // Start Critique with analysis focus
        await this.sessionManager.startAgentInSession(
          session.sessionId,
          'claude-code',
          prompt
        );
        
        console.log(`Critique agent spawned for task ${taskId}`);
        
        return {
          success: true,
          agentType: 'Critique',
          taskId: critiqueTaskId,
          sessionId: session.sessionId,
          worktreePath: worktree.path
        };
        
      } catch (sessionError) {
        await this.workspace.removeWorktree(critiqueTaskId);
        throw sessionError;
      }
      
    } catch (error) {
      const errorMessage = `Failed to spawn Critique agent for task ${taskId}: ${(error as Error).message}`;
      console.error(errorMessage);
      
      return {
        success: false,
        agentType: 'Critique',
        taskId,
        error: errorMessage
      };
    }
  }

}