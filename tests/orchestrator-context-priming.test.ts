import { Orchestrator, OrchestratorConfig } from '../src/orchestrator';
import { ContextPrimer, ContextData } from '../src/context-primer';
import { TemplateEngine } from '../src/template-engine';
import { CognitiveCanvas } from '../src/cognitive-canvas';
import { WorkspaceManager } from '../src/workspace';
import { SessionManager } from '../src/session';
import { PlanParser } from '../src/plan-parser';
import { ClaudeClient } from '../src/claude-client';
import * as fs from 'fs';

// Mock all dependencies
jest.mock('../src/cognitive-canvas');
jest.mock('../src/plan-parser');
jest.mock('../src/claude-client');
jest.mock('../src/workspace');
jest.mock('../src/session');
jest.mock('../src/context-primer');
jest.mock('../src/template-engine');
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

const mockCognitiveCanvas = CognitiveCanvas as jest.MockedClass<typeof CognitiveCanvas>;
const mockContextPrimer = ContextPrimer as jest.MockedClass<typeof ContextPrimer>;
const mockTemplateEngine = TemplateEngine as jest.MockedClass<typeof TemplateEngine>;
const mockWorkspaceManager = WorkspaceManager as jest.MockedClass<typeof WorkspaceManager>;
const mockSessionManager = SessionManager as jest.MockedClass<typeof SessionManager>;
const mockPlanParser = PlanParser as jest.MockedClass<typeof PlanParser>;
const mockClaudeClient = ClaudeClient as jest.MockedClass<typeof ClaudeClient>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Orchestrator Context Priming', () => {
  let orchestrator: Orchestrator;
  let mockCanvas: jest.Mocked<CognitiveCanvas>;
  let mockPrimer: jest.Mocked<ContextPrimer>;
  let mockTemplate: jest.Mocked<TemplateEngine>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockSession: jest.Mocked<SessionManager>;
  let mockParser: jest.Mocked<PlanParser>;
  let mockClient: jest.Mocked<ClaudeClient>;

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

  const mockTask = {
    id: 'task-1',
    title: 'Implement authentication',
    description: 'Create JWT-based authentication system',
    status: 'pending',
    priority: 'high',
    projectId: 'project-1',
    createdAt: new Date().toISOString()
  };

  const mockContextData: ContextData = {
    architecturalDecisions: [
      {
        id: 'arch-1',
        title: 'Authentication Strategy',
        description: 'Use JWT tokens for stateless authentication',
        rationale: 'Scalability and security',
        status: 'approved',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      }
    ],
    codeModules: [
      {
        id: 'module-1',
        name: 'AuthService',
        filePath: '/src/auth/auth.service.ts',
        type: 'class',
        language: 'typescript',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      }
    ],
    contracts: [
      {
        id: 'contract-1',
        name: 'Auth API',
        type: 'openapi',
        version: '1.0.0',
        specification: { paths: { '/auth/login': {} } },
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      }
    ],
    pheromones: [
      {
        id: 'pheromone-1',
        type: 'success',
        strength: 0.8,
        context: 'JWT implementation successful',
        metadata: { pattern: 'authentication' },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      }
    ],
    dependencies: [],
    similarTasks: [],
    workspaceFiles: [],
    contractSnippets: []
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockCanvas = {
      initializeSchema: jest.fn(),
      createProject: jest.fn(),
      createTask: jest.fn(),
      createTaskDependency: jest.fn(),
      getTasksByProject: jest.fn(),
      storeArchitecturalDecision: jest.fn(),
      close: jest.fn()
    } as any;

    mockPrimer = {
      primeContext: jest.fn()
    } as any;

    mockTemplate = {
      render: jest.fn()
    } as any;

    mockWorkspace = {
      getProjectRoot: jest.fn(),
      createWorktree: jest.fn(),
      removeWorktree: jest.fn()
    } as any;

    mockSession = {
      createSession: jest.fn(),
      startAgentInSession: jest.fn(),
      getSessionOutput: jest.fn()
    } as any;

    mockParser = {
      parse: jest.fn(),
      getDependencyOrder: jest.fn()
    } as any;

    mockClient = {
      getTokenUsage: jest.fn(),
      getConfiguration: jest.fn()
    } as any;

    // Setup constructors
    mockCognitiveCanvas.mockImplementation(() => mockCanvas);
    mockContextPrimer.mockImplementation(() => mockPrimer);
    mockTemplateEngine.mockImplementation(() => mockTemplate);
    mockWorkspaceManager.mockImplementation(() => mockWorkspace);
    mockSessionManager.mockImplementation(() => mockSession);
    mockPlanParser.mockImplementation(() => mockParser);
    mockClaudeClient.mockImplementation(() => mockClient);

    orchestrator = new Orchestrator(mockConfig);
  });

  describe('initialization with context priming', () => {
    it('should initialize context primer and template engine with correct paths', () => {
      expect(mockContextPrimer).toHaveBeenCalledWith(
        mockCanvas,
        mockWorkspace,
        './test-contracts'
      );
      expect(mockTemplateEngine).toHaveBeenCalledWith('./test-prompts');
    });

    it('should use default paths when not specified', () => {
      const configWithoutPaths = {
        neo4j: mockConfig.neo4j,
        claude: mockConfig.claude
      };
      
      new Orchestrator(configWithoutPaths);

      expect(mockContextPrimer).toHaveBeenCalledWith(
        mockCanvas,
        mockWorkspace,
        './contracts'
      );
      expect(mockTemplateEngine).toHaveBeenCalledWith('./prompts');
    });
  });

  describe('generateAgentPrompt with context priming', () => {
    beforeEach(() => {
      // Setup successful initialization
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock plan content');
      mockParser.parse.mockReturnValue({
        title: 'Test Project',
        overview: 'A test project',
        features: [],
        architectureDecisions: { technologyStack: {}, qualityStandards: {} }
      });
      mockCanvas.createProject.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
        description: 'A test project',
        status: 'initialized',
        createdAt: new Date().toISOString()
      });
    });

    it('should fetch context and render template for agent prompt', async () => {
      // Setup mocks
      mockPrimer.primeContext.mockResolvedValue(mockContextData);
      mockTemplate.render.mockResolvedValueOnce('Agent role instructions');
      mockTemplate.render.mockResolvedValueOnce('Complete contextualized prompt');

      // Initialize orchestrator
      await orchestrator.initialize('/test/project');

      // Access private method for testing
      const prompt = await (orchestrator as any).generateAgentPrompt(mockTask, 'Coder');

      expect(mockPrimer.primeContext).toHaveBeenCalledWith(
        mockTask,
        'Coder',
        'project-1'
      );

      expect(mockTemplate.render).toHaveBeenCalledWith(
        'agents/coder.md',
        mockContextData
      );

      expect(mockTemplate.render).toHaveBeenCalledWith(
        'templates/base-agent.md',
        expect.objectContaining({
          agentType: 'Coder',
          task: mockTask,
          architecturalDecisions: mockContextData.architecturalDecisions,
          codeModules: mockContextData.codeModules,
          contracts: mockContextData.contracts,
          pheromones: mockContextData.pheromones,
          roleInstructions: 'Agent role instructions'
        })
      );

      expect(prompt).toBe('Complete contextualized prompt');
    });

    it('should fall back to simple prompt when context priming fails', async () => {
      mockPrimer.primeContext.mockRejectedValue(new Error('Context fetch failed'));

      await orchestrator.initialize('/test/project');

      const prompt = await (orchestrator as any).generateAgentPrompt(mockTask, 'SpecWriter');

      expect(prompt).toContain('You are a SpecWriter agent');
      expect(prompt).toContain('Create comprehensive BDD specifications');
    });

    it('should fall back to simple role instructions when template loading fails', async () => {
      mockPrimer.primeContext.mockResolvedValue(mockContextData);
      mockTemplate.render.mockRejectedValueOnce(new Error('Template not found'));
      mockTemplate.render.mockResolvedValueOnce('Prompt with fallback instructions');

      await orchestrator.initialize('/test/project');

      const prompt = await (orchestrator as any).generateAgentPrompt(mockTask, 'Architect');

      expect(mockTemplate.render).toHaveBeenCalledWith(
        'templates/base-agent.md',
        expect.objectContaining({
          roleInstructions: expect.stringContaining('Design system architecture')
        })
      );
    });

    it('should limit context data for template readability', async () => {
      const largeContextData = {
        ...mockContextData,
        codeModules: Array.from({ length: 10 }, (_, i) => ({
          ...mockContextData.codeModules[0],
          id: `module-${i}`,
          name: `Module ${i}`
        })),
        pheromones: Array.from({ length: 10 }, (_, i) => ({
          ...mockContextData.pheromones[0],
          id: `pheromone-${i}`,
          context: `Context ${i}`
        }))
      };

      mockPrimer.primeContext.mockResolvedValue(largeContextData);
      mockTemplate.render.mockResolvedValue('prompt');

      await orchestrator.initialize('/test/project');
      await (orchestrator as any).generateAgentPrompt(mockTask, 'Coder');

      const templateCall = mockTemplate.render.mock.calls.find(
        call => call[0] === 'templates/base-agent.md'
      );
      const templateContext = templateCall![1];

      expect(templateContext.codeModules).toHaveLength(5);
      expect(templateContext.pheromones).toHaveLength(3);
    });
  });

  describe('generateCodeSavantPrompt with context priming', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock plan content');
      mockParser.parse.mockReturnValue({
        title: 'Test Project',
        overview: 'A test project',
        features: [],
        architectureDecisions: { technologyStack: {}, qualityStandards: {} }
      });
      mockCanvas.createProject.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
        description: 'A test project',
        status: 'initialized',
        createdAt: new Date().toISOString()
      });
    });

    it('should generate context-primed CodeSavant prompt', async () => {
      mockCanvas.getTasksByProject.mockResolvedValue([mockTask]);
      mockPrimer.primeContext.mockResolvedValue(mockContextData);
      mockTemplate.render.mockResolvedValue('CodeSavant contextualized prompt');

      await orchestrator.initialize('/test/project');

      const originalContext = 'Agent got stuck on authentication implementation';
      const prompt = await (orchestrator as any).generateCodeSavantPrompt('task-1', originalContext);

      expect(mockPrimer.primeContext).toHaveBeenCalledWith(
        mockTask,
        'Coder',
        'project-1'
      );

      expect(mockTemplate.render).toHaveBeenCalledWith(
        'agents/codesavant.md',
        expect.objectContaining({
          taskId: 'task-1',
          originalContext,
          task: mockTask,
          architecturalDecisions: mockContextData.architecturalDecisions,
          codeModules: mockContextData.codeModules,
          contracts: mockContextData.contracts
        })
      );

      expect(prompt).toBe('CodeSavant contextualized prompt');
    });

    it('should fall back when task is not found', async () => {
      mockCanvas.getTasksByProject.mockResolvedValue([]);

      await orchestrator.initialize('/test/project');

      const prompt = await (orchestrator as any).generateCodeSavantPrompt('nonexistent-task', 'context');

      expect(prompt).toContain('You are CodeSavant');
      expect(prompt).toContain('specialized helper agent');
    });

    it('should fall back when context priming fails', async () => {
      mockCanvas.getTasksByProject.mockResolvedValue([mockTask]);
      mockPrimer.primeContext.mockRejectedValue(new Error('Context error'));

      await orchestrator.initialize('/test/project');

      const prompt = await (orchestrator as any).generateCodeSavantPrompt('task-1', 'original context');

      expect(prompt).toContain('You are CodeSavant');
      expect(prompt).toContain('original context');
    });
  });

  describe('agent spawning with context priming', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock plan content');
      mockParser.parse.mockReturnValue({
        title: 'Test Project',
        overview: 'A test project',
        features: [],
        architectureDecisions: { technologyStack: {}, qualityStandards: {} }
      });
      mockCanvas.createProject.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
        description: 'A test project',
        status: 'initialized',
        createdAt: new Date().toISOString()
      });

      mockWorkspace.createWorktree.mockResolvedValue({
        id: 'task-1',
        path: '/test/worktrees/task-1',
        branch: 'feature/task-1',
        baseBranch: 'main'
      });

      mockSession.createSession.mockResolvedValue({
        sessionId: 'session-1',
        taskId: 'task-1',
        status: 'running',
        createdAt: new Date()
      });
    });

    it('should use context-primed prompt when spawning agent', async () => {
      mockPrimer.primeContext.mockResolvedValue(mockContextData);
      mockTemplate.render.mockResolvedValue('Context-primed prompt for agent');

      await orchestrator.initialize('/test/project');
      await orchestrator.spawnAgent(mockTask, 'Architect');

      expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
        'session-1',
        'claude-code',
        'Context-primed prompt for agent'
      );
    });

    it('should handle prompt generation errors gracefully', async () => {
      mockPrimer.primeContext.mockRejectedValue(new Error('Context failed'));

      await orchestrator.initialize('/test/project');
      await orchestrator.spawnAgent(mockTask, 'Coder');

      // Should still start agent with fallback prompt
      expect(mockSession.startAgentInSession).toHaveBeenCalledWith(
        'session-1',
        'claude-code',
        expect.stringContaining('You are a Coder agent')
      );
    });
  });

  describe('different agent types context preferences', () => {
    beforeEach(async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock plan content');
      mockParser.parse.mockReturnValue({
        title: 'Test Project',
        overview: 'A test project',
        features: [],
        architectureDecisions: { technologyStack: {}, qualityStandards: {} }
      });
      mockCanvas.createProject.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
        description: 'A test project',
        status: 'initialized',
        createdAt: new Date().toISOString()
      });

      await orchestrator.initialize('/test/project');
    });

    it('should provide appropriate context for SpecWriter', async () => {
      mockPrimer.primeContext.mockResolvedValue(mockContextData);
      mockTemplate.render.mockResolvedValue('SpecWriter prompt');

      await (orchestrator as any).generateAgentPrompt(mockTask, 'SpecWriter');

      expect(mockPrimer.primeContext).toHaveBeenCalledWith(
        mockTask,
        'SpecWriter',
        'project-1'
      );
    });

    it('should provide appropriate context for Formalizer', async () => {
      mockPrimer.primeContext.mockResolvedValue(mockContextData);
      mockTemplate.render.mockResolvedValue('Formalizer prompt');

      await (orchestrator as any).generateAgentPrompt(mockTask, 'Formalizer');

      expect(mockPrimer.primeContext).toHaveBeenCalledWith(
        mockTask,
        'Formalizer',
        'project-1'
      );
    });

    it('should provide appropriate context for Tester', async () => {
      mockPrimer.primeContext.mockResolvedValue(mockContextData);
      mockTemplate.render.mockResolvedValue('Tester prompt');

      await (orchestrator as any).generateAgentPrompt(mockTask, 'Tester');

      expect(mockPrimer.primeContext).toHaveBeenCalledWith(
        mockTask,
        'Tester',
        'project-1'
      );
    });
  });
});