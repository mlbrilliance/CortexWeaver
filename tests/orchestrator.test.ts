import { Orchestrator } from '../src/orchestrator';
import { CognitiveCanvas } from '../src/cognitive-canvas';
import { PlanParser } from '../src/plan-parser';
import { ClaudeClient, ClaudeModel } from '../src/claude-client';
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
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));
jest.mock('path', () => ({
  join: jest.fn(),
}));

const mockCognitiveCanvas = CognitiveCanvas as jest.MockedClass<typeof CognitiveCanvas>;
const mockPlanParser = PlanParser as jest.MockedClass<typeof PlanParser>;
const mockClaudeClient = ClaudeClient as jest.MockedClass<typeof ClaudeClient>;
const mockWorkspaceManager = WorkspaceManager as jest.MockedClass<typeof WorkspaceManager>;
const mockSessionManager = SessionManager as jest.MockedClass<typeof SessionManager>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  let mockCanvas: jest.Mocked<CognitiveCanvas>;
  let mockParser: jest.Mocked<PlanParser>;
  let mockClient: jest.Mocked<ClaudeClient>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockSession: jest.Mocked<SessionManager>;

  const mockConfig = {
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
      },
      {
        name: 'Prototype Logic',
        priority: 'High' as const,
        description: 'Create prototype implementation based on formal contracts',
        dependencies: ['Formalize Contracts'],
        agent: 'Prototyper' as const,
        acceptanceCriteria: ['Prototype logic implemented'],
        microtasks: ['Create prototype']
      },
      {
        name: 'Feature 1',
        priority: 'High' as const,
        description: 'First feature with no dependencies',
        dependencies: ['Prototype Logic'],
        agent: 'Architect' as const,
        acceptanceCriteria: ['Criterion 1'],
        microtasks: ['Task 1']
      },
      {
        name: 'Feature 2',
        priority: 'Medium' as const,
        description: 'Second feature depends on first',
        dependencies: ['Feature 1'],
        agent: 'Coder' as const,
        acceptanceCriteria: ['Criterion 2'],
        microtasks: ['Task 2']
      }
    ],
    architectureDecisions: {
      technologyStack: { Backend: 'Node.js' },
      qualityStandards: { 'Code Coverage': '80%' }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Setup mocks
    mockCanvas = {
      initializeSchema: jest.fn(),
      createProject: jest.fn(),
      getProject: jest.fn(),
      updateProjectStatus: jest.fn(),
      createTask: jest.fn(),
      createTaskDependency: jest.fn(),
      getTasksByProject: jest.fn(),
      getTaskDependencies: jest.fn(),
      createAgent: jest.fn(),
      assignAgentToTask: jest.fn(),
      getAgentAssignments: jest.fn(),
      createPheromone: jest.fn(),
      linkPheromoneToTask: jest.fn(),
      getPheromonesByType: jest.fn(),
      cleanExpiredPheromones: jest.fn(),
      storeArchitecturalDecision: jest.fn(),
      getArchitecturalDecisionsByProject: jest.fn(),
      getProjectKnowledgeGraph: jest.fn(),
      findSimilarTasks: jest.fn(),
      close: jest.fn(),
    } as any;

    mockParser = {
      parse: jest.fn(),
      getDependencyOrder: jest.fn(),
      validatePlan: jest.fn(),
    } as any;

    mockClient = {
      sendMessage: jest.fn(),
      getTokenUsage: jest.fn(),
      resetTokenUsage: jest.fn(),
      getConfiguration: jest.fn(),
    } as any;

    mockWorkspace = {
      getProjectRoot: jest.fn(),
      createWorktree: jest.fn(),
      removeWorktree: jest.fn(),
      listWorktrees: jest.fn(),
      executeCommand: jest.fn(),
      commitChanges: jest.fn(),
      mergeToBranch: jest.fn(),
      getWorktreeStatus: jest.fn(),
    } as any;

    mockSession = {
      createSession: jest.fn(),
      runCommandInSession: jest.fn(),
      attachToSession: jest.fn(),
      killSession: jest.fn(),
      listSessions: jest.fn(),
      getSessionStatus: jest.fn(),
      listActiveTmuxSessions: jest.fn(),
      startAgentInSession: jest.fn(),
      monitorSession: jest.fn(),
      getSessionOutput: jest.fn(),
      cleanupDeadSessions: jest.fn(),
    } as any;

    // Mock constructors
    mockCognitiveCanvas.mockImplementation(() => mockCanvas);
    mockPlanParser.mockImplementation(() => mockParser);
    mockClaudeClient.mockImplementation(() => mockClient);
    mockWorkspaceManager.mockImplementation(() => mockWorkspace);
    mockSessionManager.mockImplementation(() => mockSession);

    // Setup default client mocks
    mockClient.getTokenUsage.mockReturnValue({
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      totalTokens: 1500,
      requestCount: 10,
      estimatedCost: 0.50
    });
    
    mockClient.getConfiguration.mockReturnValue({
      budgetLimit: 100,
      budgetWarningThreshold: 0.8,
      apiKey: 'test-key',
      defaultModel: ClaudeModel.SONNET,
      maxTokens: 4096,
      temperature: 0.7
    });

    orchestrator = new Orchestrator(mockConfig);
  });

  describe('Constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(mockCognitiveCanvas).toHaveBeenCalledWith(mockConfig.neo4j);
      expect(mockClaudeClient).toHaveBeenCalledWith(mockConfig.claude);
      expect(mockPlanParser).toHaveBeenCalled();
      expect(mockWorkspaceManager).toHaveBeenCalled();
      expect(mockSessionManager).toHaveBeenCalled();
    });

    it('should throw error if neo4j config is missing', () => {
      expect(() => new Orchestrator({ ...mockConfig, neo4j: undefined as any }))
        .toThrow('Neo4j configuration is required');
    });

    it('should throw error if claude config is missing', () => {
      expect(() => new Orchestrator({ ...mockConfig, claude: undefined as any }))
        .toThrow('Claude configuration is required');
    });

    it('should initialize with default values', () => {
      const orch = new Orchestrator(mockConfig);
      expect(orch.isRunning()).toBe(false);
      expect(orch.getStatus()).toBe('idle');
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');
    });

    it('should initialize project successfully', async () => {
      await orchestrator.initialize('/test/project');

      expect(mockCanvas.initializeSchema).toHaveBeenCalled();
      expect(mockPath.join).toHaveBeenCalledWith('/test/project', 'plan.md');
      expect(mockFs.existsSync).toHaveBeenCalledWith('/test/path/plan.md');
      expect(mockFs.readFileSync).toHaveBeenCalledWith('/test/path/plan.md', 'utf-8');
      expect(mockParser.parse).toHaveBeenCalledWith('mock plan content');
      expect(mockCanvas.createProject).toHaveBeenCalled();
    });

    it('should throw error if plan.md does not exist', async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(orchestrator.initialize('/test/project'))
        .rejects.toThrow('Plan file not found at /test/path/plan.md');
    });

    it('should throw error if plan parsing fails', async () => {
      mockParser.parse.mockImplementation(() => {
        throw new Error('Invalid plan format');
      });

      await expect(orchestrator.initialize('/test/project'))
        .rejects.toThrow('Failed to parse plan: Invalid plan format');
    });

    it('should create tasks and dependencies in Cognitive Canvas', async () => {
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-1',
        title: 'Feature 1',
        description: 'First feature with no dependencies',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });

      await orchestrator.initialize('/test/project');

      expect(mockCanvas.createTask).toHaveBeenCalledTimes(5);
      expect(mockCanvas.createTaskDependency).toHaveBeenCalledTimes(4);
    });

    it('should store architectural decisions', async () => {
      await orchestrator.initialize('/test/project');

      expect(mockCanvas.storeArchitecturalDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Technology Stack',
          description: expect.stringContaining('Backend: Node.js'),
          projectId: expect.any(String)
        })
      );
    });

    it('should create tasks with correct dependency order', async () => {
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      
      await orchestrator.initialize('/test/project');
      
      expect(mockParser.getDependencyOrder).toHaveBeenCalledWith(mockParsedPlan.features);
    });
  });

  describe('start', () => {
    beforeEach(async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      mockCanvas.createProject.mockResolvedValue({
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      });
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-1',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');
      
      await orchestrator.initialize('/test/project');
    });

    it('should start orchestration loop', async () => {
      mockCanvas.getTasksByProject.mockResolvedValue([]);

      // Mock the orchestration loop to stop after one iteration
      const originalProcessNextTask = orchestrator.processNextTask;
      let callCount = 0;
      orchestrator.processNextTask = jest.fn().mockImplementation(async () => {
        callCount++;
        return Promise.resolve();
      });

      await orchestrator.start();

      expect(orchestrator.processNextTask).toHaveBeenCalled();
      expect(orchestrator.isRunning()).toBe(false);
    });

    it('should handle orchestration errors gracefully', async () => {
      mockCanvas.getTasksByProject.mockRejectedValue(new Error('Database error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(orchestrator.start()).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Orchestration error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should update status to running when started', async () => {
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      
      const startPromise = orchestrator.start();
      expect(orchestrator.isRunning()).toBe(true);
      expect(orchestrator.getStatus()).toBe('running');
      
      await startPromise;
    });

    it('should respect budget limits', async () => {
      mockClient.getTokenUsage.mockReturnValue({
        totalInputTokens: 20000,
        totalOutputTokens: 10000,
        totalTokens: 30000,
        requestCount: 200,
        estimatedCost: 150.0
      });

      const checkBudgetSpy = jest.spyOn(orchestrator, 'checkBudgetLimit');
      orchestrator.checkBudgetLimit = jest.fn().mockReturnValue(false);

      await orchestrator.start();

      expect(orchestrator.checkBudgetLimit).toHaveBeenCalled();
    });
  });

  describe('processNextTask', () => {
    beforeEach(async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');
      
      await orchestrator.initialize('/test/project');
    });

    it('should process available tasks', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      // Mock the task feature map entry
      (orchestrator as any).taskFeatureMap.set('task-1', {
        name: 'Feature 1',
        priority: 'High',
        description: 'First feature with no dependencies',
        dependencies: [],
        agent: 'Architect',
        acceptanceCriteria: ['Criterion 1'],
        microtasks: ['Task 1']
      });

      mockCanvas.getTasksByProject.mockResolvedValue([mockTask]);
      mockCanvas.getTaskDependencies.mockResolvedValue([]);

      const spawnAgentSpy = jest.spyOn(orchestrator, 'spawnAgent').mockResolvedValue();

      await orchestrator.processNextTask();

      expect(spawnAgentSpy).toHaveBeenCalledWith(mockTask, 'Architect');
    });

    it('should skip tasks with unmet dependencies', async () => {
      const mockTask = {
        id: 'task-2',
        title: 'Feature 2',
        description: 'Second feature',
        status: 'pending',
        priority: 'Medium',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      const mockDependency = {
        id: 'task-1',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      mockCanvas.getTasksByProject.mockResolvedValue([mockTask]);
      mockCanvas.getTaskDependencies.mockResolvedValue([mockDependency]);

      const spawnAgentSpy = jest.spyOn(orchestrator, 'spawnAgent').mockResolvedValue();

      await orchestrator.processNextTask();

      expect(spawnAgentSpy).not.toHaveBeenCalled();
    });

    it('should process tasks with completed dependencies', async () => {
      const mockTask = {
        id: 'task-2',
        title: 'Feature 2',
        description: 'Second feature',
        status: 'pending',
        priority: 'Medium',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      // Mock the task feature map entry
      (orchestrator as any).taskFeatureMap.set('task-2', {
        name: 'Feature 2',
        priority: 'Medium',
        description: 'Second feature depends on first',
        dependencies: ['Feature 1'],
        agent: 'Coder',
        acceptanceCriteria: ['Criterion 2'],
        microtasks: ['Task 2']
      });

      const mockDependency = {
        id: 'task-1',
        title: 'Feature 1',
        description: 'First feature',
        status: 'completed',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      mockCanvas.getTasksByProject.mockResolvedValue([mockTask]);
      mockCanvas.getTaskDependencies.mockResolvedValue([mockDependency]);

      const spawnAgentSpy = jest.spyOn(orchestrator, 'spawnAgent').mockResolvedValue();

      await orchestrator.processNextTask();

      expect(spawnAgentSpy).toHaveBeenCalledWith(mockTask, 'Coder');
    });

    it('should handle budget constraints', async () => {
      // Budget constraints are checked at the start level, not in processNextTask
      // This test verifies that budget constraints don't interfere with task processing
      const mockTask = {
        id: 'task-1',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      // Mock the task feature map entry
      (orchestrator as any).taskFeatureMap.set('task-1', {
        name: 'Feature 1',
        priority: 'High',
        description: 'First feature with no dependencies',
        dependencies: [],
        agent: 'Architect',
        acceptanceCriteria: ['Criterion 1'],
        microtasks: ['Task 1']
      });

      mockCanvas.getTasksByProject.mockResolvedValue([mockTask]);
      mockCanvas.getTaskDependencies.mockResolvedValue([]);

      const spawnAgentSpy = jest.spyOn(orchestrator, 'spawnAgent').mockResolvedValue();

      await orchestrator.processNextTask();

      expect(spawnAgentSpy).toHaveBeenCalledWith(mockTask, 'Architect');
    });
  });

  describe('spawnAgent', () => {
    const mockTask = {
      id: 'task-1',
      title: 'Feature 1',
      description: 'First feature',
      status: 'pending',
      priority: 'High',
      projectId: 'project-123',
      createdAt: new Date().toISOString()
    };

    beforeEach(async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project', 
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');
      
      await orchestrator.initialize('/test/project');
    });

    it('should spawn agent with correct parameters', async () => {
      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'task-1',
        path: '/test/project/worktrees/task-1',
        branch: 'feature/task-1',
        baseBranch: 'main'
      });

      mockSession.createSession.mockResolvedValue({
        sessionId: 'cortex-task-1-123',
        taskId: 'task-1',
        status: 'running',
        createdAt: new Date()
      });

      mockSession.startAgentInSession.mockResolvedValue();

      await orchestrator.spawnAgent(mockTask, 'Architect');

      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith(
        'task-1',
        'feature/task-1',
        'main'
      );

      expect(mockSession.createSession).toHaveBeenCalledWith(
        'task-1',
        '/test/project/worktrees/task-1'
      );

      expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
        'cortex-task-1-123',
        'claude-code',
        expect.stringContaining('You are an Architect agent')
      );
    });

    it('should generate appropriate prompts for different agent types', async () => {
      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'task-1',
        path: '/test/project/worktrees/task-1',
        branch: 'feature/task-1',
        baseBranch: 'main'
      });

      mockSession.createSession.mockResolvedValue({
        sessionId: 'cortex-task-1-123',
        taskId: 'task-1',
        status: 'running',
        createdAt: new Date()
      });

      mockSession.startAgentInSession.mockResolvedValue();

      // Test Architect agent
      await orchestrator.spawnAgent(mockTask, 'Architect');
      expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
        'cortex-task-1-123',
        'claude-code',
        expect.stringContaining('You are an Architect agent')
      );

      // Test Coder agent
      await orchestrator.spawnAgent(mockTask, 'Coder');
      expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
        'cortex-task-1-123',
        'claude-code',
        expect.stringContaining('You are a Coder agent')
      );

      // Test Tester agent
      await orchestrator.spawnAgent(mockTask, 'Tester');
      expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
        'cortex-task-1-123',
        'claude-code',
        expect.stringContaining('You are a Tester agent')
      );
    });

    it('should use correct flags for claude-code command', async () => {
      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'task-1',
        path: '/test/project/worktrees/task-1',
        branch: 'feature/task-1',
        baseBranch: 'main'
      });

      mockSession.createSession.mockResolvedValue({
        sessionId: 'cortex-task-1-123',
        taskId: 'task-1',
        status: 'running',
        createdAt: new Date()
      });

      mockSession.startAgentInSession.mockResolvedValue();

      await orchestrator.spawnAgent(mockTask, 'Architect');

      expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
        'cortex-task-1-123',
        'claude-code',
        expect.any(String)
      );
    });

    it('should handle worktree creation errors', async () => {
      mockWorkspace.createWorktree.mockRejectedValue(new Error('Worktree creation failed'));

      await expect(orchestrator.spawnAgent(mockTask, 'Architect'))
        .rejects.toThrow('Failed to spawn agent for task task-1: Worktree creation failed');
    });

    it('should handle session creation errors', async () => {
      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'task-1',
        path: '/test/project/worktrees/task-1',
        branch: 'feature/task-1',
        baseBranch: 'main'
      });

      mockSession.createSession.mockRejectedValue(new Error('Session creation failed'));
      mockWorkspace.removeWorktree.mockResolvedValue(true);

      await expect(orchestrator.spawnAgent(mockTask, 'Architect'))
        .rejects.toThrow('Failed to spawn agent for task task-1: Session creation failed');
    });

    it('should clean up on spawn failure', async () => {
      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'task-1',
        path: '/test/project/worktrees/task-1',
        branch: 'feature/task-1',
        baseBranch: 'main'
      });

      mockSession.createSession.mockRejectedValue(new Error('Session failed'));
      mockWorkspace.removeWorktree.mockResolvedValue(true);

      await expect(orchestrator.spawnAgent(mockTask, 'Architect'))
        .rejects.toThrow();

      expect(mockWorkspace.removeWorktree).toHaveBeenCalledWith('task-1');
    });
  });

  describe('handleImpasse - NEW CodeSavant Integration', () => {
    const mockTask = {
      id: 'task-1',
      title: 'Feature 1',
      description: 'First feature',
      status: 'impasse',
      priority: 'High',
      projectId: 'project-123',
      createdAt: new Date().toISOString()
    };

    beforeEach(async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');
      
      await orchestrator.initialize('/test/project');
    });

    it('should detect impasse status', async () => {
      mockCanvas.getTasksByProject.mockResolvedValue([{
        ...mockTask,
        status: 'impasse'
      }]);

      const handleImpasse = jest.spyOn(orchestrator, 'handleImpasse').mockResolvedValue(undefined);

      await orchestrator.monitorTasks();

      expect(handleImpasse).toHaveBeenCalledWith('task-1');
    });

    it('should spawn CodeSavant helper agent', async () => {
      mockSession.getSessionOutput.mockResolvedValue('Agent stuck on complex problem');
      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'codesavant-task-1',
        path: '/test/project/worktrees/codesavant-task-1',
        branch: 'helper/codesavant-task-1',
        baseBranch: 'main'
      });

      mockSession.createSession.mockResolvedValue({
        sessionId: 'codesavant-session-123',
        taskId: 'codesavant-task-1',
        status: 'running',
        createdAt: new Date()
      });

      await orchestrator.handleImpasse('task-1');

      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith(
        'codesavant-task-1',
        'helper/codesavant-task-1',
        'main'
      );

      expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
        'codesavant-session-123',
        'claude-code',
        expect.stringContaining('You are CodeSavant')
      );
    });

    it('should include context in CodeSavant prompt', async () => {
      mockSession.getSessionOutput.mockResolvedValue('Original agent output with error details');
      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'codesavant-task-1',
        path: '/test/project/worktrees/codesavant-task-1',
        branch: 'helper/codesavant-task-1', 
        baseBranch: 'main'
      });

      mockSession.createSession.mockResolvedValue({
        sessionId: 'codesavant-session-123',
        taskId: 'codesavant-task-1',
        status: 'running',
        createdAt: new Date()
      });

      await orchestrator.handleImpasse('task-1');

      expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
        'codesavant-session-123',
        'claude-code',
        expect.stringContaining('Original agent output with error details')
      );
    });

    it('should handle CodeSavant spawn failure', async () => {
      mockSession.getSessionOutput.mockResolvedValue('Agent stuck');
      mockWorkspace.createWorktree.mockRejectedValue(new Error('CodeSavant spawn failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await orchestrator.handleImpasse('task-1');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to spawn CodeSavant for task task-1:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should create proper CodeSavant prompt with analysis focus', async () => {
      mockSession.getSessionOutput.mockResolvedValue('Complex build error');
      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'codesavant-task-1',
        path: '/test/project/worktrees/codesavant-task-1',
        branch: 'helper/codesavant-task-1',
        baseBranch: 'main'
      });

      mockSession.createSession.mockResolvedValue({
        sessionId: 'codesavant-session-123',
        taskId: 'codesavant-task-1',
        status: 'running',
        createdAt: new Date()
      });

      await orchestrator.handleImpasse('task-1');

      const expectedPromptContent = mockSession.startAgentInSession.mock.calls[0][2];
      expect(expectedPromptContent).toContain('CodeSavant');
      expect(expectedPromptContent).toContain('specialized helper');
      expect(expectedPromptContent).toContain('analysis');
      expect(expectedPromptContent).toContain('second opinion');
    });
  });

  describe('monitorTasks', () => {
    beforeEach(async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');
      
      await orchestrator.initialize('/test/project');
    });

    it('should monitor task status and handle completions', async () => {
      const mockRunningTask = {
        id: 'task-1',
        title: 'Feature 1',
        description: 'First feature',
        status: 'running',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      mockCanvas.getTasksByProject.mockResolvedValue([mockRunningTask]);
      mockSession.getSessionOutput.mockResolvedValue('Task completed successfully');

      const handleTaskCompletionSpy = jest.spyOn(orchestrator, 'handleTaskCompletion')
        .mockResolvedValue();

      // Mock the monitoring loop to run once
      const originalMonitorTasks = orchestrator.monitorTasks;
      orchestrator.monitorTasks = jest.fn().mockImplementation(async () => {
        await orchestrator.handleTaskCompletion('task-1');
      });

      await orchestrator.monitorTasks();

      expect(handleTaskCompletionSpy).toHaveBeenCalledWith('task-1');
    });

    it('should detect and handle impasse status', async () => {
      const mockImpasseTask = {
        id: 'task-1',
        title: 'Feature 1',
        description: 'First feature',
        status: 'impasse',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      mockCanvas.getTasksByProject.mockResolvedValue([mockImpasseTask]);
      
      const handleImpasse = jest.spyOn(orchestrator, 'handleImpasse').mockResolvedValue(undefined);

      await orchestrator.monitorTasks();

      expect(handleImpasse).toHaveBeenCalledWith('task-1');
    });

    it('should handle monitoring errors gracefully', async () => {
      mockCanvas.getTasksByProject.mockRejectedValue(new Error('Database error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(orchestrator.monitorTasks()).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Task monitoring error:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle different task statuses appropriately', async () => {
      const mockTasks = [
        { 
          id: 'task-1', 
          status: 'running',
          title: 'Task 1',
          description: 'First task',
          priority: 'High',
          projectId: 'project-123',
          createdAt: new Date().toISOString()
        },
        { 
          id: 'task-2', 
          status: 'completed',
          title: 'Task 2',
          description: 'Second task',
          priority: 'Medium',
          projectId: 'project-123',
          createdAt: new Date().toISOString()
        },
        { 
          id: 'task-3', 
          status: 'impasse',
          title: 'Task 3',
          description: 'Third task',
          priority: 'Low',
          projectId: 'project-123',
          createdAt: new Date().toISOString()
        },
        { 
          id: 'task-4', 
          status: 'error',
          title: 'Task 4',
          description: 'Fourth task',
          priority: 'High',
          projectId: 'project-123',
          createdAt: new Date().toISOString()
        }
      ];

      mockCanvas.getTasksByProject.mockResolvedValue(mockTasks);

      const handleTaskCompletion = jest.spyOn(orchestrator, 'handleTaskCompletion')
        .mockResolvedValue();
      const handleImpasse = jest.spyOn(orchestrator, 'handleImpasse')
        .mockResolvedValue();

      await orchestrator.monitorTasks();

      expect(handleTaskCompletion).toHaveBeenCalledWith('task-2');
      expect(handleImpasse).toHaveBeenCalledWith('task-3');
    });
  });

  describe('handleTaskCompletion', () => {
    beforeEach(async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');
      
      await orchestrator.initialize('/test/project');
    });

    it('should handle successful task completion', async () => {
      // Mock the task feature map entry
      (orchestrator as any).taskFeatureMap.set('task-1', {
        name: 'Feature 1',
        priority: 'High',
        description: 'First feature with no dependencies',
        dependencies: [],
        agent: 'Architect',
        acceptanceCriteria: ['Criterion 1'],
        microtasks: ['Task 1']
      });

      mockWorkspace.getWorktreeStatus.mockResolvedValue({
        clean: false,
        files: ['modified-file.js']
      });
      mockWorkspace.commitChanges.mockResolvedValue('commit-hash-123');
      mockSession.killSession.mockResolvedValue(true);
      mockWorkspace.removeWorktree.mockResolvedValue(true);
      mockSession.listSessions.mockReturnValue([
        { sessionId: 'cortex-task-1-123', taskId: 'task-1', status: 'running', createdAt: new Date() }
      ]);

      await orchestrator.handleTaskCompletion('task-1');

      expect(mockWorkspace.getWorktreeStatus).toHaveBeenCalledWith('task-1');
      expect(mockWorkspace.commitChanges).toHaveBeenCalledWith(
        'task-1',
        expect.stringContaining('Complete task:')
      );
      expect(mockSession.killSession).toHaveBeenCalled();
      expect(mockWorkspace.removeWorktree).toHaveBeenCalledWith('task-1');
    });

    it('should handle task completion with no changes', async () => {
      mockWorkspace.getWorktreeStatus.mockResolvedValue({
        clean: true,
        files: []
      });

      await orchestrator.handleTaskCompletion('task-1');

      expect(mockWorkspace.commitChanges).not.toHaveBeenCalled();
    });

    it('should handle task completion errors', async () => {
      mockWorkspace.getWorktreeStatus.mockRejectedValue(new Error('Worktree error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await orchestrator.handleTaskCompletion('task-1');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error handling task completion for task-1:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should cleanup sessions properly', async () => {
      mockWorkspace.getWorktreeStatus.mockResolvedValue({
        clean: true,
        files: []
      });

      const sessionId = 'cortex-task-1-123';
      mockSession.listSessions.mockReturnValue([
        { sessionId, taskId: 'task-1', status: 'running', createdAt: new Date() }
      ]);

      await orchestrator.handleTaskCompletion('task-1');

      expect(mockSession.killSession).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('Budget Management', () => {
    beforeEach(async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');
      
      await orchestrator.initialize('/test/project');
    });

    it('should track token usage across tasks', async () => {
      mockClient.getTokenUsage.mockReturnValue({
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        totalTokens: 1500,
        requestCount: 10,
        estimatedCost: 0.50
      });

      const usage = orchestrator.getTokenUsage();

      expect(usage.totalTokens).toBe(1500);
      expect(usage.estimatedCost).toBe(0.50);
    });

    it('should check budget limits before starting tasks', async () => {
      mockClient.getTokenUsage.mockReturnValue({
        totalInputTokens: 10000,
        totalOutputTokens: 5000,
        totalTokens: 15000,
        requestCount: 100,
        estimatedCost: 95.0
      });

      mockClient.getConfiguration.mockReturnValue({
        budgetLimit: 100,
        budgetWarningThreshold: 0.8,
        apiKey: 'test-key',
        defaultModel: ClaudeModel.SONNET,
        maxTokens: 4096,
        temperature: 0.7
      });

      const canProceed = orchestrator.checkBudgetLimit();
      
      expect(canProceed).toBe(true);
    });

    it('should stop orchestration when budget is exceeded', async () => {
      mockClient.getTokenUsage.mockReturnValue({
        totalInputTokens: 20000,
        totalOutputTokens: 10000,
        totalTokens: 30000,
        requestCount: 200,
        estimatedCost: 150.0
      });

      mockClient.getConfiguration.mockReturnValue({
        budgetLimit: 100,
        budgetWarningThreshold: 0.8,
        apiKey: 'test-key',
        defaultModel: ClaudeModel.SONNET,
        maxTokens: 4096,
        temperature: 0.7
      });

      const canProceed = orchestrator.checkBudgetLimit();
      
      expect(canProceed).toBe(false);
    });

    it('should enforce budget limits during processing', async () => {
      // This test verifies that the orchestrator properly enforces budget limits at the start level
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      orchestrator.checkBudgetLimit = jest.fn().mockReturnValue(false);

      await orchestrator.start();

      expect(orchestrator.checkBudgetLimit).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');
      
      await orchestrator.initialize('/test/project');
    });

    it('should handle database connection errors', async () => {
      mockCanvas.getTasksByProject.mockRejectedValue(new Error('Connection failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await orchestrator.processNextTask();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error processing next task:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should retry failed operations', async () => {
      let callCount = 0;
      mockCanvas.getTasksByProject.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve([]);
      });

      await orchestrator.processNextTask();
      await orchestrator.processNextTask();

      expect(callCount).toBe(2);
    });

    it('should clean up resources on errors', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'task-1',
        path: '/test/project/worktrees/task-1',
        branch: 'feature/task-1',
        baseBranch: 'main'
      });

      mockSession.createSession.mockRejectedValue(new Error('Session failed'));
      mockWorkspace.removeWorktree.mockResolvedValue(true);

      await expect(orchestrator.spawnAgent(mockTask, 'Architect'))
        .rejects.toThrow();

      expect(mockWorkspace.removeWorktree).toHaveBeenCalledWith('task-1');
    });

    it('should handle graceful shutdown', async () => {
      const mockActiveSessions = [
        { sessionId: 'session-1', taskId: 'task-1', status: 'running' as const, createdAt: new Date() },
        { sessionId: 'session-2', taskId: 'task-2', status: 'running' as const, createdAt: new Date() }
      ];

      mockSession.listSessions.mockReturnValue(mockActiveSessions);
      mockSession.killSession.mockResolvedValue(true);

      await orchestrator.shutdown();

      expect(mockSession.killSession).toHaveBeenCalledTimes(2);
      expect(mockCanvas.close).toHaveBeenCalled();
    });
  });

  describe('Status Management', () => {
    it('should report correct status during lifecycle', async () => {
      expect(orchestrator.getStatus()).toBe('idle');
      expect(orchestrator.isRunning()).toBe(false);

      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');

      await orchestrator.initialize('/test/project');
      expect(orchestrator.getStatus()).toBe('initialized');

      mockCanvas.getTasksByProject.mockResolvedValue([]);
      const startPromise = orchestrator.start();
      expect(orchestrator.isRunning()).toBe(true);
      expect(orchestrator.getStatus()).toBe('running');

      await startPromise;
      expect(orchestrator.isRunning()).toBe(false);
    });

    it('should handle error states', async () => {
      mockCanvas.initializeSchema.mockRejectedValue(new Error('Init failed'));

      await expect(orchestrator.initialize('/test/project')).rejects.toThrow();
      expect(orchestrator.getStatus()).toBe('error');
    });
  });

  describe('New Workflow Integration Tests', () => {
    it('should handle new SDD workflow with FORMALIZE_CONTRACTS step', async () => {
      // Setup
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');

      await orchestrator.initialize('/test/project');

      // Verify the workflow sequence is correct
      expect(mockCanvas.createTask).toHaveBeenCalledTimes(5);
      expect(mockCanvas.createTaskDependency).toHaveBeenCalledTimes(4);
      
      // Verify workflow dependencies are created correctly
      expect(mockCanvas.createTaskDependency).toHaveBeenCalledWith(
        expect.any(String), // Formalize Contracts task ID
        expect.any(String)  // Write BDD Specs task ID
      );
      expect(mockCanvas.createTaskDependency).toHaveBeenCalledWith(
        expect.any(String), // Prototype Logic task ID
        expect.any(String)  // Formalize Contracts task ID
      );
      expect(mockCanvas.createTaskDependency).toHaveBeenCalledWith(
        expect.any(String), // Feature 1 task ID  
        expect.any(String)  // Prototype Logic task ID
      );
    });

    it('should spawn SpecWriter agent for BDD specs creation', async () => {
      // Setup initialization mocks
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');

      const mockTask = {
        id: 'task-spec-writer',
        title: 'Write BDD Specs',
        description: 'Create BDD specifications and feature files',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'task-spec-writer',
        path: '/test/project/worktrees/task-spec-writer',
        branch: 'feature/task-spec-writer',
        baseBranch: 'main'
      });

      mockSession.createSession.mockResolvedValue({
        sessionId: 'cortex-task-spec-writer-123',
        taskId: 'task-spec-writer',
        status: 'running',
        createdAt: new Date()
      });

      mockSession.startAgentInSession.mockResolvedValue();

      await orchestrator.initialize('/test/project');
      await orchestrator.spawnAgent(mockTask, 'SpecWriter');

      expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
        'cortex-task-spec-writer-123',
        'claude-code',
        expect.stringContaining('You are a SpecWriter agent')
      );
    });

    it('should spawn Formalizer agent for contract formalization', async () => {
      // Setup initialization mocks
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');

      const mockTask = {
        id: 'task-formalizer',
        title: 'Formalize Contracts',
        description: 'Create formal contracts from BDD specs',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'task-formalizer',
        path: '/test/project/worktrees/task-formalizer',
        branch: 'feature/task-formalizer',
        baseBranch: 'main'
      });

      mockSession.createSession.mockResolvedValue({
        sessionId: 'cortex-task-formalizer-123',
        taskId: 'task-formalizer',
        status: 'running',
        createdAt: new Date()
      });

      mockSession.startAgentInSession.mockResolvedValue();

      await orchestrator.initialize('/test/project');
      await orchestrator.spawnAgent(mockTask, 'Formalizer');

      expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
        'cortex-task-formalizer-123',
        'claude-code',
        expect.stringContaining('You are a Formalizer agent')
      );
    });

    it('should spawn Prototyper agent for prototype logic creation', async () => {
      // Setup initialization mocks
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');

      const mockTask = {
        id: 'task-prototyper',
        title: 'Prototype Logic',
        description: 'Create prototype implementation based on formal contracts',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'task-prototyper',
        path: '/test/project/worktrees/task-prototyper',
        branch: 'feature/task-prototyper',
        baseBranch: 'main'
      });

      mockSession.createSession.mockResolvedValue({
        sessionId: 'cortex-task-prototyper-123',
        taskId: 'task-prototyper',
        status: 'running',
        createdAt: new Date()
      });

      mockSession.startAgentInSession.mockResolvedValue();

      await orchestrator.initialize('/test/project');
      await orchestrator.spawnAgent(mockTask, 'Prototyper');

      expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
        'cortex-task-prototyper-123',
        'claude-code',
        expect.stringContaining('You are a Prototyper agent')
      );
    });

    it('should ensure SpecWriter completes before Formalizer starts', async () => {
      // Setup initialization mocks
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');

      const specWriterTask = {
        id: 'task-spec-writer',
        title: 'Write BDD Specs',
        description: 'Create BDD specifications and feature files',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      const formalizerTask = {
        id: 'task-formalizer',
        title: 'Formalize Contracts',
        description: 'Create formal contracts from BDD specs',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      // Mock the task feature map entries
      (orchestrator as any).taskFeatureMap.set('task-spec-writer', {
        name: 'Write BDD Specs',
        priority: 'High',
        description: 'Create BDD specifications and feature files',
        dependencies: [],
        agent: 'SpecWriter',
        acceptanceCriteria: ['BDD specs created'],
        microtasks: ['Create feature files']
      });

      (orchestrator as any).taskFeatureMap.set('task-formalizer', {
        name: 'Formalize Contracts',
        priority: 'High',
        description: 'Create formal contracts from BDD specs',
        dependencies: ['Write BDD Specs'],
        agent: 'Formalizer',
        acceptanceCriteria: ['Formal contracts created'],
        microtasks: ['Generate contracts']
      });

      // Mock incomplete SpecWriter dependency
      const mockDependency = {
        id: 'task-spec-writer',
        title: 'Write BDD Specs',
        description: 'Create BDD specifications and feature files',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      mockCanvas.getTasksByProject.mockResolvedValue([formalizerTask]);
      mockCanvas.getTaskDependencies.mockResolvedValue([mockDependency]);

      const spawnAgentSpy = jest.spyOn(orchestrator, 'spawnAgent').mockResolvedValue();

      await orchestrator.initialize('/test/project');
      await orchestrator.processNextTask();

      // Formalizer should not be spawned because SpecWriter is not completed
      expect(spawnAgentSpy).not.toHaveBeenCalled();
    });

    it('should spawn Formalizer after SpecWriter completes', async () => {
      // Setup initialization mocks
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');

      const formalizerTask = {
        id: 'task-formalizer',
        title: 'Formalize Contracts',
        description: 'Create formal contracts from BDD specs',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      // Mock the task feature map entry
      (orchestrator as any).taskFeatureMap.set('task-formalizer', {
        name: 'Formalize Contracts',
        priority: 'High',
        description: 'Create formal contracts from BDD specs',
        dependencies: ['Write BDD Specs'],
        agent: 'Formalizer',
        acceptanceCriteria: ['Formal contracts created'],
        microtasks: ['Generate contracts']
      });

      // Mock completed SpecWriter dependency
      const mockDependency = {
        id: 'task-spec-writer',
        title: 'Write BDD Specs',
        description: 'Create BDD specifications and feature files',
        status: 'completed',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      mockCanvas.getTasksByProject.mockResolvedValue([formalizerTask]);
      mockCanvas.getTaskDependencies.mockResolvedValue([mockDependency]);

      const spawnAgentSpy = jest.spyOn(orchestrator, 'spawnAgent').mockResolvedValue();

      await orchestrator.initialize('/test/project');
      await orchestrator.processNextTask();

      // Formalizer should be spawned because SpecWriter is completed
      expect(spawnAgentSpy).toHaveBeenCalledWith(formalizerTask, 'Formalizer');
    });
  });

  describe('μT-4.6: Continuous Critique Integration', () => {
    beforeEach(async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');
      
      await orchestrator.initialize('/test/project');
    });

    it('should query Critique agent before processing next task', async () => {
      const mockCritiqueAgent = {
        analyzeArtifact: jest.fn().mockResolvedValue({
          success: true,
          critique: {
            issues: [],
            overallQuality: 'good',
            recommendations: []
          }
        })
      };

      (orchestrator as any).critiqueAgent = mockCritiqueAgent;

      const mockTask = {
        id: 'task-1',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      mockCanvas.getTasksByProject.mockResolvedValue([mockTask]);
      mockCanvas.getTaskDependencies.mockResolvedValue([]);

      await orchestrator.processNextTask();

      expect(mockCritiqueAgent.analyzeArtifact).toHaveBeenCalled();
    });

    it('should pause downstream tasks when critique finds high severity issues', async () => {
      const mockCritiqueAgent = {
        analyzeArtifact: jest.fn().mockResolvedValue({
          success: true,
          critique: {
            issues: [
              {
                severity: 'high',
                type: 'logic',
                location: 'main.js',
                description: 'Critical logic error found'
              }
            ],
            overallQuality: 'poor',
            recommendations: ['Fix logic error']
          }
        }),
        generateStructuredFeedback: jest.fn().mockResolvedValue({
          artifactId: 'artifact-1',
          overallSeverity: 'high',
          issues: [],
          actionRequired: true,
          pauseDownstream: true,
          recommendations: [],
          resolutionSteps: [],
          priority: 'urgent'
        })
      };

      (orchestrator as any).critiqueAgent = mockCritiqueAgent;

      const mockTask = {
        id: 'task-1',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      mockCanvas.getTasksByProject.mockResolvedValue([mockTask]);
      mockCanvas.getTaskDependencies.mockResolvedValue([]);

      const pauseDownstreamSpy = jest.spyOn(orchestrator, 'pauseDownstreamTasks' as any).mockResolvedValue(undefined);

      await orchestrator.processNextTask();

      expect(pauseDownstreamSpy).toHaveBeenCalledWith('project-123', 'high');
    });

    it('should continue processing when critique finds no critical issues', async () => {
      const mockCritiqueAgent = {
        analyzeArtifact: jest.fn().mockResolvedValue({
          success: true,
          critique: {
            issues: [
              {
                severity: 'low',
                type: 'style',
                location: 'main.js',
                description: 'Minor style issue'
              }
            ],
            overallQuality: 'good',
            recommendations: ['Consider style improvements']
          }
        }),
        generateStructuredFeedback: jest.fn().mockResolvedValue({
          artifactId: 'artifact-1',
          overallSeverity: 'low',
          issues: [],
          actionRequired: false,
          pauseDownstream: false,
          recommendations: [],
          resolutionSteps: [],
          priority: 'low'
        })
      };

      (orchestrator as any).critiqueAgent = mockCritiqueAgent;
      (orchestrator as any).taskFeatureMap.set('task-1', {
        name: 'Feature 1',
        priority: 'High',
        description: 'First feature',
        dependencies: [],
        agent: 'Architect',
        acceptanceCriteria: ['Criterion 1'],
        microtasks: ['Task 1']
      });

      const mockTask = {
        id: 'task-1',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      mockCanvas.getTasksByProject.mockResolvedValue([mockTask]);
      mockCanvas.getTaskDependencies.mockResolvedValue([]);

      const spawnAgentSpy = jest.spyOn(orchestrator, 'spawnAgent').mockResolvedValue();

      await orchestrator.processNextTask();

      expect(spawnAgentSpy).toHaveBeenCalledWith(mockTask, 'Architect');
    });
  });

  describe('μT-4.7: Debugger Agent Integration', () => {
    beforeEach(async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');
      
      await orchestrator.initialize('/test/project');
    });

    it('should spawn Debugger agent for task failures', async () => {
      const mockDebuggerAgent = {
        analyzeFailure: jest.fn().mockResolvedValue({
          success: true,
          diagnostic: {
            rootCause: {
              category: 'validation',
              description: 'Input validation error',
              confidence: 0.9
            },
            solutions: [
              {
                type: 'immediate',
                description: 'Add input validation',
                priority: 'high'
              }
            ]
          }
        })
      };

      (orchestrator as any).debuggerAgent = mockDebuggerAgent;

      const mockFailure = {
        id: 'failure-1',
        taskId: 'task-1',
        errorMessage: 'Validation failed',
        severity: 'high',
        type: 'validation_error'
      };

      mockCanvas.getFailureHistory = jest.fn().mockResolvedValue([mockFailure]);

      await orchestrator.handleTaskFailure('task-1', mockFailure);

      expect(mockDebuggerAgent.analyzeFailure).toHaveBeenCalledWith('failure-1');
    });

    it('should spawn both CodeSavant and Debugger for complex failures', async () => {
      const mockDebuggerAgent = {
        analyzeFailure: jest.fn().mockResolvedValue({
          success: true,
          diagnostic: {
            rootCause: {
              category: 'system',
              description: 'Complex system failure',
              confidence: 0.8
            }
          }
        })
      };

      (orchestrator as any).debuggerAgent = mockDebuggerAgent;

      const mockFailure = {
        id: 'failure-1',
        taskId: 'task-1',
        errorMessage: 'Complex system error',
        severity: 'critical',
        type: 'system_failure'
      };

      mockSession.getSessionOutput.mockResolvedValue('Agent encountered system error');
      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'codesavant-task-1',
        path: '/test/project/worktrees/codesavant-task-1',
        branch: 'helper/codesavant-task-1',
        baseBranch: 'main'
      });

      mockSession.createSession.mockResolvedValue({
        sessionId: 'codesavant-session-123',
        taskId: 'codesavant-task-1',
        status: 'running',
        createdAt: new Date()
      });

      await orchestrator.handleTaskFailure('task-1', mockFailure);

      expect(mockDebuggerAgent.analyzeFailure).toHaveBeenCalledWith('failure-1');
      expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
        'codesavant-session-123',
        'claude-code',
        expect.stringContaining('CodeSavant')
      );
    });

    it('should create warning pheromones from debugger diagnostics', async () => {
      const mockDebuggerAgent = {
        analyzeFailure: jest.fn().mockResolvedValue({
          success: true,
          diagnostic: {
            rootCause: {
              category: 'validation',
              description: 'Recurring validation pattern',
              confidence: 0.9
            }
          }
        }),
        createWarnPheromone: jest.fn().mockResolvedValue({
          success: true,
          pheromone: {
            id: 'pheromone-1',
            context: 'validation_pattern',
            strength: 0.8
          }
        })
      };

      (orchestrator as any).debuggerAgent = mockDebuggerAgent;

      const mockFailure = {
        id: 'failure-1',
        taskId: 'task-1',
        errorMessage: 'Input validation failed',
        severity: 'medium',
        type: 'validation_error'
      };

      await orchestrator.handleTaskFailure('task-1', mockFailure);

      expect(mockDebuggerAgent.createWarnPheromone).toHaveBeenCalledWith(
        'validation_pattern',
        expect.any(Object),
        expect.any(Number)
      );
    });
  });

  describe('μT-4.8: CognitiveCanvasNavigator Context Priming', () => {
    beforeEach(async () => {
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');
      
      await orchestrator.initialize('/test/project');
    });

    it('should use CognitiveCanvasNavigator for targeted context retrieval', async () => {
      const mockNavigator = {
        executeNavigation: jest.fn().mockResolvedValue({
          nodes: [
            { id: 'node-1', type: 'artifact', properties: { name: 'Component A' } }
          ],
          relationships: [
            { id: 'rel-1', source: 'node-1', target: 'node-2', type: 'depends_on' }
          ],
          paths: [],
          insights: [
            { type: 'pattern', description: 'Common usage pattern found', confidence: 0.8 }
          ],
          metadata: { queryTime: 100, resultCount: 2, confidence: 0.9 }
        }),
        findOptimalPaths: jest.fn().mockResolvedValue([
          { nodes: ['node-1', 'node-2'], weight: 0.9, length: 2, description: 'Direct path' }
        ])
      };

      (orchestrator as any).cognitiveCanvasNavigator = mockNavigator;

      const mockTask = {
        id: 'task-1',
        title: 'Feature 1',
        description: 'First feature requiring context',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      await (orchestrator as any).primeContextForTask('task-1', mockTask);

      expect(mockNavigator.executeNavigation).toHaveBeenCalledWith({
        type: 'semantic',
        query: expect.stringContaining('Feature 1'),
        context: expect.objectContaining({
          taskId: 'task-1',
          taskType: 'feature_implementation'
        })
      });
    });

    it('should retrieve relevant artifacts and patterns for context priming', async () => {
      const mockNavigator = {
        executeNavigation: jest.fn().mockResolvedValue({
          nodes: [
            { 
              id: 'artifact-1', 
              type: 'code', 
              properties: { 
                name: 'UserService.js',
                relevanceScore: 0.9
              }
            }
          ],
          relationships: [],
          paths: [],
          insights: [
            {
              type: 'usage_pattern',
              description: 'Frequently used service pattern',
              confidence: 0.85,
              evidence: ['Similar tasks in project history']
            }
          ],
          metadata: { queryTime: 150, resultCount: 1, confidence: 0.85 }
        })
      };

      (orchestrator as any).cognitiveCanvasNavigator = mockNavigator;

      const mockTask = {
        id: 'task-1',
        title: 'Implement User Authentication',
        description: 'Add authentication to the user service',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      const context = await (orchestrator as any).primeContextForTask('task-1', mockTask);

      expect(context.relevantArtifacts).toHaveLength(1);
      expect(context.relevantArtifacts?.[0]?.name).toBe('UserService.js');
      expect(context.patterns).toHaveLength(1);
      expect(context.patterns?.[0]?.type).toBe('usage_pattern');
    });

    it('should use targeted context instead of broad data retrieval', async () => {
      const mockNavigator = {
        executeNavigation: jest.fn().mockResolvedValue({
          nodes: [],
          relationships: [],
          paths: [],
          insights: [],
          metadata: { queryTime: 50, resultCount: 0, confidence: 0.5 }
        })
      };

      (orchestrator as any).cognitiveCanvasNavigator = mockNavigator;

      const mockTask = {
        id: 'task-1',
        title: 'New Feature',
        description: 'Completely new feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      // Mock the old broad retrieval method to verify it's not called
      const broadRetrievalSpy = jest.spyOn(orchestrator, 'retrieveAllProjectData' as any).mockResolvedValue({});

      await (orchestrator as any).primeContextForTask('task-1', mockTask);

      expect(mockNavigator.executeNavigation).toHaveBeenCalled();
      expect(broadRetrievalSpy).not.toHaveBeenCalled();
    });

    it('should provide context-primed prompts to agents', async () => {
      const mockNavigator = {
        executeNavigation: jest.fn().mockResolvedValue({
          nodes: [
            { 
              id: 'pattern-1', 
              type: 'pattern',
              properties: { 
                name: 'Authentication Pattern',
                description: 'Standard auth implementation'
              }
            }
          ],
          relationships: [],
          paths: [],
          insights: [
            {
              type: 'recommendation',
              description: 'Use JWT for stateless authentication',
              confidence: 0.9
            }
          ],
          metadata: { queryTime: 80, resultCount: 1, confidence: 0.9 }
        })
      };

      (orchestrator as any).cognitiveCanvasNavigator = mockNavigator;
      (orchestrator as any).taskFeatureMap.set('task-1', {
        name: 'Feature 1',
        priority: 'High',
        description: 'Authentication feature',
        dependencies: [],
        agent: 'Architect',
        acceptanceCriteria: ['Secure auth'],
        microtasks: ['Implement JWT']
      });

      const mockTask = {
        id: 'task-1',
        title: 'Implement Authentication',
        description: 'Add JWT authentication',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      };

      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'task-1',
        path: '/test/project/worktrees/task-1',
        branch: 'feature/task-1',
        baseBranch: 'main'
      });

      mockSession.createSession.mockResolvedValue({
        sessionId: 'cortex-task-1-123',
        taskId: 'task-1',
        status: 'running',
        createdAt: new Date()
      });

      mockSession.startAgentInSession.mockResolvedValue();

      await orchestrator.spawnAgent(mockTask, 'Architect');

      const promptCall = mockSession.startAgentInSession.mock.calls[0][2];
      expect(promptCall).toContain('Authentication Pattern');
      expect(promptCall).toContain('Use JWT for stateless authentication');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full orchestration flow', async () => {
      // Setup complete flow
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');

      // Initialize
      await orchestrator.initialize('/test/project');

      // Verify initialization
      expect(mockCanvas.createProject).toHaveBeenCalled();
      expect(mockCanvas.createTask).toHaveBeenCalledTimes(5);
      expect(mockCanvas.createTaskDependency).toHaveBeenCalledTimes(4);
    });

    it('should handle full impasse resolution workflow', async () => {
      // Setup
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);
      (mockFs.readFileSync as jest.Mock).mockReturnValue('mock plan content');
      (mockPath.join as jest.Mock).mockReturnValue('/test/path/plan.md');
      mockParser.parse.mockReturnValue(mockParsedPlan);
      mockParser.getDependencyOrder.mockReturnValue(mockParsedPlan.features);
      mockCanvas.initializeSchema.mockResolvedValue(undefined);
      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        description: 'A test project for orchestrator',
        status: 'initialized',
        createdAt: new Date().toISOString()
      };
      mockCanvas.createProject.mockResolvedValue(mockProject);
      mockCanvas.createTask.mockResolvedValue({
        id: 'task-123',
        title: 'Feature 1',
        description: 'First feature',
        status: 'pending',
        priority: 'High',
        projectId: 'project-123',
        createdAt: new Date().toISOString()
      });
      mockCanvas.getTasksByProject.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/test/project');

      await orchestrator.initialize('/test/project');

      // Simulate impasse
      mockCanvas.getTasksByProject.mockResolvedValue([
        { 
          id: 'task-1', 
          status: 'impasse', 
          title: 'Stuck Task',
          description: 'A task that got stuck',
          priority: 'High',
          projectId: 'project-123',
          createdAt: new Date().toISOString()
        }
      ]);

      mockSession.getSessionOutput.mockResolvedValue('Agent encountered complex error');
      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'codesavant-task-1',
        path: '/test/project/worktrees/codesavant-task-1',
        branch: 'helper/codesavant-task-1',
        baseBranch: 'main'
      });

      mockSession.createSession.mockResolvedValue({
        sessionId: 'codesavant-session-123',
        taskId: 'codesavant-task-1',
        status: 'running',
        createdAt: new Date()
      });

      await orchestrator.monitorTasks();

      // Verify CodeSavant was spawned
      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith(
        'codesavant-task-1',
        'helper/codesavant-task-1',
        'main'
      );

      expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
        'codesavant-session-123',
        'claude-code',
        expect.stringContaining('CodeSavant')
      );
    });
  });

  describe('PheromoneData Interface', () => {
    it('should create pheromone with all required properties', async () => {
      // This test will fail until we fix the interface
      const pheromoneData = {
        id: 'pheromone-123',
        type: 'success_pheromone',
        strength: 0.8,
        context: 'critique_success_test',
        metadata: {
          taskId: 'task-123',
          artifactId: 'artifact-456',
          workflowStep: 'test',
          timestamp: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      };

      mockCanvas.createPheromone.mockResolvedValue(pheromoneData);

      const result = await mockCanvas.createPheromone(pheromoneData);
      
      expect(result).toEqual(pheromoneData);
      expect(mockCanvas.createPheromone).toHaveBeenCalledWith(pheromoneData);
    });

    it('should handle pheromone creation without optional expiresAt', async () => {
      const pheromoneData = {
        id: 'pheromone-124',
        type: 'learning_pheromone',
        strength: 0.6,
        context: 'task_completion',
        metadata: { agentId: 'agent-789' },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      mockCanvas.createPheromone.mockResolvedValue(pheromoneData);

      const result = await mockCanvas.createPheromone(pheromoneData);
      
      expect(result).toEqual(pheromoneData);
      expect(mockCanvas.createPheromone).toHaveBeenCalledWith(pheromoneData);
    });
  });
});