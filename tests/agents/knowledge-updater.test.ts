import { KnowledgeUpdaterAgent } from '../../src/agents/knowledge-updater';
import { ClaudeClient, ClaudeModel } from '../../src/claude-client';
import { CognitiveCanvas } from '../../src/cognitive-canvas';
import { MCPClient } from '../../src/mcp-client';

// Mock dependencies
jest.mock('../../src/claude-client');
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/mcp-client');
jest.mock('fs');

describe('KnowledgeUpdaterAgent', () => {
  let knowledgeUpdaterAgent: KnowledgeUpdaterAgent;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockCanvas: jest.Mocked<CognitiveCanvas>;
  let mockMCPClient: jest.Mocked<MCPClient>;

  beforeEach(() => {
    // Create mock dependencies
    mockClaudeClient = {
      sendMessage: jest.fn()
    } as any;

    mockCanvas = {
      getCompletedTasks: jest.fn(),
      updateKnowledgeNode: jest.fn(),
      createKnowledgeExtraction: jest.fn(),
      linkKnowledgeToTask: jest.fn(),
      validateKnowledgeConsistency: jest.fn(),
      getRelatedKnowledge: jest.fn(),
      updatePheromoneStrengths: jest.fn(),
      getTaskDetails: jest.fn(),
      getProjectKnowledge: jest.fn(),
      identifyKnowledgeGaps: jest.fn(),
      createGuidePheromone: jest.fn(),
      updateProjectMetrics: jest.fn()
    } as any;

    mockMCPClient = {
      getFileContent: jest.fn(),
      scanWorktreeForChanges: jest.fn(),
      commitKnowledgeUpdates: jest.fn()
    } as any;

    knowledgeUpdaterAgent = new KnowledgeUpdaterAgent(mockClaudeClient, mockCanvas, mockMCPClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct role and capabilities', () => {
      expect(knowledgeUpdaterAgent.role).toBe('KnowledgeUpdater');
      expect(knowledgeUpdaterAgent.capabilities).toContain('knowledge-extraction');
      expect(knowledgeUpdaterAgent.capabilities).toContain('insight-analysis');
      expect(knowledgeUpdaterAgent.capabilities).toContain('consistency-validation');
      expect(knowledgeUpdaterAgent.capabilities).toContain('pattern-synthesis');
      expect(knowledgeUpdaterAgent.capabilities).toContain('pheromone-optimization');
    });

    it('should start in idle state', () => {
      expect(knowledgeUpdaterAgent.isProcessing).toBe(false);
      expect(knowledgeUpdaterAgent.currentUpdateId).toBeNull();
    });
  });

  describe('processCompletedTask', () => {
    const mockCompletedTask = {
      id: 'task-123',
      title: 'Implement Authentication API',
      description: 'Create secure user authentication endpoint',
      status: 'completed',
      priority: 'high',
      projectId: 'test-project',
      createdAt: '2024-01-01T10:00:00Z',
      completedAt: '2024-01-01T12:00:00Z',
      artifacts: ['contract-123', 'prototype-456', 'code-789'],
      outcome: {
        success: true,
        quality: 'high',
        issues: [],
        learnings: ['JWT implementation patterns', 'Security best practices']
      }
    };

    beforeEach(() => {
      mockCanvas.getTaskDetails.mockResolvedValue(mockCompletedTask);
      mockCanvas.getRelatedKnowledge.mockResolvedValue([
        {
          id: 'knowledge-1',
          type: 'pattern',
          content: 'Authentication patterns for Node.js applications',
          confidence: 0.9,
          source: 'task-100',
          tags: ['auth', 'nodejs', 'security']
        }
      ]);
    });

    it('should extract knowledge from successfully completed task', async () => {
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          keyInsights: [
            {
              type: 'pattern',
              description: 'JWT-based authentication pattern',
              applicability: 'authentication endpoints',
              confidence: 0.95,
              evidence: ['Successful implementation', 'High quality rating', 'No security issues']
            },
            {
              type: 'best_practice',
              description: 'Input validation for auth endpoints',
              applicability: 'all API endpoints',
              confidence: 0.88,
              evidence: ['Prevented common vulnerabilities', 'Clean implementation']
            }
          ],
          codePatterns: [
            {
              pattern: 'middleware-auth-validation',
              description: 'Authentication middleware pattern',
              codeSnippet: 'const authMiddleware = (req, res, next) => { ... }',
              reusability: 'high',
              complexity: 'medium'
            }
          ],
          pheromoneRecommendations: [
            {
              type: 'guide_pheromone',
              context: 'jwt-authentication',
              strength: 0.9,
              reason: 'Successful implementation with high quality'
            }
          ]
        }),
        tokenUsage: { inputTokens: 200, outputTokens: 300, totalTokens: 500 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await knowledgeUpdaterAgent.processCompletedTask('task-123');

      expect(result.success).toBe(true);
      expect(result.insights).toHaveLength(2);
      expect(result.insights?.[0].type).toBe('pattern');
      expect(result.insights?.[0].confidence).toBe(0.95);
      expect(result.codePatterns).toHaveLength(1);
      expect(result.pheromoneRecommendations).toHaveLength(1);
      expect(mockCanvas.getTaskDetails).toHaveBeenCalledWith('task-123');
    });

    it('should handle failed tasks differently', async () => {
      const failedTask = {
        ...mockCompletedTask,
        status: 'failed',
        outcome: {
          success: false,
          quality: 'poor',
          issues: ['Authentication bypass vulnerability', 'Incomplete input validation'],
          learnings: ['Need better security testing', 'Input validation critical']
        }
      };

      mockCanvas.getTaskDetails.mockResolvedValue(failedTask);
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          keyInsights: [
            {
              type: 'anti_pattern',
              description: 'Inadequate input validation leads to security vulnerabilities',
              applicability: 'all authentication flows',
              confidence: 0.92,
              evidence: ['Authentication bypass found', 'Security audit failed']
            }
          ],
          pheromoneRecommendations: [
            {
              type: 'warn_pheromone',
              context: 'inadequate-input-validation',
              strength: 0.85,
              reason: 'Critical security vulnerability discovered'
            }
          ]
        }),
        tokenUsage: { inputTokens: 150, outputTokens: 200, totalTokens: 350 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await knowledgeUpdaterAgent.processCompletedTask('task-123');

      expect(result.success).toBe(true);
      expect(result.insights?.[0].type).toBe('anti_pattern');
      expect(result.pheromoneRecommendations?.[0].type).toBe('warn_pheromone');
    });

    it('should create knowledge extraction node in Cognitive Canvas', async () => {
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          keyInsights: [],
          codePatterns: [],
          pheromoneRecommendations: []
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });
      mockCanvas.createKnowledgeExtraction.mockResolvedValue('knowledge-extraction-456');

      const result = await knowledgeUpdaterAgent.processCompletedTask('task-123');

      expect(mockCanvas.createKnowledgeExtraction).toHaveBeenCalledWith({
        taskId: 'task-123',
        insights: expect.any(Array),
        patterns: expect.any(Array),
        extractionMethod: 'llm_analysis',
        confidence: expect.any(Number),
        tokenUsage: expect.any(Object)
      });
      expect(result.knowledgeNodeId).toBe('knowledge-extraction-456');
    });

    it('should link knowledge extraction to original task', async () => {
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          keyInsights: [],
          codePatterns: [],
          pheromoneRecommendations: []
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });
      mockCanvas.createKnowledgeExtraction.mockResolvedValue('knowledge-extraction-456');

      await knowledgeUpdaterAgent.processCompletedTask('task-123');

      expect(mockCanvas.linkKnowledgeToTask).toHaveBeenCalledWith('knowledge-extraction-456', 'task-123');
    });
  });

  describe('updatePheromoneStrengths', () => {
    it('should strengthen guide pheromones based on successful outcomes', async () => {
      const successfulOutcomes = [
        {
          taskId: 'task-1',
          outcome: 'success' as const,
          quality: 'high',
          pheromoneUsed: 'jwt-auth-pattern',
          duration: 2000
        },
        {
          taskId: 'task-2', 
          outcome: 'success' as const,
          quality: 'excellent',
          pheromoneUsed: 'jwt-auth-pattern',
          duration: 1800
        }
      ];

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          strengthenRecommendations: [
            {
              pheromoneContext: 'jwt-auth-pattern',
              newStrength: 0.92,
              adjustment: '+0.15',
              reason: 'Consistent high-quality outcomes across multiple tasks'
            }
          ],
          weakenRecommendations: [],
          newPheromones: []
        }),
        tokenUsage: { inputTokens: 150, outputTokens: 100, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await knowledgeUpdaterAgent.updatePheromoneStrengths('test-project', successfulOutcomes);

      expect(result.success).toBe(true);
      expect(result.strengthened).toHaveLength(1);
      expect(result.strengthened?.[0].newStrength).toBe(0.92);
      expect(mockCanvas.updatePheromoneStrengths).toHaveBeenCalled();
    });

    it('should weaken pheromones based on failed outcomes', async () => {
      const failedOutcomes = [
        {
          taskId: 'task-3',
          outcome: 'failure' as const,
          quality: 'poor',
          pheromoneUsed: 'outdated-auth-pattern',
          issues: ['Security vulnerability', 'Poor performance']
        }
      ];

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          strengthenRecommendations: [],
          weakenRecommendations: [
            {
              pheromoneContext: 'outdated-auth-pattern',
              newStrength: 0.3,
              adjustment: '-0.4',
              reason: 'Led to security vulnerability and poor performance'
            }
          ],
          deprecationRecommendations: [
            {
              pheromoneContext: 'outdated-auth-pattern',
              reason: 'Pattern no longer secure with current standards'
            }
          ]
        }),
        tokenUsage: { inputTokens: 120, outputTokens: 80, totalTokens: 200 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await knowledgeUpdaterAgent.updatePheromoneStrengths('test-project', failedOutcomes);

      expect(result.success).toBe(true);
      expect(result.weakened).toHaveLength(1);
      expect(result.weakened?.[0].newStrength).toBe(0.3);
      expect(result.deprecated).toHaveLength(1);
    });
  });

  describe('validateKnowledgeConsistency', () => {
    it('should identify and resolve knowledge conflicts', async () => {
      mockCanvas.getProjectKnowledge.mockResolvedValue([
        {
          id: 'knowledge-1',
          type: 'pattern',
          content: 'Use bcrypt for password hashing',
          confidence: 0.9,
          source: 'task-100',
          tags: ['auth', 'security', 'password']
        },
        {
          id: 'knowledge-2',
          type: 'pattern', 
          content: 'Use SHA256 for password hashing',
          confidence: 0.6,
          source: 'task-50',
          tags: ['auth', 'security', 'password']
        }
      ]);

      mockCanvas.validateKnowledgeConsistency.mockResolvedValue([
        {
          knowledge1: 'knowledge-1',
          knowledge2: 'knowledge-2',
          type: 'potential_conflict',
          description: 'Similar domains: pattern vs pattern'
        }
      ]);

      mockCanvas.identifyKnowledgeGaps.mockResolvedValue([
        {
          domain: 'error-handling',
          description: 'Missing patterns for error-handling domain',
          priority: 'high',
          suggestedSources: ['completed tasks']
        }
      ]);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          conflicts: [
            {
              type: 'contradictory_patterns',
              knowledge1: 'knowledge-1',
              knowledge2: 'knowledge-2',
              description: 'Conflicting password hashing recommendations',
              severity: 'high',
              resolution: 'prefer_bcrypt'
            }
          ],
          resolutions: [
            {
              action: 'deprecate',
              knowledgeId: 'knowledge-2',
              reason: 'SHA256 is not recommended for password hashing'
            },
            {
              action: 'strengthen',
              knowledgeId: 'knowledge-1', 
              reason: 'bcrypt is industry standard for password hashing'
            }
          ]
        }),
        tokenUsage: { inputTokens: 180, outputTokens: 150, totalTokens: 330 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await knowledgeUpdaterAgent.validateKnowledgeConsistency('test-project');

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.resolutions).toHaveLength(2);
      expect(result.conflicts?.[0].severity).toBe('high');
      expect(mockCanvas.validateKnowledgeConsistency).toHaveBeenCalled();
    });

    it('should identify knowledge gaps', async () => {
      mockCanvas.getProjectKnowledge.mockResolvedValue([]);
      mockCanvas.validateKnowledgeConsistency.mockResolvedValue([]);
      
      mockCanvas.identifyKnowledgeGaps.mockResolvedValue([
        {
          domain: 'error-handling',
          description: 'Missing patterns for API error handling',
          priority: 'high',
          suggestedSources: ['completed error handling tasks', 'external documentation']
        },
        {
          domain: 'testing',
          description: 'Insufficient testing patterns for async operations',
          priority: 'medium',
          suggestedSources: ['testing framework documentation']
        }
      ]);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          gapAnalysis: [
            {
              gap: 'error-handling',
              priority: 'high',
              recommendation: 'Extract patterns from recent error handling implementations'
            }
          ]
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 80, totalTokens: 180 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await knowledgeUpdaterAgent.validateKnowledgeConsistency('test-project');

      expect(result.knowledgeGaps).toHaveLength(2);
      expect(result.knowledgeGaps?.[0].priority).toBe('high');
      expect(mockCanvas.identifyKnowledgeGaps).toHaveBeenCalledWith('test-project');
    });
  });

  describe('synthesizePatterns', () => {
    it('should identify emerging patterns across multiple tasks', async () => {
      const relatedTasks = [
        {
          id: 'task-1',
          artifacts: ['auth-contract-1', 'auth-code-1'],
          outcome: { success: true, patterns: ['middleware-validation'] }
        },
        {
          id: 'task-2', 
          artifacts: ['auth-contract-2', 'auth-code-2'],
          outcome: { success: true, patterns: ['middleware-validation', 'jwt-generation'] }
        },
        {
          id: 'task-3',
          artifacts: ['auth-contract-3', 'auth-code-3'],
          outcome: { success: true, patterns: ['middleware-validation', 'rate-limiting'] }
        }
      ];

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          emergingPatterns: [
            {
              name: 'comprehensive-auth-middleware',
              description: 'Authentication middleware with validation, JWT, and rate limiting',
              frequency: 3,
              successRate: 1.0,
              components: ['middleware-validation', 'jwt-generation', 'rate-limiting'],
              reusabilityScore: 0.95,
              complexity: 'medium'
            }
          ],
          evolutionInsights: [
            {
              pattern: 'middleware-validation',
              trend: 'increasingly_sophisticated',
              recommendation: 'Promote to core pattern with rate limiting integration'
            }
          ]
        }),
        tokenUsage: { inputTokens: 250, outputTokens: 200, totalTokens: 450 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await knowledgeUpdaterAgent.synthesizePatterns('auth-domain', relatedTasks);

      expect(result.success).toBe(true);
      expect(result.emergingPatterns).toHaveLength(1);
      expect(result.emergingPatterns?.[0].successRate).toBe(1.0);
      expect(result.evolutionInsights).toHaveLength(1);
    });

    it('should create guide pheromones for validated patterns', async () => {
      const patterns = [
        {
          name: 'validated-auth-flow',
          successRate: 0.95,
          reusabilityScore: 0.9,
          complexity: 'medium'
        }
      ];

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          emergingPatterns: patterns,
          pheromoneRecommendations: [
            {
              type: 'guide_pheromone',
              context: 'validated-auth-flow',
              strength: 0.9,
              ttl: 2592000000, // 30 days
              metadata: {
                pattern: 'validated-auth-flow',
                successRate: 0.95,
                complexity: 'medium'
              }
            }
          ]
        }),
        tokenUsage: { inputTokens: 200, outputTokens: 150, totalTokens: 350 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await knowledgeUpdaterAgent.synthesizePatterns('auth-domain', []);

      expect(result.pheromoneRecommendations).toHaveLength(1);
      expect(result.pheromoneRecommendations?.[0].type).toBe('guide_pheromone');
      expect(result.pheromoneRecommendations?.[0].strength).toBe(0.9);
    });
  });

  describe('batchProcessTasks', () => {
    it('should efficiently process multiple completed tasks', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];

      mockCanvas.getTaskDetails.mockImplementation((id: string) =>
        Promise.resolve({
          id,
          title: `Task ${id}`,
          status: 'completed',
          outcome: { success: true, quality: 'high' }
        })
      );

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          keyInsights: [],
          codePatterns: [],
          pheromoneRecommendations: []
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
        model: 'claude-3-sonnet-20240229'
      });

      mockCanvas.createKnowledgeExtraction.mockResolvedValue('knowledge-extraction-123');
      mockCanvas.linkKnowledgeToTask.mockResolvedValue(undefined);
      mockCanvas.getRelatedKnowledge.mockResolvedValue([]);

      const results = await knowledgeUpdaterAgent.batchProcessTasks(taskIds);

      expect(results).toHaveLength(3);
      expect(results.every((r: any) => r.success)).toBe(true);
      expect(mockCanvas.getTaskDetails).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure in batch processing', async () => {
      const taskIds = ['task-success', 'task-fail'];

      mockCanvas.getTaskDetails.mockImplementation((id: string) => {
        if (id === 'task-fail') {
          return Promise.reject(new Error('Task not found'));
        }
        return Promise.resolve({
          id,
          title: `Task ${id}`,
          status: 'completed',
          outcome: { success: true, quality: 'high' }
        });
      });

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          keyInsights: [],
          codePatterns: [],
          pheromoneRecommendations: []
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
        model: 'claude-3-sonnet-20240229'
      });

      mockCanvas.createKnowledgeExtraction.mockResolvedValue('knowledge-extraction-123');
      mockCanvas.linkKnowledgeToTask.mockResolvedValue(undefined);
      mockCanvas.getRelatedKnowledge.mockResolvedValue([]);

      const results = await knowledgeUpdaterAgent.batchProcessTasks(taskIds);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('Task not found');
    });
  });

  describe('updateProjectMetrics', () => {
    it('should calculate and update project knowledge metrics', async () => {
      const projectMetrics = {
        totalTasks: 50,
        completedTasks: 45,
        successRate: 0.9,
        knowledgeNodes: 150,
        patternsIdentified: 25,
        guidePheromones: 30,
        warnPheromones: 10
      };

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          knowledgeMaturity: {
            score: 0.85,
            level: 'mature',
            strengths: ['Comprehensive auth patterns', 'Good error handling coverage'],
            gaps: ['Testing patterns need improvement', 'Performance optimization patterns missing']
          },
          patternEffectiveness: {
            averageSuccessRate: 0.88,
            topPatterns: ['auth-middleware', 'error-boundary'],
            underperformingPatterns: ['legacy-validation']
          },
          recommendations: [
            'Focus on testing pattern development',
            'Retire legacy validation patterns',
            'Strengthen successful auth patterns'
          ]
        }),
        tokenUsage: { inputTokens: 200, outputTokens: 180, totalTokens: 380 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await knowledgeUpdaterAgent.updateProjectMetrics('test-project', projectMetrics);

      expect(result.success).toBe(true);
      expect(result.knowledgeMaturity?.score).toBe(0.85);
      expect(result.knowledgeMaturity?.level).toBe('mature');
      expect(result.recommendations).toHaveLength(3);
      expect(mockCanvas.updateProjectMetrics).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle task not found', async () => {
      mockCanvas.getTaskDetails.mockResolvedValue(null);

      const result = await knowledgeUpdaterAgent.processCompletedTask('nonexistent-task');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task not found');
    });

    it('should handle Claude API failures', async () => {
      mockCanvas.getTaskDetails.mockResolvedValue({
        id: 'test-task',
        title: 'Test Task',
        status: 'completed',
        outcome: { success: true }
      });
      mockCanvas.getRelatedKnowledge.mockResolvedValue([]);
      mockClaudeClient.sendMessage.mockRejectedValue(new Error('API Error'));

      const result = await knowledgeUpdaterAgent.processCompletedTask('test-task');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to extract knowledge');
    });

    it('should handle malformed knowledge extraction responses', async () => {
      mockCanvas.getTaskDetails.mockResolvedValue({
        id: 'test-task',
        title: 'Test Task',
        status: 'completed',
        outcome: { success: true }
      });
      mockCanvas.getRelatedKnowledge.mockResolvedValue([]);
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: 'invalid json response',
        tokenUsage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await knowledgeUpdaterAgent.processCompletedTask('test-task');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse knowledge extraction');
    });
  });

  describe('integration with Orchestrator', () => {
    it('should provide knowledge recommendations for ongoing tasks', async () => {
      const currentTask = {
        id: 'current-task',
        type: 'authentication',
        status: 'in_progress',
        requirements: ['secure login', 'JWT tokens', 'rate limiting']
      };

      mockCanvas.getRelatedKnowledge.mockResolvedValue([
        {
          id: 'auth-pattern-1',
          type: 'pattern',
          content: 'JWT authentication with refresh tokens',
          confidence: 0.9,
          applicability: ['authentication', 'security']
        }
      ]);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          relevantKnowledge: [
            {
              knowledgeId: 'auth-pattern-1',
              relevanceScore: 0.95,
              application: 'Use this pattern for implementing JWT-based authentication',
              confidence: 0.9
            }
          ],
          recommendations: [
            'Apply JWT refresh token pattern for enhanced security',
            'Implement rate limiting middleware as shown in auth-pattern-1'
          ]
        }),
        tokenUsage: { inputTokens: 150, outputTokens: 120, totalTokens: 270 },
        model: 'claude-3-sonnet-20240229'
      });

      const recommendations = await knowledgeUpdaterAgent.getKnowledgeRecommendations(currentTask);

      expect(recommendations.success).toBe(true);
      expect(recommendations.relevantKnowledge).toHaveLength(1);
      expect(recommendations.relevantKnowledge?.[0].relevanceScore).toBe(0.95);
      expect(recommendations.recommendations).toHaveLength(2);
    });

    it('should update knowledge when tasks complete successfully', async () => {
      const taskCompletionEvent = {
        taskId: 'completed-task',
        status: 'completed' as const,
        outcome: 'success' as const,
        timestamp: '2024-01-01T12:00:00Z'
      };

      mockCanvas.getTaskDetails.mockResolvedValue({
        id: 'completed-task',
        status: 'completed',
        outcome: { success: true, quality: 'high' }
      });

      mockCanvas.getRelatedKnowledge.mockResolvedValue([]);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          keyInsights: [
            {
              type: 'pattern',
              description: 'Successful implementation pattern identified',
              confidence: 0.9
            }
          ],
          pheromoneRecommendations: []
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
        model: 'claude-3-sonnet-20240229'
      });

      mockCanvas.createKnowledgeExtraction.mockResolvedValue('knowledge-extraction-123');

      const result = await knowledgeUpdaterAgent.handleTaskCompletion(taskCompletionEvent);

      expect(result.success).toBe(true);
      expect(result.knowledgeUpdated).toBe(true);
      expect(mockCanvas.createKnowledgeExtraction).toHaveBeenCalled();
    });
  });

  describe('performance and optimization', () => {
    it('should track knowledge extraction performance metrics', async () => {
      mockCanvas.getTaskDetails.mockResolvedValue({
        id: 'perf-test',
        status: 'completed',
        outcome: { success: true }
      });
      mockCanvas.getRelatedKnowledge.mockResolvedValue([]);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          keyInsights: [],
          codePatterns: [],
          pheromoneRecommendations: []
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 75, totalTokens: 175 },
        model: 'claude-3-sonnet-20240229'
      });

      mockCanvas.createKnowledgeExtraction.mockResolvedValue('knowledge-extraction-perf');

      const startTime = Date.now();
      const result = await knowledgeUpdaterAgent.processCompletedTask('perf-test');
      const endTime = Date.now();

      expect(result.performance).toBeDefined();
      expect(result.performance?.extractionTimeMs).toBeLessThanOrEqual(endTime - startTime + 100);
      expect(result.performance?.tokenUsage).toEqual({
        inputTokens: 100,
        outputTokens: 75,
        totalTokens: 175
      });
    });

    it('should complete knowledge extraction within reasonable time limits', async () => {
      mockCanvas.getTaskDetails.mockResolvedValue({
        id: 'time-test',
        status: 'completed',
        outcome: { success: true }
      });
      mockCanvas.getRelatedKnowledge.mockResolvedValue([]);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          keyInsights: [],
          codePatterns: [],
          pheromoneRecommendations: []
        }),
        tokenUsage: { inputTokens: 50, outputTokens: 50, totalTokens: 100 },
        model: 'claude-3-sonnet-20240229'
      });

      const startTime = Date.now();
      await knowledgeUpdaterAgent.processCompletedTask('time-test');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
    });
  });
});