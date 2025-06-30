import { TestResultDocumenterAgent } from '../../src/agents/test-result-documenter';
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

describe('TestResultDocumenterAgent', () => {
  let documenter: TestResultDocumenterAgent;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockCognitiveCanvas: jest.Mocked<CognitiveCanvas>;
  let mockSessionManager: jest.Mocked<SessionManager>;

  const mockConfig = {
    id: 'documenter-1',
    role: 'test-result-documenter',
    capabilities: ['test-analysis', 'documentation', 'technical-writing', 'report-generation'],
    claudeConfig: {
      apiKey: 'test-api-key',
      defaultModel: ClaudeModel.SONNET,
      maxTokens: 4000,
      temperature: 0.3
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
    title: 'Document Test Results',
    description: 'Create comprehensive documentation for test suite results',
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
      framework: 'jest'
    },
    testResults: {
      passed: 85,
      failed: 5,
      skipped: 2,
      total: 92,
      coverage: {
        lines: 87.5,
        functions: 92.1,
        branches: 76.3,
        statements: 89.2
      }
    },
    files: ['test-results.json', 'coverage-report.json']
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Claude client
    mockClaudeClient = {
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Test documentation generated successfully',
        tokenUsage: { inputTokens: 300, outputTokens: 150, totalTokens: 450 },
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
        type: 'test_documentation',
        strength: 0.8,
        context: 'test_report_generated',
        metadata: {},
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }),
      getTestReportsByProject: jest.fn().mockResolvedValue([]),
      storeTestReport: jest.fn().mockResolvedValue(true),
      findSimilarTasks: jest.fn().mockResolvedValue([])
    } as any;

    (CognitiveCanvas as jest.MockedClass<typeof CognitiveCanvas>).mockImplementation(() => mockCognitiveCanvas);

    // Mock session manager
    mockSessionManager = {} as any;
    (SessionManager as jest.MockedClass<typeof SessionManager>).mockImplementation(() => mockSessionManager);

    documenter = new TestResultDocumenterAgent();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await documenter.initialize(mockConfig);
      expect(documenter.getStatus()).toBe('initialized');
      expect(documenter.getId()).toBe('documenter-1');
      expect(documenter.getRole()).toBe('test-result-documenter');
    });

    it('should validate required capabilities', async () => {
      const invalidConfig = {
        ...mockConfig,
        capabilities: ['wrong-capability']
      };
      
      await expect(documenter.initialize(invalidConfig)).rejects.toThrow('Test Result Documenter agent requires test-analysis capability');
    });
  });

  describe('executeTask', () => {
    beforeEach(async () => {
      await documenter.initialize(mockConfig);
      await documenter.receiveTask(mockTask, mockContext);
    });

    it('should execute test documentation task successfully', async () => {
      const result = await documenter.executeTask();

      expect(result).toEqual({
        testSummary: expect.any(String),
        coverageReport: expect.any(String),
        failureAnalysis: expect.any(Array),
        trendAnalysis: expect.any(String),
        recommendations: expect.any(Array),
        charts: expect.any(Array),
        metadata: expect.objectContaining({
          totalTests: expect.any(Number),
          passRate: expect.any(Number),
          coveragePercentage: expect.any(Number),
          generatedAt: expect.any(String)
        })
      });
    });

    it('should throw error if no task is assigned', async () => {
      const emptyDocumenter = new TestResultDocumenterAgent();
      await emptyDocumenter.initialize(mockConfig);
      
      await expect(emptyDocumenter.executeTask()).rejects.toThrow('No task or context available');
    });

    it('should analyze test results correctly', async () => {
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: `# Test Results Summary

## Overall Results
- Total Tests: 92
- Passed: 85 (92.4%)
- Failed: 5 (5.4%)
- Skipped: 2 (2.2%)

## Coverage Report
- Lines: 87.5%
- Functions: 92.1%
- Branches: 76.3%
- Statements: 89.2%

## Failed Tests Analysis
1. Authentication test failed due to mock setup
2. Database connection timeout in integration tests

## Recommendations
- Improve branch coverage
- Fix authentication mock setup`,
        tokenUsage: { inputTokens: 300, outputTokens: 200, totalTokens: 500 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await documenter.executeTask();

      expect(result.testSummary).toContain('Total Tests: 92');
      expect(result.coverageReport).toContain('Lines: 87.5%');
      expect(result.failureAnalysis).toHaveLength(2);
      expect(result.recommendations).toContain('Improve branch coverage');
    });

    it('should create documentation files', async () => {
      const writeFileSpy = jest.spyOn(documenter as any, 'writeFile').mockResolvedValue(undefined);
      
      await documenter.executeTask();

      expect(writeFileSpy).toHaveBeenCalledWith(
        'TEST_REPORT.md',
        expect.stringContaining('Test Results Report')
      );
    });

    it('should report progress during execution', async () => {
      const reportProgressSpy = jest.spyOn(documenter as any, 'reportProgress');
      
      await documenter.executeTask();

      expect(reportProgressSpy).toHaveBeenCalledWith('started', 'Beginning test result documentation');
      expect(reportProgressSpy).toHaveBeenCalledWith('completed', 'Test documentation completed');
    });

    it('should handle missing test results', async () => {
      const contextWithoutResults = { ...mockContext };
      delete contextWithoutResults.testResults;
      
      await documenter.receiveTask(mockTask, contextWithoutResults);
      
      await expect(documenter.executeTask()).rejects.toThrow('Test results not available in context');
    });
  });

  describe('getPromptTemplate', () => {
    it('should return comprehensive prompt template', () => {
      const template = documenter.getPromptTemplate();
      
      expect(template).toContain('technical documentation');
      expect(template).toContain('{{testResults}}');
      expect(template).toContain('{{coverageData}}');
      expect(template).toContain('summary');
      expect(template).toContain('analysis');
      expect(template).toContain('recommendations');
    });
  });

  describe('test result parsing', () => {
    beforeEach(async () => {
      await documenter.initialize(mockConfig);
      await documenter.receiveTask(mockTask, mockContext);
    });

    it('should parse failure analysis correctly', () => {
      const content = `
## Failed Tests Analysis
1. Authentication test failed due to mock setup
2. Database connection timeout in integration tests
3. API validation error in user service
`;
      const failures = (documenter as any).parseFailureAnalysis(content);
      expect(failures).toHaveLength(3);
      expect(failures[0].testName).toContain('Authentication test');
      expect(failures[0].reason).toContain('mock setup');
    });

    it('should extract recommendations correctly', () => {
      const content = `
## Recommendations
- Improve branch coverage to reach 85%
- Fix authentication mock setup issues
- Add more integration tests
- Optimize slow-running tests
`;
      const recommendations = (documenter as any).extractRecommendations(content);
      expect(recommendations).toHaveLength(4);
      expect(recommendations[0]).toContain('branch coverage');
    });

    it('should parse coverage data correctly', () => {
      const coverageData = {
        lines: 87.5,
        functions: 92.1,
        branches: 76.3,
        statements: 89.2
      };
      
      const parsed = (documenter as any).parseCoverageData(coverageData);
      expect(parsed.overall).toBe(86.3); // Average
      expect(parsed.details).toHaveLength(4);
    });

    it('should calculate pass rate correctly', () => {
      const testResults = {
        passed: 85,
        failed: 5,
        skipped: 2,
        total: 92
      };
      
      const passRate = (documenter as any).calculatePassRate(testResults);
      expect(passRate).toBeCloseTo(92.4, 1);
    });
  });

  describe('chart generation', () => {
    beforeEach(async () => {
      await documenter.initialize(mockConfig);
      await documenter.receiveTask(mockTask, mockContext);
    });

    it('should generate test results chart data', () => {
      const testResults = mockContext.testResults;
      const chartData = (documenter as any).generateTestResultsChart(testResults);
      
      expect(chartData).toEqual({
        type: 'pie',
        title: 'Test Results Distribution',
        data: [
          { label: 'Passed', value: 85, color: '#4CAF50' },
          { label: 'Failed', value: 5, color: '#F44336' },
          { label: 'Skipped', value: 2, color: '#FF9800' }
        ]
      });
    });

    it('should generate coverage chart data', () => {
      const coverage = mockContext.testResults.coverage;
      const chartData = (documenter as any).generateCoverageChart(coverage);
      
      expect(chartData.type).toBe('bar');
      expect(chartData.title).toBe('Code Coverage Report');
      expect(chartData.data).toHaveLength(4);
    });
  });

  describe('trend analysis', () => {
    beforeEach(async () => {
      await documenter.initialize(mockConfig);
      await documenter.receiveTask(mockTask, mockContext);
    });

    it('should analyze trends from historical data', async () => {
      const historicalData = [
        { date: '2024-01-01', passed: 80, failed: 10, coverage: 85 },
        { date: '2024-01-02', passed: 85, failed: 5, coverage: 87.5 }
      ];
      
      mockCognitiveCanvas.getTestReportsByProject.mockResolvedValue(historicalData);
      
      const trend = await (documenter as any).analyzeTrends();
      expect(trend).toContain('improvement');
    });

    it('should handle missing historical data', async () => {
      mockCognitiveCanvas.getTestReportsByProject.mockResolvedValue([]);
      
      const trend = await (documenter as any).analyzeTrends();
      expect(trend).toContain('No historical data');
    });
  });

  describe('documentation storage', () => {
    beforeEach(async () => {
      await documenter.initialize(mockConfig);
      await documenter.receiveTask(mockTask, mockContext);
    });

    it('should store report in Cognitive Canvas', async () => {
      await documenter.executeTask();

      expect(mockCognitiveCanvas.storeTestReport).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          projectId: 'project-1',
          testResults: mockContext.testResults,
          reportContent: expect.any(String)
        })
      );
    });

    it('should create appropriate pheromone', async () => {
      await documenter.executeTask();

      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test_documentation',
          strength: 0.8,
          context: 'test_report_completed',
          metadata: expect.objectContaining({
            taskId: 'task-1',
            totalTests: 92,
            passRate: expect.any(Number)
          })
        })
      );
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await documenter.initialize(mockConfig);
      await documenter.receiveTask(mockTask, mockContext);
    });

    it('should handle Claude API errors', async () => {
      mockClaudeClient.sendMessage.mockRejectedValue(new Error('Claude API error'));
      
      await expect(documenter.executeTask()).rejects.toThrow('Failed to generate test documentation');
    });

    it('should handle file writing errors', async () => {
      const writeFileSpy = jest.spyOn(documenter as any, 'writeFile').mockRejectedValue(new Error('File write error'));
      
      await expect(documenter.executeTask()).rejects.toThrow('Failed to create test documentation');
    });

    it('should handle invalid test results format', async () => {
      const invalidContext = {
        ...mockContext,
        testResults: { invalid: 'data' }
      };
      
      await documenter.receiveTask(mockTask, invalidContext);
      
      await expect(documenter.executeTask()).rejects.toThrow('Invalid test results format');
    });

    it('should validate task specification', async () => {
      const invalidTask = { ...mockTask, title: '', description: '' };
      await documenter.receiveTask(invalidTask, mockContext);
      
      await expect(documenter.executeTask()).rejects.toThrow('Invalid task specification');
    });
  });

  describe('markdown generation', () => {
    beforeEach(async () => {
      await documenter.initialize(mockConfig);
      await documenter.receiveTask(mockTask, mockContext);
    });

    it('should format test report as markdown', () => {
      const testData = {
        summary: 'Test Summary',
        coverage: 'Coverage Report',
        failures: [{ testName: 'Test 1', reason: 'Failed' }],
        recommendations: ['Improve coverage']
      };
      
      const markdown = (documenter as any).formatTestReportMarkdown(testData);
      
      expect(markdown).toContain('# Test Results Report');
      expect(markdown).toContain('## Test Summary');
      expect(markdown).toContain('## Coverage Report');
      expect(markdown).toContain('## Failed Tests');
      expect(markdown).toContain('## Recommendations');
    });

    it('should generate mermaid charts in markdown', () => {
      const chartData = {
        type: 'pie',
        title: 'Test Results',
        data: [
          { label: 'Passed', value: 85 },
          { label: 'Failed', value: 5 }
        ]
      };
      
      const mermaid = (documenter as any).generateMermaidChart(chartData);
      
      expect(mermaid).toContain('```mermaid');
      expect(mermaid).toContain('pie');
      expect(mermaid).toContain('Passed');
      expect(mermaid).toContain('Failed');
    });
  });
});