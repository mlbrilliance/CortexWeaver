import { WorkspaceOperations } from './workspace-operations';

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

export interface CodeFileInfo {
  path: string;
  relativePath: string;
  type: 'source' | 'test' | 'config' | 'documentation';
  language: string;
  size: number;
  lastModified: Date;
  content?: string;
}

export interface FileSearchOptions {
  includeTests?: boolean;
  includeDocs?: boolean;
  includeConfig?: boolean;
  maxFileSize?: number;
  extensions?: string[];
  excludePaths?: string[];
}

/**
 * WorkspaceManager handles project workspace operations including git worktrees,
 * code file scanning, and workspace management
 */
export class WorkspaceManager {
  private projectRoot: string;
  private operations: WorkspaceOperations;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.operations = new WorkspaceOperations(projectRoot);
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  getWorktreePath(taskId: string): string {
    return this.operations.getWorktreePath(taskId);
  }

  // Worktree management
  async createWorktree(taskId: string, branchName: string, baseBranch: string = 'main'): Promise<WorktreeInfo> {
    return this.operations.createWorktree(taskId, branchName, baseBranch);
  }

  async removeWorktree(taskId: string): Promise<boolean> {
    return this.operations.removeWorktree(taskId);
  }

  async listWorktrees(): Promise<WorktreeInfo[]> {
    return this.operations.listWorktrees();
  }

  async executeCommand(taskId: string, command: string): Promise<CommandResult> {
    return this.operations.executeCommand(taskId, command);
  }

  async commitChanges(taskId: string, message: string, files?: string[]): Promise<string> {
    return this.operations.commitChanges(taskId, message, files);
  }

  async mergeToBranch(taskId: string, targetBranch: string = 'main'): Promise<void> {
    return this.operations.mergeToBranch(taskId, targetBranch);
  }

  async getWorktreeStatus(taskId: string): Promise<{ clean: boolean; files: string[] }> {
    return this.operations.getWorktreeStatus(taskId);
  }

  // Code file operations
  async scanCodeFiles(options: FileSearchOptions = {}): Promise<CodeFileInfo[]> {
    return this.operations.scanCodeFiles(options);
  }

  async getCodeFiles(filePaths: string[], includeContent: boolean = false): Promise<CodeFileInfo[]> {
    return this.operations.getCodeFiles(filePaths, includeContent);
  }

  async searchFiles(pattern: string, options: FileSearchOptions = {}): Promise<CodeFileInfo[]> {
    return this.operations.searchFiles(pattern, options);
  }

  async getRecentlyModifiedFiles(sinceHours: number = 24, options: FileSearchOptions = {}): Promise<CodeFileInfo[]> {
    return this.operations.getRecentlyModifiedFiles(sinceHours, options);
  }

  async getFilesByLanguage(language: string, options: FileSearchOptions = {}): Promise<CodeFileInfo[]> {
    return this.operations.getFilesByLanguage(language, options);
  }

  async readFileContent(filePath: string): Promise<string | null> {
    return this.operations.readFileContent(filePath);
  }
}

// Re-export operations for testing and extensibility
export { WorkspaceOperations };
export { FileAnalyzer } from './file-analyzer';