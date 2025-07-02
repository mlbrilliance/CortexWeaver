import { PrototyperAgent } from '../../src/agents/prototyper-simple';
import { Agent } from '../../src/agent';
import { ClaudeClient, ClaudeModel } from '../../src/claude-client';
import { WorkspaceManager } from '../../src/workspace';
import { CognitiveCanvas } from '../../src/cognitive-canvas';
import { SessionManager } from '../../src/session';
import { PersonaLoader } from '../../src/persona';
import { MCPClient } from '../../src/mcp-client';

// Mock dependencies
jest.mock('../../src/claude-client');
jest.mock('../../src/workspace');
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/session');
jest.mock('../../src/persona');
jest.mock('../../src/mcp-client');
jest.mock('fs');

describe('PrototyperAgent', () => {
  let prototyperAgent: PrototyperAgent;
  let mockMCPClient: jest.Mocked<MCPClient>;
  let mockCanvas: jest.Mocked<CognitiveCanvas>;
  let mockPersonaLoader: jest.Mocked<PersonaLoader>;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockSessionManager: jest.Mocked<SessionManager>;


  beforeEach(async () => {
    // Create mock dependencies
    mockMCPClient = {
      createWorktree: jest.fn(),
      commitToWorktree: jest.fn(),
      writeFileToWorktree: jest.fn(),
      queryKnowledgeGraph: jest.fn(),
      updateKnowledgeGraph: jest.fn()
    } as any;

    mockCanvas = {
      getContract: jest.fn(),
      getArchitecturalPatterns: jest.fn(),
      getPheromonesByType: jest.fn(),
      createPrototypeNode: jest.fn(),
      linkPrototypeToContract: jest.fn()
    } as any;

    mockPersonaLoader = {
      loadPersona: jest.fn(),
      getPersonaPrompt: jest.fn()
    } as any;

    mockClaudeClient = {
      sendMessage: jest.fn()
    } as any;

    mockWorkspace = {
      writeFile: jest.fn(),
      readFile: jest.fn(),
      createFile: jest.fn(),
      exists: jest.fn()
    } as any;

    mockSessionManager = {
      createSession: jest.fn(),
      getSession: jest.fn()
    } as any;

    prototyperAgent = new PrototyperAgent(mockClaudeClient, mockCanvas, mockMCPClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct role and capabilities', () => {
      expect(prototyperAgent.role).toBe('Prototyper');
      expect(prototyperAgent.capabilities).toContain('pseudocode-generation');
      expect(prototyperAgent.capabilities).toContain('logic-flow-design');
      expect(prototyperAgent.capabilities).toContain('mermaid-diagrams');
    });

  });

  describe('processContract', () => {
    const mockContract = {
      id: 'contract-123',
      name: 'UserAuthentication',
      type: 'openapi' as const,
      version: '1.0.0',
      specification: {
        endpoints: [
          {
            path: '/api/auth/login',
            method: 'POST',
            parameters: { email: 'string', password: 'string' },
            responses: { 200: { token: 'string' }, 401: { error: 'string' } }
          }
        ]
      },
      description: 'User authentication contract',
      projectId: 'test-project',
      createdAt: '2024-01-01T00:00:00Z'
    };

    beforeEach(() => {
      mockCanvas.getContract.mockResolvedValue(mockContract);
      mockCanvas.getPheromonesByType.mockResolvedValue([
        {
          id: 'pheromone-1',
          type: 'guide_pheromone',
          strength: 0.9,
          context: 'input-validation',
          metadata: { confidence: 0.9 },
          createdAt: '2024-01-01T00:00:00Z',
          expiresAt: '2024-12-31T23:59:59Z'
        },
        {
          id: 'pheromone-2',
          type: 'guide_pheromone',
          strength: 0.8,
          context: 'jwt-token-generation',
          metadata: { confidence: 0.8 },
          createdAt: '2024-01-01T00:00:00Z',
          expiresAt: '2024-12-31T23:59:59Z'
        }
      ]);
    });

    it('should generate pseudocode for contract endpoints', async () => {
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: `
## Pseudocode for UserAuthentication Contract

### Function: authenticateUser(email, password)
1. BEGIN
2. VALIDATE input parameters
   - IF email is empty OR invalid format
     RETURN error "Invalid email format"
   - IF password is empty OR length < 8
     RETURN error "Password too short"
3. QUERY database for user by email
   - IF user not found
     RETURN error "User not found"
4. VERIFY password hash
   - IF password verification fails
     RETURN error "Invalid credentials"
5. GENERATE JWT token with user claims
6. RETURN success response with token
7. END

### Error Handling Paths:
- Input validation errors → 400 Bad Request
- Authentication failures → 401 Unauthorized
- Database errors → 500 Internal Server Error
        `,
        tokenUsage: { inputTokens: 150, outputTokens: 200, totalTokens: 350 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await prototyperAgent.processContract(mockContract.id);

      expect(result.success).toBe(true);
      expect(result.pseudocode).toContain('authenticateUser');
      expect(result.pseudocode).toContain('VALIDATE input parameters');
      expect(result.pseudocode).toContain('GENERATE JWT token');
      expect(mockCanvas.getContract).toHaveBeenCalledWith(mockContract.id);
      expect(mockCanvas.getPheromonesByType).toHaveBeenCalledWith('guide');
    });

    it('should create Mermaid flow diagram', async () => {
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: `
## Logic Flow Diagram

\`\`\`mermaid
flowchart TD
    A[Start: Login Request] --> B{Validate Input}
    B -->|Invalid| C[Return 400 Error]
    B -->|Valid| D[Query User Database]
    D -->|Not Found| E[Return 401 Error]
    D -->|Found| F{Verify Password}
    F -->|Invalid| G[Return 401 Error]
    F -->|Valid| H[Generate JWT Token]
    H --> I[Return Success Response]
    C --> J[End]
    E --> J
    G --> J
    I --> J
\`\`\`
        `,
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await prototyperAgent.processContract(mockContract.id);

      expect(result.success).toBe(true);
      expect(result.flowDiagram).toContain('flowchart TD');
      expect(result.flowDiagram).toContain('Login Request');
      expect(result.flowDiagram).toContain('Generate JWT Token');
    });

    it('should save prototype to /prototypes directory', async () => {
      mockMCPClient.writeFileToWorktree.mockResolvedValue(true);
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: 'Mock pseudocode content',
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await prototyperAgent.processContract(mockContract.id);

      expect(mockMCPClient.writeFileToWorktree).toHaveBeenCalledWith(
        expect.stringContaining('/prototypes/'),
        expect.stringContaining('UserAuthentication'),
        expect.stringContaining('pseudocode')
      );
      expect(result.outputPath).toContain('/prototypes/');
    });

    it('should create prototype node in Cognitive Canvas', async () => {
      mockCanvas.createPrototypeNode.mockResolvedValue('prototype-node-123');
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: 'Mock pseudocode content',
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });

      await prototyperAgent.processContract(mockContract.id);

      expect(mockCanvas.createPrototypeNode).toHaveBeenCalledWith({
        contractId: mockContract.id,
        pseudocode: expect.any(String),
        flowDiagram: expect.any(String),
        outputPath: expect.stringContaining('/prototypes/')
      });
    });

    it('should link prototype to contract in knowledge graph', async () => {
      mockCanvas.createPrototypeNode.mockResolvedValue('prototype-node-123');
      mockCanvas.linkPrototypeToContract.mockResolvedValue(undefined);
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: 'Mock pseudocode content',
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });

      await prototyperAgent.processContract(mockContract.id);

      expect(mockCanvas.linkPrototypeToContract).toHaveBeenCalledWith(
        'prototype-node-123',
        mockContract.id
      );
    });
  });

  describe('generatePseudocode', () => {
    it('should include all contract endpoints in pseudocode', async () => {
      const contract = {
        specification: {
          endpoints: [
            { path: '/api/users', method: 'GET' },
            { path: '/api/users', method: 'POST' },
            { path: '/api/users/:id', method: 'PUT' }
          ]
        }
      };

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: 'Function: getUsers\nFunction: createUser\nFunction: updateUser',
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await prototyperAgent.generatePseudocode(contract);

      expect(result).toContain('getUsers');
      expect(result).toContain('createUser');
      expect(result).toContain('updateUser');
    });

    it('should incorporate guide pheromones into pseudocode', async () => {
      const contract = { specification: { endpoints: [] } };
      const pheromones = [
        {
          id: 'pheromone-1',
          type: 'guide_pheromone',
          strength: 0.9,
          context: 'error-handling-best-practices',
          metadata: {},
          createdAt: '2024-01-01T00:00:00Z',
          expiresAt: '2024-12-31T23:59:59Z'
        },
        {
          id: 'pheromone-2',
          type: 'guide_pheromone',
          strength: 0.8,
          context: 'input-sanitization',
          metadata: {},
          createdAt: '2024-01-01T00:00:00Z',
          expiresAt: '2024-12-31T23:59:59Z'
        }
      ];

      mockClaudeClient.sendMessage.mockImplementation((prompt: any) => {
        expect(prompt).toContain('error-handling-best-practices');
        expect(prompt).toContain('input-sanitization');
        return Promise.resolve({
          content: 'Pseudocode with error handling and input sanitization',
          tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
          model: 'claude-3-sonnet-20240229'
        });
      });

      await prototyperAgent.generatePseudocode(contract, pheromones);

      expect(mockClaudeClient.sendMessage).toHaveBeenCalled();
    });
  });

  describe('generateFlowDiagram', () => {
    it('should create valid Mermaid syntax', async () => {
      const pseudocode = `
        Function: processPayment
        1. Validate payment data
        2. Check account balance
        3. Process transaction
        4. Update account
      `;

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: `
\`\`\`mermaid
flowchart TD
    A[Validate Payment Data] --> B{Check Balance}
    B -->|Insufficient| C[Return Error]
    B -->|Sufficient| D[Process Transaction]
    D --> E[Update Account]
\`\`\`
        `,
        tokenUsage: { inputTokens: 80, outputTokens: 120, totalTokens: 200 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await prototyperAgent.generateFlowDiagram(pseudocode);

      expect(result).toContain('```mermaid');
      expect(result).toContain('flowchart TD');
      expect(result).toContain('```');
      expect(result).toContain('Validate Payment Data');
    });

    it('should handle complex branching logic', async () => {
      const pseudocode = `
        Function: complexBranching
        IF condition1 THEN action1
        ELSE IF condition2 THEN action2
        ELSE action3
      `;

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: 'Mermaid diagram with complex branching',
        tokenUsage: { inputTokens: 60, outputTokens: 100, totalTokens: 160 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await prototyperAgent.generateFlowDiagram(pseudocode);

      expect(result).toBeDefined();
      expect(mockClaudeClient.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('complexBranching')
      );
    });
  });

  describe('error handling', () => {
    it('should handle contract not found', async () => {
      mockCanvas.getContract.mockResolvedValue(null);

      const result = await prototyperAgent.processContract('nonexistent-contract');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Contract not found');
    });

    it('should handle Claude API failures', async () => {
      mockCanvas.getContract.mockResolvedValue({
        id: 'test',
        name: 'TestContract',
        type: 'openapi',
        version: '1.0.0',
        specification: {},
        projectId: 'test-project',
        createdAt: '2024-01-01T00:00:00Z'
      });
      mockClaudeClient.sendMessage.mockRejectedValue(new Error('API Error'));

      const result = await prototyperAgent.processContract('test-contract');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to generate pseudocode');
    });

    it('should handle file system write failures', async () => {
      mockCanvas.getContract.mockResolvedValue({
        id: 'test',
        name: 'TestContract',
        type: 'openapi',
        version: '1.0.0',
        specification: {},
        projectId: 'test-project',
        createdAt: '2024-01-01T00:00:00Z'
      });
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: 'test content',
        tokenUsage: { inputTokens: 50, outputTokens: 75, totalTokens: 125 },
        model: 'claude-3-sonnet-20240229'
      });
      mockMCPClient.writeFileToWorktree.mockRejectedValue(new Error('Write failed'));

      const result = await prototyperAgent.processContract('test-contract');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Write failed');
    });
  });

  describe('integration with other agents', () => {
    it('should prepare output for Architect agent consumption', async () => {
      mockCanvas.getContract.mockResolvedValue({
        id: 'test-contract',
        name: 'TestContract',
        type: 'openapi',
        version: '1.0.0',
        specification: { endpoints: [] },
        projectId: 'test-project',
        createdAt: '2024-01-01T00:00:00Z'
      });
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: 'Detailed pseudocode for architect',
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await prototyperAgent.processContract('test-contract');

      expect(result.architectureReady).toBe(true);
      expect(result.metadata).toHaveProperty('contractId');
      expect(result.metadata).toHaveProperty('complexity');
      expect(result.metadata).toHaveProperty('dependencies');
    });

    it('should provide context for Coder agent', async () => {
      mockCanvas.getContract.mockResolvedValue({
        id: 'test-contract',
        name: 'TestContract',
        type: 'openapi',
        version: '1.0.0',
        specification: { endpoints: [] },
        projectId: 'test-project',
        createdAt: '2024-01-01T00:00:00Z'
      });
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: 'Implementation-ready pseudocode',
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await prototyperAgent.processContract('test-contract');

      expect(result.implementationNotes).toBeDefined();
      expect(result.implementationNotes).toContain('pseudocode');
    });
  });

  describe('performance and optimization', () => {

    it('should track token usage for budget management', async () => {
      mockCanvas.getContract.mockResolvedValue({
        id: 'test-contract',
        name: 'TestContract',
        type: 'openapi',
        version: '1.0.0',
        specification: { endpoints: [] },
        projectId: 'test-project',
        createdAt: '2024-01-01T00:00:00Z'
      });
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: 'Test content',
        tokenUsage: { inputTokens: 200, outputTokens: 300, totalTokens: 500 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await prototyperAgent.processContract('test-contract');

      expect(result.tokenUsage).toEqual({
        input_tokens: 400,
        output_tokens: 600,
        total_tokens: 1000
      });
    });

    it('should complete within reasonable time limits', async () => {
      mockCanvas.getContract.mockResolvedValue({
        id: 'test-contract',
        name: 'TestContract',
        type: 'openapi',
        version: '1.0.0',
        specification: { endpoints: [] },
        projectId: 'test-project',
        createdAt: '2024-01-01T00:00:00Z'
      });
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: 'Quick response',
        tokenUsage: { inputTokens: 50, outputTokens: 75, totalTokens: 125 },
        model: 'claude-3-sonnet-20240229'
      });

      const startTime = Date.now();
      await prototyperAgent.processContract('test-contract');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
    });
  });
});