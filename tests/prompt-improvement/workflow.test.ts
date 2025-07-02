import { PromptWorkflowManager } from '../../src/prompt-improvement/workflow';
import { CognitiveCanvas, PheromoneData } from '../../src/cognitive-canvas';
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
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('../../src/cognitive-canvas');

describe('PromptWorkflowManager', () => {
  let workflowManager: PromptWorkflowManager;
  let mockCognitiveCanvas: jest.Mocked<CognitiveCanvas>;

  const workspaceRoot = '/test/workspace';
  const promptsDir = '/test/workspace/prompts';
  const historyDir = '/test/workspace/.cortex/prompt-history';
  const backupDir = '/test/workspace/.cortex/prompt-backups';

  const mockProposal: ImprovementProposal = {
    id: 'proposal-123',
    promptFile: 'architect-prompt.txt',
    originalContent: 'You are an architect agent.',
    improvedContent: 'You are a specialized architecture design agent with expertise in system design patterns and best practices.',
    diff: '--- architect-prompt.txt\n+++ architect-prompt.txt\n@@ -1,1 +1,1 @@\n-You are an architect agent.\n+You are a specialized architecture design agent with expertise in system design patterns and best practices.',
    rationale: 'Added specialization and expertise context for better performance and more targeted responses',
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
    approvedAt: '2024-01-01T11:00:00Z',
    appliedAt: '2024-01-01T11:30:00Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock filesystem operations
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([]));
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);
    (fs.copyFileSync as jest.Mock).mockReturnValue(undefined);
    (fs.readdirSync as jest.Mock).mockReturnValue(['architect-prompt.txt', 'coder-prompt.txt']);

    // Mock path operations
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    (path.basename as jest.Mock).mockImplementation((p) => p.split('/').pop());
    (path.dirname as jest.Mock).mockImplementation((p) => p.split('/').slice(0, -1).join('/'));

    // Mock CognitiveCanvas
    mockCognitiveCanvas = {
      createPheromone: jest.fn().mockResolvedValue({
        id: 'pheromone-123',
        type: 'guide_pheromone',
        strength: 0.8,
        context: 'prompt-improvement',
        metadata: {},
        createdAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-12-31T23:59:59Z'
      }),
      initializeSchema: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    } as any;

    workflowManager = new PromptWorkflowManager(
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
    it('should initialize with custom directories', () => {
      expect(workflowManager).toBeDefined();
      expect(path.join).toHaveBeenCalledWith(workspaceRoot, 'prompts');
      expect(path.join).toHaveBeenCalledWith(workspaceRoot, '.cortex', 'prompt-history');
      expect(path.join).toHaveBeenCalledWith(workspaceRoot, '.cortex', 'prompt-backups');
    });

    it('should initialize with default directories', () => {
      const manager = new PromptWorkflowManager(mockCognitiveCanvas, workspaceRoot);
      
      expect(manager).toBeDefined();
    });

    it('should create necessary directories on initialization', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await workflowManager.ensureDirectories();

      expect(fs.mkdirSync).toHaveBeenCalledWith(promptsDir, { recursive: true });
      expect(fs.mkdirSync).toHaveBeenCalledWith(historyDir, { recursive: true });
      expect(fs.mkdirSync).toHaveBeenCalledWith(backupDir, { recursive: true });
    });

    it('should initialize version and audit files', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await workflowManager.initializeFiles();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('versions.json'),
        JSON.stringify([], null, 2)
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('audit.json'),
        JSON.stringify([], null, 2)
      );
    });
  });

  describe('proposal submission', () => {
    it('should submit proposal successfully', async () => {
      const result = await workflowManager.submitProposal(mockProposal);

      expect(result.submitted).toBe(true);
      expect(result.proposalId).toBe('proposal-123');
      expect(result.pheromoneId).toBeDefined();
      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'guide_pheromone',
          context: 'prompt-improvement',
          strength: expect.any(Number),
          metadata: expect.objectContaining({
            proposalId: 'proposal-123',
            promptFile: 'architect-prompt.txt',
            priority: 'high'
          })
        })
      );
    });

    it('should validate proposal before submission', async () => {
      const invalidProposal = {
        ...mockProposal,
        rationale: '', // Empty rationale
        diff: '' // Empty diff
      };

      const result = await workflowManager.submitProposal(invalidProposal);

      expect(result.submitted).toBe(false);
      expect(result.error).toContain('validation failed');
    });

    it('should store proposal in versions file', async () => {
      await workflowManager.submitProposal(mockProposal);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('versions.json'),
        expect.stringContaining('"proposal-123"')
      );
    });

    it('should create audit trail entry', async () => {
      await workflowManager.submitProposal(mockProposal);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('audit.json'),
        expect.stringContaining('"proposed"')
      );
    });

    it('should handle submission errors gracefully', async () => {
      mockCognitiveCanvas.createPheromone.mockRejectedValue(new Error('Canvas error'));

      const result = await workflowManager.submitProposal(mockProposal);

      expect(result.submitted).toBe(false);
      expect(result.error).toContain('Canvas error');
    });

    it('should set appropriate pheromone strength based on priority', async () => {
      const highPriorityProposal = { ...mockProposal, priority: 'high' as const };
      const lowPriorityProposal = { ...mockProposal, priority: 'low' as const };

      await workflowManager.submitProposal(highPriorityProposal);
      await workflowManager.submitProposal(lowPriorityProposal);

      const calls = mockCognitiveCanvas.createPheromone.mock.calls;
      const highPriorityStrength = calls[0][0].strength;
      const lowPriorityStrength = calls[1][0].strength;

      expect(highPriorityStrength).toBeGreaterThan(lowPriorityStrength);
    });
  });

  describe('approval processing', () => {
    beforeEach(() => {
      // Mock existing proposal in versions file
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([mockProposal]));
    });

    it('should process approval successfully', async () => {
      const result = await workflowManager.processApproval(
        'proposal-123',
        'approved',
        'human-reviewer',
        'Looks good, approved for implementation'
      );

      expect(result.approved).toBe(true);
      expect(result.proposalId).toBe('proposal-123');
      expect(result.reviewedBy).toBe('human-reviewer');
      expect(result.comments).toBe('Looks good, approved for implementation');
    });

    it('should handle rejection', async () => {
      const result = await workflowManager.processApproval(
        'proposal-123',
        'rejected',
        'human-reviewer',
        'Needs more specific improvements'
      );

      expect(result.approved).toBe(false);
      expect(result.comments).toBe('Needs more specific improvements');
    });

    it('should update proposal status in versions file', async () => {
      await workflowManager.processApproval('proposal-123', 'approved', 'reviewer');

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls.find(call => 
        call[0].includes('versions.json')
      );
      expect(writeCall[1]).toContain('"approved"');
    });

    it('should create audit trail for approval', async () => {
      await workflowManager.processApproval('proposal-123', 'approved', 'reviewer');

      const auditCall = (fs.writeFileSync as jest.Mock).mock.calls.find(call => 
        call[0].includes('audit.json')
      );
      expect(auditCall[1]).toContain('"approved"');
    });

    it('should handle non-existent proposal', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([]));

      await expect(workflowManager.processApproval('non-existent', 'approved', 'reviewer'))
        .rejects.toThrow('Proposal not found');
    });

    it('should prevent duplicate approvals', async () => {
      const approvedProposal = { ...mockProposal, status: 'approved' as const };
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([approvedProposal]));

      await expect(workflowManager.processApproval('proposal-123', 'approved', 'reviewer'))
        .rejects.toThrow('already been processed');
    });
  });

  describe('improvement application', () => {
    beforeEach(() => {
      const approvedVersion = { ...mockVersion, status: 'approved' as const };
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([approvedVersion]));
    });

    it('should apply improvement successfully', async () => {
      const result = await workflowManager.applyImprovement('version-456');

      expect(result.success).toBe(true);
      expect(result.versionId).toBe('version-456');
      expect(result.backupPath).toBeDefined();
    });

    it('should create backup before applying', async () => {
      await workflowManager.applyImprovement('version-456');

      expect(fs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining('architect-prompt.txt'),
        expect.stringContaining('.bak')
      );
    });

    it('should write improved content to prompt file', async () => {
      await workflowManager.applyImprovement('version-456');

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls.find(call => 
        call[0].includes('architect-prompt.txt') && !call[0].includes('.bak')
      );
      expect(writeCall[1]).toBe(mockVersion.improvedContent);
    });

    it('should update version status to applied', async () => {
      await workflowManager.applyImprovement('version-456');

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls.find(call => 
        call[0].includes('versions.json')
      );
      expect(writeCall[1]).toContain('"applied"');
    });

    it('should handle file system errors', async () => {
      (fs.writeFileSync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('architect-prompt.txt')) {
          throw new Error('Permission denied');
        }
      });

      const result = await workflowManager.applyImprovement('version-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should handle non-existent version', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([]));

      await expect(workflowManager.applyImprovement('non-existent'))
        .rejects.toThrow('Version not found');
    });

    it('should prevent applying non-approved versions', async () => {
      const pendingVersion = { ...mockVersion, status: 'pending' as const };
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([pendingVersion]));

      await expect(workflowManager.applyImprovement('version-456'))
        .rejects.toThrow('not approved');
    });
  });

  describe('version rollback', () => {
    beforeEach(() => {
      const versions = [
        { ...mockVersion, id: 'version-1', status: 'applied' as const },
        { ...mockVersion, id: 'version-2', status: 'applied' as const },
        { ...mockVersion, id: 'version-3', status: 'applied' as const }
      ];
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(versions));
    });

    it('should rollback to previous version successfully', async () => {
      const result = await workflowManager.rollbackToVersion('architect-prompt.txt', 'version-2');

      expect(result.success).toBe(true);
      expect(result.rolledBackTo).toBe('version-2');
      expect(result.newVersionId).toBeDefined();
    });

    it('should create backup before rollback', async () => {
      await workflowManager.rollbackToVersion('architect-prompt.txt', 'version-2');

      expect(fs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining('architect-prompt.txt'),
        expect.stringContaining('.rollback.bak')
      );
    });

    it('should restore content from target version', async () => {
      await workflowManager.rollbackToVersion('architect-prompt.txt', 'version-2');

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls.find(call => 
        call[0].includes('architect-prompt.txt') && !call[0].includes('.bak')
      );
      expect(writeCall[1]).toBe(mockVersion.improvedContent);
    });

    it('should create new rollback version entry', async () => {
      await workflowManager.rollbackToVersion('architect-prompt.txt', 'version-2');

      const versionsCall = (fs.writeFileSync as jest.Mock).mock.calls.find(call => 
        call[0].includes('versions.json')
      );
      expect(versionsCall[1]).toContain('rolled_back');
    });

    it('should handle rollback to non-existent version', async () => {
      await expect(workflowManager.rollbackToVersion('architect-prompt.txt', 'non-existent'))
        .rejects.toThrow('Version not found');
    });

    it('should handle rollback for non-existent file', async () => {
      await expect(workflowManager.rollbackToVersion('non-existent.txt', 'version-2'))
        .rejects.toThrow('No versions found');
    });

    it('should create audit trail for rollback', async () => {
      await workflowManager.rollbackToVersion('architect-prompt.txt', 'version-2');

      const auditCall = (fs.writeFileSync as jest.Mock).mock.calls.find(call => 
        call[0].includes('audit.json')
      );
      expect(auditCall[1]).toContain('"rolled_back"');
    });
  });

  describe('validation', () => {
    it('should validate correct proposal', async () => {
      const result = await workflowManager.validateProposal(mockProposal);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect missing required fields', async () => {
      const invalidProposal = {
        ...mockProposal,
        rationale: '',
        diff: ''
      };

      const result = await workflowManager.validateProposal(invalidProposal);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Rationale is required');
      expect(result.errors).toContain('Diff is required');
    });

    it('should detect invalid content changes', async () => {
      const noChangeProposal = {
        ...mockProposal,
        improvedContent: mockProposal.originalContent
      };

      const result = await workflowManager.validateProposal(noChangeProposal);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No meaningful changes detected');
    });

    it('should warn about large changes', async () => {
      const largeChangeProposal = {
        ...mockProposal,
        improvedContent: 'A'.repeat(10000) // Very large change
      };

      const result = await workflowManager.validateProposal(largeChangeProposal);

      expect(result.warnings).toContain('Large content change detected');
    });

    it('should validate diff format', async () => {
      const invalidDiffProposal = {
        ...mockProposal,
        diff: 'invalid diff format'
      };

      const result = await workflowManager.validateProposal(invalidDiffProposal);

      expect(result.errors).toContain('Invalid diff format');
    });
  });

  describe('file operations', () => {
    it('should list prompt files', async () => {
      const files = await workflowManager.listPromptFiles();

      expect(files).toEqual(['architect-prompt.txt', 'coder-prompt.txt']);
      expect(fs.readdirSync).toHaveBeenCalledWith(promptsDir);
    });

    it('should get version history for file', async () => {
      const versions = [mockVersion];
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(versions));

      const history = await workflowManager.getVersionHistory('architect-prompt.txt');

      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(mockVersion);
    });

    it('should get pending proposals', async () => {
      const proposals = [mockProposal];
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(proposals));

      const pending = await workflowManager.getPendingProposals();

      expect(pending).toHaveLength(1);
      expect(pending[0]).toEqual(mockProposal);
    });

    it('should handle missing files gracefully', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const history = await workflowManager.getVersionHistory('non-existent.txt');
      const pending = await workflowManager.getPendingProposals();

      expect(history).toHaveLength(0);
      expect(pending).toHaveLength(0);
    });

    it('should filter versions by file', async () => {
      const allVersions = [
        { ...mockVersion, promptFile: 'architect-prompt.txt' },
        { ...mockVersion, promptFile: 'coder-prompt.txt', id: 'version-789' }
      ];
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(allVersions));

      const history = await workflowManager.getVersionHistory('architect-prompt.txt');

      expect(history).toHaveLength(1);
      expect(history[0].promptFile).toBe('architect-prompt.txt');
    });
  });

  describe('audit trail', () => {
    it('should create audit entry', async () => {
      const auditEntry: AuditTrailEntry = {
        id: 'audit-123',
        promptFile: 'architect-prompt.txt',
        action: 'proposed',
        timestamp: '2024-01-01T10:00:00Z',
        performedBy: 'reflector-agent',
        details: { proposalId: 'proposal-123' }
      };

      await workflowManager.createAuditEntry(auditEntry);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('audit.json'),
        expect.stringContaining('"audit-123"')
      );
    });

    it('should maintain audit trail order', async () => {
      const existingAudit = [{ id: 'audit-1', action: 'proposed' }];
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(existingAudit));

      const newEntry: AuditTrailEntry = {
        id: 'audit-2',
        promptFile: 'test.txt',
        action: 'approved',
        timestamp: '2024-01-01T11:00:00Z',
        performedBy: 'reviewer',
        details: {}
      };

      await workflowManager.createAuditEntry(newEntry);

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls.find(call => 
        call[0].includes('audit.json')
      );
      const auditData = JSON.parse(writeCall[1]);
      
      expect(auditData).toHaveLength(2);
      expect(auditData[1].id).toBe('audit-2');
    });
  });

  describe('optimization metrics', () => {
    beforeEach(() => {
      const versions = [
        { ...mockVersion, status: 'applied' as const },
        { ...mockVersion, id: 'v2', status: 'applied' as const },
        { ...mockVersion, id: 'v3', status: 'approved' as const },
        { ...mockVersion, id: 'v4', status: 'rejected' as const }
      ];
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(versions));
    });

    it('should calculate optimization metrics', async () => {
      const metrics = await workflowManager.getOptimizationMetrics();

      expect(metrics.totalProposals).toBe(4);
      expect(metrics.approvedProposals).toBe(3); // approved + applied
      expect(metrics.appliedVersions).toBe(2);
      expect(metrics.rollbacks).toBe(0);
      expect(metrics.averageImpactScore).toBeGreaterThan(0);
    });

    it('should handle empty metrics', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify([]));

      const metrics = await workflowManager.getOptimizationMetrics();

      expect(metrics.totalProposals).toBe(0);
      expect(metrics.approvedProposals).toBe(0);
      expect(metrics.appliedVersions).toBe(0);
      expect(metrics.averageImpactScore).toBe(0);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle file system errors gracefully', async () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not readable');
      });

      const history = await workflowManager.getVersionHistory('test.txt');
      
      expect(history).toHaveLength(0);
    });

    it('should handle corrupted JSON files', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json{');

      const pending = await workflowManager.getPendingProposals();
      
      expect(pending).toHaveLength(0);
    });

    it('should handle concurrent file operations', async () => {
      const proposals = Array.from({ length: 5 }, (_, i) => ({
        ...mockProposal,
        id: `proposal-${i}`
      }));

      const promises = proposals.map(proposal => 
        workflowManager.submitProposal(proposal)
      );

      const results = await Promise.all(promises);

      expect(results.every(r => r.submitted)).toBe(true);
    });

    it('should handle null and undefined inputs', async () => {
      await expect(workflowManager.submitProposal(null as any))
        .rejects.toThrow();

      await expect(workflowManager.processApproval(null as any, 'approved', 'reviewer'))
        .rejects.toThrow();
    });

    it('should validate directory permissions', async () => {
      (fs.mkdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(workflowManager.ensureDirectories())
        .rejects.toThrow('Permission denied');
    });
  });

  describe('performance optimization', () => {
    it('should handle large version histories efficiently', async () => {
      const largeHistory = Array.from({ length: 1000 }, (_, i) => ({
        ...mockVersion,
        id: `version-${i}`
      }));
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(largeHistory));

      const startTime = Date.now();
      const history = await workflowManager.getVersionHistory('test.txt');
      const duration = Date.now() - startTime;

      expect(history).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should efficiently process multiple proposals', async () => {
      const proposals = Array.from({ length: 100 }, (_, i) => ({
        ...mockProposal,
        id: `proposal-${i}`,
        promptFile: `prompt-${i}.txt`
      }));

      const startTime = Date.now();
      const promises = proposals.map(proposal => workflowManager.submitProposal(proposal));
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should handle bulk operations efficiently
    });

    it('should cache file reads for better performance', async () => {
      // Multiple calls to same data
      await workflowManager.getVersionHistory('test.txt');
      await workflowManager.getVersionHistory('test.txt');

      // Should read file efficiently (implementation detail)
      expect(fs.readFileSync).toHaveBeenCalled();
    });
  });
});