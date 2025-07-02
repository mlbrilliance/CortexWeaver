import { CognitiveCanvas, TaskData } from '../cognitive-canvas';
import { WorkspaceManager, WorktreeInfo } from '../workspace';
import { SessionManager, SessionInfo } from '../session';
import { WorkflowManager, AgentType, WorkflowStep } from './workflow-manager';
import { Feature } from '../plan-parser';

export interface TaskExecutionResult {
  success: boolean;
  taskId: string;
  error?: string;
  worktree?: WorktreeInfo;
  session?: SessionInfo;
}

export interface TaskExecutionContext {
  workflowStep?: WorkflowStep;
  relevantArtifacts?: any[];
  patterns?: any[];
  relationships?: any[];
  paths?: any[];
  priming?: {
    stepSpecificGuidance?: string;
    requiredInputs?: string[];
    expectedOutputs?: string[];
  };
}

export class TaskExecutor {
  constructor(
    private canvas: CognitiveCanvas,
    private workspace: WorkspaceManager,
    private sessionManager: SessionManager,
    private workflowManager: WorkflowManager
  ) {}

  /**
   * Process next available task
   */
  async processNextTask(projectId: string): Promise<void> {
    try {
      const tasks = await this.canvas.getTasksByProject(projectId);
      const availableTasks = tasks.filter(task => task.status === 'pending');

      for (const task of availableTasks) {
        const dependencies = await this.canvas.getTaskDependencies(task.id);
        const unmetDependencies = dependencies.filter(dep => dep.status !== 'completed');
        
        if (unmetDependencies.length === 0) {
          const agentType = this.workflowManager.getAgentTypeForCurrentStep(task.id);
          if (agentType) {
            await this.executeTask(task, agentType);
            break; // Process one task at a time
          }
        }
      }
    } catch (error) {
      console.error('Error processing next task:', error);
    }
  }

  /**
   * Execute a specific task with given agent type
   */
  async executeTask(task: TaskData, agentType: AgentType, context?: TaskExecutionContext): Promise<TaskExecutionResult> {
    try {
      console.log(`Executing task: ${task.title} with ${agentType} agent`);
      
      // Create worktree for isolated work
      const branchName = `feature/${task.id}`;
      const worktree = await this.workspace.createWorktree(task.id, branchName, 'main');
      
      try {
        // Create session for agent
        const session = await this.sessionManager.createSession(task.id, worktree.path);
        
        // Generate agent prompt with context
        const prompt = this.generateAgentPrompt(task, agentType, context);
        
        // Start agent in session
        await this.sessionManager.startAgentInSession(
          session.sessionId,
          'claude-code',
          prompt
        );
        
        // Update task status to running
        await this.canvas.updateTaskStatus(task.id, 'running');
        
        console.log(`${agentType} agent started for task ${task.id}`);
        
        return {
          success: true,
          taskId: task.id,
          worktree,
          session
        };
        
      } catch (sessionError) {
        // Cleanup worktree on session failure
        await this.workspace.removeWorktree(task.id);
        throw sessionError;
      }
      
    } catch (error) {
      const errorMessage = `Failed to execute task ${task.id}: ${(error as Error).message}`;
      console.error(errorMessage);
      
      return {
        success: false,
        taskId: task.id,
        error: errorMessage
      };
    }
  }

  /**
   * Handle task completion
   */
  async handleTaskCompletion(taskId: string): Promise<void> {
    try {
      console.log(`Handling completion for task: ${taskId}`);
      
      // Check worktree status
      const status = await this.workspace.getWorktreeStatus(taskId);
      
      if (!status.clean) {
        // Commit changes
        const commitMessage = `Complete task: ${taskId}`;
        await this.workspace.commitChanges(taskId, commitMessage);
      }
      
      // Advance workflow step
      const advanced = this.workflowManager.advanceToNextStep(taskId);
      if (advanced) {
        // Reset task status to pending for next workflow step
        await this.canvas.updateTaskStatus(taskId, 'pending');
        console.log(`Task ${taskId} ready for next workflow step`);
      } else {
        // Task is fully completed
        await this.canvas.updateTaskStatus(taskId, 'completed');
        console.log(`Task ${taskId} fully completed`);
      }
      
      // Cleanup session
      const sessions = this.sessionManager.listSessions();
      const taskSessions = sessions.filter(s => s.taskId === taskId);
      
      for (const session of taskSessions) {
        await this.sessionManager.killSession(session.sessionId);
      }
      
      // Remove worktree if task is fully completed
      if (!this.workflowManager.advanceToNextStep(taskId)) {
        await this.workspace.removeWorktree(taskId);
      }
      
    } catch (error) {
      console.error(`Error handling task completion for ${taskId}:`, error);
    }
  }

