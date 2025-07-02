import { CognitiveCanvas, TaskData } from '../cognitive-canvas';
import { ClaudeClient, TokenUsageStats } from '../claude-client';
import { SessionManager } from '../session';
import { WorkflowManager } from './workflow-manager';

export type OrchestratorStatus = 'idle' | 'initialized' | 'running' | 'error' | 'completed';

export interface ProjectProgress {
  projectId: string;
  totalTasks: number;
  completedTasks: number;
  runningTasks: number;
  pendingTasks: number;
  errorTasks: number;
  pausedTasks: number;
  progressPercentage: number;
}

export interface WorkflowProgress {
  taskId: string;
  currentStep: string;
  completedSteps: string[];
  totalSteps: number;
  stepProgress: number;
}

export interface SessionStatus {
  sessionId: string;
  taskId: string;
  agentType: string;
  status: 'active' | 'idle' | 'error' | 'completed';
  startTime: string;
  lastActivity?: string;
}

export interface SystemHealth {
  orchestratorStatus: OrchestratorStatus;
  activeSessionsCount: number;
  totalTasksInProgress: number;
  budgetUtilization: number;
  errorRate: number;
  lastHealthCheck: string;
}

export class StatusManager {
  private status: OrchestratorStatus = 'idle';
  private running: boolean = false;
  private projectId: string | null = null;
  private lastHealthCheck: Date = new Date();

  constructor(
    private canvas: CognitiveCanvas,
    private client: ClaudeClient,
    private sessionManager: SessionManager,
    private workflowManager: WorkflowManager
  ) {}

  /**
   * Set orchestrator status
   */
  setStatus(status: OrchestratorStatus): void {
    this.status = status;
    console.log(`Orchestrator status changed to: ${status}`);
  }

  /**
   * Get current orchestrator status
   */
  getStatus(): OrchestratorStatus {
    return this.status;
  }

  /**
   * Set running state
   */
  setRunning(running: boolean): void {
    this.running = running;
  }

  /**
   * Get running state
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Set current project ID
   */
  setProjectId(projectId: string): void {
    this.projectId = projectId;
  }

  /**
   * Get current project ID
   */
  getProjectId(): string | null {
    return this.projectId;
  }

  /**
   * Get token usage statistics
   */
  getTokenUsage(): TokenUsageStats {
    return this.client.getTokenUsage();
  }

  /**
   * Check budget limits
   */
  checkBudgetLimit(): boolean {
    const usage = this.client.getTokenUsage();
    const config = this.client.getConfiguration();
    
    if (!config || config.budgetLimit === undefined || config.budgetLimit === Infinity) {
      return true;
    }
    
    return usage.estimatedCost < config.budgetLimit;
  }

  /**
   * Get budget utilization percentage
   */
  getBudgetUtilization(): number {
    const usage = this.client.getTokenUsage();
    const config = this.client.getConfiguration();
    
    if (!config || config.budgetLimit === undefined || config.budgetLimit === Infinity) {
      return 0;
    }
    
    return (usage.estimatedCost / config.budgetLimit) * 100;
  }

  /**
   * Get project progress
   */
  async getProjectProgress(): Promise<ProjectProgress | null> {
    if (!this.projectId) return null;

    try {
      const tasks = await this.canvas.getTasksByProject(this.projectId);
      
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const runningTasks = tasks.filter(t => t.status === 'running').length;
      const pendingTasks = tasks.filter(t => t.status === 'pending').length;
      const errorTasks = tasks.filter(t => t.status === 'error').length;
      const pausedTasks = tasks.filter(t => t.status === 'paused').length;
      
      const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      return {
        projectId: this.projectId,
        totalTasks,
        completedTasks,
        runningTasks,
        pendingTasks,
        errorTasks,
        pausedTasks,
        progressPercentage
      };
    } catch (error) {
      console.error('Error getting project progress:', error);
      return null;
    }
  }

  /**
   * Get workflow progress for all tasks
   */
  async getWorkflowProgress(): Promise<WorkflowProgress[]> {
    if (!this.projectId) return [];

    try {
      const tasks = await this.canvas.getTasksByProject(this.projectId);
      const workflowProgress: WorkflowProgress[] = [];

      for (const task of tasks) {
        const workflowState = this.workflowManager.getTaskWorkflowState(task.id);
        if (workflowState) {
          const totalSteps = 6; // Total workflow steps
          const stepProgress = (workflowState.completedSteps.length / totalSteps) * 100;

          workflowProgress.push({
            taskId: task.id,
            currentStep: workflowState.currentStep,
            completedSteps: workflowState.completedSteps,
            totalSteps,
            stepProgress
          });
        }
      }

      return workflowProgress;
    } catch (error) {
      console.error('Error getting workflow progress:', error);
      return [];
    }
  }

