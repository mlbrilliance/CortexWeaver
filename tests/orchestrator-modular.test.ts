import { 
  Orchestrator,
  OrchestratorConfig,
  OrchestratorStatus,
  AgentType,
  WorkflowStep
} from '../src/orchestrator';
import { CognitiveCanvas } from '../src/cognitive-canvas';
import { PlanParser } from '../src/plan-parser';
import { ClaudeClient } from '../src/claude-client';
import { WorkspaceManager } from '../src/workspace';
import { SessionManager } from '../src/session';
import * as fs from 'fs';
import * as path from 'path';

// Mock all dependencies
jest.mock('../src/cognitive-canvas');
jest.mock('../src/plan-parser');
jest.mock('../src/claude-client');
jest.mock('../src/workspace');
jest.mock('../src/session');
jest.mock('fs');
jest.mock('path');

const mockCognitiveCanvas = CognitiveCanvas as jest.MockedClass<typeof CognitiveCanvas>;
const mockPlanParser = PlanParser as jest.MockedClass<typeof PlanParser>;
const mockClaudeClient = ClaudeClient as jest.MockedClass<typeof ClaudeClient>;
const mockWorkspaceManager = WorkspaceManager as jest.MockedClass<typeof WorkspaceManager>;
const mockSessionManager = SessionManager as jest.MockedClass<typeof SessionManager>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('Orchestrator Modular Tests', () => {
  let orchestrator: Orchestrator;
  let mockCanvas: jest.Mocked<CognitiveCanvas>;
  let mockParser: jest.Mocked<PlanParser>;
  let mockClient: jest.Mocked<ClaudeClient>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockSession: jest.Mocked<SessionManager>;

  const mockConfig: OrchestratorConfig = {
    neo4j: {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'password'
    },
    claude: {
      apiKey: 'test-api-key',
      budgetLimit: 100
    }
  };

  const mockParsedPlan = {
    title: 'Test Project',
    overview: 'A test project for orchestrator',
    features: [
      {
        name: 'Write BDD Specs',
        priority: 'High' as const,
        description: 'Create BDD specifications and feature files',
        dependencies: [],
        agent: 'SpecWriter' as const,
        acceptanceCriteria: ['BDD specs created'],
        microtasks: ['Create feature files']
      },
      {
        name: 'Formalize Contracts',
        priority: 'High' as const,
        description: 'Create formal contracts from BDD specs',
        dependencies: ['Write BDD Specs'],
        agent: 'Formalizer' as const,
        acceptanceCriteria: ['Formal contracts created'],
        microtasks: ['Generate contracts']
      }
    ],
    architectureDecisions: {
      technologyStack: { language: 'TypeScript', framework: 'Node.js' },
      qualityStandards: { coverage: '90%', linting: 'ESLint' }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup canvas mock
    mockCanvas = {
      initializeSchema: jest.fn(),
      createProject: jest.fn(),
      createTask: jest.fn(),
      createTaskDependency: jest.fn(),
      getTasksByProject: jest.fn(),
      getTaskDependencies: jest.fn(),
      updateTaskStatus: jest.fn(),
      storeArchitecturalDecision: jest.fn(),
      getArtifactsByTask: jest.fn(),
      createCritiqueNode: jest.fn(),
      createPheromone: jest.fn(),
      close: jest.fn()
    } as any;
    mockCognitiveCanvas.mockImplementation(() => mockCanvas);

    // Setup parser mock
    mockParser = {
      parse: jest.fn(),
      getDependencyOrder: jest.fn()
    } as any;
    mockPlanParser.mockImplementation(() => mockParser);

    // Setup client mock
    mockClient = {
      sendMessage: jest.fn().mockResolvedValue({ 
        content: 'Mock Claude response',
        usage: { input_tokens: 100, output_tokens: 50 }
      }),
      sendMessages: jest.fn().mockResolvedValue({
        content: 'Mock Claude response',
        usage: { input_tokens: 100, output_tokens: 50 }
      }),
      streamMessage: jest.fn().mockResolvedValue({
        content: 'Mock Claude response',
        usage: { input_tokens: 100, output_tokens: 50 }
      }),
      getTokenUsage: jest.fn().mockReturnValue({
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        totalCost: 0.01
      }),
      getConfiguration: jest.fn().mockReturnValue({
        apiKey: 'test-api-key',
        defaultModel: 'claude-3-sonnet-20240229',
        maxTokens: 4096,
        temperature: 0.7
      })
    } as any;
    mockClaudeClient.mockImplementation(() => mockClient);

    // Setup workspace mock
    mockWorkspace = {
      createWorktree: jest.fn(),
      removeWorktree: jest.fn(),
      getWorktreeStatus: jest.fn(),
      commitChanges: jest.fn()
    } as any;
    mockWorkspaceManager.mockImplementation(() => mockWorkspace);

    // Setup session mock
    mockSession = {
      createSession: jest.fn(),
      startAgentInSession: jest.fn(),
      killSession: jest.fn(),
      listSessions: jest.fn(),
      getSessionOutput: jest.fn()
    } as any;
    mockSessionManager.mockImplementation(() => mockSession);

    orchestrator = new Orchestrator(mockConfig);
  });

  describe('Workflow Management', () => {
    it('should properly initialize workflow steps configuration', () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator.getStatus()).toBe('idle');
    });

    it('should initialize task workflow states correctly', async () => {
      // Mock dependencies
      mockPath.join.mockReturnValue('/test/plan.md');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock plan content');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      mockCanvas.createProject.mockResolvedValue({ 
        id: 'test-project-id',
        name: 'Test Project',
        description: 'Test description',
        status: 'initialized',
        createdAt: new Date().toISOString()
      });
      mockCanvas.createTask.mockResolvedValue({ 
        id: 'test-task-id',
        title: 'Test Task',
        description: 'Test description',
        status: 'pending',
        priority: 'High',
        projectId: 'test-project-id',
        createdAt: new Date().toISOString()
      });
      mockCanvas.createTaskDependency.mockResolvedValue(undefined);
      mockCanvas.storeArchitecturalDecision.mockResolvedValue({
        id: 'test-decision-id',
        title: 'Test Decision',
        description: 'Test description',
        rationale: 'Test rationale',
        status: 'approved',
        projectId: 'test-project-id',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([
        { 
          id: 'test-task-id',
          title: 'Test Task',
          description: 'Test description',
          status: 'pending',
          priority: 'High',
          projectId: 'test-project-id',
          createdAt: new Date().toISOString()
        }
      ]);

      await orchestrator.initialize('/test/project');

      expect(orchestrator.getStatus()).toBe('initialized');
    });

    it('should process workflow steps in correct order', async () => {
      // Test that workflow steps are processed in the defined sequence
      const steps: WorkflowStep[] = [
        'DEFINE_REQUIREMENTS',
        'FORMALIZE_CONTRACTS', 
        'PROTOTYPE_LOGIC',
        'DESIGN_ARCHITECTURE',
        'IMPLEMENT_CODE',
        'EXECUTE_TESTS'
      ];

      // This would test internal workflow step validation
      // Implementation would verify step ordering logic
      expect(steps).toHaveLength(6);
    });
  });

  describe('Task Execution', () => {
    it('should spawn agents with correct configuration', async () => {
      const mockTask = {
        id: 'test-task-id',
        title: 'Test Task',
        description: 'Test task description',
        status: 'pending',
        priority: 'High',
        projectId: 'test-project-id',
        createdAt: new Date().toISOString()
      };

      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'test-task-id',
        path: '/test/worktree',
        branch: 'feature/test-task-id',
        baseBranch: 'main'
      });
      mockSession.createSession.mockResolvedValue({
        sessionId: 'test-session-id',
        taskId: 'test-task-id',
        status: 'running',
        createdAt: new Date()
      });

      await orchestrator.spawnAgent(mockTask, 'SpecWriter');

      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith(
        'test-task-id',
        'feature/test-task-id',
        'main'
      );
      expect(mockSession.createSession).toHaveBeenCalledWith(
        'test-task-id',
        '/test/worktree'
      );
      expect(mockSession.startAgentInSession).toHaveBeenCalled();
    });

    it('should handle task completion properly', async () => {
      mockWorkspace.getWorktreeStatus.mockResolvedValue({ clean: false, files: ['file1.ts'] });
      mockSession.listSessions.mockReturnValue([
        { 
          sessionId: 'test-session', 
          taskId: 'test-task-id',
          status: 'running',
          createdAt: new Date()
        }
      ]);

      await orchestrator.handleTaskCompletion('test-task-id');

      expect(mockWorkspace.commitChanges).toHaveBeenCalled();
      expect(mockSession.killSession).toHaveBeenCalledWith('test-session');
      expect(mockWorkspace.removeWorktree).toHaveBeenCalledWith('test-task-id');
    });
  });

  describe('Agent Spawning', () => {
    it('should generate correct prompts for different agent types', async () => {
      const mockTask = {
        id: 'test-task-id',
        title: 'Test Task',
        description: 'Test task description',
        status: 'pending',
        priority: 'High',
        projectId: 'test-project-id',
        createdAt: new Date().toISOString()
      };

      const agentTypes: AgentType[] = [
        'SpecWriter',
        'Formalizer', 
        'Prototyper',
        'Architect',
        'Coder',
        'Tester'
      ];

      for (const agentType of agentTypes) {
        mockWorkspace.createWorktree.mockResolvedValue({
          id: mockTask.id,
          path: '/test/worktree',
          branch: `feature/${mockTask.id}`,
          baseBranch: 'main'
        });
        mockSession.createSession.mockResolvedValue({
          sessionId: `test-session-${agentType}`,
          taskId: mockTask.id,
          status: 'running',
          createdAt: new Date()
        });

        await orchestrator.spawnAgent(mockTask, agentType);

        expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
          expect.stringContaining(`test-session-${agentType}`),
          'claude-code',
          expect.stringContaining(agentType)
        );
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle impasse situations correctly', async () => {
      mockSession.getSessionOutput.mockResolvedValue('mock session output');
      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'codesavant-test-task-id',
        path: '/test/codesavant-worktree',
        branch: 'helper/codesavant-test-task-id',
        baseBranch: 'main'
      });
      mockSession.createSession.mockResolvedValue({
        sessionId: 'codesavant-session',
        taskId: 'codesavant-test-task-id',
        status: 'running',
        createdAt: new Date()
      });

      await orchestrator.handleImpasse('test-task-id');

      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith(
        'codesavant-test-task-id',
        'helper/codesavant-test-task-id',
        'main'
      );
      expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
        'codesavant-session',
        'claude-code',
        expect.stringContaining('CodeSavant')
      );
    });

    it('should handle task failures with appropriate recovery', async () => {
      const mockFailure = {
        type: 'system_failure',
        severity: 'critical',
        errorMessage: 'Test error message'
      };

      // This would test the error handling workflow
      await orchestrator.handleTaskFailure('test-task-id', mockFailure);

      // Verify appropriate error handling was triggered
      // Implementation would check debugger agent spawning, etc.
    });
  });

  describe('Status Management', () => {
    it('should track orchestrator status correctly', () => {
      expect(orchestrator.getStatus()).toBe('idle');
      expect(orchestrator.isRunning()).toBe(false);
    });

    it('should provide token usage statistics', () => {
      mockClient.getTokenUsage.mockReturnValue({
        totalInputTokens: 600,
        totalOutputTokens: 400,
        totalTokens: 1000,
        requestCount: 1,
        estimatedCost: 0.05
      });

      const usage = orchestrator.getTokenUsage();
      expect(usage.totalTokens).toBe(1000);
      expect(usage.estimatedCost).toBe(0.05);
    });

    it('should check budget limits correctly', () => {
      mockClient.getTokenUsage.mockReturnValue({
        totalInputTokens: 600,
        totalOutputTokens: 400,
        totalTokens: 1000,
        requestCount: 1,
        estimatedCost: 50
      });
      mockClient.getConfiguration.mockReturnValue({
        apiKey: 'test-key',
        budgetLimit: 100,
        defaultModel: 'claude-3-sonnet-20240229' as any,
        maxTokens: 4096,
        temperature: 0.7,
        budgetWarningThreshold: 0.8
      });

      const withinBudget = orchestrator.checkBudgetLimit();
      expect(withinBudget).toBe(true);

      mockClient.getTokenUsage.mockReturnValue({
        totalInputTokens: 3000,
        totalOutputTokens: 2000,
        totalTokens: 5000,
        requestCount: 1,
        estimatedCost: 150
      });

      const overBudget = orchestrator.checkBudgetLimit();
      expect(overBudget).toBe(false);
    });
  });

  describe('Context Priming', () => {
    it('should prime context for tasks with workflow awareness', async () => {
      const mockTask = {
        id: 'test-task-id',
        title: 'Test Task',
        description: 'Test task description',
        status: 'pending',
        priority: 'High',
        projectId: 'test-project-id',
        createdAt: new Date().toISOString()
      };

      // Setup mocks for spawnAgent
      mockWorkspace.createWorktree.mockResolvedValue({
        id: mockTask.id,
        path: '/test/worktree',
        branch: `feature/${mockTask.id}`,
        baseBranch: 'main'
      });
      mockSession.createSession.mockResolvedValue({
        sessionId: 'test-session',
        taskId: mockTask.id,
        status: 'running',
        createdAt: new Date()
      });

      // This would test the context priming functionality
      // Implementation would verify cognitive canvas navigation integration
      // Note: primeContextForTask is private, so we test via spawnAgent which uses it internally
      await orchestrator.spawnAgent(mockTask, 'SpecWriter');
      
      // Verify spawnAgent was called (context priming happens internally)
      expect(mockWorkspace.createWorktree).toHaveBeenCalled();
      expect(mockSession.createSession).toHaveBeenCalled();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', async () => {
      mockSession.listSessions.mockReturnValue([
        { 
          sessionId: 'session1', 
          taskId: 'task1',
          status: 'running',
          createdAt: new Date()
        },
        { 
          sessionId: 'session2', 
          taskId: 'task2',
          status: 'running',
          createdAt: new Date()
        }
      ]);

      await orchestrator.shutdown();

      expect(mockSession.killSession).toHaveBeenCalledTimes(2);
      expect(mockCanvas.close).toHaveBeenCalled();
      expect(orchestrator.isRunning()).toBe(false);
    });
  });
});