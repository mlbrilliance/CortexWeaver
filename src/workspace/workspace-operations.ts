import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { WorktreeInfo, CommandResult, CodeFileInfo, FileSearchOptions } from './index';
import { FileAnalyzer } from './file-analyzer';

const execAsync = promisify(exec);

/**
 * WorkspaceOperations handles all workspace operations including worktree management,
 * file operations, and code analysis
 */
export class WorkspaceOperations {
  private projectRoot: string;
  private worktreesDir: string;
  private fileAnalyzer: FileAnalyzer;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.worktreesDir = path.join(projectRoot, 'worktrees');
    this.fileAnalyzer = new FileAnalyzer(projectRoot);
    
    // Ensure worktrees directory exists
    if (!fs.existsSync(this.worktreesDir)) {
      fs.mkdirSync(this.worktreesDir, { recursive: true });
    }
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

    // Validate branch names
    if (!this.isValidBranchName(branchName)) {
      throw new Error(`Invalid branch name: ${branchName}`);
    }

    let originalBranch: string = 'main'; // Default fallback
    
    try {
      // Get current branch
      const { stdout: currentBranch } = await execAsync('git branch --show-current', { cwd: this.projectRoot });
      originalBranch = currentBranch.trim() || 'main';
      
      // Ensure we're working with a clean state
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: this.projectRoot });
      if (statusOutput.trim() !== '') {
        throw new Error('Working directory has uncommitted changes. Please commit or stash them first.');
      }
      
      // Fetch latest from remote to ensure base branch is up to date
      try {
        await execAsync(`git fetch origin ${baseBranch}`, { cwd: this.projectRoot });
      } catch (fetchError) {
        console.warn(`Warning: Could not fetch latest ${baseBranch} from remote`);
      }
      
      // Check if base branch exists locally
      try {
        await execAsync(`git show-ref --verify --quiet refs/heads/${baseBranch}`, { cwd: this.projectRoot });
      } catch (branchError) {
        // Try to create local branch from remote
        try {
          await execAsync(`git checkout -b ${baseBranch} origin/${baseBranch}`, { cwd: this.projectRoot });
          await execAsync(`git checkout ${originalBranch}`, { cwd: this.projectRoot });
        } catch (remoteError) {
          throw new Error(`Base branch ${baseBranch} not found locally or on remote`);
        }
      }
      
      // Check if branch already exists
      try {
        await execAsync(`git show-ref --verify --quiet refs/heads/${branchName}`, { cwd: this.projectRoot });
        throw new Error(`Branch ${branchName} already exists`);
      } catch (branchCheckError) {
        // Branch doesn't exist, which is what we want
      }
      
      // Create new branch from base branch
      await execAsync(`git checkout -b ${branchName} ${baseBranch}`, { cwd: this.projectRoot });
      
      // Create worktree
      await execAsync(`git worktree add "${worktreePath}" ${branchName}`, { cwd: this.projectRoot });
      
      // Return to original branch
      await execAsync(`git checkout ${originalBranch}`, { cwd: this.projectRoot });

      // Verify worktree was created successfully
      if (!fs.existsSync(worktreePath)) {
        throw new Error('Worktree directory was not created');
      }

      return {
        id: taskId,
        path: worktreePath,
        branch: branchName,
        baseBranch: baseBranch
      };
    } catch (error) {
      // Comprehensive cleanup on failure
      await this.cleanupFailedWorktree(worktreePath, branchName, originalBranch);
      throw new Error(`Failed to create worktree: ${(error as Error).message}`);
    }
  }

  private async cleanupFailedWorktree(worktreePath: string, branchName: string, originalBranch?: string): Promise<void> {
    const cleanupTasks = [];
    
    // Remove worktree directory if it exists
    if (fs.existsSync(worktreePath)) {
      cleanupTasks.push(
        execAsync(`git worktree remove "${worktreePath}" --force`, { cwd: this.projectRoot })
          .catch(() => {
            // If git worktree remove fails, try manual cleanup
            try {
              fs.rmSync(worktreePath, { recursive: true, force: true });
            } catch (rmError) {
              console.warn(`Failed to manually remove worktree directory: ${rmError}`);
            }
          })
      );
    }
    
    // Remove branch if it was created
    cleanupTasks.push(
      execAsync(`git branch -D ${branchName}`, { cwd: this.projectRoot })
        .catch(() => {}) // Ignore errors if branch doesn't exist
    );
    
    // Return to original branch if specified
    if (originalBranch) {
      cleanupTasks.push(
        execAsync(`git checkout ${originalBranch}`, { cwd: this.projectRoot })
          .catch(() => {}) // Ignore errors if checkout fails
      );
    }
    
    await Promise.allSettled(cleanupTasks);
  }

  private isValidBranchName(branchName: string): boolean {
    // Git branch naming rules
    if (!branchName || branchName.length === 0) return false;
    if (branchName.startsWith('.') || branchName.endsWith('.')) return false;
    if (branchName.startsWith('-') || branchName.endsWith('-')) return false;
    if (branchName.includes('..') || branchName.includes('//')) return false;
    if (branchName.includes(' ') || branchName.includes('\t')) return false;
    if (/[~^:?*\[\]\\]/.test(branchName)) return false;
    if (branchName.includes('@{')) return false;
    
    return true;
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

  /**
   * Scan workspace for code files with optional filtering
   */
  async scanCodeFiles(options: FileSearchOptions = {}): Promise<CodeFileInfo[]> {
    const defaults: FileSearchOptions = {
      includeTests: true,
      includeDocs: true,
      includeConfig: true,
      maxFileSize: 1024 * 1024, // 1MB
      extensions: ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rs', '.rb', '.php'],
      excludePaths: ['node_modules', '.git', 'dist', 'build', 'coverage', 'worktrees']
    };

    const opts = { ...defaults, ...options };
    const files: CodeFileInfo[] = [];

    try {
      await this.scanDirectory(this.projectRoot, this.projectRoot, files, opts);
      return files;
    } catch (error) {
      console.error('Failed to scan code files:', error);
      return [];
    }
  }

  /**
   * Get specific code files by paths
   */
  async getCodeFiles(filePaths: string[], includeContent: boolean = false): Promise<CodeFileInfo[]> {
    const files: CodeFileInfo[] = [];

    for (const filePath of filePaths) {
      try {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.projectRoot, filePath);
        const fileInfo = await this.fileAnalyzer.analyzeCodeFile(fullPath, this.projectRoot, includeContent);
        if (fileInfo) {
          files.push(fileInfo);
        }
      } catch (error) {
        console.warn(`Failed to analyze file ${filePath}:`, error);
      }
    }

    return files;
  }

  /**
   * Search for files matching a pattern or containing specific text
   */
  async searchFiles(pattern: string, options: FileSearchOptions = {}): Promise<CodeFileInfo[]> {
    const allFiles = await this.scanCodeFiles(options);
    
    const searchRegex = new RegExp(pattern, 'i');
    return allFiles.filter(file => 
      searchRegex.test(file.relativePath) || 
      searchRegex.test(path.basename(file.path))
    );
  }

  /**
   * Get recently modified files
   */
  async getRecentlyModifiedFiles(sinceHours: number = 24, options: FileSearchOptions = {}): Promise<CodeFileInfo[]> {
    const allFiles = await this.scanCodeFiles(options);
    const cutoffTime = new Date(Date.now() - (sinceHours * 60 * 60 * 1000));
    
    return allFiles
      .filter(file => file.lastModified > cutoffTime)
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }

  /**
   * Get files by language
   */
  async getFilesByLanguage(language: string, options: FileSearchOptions = {}): Promise<CodeFileInfo[]> {
    const allFiles = await this.scanCodeFiles(options);
    return allFiles.filter(file => file.language.toLowerCase() === language.toLowerCase());
  }

  /**
   * Read file content safely
   */
  async readFileContent(filePath: string): Promise<string | null> {
    return this.fileAnalyzer.readFileContent(filePath);
  }

  private async scanDirectory(
    dirPath: string, 
    rootPath: string, 
    files: CodeFileInfo[], 
    options: FileSearchOptions
  ): Promise<void> {
    try {
      const entries = await fsp.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(rootPath, fullPath);
        
        // Skip excluded paths
        if (options.excludePaths?.some(excluded => relativePath.includes(excluded))) {
          continue;
        }
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await this.scanDirectory(fullPath, rootPath, files, options);
        } else if (entry.isFile()) {
          const fileInfo = await this.fileAnalyzer.analyzeCodeFile(fullPath, rootPath, false);
          if (fileInfo && this.fileAnalyzer.shouldIncludeFile(fileInfo, options)) {
            files.push(fileInfo);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dirPath}:`, error);
    }
  }

}