import * as fs from 'fs';
import * as path from 'path';
import { CognitiveCanvas, Neo4jConfig, ProjectData, TaskData } from '../cognitive-canvas';
import { PlanParser, ParsedPlan, Feature } from '../plan-parser';
import { ClaudeClient, ClaudeClientConfig, TokenUsageStats } from '../claude-client';
import { WorkspaceManager } from '../workspace';
import { SessionManager } from '../session';
import { CritiqueAgent } from '../agents/critique';
import { DebuggerAgent } from '../agents/debugger';
import { CognitiveCanvasNavigator, NavigationResult } from '../agents/cognitive-canvas-navigator';

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
  neo4j: Neo4jConfig;
  claude: ClaudeClientConfig;
}

// Re-export types for backward compatibility
export { AgentType, WorkflowStep, OrchestratorStatus };

export class Orchestrator {
  // Core dependencies
  private canvas: CognitiveCanvas;
  private parser: PlanParser;
  private client: ClaudeClient;
  private workspace: WorkspaceManager;
  private sessionManager: SessionManager;
  private critiqueAgent: CritiqueAgent;
  private debuggerAgent: DebuggerAgent;
  private cognitiveCanvasNavigator: CognitiveCanvasNavigator;
  
  // Modular components
  private workflowManager: WorkflowManager;
  private taskExecutor: TaskExecutor;
  private agentSpawner: AgentSpawner;
  private errorHandler: ErrorHandler;
  private statusManager: StatusManager;
  
  // State
  private parsedPlan: ParsedPlan | null = null;

  constructor(config: OrchestratorConfig) {
    if (!config.neo4j) {
      throw new Error('Neo4j configuration is required');
    }
    if (!config.claude) {
      throw new Error('Claude configuration is required');
    }

    // Initialize core dependencies
    this.canvas = new CognitiveCanvas(config.neo4j);
    this.parser = new PlanParser();
    this.client = new ClaudeClient(config.claude);
    this.workspace = new WorkspaceManager();
    this.sessionManager = new SessionManager();
    this.critiqueAgent = new CritiqueAgent(this.client, this.canvas);
    this.debuggerAgent = new DebuggerAgent();
    this.cognitiveCanvasNavigator = new CognitiveCanvasNavigator();
    
    // Initialize modular components
    this.workflowManager = new WorkflowManager();
    this.agentSpawner = new AgentSpawner(this.workspace, this.sessionManager);
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
  }

  async initialize(projectPath: string): Promise<void> {
    try {
      console.log('Initializing Orchestrator...');
      
      // Initialize Cognitive Canvas schema
      await this.canvas.initializeSchema();
      
      // Load and parse plan
      const planPath = path.join(projectPath, 'plan.md');
      if (!fs.existsSync(planPath)) {
        throw new Error(`Plan file not found at ${planPath}`);
      }
      
      const planContent = fs.readFileSync(planPath, 'utf-8');
      this.parsedPlan = this.parser.parse(planContent);
      
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
      
      this.statusManager.setStatus('initialized');
      console.log(`Project ${this.parsedPlan.title} initialized successfully`);
      
    } catch (error) {
      this.statusManager.setStatus('error');
      throw new Error(`Failed to initialize orchestrator: ${(error as Error).message}`);
    }
  }

  async start(): Promise<void> {
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

      const tasks = await this.canvas.getTasksByProject(projectId);
      const availableTasks = tasks.filter(task => task.status === 'pending');

      for (const task of availableTasks) {
        const dependencies = await this.canvas.getTaskDependencies(task.id);
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
    await this.canvas.close();
    
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
          cognitiveCanvasConfig: {
            uri: 'bolt://localhost:7687',
            username: 'neo4j', 
            password: 'password'
          }
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

}