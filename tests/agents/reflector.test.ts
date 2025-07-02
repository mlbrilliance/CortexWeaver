import { ReflectorAgent } from '../../src/agents/reflector';
import { Agent } from '../../src/agent';
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

describe('ReflectorAgent', () => {
  let reflector: ReflectorAgent;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockCognitiveCanvas: jest.Mocked<CognitiveCanvas>;
  let mockSessionManager: jest.Mocked<SessionManager>;

  const mockConfig = {
    id: 'reflector-1',
    role: 'self-improvement-engine',
    capabilities: ['pattern-analysis', 'pheromone-generation', 'prompt-improvement', 'performance-correlation'],
    claudeConfig: {
      apiKey: 'test-api-key',
      defaultModel: ClaudeModel.SONNET,
      maxTokens: 4096,
      temperature: 0.3
    },
    workspaceRoot: '/test/workspace',
    cognitiveCanvasConfig: {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'test'
    }
  };

  const mockHistoricalData = {
    tasks: [
      {
        id: 'task-1',
        title: 'Implement authentication',
        description: 'Add JWT authentication to API',
        status: 'completed',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date('2024-01-01').toISOString(),
        metadata: {
          testResults: { passed: 8, failed: 2 },
          performance: { executionTime: 150, memoryUsage: 256 },
          codePattern: 'jwt-auth',
          promptVersion: 'v1.2'
        }
      },
      {
        id: 'task-2',
        title: 'Database integration',
        description: 'Connect to PostgreSQL database',
        status: 'failed',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date('2024-01-02').toISOString(),
        metadata: {
          testResults: { passed: 3, failed: 7 },
          performance: { executionTime: 300, memoryUsage: 512 },
          codePattern: 'database-connection',
          promptVersion: 'v1.1',
          failureReason: 'Connection timeout'
        }
      }
    ],
    pheromones: [
      {
        id: 'pheromone-1',
        type: 'guide_pheromone',
        strength: 0.8,
        context: 'authentication_success',
        metadata: { pattern: 'jwt-auth', outcome: 'success' },
        createdAt: new Date('2024-01-01').toISOString(),
        expiresAt: new Date('2024-01-02').toISOString()
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Claude client
    mockClaudeClient = {
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Performance pattern analysis complete',
        tokenUsage: { inputTokens: 200, outputTokens: 150, totalTokens: 350 },
        model: 'claude-3-sonnet-20240229'
      }),
      getConfiguration: jest.fn(),
      updateConfiguration: jest.fn(),
      sendMessageStream: jest.fn(),
      getTokenUsage: jest.fn().mockReturnValue({ 
        totalInputTokens: 500, 
        totalOutputTokens: 300, 
        totalTokens: 800, 
        requestCount: 5, 
        estimatedCost: 12 
      }),
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
        id: 'pheromone-new',
        type: 'guide_pheromone',
        strength: 0.7,
        context: 'pattern_analysis',
        metadata: {},
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }),
      getPheromonesByType: jest.fn().mockResolvedValue(mockHistoricalData.pheromones),
      getProject: jest.fn().mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
        status: 'active'
      }),
      getTasksByProject: jest.fn().mockResolvedValue(mockHistoricalData.tasks),
      getProjectKnowledgeGraph: jest.fn().mockResolvedValue({
        project: { id: 'project-1', name: 'Test Project' },
        tasks: mockHistoricalData.tasks,
        agents: [],
        pheromones: mockHistoricalData.pheromones,
        decisions: [],
        contracts: [],
        codeModules: [],
        tests: []
      }),
      initializeSchema: jest.fn(),
      createProject: jest.fn(),
      updateProjectStatus: jest.fn(),
      createTask: jest.fn(),
      createTaskDependency: jest.fn(),
      getTaskDependencies: jest.fn(),
      createAgent: jest.fn(),
      assignAgentToTask: jest.fn(),
      getAgentAssignments: jest.fn(),
      linkPheromoneToTask: jest.fn(),
      cleanExpiredPheromones: jest.fn(),
      storeArchitecturalDecision: jest.fn(),
      getArchitecturalDecisionsByProject: jest.fn(),
      findSimilarTasks: jest.fn(),
      close: jest.fn()
    } as any;

    (CognitiveCanvas as jest.MockedClass<typeof CognitiveCanvas>).mockImplementation(() => mockCognitiveCanvas);

    // Mock session manager
    mockSessionManager = {
      createSession: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        taskId: 'task-1',
        status: 'running',
        createdAt: new Date()
      }),
      runCommandInSession: jest.fn(),
      attachToSession: jest.fn(),
      killSession: jest.fn(),
      listSessions: jest.fn(),
      getSessionStatus: jest.fn(),
      listActiveTmuxSessions: jest.fn(),
      startAgentInSession: jest.fn(),
      monitorSession: jest.fn(),
      getSessionOutput: jest.fn(),
      cleanupDeadSessions: jest.fn()
    } as any;

    (SessionManager as jest.MockedClass<typeof SessionManager>).mockImplementation(() => mockSessionManager);

    // Mock file system
    const fs = require('fs');
    fs.readFileSync = jest.fn().mockReturnValue('existing prompt template');
    fs.writeFileSync = jest.fn();
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();
    fs.readdirSync = jest.fn().mockReturnValue(['prompt1.md', 'prompt2.md']);

    reflector = new ReflectorAgent();
  });

  describe('Initialization', () => {
    it('should extend Agent base class', () => {
      expect(reflector).toBeInstanceOf(Agent);
    });

    it('should initialize with reflector-specific configuration', async () => {
      await reflector.initialize(mockConfig);
      
      expect(reflector.getId()).toBe('reflector-1');
      expect(reflector.getRole()).toBe('self-improvement-engine');
      expect(reflector.getCapabilities()).toContain('pattern-analysis');
      expect(reflector.getCapabilities()).toContain('pheromone-generation');
      expect(reflector.getCapabilities()).toContain('prompt-improvement');
      expect(reflector.getCapabilities()).toContain('performance-correlation');
    });
  });

  describe('Prompt Template', () => {
    it('should provide reflector-specific prompt template', () => {
      const template = reflector.getPromptTemplate();
      
      expect(template).toContain('Self-Improvement Engine');
      expect(template).toContain('{{historicalData}}');
      expect(template).toContain('{{performancePatterns}}');
      expect(template).toContain('pattern analysis');
      expect(template).toContain('pheromone generation');
    });

    it('should format template with historical data context', () => {
      const template = reflector.getPromptTemplate();
      const formatted = reflector.formatPrompt(template, {
        historicalData: 'Tasks: 100, Success Rate: 85%',
        performancePatterns: 'JWT Auth: High Success, DB Conn: Issues',
        projectName: 'TestProject'
      });
      
      expect(formatted).toContain('Tasks: 100, Success Rate: 85%');
      expect(formatted).toContain('JWT Auth: High Success, DB Conn: Issues');
      expect(formatted).toContain('TestProject');
    });
  });

  describe('Historical Data Analysis', () => {
    beforeEach(async () => {
      await reflector.initialize(mockConfig);
    });

    it('should analyze task completion patterns', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Analyze performance patterns',
        description: 'Analyze historical task performance',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const patterns = await reflector.analyzePerformancePatterns();
      
      expect(patterns).toBeDefined();
      expect(patterns.successPatterns).toBeDefined();
      expect(patterns.failurePatterns).toBeDefined();
      expect(patterns.correlations).toBeDefined();
    });

    it('should identify successful patterns', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Analyze performance patterns',
        description: 'Analyze historical task performance',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const patterns = await reflector.analyzePerformancePatterns();
      
      expect(patterns.successPatterns).toContainEqual(
        expect.objectContaining({
          pattern: 'jwt-auth',
          successRate: expect.any(Number),
          avgPerformance: expect.any(Object)
        })
      );
    });

    it('should identify failure patterns', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Analyze performance patterns',
        description: 'Analyze historical task performance',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const patterns = await reflector.analyzePerformancePatterns();
      
      expect(patterns.failurePatterns).toContainEqual(
        expect.objectContaining({
          pattern: 'database-connection',
          failureRate: expect.any(Number),
          commonIssues: expect.arrayContaining(['Connection timeout'])
        })
      );
    });

    it('should correlate prompts with outcomes', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Analyze performance patterns',
        description: 'Analyze historical task performance',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const patterns = await reflector.analyzePerformancePatterns();
      
      expect(patterns.correlations).toBeDefined();
      expect(patterns.correlations.promptVersions).toBeDefined();
      expect(patterns.correlations.codePatterns).toBeDefined();
    });

    it('should handle empty historical data', async () => {
      mockCognitiveCanvas.getTasksByProject.mockResolvedValue([]);
      
      const task = {
        id: 'task-reflect',
        title: 'Analyze performance patterns',
        description: 'Analyze historical task performance',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const patterns = await reflector.analyzePerformancePatterns();
      
      expect(patterns.successPatterns).toEqual([]);
      expect(patterns.failurePatterns).toEqual([]);
    });
  });

  describe('Pheromone Generation', () => {
    beforeEach(async () => {
      await reflector.initialize(mockConfig);
    });

    it('should generate guide pheromones for successful patterns', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Generate pheromones',
        description: 'Generate guidance pheromones',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const patterns = {
        successPatterns: [
          { pattern: 'jwt-auth', successRate: 0.9, avgPerformance: { executionTime: 150 }, frequency: 5 }
        ],
        failurePatterns: [],
        correlations: { promptVersions: {}, codePatterns: {}, timeBasedTrends: [] }
      };

      const pheromones = await reflector.generatePheromones(patterns);
      
      expect(pheromones).toContainEqual(
        expect.objectContaining({
          type: 'guide_pheromone',
          strength: expect.any(Number),
          context: expect.stringContaining('jwt-auth'),
          message: expect.stringContaining('successful')
        })
      );
    });

    it('should generate warning pheromones for failure patterns', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Generate pheromones',
        description: 'Generate warning pheromones',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const patterns = {
        successPatterns: [],
        failurePatterns: [
          { pattern: 'database-connection', failureRate: 0.8, commonIssues: ['Connection timeout'], frequency: 3 }
        ],
        correlations: { promptVersions: {}, codePatterns: {}, timeBasedTrends: [] }
      };

      const pheromones = await reflector.generatePheromones(patterns);
      
      expect(pheromones).toContainEqual(
        expect.objectContaining({
          type: 'warn_pheromone',
          strength: expect.any(Number),
          context: expect.stringContaining('database-connection'),
          message: expect.stringContaining('avoid')
        })
      );
    });

    it('should create pheromones in Cognitive Canvas', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Create pheromones',
        description: 'Create pheromones in canvas',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const pheromoneInputs = [
        {
          type: 'guide_pheromone' as const,
          strength: 0.8,
          context: 'jwt-auth-success',
          message: 'JWT authentication pattern shows high success rate'
        }
      ];

      await reflector.createPheromones(pheromoneInputs);
      
      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'guide_pheromone',
          strength: 0.8,
          context: 'jwt-auth-success'
        })
      );
    });
  });

  describe('Prompt Improvement', () => {
    beforeEach(async () => {
      await reflector.initialize(mockConfig);
    });

    it('should analyze prompt performance correlation', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Analyze prompts',
        description: 'Analyze prompt effectiveness',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const analysis = await reflector.analyzePromptPerformance();
      
      expect(analysis).toBeDefined();
      expect(analysis.promptVersions).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
    });

    it('should generate diff proposals for prompt improvements', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Generate improvements',
        description: 'Generate prompt improvements',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const improvements = await reflector.generatePromptImprovements();
      
      expect(improvements).toBeDefined();
      expect(improvements.proposals).toBeDefined();
      expect(Array.isArray(improvements.proposals)).toBe(true);
      
      if (improvements.proposals.length > 0) {
        expect(improvements.proposals[0]).toMatchObject({
          file: expect.any(String),
          diff: expect.any(String),
          rationale: expect.any(String),
          priority: expect.stringMatching(/^(low|medium|high)$/)
        });
      }
    });

    it('should identify underperforming prompts', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Identify issues',
        description: 'Identify prompt issues',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const analysis = await reflector.analyzePromptPerformance();
      
      expect(analysis.underperforming).toBeDefined();
      expect(Array.isArray(analysis.underperforming)).toBe(true);
    });

    it('should handle missing prompt files gracefully', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      fs.readdirSync.mockReturnValue([]);
      
      const task = {
        id: 'task-reflect',
        title: 'Handle missing files',
        description: 'Handle missing prompt files',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const improvements = await reflector.generatePromptImprovements();
      
      expect(improvements.proposals).toEqual([]);
    });
  });

  describe('Governor Integration', () => {
    beforeEach(async () => {
      await reflector.initialize(mockConfig);
    });

    it('should submit improvement proposals to Governor', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Submit to Governor',
        description: 'Submit improvements to Governor',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const proposals = {
        proposals: [
          {
            file: '/prompts/auth.md',
            diff: '- Add JWT validation\n+ Add comprehensive JWT validation with error handling',
            rationale: 'Improve error handling based on failure patterns',
            priority: 'high' as const
          }
        ]
      };

      const submission = await reflector.submitToGovernor(proposals);
      
      expect(submission).toBeDefined();
      expect(submission.submitted).toBe(true);
      expect(submission.proposals).toEqual(proposals.proposals);
    });

    it('should create pheromone for Governor notification', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Notify Governor',
        description: 'Notify Governor of improvements',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const proposals = {
        proposals: [
          {
            file: '/prompts/auth.md',
            diff: '- Simple auth\n+ Enhanced auth with validation',
            rationale: 'Based on failure analysis',
            priority: 'medium' as const
          }
        ]
      };

      await reflector.submitToGovernor(proposals);
      
      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'guide_pheromone',
          context: 'improvement_proposal',
          metadata: expect.objectContaining({
            proposalCount: 1,
            highPriority: 0
          })
        })
      );
    });
  });

  describe('Complete Workflow', () => {
    beforeEach(async () => {
      await reflector.initialize(mockConfig);
    });

    it('should execute complete reflection workflow', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Complete reflection',
        description: 'Execute complete reflection workflow',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const context = {
        analysisScope: 'full',
        includePromptAnalysis: true
      };

      await reflector.receiveTask(task, context);
      
      const result = await reflector.run();
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.performanceAnalysis).toBeDefined();
      expect(result.result.pheromones).toBeDefined();
      expect(result.result.promptImprovements).toBeDefined();
      expect(result.result.governorSubmission).toBeDefined();
    });

    it('should handle partial workflow execution', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Partial reflection',
        description: 'Execute partial reflection workflow',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const context = {
        analysisScope: 'patterns-only',
        includePromptAnalysis: false
      };

      await reflector.receiveTask(task, context);
      
      const result = await reflector.run();
      
      expect(result.success).toBe(true);
      expect(result.result.performanceAnalysis).toBeDefined();
      expect(result.result.pheromones).toBeDefined();
      // Should not include prompt improvements when disabled
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await reflector.initialize(mockConfig);
    });

    it('should handle Cognitive Canvas errors gracefully', async () => {
      mockCognitiveCanvas.getTasksByProject.mockRejectedValue(new Error('Canvas connection failed'));
      
      const task = {
        id: 'task-reflect',
        title: 'Handle errors',
        description: 'Handle canvas errors',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      await expect(reflector.run()).rejects.toThrow();
      expect(reflector.getStatus()).toBe('error');
    });

    it('should handle pheromone creation failures', async () => {
      mockCognitiveCanvas.createPheromone.mockRejectedValue(new Error('Pheromone creation failed'));
      
      const task = {
        id: 'task-reflect',
        title: 'Handle pheromone errors',
        description: 'Handle pheromone creation errors',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const pheromones = [
        {
          type: 'guide_pheromone' as const,
          strength: 0.5,
          context: 'test',
          message: 'test pheromone'
        }
      ];

      // Should not throw, but should log warning
      await expect(reflector.createPheromones(pheromones)).resolves.not.toThrow();
    });

    it('should handle missing project data', async () => {
      mockCognitiveCanvas.getProject.mockResolvedValue(null);
      
      const task = {
        id: 'task-reflect',
        title: 'Handle missing project',
        description: 'Handle missing project data',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const result = await reflector.run();
      
      expect(result.success).toBe(true);
      // Should handle gracefully with empty results
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      await reflector.initialize(mockConfig);
    });

    it('should calculate pattern success rates correctly', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Calculate metrics',
        description: 'Calculate performance metrics',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const patterns = await reflector.analyzePerformancePatterns();
      
      // JWT auth pattern should have high success rate (1 success, 0 failures)
      const jwtPattern = patterns.successPatterns.find(p => p.pattern === 'jwt-auth');
      expect(jwtPattern).toBeDefined();
      expect(jwtPattern?.successRate).toBe(1.0);
      
      // Database pattern should have low success rate (0 success, 1 failure)
      const dbPattern = patterns.failurePatterns.find(p => p.pattern === 'database-connection');
      expect(dbPattern).toBeDefined();
      expect(dbPattern?.failureRate).toBe(1.0);
    });

    it('should track performance trends over time', async () => {
      const task = {
        id: 'task-reflect',
        title: 'Track trends',
        description: 'Track performance trends',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await reflector.receiveTask(task, {});
      
      const patterns = await reflector.analyzePerformancePatterns();
      
      expect(patterns.correlations.timeBasedTrends).toBeDefined();
    });
  });
});