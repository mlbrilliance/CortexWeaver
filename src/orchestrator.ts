import * as fs from 'fs';
import * as path from 'path';
import { CognitiveCanvas, Neo4jConfig, ProjectData, TaskData } from './cognitive-canvas';
import { PlanParser, ParsedPlan, Feature } from './plan-parser';
import { ClaudeClient, ClaudeClientConfig, TokenUsageStats } from './claude-client';
import { WorkspaceManager, WorktreeInfo } from './workspace';
import { SessionManager, SessionInfo } from './session';

export interface OrchestratorConfig {
  neo4j: Neo4jConfig;
  claude: ClaudeClientConfig;
}

export type OrchestratorStatus = 'idle' | 'initialized' | 'running' | 'error' | 'completed';
export type AgentType = 'SpecWriter' | 'Formalizer' | 'Architect' | 'Coder' | 'Tester';

export class Orchestrator {
  private canvas: CognitiveCanvas;
  private parser: PlanParser;
  private client: ClaudeClient;
  private workspace: WorkspaceManager;
  private sessionManager: SessionManager;
  
  private projectId: string | null = null;
  private parsedPlan: ParsedPlan | null = null;
  private status: OrchestratorStatus = 'idle';
  private running: boolean = false;
  private taskFeatureMap: Map<string, Feature> = new Map();

