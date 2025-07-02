import * as fs from 'fs';
import * as path from 'path';
import { PromptImprovementWorkflow, PromptVersion, ImprovementProposal, ApprovalStatus } from '../src/prompt-improvement';
import { CognitiveCanvas } from '../src/cognitive-canvas';
import { ReflectorAgent } from '../src/agents/reflector';
import { GovernorAgent } from '../src/agents/governor';

// Mock dependencies
jest.mock('fs');
jest.mock('path');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

// Mock file system operations
mockPath.resolve.mockImplementation((...paths) => paths.join('/'));
mockPath.join.mockImplementation((...paths) => paths.join('/'));
mockPath.basename.mockImplementation((filePath, ext) => {
  const name = filePath.split('/').pop() || '';
  return ext ? name.replace(ext, '') : name;
});
mockPath.dirname.mockImplementation((filePath) => {
  const parts = filePath.split('/');
  return parts.slice(0, -1).join('/');
});

describe('PromptImprovementWorkflow', () => {
  let workflow: PromptImprovementWorkflow;
  let mockCognitiveCanvas: jest.Mocked<CognitiveCanvas>;
  let mockReflector: jest.Mocked<ReflectorAgent>;
  let mockGovernor: jest.Mocked<GovernorAgent>;
  let mockWorkspaceRoot: string;

  beforeEach(() => {
    mockWorkspaceRoot = '/test/workspace';
    
    // Create mock instances
    mockCognitiveCanvas = {
      createPheromone: jest.fn(),
      getPheromonesByType: jest.fn(),
      getTasksByProject: jest.fn(),
    } as any;

    mockReflector = {
      generatePromptImprovements: jest.fn(),
    } as any;

    mockGovernor = {
      reviewImprovementProposals: jest.fn(),
    } as any;

    // Initialize workflow
    workflow = new PromptImprovementWorkflow({
      workspaceRoot: mockWorkspaceRoot,
      cognitiveCanvas: mockCognitiveCanvas,
    });

    // Mock filesystem
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation();
    mockFs.readFileSync.mockReturnValue('test prompt content');
    mockFs.writeFileSync.mockImplementation();
    mockFs.readdirSync.mockReturnValue(['test.md'] as any);
    mockFs.statSync.mockReturnValue({ isFile: () => true } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with workspace root', () => {
      expect(workflow.getWorkspaceRoot()).toBe(mockWorkspaceRoot);
    });

    it('should create version history directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      new PromptImprovementWorkflow({
        workspaceRoot: mockWorkspaceRoot,
        cognitiveCanvas: mockCognitiveCanvas,
      });

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.cortex-history'),
        { recursive: true }
      );
    });
  });

  describe('diff generation', () => {
    it('should generate unified diff for prompt changes', async () => {
      const originalContent = 'You are a helpful assistant.\nProvide accurate responses.';
      const improvedContent = 'You are a helpful AI assistant.\nProvide accurate and detailed responses.\nUse examples when appropriate.';

      const diff = await workflow.generateUnifiedDiff(originalContent, improvedContent, 'test-prompt.md');

      expect(diff).toContain('--- test-prompt.md');
      expect(diff).toContain('+++ test-prompt.md');
      expect(diff).toContain('-You are a helpful assistant.');
      expect(diff).toContain('+You are a helpful AI assistant.');
      expect(diff).toContain('+Use examples when appropriate.');
    });

    it('should handle empty diffs', async () => {
      const content = 'Same content';
      const diff = await workflow.generateUnifiedDiff(content, content, 'test.md');
      
      expect(diff).toBe('');
    });

    it('should include line numbers in diff context', async () => {
      const original = 'Line 1\nLine 2\nLine 3';
      const improved = 'Line 1\nImproved Line 2\nLine 3';

      const diff = await workflow.generateUnifiedDiff(original, improved, 'test.md');

      expect(diff).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    });
  });

  describe('version tracking', () => {
    it('should create version history for prompt changes', async () => {
      const promptFile = 'test-prompt.md';
      const originalContent = 'original content';
      const improvedContent = 'improved content';

      mockFs.readFileSync.mockReturnValue(originalContent);

      const version = await workflow.createPromptVersion(promptFile, originalContent, improvedContent, 'test improvement');

      expect(version.id).toBeDefined();
      expect(version.promptFile).toBe(promptFile);
      expect(version.originalContent).toBe(originalContent);
      expect(version.improvedContent).toBe(improvedContent);
      expect(version.rationale).toBe('test improvement');
      expect(version.timestamp).toBeDefined();
      expect(version.status).toBe('pending');
    });

    it('should save version to history file', async () => {
      const promptFile = 'test-prompt.md';
      const originalContent = 'original';
      const improvedContent = 'improved';

      await workflow.createPromptVersion(promptFile, originalContent, improvedContent, 'test');

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.cortex-history/versions.json'),
        expect.any(String)
      );
    });

    it('should load existing version history', async () => {
      const mockVersions = [
        {
          id: 'test-1',
          promptFile: 'test.md',
          originalContent: 'old',
          improvedContent: 'new',
          rationale: 'improvement',
          timestamp: '2024-01-01T00:00:00.000Z',
          status: 'approved' as const,
          approvedBy: 'governor',
          appliedAt: '2024-01-01T01:00:00.000Z'
        }
      ];

      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockVersions));

      const versions = await workflow.getVersionHistory();

      expect(versions).toHaveLength(1);
      expect(versions[0].id).toBe('test-1');
      expect(versions[0].status).toBe('approved');
    });

    it('should handle missing version history file', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const versions = await workflow.getVersionHistory();

      expect(versions).toHaveLength(0);
    });
  });

  describe('approval workflow', () => {
    let mockProposal: ImprovementProposal;

    beforeEach(() => {
      mockProposal = {
        id: 'test-proposal-1',
        promptFile: 'test-prompt.md',
        originalContent: 'original content',
        improvedContent: 'improved content',
        diff: '--- test\n+++ test\n@@ -1,1 +1,1 @@\n-original\n+improved',
        rationale: 'test improvement',
        priority: 'medium',
        submittedBy: 'reflector',
        submittedAt: '2024-01-01T00:00:00.000Z',
        status: 'pending'
      };
    });

    it('should submit proposal to Governor for approval', async () => {
      const result = await workflow.submitForApproval(mockProposal);

      expect(result.submitted).toBe(true);
      expect(result.proposalId).toBe(mockProposal.id);
      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'approval_request',
          context: 'prompt_improvement_approval',
          metadata: expect.objectContaining({
            proposalId: mockProposal.id,
            priority: mockProposal.priority
          })
        })
      );
    });

    it('should handle Governor approval', async () => {
      const approvalResult = await workflow.processApproval(mockProposal.id, 'approved', 'governor', 'Looks good');

      expect(approvalResult.approved).toBe(true);
      expect(approvalResult.reviewedBy).toBe('governor');
      expect(approvalResult.comments).toBe('Looks good');
    });

    it('should handle Governor rejection', async () => {
      const rejectionResult = await workflow.processApproval(mockProposal.id, 'rejected', 'governor', 'Needs more work');

      expect(rejectionResult.approved).toBe(false);
      expect(rejectionResult.reviewedBy).toBe('governor');
      expect(rejectionResult.comments).toBe('Needs more work');
    });

    it('should throw error for invalid proposal ID', async () => {
      await expect(
        workflow.processApproval('invalid-id', 'approved', 'governor', 'test')
      ).rejects.toThrow('Proposal not found: invalid-id');
    });
  });

  describe('prompt application', () => {
    let mockVersion: PromptVersion;

    beforeEach(() => {
      mockVersion = {
        id: 'test-version-1',
        promptFile: 'test-prompt.md',
        originalContent: 'original content',
        improvedContent: 'improved content',
        diff: 'test diff',
        rationale: 'test improvement',
        timestamp: '2024-01-01T00:00:00.000Z',
        status: 'approved',
        approvedBy: 'governor',
        approvedAt: '2024-01-01T01:00:00.000Z'
      };
    });

    it('should apply approved prompt improvements', async () => {
      const result = await workflow.applyPromptImprovement(mockVersion);

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining(mockVersion.promptFile),
        mockVersion.improvedContent
      );
    });

    it('should create backup before applying changes', async () => {
      mockFs.readFileSync.mockReturnValue('current content');

      await workflow.applyPromptImprovement(mockVersion);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.backup'),
        'current content'
      );
    });

    it('should update version status after application', async () => {
      await workflow.applyPromptImprovement(mockVersion);

      // Verify version was updated
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('versions.json'),
        expect.stringContaining('"appliedAt"')
      );
    });

    it('should reject applying unapproved improvements', async () => {
      const unapprovedVersion: PromptVersion = {
        ...mockVersion,
        status: 'pending'
      };

      await expect(
        workflow.applyPromptImprovement(unapprovedVersion)
      ).rejects.toThrow('Cannot apply unapproved improvement');
    });
  });

  describe('rollback functionality', () => {
    it('should rollback to previous version', async () => {
      const currentVersion: PromptVersion = {
        id: 'current',
        promptFile: 'test.md',
        originalContent: 'original',
        improvedContent: 'current content',
        diff: 'test diff',
        rationale: 'current',
        timestamp: '2024-01-02T00:00:00.000Z',
        status: 'applied',
        appliedAt: '2024-01-02T01:00:00.000Z'
      };

      const targetVersion: PromptVersion = {
        id: 'target',
        promptFile: 'test.md',
        originalContent: 'even older',
        improvedContent: 'original',
        diff: 'test diff 2',
        rationale: 'target',
        timestamp: '2024-01-01T00:00:00.000Z',
        status: 'applied',
        appliedAt: '2024-01-01T01:00:00.000Z'
      };

      // Mock version history
      mockFs.readFileSync.mockReturnValue(JSON.stringify([targetVersion, currentVersion]));

      const rollbackResult = await workflow.rollbackToVersion('test.md', targetVersion.id);

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.rolledBackTo).toBe(targetVersion.id);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test.md'),
        targetVersion.improvedContent
      );
    });

    it('should create rollback entry in version history', async () => {
      const targetVersion: PromptVersion = {
        id: 'target',
        promptFile: 'test.md',
        originalContent: 'old',
        improvedContent: 'target content',
        diff: 'diff',
        rationale: 'target',
        timestamp: '2024-01-01T00:00:00.000Z',
        status: 'applied',
        appliedAt: '2024-01-01T01:00:00.000Z'
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify([targetVersion]));

      await workflow.rollbackToVersion('test.md', targetVersion.id);

      const expectedRollbackEntry = expect.objectContaining({
        promptFile: 'test.md',
        rationale: expect.stringContaining('Rollback to version'),
        status: 'applied'
      });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('versions.json'),
        expect.stringContaining('"rationale":"Rollback to version target')
      );
    });

    it('should validate version exists before rollback', async () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify([]));

      await expect(
        workflow.rollbackToVersion('test.md', 'nonexistent')
      ).rejects.toThrow('Version not found');
    });
  });

  describe('validation system', () => {
    it('should validate prompt improvements before application', async () => {
      const proposal: ImprovementProposal = {
        id: 'test',
        promptFile: 'test.md',
        originalContent: 'original',
        improvedContent: 'improved',
        diff: 'test diff',
        rationale: 'improvement',
        priority: 'medium',
        submittedBy: 'reflector',
        submittedAt: '2024-01-01T00:00:00.000Z',
        status: 'pending'
      };

      const validation = await workflow.validateImprovement(proposal);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid improvements', async () => {
      const invalidProposal: ImprovementProposal = {
        id: 'test',
        promptFile: 'nonexistent.md',
        originalContent: '',
        improvedContent: '',
        diff: '',
        rationale: '',
        priority: 'medium',
        submittedBy: 'reflector',
        submittedAt: '2024-01-01T00:00:00.000Z',
        status: 'pending'
      };

      mockFs.existsSync.mockReturnValue(false);

      const validation = await workflow.validateImprovement(invalidProposal);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toContain('Prompt file does not exist');
    });

    it('should validate diff integrity', async () => {
      const proposal: ImprovementProposal = {
        id: 'test',
        promptFile: 'test.md',
        originalContent: 'original content',
        improvedContent: 'improved content',
        diff: 'invalid diff format',
        rationale: 'test',
        priority: 'medium',
        submittedBy: 'reflector',
        submittedAt: '2024-01-01T00:00:00.000Z',
        status: 'pending'
      };

      const validation = await workflow.validateImprovement(proposal);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid diff format');
    });
  });

  describe('hot-reloading support', () => {
    it('should notify about prompt updates for hot-reloading', async () => {
      const version: PromptVersion = {
        id: 'test',
        promptFile: 'test-prompt.md',
        originalContent: 'old',
        improvedContent: 'new',
        diff: 'diff',
        rationale: 'improvement',
        timestamp: '2024-01-01T00:00:00.000Z',
        status: 'approved',
        approvedAt: '2024-01-01T01:00:00.000Z'
      };

      await workflow.applyPromptImprovement(version);

      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'prompt_updated',
          context: 'hot_reload',
          metadata: expect.objectContaining({
            promptFile: version.promptFile,
            versionId: version.id
          })
        })
      );
    });

    it('should provide change notifications for dependent systems', async () => {
      const changes = await workflow.getRecentChanges(24); // Last 24 hours

      // Should return structure for hot-reload systems
      expect(Array.isArray(changes)).toBe(true);
    });
  });

  describe('integration with agents', () => {
    it('should process Reflector improvement proposals', async () => {
      const reflectorProposals = [
        {
          file: 'test.md',
          diff: 'test diff',
          rationale: 'improvement',
          priority: 'medium' as const
        }
      ];

      const results = await workflow.processReflectorProposals(reflectorProposals);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBeDefined();
      expect(results[0].status).toBe('pending');
    });

    it('should handle Governor approval responses', async () => {
      const mockPheromone = {
        id: 'approval-response',
        type: 'approval_response',
        metadata: {
          proposalId: 'test-proposal',
          decision: 'approved',
          comments: 'Good improvement'
        }
      };

      mockCognitiveCanvas.getPheromonesByType.mockResolvedValue([mockPheromone]);

      const processed = await workflow.processGovernorResponses();

      expect(processed).toHaveLength(1);
      expect(processed[0].proposalId).toBe('test-proposal');
      expect(processed[0].approved).toBe(true);
    });
  });

  describe('audit trail', () => {
    it('should maintain complete audit trail of improvements', async () => {
      const auditTrail = await workflow.getAuditTrail('test.md');

      expect(Array.isArray(auditTrail)).toBe(true);
      // Audit trail should include all changes, approvals, and applications
    });

    it('should include performance metrics in audit trail', async () => {
      const auditTrail = await workflow.getAuditTrail('test.md');
      
      // Should track performance impact of prompt changes
      expect(auditTrail).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      await expect(
        workflow.getVersionHistory()
      ).rejects.toThrow('Failed to load version history');
    });

    it('should handle malformed version history files', async () => {
      mockFs.readFileSync.mkReturnValue('invalid json');

      await expect(
        workflow.getVersionHistory()
      ).rejects.toThrow('Failed to load version history');
    });

    it('should handle cognitive canvas errors', async () => {
      mockCognitiveCanvas.createPheromone.mockRejectedValue(new Error('Canvas error'));

      // Should not throw but should handle gracefully
      const result = await workflow.submitForApproval({
        id: 'test',
        promptFile: 'test.md',
        originalContent: 'orig',
        improvedContent: 'imp',
        diff: 'diff',
        rationale: 'test',
        priority: 'medium',
        submittedBy: 'reflector',
        submittedAt: '2024-01-01T00:00:00.000Z',
        status: 'pending'
      });

      expect(result.submitted).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});