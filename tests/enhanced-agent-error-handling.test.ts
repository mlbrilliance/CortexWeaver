/**
 * Enhanced Agent Error Handling Tests
 * 
 * Tests the enhanced error handling capabilities of the base Agent class
 */

import { Agent, AgentConfig, TaskData, TaskContext, TaskResult } from '../src/agent';
import { CognitiveCanvas } from '../src/cognitive-canvas';
import { SessionManager } from '../src/session';
import { WorkspaceManager } from '../src/workspace';
import { ClaudeClient } from '../src/claude-client';
import {
  CortexError,
  ErrorSeverity,
  ErrorCategory,
  ErrorPhase
} from '../src/types/error-types';

// Test implementation of abstract Agent class
class TestAgent extends Agent {
  async executeTask(): Promise<any> {
    return { success: true, message: 'Task completed' };
  }

  getPromptTemplate(): string {
    return 'Test agent prompt template';
  }
}

describe('Enhanced Agent Error Handling', () => {
  let agent: TestAgent;
  let mockCanvas: jest.Mocked<CognitiveCanvas>;
  let mockConfig: AgentConfig;

  beforeEach(() => {
    // Mock CognitiveCanvas
    mockCanvas = {
      createPheromone: jest.fn().mockResolvedValue(undefined),
      updateTaskStatus: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockConfig = {
      id: 'test-agent-001',
      role: 'TestAgent',
      capabilities: ['testing', 'error-handling'],
      claudeConfig: {
        apiKey: 'test-api-key',
        defaultModel: 'claude-3-sonnet-20240229' as any,
        maxTokens: 4096,
        temperature: 0.7
      },
      workspaceRoot: '/tmp/test-workspace',
      cognitiveCanvasConfig: {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password'
      }
    };

    agent = new TestAgent();
  });

  describe('Enhanced Impasse Reporting', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
      (agent as any).cognitiveCanvas = mockCanvas;
      
      // Set up a current task
      const task: TaskData = {
        id: 'test-task-001',
        title: 'Test Task',
        description: 'A test task for error handling',
        status: 'running',
        priority: 'high',
        projectId: 'test-project',
        createdAt: new Date().toISOString()
      };
      
      const context: TaskContext = {
        projectInfo: { id: 'test-project', name: 'Test Project' },
        dependencies: [],
        files: []
      };
      
      await agent.receiveTask(task, context);
    });

    it('should create structured impasse details when reporting impasse', async () => {
      const reason = 'Cannot access required dependencies';
      const context = { missingDependency: 'express', attemptedPath: '/node_modules/express' };

      await agent.reportImpasse(reason, context, 'high');

      expect(mockCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'impasse',
          context: 'agent_impasse',
          metadata: expect.objectContaining({
            reason,
            urgency: 'high',
            agentId: 'test-agent-001',
            agentRole: 'TestAgent',
            taskId: 'test-task-001',
            impasseDetails: expect.objectContaining({
              reason,
              urgency: 'high',
              agentState: expect.objectContaining({
                status: 'assigned',
                conversationLength: 0,
                hasActiveSession: false
              }),
              taskProgress: expect.any(Number),
              blockers: expect.arrayContaining(['Missing dependencies or modules']),
              suggestedActions: expect.arrayContaining([
                expect.stringContaining('dependencies')
              ])
            }),
            cortexError: expect.objectContaining({
              severity: ErrorSeverity.HIGH,
              category: ErrorCategory.IMPASSE
            })
          })
        })
      );
    });

    it('should update agent status to impasse when reporting impasse', async () => {
      expect(agent.getStatus()).toBe('assigned');

      await agent.reportImpasse('Test impasse', {}, 'medium');

      expect(agent.getStatus()).toBe('impasse');
    });

    it('should identify blockers from impasse reason', async () => {
      const permissionReason = 'Permission denied when accessing file system';
      await agent.reportImpasse(permissionReason, {}, 'medium');

      // Find the impasse pheromone call (not the progress one)
      const impasseCall = mockCanvas.createPheromone.mock.calls.find(call => call[0].type === 'impasse')?.[0];
      const blockers = impasseCall?.metadata.impasseDetails.blockers;
      
      expect(blockers).toContain('Permission/access restrictions');
    });

    it('should generate relevant suggestions based on impasse reason', async () => {
      const syntaxReason = 'Syntax error in generated code';
      await agent.reportImpasse(syntaxReason, {}, 'low');

      // Find the impasse pheromone call (not the progress one)
      const impasseCall = mockCanvas.createPheromone.mock.calls.find(call => call[0].type === 'impasse')?.[0];
      const suggestions = impasseCall?.metadata.impasseDetails.suggestedActions;
      
      expect(suggestions).toContain('Review code syntax and structure');
      expect(suggestions).toContain('Check for bracket/quote matching');
    });

    it('should estimate task progress accurately', async () => {
      // Simulate conversation history
      (agent as any).conversationHistory = [
        { role: 'user', content: 'Start task' },
        { role: 'assistant', content: 'Working on it' },
        { role: 'user', content: 'Update please' },
        { role: 'assistant', content: 'Making progress' }
      ];
      
      agent.setStatus('running');

      await agent.reportImpasse('Progress blocked', {}, 'medium');

      const pheromoneCall = mockCanvas.createPheromone.mock.calls[0][0];
      const taskProgress = pheromoneCall.metadata.impasseDetails.taskProgress;
      
      expect(taskProgress).toBeGreaterThan(50); // Running status with conversation history
      expect(taskProgress).toBeLessThanOrEqual(100);
    });
  });

  describe('Enhanced Error Handling', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
      (agent as any).cognitiveCanvas = mockCanvas;
    });

    it('should convert regular errors to CortexError', async () => {
      const regularError = new Error('Regular error message');

      await agent.handleError(regularError);

      const lastError = agent.getLastError() as CortexError;
      expect(lastError).toBeInstanceOf(CortexError);
      expect(lastError?.message).toBe('Regular error message');
      expect(lastError?.severity).toBe(ErrorSeverity.MEDIUM);
      expect(lastError?.category).toBe(ErrorCategory.AGENT_EXECUTION);
    });

    it('should preserve CortexError when handling CortexError', async () => {
      const cortexError = new CortexError('Cortex error message', {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.NETWORK,
        context: {
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      await agent.handleError(cortexError);

      const lastError = agent.getLastError() as CortexError;
      expect(lastError).toBe(cortexError); // Same instance
      expect(lastError?.severity).toBe(ErrorSeverity.HIGH);
      expect(lastError?.category).toBe(ErrorCategory.NETWORK);
    });

    it('should store enhanced error pheromones', async () => {
      const error = new CortexError('Network timeout', {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.NETWORK,
        context: {
          taskId: 'test-task',
          agentId: 'test-agent',
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      await agent.handleError(error);

      expect(mockCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          strength: 0.8, // High severity = 0.8 strength
          context: 'agent_error',
          metadata: expect.objectContaining({
            errorId: error.id,
            error: 'Network timeout',
            severity: ErrorSeverity.HIGH,
            category: ErrorCategory.NETWORK,
            agentId: 'test-agent-001',
            cortexError: expect.objectContaining({
              id: error.id,
              severity: ErrorSeverity.HIGH,
              category: ErrorCategory.NETWORK
            })
          })
        })
      );
    });

    it('should automatically report impasse for critical errors', async () => {
      const criticalError = new CortexError('Critical system failure', {
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.INFRASTRUCTURE,
        context: {
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      await agent.handleError(criticalError);

      // Should create both error pheromone and impasse pheromone
      expect(mockCanvas.createPheromone).toHaveBeenCalledTimes(2);
      
      const calls = mockCanvas.createPheromone.mock.calls;
      const errorCall = calls.find(call => call[0].type === 'error');
      const impasseCall = calls.find(call => call[0].type === 'impasse');
      
      expect(errorCall).toBeDefined();
      expect(impasseCall).toBeDefined();
      expect(agent.getStatus()).toBe('impasse');
    });

    it('should map error severity to pheromone strength correctly', async () => {
      const severityTests = [
        { severity: ErrorSeverity.CRITICAL, expectedStrength: 0.95 },
        { severity: ErrorSeverity.HIGH, expectedStrength: 0.8 },
        { severity: ErrorSeverity.MEDIUM, expectedStrength: 0.6 },
        { severity: ErrorSeverity.LOW, expectedStrength: 0.4 }
      ];

      for (const test of severityTests) {
        mockCanvas.createPheromone.mockClear();
        
        const error = new CortexError('Test error', {
          severity: test.severity,
          category: ErrorCategory.AGENT_EXECUTION,
          context: {
            phase: ErrorPhase.TASK_EXECUTION,
            timestamp: new Date().toISOString()
          }
        });

        await agent.handleError(error);

        const errorPheromoneCall = mockCanvas.createPheromone.mock.calls.find(
          call => call[0].type === 'error'
        );
        
        expect(errorPheromoneCall).toBeDefined();
        expect(errorPheromoneCall![0].strength).toBe(test.expectedStrength);
      }
    });
  });

  describe('Error Context and Metadata', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
      (agent as any).cognitiveCanvas = mockCanvas;
      
      // Set up task context
      const task: TaskData = {
        id: 'context-test-task',
        title: 'Context Test Task',
        description: 'Testing error context',
        status: 'running',
        priority: 'medium',
        projectId: 'context-project',
        createdAt: new Date().toISOString()
      };
      
      await agent.receiveTask(task, { projectInfo: { id: 'context-project' } });
    });

    it('should include comprehensive context in CortexError creation', async () => {
      const originalError = new Error('Original error');

      await agent.handleError(originalError);

      const lastError = agent.getLastError() as CortexError;
      expect(lastError.context).toEqual(
        expect.objectContaining({
          taskId: 'context-test-task',
          agentId: 'test-agent-001',
          agentType: 'TestAgent',
          projectId: 'context-project',
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: expect.any(String)
        })
      );

      expect(lastError.metadata).toEqual(
        expect.objectContaining({
          agentStatus: 'assigned',
          conversationLength: 0,
          hasPersona: false,
          hasActiveSession: false
        })
      );
    });

    it('should track agent state changes in error metadata', async () => {
      // Change agent state
      agent.setStatus('running');
      (agent as any).conversationHistory = [
        { role: 'user', content: 'Test message' },
        { role: 'assistant', content: 'Test response' }
      ];

      const error = new Error('State tracking test');
      await agent.handleError(error);

      const lastError = agent.getLastError() as CortexError;
      expect(lastError.metadata.agentStatus).toBe('running');
      expect(lastError.metadata.conversationLength).toBe(2);
    });
  });

  describe('Urgency and Severity Mapping', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
      (agent as any).cognitiveCanvas = mockCanvas;
    });

    it('should map urgency to severity correctly in impasse reporting', async () => {
      const urgencyMappings = [
        { urgency: 'high' as const, expectedSeverity: ErrorSeverity.HIGH },
        { urgency: 'medium' as const, expectedSeverity: ErrorSeverity.MEDIUM },
        { urgency: 'low' as const, expectedSeverity: ErrorSeverity.LOW }
      ];

      for (const mapping of urgencyMappings) {
        mockCanvas.createPheromone.mockClear();
        
        await agent.reportImpasse('Test impasse', {}, mapping.urgency);

        const pheromoneCall = mockCanvas.createPheromone.mock.calls[0][0];
        const cortexError = pheromoneCall.metadata.cortexError;
        
        expect(cortexError.severity).toBe(mapping.expectedSeverity);
      }
    });

    it('should map severity to urgency correctly in error escalation', async () => {
      const severityMappings = [
        { severity: ErrorSeverity.CRITICAL, expectedUrgency: 'high' },
        { severity: ErrorSeverity.HIGH, expectedUrgency: 'high' },
        { severity: ErrorSeverity.MEDIUM, expectedUrgency: 'medium' },
        { severity: ErrorSeverity.LOW, expectedUrgency: 'low' }
      ];

      for (const mapping of severityMappings) {
        mockCanvas.createPheromone.mockClear();
        
        const error = new CortexError('Escalation test', {
          severity: mapping.severity,
          category: ErrorCategory.AGENT_EXECUTION,
          context: {
            phase: ErrorPhase.TASK_EXECUTION,
            timestamp: new Date().toISOString()
          }
        });

        // Trigger auto-escalation for critical/high severity
        await agent.handleError(error);

        if (mapping.severity === ErrorSeverity.CRITICAL) {
          // Should auto-escalate critical errors to impasse
          const impasseCall = mockCanvas.createPheromone.mock.calls.find(
            call => call[0].type === 'impasse'
          );
          expect(impasseCall).toBeDefined();
          expect(impasseCall![0].metadata.urgency).toBe(mapping.expectedUrgency);
        }
      }
    });
  });

  describe('Blocker and Suggestion Generation', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
      (agent as any).cognitiveCanvas = mockCanvas;
    });

    it('should identify multiple types of blockers from reason text', async () => {
      const complexReason = 'Permission denied accessing network resources due to memory constraints';
      
      await agent.reportImpasse(complexReason, {}, 'medium');

      const pheromoneCall = mockCanvas.createPheromone.mock.calls[0][0];
      const blockers = pheromoneCall.metadata.impasseDetails.blockers;
      
      expect(blockers).toContain('Permission/access restrictions');
      expect(blockers).toContain('Network connectivity issues');
      expect(blockers).toContain('Resource constraints');
    });

    it('should provide relevant suggestions for different blocker types', async () => {
      const dependencyReason = 'Missing required module dependencies';
      
      await agent.reportImpasse(dependencyReason, {}, 'medium');

      const pheromoneCall = mockCanvas.createPheromone.mock.calls[0][0];
      const suggestions = pheromoneCall.metadata.impasseDetails.suggestedActions;
      
      expect(suggestions).toContain('Install missing dependencies');
      expect(suggestions).toContain('Verify import paths and module availability');
      expect(suggestions).toContain('Break down task into smaller components');
      expect(suggestions).toContain('Seek CodeSavant assistance for alternative approaches');
    });

    it('should include general suggestions for unknown blockers', async () => {
      const unknownReason = 'Mysterious unexplained failure';
      
      await agent.reportImpasse(unknownReason, {}, 'medium');

      const pheromoneCall = mockCanvas.createPheromone.mock.calls[0][0];
      const blockers = pheromoneCall.metadata.impasseDetails.blockers;
      const suggestions = pheromoneCall.metadata.impasseDetails.suggestedActions;
      
      expect(blockers).toContain('Unknown technical blocker');
      expect(suggestions).toContain('Break down task into smaller components');
      expect(suggestions).toContain('Seek CodeSavant assistance for alternative approaches');
      expect(suggestions).toContain('Review similar successful task patterns');
    });
  });

  describe('Integration with Task Management', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
      (agent as any).cognitiveCanvas = mockCanvas;
    });

    it('should maintain error state consistency with agent status', async () => {
      expect(agent.getStatus()).toBe('initialized');
      expect(agent.getLastError()).toBeNull();

      const error = new Error('Test error');
      await agent.handleError(error);

      expect(agent.getStatus()).toBe('error');
      expect(agent.getLastError()).toBeInstanceOf(CortexError);
      expect(agent.getLastError()?.message).toBe('Test error');
    });

    it('should handle error-to-impasse transitions correctly', async () => {
      const criticalError = new CortexError('Critical agent failure', {
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.AGENT_EXECUTION,
        context: {
          phase: ErrorPhase.TASK_EXECUTION,
          timestamp: new Date().toISOString()
        }
      });

      await agent.handleError(criticalError);

      expect(agent.getStatus()).toBe('impasse'); // Should transition from error to impasse
      expect(agent.getLastError()).toBe(criticalError);
    });
  });
});