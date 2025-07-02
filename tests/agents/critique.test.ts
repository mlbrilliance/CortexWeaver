import { CritiqueAgent } from '../../src/agents/critique';
import { ClaudeClient, ClaudeModel } from '../../src/claude-client';
import { CognitiveCanvas } from '../../src/cognitive-canvas';
import { MCPClient } from '../../src/mcp-client';

// Mock dependencies
jest.mock('../../src/claude-client');
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/mcp-client');
jest.mock('fs');

describe('CritiqueAgent', () => {
  let critiqueAgent: CritiqueAgent;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockCanvas: jest.Mocked<CognitiveCanvas>;
  let mockMCPClient: jest.Mocked<MCPClient>;

  beforeEach(() => {
    // Create mock dependencies
    mockClaudeClient = {
      sendMessage: jest.fn()
    } as any;

    mockCanvas = {
      getArtifactsByProject: jest.fn(),
      createCritiqueNode: jest.fn(),
      linkCritiqueToArtifact: jest.fn(),
      getArtifactDetails: jest.fn(),
      getPheromonesByType: jest.fn()
    } as any;

    mockMCPClient = {
      scanWorktreeForChanges: jest.fn(),
      getFileContent: jest.fn(),
      listProjectArtifacts: jest.fn()
    } as any;

    critiqueAgent = new CritiqueAgent(mockClaudeClient, mockCanvas, mockMCPClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct role and capabilities', () => {
      expect(critiqueAgent.role).toBe('Critique');
      expect(critiqueAgent.capabilities).toContain('continuous-scanning');
      expect(critiqueAgent.capabilities).toContain('artifact-analysis');
      expect(critiqueAgent.capabilities).toContain('structured-feedback');
      expect(critiqueAgent.capabilities).toContain('quality-assessment');
    });

    it('should start in idle state', () => {
      expect(critiqueAgent.isRunning).toBe(false);
      expect(critiqueAgent.currentScanId).toBeNull();
    });
  });

  describe('startContinuousScanning', () => {
    it('should begin scanning for new artifacts', async () => {
      mockMCPClient.scanWorktreeForChanges.mockResolvedValue([
        { path: '/contracts/user-auth.json', type: 'contract', lastModified: '2024-01-01T10:00:00Z' },
        { path: '/prototypes/auth-prototype.md', type: 'prototype', lastModified: '2024-01-01T10:05:00Z' }
      ]);

      const scanId = await critiqueAgent.startContinuousScanning('test-project');

      expect(critiqueAgent.isRunning).toBe(true);
      expect(scanId).toBeDefined();
      expect(critiqueAgent.currentScanId).toBe(scanId);
      expect(mockMCPClient.scanWorktreeForChanges).toHaveBeenCalled();
    });

    it('should handle scanning errors gracefully', async () => {
      mockMCPClient.scanWorktreeForChanges.mockRejectedValue(new Error('Scan failed'));

      const result = await critiqueAgent.startContinuousScanning('test-project');

      expect(result).toBeNull();
      expect(critiqueAgent.isRunning).toBe(false);
    });

    it('should prevent multiple concurrent scans', async () => {
      mockMCPClient.scanWorktreeForChanges.mockResolvedValue([]);
      
      await critiqueAgent.startContinuousScanning('test-project');
      const secondScanId = await critiqueAgent.startContinuousScanning('test-project');

      expect(secondScanId).toBeNull();
      expect(mockMCPClient.scanWorktreeForChanges).toHaveBeenCalledTimes(1);
    });
  });

  describe('analyzeArtifact', () => {
    const mockContract = {
      id: 'contract-123',
      name: 'UserAuthentication',
      type: 'contract' as const,
      filePath: '/contracts/user-auth.json',
      content: JSON.stringify({
        paths: {
          '/api/auth/login': {
            post: {
              parameters: [
                { name: 'email', type: 'string' },
                { name: 'password', type: 'string' }
              ],
              responses: {
                '200': { description: 'Success' },
                '401': { description: 'Unauthorized' }
              }
            }
          }
        }
      }),
      projectId: 'test-project',
      createdAt: '2024-01-01T00:00:00Z'
    };

    beforeEach(() => {
      mockCanvas.getArtifactDetails.mockResolvedValue(mockContract);
      mockCanvas.getPheromonesByType.mockResolvedValue([
        {
          id: 'pheromone-1',
          type: 'warn_pheromone',
          strength: 0.8,
          context: 'missing-error-handling',
          metadata: { pattern: 'incomplete-error-responses' },
          createdAt: '2024-01-01T00:00:00Z',
          expiresAt: '2024-12-31T23:59:59Z'
        }
      ]);
    });

    it('should analyze contract artifacts for completeness', async () => {
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          issues: [
            {
              severity: 'medium',
              type: 'missing-validation',
              location: '/api/auth/login.post.parameters',
              description: 'Email parameter lacks format validation',
              suggestion: 'Add email format validation pattern'
            }
          ],
          overallQuality: 'fair',
          recommendations: ['Add input validation', 'Include error schemas']
        }),
        tokenUsage: { inputTokens: 150, outputTokens: 200, totalTokens: 350 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await critiqueAgent.analyzeArtifact('contract-123');

      expect(result.success).toBe(true);
      expect(result.critique?.issues).toHaveLength(1);
      expect(result.critique?.issues[0].type).toBe('missing-validation');
      expect(result.critique?.overallQuality).toBe('fair');
      expect(mockCanvas.getArtifactDetails).toHaveBeenCalledWith('contract-123');
    });

    it('should analyze prototype artifacts for logic completeness', async () => {
      const mockPrototype = {
        id: 'prototype-456',
        name: 'AuthPrototype',
        type: 'prototype' as const,
        filePath: '/prototypes/auth-prototype.md',
        content: `
# Authentication Prototype

## Pseudocode
1. Receive email and password
2. Query user from database
3. Return success response
        `,
        projectId: 'test-project',
        createdAt: '2024-01-01T00:00:00Z'
      };

      mockCanvas.getArtifactDetails.mockResolvedValue(mockPrototype);
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          issues: [
            {
              severity: 'high',
              type: 'missing-logic',
              location: 'pseudocode.step3',
              description: 'Missing password verification step',
              suggestion: 'Add password hash verification before returning success'
            }
          ],
          overallQuality: 'poor',
          recommendations: ['Add password verification', 'Include error handling']
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await critiqueAgent.analyzeArtifact('prototype-456');

      expect(result.success).toBe(true);
      expect(result.critique?.issues[0].severity).toBe('high');
      expect(result.critique?.issues[0].type).toBe('missing-logic');
    });

    it('should incorporate warning pheromones in analysis', async () => {
      mockClaudeClient.sendMessage.mockImplementation((prompt: any) => {
        expect(prompt).toContain('missing-error-handling');
        expect(prompt).toContain('warn_pheromone');
        return Promise.resolve({
          content: JSON.stringify({ issues: [], overallQuality: 'good', recommendations: [] }),
          tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          model: 'claude-3-sonnet-20240229'
        });
      });

      await critiqueAgent.analyzeArtifact('contract-123');

      expect(mockCanvas.getPheromonesByType).toHaveBeenCalledWith('warn_pheromone');
      expect(mockClaudeClient.sendMessage).toHaveBeenCalled();
    });

    it('should create critique node in Cognitive Canvas', async () => {
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({ issues: [], overallQuality: 'good', recommendations: [] }),
        tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        model: 'claude-3-sonnet-20240229'
      });
      mockCanvas.createCritiqueNode.mockResolvedValue('critique-node-789');

      const result = await critiqueAgent.analyzeArtifact('contract-123');

      expect(mockCanvas.createCritiqueNode).toHaveBeenCalledWith({
        artifactId: 'contract-123',
        critique: expect.any(Object),
        severity: expect.any(String),
        tokenUsage: expect.any(Object)
      });
      expect(result.critiqueNodeId).toBe('critique-node-789');
    });

    it('should link critique to analyzed artifact', async () => {
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({ issues: [], overallQuality: 'good', recommendations: [] }),
        tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        model: 'claude-3-sonnet-20240229'
      });
      mockCanvas.createCritiqueNode.mockResolvedValue('critique-node-789');

      await critiqueAgent.analyzeArtifact('contract-123');

      expect(mockCanvas.linkCritiqueToArtifact).toHaveBeenCalledWith('critique-node-789', 'contract-123');
    });
  });

  describe('generateStructuredFeedback', () => {
    it('should format critique for Orchestrator consumption', async () => {
      const critique = {
        issues: [
          {
            severity: 'high',
            type: 'missing-logic',
            location: 'function.authenticate',
            description: 'Missing input validation',
            suggestion: 'Add parameter validation'
          }
        ],
        overallQuality: 'poor',
        recommendations: ['Add validation', 'Improve error handling']
      };

      const feedback = await critiqueAgent.generateStructuredFeedback(
        'artifact-123',
        critique,
        'high'
      );

      expect(feedback.artifactId).toBe('artifact-123');
      expect(feedback.overallSeverity).toBe('high');
      expect(feedback.issues).toHaveLength(1);
      expect(feedback.actionRequired).toBe(true);
      expect(feedback.pauseDownstream).toBe(true); // High severity should pause
      expect(feedback.recommendations).toContain('Add validation');
    });

    it('should determine when to pause downstream tasks', async () => {
      const lowSeverityCritique = {
        issues: [{ severity: 'low', type: 'style', location: 'comment', description: 'Minor style issue' }],
        overallQuality: 'good',
        recommendations: []
      };

      const highSeverityCritique = {
        issues: [{ severity: 'high', type: 'logic-error', location: 'core', description: 'Critical logic flaw' }],
        overallQuality: 'poor',
        recommendations: []
      };

      const lowFeedback = await critiqueAgent.generateStructuredFeedback('art-1', lowSeverityCritique, 'low');
      const highFeedback = await critiqueAgent.generateStructuredFeedback('art-2', highSeverityCritique, 'high');

      expect(lowFeedback.pauseDownstream).toBe(false);
      expect(highFeedback.pauseDownstream).toBe(true);
    });

    it('should include resolution steps for issues', async () => {
      const critique = {
        issues: [
          {
            severity: 'medium',
            type: 'incomplete-spec',
            location: 'api.endpoint',
            description: 'Missing response schema',
            suggestion: 'Add detailed response schema with examples'
          }
        ],
        overallQuality: 'fair',
        recommendations: ['Complete specification']
      };

      const feedback = await critiqueAgent.generateStructuredFeedback('spec-456', critique, 'medium');

      expect(feedback.resolutionSteps).toBeDefined();
      expect(feedback.resolutionSteps).toContain('Add detailed response schema with examples');
    });
  });

  describe('stopScanning', () => {
    it('should stop continuous scanning', async () => {
      mockMCPClient.scanWorktreeForChanges.mockResolvedValue([]);
      await critiqueAgent.startContinuousScanning('test-project');

      const stopped = await critiqueAgent.stopScanning();

      expect(stopped).toBe(true);
      expect(critiqueAgent.isRunning).toBe(false);
      expect(critiqueAgent.currentScanId).toBeNull();
    });

    it('should handle stopping when not running', async () => {
      const stopped = await critiqueAgent.stopScanning();

      expect(stopped).toBe(true);
      expect(critiqueAgent.isRunning).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle artifact not found', async () => {
      mockCanvas.getArtifactDetails.mockResolvedValue(null);

      const result = await critiqueAgent.analyzeArtifact('nonexistent-artifact');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Artifact not found');
    });

    it('should handle Claude API failures', async () => {
      mockCanvas.getArtifactDetails.mockResolvedValue({
        id: 'test-artifact',
        name: 'TestArtifact',
        type: 'contract' as const,
        filePath: '/test-artifact.json',
        content: 'test content',
        projectId: 'test-project',
        createdAt: '2024-01-01T00:00:00Z'
      });
      mockClaudeClient.sendMessage.mockRejectedValue(new Error('API Error'));

      const result = await critiqueAgent.analyzeArtifact('test-artifact');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to analyze artifact');
    });

    it('should handle malformed critique responses', async () => {
      mockCanvas.getArtifactDetails.mockResolvedValue({
        id: 'test-artifact',
        name: 'TestArtifact',
        type: 'contract' as const,
        filePath: '/test-artifact.json',
        content: 'test content',
        projectId: 'test-project',
        createdAt: '2024-01-01T00:00:00Z'
      });
      mockCanvas.getPheromonesByType.mockResolvedValue([]);
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: 'invalid json response',
        tokenUsage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await critiqueAgent.analyzeArtifact('test-artifact');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse critique response');
    });
  });

  describe('integration with Orchestrator', () => {
    it('should provide callback mechanism for real-time feedback', async () => {
      const feedbackCallback = jest.fn();
      
      mockMCPClient.scanWorktreeForChanges.mockResolvedValue([
        { path: '/contracts/new-contract.json', type: 'contract', lastModified: '2024-01-01T12:00:00Z' }
      ]);
      
      mockCanvas.getArtifactDetails.mockResolvedValue({
        id: 'new-contract',
        name: 'NewContract',
        type: 'contract' as const,
        filePath: '/contracts/new-contract.json',
        content: 'test contract content',
        projectId: 'test-project',
        createdAt: '2024-01-01T00:00:00Z'
      });
      
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({
          issues: [{ severity: 'high', type: 'critical-flaw', description: 'Major issue found' }],
          overallQuality: 'poor',
          recommendations: ['Fix critical flaw']
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 100, totalTokens: 200 },
        model: 'claude-3-sonnet-20240229'
      });

      mockCanvas.createCritiqueNode.mockResolvedValue('critique-node-789');
      mockCanvas.linkCritiqueToArtifact.mockResolvedValue(undefined);
      mockCanvas.getPheromonesByType.mockResolvedValue([]);

      await critiqueAgent.startContinuousScanning('test-project', feedbackCallback);

      // Simulate finding and analyzing new artifact
      await critiqueAgent.analyzeArtifact('new-contract');

      expect(feedbackCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          artifactId: 'new-contract',
          overallSeverity: 'high',
          pauseDownstream: true,
          actionRequired: true
        })
      );
    });

    it('should prioritize high-severity issues for immediate feedback', async () => {
      const urgentCallback = jest.fn();
      
      const highSeverityIssues = {
        issues: [
          { severity: 'high', type: 'security-flaw', description: 'Security vulnerability' },
          { severity: 'low', type: 'style-issue', description: 'Minor formatting' }
        ],
        overallQuality: 'poor',
        recommendations: ['Fix security issue immediately']
      };

      const feedback = await critiqueAgent.generateStructuredFeedback(
        'critical-artifact',
        highSeverityIssues,
        'high'
      );

      expect(feedback.priority).toBe('urgent');
      expect(feedback.pauseDownstream).toBe(true);
      expect(feedback.immediateAction).toBe(true);
    });
  });

  describe('performance and optimization', () => {
    it('should batch analyze multiple artifacts efficiently', async () => {
      const artifactIds = ['art-1', 'art-2', 'art-3'];
      
      mockCanvas.getArtifactDetails.mockImplementation((id: string) => 
        Promise.resolve({
          id,
          name: `Artifact${id}`,
          type: 'contract' as const,
          filePath: `/artifacts/${id}.json`,
          content: `content for ${id}`,
          projectId: 'test-project',
          createdAt: '2024-01-01T00:00:00Z'
        })
      );
      
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({ issues: [], overallQuality: 'good', recommendations: [] }),
        tokenUsage: { inputTokens: 50, outputTokens: 50, totalTokens: 100 },
        model: 'claude-3-sonnet-20240229'
      });

      mockCanvas.createCritiqueNode.mockResolvedValue('critique-node-123');
      mockCanvas.linkCritiqueToArtifact.mockResolvedValue(undefined);
      mockCanvas.getPheromonesByType.mockResolvedValue([]);

      const results = await critiqueAgent.batchAnalyzeArtifacts(artifactIds);

      expect(results).toHaveLength(3);
      expect(results.every((r: any) => r.success)).toBe(true);
      expect(mockCanvas.getArtifactDetails).toHaveBeenCalledTimes(3);
    });

    it('should track analysis performance metrics', async () => {
      mockCanvas.getArtifactDetails.mockResolvedValue({
        id: 'perf-test',
        name: 'PerfTest',
        type: 'test' as const,
        filePath: '/tests/perf-test.ts',
        content: 'performance test content',
        projectId: 'test-project',
        createdAt: '2024-01-01T00:00:00Z'
      });
      
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({ issues: [], overallQuality: 'good', recommendations: [] }),
        tokenUsage: { inputTokens: 100, outputTokens: 75, totalTokens: 175 },
        model: 'claude-3-sonnet-20240229'
      });

      mockCanvas.createCritiqueNode.mockResolvedValue('critique-node-perf');
      mockCanvas.linkCritiqueToArtifact.mockResolvedValue(undefined);
      mockCanvas.getPheromonesByType.mockResolvedValue([]);

      const startTime = Date.now();
      const result = await critiqueAgent.analyzeArtifact('perf-test');
      const endTime = Date.now();

      expect(result.performance).toBeDefined();
      expect(result.performance?.analysisTimeMs).toBeLessThanOrEqual(endTime - startTime + 100);
      expect(result.performance?.tokenUsage).toEqual({
        inputTokens: 100,
        outputTokens: 75,
        totalTokens: 175
      });
    });

    it('should complete analysis within reasonable time limits', async () => {
      mockCanvas.getArtifactDetails.mockResolvedValue({
        id: 'time-test',
        name: 'TimeTest',
        type: 'test' as const,
        filePath: '/tests/time-test.ts',
        content: 'timing test content',
        projectId: 'test-project',
        createdAt: '2024-01-01T00:00:00Z'
      });
      
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: JSON.stringify({ issues: [], overallQuality: 'good', recommendations: [] }),
        tokenUsage: { inputTokens: 50, outputTokens: 50, totalTokens: 100 },
        model: 'claude-3-sonnet-20240229'
      });

      const startTime = Date.now();
      await critiqueAgent.analyzeArtifact('time-test');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
    });
  });
});