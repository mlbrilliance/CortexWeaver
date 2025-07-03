import { TaskData } from '../cognitive-canvas';
import { Feature } from '../plan-parser';

export type WorkflowStep = 
  | 'DEFINE_REQUIREMENTS' 
  | 'FORMALIZE_CONTRACTS' 
  | 'PROTOTYPE_LOGIC'
  | 'DESIGN_ARCHITECTURE'
  | 'IMPLEMENT_CODE'
  | 'EXECUTE_TESTS';

export type AgentType = 
  | 'SpecWriter' 
  | 'Formalizer' 
  | 'Prototyper' 
  | 'Architect' 
  | 'Coder' 
  | 'Tester'
  | 'Reflector'
  | 'Monitor' 
  | 'Guide'
  | 'Navigator'
  | 'ChicagoTester'
  | 'LondonTester'
  | 'PropertyTester'
  | 'MutationTester'
  | 'Debugger'
  | 'Governor'
  | 'Critique'
  | 'KnowledgeUpdater'
  | 'PerformanceOptimizer'
  | 'QualityGatekeeper'
  | 'TestResultDocumenter';

export interface WorkflowStepConfig {
  step: WorkflowStep;
  agentType: AgentType;
  requiredPreviousSteps: WorkflowStep[];
  critiqueRequired: boolean;
  errorRecoveryEnabled: boolean;
}

export interface TaskWorkflowState {
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
}

export class WorkflowManager {
  private workflowStepMap: Map<WorkflowStep, WorkflowStepConfig> = new Map();
  private taskWorkflowState: Map<string, TaskWorkflowState> = new Map();
  private taskFeatureMap: Map<string, Feature> = new Map();

  constructor() {
    this.initializeWorkflowSteps();
  }

  /**
   * Initialize workflow step configurations
   */
  private initializeWorkflowSteps(): void {
    const workflowSteps: WorkflowStepConfig[] = [
      {
        step: 'DEFINE_REQUIREMENTS',
        agentType: 'SpecWriter',
        requiredPreviousSteps: [],
        critiqueRequired: true,
        errorRecoveryEnabled: true
      },
      {
        step: 'FORMALIZE_CONTRACTS',
        agentType: 'Formalizer',
        requiredPreviousSteps: ['DEFINE_REQUIREMENTS'],
        critiqueRequired: true,
        errorRecoveryEnabled: true
      },
      {
        step: 'PROTOTYPE_LOGIC',
        agentType: 'Prototyper',
        requiredPreviousSteps: ['FORMALIZE_CONTRACTS'],
        critiqueRequired: true,
        errorRecoveryEnabled: true
      },
      {
        step: 'DESIGN_ARCHITECTURE',
        agentType: 'Architect',
        requiredPreviousSteps: ['PROTOTYPE_LOGIC'],
        critiqueRequired: true,
        errorRecoveryEnabled: true
      },
      {
        step: 'IMPLEMENT_CODE',
        agentType: 'Coder',
        requiredPreviousSteps: ['DESIGN_ARCHITECTURE'],
        critiqueRequired: false,
        errorRecoveryEnabled: true
      },
      {
        step: 'EXECUTE_TESTS',
        agentType: 'Tester',
        requiredPreviousSteps: ['IMPLEMENT_CODE'],
        critiqueRequired: false,
        errorRecoveryEnabled: true
      }
    ];

    workflowSteps.forEach(config => {
      this.workflowStepMap.set(config.step, config);
    });
  }

  /**
   * Initialize workflow states for all tasks
   */
  async initializeTaskWorkflowStates(tasks: TaskData[]): Promise<void> {
    for (const task of tasks) {
      try {
        let feature = this.taskFeatureMap.get(task.id);
        
        // If no feature mapping exists, create a default one based on task
        if (!feature) {
          feature = this.createDefaultFeatureFromTask(task);
          this.taskFeatureMap.set(task.id, feature);
        }
        
        const initialStep = this.determineInitialWorkflowStep(feature.agent);
        this.taskWorkflowState.set(task.id, {
          currentStep: initialStep,
          completedSteps: []
        });
        
        console.log(`Initialized workflow state for task ${task.id}: ${initialStep}`);
      } catch (error) {
        console.error(`Failed to initialize workflow state for task ${task.id}:`, error);
        // Set default state on error
        this.taskWorkflowState.set(task.id, {
          currentStep: 'DEFINE_REQUIREMENTS',
          completedSteps: []
        });
      }
    }
  }