  /**
   * Get session status for all active sessions
   */
  getSessionStatus(): SessionStatus[] {
    try {
      const sessions = this.sessionManager.listSessions();
      
      return sessions.map(session => ({
        sessionId: session.sessionId,
        taskId: session.taskId || 'unknown',
        agentType: 'unknown', // Would need to track this
        status: 'active', // Would need to determine actual status
        startTime: new Date().toISOString(), // Would need to track this
        lastActivity: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error getting session status:', error);
      return [];
    }
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const sessions = this.sessionManager.listSessions();
      const projectProgress = await this.getProjectProgress();
      const budgetUtilization = this.getBudgetUtilization();
      
      // Calculate error rate based on recent tasks
      let errorRate = 0;
      if (this.projectId) {
        const tasks = await this.canvas.getTasksByProject(this.projectId);
        const totalTasks = tasks.length;
        const errorTasks = tasks.filter(t => t.status === 'error').length;
        errorRate = totalTasks > 0 ? (errorTasks / totalTasks) * 100 : 0;
      }

      this.lastHealthCheck = new Date();

      return {
        orchestratorStatus: this.status,
        activeSessionsCount: sessions.length,
        totalTasksInProgress: projectProgress?.runningTasks || 0,
        budgetUtilization,
        errorRate,
        lastHealthCheck: this.lastHealthCheck.toISOString()
      };
    } catch (error) {
      console.error('Error getting system health:', error);
      return {
        orchestratorStatus: 'error',
        activeSessionsCount: 0,
        totalTasksInProgress: 0,
        budgetUtilization: 0,
        errorRate: 100,
        lastHealthCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Check if all tasks are completed
   */
  async areAllTasksCompleted(): Promise<boolean> {
    if (!this.projectId) return false;

    try {
      const tasks = await this.canvas.getTasksByProject(this.projectId);
      const pendingTasks = tasks.filter(t => 
        t.status === 'pending' || t.status === 'running' || t.status === 'impasse'
      );
      
      return pendingTasks.length === 0;
    } catch (error) {
      console.error('Error checking task completion:', error);
      return false;
    }
  }

  /**
   * Get tasks by status
   */
  async getTasksByStatus(status: string): Promise<TaskData[]> {
    if (!this.projectId) return [];

    try {
      const tasks = await this.canvas.getTasksByProject(this.projectId);
      return tasks.filter(t => t.status === status);
    } catch (error) {
      console.error(`Error getting tasks with status ${status}:`, error);
      return [];
    }
  }

  /**
   * Get next available tasks (pending with no unmet dependencies)
   */
  async getNextAvailableTasks(): Promise<TaskData[]> {
    if (!this.projectId) return [];

    try {
      const tasks = await this.canvas.getTasksByProject(this.projectId);
      const availableTasks: TaskData[] = [];

      for (const task of tasks.filter(t => t.status === 'pending')) {
        const dependencies = await this.canvas.getTaskDependencies(task.id);
        const unmetDependencies = dependencies.filter(dep => dep.status !== 'completed');
        
        if (unmetDependencies.length === 0) {
          availableTasks.push(task);
        }
      }

      return availableTasks;
    } catch (error) {
      console.error('Error getting next available tasks:', error);
      return [];
    }
  }

  /**
   * Get detailed status report
   */
  async getDetailedStatusReport(): Promise<any> {
    try {
      const projectProgress = await this.getProjectProgress();
      const workflowProgress = await this.getWorkflowProgress();
      const sessionStatus = this.getSessionStatus();
      const systemHealth = await this.getSystemHealth();
      const tokenUsage = this.getTokenUsage();
      const nextAvailableTasks = await this.getNextAvailableTasks();

      return {
        timestamp: new Date().toISOString(),
        orchestrator: {
          status: this.status,
          running: this.running,
          projectId: this.projectId
        },
        project: projectProgress,
        workflow: workflowProgress,
        sessions: sessionStatus,
        system: systemHealth,
        budget: {
          usage: tokenUsage,
          utilization: this.getBudgetUtilization(),
          withinLimit: this.checkBudgetLimit()
        },
        tasks: {
          nextAvailable: nextAvailableTasks.length,
          details: nextAvailableTasks.slice(0, 5) // Limit to first 5 for brevity
        }
      };
    } catch (error) {
      console.error('Error generating detailed status report:', error);
      return {
        timestamp: new Date().toISOString(),
        error: 'Failed to generate status report',
        message: (error as Error).message
      };
    }
  }

  /**
   * Log status summary
   */
  async logStatusSummary(): Promise<void> {
    try {
      const projectProgress = await this.getProjectProgress();
      const systemHealth = await this.getSystemHealth();
      
      if (projectProgress) {
        console.log(`Project Progress: ${projectProgress.completedTasks}/${projectProgress.totalTasks} completed (${projectProgress.progressPercentage.toFixed(1)}%)`);
        console.log(`Tasks: ${projectProgress.runningTasks} running, ${projectProgress.pendingTasks} pending, ${projectProgress.errorTasks} errors`);
      }
      
      console.log(`System Health: ${systemHealth.activeSessionsCount} active sessions, ${systemHealth.budgetUtilization.toFixed(1)}% budget used`);
      console.log(`Status: ${this.status}, Running: ${this.running}`);
      
    } catch (error) {
      console.error('Error logging status summary:', error);
    }
  }

  /**
   * Reset status manager for new project
   */
  reset(): void {
    this.status = 'idle';
    this.running = false;
    this.projectId = null;
    this.lastHealthCheck = new Date();
    console.log('Status manager reset');
  }
}