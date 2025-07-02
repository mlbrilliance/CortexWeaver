import { GovernorAgent } from '../../src/agents/governor';
import { Agent } from '../../src/agent';
import { ClaudeClient, ClaudeModel } from '../../src/claude-client';
import { WorkspaceManager } from '../../src/workspace';
import { CognitiveCanvas } from '../../src/cognitive-canvas';
import { SessionManager } from '../../src/session';
import { ConfigService } from '../../src/config';

// Mock dependencies
jest.mock('../../src/claude-client');
jest.mock('../../src/workspace');
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/session');
jest.mock('../../src/config');
jest.mock('fs');

describe('GovernorAgent', () => {
  let governor: GovernorAgent;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockCognitiveCanvas: jest.Mocked<CognitiveCanvas>;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockConfigService: jest.Mocked<ConfigService>;

  const mockConfig = {
    id: 'governor-1',
    role: 'meta-strategist',
    capabilities: ['cost-monitoring', 'budget-enforcement', 'quality-analysis', 'strategic-guidance'],
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

  const mockProjectConfig = {
    models: {
      claude: 'claude-3-sonnet-20240229',
      gemini: 'gemini-pro'
    },
    costs: {
      claudeTokenCost: 0.015,
      geminiTokenCost: 0.0005
    },
    budget: {
      maxTokens: 50000,
      maxCost: 500
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Claude client
    mockClaudeClient = {
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Budget analysis complete',
        tokenUsage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
        model: 'claude-3-sonnet-20240229'
      }),
      getConfiguration: jest.fn(),
      updateConfiguration: jest.fn(),
      sendMessageStream: jest.fn(),
      getTokenUsage: jest.fn().mockReturnValue({ 
        totalInputTokens: 500, 
        totalOutputTokens: 500, 
        totalTokens: 1000, 
        requestCount: 10, 
        estimatedCost: 15 
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
        id: 'pheromone-1',
        type: 'guide_pheromone',
        strength: 0.8,
        context: 'budget_guidance',
        metadata: {},
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }),
      getPheromonesByType: jest.fn().mockResolvedValue([]),
      getProject: jest.fn().mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
        status: 'active'
      }),
      getTasksByProject: jest.fn().mockResolvedValue([
        {
          id: 'task-1',
          title: 'Test Task',
          description: 'Test task description',
          status: 'completed',
          priority: 'medium',
          projectId: 'project-1',
          createdAt: new Date().toISOString(),
          metadata: { testResults: { passed: 8, failed: 2 } }
        } as any
      ]),
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
      getProjectKnowledgeGraph: jest.fn(),
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

    // Mock config service
    mockConfigService = {
      loadProjectConfig: jest.fn().mockReturnValue(mockProjectConfig),
      loadEnvironmentVariables: jest.fn().mockReturnValue({}),
      getRequiredEnvVar: jest.fn(),
      saveProjectConfig: jest.fn(),
      getProjectRoot: jest.fn().mockReturnValue('/test/workspace'),
      getCortexWeaverDir: jest.fn().mockReturnValue('/test/workspace/.cortexweaver')
    } as any;

    (ConfigService as jest.MockedClass<typeof ConfigService>).mockImplementation(() => mockConfigService);

    // Mock file system
    const fs = require('fs');
    fs.readFileSync = jest.fn().mockReturnValue('existing file content');
    fs.writeFileSync = jest.fn();
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();

    governor = new GovernorAgent();
  });

  describe('Initialization', () => {
    it('should extend Agent base class', () => {
      expect(governor).toBeInstanceOf(Agent);
    });

    it('should initialize with governor-specific configuration', async () => {
      await governor.initialize(mockConfig);
      
      expect(governor.getId()).toBe('governor-1');
      expect(governor.getRole()).toBe('meta-strategist');
      expect(governor.getCapabilities()).toContain('cost-monitoring');
      expect(governor.getCapabilities()).toContain('budget-enforcement');
      expect(governor.getCapabilities()).toContain('quality-analysis');
      expect(governor.getCapabilities()).toContain('strategic-guidance');
    });
  });

  describe('Prompt Template', () => {
    it('should provide governor-specific prompt template', () => {
      const template = governor.getPromptTemplate();
      
      expect(template).toContain('Meta-Strategist');
      expect(template).toContain('{{costs}}');
      expect(template).toContain('{{budget}}');
      expect(template).toContain('{{testResults}}');
      expect(template).toContain('pheromones');
    });

    it('should format template with context', () => {
      const template = governor.getPromptTemplate();
      const formatted = governor.formatPrompt(template, {
        costs: 'Current: $45.50',
        budget: 'Max: $500',
        testResults: 'Passed: 8, Failed: 2',
        projectName: 'TestProject'
      });
      
      expect(formatted).toContain('Current: $45.50');
      expect(formatted).toContain('Max: $500');
      expect(formatted).toContain('Passed: 8, Failed: 2');
      expect(formatted).toContain('TestProject');
    });
  });

  describe('Cost Monitoring', () => {
    beforeEach(async () => {
      await governor.initialize(mockConfig);
    });

    it('should monitor API costs via Cognitive Canvas queries', async () => {
      const costData = await governor.monitorCosts();
      
      expect(costData).toBeDefined();
      expect(costData.totalTokens).toBeDefined();
      expect(costData.totalCost).toBeDefined();
      expect(costData.breakdown).toBeDefined();
    });

    it('should calculate cost breakdown by model', async () => {
      const costData = await governor.monitorCosts();
      
      expect(costData.breakdown).toHaveProperty('claude');
      expect(costData.breakdown).toHaveProperty('gemini');
    });

    it('should handle missing cost data gracefully', async () => {
      mockClaudeClient.getTokenUsage.mockReturnValue(null as any);
      
      const costData = await governor.monitorCosts();
      
      expect(costData.totalTokens).toBe(0);
      expect(costData.totalCost).toBe(0);
    });
  });

  describe('Budget Enforcement', () => {
    beforeEach(async () => {
      await governor.initialize(mockConfig);
    });

    it('should enforce budget limits from config', async () => {
      const costData = {
        totalTokens: 60000, // Over limit
        totalCost: 600,     // Over limit
        breakdown: { claude: 400, gemini: 200 }
      };

      const enforcement = await governor.enforceBudgets(costData);
      
      expect(enforcement.tokenLimitExceeded).toBe(true);
      expect(enforcement.costLimitExceeded).toBe(true);
      expect(enforcement.recommendations).toContain('reduce token usage');
    });

    it('should allow operations within budget', async () => {
      const costData = {
        totalTokens: 30000, // Within limit
        totalCost: 300,     // Within limit
        breakdown: { claude: 200, gemini: 100 }
      };

      const enforcement = await governor.enforceBudgets(costData);
      
      expect(enforcement.tokenLimitExceeded).toBe(false);
      expect(enforcement.costLimitExceeded).toBe(false);
      expect(enforcement.allowContinue).toBe(true);
    });

    it('should provide specific warnings for approaching limits', async () => {
      const costData = {
        totalTokens: 45000, // 90% of limit
        totalCost: 450,     // 90% of limit
        breakdown: { claude: 300, gemini: 150 }
      };

      const enforcement = await governor.enforceBudgets(costData);
      
      expect(enforcement.warnings).toContain('approaching token limit');
      expect(enforcement.warnings).toContain('approaching cost limit');
    });
  });

  describe('Quality Analysis', () => {
    beforeEach(async () => {
      await governor.initialize(mockConfig);
    });

    it('should analyze test results from tasks', async () => {
      const task = {
        id: 'task-1',
        title: 'Governor oversight',
        description: 'Monitor project quality and costs',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await governor.receiveTask(task, {});

      const analysis = await governor.analyzeTestResults();
      
      expect(analysis).toBeDefined();
      expect(analysis.totalTests).toBeDefined();
      expect(analysis.passRate).toBeDefined();
      expect(analysis.qualityScore).toBeDefined();
    });

    it('should identify quality issues', async () => {
      mockCognitiveCanvas.getTasksByProject.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Low quality task',
          description: 'Task with low quality',
          status: 'completed',
          priority: 'medium',
          projectId: 'project-1',
          createdAt: new Date().toISOString(),
          metadata: { testResults: { passed: 2, failed: 8 } }
        } as any
      ]);

      const task = {
        id: 'task-1',
        title: 'Governor oversight',
        description: 'Monitor project quality',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await governor.receiveTask(task, {});

      const analysis = await governor.analyzeTestResults();
      
      expect(analysis.qualityScore).toBeLessThan(0.5);
      expect(analysis.issues).toContain('low test pass rate');
    });

    it('should handle missing test data', async () => {
      mockCognitiveCanvas.getTasksByProject.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Task without tests',
          description: 'Task without test data',
          status: 'completed',
          priority: 'medium',
          projectId: 'project-1',
          createdAt: new Date().toISOString(),
          metadata: {}
        } as any
      ]);

      const task = {
        id: 'task-1',
        title: 'Governor oversight',
        description: 'Monitor project quality',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await governor.receiveTask(task, {});

      const analysis = await governor.analyzeTestResults();
      
      expect(analysis.totalTests).toBe(0);
      expect(analysis.passRate).toBe(0);
    });
  });

  describe('Pheromone Creation', () => {
    beforeEach(async () => {
      await governor.initialize(mockConfig);
    });

    it('should create guide pheromones for positive guidance', async () => {
      const guidance = {
        type: 'guide_pheromone' as const,
        message: 'Optimize token usage by using shorter prompts',
        strength: 0.7,
        context: 'cost_optimization'
      };

      await governor.createPheromones([guidance]);
      
      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'guide_pheromone',
          strength: 0.7,
          context: 'cost_optimization'
        })
      );
    });

    it('should create warning pheromones for issues', async () => {
      const warning = {
        type: 'warn_pheromone' as const,
        message: 'Budget limit approaching - reduce API calls',
        strength: 0.9,
        context: 'budget_warning'
      };

      await governor.createPheromones([warning]);
      
      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warn_pheromone',
          strength: 0.9,
          context: 'budget_warning'
        })
      );
    });

    it('should handle multiple pheromones in batch', async () => {
      const pheromones = [
        {
          type: 'guide_pheromone' as const,
          message: 'Use caching to reduce API calls',
          strength: 0.6,
          context: 'optimization'
        },
        {
          type: 'warn_pheromone' as const,
          message: 'Test coverage is low',
          strength: 0.8,
          context: 'quality_warning'
        }
      ];

      await governor.createPheromones(pheromones);
      
      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledTimes(2);
    });
  });

  describe('Improvement Proposals', () => {
    beforeEach(async () => {
      await governor.initialize(mockConfig);
    });

    it('should propose changes to code standards', async () => {
      const proposals = await governor.proposeImprovements({
        costData: { totalTokens: 60000, totalCost: 600, breakdown: { claude: 400, gemini: 200 } },
        qualityData: { passRate: 0.3, qualityScore: 0.4, issues: ['low coverage'], totalTests: 10, recommendations: [] },
        budgetStatus: { tokenLimitExceeded: true, costLimitExceeded: true, allowContinue: false, warnings: [], recommendations: [] }
      });
      
      expect(proposals).toBeDefined();
      expect(proposals.codeStandards).toBeDefined();
      expect(proposals.configChanges).toBeDefined();
      expect(proposals.priority).toBe('high');
    });

    it('should suggest config modifications for budget issues', async () => {
      const proposals = await governor.proposeImprovements({
        costData: { totalTokens: 55000, totalCost: 550, breakdown: { claude: 350, gemini: 200 } },
        qualityData: { passRate: 0.8, qualityScore: 0.7, issues: [], totalTests: 20, recommendations: [] },
        budgetStatus: { tokenLimitExceeded: true, costLimitExceeded: true, allowContinue: false, warnings: [], recommendations: [] }
      });
      
      expect(proposals.configChanges).toContain('increase budget limits');
    });

    it('should recommend quality improvements', async () => {
      const proposals = await governor.proposeImprovements({
        costData: { totalTokens: 30000, totalCost: 300, breakdown: { claude: 200, gemini: 100 } },
        qualityData: { passRate: 0.4, qualityScore: 0.3, issues: ['failing tests'], totalTests: 15, recommendations: [] },
        budgetStatus: { tokenLimitExceeded: false, costLimitExceeded: false, allowContinue: true, warnings: [], recommendations: [] }
      });
      
      expect(proposals.codeStandards).toContain('improve test coverage');
    });
  });

  describe('Task Execution', () => {
    beforeEach(async () => {
      await governor.initialize(mockConfig);
    });

    it('should execute complete governor workflow', async () => {
      const task = {
        id: 'task-1',
        title: 'Governor oversight',
        description: 'Monitor costs, quality, and provide strategic guidance',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const context = {
        projectInfo: { name: 'TestProject', type: 'web-application' }
      };

      await governor.receiveTask(task, context);

      const result = await governor.run();
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.costMonitoring).toBeDefined();
      expect(result.result.budgetEnforcement).toBeDefined();
      expect(result.result.qualityAnalysis).toBeDefined();
      expect(result.result.pheromones).toBeDefined();
      expect(result.result.improvements).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const task = {
        id: 'task-1',
        title: 'Governor oversight',
        description: 'Test error handling',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await governor.receiveTask(task, {});

      mockCognitiveCanvas.getTasksByProject.mockRejectedValue(new Error('Canvas error'));

      await expect(governor.run()).rejects.toThrow();
      expect(governor.getStatus()).toBe('error');
    });
  });

  describe('V3.0 Reflector Spawning', () => {
    beforeEach(async () => {
      await governor.initialize(mockConfig);
    });

    it('should analyze and request Reflector spawn for quality issues', async () => {
      const task = {
        id: 'task-1',
        title: 'Governor oversight',
        description: 'Monitor project with quality issues',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      // Mock low quality data
      mockCognitiveCanvas.getTasksByProject.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Failed task',
          description: 'Task with critical quality issues',
          status: 'completed',
          priority: 'medium',
          projectId: 'project-1',
          createdAt: new Date().toISOString(),
          metadata: { testResults: { passed: 2, failed: 8 } }
        } as any
      ]);

      await governor.receiveTask(task, {});
      const result = await governor.run();
      
      expect(result.success).toBe(true);
      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reflector_request',
          context: 'system_reflection_needed',
          metadata: expect.objectContaining({
            priority: 'high',
            triggers: expect.arrayContaining(['quality_critical'])
          })
        })
      );
    });

    it('should handle budget violation triggers for Reflector spawn', async () => {
      mockClaudeClient.getTokenUsage.mockReturnValue({
        totalInputTokens: 30000,
        totalOutputTokens: 30000,
        totalTokens: 60000, // Over limit
        requestCount: 100,
        estimatedCost: 600 // Over limit
      });

      const task = {
        id: 'task-1',
        title: 'Governor oversight',
        description: 'Monitor budget violations',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await governor.receiveTask(task, {});
      const result = await governor.run();
      
      expect(result.success).toBe(true);
      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reflector_request',
          metadata: expect.objectContaining({
            triggers: expect.arrayContaining(['budget_violation'])
          })
        })
      );
    });

    it('should adjust spawn intervals based on priority', async () => {
      const task = {
        id: 'task-1',
        title: 'Governor oversight',
        description: 'Test interval adjustment',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      // Mock critical conditions
      mockCognitiveCanvas.getTasksByProject.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Critical failure',
          description: 'Critical system failure',
          status: 'completed',
          priority: 'high',
          projectId: 'project-1',
          createdAt: new Date().toISOString(),
          metadata: { testResults: { passed: 1, failed: 9 } }
        } as any
      ]);

      await governor.receiveTask(task, {});
      const result = await governor.run();
      
      expect(result.success).toBe(true);
      const pheromoneCall = mockCognitiveCanvas.createPheromone.mock.calls
        .find(call => call[0].type === 'reflector_request');
      
      expect(pheromoneCall[0].metadata.nextRecommendedSpawn).toBeDefined();
      expect(pheromoneCall[0].metadata.priority).toBe('high');
    });
  });

  describe('V3.0 Prompt Update Management', () => {
    beforeEach(async () => {
      await governor.initialize(mockConfig);
      
      // Mock file system operations
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('original prompt content');
      fs.writeFileSync.mockImplementation(() => {});
    });

    it('should process Reflector improvement proposals', async () => {
      // Mock improvement proposal pheromone
      mockCognitiveCanvas.getPheromonesByType.mockResolvedValue([
        {
          id: 'proposal-1',
          type: 'guide_pheromone',
          context: 'improvement_proposal',
          metadata: {
            agentId: 'reflector-1',
            proposals: [
              {
                file: '/test/prompts/governor.md',
                diff: '+ Improved instruction line',
                rationale: 'This improvement enhances clarity and effectiveness based on performance analysis',
                priority: 'high'
              }
            ]
          },
          strength: 0.8,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      ]);

      const task = {
        id: 'task-1',
        title: 'Governor oversight',
        description: 'Process prompt improvements',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await governor.receiveTask(task, {});
      const result = await governor.run();
      
      expect(result.success).toBe(true);
      
      // Verify audit trail was created
      const audits = governor.getPromptUpdateAudits();
      expect(audits.length).toBeGreaterThan(0);
      expect(audits[0].status).toBe('applied');
      expect(audits[0].reflectorProposal).toBeDefined();
    });

    it('should reject proposals with insufficient rationale', async () => {
      mockCognitiveCanvas.getPheromonesByType.mockResolvedValue([
        {
          id: 'proposal-2',
          type: 'guide_pheromone',
          context: 'improvement_proposal',
          metadata: {
            agentId: 'reflector-1',
            proposals: [
              {
                file: '/test/prompts/governor.md',
                diff: '+ Minor change',
                rationale: 'Short', // Too short
                priority: 'low'
              }
            ]
          },
          strength: 0.5,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      ]);

      const task = {
        id: 'task-1',
        title: 'Governor oversight',
        description: 'Test proposal rejection',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await governor.receiveTask(task, {});
      const result = await governor.run();
      
      expect(result.success).toBe(true);
      
      const audits = governor.getPromptUpdateAudits();
      expect(audits.length).toBeGreaterThan(0);
      expect(audits[0].status).toBe('rejected');
      expect(audits[0].reason).toContain('Insufficient rationale');
    });

    it('should handle proposal processing errors gracefully', async () => {
      const fs = require('fs');
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      mockCognitiveCanvas.getPheromonesByType.mockResolvedValue([
        {
          id: 'proposal-3',
          type: 'guide_pheromone',
          context: 'improvement_proposal',
          metadata: {
            agentId: 'reflector-1',
            proposals: [
              {
                file: '/test/prompts/governor.md',
                diff: '+ Good improvement',
                rationale: 'This is a well-reasoned improvement with detailed explanation',
                priority: 'medium'
              }
            ]
          },
          strength: 0.7,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      ]);

      const task = {
        id: 'task-1',
        title: 'Governor oversight',
        description: 'Test error handling',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await governor.receiveTask(task, {});
      const result = await governor.run();
      
      // Should not fail the entire execution
      expect(result.success).toBe(true);
      
      // Should create warning pheromone
      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warn_pheromone',
          context: 'prompt_update_failure'
        })
      );
    });
  });

  describe('V3.0 Enhanced Cost Analytics', () => {
    beforeEach(async () => {
      await governor.initialize(mockConfig);
    });

    it('should provide enhanced cost analytics with V3.0 features', async () => {
      mockClaudeClient.getTokenUsage.mockReturnValue({
        totalInputTokens: 500,
        totalOutputTokens: 500,
        totalTokens: 1000,
        requestCount: 10,
        estimatedCost: 15
      });

      mockCognitiveCanvas.getTasksByProject.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Completed task',
          status: 'completed',
          metadata: { agentType: 'coder' }
        },
        {
          id: 'task-2',
          title: 'Another completed task',
          status: 'completed',
          metadata: { agentType: 'tester' }
        }
      ] as any);

      const costData = await governor.monitorCosts();
      
      expect(costData.totalTokens).toBe(1000);
      expect(costData.totalCost).toBe(15);
      expect(costData.hourlyRate).toBeDefined();
      expect(costData.dailyProjection).toBeDefined();
      expect(costData.costByAgent).toBeDefined();
      expect(costData.efficiency).toBeDefined();
      expect(costData.costTrend).toBeDefined();
    });

    it('should calculate efficiency metrics correctly', async () => {
      mockCognitiveCanvas.getTasksByProject.mockResolvedValue([
        { id: 'task-1', status: 'completed', metadata: { agentType: 'coder' } },
        { id: 'task-2', status: 'completed', metadata: { agentType: 'coder' } },
        { id: 'task-3', status: 'failed', metadata: { agentType: 'tester' } }
      ] as any);

      const costData = await governor.monitorCosts();
      
      expect(costData.efficiency).toBeDefined();
      expect(costData.efficiency!.tokensPerTask).toBeGreaterThan(0);
      expect(costData.efficiency!.costPerTask).toBeGreaterThan(0);
      expect(costData.efficiency!.successRateImpact).toBeLessThan(1); // Should be reduced due to failure
    });
  });

  describe('V3.0 Integration and Metadata', () => {
    beforeEach(async () => {
      await governor.initialize(mockConfig);
    });

    it('should include V3.0 metadata in execution results', async () => {
      const task = {
        id: 'task-1',
        title: 'Governor oversight',
        description: 'Test V3.0 metadata',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await governor.receiveTask(task, {});
      const result = await governor.run();
      
      expect(result.success).toBe(true);
      expect((result.result as any).v3Metadata).toBeDefined();
      expect((result.result as any).v3Metadata.version).toBe('3.0');
      expect((result.result as any).v3Metadata.reflectorSpawnAnalysis).toBeDefined();
      expect((result.result as any).v3Metadata.personaLoaderActive).toBe(true);
    });

    it('should maintain backward compatibility with existing functionality', async () => {
      const task = {
        id: 'task-1',
        title: 'Governor oversight',
        description: 'Test backward compatibility',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await governor.receiveTask(task, {});
      const result = await governor.run();
      
      expect(result.success).toBe(true);
      expect(result.result.costMonitoring).toBeDefined();
      expect(result.result.budgetEnforcement).toBeDefined();
      expect(result.result.qualityAnalysis).toBeDefined();
      expect(result.result.pheromones).toBeDefined();
      expect(result.result.improvements).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await governor.initialize(mockConfig);
    });

    it('should handle empty project data', async () => {
      mockCognitiveCanvas.getProject.mockResolvedValue(null);
      mockCognitiveCanvas.getTasksByProject.mockResolvedValue([]);

      const task = {
        id: 'task-1',
        title: 'Governor oversight',
        description: 'Monitor empty project',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await governor.receiveTask(task, {});
      const result = await governor.run();
      
      expect(result.success).toBe(true);
    });

    it('should handle invalid cost data', async () => {
      mockClaudeClient.getTokenUsage.mockReturnValue({
        totalInputTokens: -1,
        totalOutputTokens: -1,
        totalTokens: -1,
        requestCount: 0,
        estimatedCost: NaN
      });

      const costData = await governor.monitorCosts();
      
      expect(costData.totalTokens).toBe(0);
      expect(costData.totalCost).toBe(0);
    });

    it('should handle missing config service', async () => {
      // Test without config service initialization
      const mockConfigBroken = {
        ...mockConfig,
        workspaceRoot: undefined as any
      };

      await expect(governor.initialize(mockConfigBroken)).rejects.toThrow('Workspace root is required');
    });

    it('should handle PersonaLoader failures gracefully', async () => {
      // Mock PersonaLoader to throw error
      const { PersonaLoader } = require('../../src/persona');
      PersonaLoader.mockImplementation(() => {
        throw new Error('PersonaLoader initialization failed');
      });

      const task = {
        id: 'task-1',
        title: 'Governor oversight',
        description: 'Test PersonaLoader error handling',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await governor.receiveTask(task, {});
      const result = await governor.run();
      
      // Should still complete successfully with fallback
      expect(result.success).toBe(true);
      expect((result.result as any).v3Metadata.personaLoaderActive).toBe(false);
    });
  });
});