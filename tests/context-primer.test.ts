import { ContextPrimer, ContextData } from '../src/context-primer';
import { CognitiveCanvas, TaskData, PheromoneData, ArchitecturalDecisionData, ContractData, CodeModuleData } from '../src/cognitive-canvas';
import { WorkspaceManager } from '../src/workspace';
import { AgentType } from '../src/orchestrator';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
jest.mock('../src/cognitive-canvas');
jest.mock('../src/workspace');
jest.mock('fs/promises');

const mockCognitiveCanvas = CognitiveCanvas as jest.MockedClass<typeof CognitiveCanvas>;
const mockWorkspaceManager = WorkspaceManager as jest.MockedClass<typeof WorkspaceManager>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ContextPrimer', () => {
  let contextPrimer: ContextPrimer;
  let mockCanvas: jest.Mocked<CognitiveCanvas>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;

  const mockTask: TaskData = {
    id: 'task-1',
    title: 'Implement user authentication',
    description: 'Create JWT-based authentication system',
    status: 'pending',
    priority: 'high',
    projectId: 'project-1',
    createdAt: new Date().toISOString()
  };

  const mockArchitecturalDecisions: ArchitecturalDecisionData[] = [
    {
      id: 'arch-1',
      title: 'Authentication Architecture',
      description: 'Use JWT tokens for stateless authentication',
      rationale: 'Scalability and stateless design',
      status: 'approved',
      projectId: 'project-1',
      createdAt: new Date().toISOString()
    }
  ];

  const mockCodeModules: CodeModuleData[] = [
    {
      id: 'module-1',
      name: 'AuthService',
      filePath: '/src/auth/auth.service.ts',
      type: 'class',
      language: 'typescript',
      projectId: 'project-1',
      createdAt: new Date().toISOString()
    }
  ];

  const mockContracts: ContractData[] = [
    {
      id: 'contract-1',
      name: 'User API',
      type: 'openapi',
      version: '1.0.0',
      specification: {
        paths: {
          '/auth/login': {
            post: {
              summary: 'User login',
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        email: { type: 'string' },
                        password: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      description: 'Authentication API specification',
      projectId: 'project-1',
      createdAt: new Date().toISOString()
    }
  ];

  const mockPheromones: PheromoneData[] = [
    {
      id: 'pheromone-1',
      type: 'success',
      strength: 0.8,
      context: 'JWT authentication implementation successful',
      metadata: { pattern: 'authentication', technology: 'jwt' },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Setup canvas mock
    mockCanvas = {
      getArchitecturalDecisionsByProject: jest.fn(),
      getCodeModulesByProject: jest.fn(),
      getContractsByProject: jest.fn(),
      getPheromonesByType: jest.fn(),
      getTaskDependencies: jest.fn(),
      findSimilarTasks: jest.fn(),
    } as any;

    // Setup workspace mock
    mockWorkspace = {
      getProjectRoot: jest.fn(),
      scanCodeFiles: jest.fn(),
    } as any;

    mockCognitiveCanvas.mockImplementation(() => mockCanvas);
    mockWorkspaceManager.mockImplementation(() => mockWorkspace);

    contextPrimer = new ContextPrimer(mockCanvas, mockWorkspace, './contracts');
  });

  describe('primeContext', () => {
    beforeEach(() => {
      mockCanvas.getArchitecturalDecisionsByProject.mockResolvedValue(mockArchitecturalDecisions);
      mockCanvas.getCodeModulesByProject.mockResolvedValue(mockCodeModules);
      mockCanvas.getContractsByProject.mockResolvedValue(mockContracts);
      mockCanvas.getPheromonesByType.mockResolvedValue(mockPheromones);
      mockCanvas.getTaskDependencies.mockResolvedValue([]);
      mockCanvas.findSimilarTasks.mockResolvedValue([]);
      mockWorkspace.getProjectRoot.mockReturnValue('/project/root');
      
      // Mock file system operations
      mockFs.readdir.mockResolvedValue([]);
      mockFs.stat.mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
        size: 1000,
        mtime: new Date()
      } as any);
    });

    it('should fetch and organize context data for SpecWriter agent', async () => {
      const result = await contextPrimer.primeContext(mockTask, 'SpecWriter', 'project-1');

      expect(result).toHaveProperty('architecturalDecisions');
      expect(result).toHaveProperty('codeModules');
      expect(result).toHaveProperty('contracts');
      expect(result).toHaveProperty('pheromones');
      expect(result).toHaveProperty('dependencies');
      expect(result).toHaveProperty('similarTasks');
      expect(result).toHaveProperty('workspaceFiles');
      expect(result).toHaveProperty('contractSnippets');

      expect(mockCanvas.getArchitecturalDecisionsByProject).toHaveBeenCalledWith('project-1');
      expect(mockCanvas.getCodeModulesByProject).toHaveBeenCalledWith('project-1');
      expect(mockCanvas.getContractsByProject).toHaveBeenCalledWith('project-1');
    });

    it('should fetch relevant pheromones for different agent types', async () => {
      await contextPrimer.primeContext(mockTask, 'Coder', 'project-1');

      // Should call getPheromonesByType with relevant types for Coder
      expect(mockCanvas.getPheromonesByType).toHaveBeenCalledWith('success');
      expect(mockCanvas.getPheromonesByType).toHaveBeenCalledWith('implementation');
    });

    it('should handle errors gracefully and return partial context', async () => {
      mockCanvas.getArchitecturalDecisionsByProject.mockRejectedValue(new Error('DB error'));

      const result = await contextPrimer.primeContext(mockTask, 'Architect', 'project-1');

      expect(result.architecturalDecisions).toEqual([]);
      expect(result.codeModules).toEqual(mockCodeModules);
    });

    it('should limit context data to specified maximums', async () => {
      const manyModules = Array.from({ length: 20 }, (_, i) => ({
        ...mockCodeModules[0],
        id: `module-${i}`,
        name: `Module ${i}`
      }));

      mockCanvas.getCodeModulesByProject.mockResolvedValue(manyModules);

      const options = { maxCodeModules: 3 };
      const result = await contextPrimer.primeContext(mockTask, 'Coder', 'project-1', options);

      expect(result.codeModules.length).toBeLessThanOrEqual(3);
    });
  });

  describe('relevance scoring', () => {
    it('should prioritize code modules based on task keywords', async () => {
      const authModule = {
        ...mockCodeModules[0],
        name: 'AuthenticationService',
        filePath: '/src/auth/authentication.service.ts'
      };

      const unrelatedModule = {
        ...mockCodeModules[0],
        id: 'module-2',
        name: 'DatabaseService',
        filePath: '/src/db/database.service.ts'
      };

      mockCanvas.getCodeModulesByProject.mockResolvedValue([authModule, unrelatedModule]);

      const result = await contextPrimer.primeContext(mockTask, 'Coder', 'project-1');

      // Auth module should be prioritized for authentication task
      expect(result.codeModules[0].name).toBe('AuthenticationService');
    });

    it('should apply agent-specific relevance scoring', async () => {
      const testFile = {
        ...mockCodeModules[0],
        name: 'AuthService.test',
        filePath: '/tests/auth.service.test.ts',
        type: 'function' as const
      };

      mockCanvas.getCodeModulesByProject.mockResolvedValue([mockCodeModules[0], testFile]);

      const testerResult = await contextPrimer.primeContext(mockTask, 'Tester', 'project-1');
      const coderResult = await contextPrimer.primeContext(mockTask, 'Coder', 'project-1');

      // Tester should prioritize test files more than Coder
      expect(testerResult.codeModules.find(m => m.name.includes('test'))).toBeDefined();
    });
  });

  describe('contract snippet extraction', () => {
    beforeEach(() => {
      // Mock file system for contract scanning
      mockFs.readdir.mockImplementation(async (dirPath: any) => {
        if (dirPath.includes('contracts')) {
          return [
            { name: 'api.yaml', isFile: () => true, isDirectory: () => false },
            { name: 'schema.json', isFile: () => true, isDirectory: () => false }
          ] as any;
        }
        return [];
      });

      mockFs.readFile.mockImplementation(async (filePath: any) => {
        if (filePath.includes('api.yaml')) {
          return 'openapi: 3.0.0\ninfo:\n  title: Test API';
        }
        if (filePath.includes('schema.json')) {
          return '{"$schema": "http://json-schema.org/draft-07/schema#"}';
        }
        return '';
      });
    });

    it('should extract and categorize contract snippets', async () => {
      const result = await contextPrimer.primeContext(mockTask, 'Formalizer', 'project-1');

      expect(result.contractSnippets.length).toBeGreaterThan(0);
      expect(result.contractSnippets.some(s => s.type === 'openapi')).toBe(true);
      expect(result.contractSnippets.some(s => s.type === 'json-schema')).toBe(true);
    });

    it('should score contract snippets by relevance to task', async () => {
      const authTask = {
        ...mockTask,
        title: 'Authentication API',
        description: 'Implement OpenAPI authentication endpoints'
      };

      const result = await contextPrimer.primeContext(authTask, 'Formalizer', 'project-1');

      // OpenAPI snippets should have higher relevance for API-related tasks
      const openApiSnippet = result.contractSnippets.find(s => s.type === 'openapi');
      expect(openApiSnippet?.relevanceScore).toBeGreaterThan(0);
    });
  });

  describe('workspace file scanning', () => {
    beforeEach(() => {
      mockWorkspace.scanCodeFiles = jest.fn().mockResolvedValue([
        {
          path: '/project/src/auth.ts',
          relativePath: 'src/auth.ts',
          type: 'source',
          language: 'typescript',
          size: 2000,
          lastModified: new Date(),
          relevanceScore: 0
        },
        {
          path: '/project/tests/auth.test.ts',
          relativePath: 'tests/auth.test.ts',
          type: 'test',
          language: 'typescript',
          size: 1500,
          lastModified: new Date(),
          relevanceScore: 0
        }
      ]);
    });

    it('should include relevant workspace files', async () => {
      const result = await contextPrimer.primeContext(mockTask, 'Coder', 'project-1');

      expect(result.workspaceFiles.length).toBeGreaterThan(0);
      expect(result.workspaceFiles.some(f => f.type === 'source')).toBe(true);
    });

    it('should respect file type inclusion options', async () => {
      const options = { includeTests: false };
      const result = await contextPrimer.primeContext(mockTask, 'Coder', 'project-1', options);

      expect(result.workspaceFiles.every(f => f.type !== 'test')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle contract extraction errors', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const result = await contextPrimer.primeContext(mockTask, 'Formalizer', 'project-1');

      expect(result.contractSnippets).toEqual([]);
    });

    it('should handle workspace scanning errors', async () => {
      mockWorkspace.scanCodeFiles = jest.fn().mockRejectedValue(new Error('Scan failed'));

      const result = await contextPrimer.primeContext(mockTask, 'Coder', 'project-1');

      expect(result.workspaceFiles).toEqual([]);
    });

    it('should handle canvas query errors', async () => {
      mockCanvas.getCodeModulesByProject.mockRejectedValue(new Error('DB connection failed'));

      const result = await contextPrimer.primeContext(mockTask, 'Architect', 'project-1');

      expect(result.codeModules).toEqual([]);
    });
  });
});