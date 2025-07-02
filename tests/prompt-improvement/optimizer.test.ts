import { PromptOptimizer } from '../../src/prompt-improvement/optimizer';
import { PromptWorkflowManager } from '../../src/prompt-improvement/workflow';
import { CognitiveCanvas } from '../../src/cognitive-canvas';
import {
  PromptVersion,
  ImprovementProposal,
  SubmissionResult,
  ApprovalResult,
  ApplicationResult,
  RollbackResult,
  ValidationResult,
  AuditTrailEntry,
  ChangeNotification,
  PromptVersionStatus,
  ApprovalStatus,
  ImprovementPriority
} from '../../src/prompt-improvement/types';

// Mock dependencies
jest.mock('../../src/prompt-improvement/workflow');
jest.mock('../../src/cognitive-canvas');

describe('PromptOptimizer', () => {
  let promptOptimizer: PromptOptimizer;
  let mockCognitiveCanvas: jest.Mocked<CognitiveCanvas>;
  let mockWorkflowManager: jest.Mocked<PromptWorkflowManager>;

  const workspaceRoot = '/test/workspace';
  const promptsDir = '/test/workspace/prompts';
  const historyDir = '/test/workspace/history';
  const backupDir = '/test/workspace/backups';

  const mockProposal: ImprovementProposal = {
    id: 'proposal-123',
    promptFile: 'architect-prompt.txt',
    originalContent: 'You are an architect agent.',
    improvedContent: 'You are a specialized architecture design agent with expertise in system design patterns.',
    diff: '--- architect-prompt.txt\n+++ architect-prompt.txt\n@@ -1,1 +1,1 @@\n-You are an architect agent.\n+You are a specialized architecture design agent with expertise in system design patterns.',
    rationale: 'Added specialization and expertise context for better performance',
    priority: 'high',
    submittedBy: 'reflector-agent-001',
    submittedAt: '2024-01-01T10:00:00Z',
    status: 'pending'
  };

  const mockVersion: PromptVersion = {
    id: 'version-456',
    promptFile: 'architect-prompt.txt',
    originalContent: 'You are an architect agent.',
    improvedContent: 'You are a specialized architecture design agent.',
    diff: '--- architect-prompt.txt\n+++ architect-prompt.txt\n@@ -1,1 +1,1 @@\n-You are an architect agent.\n+You are a specialized architecture design agent.',
    rationale: 'Improved specialization',
    timestamp: '2024-01-01T10:00:00Z',
    status: 'approved',
    approvedBy: 'human-reviewer',
    approvedAt: '2024-01-01T11:00:00Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock CognitiveCanvas
    mockCognitiveCanvas = {
      createPheromone: jest.fn().mockResolvedValue('pheromone-123'),
      updateTaskStatus: jest.fn().mockResolvedValue(undefined),
      initializeSchema: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock PromptWorkflowManager
    mockWorkflowManager = {
      submitProposal: jest.fn().mockResolvedValue({
        submitted: true,
        proposalId: 'proposal-123',
        pheromoneId: 'pheromone-123'
      }),
      processApproval: jest.fn().mockResolvedValue({
        approved: true,
        proposalId: 'proposal-123',
        reviewedBy: 'human-reviewer',
        timestamp: '2024-01-01T11:00:00Z'
      }),
      applyImprovement: jest.fn().mockResolvedValue({
        success: true,
        versionId: 'version-456',
        backupPath: '/test/workspace/backups/architect-prompt.txt.bak'
      }),
      rollbackToVersion: jest.fn().mockResolvedValue({
        success: true,
        rolledBackTo: 'version-123',
        newVersionId: 'version-789'
      }),
      validateProposal: jest.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      }),
      createAuditEntry: jest.fn().mockResolvedValue(undefined),
      getVersionHistory: jest.fn().mockResolvedValue([mockVersion]),
      getPendingProposals: jest.fn().mockResolvedValue([mockProposal]),
      listPromptFiles: jest.fn().mockResolvedValue(['architect-prompt.txt', 'coder-prompt.txt']),
      getOptimizationMetrics: jest.fn().mockResolvedValue({
        totalProposals: 15,
        approvedProposals: 12,
        appliedVersions: 10,
        rollbacks: 1,
        averageImpactScore: 0.78
      })
    } as any;

    // Mock the constructor to use our mock
    (PromptWorkflowManager as jest.MockedClass<typeof PromptWorkflowManager>).mockImplementation(() => mockWorkflowManager);

    promptOptimizer = new PromptOptimizer(
      mockCognitiveCanvas,
      workspaceRoot,
      promptsDir,
      historyDir,
      backupDir
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default directories', () => {
      const optimizer = new PromptOptimizer(mockCognitiveCanvas, workspaceRoot);
      
      expect(PromptWorkflowManager).toHaveBeenCalledWith(
        mockCognitiveCanvas,
        workspaceRoot,
        undefined, // promptsDir
        undefined, // historyDir
        undefined  // backupDir
      );
    });

    it('should initialize with custom directories', () => {
      const optimizer = new PromptOptimizer(
        mockCognitiveCanvas,
        workspaceRoot,
        promptsDir,
        historyDir,
        backupDir
      );

      expect(PromptWorkflowManager).toHaveBeenCalledWith(
        mockCognitiveCanvas,
        workspaceRoot,
        promptsDir,
        historyDir,
        backupDir
      );
    });

    it('should delegate to workflow manager correctly', () => {
      expect(PromptWorkflowManager).toHaveBeenCalledTimes(1);
      expect(PromptWorkflowManager).toHaveBeenCalledWith(
        mockCognitiveCanvas,
        workspaceRoot,
        promptsDir,
        historyDir,
        backupDir
      );
    });
  });

  describe('proposal submission', () => {
    it('should submit improvement proposal successfully', async () => {
      const result = await promptOptimizer.submitProposal(mockProposal);

      expect(result.submitted).toBe(true);
      expect(result.proposalId).toBe('proposal-123');
      expect(result.pheromoneId).toBe('pheromone-123');
      expect(mockWorkflowManager.submitProposal).toHaveBeenCalledWith(mockProposal);
    });

    it('should handle proposal submission failure', async () => {
      mockWorkflowManager.submitProposal.mockResolvedValue({
        submitted: false,
        proposalId: '',
        error: 'Validation failed: Empty content'
      });

      const result = await promptOptimizer.submitProposal(mockProposal);

      expect(result.submitted).toBe(false);
      expect(result.error).toBe('Validation failed: Empty content');
    });

    it('should validate proposal before submission', async () => {
      mockWorkflowManager.validateProposal.mockResolvedValue({
        isValid: false,
        errors: ['Invalid diff format'],
        warnings: []
      });

      const invalidProposal = { ...mockProposal, diff: 'invalid-diff' };
      
      await promptOptimizer.submitProposal(invalidProposal);

      expect(mockWorkflowManager.validateProposal).toHaveBeenCalledWith(invalidProposal);
    });

    it('should create audit trail for submission', async () => {
      await promptOptimizer.submitProposal(mockProposal);

      expect(mockWorkflowManager.createAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'proposed',
          promptFile: 'architect-prompt.txt',
          performedBy: 'reflector-agent-001'
        })
      );
    });
  });

  describe('approval processing', () => {
    it('should process approval successfully', async () => {
      const result = await promptOptimizer.processApproval(
        'proposal-123',
        'approved',
        'human-reviewer',
        'Looks good, approved for implementation'
      );

      expect(result.approved).toBe(true);
      expect(result.proposalId).toBe('proposal-123');
      expect(result.reviewedBy).toBe('human-reviewer');
      expect(mockWorkflowManager.processApproval).toHaveBeenCalledWith(
        'proposal-123',
        'approved',
        'human-reviewer',
        'Looks good, approved for implementation'
      );
    });

    it('should handle rejection', async () => {
      mockWorkflowManager.processApproval.mockResolvedValue({
        approved: false,
        proposalId: 'proposal-123',
        reviewedBy: 'human-reviewer',
        comments: 'Needs more specific improvements',
        timestamp: '2024-01-01T11:00:00Z'
      });

      const result = await promptOptimizer.processApproval(
        'proposal-123',
        'rejected',
        'human-reviewer',
        'Needs more specific improvements'
      );

      expect(result.approved).toBe(false);
      expect(result.comments).toBe('Needs more specific improvements');
    });

    it('should handle non-existent proposal', async () => {
      mockWorkflowManager.processApproval.mockRejectedValue(new Error('Proposal not found'));

      await expect(promptOptimizer.processApproval(
        'non-existent',
        'approved',
        'reviewer'
      )).rejects.toThrow('Proposal not found');
    });
  });

  describe('improvement application', () => {
    it('should apply improvement successfully', async () => {
      const result = await promptOptimizer.applyImprovement('version-456');

      expect(result.success).toBe(true);
      expect(result.versionId).toBe('version-456');
      expect(result.backupPath).toBeDefined();
      expect(mockWorkflowManager.applyImprovement).toHaveBeenCalledWith('version-456');
    });

    it('should handle application failure', async () => {
      mockWorkflowManager.applyImprovement.mockResolvedValue({
        success: false,
        versionId: 'version-456',
        error: 'File system error: Permission denied'
      });

      const result = await promptOptimizer.applyImprovement('version-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('File system error: Permission denied');
    });

    it('should create backup before application', async () => {
      await promptOptimizer.applyImprovement('version-456');

      expect(mockWorkflowManager.applyImprovement).toHaveBeenCalledWith('version-456');
      // Backup creation is handled internally by workflow manager
    });

    it('should create audit trail for application', async () => {
      await promptOptimizer.applyImprovement('version-456');

      expect(mockWorkflowManager.createAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'applied',
          details: expect.objectContaining({
            versionId: 'version-456'
          })
        })
      );
    });
  });

  describe('version rollback', () => {
    it('should rollback to previous version successfully', async () => {
      const result = await promptOptimizer.rollbackToVersion('architect-prompt.txt', 'version-123');

      expect(result.success).toBe(true);
      expect(result.rolledBackTo).toBe('version-123');
      expect(result.newVersionId).toBe('version-789');
      expect(mockWorkflowManager.rollbackToVersion).toHaveBeenCalledWith('architect-prompt.txt', 'version-123');
    });

    it('should handle rollback failure', async () => {
      mockWorkflowManager.rollbackToVersion.mockResolvedValue({
        success: false,
        rolledBackTo: 'version-123',
        error: 'Version not found'
      });

      const result = await promptOptimizer.rollbackToVersion('architect-prompt.txt', 'version-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Version not found');
    });

    it('should validate rollback target version', async () => {
      await promptOptimizer.rollbackToVersion('architect-prompt.txt', 'version-123');

      expect(mockWorkflowManager.rollbackToVersion).toHaveBeenCalledWith('architect-prompt.txt', 'version-123');
    });

    it('should create audit trail for rollback', async () => {
      await promptOptimizer.rollbackToVersion('architect-prompt.txt', 'version-123');

      expect(mockWorkflowManager.createAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'rolled_back',
          promptFile: 'architect-prompt.txt',
          details: expect.objectContaining({
            rolledBackTo: 'version-123'
          })
        })
      );
    });
  });

  describe('version management', () => {
    it('should get version history for prompt file', async () => {
      const history = await promptOptimizer.getVersionHistory('architect-prompt.txt');

      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(mockVersion);
      expect(mockWorkflowManager.getVersionHistory).toHaveBeenCalledWith('architect-prompt.txt');
    });

    it('should get pending proposals', async () => {
      const proposals = await promptOptimizer.getPendingProposals();

      expect(proposals).toHaveLength(1);
      expect(proposals[0]).toEqual(mockProposal);
      expect(mockWorkflowManager.getPendingProposals).toHaveBeenCalled();
    });

    it('should list available prompt files', async () => {
      const files = await promptOptimizer.listPromptFiles();

      expect(files).toEqual(['architect-prompt.txt', 'coder-prompt.txt']);
      expect(mockWorkflowManager.listPromptFiles).toHaveBeenCalled();
    });

    it('should handle empty version history', async () => {
      mockWorkflowManager.getVersionHistory.mockResolvedValue([]);

      const history = await promptOptimizer.getVersionHistory('non-existent.txt');

      expect(history).toHaveLength(0);
    });

    it('should handle no pending proposals', async () => {
      mockWorkflowManager.getPendingProposals.mockResolvedValue([]);

      const proposals = await promptOptimizer.getPendingProposals();

      expect(proposals).toHaveLength(0);
    });
  });

  describe('optimization metrics', () => {
    it('should get optimization metrics', async () => {
      const metrics = await promptOptimizer.getOptimizationMetrics();

      expect(metrics.totalProposals).toBe(15);
      expect(metrics.approvedProposals).toBe(12);
      expect(metrics.appliedVersions).toBe(10);
      expect(metrics.rollbacks).toBe(1);
      expect(metrics.averageImpactScore).toBe(0.78);
      expect(mockWorkflowManager.getOptimizationMetrics).toHaveBeenCalled();
    });

    it('should calculate approval rate', async () => {
      const metrics = await promptOptimizer.getOptimizationMetrics();
      const approvalRate = metrics.approvedProposals / metrics.totalProposals;

      expect(approvalRate).toBe(0.8); // 12/15 = 0.8
    });

    it('should calculate application rate', async () => {
      const metrics = await promptOptimizer.getOptimizationMetrics();
      const applicationRate = metrics.appliedVersions / metrics.approvedProposals;

      expect(applicationRate).toBeCloseTo(0.833, 2); // 10/12 ≈ 0.833
    });
  });

  describe('validation', () => {
    it('should validate proposal format', async () => {
      const result = await promptOptimizer.validateProposal(mockProposal);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(mockWorkflowManager.validateProposal).toHaveBeenCalledWith(mockProposal);
    });

    it('should detect validation errors', async () => {
      mockWorkflowManager.validateProposal.mockResolvedValue({
        isValid: false,
        errors: ['Missing rationale', 'Invalid diff format'],
        warnings: ['Large content change']
      });

      const invalidProposal = { ...mockProposal, rationale: '' };
      const result = await promptOptimizer.validateProposal(invalidProposal);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing rationale');
      expect(result.errors).toContain('Invalid diff format');
      expect(result.warnings).toContain('Large content change');
    });

    it('should validate content changes', async () => {
      const proposal = {
        ...mockProposal,
        originalContent: mockProposal.improvedContent // Same content
      };

      mockWorkflowManager.validateProposal.mockResolvedValue({
        isValid: false,
        errors: ['No meaningful changes detected'],
        warnings: []
      });

      const result = await promptOptimizer.validateProposal(proposal);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No meaningful changes detected');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle workflow manager errors gracefully', async () => {
      mockWorkflowManager.submitProposal.mockRejectedValue(new Error('Internal error'));

      await expect(promptOptimizer.submitProposal(mockProposal))
        .rejects.toThrow('Internal error');
    });

    it('should handle null and undefined inputs', async () => {
      await expect(promptOptimizer.submitProposal(null as any))
        .rejects.toThrow();

      await expect(promptOptimizer.processApproval(null as any, 'approved', 'reviewer'))
        .rejects.toThrow();
    });

    it('should handle empty string inputs', async () => {
      await expect(promptOptimizer.applyImprovement(''))
        .rejects.toThrow();

      await expect(promptOptimizer.rollbackToVersion('', ''))
        .rejects.toThrow();
    });

    it('should handle concurrent operations', async () => {
      const proposals = [
        { ...mockProposal, id: 'proposal-1' },
        { ...mockProposal, id: 'proposal-2' },
        { ...mockProposal, id: 'proposal-3' }
      ];

      const promises = proposals.map(proposal => 
        promptOptimizer.submitProposal(proposal)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.submitted)).toBe(true);
      expect(mockWorkflowManager.submitProposal).toHaveBeenCalledTimes(3);
    });

    it('should handle malformed proposal data', async () => {
      const malformedProposal = {
        ...mockProposal,
        diff: 'invalid-diff-format',
        rationale: '',
        improvedContent: mockProposal.originalContent // No change
      };

      mockWorkflowManager.validateProposal.mockResolvedValue({
        isValid: false,
        errors: ['Invalid diff format', 'No content changes'],
        warnings: []
      });

      const result = await promptOptimizer.validateProposal(malformedProposal);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('integration with cognitive canvas', () => {
    it('should use cognitive canvas for pheromone creation', async () => {
      await promptOptimizer.submitProposal(mockProposal);

      expect(mockWorkflowManager.submitProposal).toHaveBeenCalledWith(mockProposal);
      // Pheromone creation is handled by workflow manager
    });

    it('should handle cognitive canvas connection failures', async () => {
      mockWorkflowManager.submitProposal.mockRejectedValue(new Error('Canvas connection failed'));

      await expect(promptOptimizer.submitProposal(mockProposal))
        .rejects.toThrow('Canvas connection failed');
    });
  });

  describe('performance and optimization', () => {
    it('should complete operations within reasonable time limits', async () => {
      const startTime = Date.now();
      
      await promptOptimizer.submitProposal(mockProposal);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should efficiently handle multiple concurrent proposals', async () => {
      const proposals = Array.from({ length: 10 }, (_, i) => ({
        ...mockProposal,
        id: `proposal-${i}`,
        promptFile: `prompt-${i}.txt`
      }));

      const startTime = Date.now();
      const promises = proposals.map(proposal => promptOptimizer.submitProposal(proposal));
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should handle concurrency efficiently
      expect(mockWorkflowManager.submitProposal).toHaveBeenCalledTimes(10);
    });

    it('should delegate efficiently to workflow manager', async () => {
      // All operations should be simple delegations with minimal overhead
      
      await promptOptimizer.submitProposal(mockProposal);
      await promptOptimizer.processApproval('proposal-123', 'approved', 'reviewer');
      await promptOptimizer.applyImprovement('version-456');
      await promptOptimizer.getVersionHistory('test.txt');

      expect(mockWorkflowManager.submitProposal).toHaveBeenCalledTimes(1);
      expect(mockWorkflowManager.processApproval).toHaveBeenCalledTimes(1);
      expect(mockWorkflowManager.applyImprovement).toHaveBeenCalledTimes(1);
      expect(mockWorkflowManager.getVersionHistory).toHaveBeenCalledTimes(1);
    });
  });
});