  /**
   * Create a default feature from task data when no explicit mapping exists
   */
  private createDefaultFeatureFromTask(task: TaskData): Feature {
    // Determine agent type based on task title/description
    let agentType: AgentType = 'Coder'; // Default fallback
    
    const title = task.title.toLowerCase();
    const description = task.description?.toLowerCase() || '';
    
    if (title.includes('test') || description.includes('test')) {
      agentType = 'Tester';
    } else if (title.includes('design') || title.includes('architecture') || description.includes('architecture')) {
      agentType = 'Architect';
    } else if (title.includes('spec') || title.includes('requirement') || description.includes('specification')) {
      agentType = 'SpecWriter';
    } else if (title.includes('contract') || title.includes('schema') || description.includes('contract')) {
      agentType = 'Formalizer';
    } else if (title.includes('prototype') || description.includes('prototype')) {
      agentType = 'Prototyper';
    }
    
    return {
      name: task.title,
      description: task.description || task.title,
      priority: (task.priority as any) || 'Medium',
      agent: agentType,
      dependencies: [],
      acceptanceCriteria: [`Complete ${task.title}`],
      microtasks: [
        `Analyze requirements for ${task.title}`,
        `Implement core functionality`,
        `Add comprehensive tests`,
        `Document implementation`
      ]
    };
  }

  /**
   * Set task-feature mapping
   */
  setTaskFeatureMapping(taskId: string, feature: Feature): void {
    this.taskFeatureMap.set(taskId, feature);
  }

  /**
   * Get workflow step configuration
   */
  getWorkflowStepConfig(step: WorkflowStep): WorkflowStepConfig | undefined {
    return this.workflowStepMap.get(step);
  }

  /**
   * Get task workflow state
   */
  getTaskWorkflowState(taskId: string): TaskWorkflowState | undefined {
    return this.taskWorkflowState.get(taskId);
  }

  /**
   * Update task workflow state
   */
  updateTaskWorkflowState(taskId: string, state: TaskWorkflowState): void {
    this.taskWorkflowState.set(taskId, state);
  }

