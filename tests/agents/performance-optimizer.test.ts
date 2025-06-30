import { PerformanceOptimizerAgent } from '../../src/agents/performance-optimizer';
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

describe('PerformanceOptimizerAgent', () => {
  let optimizer: PerformanceOptimizerAgent;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockCognitiveCanvas: jest.Mocked<CognitiveCanvas>;
  let mockSessionManager: jest.Mocked<SessionManager>;

  const mockConfig = {
    id: 'optimizer-1',
    role: 'performance-optimizer',
    capabilities: ['performance-analysis', 'bottleneck-detection', 'optimization', 'profiling'],
    claudeConfig: {
      apiKey: 'test-api-key',
      defaultModel: ClaudeModel.SONNET,
      maxTokens: 6000,
      temperature: 0.1
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
    title: 'Optimize Application Performance',
    description: 'Analyze and optimize application performance bottlenecks',
    projectId: 'project-1',
    status: 'assigned',
    priority: 'high',
    dependencies: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockContext = {
    projectInfo: {
      name: 'Test Project',
      language: 'typescript',
      framework: 'express'
    },
    performanceData: {
      responseTime: {
        p50: 120,
        p95: 300,
        p99: 450
      },
      throughput: 1500,
      errorRate: 0.05,
      cpuUsage: 65,
      memoryUsage: 78,
      databaseQueries: {
        averageTime: 45,
        slowQueries: 23
      }
    },
    profiling: {
      hotspots: [
        { function: 'processData', time: 250, calls: 1000 },
        { function: 'validateInput', time: 180, calls: 2000 }
      ]
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Claude client
    mockClaudeClient = {
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Performance optimization analysis completed',
        tokenUsage: { inputTokens: 500, outputTokens: 300, totalTokens: 800 },
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
        stdout: 'Performance test completed',
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
        type: 'performance',
        strength: 0.9,
        context: 'optimization_completed',
        metadata: {},
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }),
      getPerformanceOptimizationsByProject: jest.fn().mockResolvedValue([]),
      storePerformanceOptimization: jest.fn().mockResolvedValue(true),
      findSimilarTasks: jest.fn().mockResolvedValue([])
    } as any;

    (CognitiveCanvas as jest.MockedClass<typeof CognitiveCanvas>).mockImplementation(() => mockCognitiveCanvas);

    // Mock session manager
    mockSessionManager = {} as any;
    (SessionManager as jest.MockedClass<typeof SessionManager>).mockImplementation(() => mockSessionManager);

    optimizer = new PerformanceOptimizerAgent();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await optimizer.initialize(mockConfig);
      expect(optimizer.getStatus()).toBe('initialized');
      expect(optimizer.getId()).toBe('optimizer-1');
      expect(optimizer.getRole()).toBe('performance-optimizer');
    });

    it('should validate required capabilities', async () => {
      const invalidConfig = {
        ...mockConfig,
        capabilities: ['wrong-capability']
      };
      
      await expect(optimizer.initialize(invalidConfig)).rejects.toThrow('Performance Optimizer agent requires performance-analysis capability');
    });
  });

  describe('executeTask', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockConfig);
      await optimizer.receiveTask(mockTask, mockContext);
    });

    it('should execute performance optimization task successfully', async () => {
      const result = await optimizer.executeTask();

      expect(result).toEqual({
        performanceAnalysis: expect.any(String),
        bottlenecks: expect.any(Array),
        optimizations: expect.any(Array),
        benchmarkResults: expect.any(Object),
        codeOptimizations: expect.any(Array),
        loadTestPlan: expect.any(String),
        recommendations: expect.any(Array),
        metadata: expect.objectContaining({
          totalBottlenecks: expect.any(Number),
          totalOptimizations: expect.any(Number),
          expectedImprovement: expect.any(Number),
          generatedAt: expect.any(String)
        })
      });
    });

    it('should throw error if no task is assigned', async () => {
      const emptyOptimizer = new PerformanceOptimizerAgent();
      await emptyOptimizer.initialize(mockConfig);
      
      await expect(emptyOptimizer.executeTask()).rejects.toThrow('No task or context available');
    });

    it('should analyze performance bottlenecks correctly', async () => {
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: `# Performance Analysis

## Bottlenecks Identified
1. **Database Query Performance** - Slow queries detected
   - Impact: High (300ms average)
   - Priority: Critical
   - Solution: Add indexes, optimize queries

2. **Memory Usage** - High memory consumption
   - Impact: Medium (78% usage)
   - Priority: High
   - Solution: Implement caching, memory optimization

## Code Optimizations
1. **Optimize processData function**
   - Current: 250ms per call
   - Target: 100ms per call
   - Method: Algorithm optimization

## Recommendations
- Implement database connection pooling
- Add Redis caching layer
- Optimize memory allocations`,
        tokenUsage: { inputTokens: 500, outputTokens: 400, totalTokens: 900 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await optimizer.executeTask();

      expect(result.bottlenecks).toHaveLength(2);
      expect(result.bottlenecks[0].type).toBe('Database Query Performance');
      expect(result.bottlenecks[0].impact).toBe('High');
      expect(result.codeOptimizations).toHaveLength(1);
      expect(result.recommendations).toHaveLength(3);
    });

    it('should create optimization files', async () => {
      const writeFileSpy = jest.spyOn(optimizer as any, 'writeFile').mockResolvedValue(undefined);
      
      await optimizer.executeTask();

      expect(writeFileSpy).toHaveBeenCalledWith(
        'PERFORMANCE_OPTIMIZATION.md',
        expect.stringContaining('Performance Optimization Report')
      );
    });

    it('should report progress during execution', async () => {
      const reportProgressSpy = jest.spyOn(optimizer as any, 'reportProgress');
      
      await optimizer.executeTask();

      expect(reportProgressSpy).toHaveBeenCalledWith('started', 'Beginning performance analysis');
      expect(reportProgressSpy).toHaveBeenCalledWith('completed', 'Performance optimization completed');
    });

    it('should validate performance data availability', async () => {
      const contextWithoutData = { ...mockContext };
      delete contextWithoutData.performanceData;
      
      await optimizer.receiveTask(mockTask, contextWithoutData);
      
      await expect(optimizer.executeTask()).rejects.toThrow('Performance data not available');
    });
  });

  describe('getPromptTemplate', () => {
    it('should return comprehensive prompt template', () => {
      const template = optimizer.getPromptTemplate();
      
      expect(template).toContain('performance optimization expert');
      expect(template).toContain('{{taskDescription}}');
      expect(template).toContain('{{performanceData}}');
      expect(template).toContain('bottlenecks');
      expect(template).toContain('optimizations');
      expect(template).toContain('recommendations');
    });
  });

  describe('bottleneck analysis', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockConfig);
      await optimizer.receiveTask(mockTask, mockContext);
    });

    it('should parse bottlenecks correctly', () => {
      const content = `
## Bottlenecks Identified
1. **Database Query Performance** - Slow queries detected
   - Impact: High (300ms average)
   - Priority: Critical
   - Solution: Add indexes, optimize queries

2. **Memory Usage** - High memory consumption
   - Impact: Medium (78% usage)
   - Priority: High
   - Solution: Implement caching
`;
      const bottlenecks = (optimizer as any).parseBottlenecks(content);
      expect(bottlenecks).toHaveLength(2);
      expect(bottlenecks[0].type).toBe('Database Query Performance');
      expect(bottlenecks[0].impact).toBe('High');
      expect(bottlenecks[0].priority).toBe('Critical');
    });

    it('should categorize bottlenecks by impact', () => {
      const bottlenecks = [
        { type: 'Database', impact: 'High', priority: 'Critical' },
        { type: 'Memory', impact: 'Medium', priority: 'High' },
        { type: 'CPU', impact: 'Low', priority: 'Medium' }
      ];
      
      const categorized = (optimizer as any).categorizeBottlenecks(bottlenecks);
      expect(categorized.critical).toHaveLength(1);
      expect(categorized.high).toHaveLength(1);
      expect(categorized.medium).toHaveLength(1);
    });

    it('should identify performance hotspots', () => {
      const profilingData = mockContext.profiling;
      const hotspots = (optimizer as any).identifyHotspots(profilingData);
      
      expect(hotspots).toHaveLength(2);
      expect(hotspots[0].function).toBe('processData');
      expect(hotspots[0].severity).toBe('high');
    });
  });

  describe('code optimization parsing', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockConfig);
      await optimizer.receiveTask(mockTask, mockContext);
    });

    it('should parse code optimizations correctly', () => {
      const content = `
## Code Optimizations
1. **Optimize processData function**
   - Current: 250ms per call
   - Target: 100ms per call
   - Method: Algorithm optimization

2. **Cache validation results**
   - Current: 50ms per validation
   - Target: 5ms per validation
   - Method: In-memory caching
`;
      const optimizations = (optimizer as any).parseCodeOptimizations(content);
      expect(optimizations).toHaveLength(2);
      expect(optimizations[0].function).toBe('processData');
      expect(optimizations[0].currentPerformance).toBe('250ms per call');
      expect(optimizations[0].targetPerformance).toBe('100ms per call');
    });

    it('should calculate performance improvement', () => {
      const optimization = {
        currentPerformance: '250ms per call',
        targetPerformance: '100ms per call'
      };
      
      const improvement = (optimizer as any).calculateImprovement(optimization);
      expect(improvement).toBeCloseTo(60, 0); // 60% improvement
    });
  });

  describe('benchmark generation', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockConfig);
      await optimizer.receiveTask(mockTask, mockContext);
    });

    it('should generate benchmark tests', async () => {
      const benchmarks = await (optimizer as any).generateBenchmarkTests();
      
      expect(benchmarks.loadTest).toContain('concurrent users');
      expect(benchmarks.stressTest).toContain('stress test');
      expect(benchmarks.performanceTest).toContain('response time');
    });

    it('should create load test plan', () => {
      const performanceData = mockContext.performanceData;
      const loadTestPlan = (optimizer as any).createLoadTestPlan(performanceData);
      
      expect(loadTestPlan).toContain('Load Test Plan');
      expect(loadTestPlan).toContain('Target RPS');
      expect(loadTestPlan).toContain('Duration');
    });
  });

  describe('optimization storage', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockConfig);
      await optimizer.receiveTask(mockTask, mockContext);
    });

    it('should store optimization in Cognitive Canvas', async () => {
      await optimizer.executeTask();

      expect(mockCognitiveCanvas.storePerformanceOptimization).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          projectId: 'project-1',
          optimizations: expect.any(Array),
          performanceData: mockContext.performanceData
        })
      );
    });

    it('should create appropriate pheromone', async () => {
      await optimizer.executeTask();

      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'performance',
          strength: 0.9,
          context: 'optimization_completed',
          metadata: expect.objectContaining({
            taskId: 'task-1',
            expectedImprovement: expect.any(Number)
          })
        })
      );
    });
  });

  describe('performance metrics analysis', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockConfig);
      await optimizer.receiveTask(mockTask, mockContext);
    });

    it('should analyze response time percentiles', () => {
      const responseTime = mockContext.performanceData.responseTime;
      const analysis = (optimizer as any).analyzeResponseTime(responseTime);
      
      expect(analysis.assessment).toContain('p95 exceeds');
      expect(analysis.recommendations).toContain('optimization');
    });

    it('should evaluate throughput performance', () => {
      const throughput = mockContext.performanceData.throughput;
      const evaluation = (optimizer as any).evaluateThroughput(throughput);
      
      expect(evaluation.status).toBeDefined();
      expect(evaluation.recommendations).toBeDefined();
    });

    it('should assess resource utilization', () => {
      const { cpuUsage, memoryUsage } = mockContext.performanceData;
      const assessment = (optimizer as any).assessResourceUtilization(cpuUsage, memoryUsage);
      
      expect(assessment.cpu.status).toBe('warning');
      expect(assessment.memory.status).toBe('critical');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockConfig);
      await optimizer.receiveTask(mockTask, mockContext);
    });

    it('should handle Claude API errors', async () => {
      mockClaudeClient.sendMessage.mockRejectedValue(new Error('Claude API error'));
      
      await expect(optimizer.executeTask()).rejects.toThrow('Failed to generate performance optimization');
    });

    it('should handle benchmark execution errors', async () => {
      mockWorkspace.executeCommand.mockResolvedValue({
        stdout: '',
        stderr: 'Benchmark failed',
        exitCode: 1
      });
      
      // Should not throw, but log warning
      const result = await optimizer.executeTask();
      expect(result).toBeDefined();
    });

    it('should validate task specification', async () => {
      const invalidTask = { ...mockTask, title: '', description: '' };
      await optimizer.receiveTask(invalidTask, mockContext);
      
      await expect(optimizer.executeTask()).rejects.toThrow('Invalid task specification');
    });

    it('should handle invalid performance data', async () => {
      const invalidContext = {
        ...mockContext,
        performanceData: { invalid: 'data' }
      };
      
      await optimizer.receiveTask(mockTask, invalidContext);
      
      await expect(optimizer.executeTask()).rejects.toThrow('Invalid performance data format');
    });
  });

  describe('recommendation generation', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockConfig);
      await optimizer.receiveTask(mockTask, mockContext);
    });

    it('should generate database optimization recommendations', () => {
      const dbData = mockContext.performanceData.databaseQueries;
      const recommendations = (optimizer as any).generateDatabaseRecommendations(dbData);
      
      expect(recommendations).toContain('index');
      expect(recommendations).toContain('query optimization');
    });

    it('should prioritize recommendations by impact', () => {
      const recommendations = [
        { type: 'database', impact: 'high', effort: 'low' },
        { type: 'caching', impact: 'medium', effort: 'medium' },
        { type: 'algorithm', impact: 'high', effort: 'high' }
      ];
      
      const prioritized = (optimizer as any).prioritizeRecommendations(recommendations);
      expect(prioritized[0].type).toBe('database'); // High impact, low effort first
    });
  });
});