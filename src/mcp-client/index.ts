import { MCPClientOperations } from './client-operations';
import { CLITemplates } from '../templates';

export interface Neo4jQueryResult {
  records: any[];
  summary: any;
}

export interface ProjectNodeData {
  name: string;
  description: string;
  [key: string]: any;
}

export interface ProjectNode {
  nodeId: string;
  [key: string]: any;
}

export interface WorktreeResult {
  path: string;
  branch: string;
}

export interface CommitResult {
  commitHash: string;
  message: string;
}

export interface MCPClientConfig {
  neo4j?: {
    uri: string;
    username: string;
    password: string;
    mcpServerUrl?: string;
  };
  github?: {
    token: string;
    mcpServerUrl?: string;
  };
}

/**
 * MCPClient provides a unified interface for interacting with MCP (Model Context Protocol) servers
 * for Neo4j and GitHub operations, with support for agent diagnostics and knowledge management
 */
export class MCPClient {
  private operations: MCPClientOperations;

  constructor(config: MCPClientConfig = {}) {
    // Initialize configuration with environment variables if not provided
    const finalConfig = this.initializeConfig(config);
    this.operations = new MCPClientOperations(finalConfig);
  }

  /**
   * Create MCPClient from .mcp.json configuration file
   */
  static async fromProjectConfig(projectRoot: string): Promise<MCPClient> {
    try {
      const mcpConfig = await CLITemplates.getMCPConfig(projectRoot);
      
      // Extract MCP server configurations
      const config: MCPClientConfig = {};
      
      if (mcpConfig.mcpServers && mcpConfig.mcpServers['neo4j-memory']) {
        const neo4jServer = mcpConfig.mcpServers['neo4j-memory'];
        config.neo4j = {
          uri: neo4jServer.env?.NEO4J_URI || 'bolt://localhost:7687',
          username: neo4jServer.env?.NEO4J_USERNAME || 'neo4j',
          password: neo4jServer.env?.NEO4J_PASSWORD || 'cortexweaver',
        };
      }
      
      if (mcpConfig.mcpServers && mcpConfig.mcpServers['github']) {
        const githubServer = mcpConfig.mcpServers['github'];
        config.github = {
          token: process.env.GITHUB_TOKEN || githubServer.env?.GITHUB_PERSONAL_ACCESS_TOKEN || '',
        };
      }
      
      return new MCPClient(config);
    } catch (error) {
      console.warn(`Warning: Could not load .mcp.json configuration: ${(error as Error).message}`);
      console.warn('Falling back to environment variables and defaults.');
      return new MCPClient();
    }
  }

  /**
   * Initialize configuration with environment variables fallback
   */
  private initializeConfig(config: MCPClientConfig): MCPClientConfig {
    const finalConfig = { ...config };

    if (!finalConfig.neo4j && process.env.NEO4J_URI) {
      finalConfig.neo4j = {
        uri: process.env.NEO4J_URI,
        username: process.env.NEO4J_USERNAME || 'neo4j',
        password: process.env.NEO4J_PASSWORD || '',
        mcpServerUrl: process.env.MCP_NEO4J_SERVER_URL
      };
    }
    
    if (!finalConfig.github && process.env.GITHUB_TOKEN) {
      finalConfig.github = {
        token: process.env.GITHUB_TOKEN,
        mcpServerUrl: process.env.MCP_GITHUB_SERVER_URL
      };
    }

    return finalConfig;
  }

  // Core connection methods
  async connectToNeo4j(): Promise<boolean> {
    return this.operations.connectToNeo4j();
  }

  async connectToGitHub(): Promise<boolean> {
    return this.operations.connectToGitHub();
  }

  async disconnect(): Promise<void> {
    return this.operations.disconnect();
  }

  async healthCheck(): Promise<{ neo4j: boolean; github: boolean }> {
    return this.operations.healthCheck();
  }

  // State query methods
  isConnected(): boolean {
    return this.operations.isConnected();
  }

  isNeo4jConnected(): boolean {
    return this.operations.isNeo4jConnected();
  }