  constructor(config: OrchestratorConfig) {
    if (!config.neo4j) {
      throw new Error('Neo4j configuration is required');
    }
    if (!config.claude) {
      throw new Error('Claude configuration is required');
    }

    this.canvas = new CognitiveCanvas(config.neo4j);
    this.parser = new PlanParser();
    this.client = new ClaudeClient(config.claude);
    this.workspace = new WorkspaceManager();
    this.sessionManager = new SessionManager();
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
      this.projectId = project.id;
      
      // Create tasks with dependency ordering
      await this.createTasks();
      
      // Store architectural decisions
      await this.storeArchitecturalDecisions();
      
      this.status = 'initialized';
      console.log(`Project ${this.parsedPlan.title} initialized successfully`);
      
    } catch (error) {
      this.status = 'error';
      throw new Error(`Failed to parse plan: ${(error as Error).message}`);
    }
  }

  async start(): Promise<void> {
    if (!this.projectId || !this.parsedPlan) {
      throw new Error('Project must be initialized before starting');
    }

    this.running = true;
    this.status = 'running';
    console.log('Starting orchestration...');

    try {
      while (this.running) {
        // Check budget before processing
        if (!this.checkBudgetLimit()) {
          console.log('Budget limit reached, stopping orchestration');
          break;
        }

        await this.processNextTask();
        await this.monitorTasks();
        
        // Check if all tasks completed
        const tasks = await this.canvas.getTasksByProject(this.projectId);
        const pendingTasks = tasks.filter(t => 
          t.status === 'pending' || t.status === 'running' || t.status === 'impasse'
        );
        
        if (pendingTasks.length === 0) {
          console.log('All tasks completed!');
          this.status = 'completed';
          break;
        }
        
        // Small delay to prevent busy waiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Orchestration error:', error);
      this.status = 'error';
    } finally {
      this.running = false;
    }
  }

  async processNextTask(): Promise<void> {
    try {
      if (!this.projectId) return;

      const tasks = await this.canvas.getTasksByProject(this.projectId);
      const availableTasks = tasks.filter(task => task.status === 'pending');

      for (const task of availableTasks) {
        const dependencies = await this.canvas.getTaskDependencies(task.id);
        const unmetDependencies = dependencies.filter(dep => dep.status !== 'completed');
        
        if (unmetDependencies.length === 0) {
          const feature = this.taskFeatureMap.get(task.id);
          if (feature) {
            await this.spawnAgent(task, feature.agent);
            break; // Process one task at a time
          }
        }
      }
    } catch (error) {
      console.error('Error processing next task:', error);
    }
  }

  async spawnAgent(task: TaskData, agentType: AgentType): Promise<void> {
    try {
      console.log(`Spawning ${agentType} agent for task: ${task.title}`);
      
      // Create worktree for isolated work
      const branchName = `feature/${task.id}`;
      const worktree = await this.workspace.createWorktree(task.id, branchName, 'main');
      
      try {
        // Create session for agent
        const session = await this.sessionManager.createSession(task.id, worktree.path);
        
        // Generate agent prompt
        const prompt = this.generateAgentPrompt(task, agentType);
        
        // Start agent in session with required flags
        await this.sessionManager.startAgentInSession(
          session.sessionId,
          'claude-code',
          prompt
        );
        
        console.log(`${agentType} agent started for task ${task.id}`);
        
      } catch (sessionError) {
        // Cleanup worktree on session failure
        await this.workspace.removeWorktree(task.id);
        throw sessionError;
      }
      
    } catch (error) {
      throw new Error(`Failed to spawn agent for task ${task.id}: ${(error as Error).message}`);
    }
  }

  async handleImpasse(taskId: string): Promise<void> {
    try {
      console.log(`Handling impasse for task: ${taskId}`);
      
      // Get context from original agent's session
      const originalSessionId = `cortex-${taskId}-*`;
      const sessionOutput = await this.sessionManager.getSessionOutput(originalSessionId);
      
      // Create CodeSavant helper session
      const codeSavantTaskId = `codesavant-${taskId}`;
      const branchName = `helper/${codeSavantTaskId}`;
      
      // Create worktree for CodeSavant
      const worktree = await this.workspace.createWorktree(
        codeSavantTaskId,
        branchName,
        'main'
      );
      
      // Create session for CodeSavant
      const session = await this.sessionManager.createSession(
        codeSavantTaskId,
        worktree.path
      );
      
      // Generate specialized CodeSavant prompt
      const prompt = this.generateCodeSavantPrompt(taskId, sessionOutput);
      
      // Start CodeSavant with analysis focus
      await this.sessionManager.startAgentInSession(
        session.sessionId,
        'claude-code',
        prompt
      );
      
      console.log(`CodeSavant helper spawned for task ${taskId}`);
      
    } catch (error) {
      console.error(`Failed to spawn CodeSavant for task ${taskId}:`, error);
    }
  }

  async monitorTasks(): Promise<void> {
    try {
      if (!this.projectId) return;

      const tasks = await this.canvas.getTasksByProject(this.projectId);
      
      for (const task of tasks) {
        switch (task.status) {
          case 'completed':
            await this.handleTaskCompletion(task.id);
            break;
          case 'impasse':
            await this.handleImpasse(task.id);
            break;
          case 'error':
            console.error(`Task ${task.id} encountered an error`);
            break;
        }
      }
    } catch (error) {
      console.error('Task monitoring error:', error);
    }
  }

  async handleTaskCompletion(taskId: string): Promise<void> {
    try {
      console.log(`Handling completion for task: ${taskId}`);
      
      // Check worktree status
      const status = await this.workspace.getWorktreeStatus(taskId);
      
      if (!status.clean) {
        // Commit changes
        const task = this.taskFeatureMap.get(taskId);
        const commitMessage = `Complete task: ${task?.name || taskId}`;
        await this.workspace.commitChanges(taskId, commitMessage);
      }
      
      // Cleanup session
      const sessions = this.sessionManager.listSessions();
      const taskSessions = sessions.filter(s => s.taskId === taskId);
      
      for (const session of taskSessions) {
        await this.sessionManager.killSession(session.sessionId);
      }
      
      // Remove worktree
      await this.workspace.removeWorktree(taskId);
      
      console.log(`Task ${taskId} completed and cleaned up`);
      
    } catch (error) {
      console.error(`Error handling task completion for ${taskId}:`, error);
    }
  }

  checkBudgetLimit(): boolean {
    const usage = this.client.getTokenUsage();
    const config = this.client.getConfiguration();
    
    if (!config || config.budgetLimit === undefined || config.budgetLimit === Infinity) {
      return true;
    }
    
    return usage.estimatedCost < config.budgetLimit;
  }

  getTokenUsage(): TokenUsageStats {
    return this.client.getTokenUsage();
  }

  getStatus(): OrchestratorStatus {
    return this.status;
  }

  isRunning(): boolean {
    return this.running;
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down Orchestrator...');
    this.running = false;
    
    // Kill all active sessions
    const sessions = this.sessionManager.listSessions();
    for (const session of sessions) {
      await this.sessionManager.killSession(session.sessionId);
    }
    
    // Close database connection
    await this.canvas.close();
    
    console.log('Orchestrator shutdown complete');
  }

  private async createTasks(): Promise<void> {
    if (!this.parsedPlan || !this.projectId) return;

    // Get dependency-ordered features
    const orderedFeatures = this.parser.getDependencyOrder(this.parsedPlan.features);
    const taskIdMap = new Map<string, string>();

    // Create tasks
    for (const feature of orderedFeatures) {
      const taskData: TaskData = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: feature.name,
        description: feature.description,
        status: 'pending',
        priority: feature.priority,
        projectId: this.projectId,
        createdAt: new Date().toISOString()
      };

      const createdTask = await this.canvas.createTask(taskData);
      this.taskFeatureMap.set(createdTask.id, feature);
      taskIdMap.set(feature.name, createdTask.id);
    }

    // Create dependencies
    for (const feature of this.parsedPlan.features) {
      const taskId = taskIdMap.get(feature.name);
      if (!taskId) continue;

      for (const depName of feature.dependencies) {
        const depTaskId = taskIdMap.get(depName);
        if (depTaskId) {
          await this.canvas.createTaskDependency(taskId, depTaskId);
        }
      }
    }
  }

  private async storeArchitecturalDecisions(): Promise<void> {
    if (!this.parsedPlan || !this.projectId) return;

    const decisions = this.parsedPlan.architectureDecisions;

    // Store technology stack decisions
    if (Object.keys(decisions.technologyStack).length > 0) {
      const techStackDescription = Object.entries(decisions.technologyStack)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');

      await this.canvas.storeArchitecturalDecision({
        id: `decision-tech-stack-${Date.now()}`,
        title: 'Technology Stack',
        description: techStackDescription,
        rationale: 'Technology choices for the project',
        status: 'approved',
        projectId: this.projectId,
        createdAt: new Date().toISOString()
      });
    }

    // Store quality standards
    if (Object.keys(decisions.qualityStandards).length > 0) {
      const qualityDescription = Object.entries(decisions.qualityStandards)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');

      await this.canvas.storeArchitecturalDecision({
        id: `decision-quality-${Date.now()}`,
        title: 'Quality Standards',
        description: qualityDescription,
        rationale: 'Quality requirements for the project',
        status: 'approved',
        projectId: this.projectId,
        createdAt: new Date().toISOString()
      });
    }
  }

  private generateAgentPrompt(task: TaskData, agentType: AgentType): string {
    const basePrompt = `You are ${agentType === 'Architect' ? 'an' : 'a'} ${agentType} agent in the CortexWeaver swarm intelligence system.

TASK: ${task.title}
DESCRIPTION: ${task.description}
PRIORITY: ${task.priority}

Your role as a ${agentType} agent:`;

    switch (agentType) {
      case 'SpecWriter':
        return `${basePrompt}
- Create comprehensive BDD specifications and feature files
- Write user stories and acceptance criteria
- Generate Gherkin scenarios for behavior-driven development
- Document functional and non-functional requirements
- Ensure specifications are testable and clear

Focus on creating clear, comprehensive specifications that will guide the development process.
Create .feature files, user stories, and detailed acceptance criteria.
Use the -p --dangerously-skip-permissions flags as needed for file operations.`;

      case 'Formalizer':
        return `${basePrompt}
- Transform BDD specifications into formal contracts
- Create mathematical and logical representations of requirements
- Generate contract-based specifications for interfaces
- Define invariants, preconditions, and postconditions
- Ensure contracts are verifiable and implementable

Focus on creating formal contracts from the BDD specifications created by the SpecWriter.
Review .feature files and transform them into formal mathematical contracts.
Use the -p --dangerously-skip-permissions flags as needed for file operations.`;

      case 'Architect':
        return `${basePrompt}
- Design system architecture and technical specifications
- Make technology decisions and document rationale
- Define interfaces and communication patterns
- Ensure scalability and maintainability
- Create architectural documentation
- Use formal contracts as input for architectural decisions

Focus on high-level design and architectural decisions for this task.
Review and incorporate formal contracts created by the Formalizer agent.
Use the -p --dangerously-skip-permissions flags as needed for file operations.`;

      case 'Coder':
        return `${basePrompt}
- Implement features according to specifications and formal contracts
- Write clean, maintainable, and tested code
- Follow established patterns and conventions
- Handle error cases and edge conditions
- Ensure code quality and performance
- Implement contract verification where applicable

Focus on implementing the functionality described in the task.
Use formal contracts and architectural designs as implementation guides.
Use the -p --dangerously-skip-permissions flags as needed for file operations.`;

      case 'Tester':
        return `${basePrompt}
- Create comprehensive test suites
- Verify functionality meets requirements and contracts
- Test edge cases and error conditions
- Ensure code coverage and quality
- Document testing strategies
- Validate contract compliance

Focus on testing the implementation for this task.
Use formal contracts and BDD specifications to guide test creation.
Use the -p --dangerously-skip-permissions flags as needed for file operations.`;

      default:
        return basePrompt;
    }
  }

  private generateCodeSavantPrompt(taskId: string, originalContext: string): string {
    return `You are CodeSavant, a specialized helper agent in the CortexWeaver system.

SITUATION: The primary agent working on task ${taskId} has encountered an impasse and needs assistance.

ORIGINAL AGENT CONTEXT:
${originalContext}

YOUR ROLE AS CODESAVANT:
- Provide a fresh perspective and second opinion on the problem
- Analyze the issue from different angles
- Suggest alternative approaches or solutions
- Identify potential blockers or missing information
- Offer specialized knowledge and debugging assistance
- Help break down complex problems into manageable steps

APPROACH:
1. Analyze the original agent's work and the point of failure
2. Research alternative solutions and best practices
3. Provide specific, actionable recommendations
4. If needed, implement proof-of-concept solutions
5. Document your analysis and recommendations clearly

Focus on unblocking the original agent by providing insights, alternative approaches, or solutions they may not have considered.
Use the -p --dangerously-skip-permissions flags as needed for file operations.

Remember: Your goal is to help resolve the impasse and get the task back on track.`;
  }
}