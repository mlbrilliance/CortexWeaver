import { CoderAgent } from '../../src/agents/coder';
import { Agent } from '../../src/agent';
import { ClaudeClient, ClaudeModel } from '../../src/claude-client';
import { WorkspaceManager } from '../../src/workspace';
import { CognitiveCanvas } from '../../src/cognitive-canvas';
import { SessionManager } from '../../src/session';

// Mock dependencies
jest.mock('../../src/claude-client');
jest.mock('../../src/workspace');
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/session');
jest.mock('fs');

describe('CoderAgent', () => {
  let coderAgent: CoderAgent;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockCognitiveCanvas: jest.Mocked<CognitiveCanvas>;
  let mockSessionManager: jest.Mocked<SessionManager>;

  const mockConfig = {
    id: 'coder-agent-1',
    role: 'coder',
    capabilities: ['coding', 'testing', 'git-management'],
    claudeConfig: {
      apiKey: 'test-api-key',
      defaultModel: ClaudeModel.SONNET
    },
    workspaceRoot: '/test/workspace',
    cognitiveCanvasConfig: {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'test'
    }
  };

  const mockTask = {
    id: 'task-1',
    title: 'Implement user authentication',
    description: 'Create a secure user authentication system with login and registration',
    status: 'pending',
    priority: 'high',
    projectId: 'project-1',
    createdAt: new Date().toISOString()
  };

  const mockTaskContext = {
    projectInfo: { 
      name: 'TestProject',
      language: 'typescript',
      framework: 'node'
    },
    dependencies: ['express', 'bcrypt', 'jsonwebtoken'],
    files: ['src/auth.ts', 'tests/auth.test.ts']
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Claude client
    mockClaudeClient = {
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Generated code implementation',
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      }),
      getConfiguration: jest.fn(),
      updateConfiguration: jest.fn(),
      sendMessageStream: jest.fn(),
      getTokenUsage: jest.fn(),
      resetTokenUsage: jest.fn(),
      setDefaultModel: jest.fn(),
      getAvailableModels: jest.fn()
    } as any;
    (ClaudeClient as jest.MockedClass<typeof ClaudeClient>).mockImplementation(() => mockClaudeClient);

    // Mock workspace
    mockWorkspace = {
      executeCommand: jest.fn().mockResolvedValue({
        stdout: 'Tests passed successfully',
        stderr: '',
        exitCode: 0
      }),
      getWorktreePath: jest.fn().mockReturnValue('/test/workspace/task-1'),
      commitChanges: jest.fn().mockResolvedValue({
        commitHash: 'abc123',
        message: 'feat: implement user authentication'
      }),
      getProjectRoot: jest.fn(),
      createWorktree: jest.fn(),
      removeWorktree: jest.fn(),
      listWorktrees: jest.fn(),
      mergeToBranch: jest.fn(),
      getWorktreeStatus: jest.fn()
    } as any;
    (WorkspaceManager as jest.MockedClass<typeof WorkspaceManager>).mockImplementation(() => mockWorkspace);

    // Mock cognitive canvas
    mockCognitiveCanvas = {
      createPheromone: jest.fn().mockResolvedValue({
        id: 'pheromone-1',
        type: 'progress',
        strength: 0.8
      }),
      getPheromonesByType: jest.fn().mockResolvedValue([{
        id: 'standards-1',
        type: 'coding_standards',
        strength: 0.8,
        context: 'project_standards',
        metadata: {
          language: 'typescript',
          standards: {
            indentation: 2,
            quotes: 'single',
            semicolons: true
          }
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }]),
      initializeSchema: jest.fn(),
      createProject: jest.fn(),
      getProject: jest.fn(),
      updateProjectStatus: jest.fn(),
      createTask: jest.fn(),
      createTaskDependency: jest.fn(),
      getTasksByProject: jest.fn(),
      getTaskDependencies: jest.fn(),
      createAgent: jest.fn(),
      assignAgentToTask: jest.fn(),
      getAgentAssignments: jest.fn(),
      linkPheromoneToTask: jest.fn(),
      cleanExpiredPheromones: jest.fn(),
      storeArchitecturalDecision: jest.fn(),
      getArchitecturalDecisionsByProject: jest.fn(),
      getProjectKnowledgeGraph: jest.fn(),
      findSimilarTasks: jest.fn(),
      close: jest.fn()
    } as any;
    (CognitiveCanvas as jest.MockedClass<typeof CognitiveCanvas>).mockImplementation(() => mockCognitiveCanvas);

    // Mock session manager
    mockSessionManager = {
      createSession: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        taskId: 'task-1',
        status: 'running',
        createdAt: new Date()
      }),
      runCommandInSession: jest.fn(),
      attachToSession: jest.fn(),
      killSession: jest.fn(),
      listSessions: jest.fn(),
      getSessionStatus: jest.fn(),
      listActiveTmuxSessions: jest.fn(),
      startAgentInSession: jest.fn(),
      monitorSession: jest.fn(),
      getSessionOutput: jest.fn(),
      cleanupDeadSessions: jest.fn()
    } as any;
    (SessionManager as jest.MockedClass<typeof SessionManager>).mockImplementation(() => mockSessionManager);

    // Mock filesystem
    const fs = require('fs');
    fs.readFileSync = jest.fn().mockReturnValue('existing code content');
    fs.writeFileSync = jest.fn();
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();

    coderAgent = new CoderAgent();
  });

  describe('Initialization', () => {
    it('should extend Agent class', () => {
      expect(coderAgent).toBeInstanceOf(Agent);
    });

    it('should initialize with coder-specific configuration', async () => {
      await coderAgent.initialize(mockConfig);
      expect(coderAgent.getId()).toBe('coder-agent-1');
      expect(coderAgent.getRole()).toBe('coder');
      expect(coderAgent.getCapabilities()).toEqual(['coding', 'testing', 'git-management']);
    });
  });

  describe('Prompt Template', () => {
    it('should provide coding-specific prompt template', () => {
      const template = coderAgent.getPromptTemplate();
      expect(template).toContain('{{taskDescription}}');
      expect(template).toContain('{{language}}');
      expect(template).toContain('{{framework}}');
      expect(template).toContain('coding standards');
      expect(template).toContain('unit tests');
    });

    it('should format prompt with task context', async () => {
      await coderAgent.initialize(mockConfig);
      await coderAgent.receiveTask(mockTask, mockTaskContext);

      const template = coderAgent.getPromptTemplate();
      const formatted = coderAgent.formatPrompt(template, {
        taskDescription: mockTask.description,
        language: mockTaskContext.projectInfo.language,
        framework: mockTaskContext.projectInfo.framework
      });

      expect(formatted).toContain('user authentication system');
      expect(formatted).toContain('typescript');
      expect(formatted).toContain('node');
    });
  });

  describe('Code Implementation', () => {
    beforeEach(async () => {
      await coderAgent.initialize(mockConfig);
      await coderAgent.receiveTask(mockTask, mockTaskContext);
    });

    it('should implement coding task successfully', async () => {
      mockClaudeClient.sendMessage.mockResolvedValueOnce({
        content: `
// Implementation code
export class AuthService {
  async login(email: string, password: string) {
    // Authentication logic
    return { success: true, token: 'jwt-token' };
  }
}`,
        tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await coderAgent.run();

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('codeGenerated', true);
      expect(result.result).toHaveProperty('testsGenerated', true);
      expect(result.result).toHaveProperty('commitCreated', true);
    });

    it('should generate unit tests for implemented code', async () => {
      mockClaudeClient.sendMessage
        .mockResolvedValueOnce({
          content: 'Implementation code',
          tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
          model: 'claude-3-sonnet-20240229'
        })
        .mockResolvedValueOnce({
          content: `
describe('AuthService', () => {
  it('should authenticate user successfully', () => {
    expect(true).toBe(true);
  });
});`,
          tokenUsage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
          model: 'claude-3-sonnet-20240229'
        });

      const result = await coderAgent.run();

      expect(mockClaudeClient.sendMessage).toHaveBeenCalledTimes(2);
      expect(result.result.testsGenerated).toBe(true);
    });

    it('should commit changes with descriptive message', async () => {
      const result = await coderAgent.run();

      expect(mockWorkspace.commitChanges).toHaveBeenCalledWith(
        mockTask.id,
        expect.stringContaining('feat:')
      );
      expect(result.result.commitCreated).toBe(true);
    });

    it('should query Cognitive Canvas for coding standards', async () => {
      await coderAgent.run();

      expect(mockCognitiveCanvas.getPheromonesByType).toHaveBeenCalledWith(
        'coding_standards'
      );
    });
  });

  describe('Compilation and Testing', () => {
    beforeEach(async () => {
      await coderAgent.initialize(mockConfig);
      await coderAgent.receiveTask(mockTask, mockTaskContext);
    });

    it('should handle successful compilation and tests', async () => {
      mockWorkspace.executeCommand
        .mockResolvedValueOnce({ stdout: 'Compilation successful', stderr: '', exitCode: 0 }) // compile
        .mockResolvedValueOnce({ stdout: 'All tests passed', stderr: '', exitCode: 0 }); // test

      const result = await coderAgent.run();

      expect(result.success).toBe(true);
      expect(mockWorkspace.executeCommand).toHaveBeenCalledWith(mockTask.id, expect.stringMatching(/compile|build/));
      expect(mockWorkspace.executeCommand).toHaveBeenCalledWith(mockTask.id, expect.stringMatching(/test/));
    });

    it('should handle compilation failure on first attempt', async () => {
      mockWorkspace.executeCommand
        .mockResolvedValueOnce({ stdout: '', stderr: 'Compilation error: missing semicolon', exitCode: 1 }) // first compile fails
        .mockResolvedValueOnce({ stdout: 'Compilation successful', stderr: '', exitCode: 0 }) // second compile succeeds
        .mockResolvedValueOnce({ stdout: 'All tests passed', stderr: '', exitCode: 0 }); // test

      mockClaudeClient.sendMessage
        .mockResolvedValueOnce({ content: 'Initial code', tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 }, model: 'claude-3-sonnet-20240229' })
        .mockResolvedValueOnce({ content: 'Fixed code with semicolon', tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 }, model: 'claude-3-sonnet-20240229' })
        .mockResolvedValueOnce({ content: 'Test code', tokenUsage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 }, model: 'claude-3-sonnet-20240229' });

      const result = await coderAgent.run();

      expect(result.success).toBe(true);
      expect(mockClaudeClient.sendMessage).toHaveBeenCalledTimes(3);
    });

    it('should handle test failure on first attempt', async () => {
      mockWorkspace.executeCommand
        .mockResolvedValueOnce({ stdout: 'Compilation successful', stderr: '', exitCode: 0 }) // compile
        .mockResolvedValueOnce({ stdout: '', stderr: 'Test failed: expected true but got false', exitCode: 1 }) // first test fails
        .mockResolvedValueOnce({ stdout: 'All tests passed', stderr: '', exitCode: 0 }); // second test succeeds

      mockClaudeClient.sendMessage
        .mockResolvedValueOnce({ content: 'Initial code', tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 }, model: 'claude-3-sonnet-20240229' })
        .mockResolvedValueOnce({ content: 'Initial tests', tokenUsage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 }, model: 'claude-3-sonnet-20240229' })
        .mockResolvedValueOnce({ content: 'Fixed tests', tokenUsage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 }, model: 'claude-3-sonnet-20240229' });

      const result = await coderAgent.run();

      expect(result.success).toBe(true);
      expect(mockClaudeClient.sendMessage).toHaveBeenCalledTimes(3);
    });
  });

  describe('Impasse Detection', () => {
    beforeEach(async () => {
      await coderAgent.initialize(mockConfig);
      await coderAgent.receiveTask(mockTask, mockTaskContext);
    });

    it('should detect impasse after 2 failed compilation attempts', async () => {
      mockWorkspace.executeCommand
        .mockResolvedValue({ stdout: '', stderr: 'Compilation error: syntax error', exitCode: 1 }); // always fail compilation

      mockClaudeClient.sendMessage
        .mockResolvedValueOnce({ content: 'Initial buggy code', tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 }, model: 'claude-3-sonnet-20240229' })
        .mockResolvedValueOnce({ content: 'Still buggy code attempt 1', tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 }, model: 'claude-3-sonnet-20240229' })
        .mockResolvedValueOnce({ content: 'Still buggy code attempt 2', tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 }, model: 'claude-3-sonnet-20240229' });

      await expect(coderAgent.run()).rejects.toThrow('IMPASSE');

      const impasseCalls = mockCognitiveCanvas.createPheromone.mock.calls.filter(call => 
        call[0].type === 'impasse'
      );
      expect(impasseCalls).toHaveLength(1);
      const impasseCall = impasseCalls[0][0];
      expect(impasseCall.type).toBe('impasse');
      expect(impasseCall.context).toBe('agent_impasse');
      expect(impasseCall.metadata.reason).toContain('Code compilation failed after 2 attempts');
      expect(impasseCall.metadata.additionalContext.failureType).toBe('compilation');
      expect(impasseCall.metadata.additionalContext.attemptCount).toBe(2);
      expect(impasseCall.metadata.additionalContext.lastError).toBe('Compilation error: syntax error');
    });

    it('should detect impasse after 2 failed test attempts', async () => {
      mockWorkspace.executeCommand
        .mockResolvedValueOnce({ stdout: 'Compilation successful', stderr: '', exitCode: 0 }) // compile succeeds
        .mockResolvedValue({ stdout: '', stderr: 'Test failed: assertion error', exitCode: 1 }); // tests always fail

      mockClaudeClient.sendMessage
        .mockResolvedValueOnce({ content: 'Working code', tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 }, model: 'claude-3-sonnet-20240229' })
        .mockResolvedValueOnce({ content: 'Failing tests attempt 1', tokenUsage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 }, model: 'claude-3-sonnet-20240229' })
        .mockResolvedValueOnce({ content: 'Failing tests attempt 2', tokenUsage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 }, model: 'claude-3-sonnet-20240229' });

      await expect(coderAgent.run()).rejects.toThrow('IMPASSE');

      const impasseCalls = mockCognitiveCanvas.createPheromone.mock.calls.filter(call => 
        call[0].type === 'impasse'
      );
      expect(impasseCalls).toHaveLength(1);
      const impasseCall = impasseCalls[0][0];
      expect(impasseCall.type).toBe('impasse');
      expect(impasseCall.context).toBe('agent_impasse');
      expect(impasseCall.metadata.reason).toContain('Tests failed after 2 attempts');
      expect(impasseCall.metadata.additionalContext.failureType).toBe('testing');
      expect(impasseCall.metadata.additionalContext.attemptCount).toBe(2);
      expect(impasseCall.metadata.additionalContext.lastError).toBe('Test failed: assertion error');
    });

    it('should NOT attempt a third time after impasse detection', async () => {
      mockWorkspace.executeCommand
        .mockResolvedValue({ stdout: '', stderr: 'Persistent error', exitCode: 1 });

      mockClaudeClient.sendMessage
        .mockResolvedValue({ content: 'Code attempt', tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 }, model: 'claude-3-sonnet-20240229' });

      await expect(coderAgent.run()).rejects.toThrow('IMPASSE');

      // Should be called exactly 2 times: first attempt + one retry attempt, but NO MORE
      expect(mockClaudeClient.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('should include conversation history and failure details in impasse report', async () => {
      mockWorkspace.executeCommand
        .mockResolvedValue({ stdout: '', stderr: 'Complex error details', exitCode: 1 });

      await expect(coderAgent.run()).rejects.toThrow('IMPASSE');

      const impasseCalls = mockCognitiveCanvas.createPheromone.mock.calls.filter(call => 
        call[0].type === 'impasse'
      );
      expect(impasseCalls).toHaveLength(1);
      expect(impasseCalls[0][0]).toEqual(
        expect.objectContaining({
          type: 'impasse',
          metadata: expect.objectContaining({
            additionalContext: expect.objectContaining({
              conversationHistory: expect.any(Array),
              taskId: mockTask.id,
              taskTitle: mockTask.title,
              fullCodeAttempts: expect.any(Array),
              lastError: 'Complex error details'
            })
          })
        })
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await coderAgent.initialize(mockConfig);
      await coderAgent.receiveTask(mockTask, mockTaskContext);
    });

    it('should handle Claude API errors gracefully', async () => {
      mockClaudeClient.sendMessage.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(coderAgent.run()).rejects.toThrow('API rate limit exceeded');
      expect(coderAgent.getStatus()).toBe('error');
    });

    it('should handle workspace command errors', async () => {
      mockWorkspace.executeCommand.mockRejectedValue(new Error('Command execution failed'));

      await expect(coderAgent.run()).rejects.toThrow('Command execution failed');
    });

    it('should handle git commit failures', async () => {
      mockWorkspace.commitChanges.mockRejectedValue(new Error('Git commit failed'));
      // Mock successful compilation and testing
      mockWorkspace.executeCommand.mockResolvedValue({ stdout: 'Success', stderr: '', exitCode: 0 });

      const result = await coderAgent.run();
      
      // Should complete the coding part but log git failure
      expect(result.success).toBe(true);
      expect(result.result.commitCreated).toBe(false);
    });
  });

  describe('Integration with Cognitive Canvas', () => {
    beforeEach(async () => {
      await coderAgent.initialize(mockConfig);
      await coderAgent.receiveTask(mockTask, mockTaskContext);
    });

    it('should apply retrieved coding standards', async () => {
      const customStandards = [{
        id: 'standards-1',
        type: 'coding_standards',
        strength: 0.8,
        context: 'project_standards',
        metadata: {
          language: 'typescript',
          standards: {
            indentation: 4,
            quotes: 'double',
            semicolons: false,
            maxLineLength: 120
          }
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }];

      mockCognitiveCanvas.getPheromonesByType.mockResolvedValue(customStandards);

      await coderAgent.run();

      expect(mockClaudeClient.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('4 spaces for indentation'),
        expect.any(Object)
      );
      expect(mockClaudeClient.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('double quotes'),
        expect.any(Object)
      );
    });

    it('should handle missing coding standards gracefully', async () => {
      mockCognitiveCanvas.getPheromonesByType.mockResolvedValue([]);

      const result = await coderAgent.run();

      expect(result.success).toBe(true);
      // Should still work with default standards
    });
  });

  describe('Contract-Driven Implementation', () => {
    beforeEach(async () => {
      await coderAgent.initialize(mockConfig);
    });

    it('should receive formal contracts and implement compliant code', async () => {
      const contractDrivenTask = {
        id: 'task-1',
        title: 'Implement user API from contract',
        description: 'Implement user management API that satisfies the provided OpenAPI specification',
        status: 'pending',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const contextWithContracts = {
        projectInfo: { 
          name: 'UserService',
          language: 'typescript',
          framework: 'express'
        },
        dependencies: ['express', 'cors'],
        files: [],
        formalContracts: {
          openApiSpecs: [{
            path: '/contracts/user-api.yaml',
            content: `openapi: 3.0.0
info:
  title: User API
  version: 1.0.0
paths:
  /users:
    get:
      summary: Get all users
      responses:
        '200':
          description: List of users
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
    post:
      summary: Create user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserCreate'
      responses:
        '201':
          description: User created
components:
  schemas:
    User:
      type: object
      properties:
        id: { type: string }
        email: { type: string, format: email }
        name: { type: string }
      required: [id, email, name]
    UserCreate:
      type: object
      properties:
        email: { type: string, format: email }
        name: { type: string }
      required: [email, name]`
          }],
          jsonSchemas: [{
            path: '/contracts/user-schema.json',
            content: `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "name": { "type": "string", "minLength": 1 }
  },
  "required": ["id", "email", "name"]
}`
          }]
        },
        architecturalDesign: {
          designDocument: 'Contract-compliant user service architecture',
          apiSpec: 'OpenAPI specification provided',
          dataModels: { User: 'User entity model' }
        }
      };

      await coderAgent.receiveTask(contractDrivenTask, contextWithContracts);

      // Mock contract-compliant code generation
      mockClaudeClient.sendMessage.mockResolvedValueOnce({
        content: `// Contract-compliant User API implementation
import express from 'express';
import { UserService } from './user-service';

const router = express.Router();
const userService = new UserService();

// GET /users - compliant with OpenAPI spec
router.get('/users', async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /users - compliant with OpenAPI spec
router.post('/users', async (req, res) => {
  try {
    const { email, name } = req.body;
    
    // Validate against JSON schema requirements
    if (!email || !name || name.length < 1) {
      return res.status(400).json({ error: 'Invalid user data' });
    }
    
    const user = await userService.createUser({ email, name });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;`,
        tokenUsage: { inputTokens: 200, outputTokens: 300, totalTokens: 500 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await coderAgent.run();

      expect(result.success).toBe(true);
      expect(result.result.codeGenerated).toBe(true);
      expect(mockClaudeClient.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('formal contract'),
        expect.any(Object)
      );
      expect(mockClaudeClient.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('OpenAPI'),
        expect.any(Object)
      );
    });

    it('should validate implementation against provided contracts', async () => {
      const task = {
        id: 'task-1',
        title: 'Implement order service with contract validation',
        description: 'Create order service that validates against contract specifications',
        status: 'pending',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const context = {
        projectInfo: { 
          name: 'OrderService',
          language: 'typescript',
          framework: 'node'
        },
        formalContracts: {
          openApiSpecs: [{
            path: '/contracts/orders.yaml',
            content: `openapi: 3.0.0
info:
  title: Orders API
  version: 1.0.0
paths:
  /orders/{id}:
    get:
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Order found
        '404':
          description: Order not found`
          }]
        }
      };

      await coderAgent.receiveTask(task, context);

      // Mock implementation with contract validation
      mockClaudeClient.sendMessage.mockResolvedValueOnce({
        content: `// Contract-validated implementation
export class OrderController {
  async getOrder(id: string): Promise<Order | null> {
    // Implementation satisfies contract requirement for string ID parameter
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid order ID format');
    }
    
    const order = await this.orderService.findById(id);
    
    // Contract specifies 404 for not found, 200 for success
    if (!order) {
      return null; // Will result in 404 response
    }
    
    return order; // Will result in 200 response
  }
}`,
        tokenUsage: { inputTokens: 150, outputTokens: 200, totalTokens: 350 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await coderAgent.run();

      expect(result.success).toBe(true);
      expect(mockClaudeClient.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('contract specifications'),
        expect.any(Object)
      );
    });

    it('should incorporate architectural design with formal contracts', async () => {
      const task = {
        id: 'task-1',
        title: 'Implement from architecture and contracts',
        description: 'Implement code based on both architectural design and formal contracts',
        status: 'pending',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const context = {
        projectInfo: { 
          name: 'PaymentService',
          language: 'typescript',
          framework: 'node'
        },
        formalContracts: {
          openApiSpecs: [{
            path: '/contracts/payments.yaml',
            content: `openapi: 3.0.0
info:
  title: Payment API
  version: 1.0.0
paths:
  /payments:
    post:
      summary: Process payment
      responses:
        '200':
          description: Payment processed`
          }]
        },
        architecturalDesign: {
          designDocument: `# Payment Service Architecture
          
## Components
- PaymentController: Handles HTTP requests
- PaymentService: Business logic
- PaymentRepository: Data persistence
- PaymentValidator: Contract validation

## Contract Compliance
- All endpoints implemented per OpenAPI spec
- Response formats match contract requirements`,
          mermaidDiagram: `graph TD
    A[PaymentController] --> B[PaymentService]
    B --> C[PaymentRepository]
    A --> D[PaymentValidator]`,
          decisions: []
        }
      };

      await coderAgent.receiveTask(task, context);

      const result = await coderAgent.run();

      expect(result.success).toBe(true);
      expect(mockClaudeClient.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('architectural design'),
        expect.any(Object)
      );
      expect(mockClaudeClient.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('formal contract'),
        expect.any(Object)
      );
    });

    it('should handle missing contracts gracefully', async () => {
      const task = {
        id: 'task-1',
        title: 'Implement without contracts',
        description: 'Handle implementation when contracts are missing',
        status: 'pending',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const context = {
        projectInfo: { 
          name: 'SimpleService',
          language: 'typescript',
          framework: 'node'
        },
        // No formalContracts provided
      };

      await coderAgent.receiveTask(task, context);

      const result = await coderAgent.run();

      // Should work without contracts, reverting to traditional implementation
      expect(result.success).toBe(true);
      expect(mockClaudeClient.sendMessage).toHaveBeenCalledWith(
        expect.not.stringContaining('formal contract'),
        expect.any(Object)
      );
    });

    it('should generate tests that validate contract compliance', async () => {
      const task = {
        id: 'task-1',
        title: 'Implement with contract-compliant tests',
        description: 'Generate tests that verify contract compliance',
        status: 'pending',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const context = {
        projectInfo: { 
          name: 'ApiService',
          language: 'typescript',
          framework: 'express'
        },
        formalContracts: {
          openApiSpecs: [{
            path: '/contracts/api.yaml',
            content: `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /test:
    get:
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  message: { type: string }
                required: [message]`
          }]
        }
      };

      await coderAgent.receiveTask(task, context);

      // Mock implementation then test generation
      mockClaudeClient.sendMessage
        .mockResolvedValueOnce({
          content: 'Implementation code',
          tokenUsage: { inputTokens: 100, outputTokens: 150, totalTokens: 250 },
          model: 'claude-3-sonnet-20240229'
        })
        .mockResolvedValueOnce({
          content: `// Contract compliance tests
describe('API Contract Compliance', () => {
  it('should return 200 status for GET /test', async () => {
    const response = await request(app).get('/test');
    expect(response.status).toBe(200);
  });
  
  it('should return JSON with required message property', async () => {
    const response = await request(app).get('/test');
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
  });
  
  it('should match OpenAPI schema requirements', async () => {
    const response = await request(app).get('/test');
    // Validate response against OpenAPI schema
    expect(response.headers['content-type']).toMatch(/json/);
  });
});`,
          tokenUsage: { inputTokens: 80, outputTokens: 120, totalTokens: 200 },
          model: 'claude-3-sonnet-20240229'
        });

      const result = await coderAgent.run();

      expect(result.success).toBe(true);
      expect(result.result.testsGenerated).toBe(true);
      expect(mockClaudeClient.sendMessage).toHaveBeenCalledTimes(2);
      
      // Verify that the test prompt includes contract validation
      const testPromptCall = mockClaudeClient.sendMessage.mock.calls[1][0];
      expect(testPromptCall).toContain('contract compliance');
    });

    it('should handle invalid contract formats gracefully', async () => {
      const task = {
        id: 'task-1',
        title: 'Handle invalid contracts',
        description: 'Process malformed contract specifications',
        status: 'pending',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const context = {
        projectInfo: { 
          name: 'TestService',
          language: 'typescript',
          framework: 'node'
        },
        formalContracts: {
          openApiSpecs: [{
            path: '/contracts/invalid.yaml',
            content: 'invalid: yaml: [missing bracket'
          }],
          jsonSchemas: [{
            path: '/contracts/broken.json',
            content: '{ "invalid": json, syntax }'
          }]
        }
      };

      await coderAgent.receiveTask(task, context);

      // Should not throw, but should handle gracefully
      const result = await coderAgent.run();

      expect(result.success).toBe(true);
      // Should still generate code, but might log warnings about invalid contracts
    });
  });

  describe('Progress Reporting', () => {
    beforeEach(async () => {
      await coderAgent.initialize(mockConfig);
      await coderAgent.receiveTask(mockTask, mockTaskContext);
    });

    it('should report progress throughout execution', async () => {
      await coderAgent.run();

      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'progress',
          context: 'started',
          metadata: expect.objectContaining({
            details: expect.stringContaining('code generation')
          })
        })
      );

      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'progress',
          context: 'completed',
          metadata: expect.objectContaining({
            details: expect.stringContaining('successfully')
          })
        })
      );
    });
  });
});