  /**
   * Check if task is ready for current workflow step
   */
  checkWorkflowStepReadiness(taskId: string): boolean {
    const workflowState = this.taskWorkflowState.get(taskId);
    if (!workflowState) return false;

    const stepConfig = this.workflowStepMap.get(workflowState.currentStep);
    if (!stepConfig) return false;

    // Check if all required previous steps are completed
    for (const requiredStep of stepConfig.requiredPreviousSteps) {
      if (!workflowState.completedSteps.includes(requiredStep)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Advance task to next workflow step
   */
  advanceToNextStep(taskId: string): boolean {
    const workflowState = this.taskWorkflowState.get(taskId);
    if (!workflowState) return false;

    // Mark current step as completed
    workflowState.completedSteps.push(workflowState.currentStep);
    
    // Get next step
    const nextStep = this.getNextWorkflowStep(workflowState.currentStep);
    if (nextStep) {
      workflowState.currentStep = nextStep;
      console.log(`Task ${taskId} advanced to workflow step ${nextStep}`);
      return true;
    }
    
    return false;
  }

  /**
   * Get next workflow step in sequence
   */
  private getNextWorkflowStep(currentStep: WorkflowStep): WorkflowStep | null {
    const stepOrder: WorkflowStep[] = [
      'DEFINE_REQUIREMENTS',
      'FORMALIZE_CONTRACTS',
      'PROTOTYPE_LOGIC',
      'DESIGN_ARCHITECTURE',
      'IMPLEMENT_CODE',
      'EXECUTE_TESTS'
    ];

    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex >= 0 && currentIndex < stepOrder.length - 1) {
      return stepOrder[currentIndex + 1];
    }
    return null;
  }

  /**
   * Determine initial workflow step for agent type
   */
  private determineInitialWorkflowStep(agentType: AgentType): WorkflowStep {
    const agentStepMap: Record<AgentType, WorkflowStep> = {
      'SpecWriter': 'DEFINE_REQUIREMENTS',
      'Formalizer': 'FORMALIZE_CONTRACTS',
      'Prototyper': 'PROTOTYPE_LOGIC',
      'Architect': 'DESIGN_ARCHITECTURE',
      'Coder': 'IMPLEMENT_CODE',
      'Tester': 'EXECUTE_TESTS',
      // Default mappings for other agent types
      'Reflector': 'DEFINE_REQUIREMENTS',
      'Monitor': 'DEFINE_REQUIREMENTS',
      'Guide': 'DEFINE_REQUIREMENTS',
      'Navigator': 'DEFINE_REQUIREMENTS',
      'ChicagoTester': 'EXECUTE_TESTS',
      'LondonTester': 'EXECUTE_TESTS',
      'PropertyTester': 'EXECUTE_TESTS',
      'MutationTester': 'EXECUTE_TESTS',
      'Debugger': 'DEFINE_REQUIREMENTS',
      'Governor': 'DEFINE_REQUIREMENTS',
      'Critique': 'DEFINE_REQUIREMENTS',
      'KnowledgeUpdater': 'DEFINE_REQUIREMENTS',
      'PerformanceOptimizer': 'IMPLEMENT_CODE',
      'QualityGatekeeper': 'EXECUTE_TESTS',
      'TestResultDocumenter': 'EXECUTE_TESTS'
    };

    return agentStepMap[agentType] || 'DEFINE_REQUIREMENTS';
  }

  /**
   * Check if critique is required for current step
   */
  isCritiqueRequired(taskId: string): boolean {
    const workflowState = this.taskWorkflowState.get(taskId);
    if (!workflowState) return false;

    const stepConfig = this.workflowStepMap.get(workflowState.currentStep);
    return stepConfig?.critiqueRequired || false;
  }

  /**
   * Check if error recovery is enabled for current step
   */
  isErrorRecoveryEnabled(taskId: string): boolean {
    const workflowState = this.taskWorkflowState.get(taskId);
    if (!workflowState) return false;

    const stepConfig = this.workflowStepMap.get(workflowState.currentStep);
    return stepConfig?.errorRecoveryEnabled || false;
  }

  /**
   * Get agent type for current workflow step
   */
  getAgentTypeForCurrentStep(taskId: string): AgentType | null {
    const workflowState = this.taskWorkflowState.get(taskId);
    if (!workflowState) return null;

    const stepConfig = this.workflowStepMap.get(workflowState.currentStep);
    return stepConfig?.agentType || null;
  }

  /**
   * Get workflow step guidance
   */
  getStepSpecificGuidance(step: WorkflowStep): string {
    const guidance: Record<WorkflowStep, string> = {
      'DEFINE_REQUIREMENTS': 'Focus on capturing clear, testable requirements and user stories with acceptance criteria.',
      'FORMALIZE_CONTRACTS': 'Transform requirements into formal contracts with preconditions, postconditions, and invariants.',
      'PROTOTYPE_LOGIC': 'Create working prototypes that validate contract feasibility and identify implementation challenges.',
      'DESIGN_ARCHITECTURE': 'Design system architecture based on validated prototypes and formal contracts.',
      'IMPLEMENT_CODE': 'Implement features according to architectural designs and formal specifications.',
      'EXECUTE_TESTS': 'Create comprehensive test suites that verify contract compliance and functionality.'
    };

    return guidance[step] || 'Follow standard development practices for this task.';
  }

  /**
   * Get required inputs for workflow step
   */
  getRequiredInputsForStep(step: WorkflowStep): string[] {
    const inputs: Record<WorkflowStep, string[]> = {
      'DEFINE_REQUIREMENTS': ['stakeholder needs', 'user personas', 'business goals'],
      'FORMALIZE_CONTRACTS': ['BDD specifications', 'acceptance criteria', 'domain model'],
      'PROTOTYPE_LOGIC': ['formal contracts', 'key interfaces', 'validation scenarios'],
      'DESIGN_ARCHITECTURE': ['validated prototypes', 'contract interfaces', 'quality requirements'],
      'IMPLEMENT_CODE': ['architectural design', 'interface specifications', 'design patterns'],
      'EXECUTE_TESTS': ['implemented code', 'acceptance criteria', 'performance requirements']
    };

    return inputs[step] || [];
  }

  /**
   * Get expected outputs for workflow step
   */
  getExpectedOutputsForStep(step: WorkflowStep): string[] {
    const outputs: Record<WorkflowStep, string[]> = {
      'DEFINE_REQUIREMENTS': ['.feature files', 'user stories', 'acceptance criteria', 'requirements documentation'],
      'FORMALIZE_CONTRACTS': ['interface contracts', 'formal specifications', 'validation rules'],
      'PROTOTYPE_LOGIC': ['working prototypes', 'validation results', 'feasibility assessment'],
      'DESIGN_ARCHITECTURE': ['architectural diagrams', 'component specifications', 'design documentation'],
      'IMPLEMENT_CODE': ['production code', 'unit tests', 'API documentation'],
      'EXECUTE_TESTS': ['test suites', 'test reports', 'coverage analysis', 'quality metrics']
    };

    return outputs[step] || [];
  }

  /**
   * Enhance query for workflow step context
   */
  enhanceQueryForWorkflowStep(baseQuery: string, step: WorkflowStep): string {
    const stepKeywords: Record<WorkflowStep, string[]> = {
      'DEFINE_REQUIREMENTS': ['requirements', 'specifications', 'user stories', 'acceptance criteria'],
      'FORMALIZE_CONTRACTS': ['contracts', 'interfaces', 'preconditions', 'postconditions', 'invariants'],
      'PROTOTYPE_LOGIC': ['prototype', 'proof of concept', 'validation', 'logic', 'implementation'],
      'DESIGN_ARCHITECTURE': ['architecture', 'design', 'patterns', 'structure', 'components'],
      'IMPLEMENT_CODE': ['implementation', 'code', 'functions', 'classes', 'modules'],
      'EXECUTE_TESTS': ['tests', 'testing', 'validation', 'verification', 'quality assurance']
    };

    const keywords = stepKeywords[step] || [];
    return `${baseQuery} ${keywords.join(' ')}`;
  }

  /**
   * Get targeted node types for workflow step
   */
  getTargetedNodeTypes(step: WorkflowStep): string {
    const nodeTypeMap: Record<WorkflowStep, string> = {
      'DEFINE_REQUIREMENTS': 'requirement',
      'FORMALIZE_CONTRACTS': 'contract',
      'PROTOTYPE_LOGIC': 'prototype',
      'DESIGN_ARCHITECTURE': 'architecture',
      'IMPLEMENT_CODE': 'code',
      'EXECUTE_TESTS': 'test'
    };

    return nodeTypeMap[step] || 'artifact';
  }

  /**
   * Get relevant properties for workflow step
   */
  getRelevantProperties(step: WorkflowStep): string[] {
    const propertyMap: Record<WorkflowStep, string[]> = {
      'DEFINE_REQUIREMENTS': ['title', 'description', 'acceptanceCriteria', 'priority'],
      'FORMALIZE_CONTRACTS': ['interface', 'preconditions', 'postconditions', 'invariants'],
      'PROTOTYPE_LOGIC': ['implementation', 'validation', 'testResults'],
      'DESIGN_ARCHITECTURE': ['components', 'patterns', 'dependencies', 'interfaces'],
      'IMPLEMENT_CODE': ['functions', 'classes', 'modules', 'dependencies'],
      'EXECUTE_TESTS': ['testCases', 'coverage', 'results', 'performance']
    };

    return propertyMap[step] || ['name', 'description', 'type'];
  }

  /**
   * Mark task for retry after error
   */
  async markTaskForRetry(taskId: string, step?: string): Promise<void> {
    const workflowState = this.taskWorkflowState.get(taskId);
    if (workflowState) {
      console.log(`Marking task ${taskId} for retry at step ${step || workflowState.currentStep}`);
      // Update task state to indicate retry is needed
      // The actual retry logic will be handled by the orchestrator
    }
  }

  /**
   * Skip current step in workflow
   */
  async skipCurrentStep(taskId: string, reason: string): Promise<void> {
    const workflowState = this.taskWorkflowState.get(taskId);
    if (workflowState) {
      console.log(`Skipping step ${workflowState.currentStep} for task ${taskId}: ${reason}`);
      
      // Mark current step as completed (even though skipped)
      workflowState.completedSteps.push(workflowState.currentStep);
      
      // Advance to next step
      const nextStep = this.getNextWorkflowStep(workflowState.currentStep);
      if (nextStep) {
        workflowState.currentStep = nextStep;
        console.log(`Task ${taskId} advanced to workflow step ${nextStep} after skipping`);
      }
    }
  }

  /**
   * Pause downstream tasks
   */
  async pauseDownstreamTasks(taskId: string, duration: number): Promise<void> {
    console.log(`Pausing downstream tasks for ${duration}ms due to task ${taskId}`);
    // In a full implementation, this would identify and pause related tasks
    // For now, we log the action and could implement task dependency tracking
  }
}