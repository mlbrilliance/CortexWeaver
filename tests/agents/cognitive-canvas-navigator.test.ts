import { CognitiveCanvasNavigatorAgent } from '../../src/agents/cognitive-canvas-navigator';
import { ClaudeClient, ClaudeModel } from '../../src/claude-client';
import { WorkspaceManager } from '../../src/workspace';
import { CognitiveCanvas } from '../../src/cognitive-canvas';
import { SessionManager } from '../../src/session';

// Mock dependencies
jest.mock('../../src/claude-client');
jest.mock('../../src/workspace');
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/session');
jest.mock('fs');

describe('CognitiveCanvasNavigatorAgent', () => {
  let navigator: CognitiveCanvasNavigatorAgent;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockCognitiveCanvas: jest.Mocked<CognitiveCanvas>;
  let mockSessionManager: jest.Mocked<SessionManager>;

  const mockConfig = {
    id: 'navigator-1',
    role: 'cognitive-canvas-navigator',
    capabilities: ['knowledge-graph-management', 'data-analysis', 'relationship-mapping', 'neo4j-operations'],
    claudeConfig: {
      apiKey: 'test-api-key',
      defaultModel: ClaudeModel.SONNET,
      maxTokens: 4000,
      temperature: 0.2
    },
    workspaceRoot: '/test/workspace',
    cognitiveCanvasConfig: {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'test'
    }
  };

  const mockTask = {
    id: 'task-1',
    title: 'Analyze Knowledge Graph',
    description: 'Perform comprehensive analysis of the knowledge graph and optimize relationships',
    projectId: 'project-1',
    status: 'assigned',
    priority: 'medium',
    dependencies: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockContext = {
    projectInfo: {
      name: 'Test Project',
      language: 'typescript',
      framework: 'node'
    },
    graphQuery: {
      operation: 'analyze',
      filters: {
        nodeTypes: ['Task', 'Agent', 'Project'],
        timeRange: '30d'
      }
    },
    analysisType: 'full-graph-analysis'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Claude client
    mockClaudeClient = {
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Knowledge graph analysis completed',
        tokenUsage: { inputTokens: 300, outputTokens: 200, totalTokens: 500 },
        model: 'claude-3-sonnet-20240229'
      }),
      getConfiguration: jest.fn(),
      updateConfiguration: jest.fn(),
      sendMessageStream: jest.fn(),
      getTokenUsage: jest.fn(),
      resetTokenUsage: jest.fn(),
      setDefaultModel: jest.fn(),
      getAvailableModels: jest.fn()
    } as any;

    (ClaudeClient as jest.MockedClass<typeof ClaudeClient>).mockImplementation(() => mockClaudeClient);

    // Mock workspace
    mockWorkspace = {
      executeCommand: jest.fn().mockResolvedValue({
        stdout: 'Command executed successfully',
        stderr: '',
        exitCode: 0
      }),
      getWorktreePath: jest.fn().mockReturnValue('/test/workspace/task-1'),
      getProjectRoot: jest.fn().mockReturnValue('/test/workspace'),
      createWorktree: jest.fn(),
      removeWorktree: jest.fn(),
      listWorktrees: jest.fn(),
      commitChanges: jest.fn(),
      mergeToBranch: jest.fn(),
      getWorktreeStatus: jest.fn()
    } as any;

    (WorkspaceManager as jest.MockedClass<typeof WorkspaceManager>).mockImplementation(() => mockWorkspace);

    // Mock cognitive canvas
    mockCognitiveCanvas = {
      createPheromone: jest.fn().mockResolvedValue({
        id: 'pheromone-1',
        type: 'knowledge_graph',
        strength: 0.8,
        context: 'graph_analysis_completed',
        metadata: {},
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }),
      executeQuery: jest.fn().mockResolvedValue([
        { nodeType: 'Task', count: 150 },
        { nodeType: 'Agent', count: 25 },
        { nodeType: 'Project', count: 10 }
      ]),
      getGraphStatistics: jest.fn().mockResolvedValue({
        totalNodes: 185,
        totalRelationships: 450,
        nodeTypes: ['Task', 'Agent', 'Project', 'Pheromone'],
        relationshipTypes: ['ASSIGNED_TO', 'DEPENDS_ON', 'CREATES', 'OPTIMIZES']
      }),
      findPaths: jest.fn().mockResolvedValue([]),
      optimizeGraph: jest.fn().mockResolvedValue(true),
      createGraphBackup: jest.fn().mockResolvedValue('backup-123'),
      restoreGraphBackup: jest.fn().mockResolvedValue(true),
      validateGraphIntegrity: jest.fn().mockResolvedValue({ isValid: true, issues: [] })
    } as any;

    (CognitiveCanvas as jest.MockedClass<typeof CognitiveCanvas>).mockImplementation(() => mockCognitiveCanvas);

    // Mock session manager
    mockSessionManager = {} as any;
    (SessionManager as jest.MockedClass<typeof SessionManager>).mockImplementation(() => mockSessionManager);

    navigator = new CognitiveCanvasNavigatorAgent();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await navigator.initialize(mockConfig);
      expect(navigator.getStatus()).toBe('initialized');
      expect(navigator.getId()).toBe('navigator-1');
      expect(navigator.getRole()).toBe('cognitive-canvas-navigator');
    });

    it('should validate required capabilities', async () => {
      const invalidConfig = {
        ...mockConfig,
        capabilities: ['wrong-capability']
      };
      
      await expect(navigator.initialize(invalidConfig)).rejects.toThrow('Cognitive Canvas Navigator agent requires knowledge-graph-management capability');
    });

    it('should validate exclusive access to Neo4j', async () => {
      const sharedConfig = {
        ...mockConfig,
        capabilities: [...mockConfig.capabilities, 'shared-neo4j-access']
      };
      
      await expect(navigator.initialize(sharedConfig)).rejects.toThrow('Cognitive Canvas Navigator must be the sole manager of the Neo4j knowledge graph');
    });
  });

  describe('executeTask', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
      await navigator.receiveTask(mockTask, mockContext);
    });

    it('should execute knowledge graph analysis task successfully', async () => {
      const result = await navigator.executeTask();

      expect(result).toEqual({
        graphAnalysis: expect.any(String),
        nodeStatistics: expect.any(Object),
        relationshipAnalysis: expect.any(Object),
        pathAnalysis: expect.any(Array),
        optimizations: expect.any(Array),
        healthCheck: expect.any(Object),
        recommendations: expect.any(Array),
        metadata: expect.objectContaining({
          totalNodes: expect.any(Number),
          totalRelationships: expect.any(Number),
          analysisDepth: expect.any(String),
          generatedAt: expect.any(String)
        })
      });
    });

    it('should throw error if no task is assigned', async () => {
      const emptyNavigator = new CognitiveCanvasNavigatorAgent();
      await emptyNavigator.initialize(mockConfig);
      
      await expect(emptyNavigator.executeTask()).rejects.toThrow('No task or context available');
    });

    it('should perform comprehensive graph analysis', async () => {
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: `# Knowledge Graph Analysis

## Graph Statistics
- Total Nodes: 185
- Total Relationships: 450
- Node Types: Task (150), Agent (25), Project (10)
- Relationship Types: ASSIGNED_TO, DEPENDS_ON, CREATES

## Node Analysis
### Task Nodes
- High activity: 85% of nodes have recent updates
- Completion rate: 78%
- Average dependencies: 3.2

## Relationship Patterns
- Strong clustering around project nodes
- Task-agent assignments well distributed
- Some orphaned nodes detected

## Optimizations
1. **Orphaned Node Cleanup** - Remove 12 disconnected nodes
2. **Index Optimization** - Add indexes on frequently queried properties
3. **Relationship Pruning** - Remove 23 stale relationships

## Recommendations
- Implement regular graph maintenance schedule
- Add monitoring for graph performance metrics`,
        tokenUsage: { inputTokens: 400, outputTokens: 300, totalTokens: 700 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await navigator.executeTask();

      expect(result.nodeStatistics.totalNodes).toBe(185);
      expect(result.relationshipAnalysis.totalRelationships).toBe(450);
      expect(result.optimizations).toHaveLength(3);
      expect(result.recommendations).toContain('Implement regular graph maintenance schedule');
    });

    it('should create graph analysis files', async () => {
      const writeFileSpy = jest.spyOn(navigator as any, 'writeFile').mockResolvedValue(undefined);
      
      await navigator.executeTask();

      expect(writeFileSpy).toHaveBeenCalledWith(
        'GRAPH_ANALYSIS.md',
        expect.stringContaining('Knowledge Graph Analysis Report')
      );
    });

    it('should report progress during execution', async () => {
      const reportProgressSpy = jest.spyOn(navigator as any, 'reportProgress');
      
      await navigator.executeTask();

      expect(reportProgressSpy).toHaveBeenCalledWith('started', 'Beginning knowledge graph analysis');
      expect(reportProgressSpy).toHaveBeenCalledWith('completed', 'Knowledge graph analysis completed');
    });

    it('should validate graph query requirements', async () => {
      const contextWithoutQuery = { ...mockContext };
      delete contextWithoutQuery.graphQuery;
      
      await navigator.receiveTask(mockTask, contextWithoutQuery);
      
      // Should still work with default query
      const result = await navigator.executeTask();
      expect(result).toBeDefined();
    });
  });

  describe('getPromptTemplate', () => {
    it('should return comprehensive prompt template', () => {
      const template = navigator.getPromptTemplate();
      
      expect(template).toContain('knowledge graph specialist');
      expect(template).toContain('{{taskDescription}}');
      expect(template).toContain('{{graphStatistics}}');
      expect(template).toContain('Neo4j');
      expect(template).toContain('nodes');
      expect(template).toContain('relationships');
    });
  });

  describe('graph operations', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
      await navigator.receiveTask(mockTask, mockContext);
    });

    it('should execute custom Cypher queries', async () => {
      const query = 'MATCH (n:Task) RETURN COUNT(n) as taskCount';
      const result = await (navigator as any).executeCypherQuery(query);
      
      expect(mockCognitiveCanvas.executeQuery).toHaveBeenCalledWith(query);
      expect(result).toBeDefined();
    });

    it('should analyze node distributions', async () => {
      const nodeStats = await (navigator as any).analyzeNodeDistribution();
      
      expect(nodeStats.totalNodes).toBe(185);
      expect(nodeStats.nodeTypes).toContain('Task');
      expect(nodeStats.nodeTypes).toContain('Agent');
    });

    it('should find relationship patterns', async () => {
      mockCognitiveCanvas.executeQuery.mockResolvedValue([
        { relType: 'ASSIGNED_TO', count: 150 },
        { relType: 'DEPENDS_ON', count: 200 },
        { relType: 'CREATES', count: 100 }
      ]);

      const patterns = await (navigator as any).findRelationshipPatterns();
      
      expect(patterns.totalRelationships).toBe(450);
      expect(patterns.strongestPattern).toBe('DEPENDS_ON');
    });

    it('should detect orphaned nodes', async () => {
      mockCognitiveCanvas.executeQuery.mockResolvedValue([
        { nodeId: 'node-1', labels: ['Task'] },
        { nodeId: 'node-2', labels: ['Agent'] }
      ]);

      const orphans = await (navigator as any).detectOrphanedNodes();
      
      expect(orphans).toHaveLength(2);
      expect(orphans[0].nodeId).toBe('node-1');
    });
  });

  describe('graph optimization', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
      await navigator.receiveTask(mockTask, mockContext);
    });

    it('should identify optimization opportunities', () => {
      const analysisContent = `
## Optimizations
1. **Orphaned Node Cleanup** - Remove 12 disconnected nodes
2. **Index Optimization** - Add indexes on frequently queried properties
3. **Relationship Pruning** - Remove 23 stale relationships
`;
      const optimizations = (navigator as any).parseOptimizations(analysisContent);
      
      expect(optimizations).toHaveLength(3);
      expect(optimizations[0].type).toBe('Orphaned Node Cleanup');
      expect(optimizations[0].impact).toBe('Remove 12 disconnected nodes');
    });

    it('should execute graph optimizations', async () => {
      const optimizations = [
        { type: 'Index Optimization', query: 'CREATE INDEX ON :Task(status)' },
        { type: 'Cleanup', query: 'MATCH (n) WHERE NOT (n)--() DELETE n' }
      ];

      await (navigator as any).executeOptimizations(optimizations);
      
      expect(mockCognitiveCanvas.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should validate optimization safety', () => {
      const optimization = {
        type: 'Delete Operation',
        query: 'MATCH (n) DELETE n' // Dangerous query
      };

      const isSafe = (navigator as any).validateOptimizationSafety(optimization);
      expect(isSafe).toBe(false);
    });
  });

  describe('graph health monitoring', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
      await navigator.receiveTask(mockTask, mockContext);
    });

    it('should perform comprehensive health check', async () => {
      const healthCheck = await (navigator as any).performHealthCheck();
      
      expect(healthCheck.isHealthy).toBe(true);
      expect(healthCheck.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'connectivity', status: 'pass' }),
          expect.objectContaining({ name: 'integrity', status: 'pass' }),
          expect.objectContaining({ name: 'performance', status: 'pass' })
        ])
      );
    });

    it('should detect performance issues', async () => {
      mockCognitiveCanvas.executeQuery.mockResolvedValue([
        { query: 'MATCH (n) RETURN n', avgTime: 2500 }, // Slow query
        { query: 'MATCH (a:Agent) RETURN a', avgTime: 150 }
      ]);

      const perfIssues = await (navigator as any).detectPerformanceIssues();
      
      expect(perfIssues).toHaveLength(1);
      expect(perfIssues[0].type).toBe('slow_query');
    });

    it('should validate data integrity', async () => {
      const integrityCheck = await (navigator as any).validateDataIntegrity();
      
      expect(mockCognitiveCanvas.validateGraphIntegrity).toHaveBeenCalled();
      expect(integrityCheck.isValid).toBe(true);
    });
  });

  describe('path analysis', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
      await navigator.receiveTask(mockTask, mockContext);
    });

    it('should find critical paths', async () => {
      mockCognitiveCanvas.findPaths.mockResolvedValue([
        { path: ['Project-1', 'Task-1', 'Agent-1'], length: 3, strength: 0.8 },
        { path: ['Project-1', 'Task-2', 'Agent-2'], length: 3, strength: 0.6 }
      ]);

      const criticalPaths = await (navigator as any).findCriticalPaths();
      
      expect(criticalPaths).toHaveLength(2);
      expect(criticalPaths[0].strength).toBe(0.8);
    });

    it('should analyze dependency chains', async () => {
      const dependencyChains = await (navigator as any).analyzeDependencyChains();
      
      expect(mockCognitiveCanvas.findPaths).toHaveBeenCalledWith(
        expect.objectContaining({
          relationshipType: 'DEPENDS_ON'
        })
      );
    });
  });

  describe('data backup and recovery', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
      await navigator.receiveTask(mockTask, mockContext);
    });

    it('should create graph backup', async () => {
      const backupId = await (navigator as any).createBackup();
      
      expect(mockCognitiveCanvas.createGraphBackup).toHaveBeenCalled();
      expect(backupId).toBe('backup-123');
    });

    it('should restore from backup', async () => {
      const success = await (navigator as any).restoreBackup('backup-123');
      
      expect(mockCognitiveCanvas.restoreGraphBackup).toHaveBeenCalledWith('backup-123');
      expect(success).toBe(true);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
      await navigator.receiveTask(mockTask, mockContext);
    });

    it('should handle Neo4j connection errors', async () => {
      mockCognitiveCanvas.executeQuery.mockRejectedValue(new Error('Neo4j connection failed'));
      
      await expect(navigator.executeTask()).rejects.toThrow('Failed to analyze knowledge graph');
    });

    it('should handle malformed Cypher queries', async () => {
      const invalidQuery = 'INVALID CYPHER QUERY';
      
      await expect((navigator as any).executeCypherQuery(invalidQuery)).rejects.toThrow();
    });

    it('should validate task specification', async () => {
      const invalidTask = { ...mockTask, title: '', description: '' };
      await navigator.receiveTask(invalidTask, mockContext);
      
      await expect(navigator.executeTask()).rejects.toThrow('Invalid task specification');
    });
  });

  describe('knowledge graph storage', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
      await navigator.receiveTask(mockTask, mockContext);
    });

    it('should create appropriate pheromone for analysis completion', async () => {
      await navigator.executeTask();

      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'knowledge_graph',
          strength: 0.8,
          context: 'graph_analysis_completed',
          metadata: expect.objectContaining({
            taskId: 'task-1',
            totalNodes: expect.any(Number),
            totalRelationships: expect.any(Number)
          })
        })
      );
    });

    it('should store analysis results as graph metadata', async () => {
      const storeMetadataSpy = jest.spyOn(navigator as any, 'storeAnalysisMetadata').mockResolvedValue(undefined);
      
      await navigator.executeTask();
      
      expect(storeMetadataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          analysisType: 'full-graph-analysis',
          results: expect.any(Object)
        })
      );
    });
  });
});