  isGitHubConnected(): boolean {
    return this.operations.isGitHubConnected();
  }

  // Configuration methods
  updateConfig(config: Partial<MCPClientConfig>): void {
    return this.operations.updateConfig(config);
  }

  getConfig(): MCPClientConfig {
    return this.operations.getConfig();
  }

  // Neo4j operations
  async executeCypherQuery(query: string, parameters?: { [key: string]: any }): Promise<Neo4jQueryResult> {
    return this.operations.executeCypherQuery(query, parameters);
  }

  async createProjectNode(projectData: ProjectNodeData): Promise<ProjectNode> {
    return this.operations.createProjectNode(projectData);
  }

  async createTaskNode(taskData: any): Promise<any> {
    return this.operations.createTaskNode(taskData);
  }

  async linkTaskToProject(taskId: string, projectId: string): Promise<void> {
    return this.operations.linkTaskToProject(taskId, projectId);
  }

  // GitHub operations
  async createWorktree(branchName: string, baseBranch: string = 'main'): Promise<WorktreeResult> {
    return this.operations.createWorktree(branchName, baseBranch);
  }

  async writeFileToWorktree(filePath: string, fileName: string, content: string): Promise<boolean> {
    return this.operations.writeFileToWorktree(filePath, fileName, content);
  }

  async commitToWorktree(worktreePath: string, message: string, files: string[]): Promise<CommitResult> {
    return this.operations.commitToWorktree(worktreePath, message, files);
  }

  async mergeWorktree(branchName: string, targetBranch: string = 'main'): Promise<void> {
    return this.operations.mergeWorktree(branchName, targetBranch);
  }

  async removeWorktree(worktreePath: string): Promise<void> {
    return this.operations.removeWorktree(worktreePath);
  }

  // Agent support methods
  async scanWorktreeForChanges(projectId?: string): Promise<Array<{
    path: string;
    type: 'contract' | 'prototype' | 'code' | 'test';
    lastModified: string;
  }>> {
    return this.operations.scanWorktreeForChanges(projectId);
  }

  async analyzeLogs(projectId?: string): Promise<{
    errorPatterns: string[];
    frequency: Record<string, number>;
    timeline: string;
  }> {
    return this.operations.analyzeLogs(projectId);
  }

  async getStackTrace(errorId: string): Promise<{
    stackTrace: string;
    sourceMap?: string;
    context: string[];
  }> {
    return this.operations.getStackTrace(errorId);
  }

  async getSystemMetrics(): Promise<{
    memory: { usage: string; available?: string; trend?: string };
    cpu: { usage: string; load?: number; trend?: string };
    disk?: { usage: string; iops?: string };
    network?: { bandwidth?: string; latency?: string; packetLoss?: string; errors?: number };
    database?: { connections?: number; maxConnections?: number; status?: string };
  }> {
    return this.operations.getSystemMetrics();
  }

  async runDiagnosticCommands(commands: string[]): Promise<{
    results: Array<{
      command: string;
      output: string;
      exitCode: number;
      duration: number;
    }>;
  }> {
    return this.operations.runDiagnosticCommands(commands);
  }

  async getEnvironmentInfo(): Promise<{
    nodeVersion: string;
    npmVersion: string;
    osVersion: string;
    dockerVersion?: string;
    dependencies: Record<string, string>;
  }> {
    return this.operations.getEnvironmentInfo();
  }

  async captureErrorContext(errorId: string): Promise<{
    timestamp: string;
    environment: Record<string, any>;
    processState: Record<string, any>;
    memorySnapshot: Record<string, any>;
  }> {
    return this.operations.captureErrorContext(errorId);
  }

  async commitKnowledgeUpdates(projectId: string, updates: {
    knowledgeNodes: string[];
    pheromoneChanges: string[];
    summary: string;
  }): Promise<{
    success: boolean;
    commitHash?: string;
    message?: string;
  }> {
    return this.operations.commitKnowledgeUpdates(projectId, updates);
  }
}

// Re-export types for backward compatibility
export * from './client-operations';
export * from './diagnostic-operations';