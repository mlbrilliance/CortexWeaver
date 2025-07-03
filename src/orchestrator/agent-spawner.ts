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
  communicationChannel?: string;
  metadata?: {
    spawnedAt: string;
    parentTaskId?: string;
    cooperatingAgents?: string[];
  };
}

export interface SpecializedAgentConfig {
  taskId: string;
  agentType: 'CodeSavant' | 'Debugger';
  context: any;
  branchPrefix?: string;
  parentSessionId?: string;
  communicationChannels?: string[];
}

export interface AgentCommunication {
  fromAgent: string;
  toAgent: string;
  messageType: 'coordination' | 'handoff' | 'query' | 'update';
  payload: any;
  timestamp: string;
  sessionId: string;
}

export interface AgentCoordinationInfo {
  agentId: string;
  taskId: string;
  sessionId: string;
  status: 'spawning' | 'active' | 'waiting' | 'completed' | 'failed';
  lastHeartbeat: string;
  cooperatingWith: string[];
  communicationChannels: string[];
}

export class AgentSpawner {
  private promptGenerator: AgentPromptGenerator;
  private activeAgents: Map<string, AgentCoordinationInfo> = new Map();
  private communicationQueues: Map<string, AgentCommunication[]> = new Map();
  private agentHeartbeats: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private workspace: WorkspaceManager,
    private sessionManager: SessionManager
  ) {
    this.promptGenerator = new AgentPromptGenerator();
    this.setupCommunicationSystem();
  }

  /**
   * Set up inter-agent communication system
   */
  private setupCommunicationSystem(): void {
    // Set up periodic heartbeat monitoring
    setInterval(() => {
      this.monitorAgentHealth();
    }, 30000); // Check every 30 seconds

    // Set up communication queue processing
    setInterval(() => {
      this.processCommunicationQueues();
    }, 5000); // Process messages every 5 seconds
  }

  /**
   * Spawn regular agent for task execution
   */
  async spawnAgent(
    task: TaskData, 
    agentType: AgentType, 
    context?: TaskExecutionContext,
    cooperatingAgents?: string[]
  ): Promise<AgentSpawnResult> {
    try {
      console.log(`Spawning ${agentType} agent for task: ${task.title}`);
      
      // Create worktree for isolated work
      const branchName = `feature/${task.id}`;
      const worktree = await this.workspace.createWorktree(task.id, branchName, 'main');
      
      try {
        // Create session for agent
        const session = await this.sessionManager.createSession(task.id, worktree.path);
        
        // Set up communication channel
        const communicationChannel = `agent-${agentType}-${task.id}`;
        this.communicationQueues.set(communicationChannel, []);
        
        // Generate agent prompt
        const prompt = this.promptGenerator.generateAgentPrompt(task, agentType, context);
        
        // Start agent in session with required flags
        await this.sessionManager.startAgentInSession(
          session.sessionId,
          'claude-code',
          prompt
        );
        
        // Register agent for coordination
        const agentInfo: AgentCoordinationInfo = {
          agentId: `${agentType}-${task.id}`,
          taskId: task.id,
          sessionId: session.sessionId,
          status: 'active',
          lastHeartbeat: new Date().toISOString(),
          cooperatingWith: cooperatingAgents || [],
          communicationChannels: [communicationChannel]
        };
        
        this.activeAgents.set(agentInfo.agentId, agentInfo);
        this.setupAgentHeartbeat(agentInfo.agentId);
        
        console.log(`${agentType} agent started for task ${task.id} with communication channel ${communicationChannel}`);
        
        return {
          success: true,
          agentType,
          taskId: task.id,
          sessionId: session.sessionId,
          worktreePath: worktree.path,
          communicationChannel,
          metadata: {
            spawnedAt: new Date().toISOString(),
            cooperatingAgents
          }
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
          agentType: 'Critique' as any,
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
        agentType: 'Critique' as any,
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
      // Find and cleanup all agents for this task
      const agentsToCleanup = Array.from(this.activeAgents.entries())
        .filter(([agentId, info]) => info.taskId === taskId)
        .map(([agentId]) => agentId);
      
      for (const agentId of agentsToCleanup) {
        await this.cleanupSpecificAgent(agentId);
      }
      
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
   * Cleanup specific agent by ID
   */
  private async cleanupSpecificAgent(agentId: string): Promise<void> {
    const agentInfo = this.activeAgents.get(agentId);
    if (!agentInfo) return;
    
    // Clear heartbeat
    const heartbeat = this.agentHeartbeats.get(agentId);
    if (heartbeat) {
      clearInterval(heartbeat);
      this.agentHeartbeats.delete(agentId);
    }
    
    // Clear communication channels
    for (const channel of agentInfo.communicationChannels) {
      this.communicationQueues.delete(channel);
    }
    
    // Remove from active agents
    this.activeAgents.delete(agentId);
  }

  /**
   * Send message between agents
   */
  async sendAgentMessage(
    fromAgentId: string,
    toAgentId: string,
    messageType: AgentCommunication['messageType'],
    payload: any
  ): Promise<boolean> {
    try {
      const toAgentInfo = this.activeAgents.get(toAgentId);
      if (!toAgentInfo) {
        console.warn(`Target agent ${toAgentId} not found for message`);
        return false;
      }
      
      const message: AgentCommunication = {
        fromAgent: fromAgentId,
        toAgent: toAgentId,
        messageType,
        payload,
        timestamp: new Date().toISOString(),
        sessionId: toAgentInfo.sessionId
      };
      
      // Add message to target agent's communication channels
      for (const channel of toAgentInfo.communicationChannels) {
        const queue = this.communicationQueues.get(channel) || [];
        queue.push(message);
        this.communicationQueues.set(channel, queue);
      }
      
      console.log(`Message sent from ${fromAgentId} to ${toAgentId}: ${messageType}`);
      return true;
      
    } catch (error) {
      console.error('Error sending agent message:', error);
      return false;
    }
  }

  /**
   * Get active agents for a task
   */
  getActiveAgentsForTask(taskId: string): AgentCoordinationInfo[] {
    return Array.from(this.activeAgents.values())
      .filter(agent => agent.taskId === taskId);
  }

  /**
   * Get all active agents
   */
  getAllActiveAgents(): AgentCoordinationInfo[] {
    return Array.from(this.activeAgents.values());
  }

  /**
   * Set up heartbeat monitoring for agent
   */
  private setupAgentHeartbeat(agentId: string): void {
    const heartbeat = setInterval(() => {
      const agentInfo = this.activeAgents.get(agentId);
      if (agentInfo) {
        // In a full implementation, this would ping the agent
        // For now, we just update the heartbeat timestamp
        agentInfo.lastHeartbeat = new Date().toISOString();
      }
    }, 60000); // Heartbeat every minute
    
    this.agentHeartbeats.set(agentId, heartbeat);
  }

  /**
   * Monitor agent health and handle failed agents
   */
  private async monitorAgentHealth(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    for (const [agentId, agentInfo] of this.activeAgents.entries()) {
      const lastHeartbeat = new Date(agentInfo.lastHeartbeat).getTime();
      
      if (now - lastHeartbeat > staleThreshold) {
        console.warn(`Agent ${agentId} appears to be stale, marking as failed`);
        agentInfo.status = 'failed';
        
        // Notify cooperating agents
        for (const cooperatingAgentId of agentInfo.cooperatingWith) {
          await this.sendAgentMessage(
            'system',
            cooperatingAgentId,
            'update',
            {
              type: 'agent_failed',
              failedAgent: agentId,
              reason: 'heartbeat_timeout'
            }
          );
        }
      }
    }
  }

  /**
   * Process communication queues
   */
  private async processCommunicationQueues(): Promise<void> {
    for (const [channel, messages] of this.communicationQueues.entries()) {
      if (messages.length === 0) continue;
      
      // Process pending messages
      const processedMessages: AgentCommunication[] = [];
      
      for (const message of messages) {
        try {
          await this.deliverMessage(message);
          processedMessages.push(message);
        } catch (error) {
          console.error(`Failed to deliver message in channel ${channel}:`, error);
        }
      }
      
      // Remove processed messages
      const remainingMessages = messages.filter(msg => !processedMessages.includes(msg));
      this.communicationQueues.set(channel, remainingMessages);
    }
  }

  /**
   * Deliver message to target agent
   */
  private async deliverMessage(message: AgentCommunication): Promise<void> {
    // In a full implementation, this would send the message to the agent's session
    // For now, we log the message delivery
    console.log(
      `Delivering ${message.messageType} message from ${message.fromAgent} to ${message.toAgent}:`,
      message.payload
    );
    
    // Could implement actual message delivery via session manager
    // await this.sessionManager.sendMessageToSession(message.sessionId, message);
  }

  /**
   * Get communication statistics
   */
  getCommunicationStats(): {
    activeAgents: number;
    pendingMessages: number;
    communicationChannels: number;
  } {
    const pendingMessages = Array.from(this.communicationQueues.values())
      .reduce((total, queue) => total + queue.length, 0);
    
    return {
      activeAgents: this.activeAgents.size,
      pendingMessages,
      communicationChannels: this.communicationQueues.size
    };
  }
}