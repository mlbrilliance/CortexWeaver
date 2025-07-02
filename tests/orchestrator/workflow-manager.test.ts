import { WorkflowManager, WorkflowStep, AgentType, WorkflowStepConfig, TaskWorkflowState } from '../../src/orchestrator/workflow-manager';
import { TaskData } from '../../src/cognitive-canvas';
import { Feature } from '../../src/plan-parser';

describe('WorkflowManager', () => {
  let workflowManager: WorkflowManager;

  beforeEach(() => {
    workflowManager = new WorkflowManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default workflow configuration', () => {
      expect(workflowManager).toBeDefined();
    });

    it('should have predefined workflow steps', () => {
      const workflowSteps = workflowManager.getWorkflowSteps();
      
      expect(workflowSteps).toContain('DEFINE_REQUIREMENTS');
      expect(workflowSteps).toContain('FORMALIZE_CONTRACTS');
      expect(workflowSteps).toContain('PROTOTYPE_LOGIC');
      expect(workflowSteps).toContain('DESIGN_ARCHITECTURE');
      expect(workflowSteps).toContain('IMPLEMENT_CODE');
      expect(workflowSteps).toContain('EXECUTE_TESTS');
    });
  });

  describe('workflow step configuration', () => {
    it('should configure workflow step with correct agent type', () => {
      const stepConfig: WorkflowStepConfig = {
        step: 'DEFINE_REQUIREMENTS',
        agentType: 'SpecWriter',
        requiredPreviousSteps: [],
        critiqueRequired: true,
        errorRecoveryEnabled: true
      };

      workflowManager.configureStep(stepConfig);
      const retrievedConfig = workflowManager.getStepConfig('DEFINE_REQUIREMENTS');

      expect(retrievedConfig.agentType).toBe('SpecWriter');
      expect(retrievedConfig.critiqueRequired).toBe(true);
      expect(retrievedConfig.errorRecoveryEnabled).toBe(true);
    });

    it('should handle step dependencies correctly', () => {
      const stepConfig: WorkflowStepConfig = {
        step: 'IMPLEMENT_CODE',
        agentType: 'Coder',
        requiredPreviousSteps: ['DESIGN_ARCHITECTURE', 'PROTOTYPE_LOGIC'],
        critiqueRequired: true,
        errorRecoveryEnabled: true
      };

      workflowManager.configureStep(stepConfig);
      const config = workflowManager.getStepConfig('IMPLEMENT_CODE');

      expect(config.requiredPreviousSteps).toContain('DESIGN_ARCHITECTURE');
      expect(config.requiredPreviousSteps).toContain('PROTOTYPE_LOGIC');
    });
  });

  describe('task workflow state management', () => {
    const mockTaskId = 'task-123';

    it('should initialize task workflow state', () => {
      workflowManager.initializeTaskWorkflow(mockTaskId);
      const state = workflowManager.getTaskWorkflowState(mockTaskId);

      expect(state).toBeDefined();
      expect(state.currentStep).toBe('DEFINE_REQUIREMENTS');
      expect(state.completedSteps).toEqual([]);
    });

    it('should update task workflow state when step completes', () => {
      workflowManager.initializeTaskWorkflow(mockTaskId);
      workflowManager.completeStep(mockTaskId, 'DEFINE_REQUIREMENTS');

      const state = workflowManager.getTaskWorkflowState(mockTaskId);
      expect(state.completedSteps).toContain('DEFINE_REQUIREMENTS');
      expect(state.currentStep).toBe('FORMALIZE_CONTRACTS');
    });

    it('should validate step prerequisites before proceeding', () => {
      workflowManager.initializeTaskWorkflow(mockTaskId);
      
      // Configure a step with prerequisites
      workflowManager.configureStep({
        step: 'IMPLEMENT_CODE',
        agentType: 'Coder',
        requiredPreviousSteps: ['DESIGN_ARCHITECTURE'],
        critiqueRequired: true,
        errorRecoveryEnabled: true
      });

      // Try to proceed to IMPLEMENT_CODE without completing DESIGN_ARCHITECTURE
      const canProceed = workflowManager.canProceedToStep(mockTaskId, 'IMPLEMENT_CODE');
      expect(canProceed).toBe(false);
    });

    it('should allow step progression when prerequisites are met', () => {
      workflowManager.initializeTaskWorkflow(mockTaskId);
      
      // Complete prerequisite steps
      workflowManager.completeStep(mockTaskId, 'DEFINE_REQUIREMENTS');
      workflowManager.completeStep(mockTaskId, 'FORMALIZE_CONTRACTS');
      workflowManager.completeStep(mockTaskId, 'PROTOTYPE_LOGIC');
      workflowManager.completeStep(mockTaskId, 'DESIGN_ARCHITECTURE');

      const canProceed = workflowManager.canProceedToStep(mockTaskId, 'IMPLEMENT_CODE');
      expect(canProceed).toBe(true);
    });
  });

  describe('workflow validation', () => {
    it('should validate workflow consistency', () => {
      const validConfig: WorkflowStepConfig = {
        step: 'FORMALIZE_CONTRACTS',
        agentType: 'Formalizer',
        requiredPreviousSteps: ['DEFINE_REQUIREMENTS'],
        critiqueRequired: true,
        errorRecoveryEnabled: true
      };

      const isValid = workflowManager.validateStepConfig(validConfig);
      expect(isValid).toBe(true);
    });

    it('should reject invalid workflow configurations', () => {
      const invalidConfig: WorkflowStepConfig = {
        step: 'DEFINE_REQUIREMENTS',
        agentType: 'Coder', // Wrong agent type for this step
        requiredPreviousSteps: ['IMPLEMENT_CODE'], // Circular dependency
        critiqueRequired: true,
        errorRecoveryEnabled: true
      };

      const isValid = workflowManager.validateStepConfig(invalidConfig);
      expect(isValid).toBe(false);
    });
  });

  describe('workflow execution control', () => {
    const mockTaskId = 'task-456';

    it('should pause workflow when critique is required', () => {
      workflowManager.initializeTaskWorkflow(mockTaskId);
      
      // Configure step requiring critique
      workflowManager.configureStep({
        step: 'FORMALIZE_CONTRACTS',
        agentType: 'Formalizer',
        requiredPreviousSteps: ['DEFINE_REQUIREMENTS'],
        critiqueRequired: true,
        errorRecoveryEnabled: true
      });

      workflowManager.completeStep(mockTaskId, 'DEFINE_REQUIREMENTS');
      const shouldPause = workflowManager.shouldPauseForCritique(mockTaskId, 'FORMALIZE_CONTRACTS');
      
      expect(shouldPause).toBe(true);
    });

    it('should handle workflow errors with recovery enabled', () => {
      workflowManager.initializeTaskWorkflow(mockTaskId);
      
      workflowManager.configureStep({
        step: 'IMPLEMENT_CODE',
        agentType: 'Coder',
        requiredPreviousSteps: [],
        critiqueRequired: false,
        errorRecoveryEnabled: true
      });

      const errorResult = workflowManager.handleStepError(mockTaskId, 'IMPLEMENT_CODE', new Error('Compilation error'));
      
      expect(errorResult.recoveryAttempted).toBe(true);
      expect(errorResult.canRetry).toBe(true);
    });

    it('should fail workflow when error recovery is disabled', () => {
      workflowManager.initializeTaskWorkflow(mockTaskId);
      
      workflowManager.configureStep({
        step: 'EXECUTE_TESTS',
        agentType: 'Tester',
        requiredPreviousSteps: [],
        critiqueRequired: false,
        errorRecoveryEnabled: false
      });

      const errorResult = workflowManager.handleStepError(mockTaskId, 'EXECUTE_TESTS', new Error('Test failure'));
      
      expect(errorResult.recoveryAttempted).toBe(false);
      expect(errorResult.canRetry).toBe(false);
    });
  });

  describe('workflow optimization', () => {
    it('should identify parallel execution opportunities', () => {
      const parallelSteps = workflowManager.getParallelExecutionSteps('PROTOTYPE_LOGIC');
      
      // Steps that can run in parallel with prototyping
      expect(parallelSteps).toBeDefined();
      expect(Array.isArray(parallelSteps)).toBe(true);
    });

    it('should calculate workflow completion percentage', () => {
      const mockTaskId = 'task-progress';
      workflowManager.initializeTaskWorkflow(mockTaskId);
      
      // Complete half the steps
      workflowManager.completeStep(mockTaskId, 'DEFINE_REQUIREMENTS');
      workflowManager.completeStep(mockTaskId, 'FORMALIZE_CONTRACTS');
      workflowManager.completeStep(mockTaskId, 'PROTOTYPE_LOGIC');

      const progress = workflowManager.getWorkflowProgress(mockTaskId);
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(100);
    });

    it('should estimate remaining workflow time', () => {
      const mockTaskId = 'task-estimate';
      workflowManager.initializeTaskWorkflow(mockTaskId);
      
      const estimate = workflowManager.estimateRemainingTime(mockTaskId);
      expect(estimate).toBeDefined();
      expect(typeof estimate).toBe('number');
      expect(estimate).toBeGreaterThan(0);
    });
  });

  describe('workflow analytics', () => {
    it('should track step execution metrics', () => {
      const mockTaskId = 'task-metrics';
      workflowManager.initializeTaskWorkflow(mockTaskId);
      
      const startTime = Date.now();
      workflowManager.startStep(mockTaskId, 'DEFINE_REQUIREMENTS');
      
      // Simulate some processing time
      setTimeout(() => {
        workflowManager.completeStep(mockTaskId, 'DEFINE_REQUIREMENTS');
        
        const metrics = workflowManager.getStepMetrics(mockTaskId, 'DEFINE_REQUIREMENTS');
        expect(metrics).toBeDefined();
        expect(metrics.executionTime).toBeGreaterThan(0);
        expect(metrics.status).toBe('completed');
      }, 10);
    });

    it('should generate workflow reports', () => {
      const mockTaskId = 'task-report';
      workflowManager.initializeTaskWorkflow(mockTaskId);
      
      // Complete some steps
      workflowManager.completeStep(mockTaskId, 'DEFINE_REQUIREMENTS');
      workflowManager.completeStep(mockTaskId, 'FORMALIZE_CONTRACTS');

      const report = workflowManager.generateWorkflowReport(mockTaskId);
      
      expect(report).toBeDefined();
      expect(report.taskId).toBe(mockTaskId);
      expect(report.completedSteps).toHaveLength(2);
      expect(report.totalSteps).toBeGreaterThan(0);
      expect(report.progressPercentage).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid task IDs gracefully', () => {
      const invalidTaskId = 'nonexistent-task';
      const state = workflowManager.getTaskWorkflowState(invalidTaskId);
      
      expect(state).toBeNull();
    });

    it('should handle invalid workflow steps', () => {
      const mockTaskId = 'task-invalid';
      workflowManager.initializeTaskWorkflow(mockTaskId);
      
      expect(() => {
        workflowManager.completeStep(mockTaskId, 'INVALID_STEP' as WorkflowStep);
      }).toThrow();
    });

    it('should handle concurrent workflow modifications', async () => {
      const mockTaskId = 'task-concurrent';
      workflowManager.initializeTaskWorkflow(mockTaskId);

      // Simulate concurrent step completions
      const promises = [
        workflowManager.completeStepAsync(mockTaskId, 'DEFINE_REQUIREMENTS'),
        workflowManager.completeStepAsync(mockTaskId, 'DEFINE_REQUIREMENTS')
      ];

      const results = await Promise.allSettled(promises);
      
      // Only one should succeed
      const successful = results.filter(result => result.status === 'fulfilled');
      expect(successful).toHaveLength(1);
    });
  });
});