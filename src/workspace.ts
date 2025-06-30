import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface WorktreeInfo {
  id: string;
  path: string;
  branch: string;
  baseBranch: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class WorkspaceManager {
  private projectRoot: string;
  private worktreesDir: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.worktreesDir = path.join(projectRoot, 'worktrees');
    
    // Ensure worktrees directory exists
    if (!fs.existsSync(this.worktreesDir)) {
      fs.mkdirSync(this.worktreesDir, { recursive: true });
    }
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  getWorktreePath(taskId: string): string {
    return path.join(this.worktreesDir, taskId);
  }

  async createWorktree(taskId: string, branchName: string, baseBranch: string = 'main'): Promise<WorktreeInfo> {
    const worktreePath = this.getWorktreePath(taskId);
    
    // Check if worktree already exists
    if (fs.existsSync(worktreePath)) {
      throw new Error(`Worktree for task ${taskId} already exists at ${worktreePath}`);
    }

    try {
      // Create new branch from base branch
      await execAsync(`git checkout -b ${branchName} ${baseBranch}`, { cwd: this.projectRoot });
      
      // Create worktree
      await execAsync(`git worktree add ${worktreePath} ${branchName}`, { cwd: this.projectRoot });
      
      // Return to original branch
      await execAsync(`git checkout ${baseBranch}`, { cwd: this.projectRoot });

      return {
        id: taskId,
        path: worktreePath,
        branch: branchName,
        baseBranch: baseBranch
      };
    } catch (error) {
      // Cleanup on failure
      if (fs.existsSync(worktreePath)) {
        try {
          await execAsync(`git worktree remove ${worktreePath}`, { cwd: this.projectRoot });
        } catch (cleanupError) {
          console.warn(`Failed to cleanup worktree: ${cleanupError}`);
        }
      }
      
      throw new Error(`Failed to create worktree: ${(error as Error).message}`);
    }
  }

  async removeWorktree(taskId: string): Promise<boolean> {
    const worktreePath = this.getWorktreePath(taskId);
    
    if (!fs.existsSync(worktreePath)) {
      return false;
    }

    try {
      // Remove worktree
      await execAsync(`git worktree remove ${worktreePath}`, { cwd: this.projectRoot });
      return true;
    } catch (error) {
      console.error(`Failed to remove worktree: ${(error as Error).message}`);
      return false;
    }
  }

  async listWorktrees(): Promise<WorktreeInfo[]> {
    try {
      const { stdout } = await execAsync('git worktree list --porcelain', { cwd: this.projectRoot });
      const worktrees: WorktreeInfo[] = [];
      
      // Parse git worktree list output
      const lines = stdout.trim().split('\n');
      let currentWorktree: Partial<WorktreeInfo> = {};
      
      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          const worktreePath = line.substring(9);
          const taskId = path.basename(worktreePath);
          currentWorktree = { id: taskId, path: worktreePath };
        } else if (line.startsWith('branch ')) {
          const branch = line.substring(7);
          if (currentWorktree.path) {
            currentWorktree.branch = branch;
            // Extract task ID from path
            const taskId = path.basename(currentWorktree.path);
            worktrees.push({
              id: taskId,
              path: currentWorktree.path,
              branch: branch,
              baseBranch: 'main' // Default, could be enhanced to track actual base
            });
          }
          currentWorktree = {};
        }
      }
      
      return worktrees.filter(w => w.path && w.path.includes('worktrees'));
    } catch (error) {
      console.error(`Failed to list worktrees: ${(error as Error).message}`);
      return [];
    }
  }

  async executeCommand(taskId: string, command: string): Promise<CommandResult> {
    const worktreePath = this.getWorktreePath(taskId);
    
    if (!fs.existsSync(worktreePath)) {
      throw new Error(`Worktree for task ${taskId} does not exist`);
    }

    try {
      const { stdout, stderr } = await execAsync(command, { cwd: worktreePath });
      return {
        stdout,
        stderr,
        exitCode: 0
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1
      };
    }
  }

  async commitChanges(taskId: string, message: string, files?: string[]): Promise<string> {
    const worktreePath = this.getWorktreePath(taskId);
    
    if (!fs.existsSync(worktreePath)) {
      throw new Error(`Worktree for task ${taskId} does not exist`);
    }

    try {
      // Add files to staging
      if (files && files.length > 0) {
        await execAsync(`git add ${files.join(' ')}`, { cwd: worktreePath });
      } else {
        await execAsync('git add .', { cwd: worktreePath });
      }

      // Commit changes
      const { stdout } = await execAsync(`git commit -m "${message}"`, { cwd: worktreePath });
      
      // Extract commit hash
      const { stdout: hashOutput } = await execAsync('git rev-parse HEAD', { cwd: worktreePath });
      return hashOutput.trim();
    } catch (error) {
      throw new Error(`Failed to commit changes: ${(error as Error).message}`);
    }
  }

  async mergeToBranch(taskId: string, targetBranch: string = 'main'): Promise<void> {
    const worktrees = await this.listWorktrees();
    const worktree = worktrees.find(w => w.id === taskId);
    
    if (!worktree) {
      throw new Error(`Worktree for task ${taskId} not found`);
    }

    try {
      // Switch to target branch
      await execAsync(`git checkout ${targetBranch}`, { cwd: this.projectRoot });
      
      // Merge the feature branch
      await execAsync(`git merge ${worktree.branch}`, { cwd: this.projectRoot });
      
      // Clean up the feature branch
      await execAsync(`git branch -d ${worktree.branch}`, { cwd: this.projectRoot });
      
      console.log(`Successfully merged ${worktree.branch} into ${targetBranch}`);
    } catch (error) {
      throw new Error(`Failed to merge branch: ${(error as Error).message}`);
    }
  }

  async getWorktreeStatus(taskId: string): Promise<{ clean: boolean; files: string[] }> {
    try {
      const result = await this.executeCommand(taskId, 'git status --porcelain');
      const files = result.stdout.trim().split('\n').filter(line => line.trim() !== '');
      
      return {
        clean: files.length === 0,
        files: files
      };
    } catch (error) {
      throw new Error(`Failed to get worktree status: ${(error as Error).message}`);
    }
  }
}