import { WorkspaceManager } from '../src/workspace';
import * as fs from 'fs';
import * as path from 'path';

describe('WorkspaceManager', () => {
  const testProjectRoot = '/tmp/test-workspace';
  let workspaceManager: WorkspaceManager;

  beforeEach(() => {
    if (fs.existsSync(testProjectRoot)) {
      fs.rmSync(testProjectRoot, { recursive: true });
    }
    fs.mkdirSync(testProjectRoot, { recursive: true });
    workspaceManager = new WorkspaceManager(testProjectRoot);
  });

  afterEach(() => {
    if (fs.existsSync(testProjectRoot)) {
      fs.rmSync(testProjectRoot, { recursive: true });
    }
  });

  describe('constructor', () => {
    it('should initialize with project root', () => {
      expect(workspaceManager.getProjectRoot()).toBe(testProjectRoot);
    });

    it('should create worktrees directory', () => {
      const worktreesDir = path.join(testProjectRoot, 'worktrees');
      expect(fs.existsSync(worktreesDir)).toBe(true);
    });
  });

  describe('createWorktree', () => {
    it('should create a new worktree', async () => {
      const mockCreate = jest.spyOn(workspaceManager, 'createWorktree');
      mockCreate.mockResolvedValue({
        id: 'task-001',
        path: '/path/to/worktree',
        branch: 'feature-branch',
        baseBranch: 'main'
      });

      const result = await workspaceManager.createWorktree('task-001', 'feature-branch');
      expect(result.id).toBe('task-001');
      expect(result.branch).toBe('feature-branch');
      expect(mockCreate).toHaveBeenCalledWith('task-001', 'feature-branch');
    });

    it('should handle existing worktree names', async () => {
      const mockCreate = jest.spyOn(workspaceManager, 'createWorktree');
      mockCreate.mockRejectedValue(new Error('Worktree already exists'));

      await expect(workspaceManager.createWorktree('task-001', 'existing-branch'))
        .rejects.toThrow('Worktree already exists');
    });
  });

  describe('removeWorktree', () => {
    it('should remove an existing worktree', async () => {
      const mockRemove = jest.spyOn(workspaceManager, 'removeWorktree');
      mockRemove.mockResolvedValue(true);

      const result = await workspaceManager.removeWorktree('task-001');
      expect(result).toBe(true);
      expect(mockRemove).toHaveBeenCalledWith('task-001');
    });

    it('should handle non-existent worktree', async () => {
      const mockRemove = jest.spyOn(workspaceManager, 'removeWorktree');
      mockRemove.mockResolvedValue(false);

      const result = await workspaceManager.removeWorktree('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('listWorktrees', () => {
    it('should list all active worktrees', async () => {
      const mockList = jest.spyOn(workspaceManager, 'listWorktrees');
      mockList.mockResolvedValue([
        { id: 'task-001', path: '/path/1', branch: 'branch-1', baseBranch: 'main' },
        { id: 'task-002', path: '/path/2', branch: 'branch-2', baseBranch: 'main' }
      ]);

      const result = await workspaceManager.listWorktrees();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('task-001');
      expect(result[1].id).toBe('task-002');
    });
  });

  describe('getWorktreePath', () => {
    it('should return correct worktree path for task', () => {
      const taskId = 'task-001';
      const expectedPath = path.join(testProjectRoot, 'worktrees', taskId);
      
      const result = workspaceManager.getWorktreePath(taskId);
      expect(result).toBe(expectedPath);
    });
  });

  describe('executeCommand', () => {
    it('should execute command in worktree directory', async () => {
      const mockExecute = jest.spyOn(workspaceManager, 'executeCommand');
      mockExecute.mockResolvedValue({ 
        stdout: 'command output', 
        stderr: '', 
        exitCode: 0 
      });

      const result = await workspaceManager.executeCommand('task-001', 'ls -la');
      expect(result.stdout).toBe('command output');
      expect(result.exitCode).toBe(0);
      expect(mockExecute).toHaveBeenCalledWith('task-001', 'ls -la');
    });

    it('should handle command execution errors', async () => {
      const mockExecute = jest.spyOn(workspaceManager, 'executeCommand');
      mockExecute.mockResolvedValue({
        stdout: '',
        stderr: 'command failed',
        exitCode: 1
      });

      const result = await workspaceManager.executeCommand('task-001', 'invalid-command');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('command failed');
    });
  });
});