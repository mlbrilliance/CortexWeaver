import { MCPClient } from '../src/mcp-client';

describe('MCPClient', () => {
  let mcpClient: MCPClient;

  beforeEach(() => {
    mcpClient = new MCPClient();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(mcpClient).toBeDefined();
      expect(mcpClient.isConnected()).toBe(false);
    });
  });

  describe('Neo4j Memory Server', () => {
    it('should connect to Neo4j memory server', async () => {
      // Mock connection for testing
      const mockConnect = jest.spyOn(mcpClient, 'connectToNeo4j');
      mockConnect.mockResolvedValue(true);

      const result = await mcpClient.connectToNeo4j();
      expect(result).toBe(true);
      expect(mockConnect).toHaveBeenCalled();
    });

    it('should execute Cypher queries', async () => {
      const mockQuery = jest.spyOn(mcpClient, 'executeCypherQuery');
      const expectedResult = { records: [], summary: {} };
      mockQuery.mockResolvedValue(expectedResult);

      const query = 'MATCH (n) RETURN n LIMIT 10';
      const result = await mcpClient.executeCypherQuery(query);
      
      expect(result).toEqual(expectedResult);
      expect(mockQuery).toHaveBeenCalledWith(query);
    });

    it('should create project nodes in graph', async () => {
      const mockCreateNode = jest.spyOn(mcpClient, 'createProjectNode');
      mockCreateNode.mockResolvedValue({ nodeId: 'project-123' });

      const projectData = {
        name: 'test-project',
        description: 'Test project description'
      };

      const result = await mcpClient.createProjectNode(projectData);
      expect(result.nodeId).toBe('project-123');
      expect(mockCreateNode).toHaveBeenCalledWith(projectData);
    });
  });

  describe('GitHub MCP Server', () => {
    it('should connect to GitHub MCP server', async () => {
      const mockConnect = jest.spyOn(mcpClient, 'connectToGitHub');
      mockConnect.mockResolvedValue(true);

      const result = await mcpClient.connectToGitHub();
      expect(result).toBe(true);
      expect(mockConnect).toHaveBeenCalled();
    });

    it('should create git worktree', async () => {
      const mockCreateWorktree = jest.spyOn(mcpClient, 'createWorktree');
      mockCreateWorktree.mockResolvedValue({ path: '/path/to/worktree', branch: 'feature-branch' });

      const result = await mcpClient.createWorktree('feature-branch', 'main');
      expect(result.path).toBe('/path/to/worktree');
      expect(result.branch).toBe('feature-branch');
      expect(mockCreateWorktree).toHaveBeenCalledWith('feature-branch', 'main');
    });

    it('should commit changes to worktree', async () => {
      const mockCommit = jest.spyOn(mcpClient, 'commitToWorktree');
      mockCommit.mockResolvedValue({ commitHash: 'abc123', message: 'Test commit' });

      const result = await mcpClient.commitToWorktree('/path/to/worktree', 'Test commit', ['file1.ts']);
      expect(result.commitHash).toBe('abc123');
      expect(result.message).toBe('Test commit');
      expect(mockCommit).toHaveBeenCalledWith('/path/to/worktree', 'Test commit', ['file1.ts']);
    });
  });

  describe('error handling', () => {
    it('should handle connection failures gracefully', async () => {
      const mockConnect = jest.spyOn(mcpClient, 'connectToNeo4j');
      mockConnect.mockRejectedValue(new Error('Connection failed'));

      await expect(mcpClient.connectToNeo4j()).rejects.toThrow('Connection failed');
    });

    it('should handle malformed Cypher queries', async () => {
      const mockQuery = jest.spyOn(mcpClient, 'executeCypherQuery');
      mockQuery.mockRejectedValue(new Error('Invalid query syntax'));

      const invalidQuery = 'INVALID CYPHER QUERY';
      await expect(mcpClient.executeCypherQuery(invalidQuery)).rejects.toThrow('Invalid query syntax');
    });
  });
});