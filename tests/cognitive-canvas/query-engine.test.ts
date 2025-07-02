import { QueryEngine } from '../../src/cognitive-canvas/query-engine';
import { Driver, Session, Result, Record } from 'neo4j-driver';
import { 
  TaskData, 
  AgentData, 
  ContractData, 
  CodeModuleData, 
  TestData, 
  ArchitecturalDecisionData,
  KnowledgeGraph,
  ArtifactData
} from '../../src/cognitive-canvas/types';

// Mock Neo4j driver
jest.mock('neo4j-driver');

describe('QueryEngine', () => {
  let queryEngine: QueryEngine;
  let mockDriver: jest.Mocked<Driver>;
  let mockSession: jest.Mocked<Session>;
  let mockResult: jest.Mocked<Result>;
  let mockRecord: jest.Mocked<Record>;

  const mockTaskData: TaskData = {
    id: 'task-123',
    title: 'Implement User Authentication',
    description: 'Create secure user authentication system',
    status: 'pending',
    agentType: 'Architect',
    priority: 1,
    projectId: 'project-456',
    createdAt: '2024-01-01T00:00:00Z',
    dependencies: []
  };

  const mockContractData: ContractData = {
    id: 'contract-123',
    name: 'UserAuthAPI',
    type: 'contract',
    filePath: '/contracts/user-auth.json',
    content: JSON.stringify({
      paths: {
        '/api/auth/login': {
          post: {
            parameters: [{ name: 'email', type: 'string' }],
            responses: { '200': { description: 'Success' } }
          }
        }
      }
    }),
    projectId: 'project-456',
    createdAt: '2024-01-01T00:00:00Z'
  };

  const mockCodeModuleData: CodeModuleData = {
    id: 'module-123',
    name: 'AuthService',
    type: 'service',
    filePath: '/src/auth/auth-service.ts',
    content: 'export class AuthService { ... }',
    dependencies: ['crypto', 'jsonwebtoken'],
    exports: ['AuthService', 'validateToken'],
    projectId: 'project-456',
    createdAt: '2024-01-01T00:00:00Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Neo4j components
    mockRecord = {
      get: jest.fn(),
      keys: [],
      length: 1,
      forEach: jest.fn(),
      map: jest.fn(),
      toObject: jest.fn()
    } as any;

    mockResult = {
      records: [mockRecord],
      summary: {} as any,
      subscribe: jest.fn(),
      pipe: jest.fn(),
      then: jest.fn()
    } as any;

    mockSession = {
      run: jest.fn().mockResolvedValue(mockResult),
      close: jest.fn().mockResolvedValue(undefined),
      beginTransaction: jest.fn(),
      lastBookmark: jest.fn(),
      lastBookmarks: jest.fn(),
      readTransaction: jest.fn(),
      writeTransaction: jest.fn(),
      executeRead: jest.fn(),
      executeWrite: jest.fn()
    } as any;

    mockDriver = {
      session: jest.fn().mockReturnValue(mockSession),
      close: jest.fn().mockResolvedValue(undefined),
      getServerInfo: jest.fn(),
      supportsMultiDb: jest.fn(),
      supportsTransactionConfig: jest.fn(),
      verifyConnectivity: jest.fn(),
      executeQuery: jest.fn(),
      getNegotiatedAuth: jest.fn(),
      isEncrypted: jest.fn()
    } as any;

    queryEngine = new QueryEngine(mockDriver);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('task queries', () => {
    it('should get tasks by project', async () => {
      mockRecord.get.mockReturnValue({ properties: mockTaskData });

      const result = await queryEngine.getTasksByProject('project-456');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockTaskData);
      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (t:Task {projectId: $projectId}) RETURN t ORDER BY t.createdAt',
        { projectId: 'project-456' }
      );
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should get task dependencies', async () => {
      const dependencyTask = {
        ...mockTaskData,
        id: 'task-dependency',
        title: 'Setup Database'
      };
      mockRecord.get.mockReturnValue({ properties: dependencyTask });

      const result = await queryEngine.getTaskDependencies('task-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(dependencyTask);
      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (t:Task {id: $taskId})-[:DEPENDS_ON]->(dep:Task) RETURN dep',
        { taskId: 'task-123' }
      );
    });

    it('should find similar tasks by keywords', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        if (key === 't2') return { properties: mockTaskData };
        if (key === 'similarity') return 0.8;
        return null;
      });

      const result = await queryEngine.findSimilarTasks('task-123', ['authentication', 'user']);

      expect(result).toHaveLength(1);
      expect(result[0].task).toEqual(mockTaskData);
      expect(result[0].similarity).toBe(0.8);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('ANY(keyword IN $keywords'),
        { taskId: 'task-123', keywords: ['authentication', 'user'] }
      );
    });

    it('should handle empty results for task queries', async () => {
      mockResult.records = [];

      const result = await queryEngine.getTasksByProject('empty-project');

      expect(result).toHaveLength(0);
    });
  });

  describe('contract queries', () => {
    it('should get contracts by project', async () => {
      mockRecord.get.mockReturnValue({ properties: mockContractData });

      const result = await queryEngine.getContractsByProject('project-456');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockContractData);
      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (c:Contract {projectId: $projectId}) RETURN c ORDER BY c.createdAt',
        { projectId: 'project-456' }
      );
    });

    it('should find contracts by API endpoint', async () => {
      mockRecord.get.mockReturnValue({ properties: mockContractData });

      const result = await queryEngine.findContractsByEndpoint('/api/auth/login');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockContractData);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('c.content CONTAINS $endpoint'),
        { endpoint: '/api/auth/login' }
      );
    });

    it('should get contract relationships', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'c1': return { properties: { id: 'contract-1', name: 'UserAPI' } };
          case 'c2': return { properties: { id: 'contract-2', name: 'PaymentAPI' } };
          case 'r': return { type: 'DEPENDS_ON' };
          default: return null;
        }
      });

      const result = await queryEngine.getContractRelationships('project-456');

      expect(result).toHaveLength(1);
      expect(result[0].source.id).toBe('contract-1');
      expect(result[0].target.id).toBe('contract-2');
      expect(result[0].relationship.type).toBe('DEPENDS_ON');
    });
  });

  describe('code module queries', () => {
    it('should get code modules by project', async () => {
      mockRecord.get.mockReturnValue({ properties: mockCodeModuleData });

      const result = await queryEngine.getCodeModulesByProject('project-456');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockCodeModuleData);
      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (m:CodeModule {projectId: $projectId}) RETURN m ORDER BY m.createdAt',
        { projectId: 'project-456' }
      );
    });

    it('should analyze module dependencies', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'module': return { properties: { id: 'module-1', name: 'AuthService' } };
          case 'dependency': return { properties: { id: 'module-2', name: 'DatabaseService' } };
          case 'depType': return 'import';
          default: return null;
        }
      });

      const result = await queryEngine.analyzeModuleDependencies('project-456');

      expect(result).toHaveLength(1);
      expect(result[0].module.id).toBe('module-1');
      expect(result[0].dependency.id).toBe('module-2');
      expect(result[0].dependencyType).toBe('import');
    });

    it('should find circular dependencies', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'path': return ['module-1', 'module-2', 'module-1']; // Circular path
          case 'length': return 3;
          default: return null;
        }
      });

      const result = await queryEngine.findCircularDependencies('project-456');

      expect(result).toHaveLength(1);
      expect(result[0].path).toEqual(['module-1', 'module-2', 'module-1']);
      expect(result[0].length).toBe(3);
    });
  });

  describe('test queries', () => {
    const mockTestData: TestData = {
      id: 'test-123',
      name: 'AuthService Tests',
      type: 'unit',
      filePath: '/tests/auth/auth-service.test.ts',
      status: 'passed',
      coverage: 85.5,
      testCases: [
        { name: 'should authenticate valid user', status: 'passed' },
        { name: 'should reject invalid credentials', status: 'passed' }
      ],
      projectId: 'project-456',
      createdAt: '2024-01-01T00:00:00Z'
    };

    it('should get tests by project', async () => {
      mockRecord.get.mockReturnValue({ properties: mockTestData });

      const result = await queryEngine.getTestsByProject('project-456');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockTestData);
    });

    it('should get test coverage by module', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'module': return { properties: { id: 'module-1', name: 'AuthService' } };
          case 'coverage': return 85.5;
          case 'testCount': return { low: 12, high: 0 };
          default: return null;
        }
      });

      const result = await queryEngine.getTestCoverageByModule('project-456');

      expect(result).toHaveLength(1);
      expect(result[0].module.id).toBe('module-1');
      expect(result[0].coverage).toBe(85.5);
      expect(result[0].testCount).toBe(12);
    });

    it('should find untested code paths', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'module': return { properties: { id: 'module-1', name: 'PaymentService' } };
          case 'uncoveredLines': return [45, 67, 89];
          case 'coverageGap': return 25.0;
          default: return null;
        }
      });

      const result = await queryEngine.findUntestedCodePaths('project-456');

      expect(result).toHaveLength(1);
      expect(result[0].module.id).toBe('module-1');
      expect(result[0].uncoveredLines).toEqual([45, 67, 89]);
      expect(result[0].coverageGap).toBe(25.0);
    });
  });

  describe('architectural decision queries', () => {
    const mockArchDecision: ArchitecturalDecisionData = {
      id: 'decision-123',
      title: 'Choose Database Technology',
      status: 'approved',
      context: 'Need to select primary database for user data',
      decision: 'Use PostgreSQL for ACID compliance and JSON support',
      consequences: ['Better data integrity', 'Learning curve for team'],
      alternatives: [
        { option: 'MongoDB', pros: ['Flexible schema'], cons: ['Less ACID compliance'] },
        { option: 'MySQL', pros: ['Team familiarity'], cons: ['Limited JSON support'] }
      ],
      decisionMakers: ['architect-001', 'tech-lead-002'],
      projectId: 'project-456',
      createdAt: '2024-01-01T00:00:00Z'
    };

    it('should get architectural decisions by project', async () => {
      mockRecord.get.mockReturnValue({ properties: mockArchDecision });

      const result = await queryEngine.getArchitecturalDecisionsByProject('project-456');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockArchDecision);
    });

    it('should find decisions by status', async () => {
      mockRecord.get.mockReturnValue({ properties: mockArchDecision });

      const result = await queryEngine.findDecisionsByStatus('approved');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockArchDecision);
      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (d:ArchitecturalDecision {status: $status}) RETURN d ORDER BY d.createdAt DESC',
        { status: 'approved' }
      );
    });

    it('should analyze decision impact on modules', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'decision': return { properties: { id: 'decision-1', title: 'Database Choice' } };
          case 'module': return { properties: { id: 'module-1', name: 'UserService' } };
          case 'impact': return { type: 'AFFECTS', strength: 0.8 };
          default: return null;
        }
      });

      const result = await queryEngine.analyzeDecisionImpact('decision-123');

      expect(result).toHaveLength(1);
      expect(result[0].decision.id).toBe('decision-1');
      expect(result[0].affectedModule.id).toBe('module-1');
      expect(result[0].impact.strength).toBe(0.8);
    });
  });

  describe('knowledge graph queries', () => {
    it('should build project knowledge graph', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'nodes':
            return [
              { id: 'task-1', type: 'Task', properties: { title: 'Auth Task' } },
              { id: 'contract-1', type: 'Contract', properties: { name: 'Auth API' } }
            ];
          case 'relationships':
            return [
              { source: 'task-1', target: 'contract-1', type: 'IMPLEMENTS' }
            ];
          default: return null;
        }
      });

      const result = await queryEngine.buildKnowledgeGraph('project-456');

      expect(result.nodes).toHaveLength(2);
      expect(result.relationships).toHaveLength(1);
      expect(result.nodes[0].type).toBe('Task');
      expect(result.relationships[0].type).toBe('IMPLEMENTS');
    });

    it('should find related artifacts', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'artifact': return { properties: { id: 'contract-1', type: 'contract' } };
          case 'relationship': return { type: 'DEPENDS_ON' };
          case 'strength': return 0.75;
          default: return null;
        }
      });

      const result = await queryEngine.findRelatedArtifacts('task-123', 5);

      expect(result).toHaveLength(1);
      expect(result[0].artifact.id).toBe('contract-1');
      expect(result[0].relationship.type).toBe('DEPENDS_ON');
      expect(result[0].strength).toBe(0.75);
    });

    it('should analyze project complexity', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'taskCount': return { low: 25, high: 0 };
          case 'moduleCount': return { low: 15, high: 0 };
          case 'dependencyCount': return { low: 45, high: 0 };
          case 'avgDependencyDepth': return 3.2;
          case 'maxDependencyDepth': return { low: 8, high: 0 };
          default: return null;
        }
      });

      const result = await queryEngine.analyzeProjectComplexity('project-456');

      expect(result.taskCount).toBe(25);
      expect(result.moduleCount).toBe(15);
      expect(result.dependencyCount).toBe(45);
      expect(result.averageDependencyDepth).toBe(3.2);
      expect(result.maxDependencyDepth).toBe(8);
    });
  });

  describe('search and filtering', () => {
    it('should perform full-text search across artifacts', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'artifact': return { properties: { id: 'art-1', type: 'contract', content: 'authentication system' } };
          case 'score': return 0.95;
          case 'matchedFields': return ['content', 'title'];
          default: return null;
        }
      });

      const result = await queryEngine.searchArtifacts('authentication', 'project-456');

      expect(result).toHaveLength(1);
      expect(result[0].artifact.id).toBe('art-1');
      expect(result[0].score).toBe(0.95);
      expect(result[0].matchedFields).toEqual(['content', 'title']);
    });

    it('should filter artifacts by type and date range', async () => {
      const filters = {
        types: ['contract', 'test'],
        dateRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z'
        },
        status: 'active'
      };

      mockRecord.get.mockReturnValue({ properties: mockContractData });

      const result = await queryEngine.filterArtifacts('project-456', filters);

      expect(result).toHaveLength(1);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('WHERE a.projectId = $projectId'),
        expect.objectContaining({
          projectId: 'project-456',
          types: ['contract', 'test'],
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-31T23:59:59Z',
          status: 'active'
        })
      );
    });

    it('should get artifacts by tags', async () => {
      mockRecord.get.mockReturnValue({ properties: { ...mockContractData, tags: ['authentication', 'security'] } });

      const result = await queryEngine.getArtifactsByTags(['authentication', 'security']);

      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual(['authentication', 'security']);
    });
  });

  describe('performance and analytics', () => {
    it('should get project performance metrics', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'completedTasks': return { low: 15, high: 0 };
          case 'totalTasks': return { low: 20, high: 0 };
          case 'avgTaskDuration': return 4.5;
          case 'testCoverage': return 82.3;
          case 'bugCount': return { low: 3, high: 0 };
          default: return null;
        }
      });

      const result = await queryEngine.getProjectMetrics('project-456');

      expect(result.completedTasks).toBe(15);
      expect(result.totalTasks).toBe(20);
      expect(result.completionRate).toBe(75); // 15/20 * 100
      expect(result.averageTaskDuration).toBe(4.5);
      expect(result.testCoverage).toBe(82.3);
      expect(result.bugCount).toBe(3);
    });

    it('should analyze team productivity', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'agent': return { properties: { id: 'agent-1', type: 'Architect' } };
          case 'tasksCompleted': return { low: 8, high: 0 };
          case 'avgTaskTime': return 3.2;
          case 'successRate': return 0.9;
          default: return null;
        }
      });

      const result = await queryEngine.analyzeTeamProductivity('project-456');

      expect(result).toHaveLength(1);
      expect(result[0].agent.id).toBe('agent-1');
      expect(result[0].tasksCompleted).toBe(8);
      expect(result[0].averageTaskTime).toBe(3.2);
      expect(result[0].successRate).toBe(0.9);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle database connection errors', async () => {
      mockSession.run.mockRejectedValue(new Error('Connection failed'));

      await expect(queryEngine.getTasksByProject('project-456'))
        .rejects.toThrow('Connection failed');

      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should handle malformed query results', async () => {
      mockRecord.get.mockReturnValue(null);

      const result = await queryEngine.getTasksByProject('project-456');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeNull();
    });

    it('should handle empty query parameters', async () => {
      const result = await queryEngine.findSimilarTasks('task-123', []);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.anything(),
        { taskId: 'task-123', keywords: [] }
      );
    });

    it('should close session on successful operations', async () => {
      await queryEngine.getTasksByProject('project-456');

      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should handle concurrent queries efficiently', async () => {
      const promises = [
        queryEngine.getTasksByProject('project-1'),
        queryEngine.getContractsByProject('project-2'),
        queryEngine.getCodeModulesByProject('project-3')
      ];

      await Promise.all(promises);

      expect(mockDriver.session).toHaveBeenCalledTimes(3);
      expect(mockSession.close).toHaveBeenCalledTimes(3);
    });
  });

  describe('performance optimization', () => {
    it('should complete queries within reasonable time limits', async () => {
      const startTime = Date.now();
      
      await queryEngine.getTasksByProject('project-456');
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should efficiently handle large result sets', async () => {
      const largeResultSet = Array.from({ length: 1000 }, (_, i) => ({
        get: jest.fn().mockReturnValue({ properties: { ...mockTaskData, id: `task-${i}` } })
      }));

      mockResult.records = largeResultSet;

      const startTime = Date.now();
      const result = await queryEngine.getTasksByProject('large-project');
      const duration = Date.now() - startTime;

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(2000); // Should handle efficiently
    });

    it('should optimize query execution for complex searches', async () => {
      const complexQuery = await queryEngine.buildKnowledgeGraph('complex-project');

      // Should use optimized queries with proper indexing
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY'), // Should include ordering for performance
        expect.anything()
      );
    });
  });
});