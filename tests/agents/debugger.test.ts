import { DebuggerAgent } from '../../src/agents/debugger';
import { AgentConfig } from '../../src/agent';
import { ClaudeClient, ClaudeModel } from '../../src/claude-client';
import { CognitiveCanvas } from '../../src/cognitive-canvas';
import { WorkspaceManager } from '../../src/workspace';
import { SessionManager } from '../../src/session';

// Mock dependencies
jest.mock('../../src/claude-client');
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/workspace');
jest.mock('../../src/session');
jest.mock('fs');

describe('DebuggerAgent', () => {
  let debuggerAgent: DebuggerAgent;

  const mockConfig: AgentConfig = {
    id: 'debugger-test',
    role: 'Debugger',
    capabilities: ['failure-analysis', 'root-cause-identification', 'diagnostic-reasoning', 'solution-recommendation', 'pattern-recognition'],
    claudeConfig: {
      apiKey: 'test-api-key',
      defaultModel: ClaudeModel.SONNET,
      maxTokens: 4096,
      temperature: 0.7
    },
    workspaceRoot: '/test/workspace',
    cognitiveCanvasConfig: {
      uri: 'neo4j://localhost:7687',
      username: 'neo4j',
      password: 'password'
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock the dependencies that Agent uses
    (ClaudeClient as jest.MockedClass<typeof ClaudeClient>).mockImplementation(() => ({
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Mock response',
        tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        model: 'claude-3-sonnet-20240229'
      })
    } as any));

    (CognitiveCanvas as jest.MockedClass<typeof CognitiveCanvas>).mockImplementation(() => ({
      createPheromone: jest.fn(),
      initializeSchema: jest.fn(),
      close: jest.fn()
    } as any));

    (WorkspaceManager as jest.MockedClass<typeof WorkspaceManager>).mockImplementation(() => ({
      executeCommand: jest.fn(),
      getWorktreePath: jest.fn()
    } as any));

    (SessionManager as jest.MockedClass<typeof SessionManager>).mockImplementation(() => ({
      createSession: jest.fn(),
      runCommandInSession: jest.fn()
    } as any));

    debuggerAgent = new DebuggerAgent();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct role and capabilities', async () => {
      await debuggerAgent.initialize(mockConfig);
      
      expect(debuggerAgent.getId()).toBe('debugger-test');
      expect(debuggerAgent.getRole()).toBe('Debugger');
      expect(debuggerAgent.getCapabilities()).toContain('failure-analysis');
      expect(debuggerAgent.getCapabilities()).toContain('root-cause-identification');
      expect(debuggerAgent.getCapabilities()).toContain('diagnostic-reasoning');
      expect(debuggerAgent.getCapabilities()).toContain('solution-recommendation');
      expect(debuggerAgent.getCapabilities()).toContain('pattern-recognition');
    });

    it('should start in initialized state after setup', async () => {
      await debuggerAgent.initialize(mockConfig);
      expect(debuggerAgent.getStatus()).toBe('initialized');
    });
  });

  describe('getPromptTemplate', () => {
    it('should return a comprehensive debugger prompt template', () => {
      const template = debuggerAgent.getPromptTemplate();
      
      expect(template).toContain('Debugger Agent');
      expect(template).toContain('error analysis');
      expect(template).toContain('root cause');
      expect(template).toContain('diagnostic');
      expect(template).toContain('solution');
      expect(template).toContain('{{errorLogs}}');
      expect(template).toContain('{{testResults}}');
    });

    it('should format template with context variables', () => {
      const template = debuggerAgent.getPromptTemplate();
      const formatted = debuggerAgent.formatPrompt(template, {
        errorLogs: 'TypeError: Cannot read properties of undefined',
        testResults: 'Failed: 3, Passed: 7',
        projectName: 'TestProject'
      });
      
      expect(formatted).toContain('TypeError: Cannot read properties of undefined');
      expect(formatted).toContain('Failed: 3, Passed: 7');
      expect(formatted).toContain('TestProject');
    });
  });

  describe('analyzeFailure', () => {
    const mockFailure = {
      id: 'failure-123',
      type: 'agent_failure' as const,
      agentId: 'architect-001',
      taskId: 'task-456',
      errorMessage: 'TypeError: Cannot read properties of undefined (reading \'endpoints\')',
      stackTrace: `TypeError: Cannot read properties of undefined (reading 'endpoints')
    at ArchitectAgent.processContract (/src/agents/architect.ts:45:23)
    at Orchestrator.executeTask (/src/orchestrator.ts:123:45)`,
      timestamp: '2024-01-01T10:30:00Z',
      context: {
        contractId: 'contract-789',
        currentStep: 'architecture_generation',
        inputData: '{"name": "UserService", "type": "openapi"}'
      },
      severity: 'high' as const,
      projectId: 'test-project'
    };

    beforeEach(() => {
      mockCanvas.getFailureById.mockResolvedValue(mockFailure);
      mockCanvas.getRelatedArtifacts.mockResolvedValue([
        {
          id: 'contract-789',
          type: 'contract',
          content: '{"openapi": "3.0.0", "info": {"title": "UserService"}}',
          status: 'incomplete'
        }
      ]);
      mockCanvas.getPheromonesByType.mockResolvedValue([
        {
          id: 'warn-1',
          type: 'warn_pheromone',
          context: 'undefined-property-access',
          strength: 0.8,
          metadata: { pattern: 'missing-validation' },
          createdAt: '2024-01-01T09:00:00Z',
          expiresAt: '2024-12-31T23:59:59Z'
        }
      ]);
    });

    it('should perform comprehensive failure analysis', async () => {
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          rootCause: {
            category: 'data_validation',
            description: 'Contract data missing required endpoints property',
            confidence: 0.95,
            evidence: [
              'Stack trace shows undefined property access on \'endpoints\'',
              'Contract JSON lacks endpoints specification',
              'Similar failures found in pheromone history'
            ]
          },
          impactAnalysis: {
            immediateImpact: 'Architecture generation blocked',
            downstreamEffects: ['Prototype generation will fail', 'Code generation cannot proceed'],
            businessImpact: 'Development workflow completely halted'
          },
          solutions: [
            {
              type: 'immediate',
              description: 'Add null check before accessing endpoints property',
              implementation: 'Add validation: if (contract.endpoints) { ... }',
              priority: 'high',
              estimatedEffort: '15 minutes'
            },
            {
              type: 'systematic',
              description: 'Implement comprehensive contract validation',
              implementation: 'Create schema validation for all contract inputs',
              priority: 'medium',
              estimatedEffort: '2 hours'
            }
          ],
          prevention: {
            codeChanges: ['Add TypeScript strict mode', 'Implement input validation middleware'],
            processChanges: ['Contract review checklist', 'Automated schema validation'],
            monitoringChanges: ['Add contract validation alerts', 'Monitor undefined property access']
          }
        }),
        tokenUsage: { inputTokens: 250, outputTokens: 400, totalTokens: 650 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await debuggerAgent.analyzeFailure('failure-123');

      expect(result.success).toBe(true);
      expect(result.diagnostic?.rootCause.category).toBe('data_validation');
      expect(result.diagnostic?.rootCause.confidence).toBe(0.95);
      expect(result.diagnostic?.solutions).toHaveLength(2);
      expect(result.diagnostic?.prevention?.codeChanges).toContain('Add TypeScript strict mode');
      expect(mockCanvas.getFailureById).toHaveBeenCalledWith('failure-123');
    });

    it('should analyze system-level failures with metrics', async () => {
      const systemFailure = {
        ...mockFailure,
        type: 'system_failure' as const,
        errorMessage: 'ECONNREFUSED: Connection refused to Neo4j database',
        context: {
          service: 'cognitive_canvas',
          endpoint: 'bolt://localhost:7687',
          retryCount: 3
        }
      };

      mockCanvas.getFailureById.mockResolvedValue(systemFailure);
      mockMCPClient.getSystemMetrics.mockResolvedValue({
        memory: { usage: '85%', available: '2GB' },
        cpu: { usage: '45%', load: 1.2 },
        network: { latency: '200ms', packetLoss: '0.1%' },
        database: { connections: 95, maxConnections: 100, status: 'degraded' }
      });

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          rootCause: {
            category: 'infrastructure',
            description: 'Neo4j database connection pool exhausted',
            confidence: 0.88,
            evidence: ['95/100 connections in use', 'Database status: degraded', 'Connection refused error']
          },
          solutions: [
            {
              type: 'immediate',
              description: 'Restart Neo4j service to reset connection pool',
              implementation: 'docker restart neo4j-container',
              priority: 'critical',
              estimatedEffort: '5 minutes'
            }
          ]
        }),
        tokenUsage: { inputTokens: 200, outputTokens: 300, totalTokens: 500 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await debuggerAgent.analyzeFailure('failure-123');

      expect(result.diagnostic?.rootCause.category).toBe('infrastructure');
      expect(mockMCPClient.getSystemMetrics).toHaveBeenCalled();
    });

    it('should incorporate warning pheromones in analysis', async () => {
      mockClaudeClient.sendMessage.mockImplementation((prompt: any) => {
        expect(prompt).toContain('undefined-property-access');
        expect(prompt).toContain('warn_pheromone');
        expect(prompt).toContain('missing-validation');
        return Promise.resolve({
          content: JSON.stringify({
            rootCause: { category: 'validation', description: 'Known pattern', confidence: 0.9 },
            solutions: [{ type: 'immediate', description: 'Apply known fix' }]
          }),
          tokenUsage: { inputTokens: 180, outputTokens: 250, totalTokens: 430 },
          model: 'claude-3-sonnet-20240229'
        });
      });

      await debuggerAgent.analyzeFailure('failure-123');

      expect(mockCanvas.getPheromonesByType).toHaveBeenCalledWith('warn_pheromone');
      expect(mockClaudeClient.sendMessage).toHaveBeenCalled();
    });

    it('should create diagnostic node in Cognitive Canvas', async () => {
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          rootCause: { category: 'test', description: 'Test diagnostic' },
          solutions: []
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });
      mockCanvas.createDiagnosticNode.mockResolvedValue('diagnostic-node-456');

      const result = await debuggerAgent.analyzeFailure('failure-123');

      expect(mockCanvas.createDiagnosticNode).toHaveBeenCalledWith({
        failureId: 'failure-123',
        diagnostic: expect.any(Object),
        confidence: expect.any(Number),
        tokenUsage: expect.any(Object)
      });
      expect(result.diagnosticNodeId).toBe('diagnostic-node-456');
    });

    it('should link diagnostic to failure', async () => {
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          rootCause: { category: 'test', description: 'Test diagnostic' },
          solutions: []
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });
      mockCanvas.createDiagnosticNode.mockResolvedValue('diagnostic-node-456');

      await debuggerAgent.analyzeFailure('failure-123');

      expect(mockCanvas.linkDiagnosticToFailure).toHaveBeenCalledWith('diagnostic-node-456', 'failure-123');
    });
  });

  describe('identifyPatterns', () => {
    it('should identify recurring failure patterns', async () => {
      mockCanvas.getFailureHistory.mockResolvedValue([
        {
          id: 'fail-1',
          type: 'agent_failure' as const,
          errorMessage: 'TypeError: Cannot read properties of undefined',
          agentId: 'architect-001',
          timestamp: '2024-01-01T10:00:00Z',
          severity: 'medium' as const,
          projectId: 'test-project'
        },
        {
          id: 'fail-2', 
          type: 'agent_failure' as const,
          errorMessage: 'TypeError: Cannot read properties of undefined',
          agentId: 'architect-001',
          timestamp: '2024-01-01T11:00:00Z',
          severity: 'medium' as const,
          projectId: 'test-project'
        },
        {
          id: 'fail-3',
          type: 'agent_failure' as const,
          errorMessage: 'TypeError: Cannot read properties of undefined',
          agentId: 'coder-002',
          timestamp: '2024-01-01T12:00:00Z',
          severity: 'medium' as const,
          projectId: 'test-project'
        }
      ]);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          patterns: [
            {
              type: 'recurring_error',
              description: 'Undefined property access pattern affecting multiple agents',
              frequency: 3,
              timespan: '2 hours',
              affectedAgents: ['architect-001', 'coder-002'],
              commonFactors: ['undefined property access', 'missing null checks'],
              severity: 'high',
              trend: 'increasing'
            }
          ],
          recommendations: [
            'Implement global input validation middleware',
            'Add TypeScript strict null checks',
            'Create automated property existence validation'
          ]
        }),
        tokenUsage: { inputTokens: 300, outputTokens: 200, totalTokens: 500 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await debuggerAgent.identifyPatterns('test-project', 24);

      expect(result.success).toBe(true);
      expect(result.patterns).toHaveLength(1);
      expect(result.patterns?.[0].type).toBe('recurring_error');
      expect(result.patterns?.[0].frequency).toBe(3);
      expect(result.patterns?.[0].affectedAgents).toContain('architect-001');
      expect(result.recommendations).toContain('Implement global input validation middleware');
    });

    it('should analyze temporal patterns', async () => {
      mockCanvas.getFailureHistory.mockResolvedValue([
        { 
          id: 'f1', 
          timestamp: '2024-01-01T09:00:00Z', 
          type: 'timeout' as const,
          errorMessage: 'Operation timeout',
          severity: 'medium' as const,
          projectId: 'test-project'
        },
        { 
          id: 'f2', 
          timestamp: '2024-01-01T09:15:00Z', 
          type: 'timeout' as const,
          errorMessage: 'Operation timeout',
          severity: 'medium' as const,
          projectId: 'test-project'
        },
        { 
          id: 'f3', 
          timestamp: '2024-01-01T09:30:00Z', 
          type: 'timeout' as const,
          errorMessage: 'Operation timeout',
          severity: 'medium' as const,
          projectId: 'test-project'
        }
      ]);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          patterns: [
            {
              type: 'temporal_clustering',
              description: 'Timeout failures clustered in 30-minute window',
              timePattern: 'every_15_minutes',
              potentialCause: 'scheduled_task_interference',
              severity: 'medium'
            }
          ]
        }),
        tokenUsage: { inputTokens: 150, outputTokens: 180, totalTokens: 330 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await debuggerAgent.identifyPatterns('test-project', 2);

      expect(result.patterns?.[0].type).toBe('temporal_clustering');
      expect(result.patterns?.[0].timePattern).toBe('every_15_minutes');
    });
  });

  describe('generateSolutions', () => {
    it('should generate immediate and long-term solutions', async () => {
      const diagnostic = {
        rootCause: {
          category: 'data_validation',
          description: 'Missing null checks for contract properties',
          confidence: 0.9
        },
        failureContext: {
          agentType: 'architect',
          taskType: 'contract_processing',
          errorType: 'property_access'
        }
      };

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          immediateSolutions: [
            {
              title: 'Add Null Check Guard',
              description: 'Add defensive null checking before property access',
              code: 'if (contract?.endpoints) { processEndpoints(contract.endpoints); }',
              timeToImplement: '5 minutes',
              risk: 'low',
              effectiveness: 0.95
            }
          ],
          systematicSolutions: [
            {
              title: 'Implement Schema Validation',
              description: 'Add comprehensive contract schema validation',
              implementation: [
                'Install joi or zod validation library',
                'Define contract schema',
                'Add validation middleware',
                'Update all contract processing entry points'
              ],
              timeToImplement: '2-4 hours',
              risk: 'medium',
              effectiveness: 0.98,
              impact: 'Prevents all contract-related validation errors'
            }
          ],
          preventiveMeasures: [
            'Enable TypeScript strict mode',
            'Add ESLint rules for null safety',
            'Implement automated contract testing',
            'Add runtime type checking'
          ],
          testingStrategy: [
            'Unit tests for null/undefined inputs',
            'Integration tests with malformed contracts',
            'Property-based testing for contract validation'
          ]
        }),
        tokenUsage: { inputTokens: 200, outputTokens: 350, totalTokens: 550 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await debuggerAgent.generateSolutions(diagnostic);

      expect(result.success).toBe(true);
      expect(result.immediateSolutions).toHaveLength(1);
      expect(result.systematicSolutions).toHaveLength(1);
      expect(result.immediateSolutions?.[0].effectiveness).toBe(0.95);
      expect(result.systematicSolutions?.[0].implementation).toHaveLength(4);
      expect(result.preventiveMeasures).toContain('Enable TypeScript strict mode');
      expect(result.testingStrategy).toContain('Unit tests for null/undefined inputs');
    });

    it('should prioritize solutions by risk and effectiveness', async () => {
      const diagnostic = {
        rootCause: { category: 'performance', description: 'Memory leak', confidence: 0.8 }
      };

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          immediateSolutions: [
            {
              title: 'Restart Service',
              risk: 'high',
              effectiveness: 0.6,
              priority: 'low'
            },
            {
              title: 'Clear Cache',
              risk: 'low', 
              effectiveness: 0.8,
              priority: 'high'
            }
          ]
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await debuggerAgent.generateSolutions(diagnostic);

      expect(result.immediateSolutions?.[1].priority).toBe('high');
      expect(result.immediateSolutions?.[0].priority).toBe('low');
    });
  });

  describe('createWarnPheromone', () => {
    it('should create warning pheromones for future prevention', async () => {
      const diagnostic = {
        rootCause: {
          category: 'validation',
          description: 'Undefined property access on contract.endpoints',
          confidence: 0.9
        },
        failurePattern: 'property_access_without_validation',
        affectedComponents: ['architect', 'contract_processor']
      };

      mockCanvas.createWarnPheromone.mockResolvedValue({
        id: 'warn-pheromone-789',
        type: 'warn_pheromone',
        strength: 0.8,
        context: 'undefined-property-access',
        metadata: {},
        createdAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-12-31T23:59:59Z'
      });

      const result = await debuggerAgent.createWarnPheromone(
        'undefined-property-access',
        diagnostic,
        0.8
      );

      expect(result.success).toBe(true);
      expect(result.pheromone?.id).toBe('warn-pheromone-789');
      expect(mockCanvas.createWarnPheromone).toHaveBeenCalledWith(
        'undefined-property-access',
        expect.objectContaining({
          taskOutcome: 'failure',
          errorTypes: ['undefined_property'],
          agentType: 'multiple',
          complexity: 'medium'
        }),
        0.8,
        expect.any(Number)
      );
    });

    it('should set appropriate TTL based on severity', async () => {
      const criticalDiagnostic = {
        rootCause: { category: 'security', description: 'SQL injection vulnerability' }
      };

      await debuggerAgent.createWarnPheromone('sql-injection', criticalDiagnostic, 0.95);

      expect(mockCanvas.createWarnPheromone).toHaveBeenCalledWith(
        'sql-injection',
        expect.any(Object),
        0.95,
        604800000 // 7 days for high-severity issues
      );
    });
  });

  describe('performDeepDiagnostic', () => {
    it('should perform comprehensive system analysis', async () => {
      mockMCPClient.analyzeLogs.mockResolvedValue({
        errorPatterns: ['Connection timeout', 'Memory allocation failed'],
        frequency: { 'Connection timeout': 15, 'Memory allocation failed': 8 },
        timeline: '2024-01-01T10:00:00Z to 2024-01-01T12:00:00Z'
      });

      mockMCPClient.getSystemMetrics.mockResolvedValue({
        memory: { usage: '92%', trend: 'increasing' },
        cpu: { usage: '78%', trend: 'stable' },
        disk: { usage: '65%', iops: 'high' },
        network: { bandwidth: '850Mbps', errors: 0.02 }
      });

      mockMCPClient.getEnvironmentInfo.mockResolvedValue({
        nodeVersion: 'v18.17.0',
        npmVersion: '9.6.7',
        osVersion: 'Ubuntu 22.04',
        dockerVersion: '24.0.5',
        dependencies: {
          'neo4j-driver': '5.8.0',
          'typescript': '5.1.6'
        }
      });

      mockCanvas.getAgentInteractions.mockResolvedValue([
        {
          id: 'interaction-1',
          fromAgent: 'orchestrator',
          toAgent: 'architect',
          timestamp: '2024-01-01T10:00:00Z',
          taskId: 'task-123',
          outcome: 'failure' as const,
          duration: 30000,
          projectId: 'test-project'
        }
      ]);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          systemHealth: {
            overall: 'degraded',
            criticalIssues: ['Memory usage approaching limit', 'High error frequency'],
            recommendations: ['Scale memory resources', 'Implement connection pooling']
          },
          environmentAnalysis: {
            compatibility: 'good',
            outdatedDependencies: [],
            configurationIssues: ['Missing connection pool configuration']
          },
          interactionAnalysis: {
            problematicAgents: ['architect'],
            communicationIssues: ['Repeated failures in same agent'],
            bottlenecks: ['Task queue backup at architect agent']
          }
        }),
        tokenUsage: { inputTokens: 400, outputTokens: 300, totalTokens: 700 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await debuggerAgent.performDeepDiagnostic('test-project');

      expect(result.success).toBe(true);
      expect(result.systemHealth?.overall).toBe('degraded');
      expect(result.systemHealth?.criticalIssues).toContain('Memory usage approaching limit');
      expect(mockMCPClient.analyzeLogs).toHaveBeenCalled();
      expect(mockMCPClient.getSystemMetrics).toHaveBeenCalled();
      expect(mockMCPClient.getEnvironmentInfo).toHaveBeenCalled();
    });

    it('should analyze agent interaction patterns', async () => {
      mockMCPClient.analyzeLogs.mockResolvedValue({
        errorPatterns: ['Agent communication timeout'],
        frequency: { 'Agent communication timeout': 5 },
        timeline: '2024-01-01T10:00:00Z to 2024-01-01T11:00:00Z'
      });

      mockMCPClient.getSystemMetrics.mockResolvedValue({
        memory: { usage: '65%', trend: 'stable' },
        cpu: { usage: '45%', trend: 'stable' }
      });

      mockMCPClient.getEnvironmentInfo.mockResolvedValue({
        nodeVersion: 'v18.17.0',
        npmVersion: '9.6.7',
        osVersion: 'Ubuntu 22.04',
        dependencies: {}
      });

      mockCanvas.getAgentInteractions.mockResolvedValue([
        {
          id: 'interaction-1',
          fromAgent: 'orchestrator',
          toAgent: 'architect',
          timestamp: '2024-01-01T10:00:00Z',
          taskId: 'task-123',
          outcome: 'failure' as const,
          duration: 30000,
          projectId: 'test-project'
        },
        {
          id: 'interaction-2',
          fromAgent: 'orchestrator',
          toAgent: 'architect',
          timestamp: '2024-01-01T10:05:00Z',
          taskId: 'task-124',
          outcome: 'failure' as const,
          duration: 25000,
          projectId: 'test-project'
        }
      ]);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          interactionAnalysis: {
            problematicAgents: ['architect'],
            communicationIssues: ['Repeated failures in same agent'],
            bottlenecks: ['Task queue backup at architect agent']
          }
        }),
        tokenUsage: { inputTokens: 200, outputTokens: 180, totalTokens: 380 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await debuggerAgent.performDeepDiagnostic('test-project');

      expect(result.interactionAnalysis?.problematicAgents).toContain('architect');
      expect(mockCanvas.getAgentInteractions).toHaveBeenCalledWith('test-project', expect.any(Number));
    });
  });

  describe('error handling', () => {
    it('should handle failure not found', async () => {
      mockCanvas.getFailureById.mockResolvedValue(null);

      const result = await debuggerAgent.analyzeFailure('nonexistent-failure');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failure not found');
    });

    it('should handle Claude API failures', async () => {
      mockCanvas.getFailureById.mockResolvedValue({
        id: 'test-failure',
        type: 'agent_failure' as const,
        errorMessage: 'Test error',
        timestamp: '2024-01-01T00:00:00Z',
        severity: 'medium' as const,
        projectId: 'test-project'
      });
      mockClaudeClient.sendMessage.mockRejectedValue(new Error('API Error'));

      const result = await debuggerAgent.analyzeFailure('test-failure');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to analyze failure');
    });

    it('should handle malformed diagnostic responses', async () => {
      mockCanvas.getFailureById.mockResolvedValue({
        id: 'test-failure',
        type: 'agent_failure' as const,
        errorMessage: 'Test error',
        timestamp: '2024-01-01T00:00:00Z',
        severity: 'medium' as const,
        projectId: 'test-project'
      });
      mockCanvas.getRelatedArtifacts.mockResolvedValue([]);
      mockCanvas.getPheromonesByType.mockResolvedValue([]);
      mockCanvas.createDiagnosticNode.mockResolvedValue('diagnostic-node-test');
      mockCanvas.linkDiagnosticToFailure.mockResolvedValue(undefined);
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: 'invalid json response',
        tokenUsage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await debuggerAgent.analyzeFailure('test-failure');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse diagnostic response');
    });

    it('should handle system metrics collection failures', async () => {
      mockMCPClient.analyzeLogs.mockRejectedValue(new Error('Log access failed'));
      mockMCPClient.getSystemMetrics.mockRejectedValue(new Error('Metrics unavailable'));

      const result = await debuggerAgent.performDeepDiagnostic('test-project');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to collect system diagnostics');
    });
  });

  describe('integration with Orchestrator', () => {
    it('should provide structured diagnostic reports for workflow decisions', async () => {
      const mockFailure = {
        id: 'critical-failure',
        type: 'agent_failure' as const,
        severity: 'critical' as const,
        errorMessage: 'Critical system failure',
        timestamp: '2024-01-01T00:00:00Z',
        projectId: 'test-project'
      };

      mockCanvas.getFailureById.mockResolvedValue(mockFailure);
      mockCanvas.getRelatedArtifacts.mockResolvedValue([]);
      mockCanvas.getPheromonesByType.mockResolvedValue([]);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          rootCause: {
            category: 'system_critical',
            description: 'Database connection failure',
            confidence: 0.95
          },
          workflowImpact: {
            shouldHaltWorkflow: true,
            affectedAgents: ['all'],
            estimatedRecoveryTime: '30 minutes',
            criticalityLevel: 'workflow_blocking'
          },
          solutions: [
            {
              type: 'immediate',
              description: 'Restart database service',
              canAutomateRecovery: true,
              priority: 'critical'
            }
          ]
        }),
        tokenUsage: { inputTokens: 200, outputTokens: 300, totalTokens: 500 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await debuggerAgent.analyzeFailure('critical-failure');

      expect(result.workflowGuidance).toBeDefined();
      expect(result.workflowGuidance?.shouldHaltWorkflow).toBe(true);
      expect(result.workflowGuidance?.criticalityLevel).toBe('workflow_blocking');
      expect(result.workflowGuidance?.affectedAgents).toContain('all');
    });

    it('should recommend recovery strategies', async () => {
      const diagnostic = {
        rootCause: { category: 'transient', description: 'Network timeout' }
      };

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          recoveryStrategy: {
            type: 'retry_with_backoff',
            maxRetries: 3,
            backoffMultiplier: 2,
            baseDelay: 1000,
            circuitBreakerThreshold: 5
          },
          monitoringRecommendations: [
            'Enable detailed network logging',
            'Add timeout duration metrics',
            'Monitor connection pool status'
          ]
        }),
        tokenUsage: { inputTokens: 150, outputTokens: 200, totalTokens: 350 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await debuggerAgent.generateSolutions(diagnostic);

      expect(result.recoveryStrategy?.type).toBe('retry_with_backoff');
      expect(result.recoveryStrategy?.maxRetries).toBe(3);
      expect(result.monitoringRecommendations).toContain('Enable detailed network logging');
    });
  });

  describe('performance and optimization', () => {
    it('should track diagnostic performance metrics', async () => {
      mockCanvas.getFailureById.mockResolvedValue({
        id: 'perf-test',
        type: 'agent_failure' as const,
        errorMessage: 'Performance test failure',
        timestamp: '2024-01-01T00:00:00Z',
        severity: 'medium' as const,
        projectId: 'test-project'
      });
      mockCanvas.getRelatedArtifacts.mockResolvedValue([]);
      mockCanvas.getPheromonesByType.mockResolvedValue([]);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          rootCause: { category: 'test', description: 'Test diagnostic' },
          solutions: []
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });

      const startTime = Date.now();
      const result = await debuggerAgent.analyzeFailure('perf-test');
      const endTime = Date.now();

      expect(result.performance).toBeDefined();
      expect(result.performance?.analysisTimeMs).toBeLessThanOrEqual(endTime - startTime + 100);
      expect(result.performance?.tokenUsage).toEqual({
        inputTokens: 100,
        outputTokens: 150,
        totalTokens: 250
      });
    });

    it('should complete analysis within reasonable time limits', async () => {
      mockCanvas.getFailureById.mockResolvedValue({
        id: 'time-test',
        type: 'agent_failure' as const,
        errorMessage: 'Timing test failure',
        timestamp: '2024-01-01T00:00:00Z',
        severity: 'medium' as const,
        projectId: 'test-project'
      });
      mockCanvas.getRelatedArtifacts.mockResolvedValue([]);
      mockCanvas.getPheromonesByType.mockResolvedValue([]);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          rootCause: { category: 'test', description: 'Quick diagnostic' },
          solutions: []
        }),
        tokenUsage: { inputTokens: 50, outputTokens: 75, totalTokens: 125 },
        model: 'claude-3-sonnet-20240229'
      });

      const startTime = Date.now();
      await debuggerAgent.analyzeFailure('time-test');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should optimize analysis based on failure type', async () => {
      const simpleFailure = {
        id: 'simple-failure',
        type: 'validation_error' as const,
        severity: 'low' as const,
        errorMessage: 'Simple validation error',
        timestamp: '2024-01-01T00:00:00Z',
        projectId: 'test-project'
      };

      mockCanvas.getFailureById.mockResolvedValue(simpleFailure);
      mockCanvas.getRelatedArtifacts.mockResolvedValue([]);
      mockCanvas.getPheromonesByType.mockResolvedValue([]);
      mockCanvas.createDiagnosticNode.mockResolvedValue('diagnostic-node-simple');
      mockCanvas.linkDiagnosticToFailure.mockResolvedValue(undefined);

      // Should use optimized prompt for simple failures
      mockClaudeClient.sendMessage.mockImplementation((prompt: any) => {
        expect(prompt).toContain('validation_error');
        expect(prompt).toContain('simple analysis');
        return Promise.resolve({
          content: JSON.stringify({
            rootCause: { category: 'validation', description: 'Simple fix needed' },
            solutions: [{ type: 'immediate', description: 'Add validation check' }]
          }),
          tokenUsage: { inputTokens: 75, outputTokens: 100, totalTokens: 175 },
          model: 'claude-3-sonnet-20240229'
        });
      });

      const result = await debuggerAgent.analyzeFailure('simple-failure');

      expect(result.success).toBe(true);
      expect(result.performance?.tokenUsage.totalTokens).toBeLessThan(200); // Optimized for simple cases
    });
  });
});