  /**
   * Process task with workflow awareness
   */
  async processTaskWithWorkflow(task: TaskData): Promise<void> {
    const workflowState = this.workflowManager.getTaskWorkflowState(task.id);
    if (!workflowState) {
      console.warn(`No workflow state found for task ${task.id}, using fallback`);
      return;
    }

    const stepConfig = this.workflowManager.getWorkflowStepConfig(workflowState.currentStep);
    if (!stepConfig) {
      console.warn(`No step config found for step ${workflowState.currentStep}`);
      return;
    }

    console.log(`Processing task ${task.id} at workflow step ${workflowState.currentStep}`);

    try {
      await this.executeTask(task, stepConfig.agentType);
      
    } catch (error) {
      console.error(`Error in workflow step ${workflowState.currentStep} for task ${task.id}:`, error);
      
      if (stepConfig.errorRecoveryEnabled) {
        await this.handleTaskFailure(task.id, {
          id: `error-${Date.now()}`,
          type: 'workflow_step_error',
          severity: 'medium',
          errorMessage: (error as Error).message,
          step: workflowState.currentStep
        });
      }
    }
  }

  /**
   * Handle task failure
   */
  async handleTaskFailure(taskId: string, failure: any): Promise<void> {
    try {
      console.log(`Handling task failure for task: ${taskId}`);
      console.log(`Failure details:`, failure);
      
      // Update task status to error
      await this.canvas.updateTaskStatus(taskId, 'error');
      
      // Create failure record in canvas
      await this.canvas.createPheromone({
        id: `failure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'failure_pheromone',
        context: `task_failure_${failure.type}`,
        strength: failure.severity === 'critical' ? 0.9 : 0.7,
        metadata: {
          taskId,
          failure,
          timestamp: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Expires in 7 days
      });
      
    } catch (error) {
      console.error(`Error handling task failure for ${taskId}:`, error);
    }
  }

  /**
   * Monitor task execution
   */
  async monitorTasks(projectId: string): Promise<void> {
    try {
      const tasks = await this.canvas.getTasksByProject(projectId);
      
      for (const task of tasks) {
        switch (task.status) {
          case 'completed':
            await this.handleTaskCompletion(task.id);
            break;
          case 'impasse':
            // This will be handled by error handler
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

  /**
   * Generate agent prompt with context
   */
  private generateAgentPrompt(task: TaskData, agentType: AgentType, context?: TaskExecutionContext): string {
    const basePrompt = `You are ${agentType === 'Architect' ? 'an' : 'a'} ${agentType} agent in the CortexWeaver swarm intelligence system.

TASK: ${task.title}
DESCRIPTION: ${task.description}
PRIORITY: ${task.priority}

${context ? this.formatContextData(context) : ''}

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

      case 'Prototyper':
        return `${basePrompt}
- PROTOTYPE_LOGIC workflow step - This is the critical step between contract formalization and architecture design
- Create prototype implementations based on formal contracts
- Generate working proof-of-concept code that demonstrates key concepts
- Validate contract feasibility through executable prototypes
- Test logical consistency and identify implementation challenges early
- Document prototype design decisions and limitations
- Ensure prototypes align with formal specifications
- Bridge the gap between theoretical contracts and practical architecture

Focus on creating working prototypes that validate the formal contracts and inform architectural decisions.
This prototype logic step helps identify potential issues before full architectural design.
Use formal contracts as blueprints for prototype implementation.
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

  /**
   * Format context data for agent prompt
   */
  private formatContextData(context: TaskExecutionContext): string {
    let contextText = '';

    if (context.workflowStep) {
      contextText += `WORKFLOW CONTEXT:\n`;
      contextText += `Current Step: ${context.workflowStep}\n`;
      if (context.priming?.stepSpecificGuidance) {
        contextText += `Guidance: ${context.priming.stepSpecificGuidance}\n`;
      }
      contextText += '\n';
    }

    if (context.priming?.requiredInputs && context.priming.requiredInputs.length > 0) {
      contextText += 'REQUIRED INPUTS FOR THIS STEP:\n';
      context.priming.requiredInputs.forEach((input: string, index: number) => {
        contextText += `${index + 1}. ${input}\n`;
      });
      contextText += '\n';
    }

    if (context.priming?.expectedOutputs && context.priming.expectedOutputs.length > 0) {
      contextText += 'EXPECTED OUTPUTS FOR THIS STEP:\n';
      context.priming.expectedOutputs.forEach((output: string, index: number) => {
        contextText += `${index + 1}. ${output}\n`;
      });
      contextText += '\n';
    }

    if (context.relevantArtifacts && context.relevantArtifacts.length > 0) {
      contextText += 'STEP-RELEVANT ARTIFACTS:\n';
      context.relevantArtifacts.forEach((artifact: any, index: number) => {
        const stepRelevance = artifact.stepRelevance ? ` (step relevance: ${artifact.stepRelevance.toFixed(2)})` : '';
        const generalRelevance = artifact.relevanceScore ? ` (general relevance: ${artifact.relevanceScore.toFixed(2)})` : '';
        contextText += `${index + 1}. ${artifact.name}${stepRelevance}${generalRelevance}\n`;
        
        if (artifact.properties && Object.keys(artifact.properties).length > 0) {
          const properties = Object.entries(artifact.properties)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
          contextText += `   Properties: ${properties}\n`;
        }
      });
      contextText += '\n';
    }

    return contextText;
  }
}