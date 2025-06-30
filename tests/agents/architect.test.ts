import { ArchitectAgent } from '../../src/agents/architect';
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

describe('ArchitectAgent', () => {
  let architect: ArchitectAgent;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockCognitiveCanvas: jest.Mocked<CognitiveCanvas>;
  let mockSessionManager: jest.Mocked<SessionManager>;

  const mockConfig = {
    id: 'architect-1',
    role: 'architect',
    capabilities: ['system-design', 'api-spec', 'data-modeling', 'diagram-generation'],
    claudeConfig: {
      apiKey: 'test-api-key',
      defaultModel: ClaudeModel.SONNET,
      maxTokens: 8000,
      temperature: 0.3
    },
    workspaceRoot: '/test/workspace',
    cognitiveCanvasConfig: {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'test'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Claude client
    mockClaudeClient = {
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Architectural analysis complete',
        tokenUsage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
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
        stdout: 'Worktree created successfully',
        stderr: '',
        exitCode: 0
      }),
      getWorktreePath: jest.fn().mockReturnValue('/test/workspace/task-1'),
      getProjectRoot: jest.fn().mockReturnValue('/test/workspace'),
      createWorktree: jest.fn(),
      removeWorktree: jest.fn(),
      listWorktrees: jest.fn(),
      commitChanges: jest.fn(),
      mergeToBranch: jest.fn(),
      getWorktreeStatus: jest.fn()
    } as any;

    (WorkspaceManager as jest.MockedClass<typeof WorkspaceManager>).mockImplementation(() => mockWorkspace);

    // Mock cognitive canvas
    mockCognitiveCanvas = {
      createPheromone: jest.fn().mockResolvedValue({
        id: 'pheromone-1',
        type: 'architectural',
        strength: 0.8,
        context: 'design_decision',
        metadata: {},
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }),
      getArchitecturalDecisionsByProject: jest.fn().mockResolvedValue([
        {
          id: 'decision-1',
          title: 'Database Choice',
          description: 'Using PostgreSQL for persistence',
          rationale: 'ACID compliance needed',
          alternatives: ['MongoDB', 'MySQL'],
          consequences: ['Better consistency', 'Complex queries supported']
        }
      ]),
      storeArchitecturalDecision: jest.fn().mockResolvedValue({ id: 'decision-2' }),
      findSimilarTasks: jest.fn().mockResolvedValue([]),
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
      getPheromonesByType: jest.fn(),
      cleanExpiredPheromones: jest.fn(),
      getProjectKnowledgeGraph: jest.fn(),
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

    // Mock file system
    const fs = require('fs');
    fs.readFileSync = jest.fn().mockReturnValue('existing file content');
    fs.writeFileSync = jest.fn();
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();

    architect = new ArchitectAgent();
  });

  describe('Initialization', () => {
    it('should extend Agent base class', () => {
      expect(architect).toBeInstanceOf(Agent);
    });

    it('should initialize with architect-specific configuration', async () => {
      await architect.initialize(mockConfig);
      
      expect(architect.getId()).toBe('architect-1');
      expect(architect.getRole()).toBe('architect');
      expect(architect.getCapabilities()).toContain('system-design');
      expect(architect.getCapabilities()).toContain('api-spec');
      expect(architect.getCapabilities()).toContain('data-modeling');
      expect(architect.getCapabilities()).toContain('diagram-generation');
    });
  });

  describe('Prompt Template', () => {
    it('should provide architectural design prompt template', () => {
      const template = architect.getPromptTemplate();
      
      expect(template).toContain('architectural design');
      expect(template).toContain('{{task}}');
      expect(template).toContain('{{context}}');
      expect(template).toContain('Mermaid.js');
      expect(template).toContain('DESIGN.md');
    });

    it('should format template with task context', () => {
      const template = architect.getPromptTemplate();
      const formatted = architect.formatPrompt(template, {
        task: 'Design user authentication system',
        context: 'Web application with JWT tokens',
        projectName: 'TestApp'
      });
      
      expect(formatted).toContain('Design user authentication system');
      expect(formatted).toContain('Web application with JWT tokens');
      expect(formatted).toContain('TestApp');
    });
  });

  describe('Task Execution', () => {
    beforeEach(async () => {
      await architect.initialize(mockConfig);
    });

    it('should execute architectural design task', async () => {
      const task = {
        id: 'task-1',
        title: 'Design user management system',
        description: 'Create architectural design for user registration and authentication',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const context = {
        projectInfo: { name: 'UserApp', type: 'web-application' },
        requirements: ['user registration', 'JWT authentication', 'role-based access'],
        dependencies: [],
        files: []
      };

      await architect.receiveTask(task, context);

      // Mock Claude response with architectural design
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: `# Architectural Design

## Component Design
- UserService: Handles user operations
- AuthService: Manages authentication
- RoleService: Controls access permissions

## API Endpoints
- POST /api/users/register
- POST /api/auth/login
- GET /api/users/profile

## Mermaid Diagram
\`\`\`mermaid
graph TD
    A[User] --> B[AuthService]
    B --> C[UserService]
    C --> D[Database]
\`\`\`

## Database Schema
- users table: id, email, password_hash, created_at
- roles table: id, name, permissions`,
        tokenUsage: { inputTokens: 300, outputTokens: 200, totalTokens: 500 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await architect.run();
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.designDocument).toBeDefined();
      expect(result.result.mermaidDiagram).toBeDefined();
      expect(result.result.apiSpec).toBeDefined();
      expect(result.result.dataModels).toBeDefined();
    });

    it('should query Cognitive Canvas for existing patterns', async () => {
      const task = {
        id: 'task-1',
        title: 'Design payment system',
        description: 'Create payment processing architecture',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await architect.receiveTask(task, {});
      await architect.run();

      expect(mockCognitiveCanvas.getArchitecturalDecisionsByProject).toHaveBeenCalledWith('project-1');
      expect(mockCognitiveCanvas.findSimilarTasks).toHaveBeenCalled();
    });

    it('should create DESIGN.md file in worktree', async () => {
      const task = {
        id: 'task-1',
        title: 'Design API gateway',
        description: 'Create microservices gateway design',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await architect.receiveTask(task, {});
      await architect.run();

      const fs = require('fs');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('DESIGN.md'),
        expect.stringContaining('# Architectural Design'),
        'utf-8'
      );
    });

    it('should generate Mermaid diagrams', async () => {
      const task = {
        id: 'task-1',
        title: 'Design data flow',
        description: 'Create data processing pipeline design',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await architect.receiveTask(task, {});

      // Mock response with Mermaid diagram
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: `Architecture includes:

\`\`\`mermaid
flowchart TD
    A[Input Data] --> B[Processor]
    B --> C[Validator]
    C --> D[Storage]
\`\`\`

This shows the data flow.`,
        tokenUsage: { inputTokens: 150, outputTokens: 100, totalTokens: 250 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await architect.run();
      
      expect(result.result.mermaidDiagram).toContain('flowchart TD');
      expect(result.result.mermaidDiagram).toContain('Input Data');
    });

    it('should update Canvas with architectural decisions', async () => {
      const task = {
        id: 'task-1',
        title: 'Design caching strategy',
        description: 'Define caching architecture',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await architect.receiveTask(task, {});
      await architect.run();

      expect(mockCognitiveCanvas.storeArchitecturalDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          title: expect.any(String),
          description: expect.any(String),
          rationale: expect.any(String)
        })
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await architect.initialize(mockConfig);
    });

    it('should handle Claude API errors gracefully', async () => {
      const task = {
        id: 'task-1',
        title: 'Design system',
        description: 'Test error handling',
        status: 'assigned',
        priority: 'low',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await architect.receiveTask(task, {});

      mockClaudeClient.sendMessage.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(architect.run()).rejects.toThrow();
      expect(architect.getStatus()).toBe('error');
    });

    it('should handle file system errors', async () => {
      const task = {
        id: 'task-1',
        title: 'Design system',
        description: 'Test file error handling',
        status: 'assigned',
        priority: 'low',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await architect.receiveTask(task, {});

      const fs = require('fs');
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(architect.run()).rejects.toThrow();
    });

    it('should handle invalid task descriptions', async () => {
      const task = {
        id: 'task-1',
        title: '',
        description: '',
        status: 'assigned',
        priority: 'low',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await architect.receiveTask(task, {});
      await expect(architect.run()).rejects.toThrow('Invalid task specification');
    });
  });

  describe('Integration Features', () => {
    beforeEach(async () => {
      await architect.initialize(mockConfig);
    });

    it('should create OpenAPI specifications', async () => {
      const task = {
        id: 'task-1',
        title: 'Design REST API',
        description: 'Create API specification for user service',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await architect.receiveTask(task, {});

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: `API Design:

\`\`\`yaml
openapi: 3.0.0
info:
  title: User API
  version: 1.0.0
paths:
  /users:
    get:
      summary: List users
      responses:
        '200':
          description: Success
\`\`\``,
        tokenUsage: { inputTokens: 200, outputTokens: 150, totalTokens: 350 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await architect.run();
      
      expect(result.result.apiSpec).toContain('openapi: 3.0.0');
      expect(result.result.apiSpec).toContain('/users');
    });

    it('should define data models and schemas', async () => {
      const task = {
        id: 'task-1',
        title: 'Design data models',
        description: 'Create database schema for e-commerce system',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await architect.receiveTask(task, {});

      const result = await architect.run();
      
      expect(result.result.dataModels).toBeDefined();
      expect(typeof result.result.dataModels).toBe('object');
    });

    it('should handle complex system architectures', async () => {
      const task = {
        id: 'task-1',
        title: 'Design microservices architecture',
        description: 'Create distributed system design with multiple services',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const context = {
        projectInfo: { name: 'ECommerce', type: 'microservices' },
        requirements: [
          'user service',
          'product catalog',
          'order processing',
          'payment gateway',
          'notification service'
        ],
        constraints: ['high availability', 'scalability', 'security']
      };

      await architect.receiveTask(task, context);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: `# Microservices Architecture

## Services
- UserService: User management
- ProductService: Product catalog
- OrderService: Order processing
- PaymentService: Payment handling
- NotificationService: Messaging

## Communication
- API Gateway for external access
- Message queues for async communication
- Service mesh for inter-service communication

\`\`\`mermaid
graph TB
    Gateway[API Gateway] --> UserSvc[User Service]
    Gateway --> ProductSvc[Product Service]
    Gateway --> OrderSvc[Order Service]
    OrderSvc --> PaymentSvc[Payment Service]
    OrderSvc --> NotifSvc[Notification Service]
\`\`\``,
        tokenUsage: { inputTokens: 400, outputTokens: 300, totalTokens: 700 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await architect.run();
      
      expect(result.success).toBe(true);
      expect(result.result.designDocument).toContain('Microservices Architecture');
      expect(result.result.mermaidDiagram).toContain('API Gateway');
    });
  });

  describe('Contract-Driven Development', () => {
    beforeEach(async () => {
      await architect.initialize(mockConfig);
    });

    it('should receive and process formal contract files', async () => {
      const task = {
        id: 'task-1',
        title: 'Design API from contracts',
        description: 'Create architectural design based on formal OpenAPI and JSON schema contracts',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const contractFiles = {
        openApiSpecs: [
          {
            path: '/contracts/user-api.yaml',
            content: `openapi: 3.0.0
info:
  title: User API
  version: 1.0.0
paths:
  /users:
    get:
      summary: Get users
      responses:
        '200':
          description: Success`
          }
        ],
        jsonSchemas: [
          {
            path: '/contracts/user-schema.json',
            content: `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "name": { "type": "string" }
  },
  "required": ["id", "email", "name"]
}`
          }
        ]
      };

      const context = {
        projectInfo: { name: 'ContractApp', type: 'api-service' },
        requirements: ['implement user management'],
        dependencies: [],
        files: [],
        formalContracts: contractFiles
      };

      await architect.receiveTask(task, context);

      // Mock Claude response for contract-driven design
      mockClaudeClient.sendMessage.mockResolvedValue({
        content: `# Contract-Driven Architectural Design

## Contract Analysis
- OpenAPI Spec: User API v1.0.0 with /users endpoint
- JSON Schema: User object with id, email, name properties

## Aligned Design
The architecture has been designed to fulfill the formal contracts:

\`\`\`mermaid
graph TD
    A[API Gateway] --> B[User Service]
    B --> C[User Repository]
    C --> D[Database]
\`\`\`

## Contract Compliance
- GET /users endpoint implemented according to OpenAPI spec
- User model satisfies JSON schema requirements
- Response format matches contract specifications`,
        tokenUsage: { inputTokens: 500, outputTokens: 300, totalTokens: 800 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await architect.run();
      
      expect(result.success).toBe(true);
      expect(result.result.designDocument).toContain('Contract-Driven');
      expect(result.result.designDocument).toContain('OpenAPI Spec');
      expect(result.result.designDocument).toContain('JSON Schema');
      expect(mockClaudeClient.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('FORMAL CONTRACTS PROVIDED'),
        expect.any(Object)
      );
    });

    it('should validate design alignment with OpenAPI specifications', async () => {
      const task = {
        id: 'task-1',
        title: 'Design REST API service',
        description: 'Create service architecture that aligns with provided OpenAPI contract',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const context = {
        projectInfo: { name: 'OrderService', type: 'microservice' },
        formalContracts: {
          openApiSpecs: [{
            path: '/contracts/orders-api.yaml',
            content: `openapi: 3.0.0
info:
  title: Orders API
  version: 2.0.0
paths:
  /orders:
    post:
      summary: Create order
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Order'
      responses:
        '201':
          description: Order created
components:
  schemas:
    Order:
      type: object
      properties:
        id: { type: string }
        items: { type: array }
        total: { type: number }
      required: [id, items, total]`
          }]
        }
      };

      await architect.receiveTask(task, context);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: `# Orders Service Architecture

## Contract Compliance Analysis
- POST /orders endpoint: ✓ Implemented
- Order schema validation: ✓ Aligned
- Response format: ✓ Matches contract

\`\`\`mermaid
sequenceDiagram
    Client->>+OrderService: POST /orders
    OrderService->>+Database: Save Order
    Database->>-OrderService: Order Saved
    OrderService->>-Client: 201 Created
\`\`\``,
        tokenUsage: { inputTokens: 400, outputTokens: 250, totalTokens: 650 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await architect.run();
      
      expect(result.success).toBe(true);
      expect(result.result.designDocument).toContain('Contract Compliance');
      expect(result.result.mermaidDiagram).toContain('POST /orders');
    });

    it('should incorporate JSON schemas into data model design', async () => {
      const task = {
        id: 'task-1',
        title: 'Design data models from schemas',
        description: 'Create data architecture based on provided JSON schemas',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const context = {
        formalContracts: {
          jsonSchemas: [
            {
              path: '/contracts/product.json',
              content: `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string", "pattern": "^prod-[0-9]+$" },
    "name": { "type": "string", "minLength": 1, "maxLength": 100 },
    "price": { "type": "number", "minimum": 0 },
    "category": { "type": "string", "enum": ["electronics", "clothing", "books"] }
  },
  "required": ["id", "name", "price", "category"]
}`
            }
          ]
        }
      };

      await architect.receiveTask(task, context);

      const result = await architect.run();
      
      expect(result.success).toBe(true);
      expect(mockClaudeClient.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('JSON schemas'),
        expect.any(Object)
      );
    });

    it('should handle missing or invalid contract files gracefully', async () => {
      const task = {
        id: 'task-1',
        title: 'Design with invalid contracts',
        description: 'Handle malformed contract input',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const context = {
        formalContracts: {
          openApiSpecs: [{
            path: '/contracts/invalid.yaml',
            content: 'invalid: yaml: content: ['
          }]
        }
      };

      await architect.receiveTask(task, context);

      // Should not throw error but should log warning about invalid contracts
      const result = await architect.run();
      
      expect(result.success).toBe(true);
      // Should still generate a design, but with warnings about contract issues
    });

    it('should create contract compliance section in design document', async () => {
      const task = {
        id: 'task-1',
        title: 'Design with compliance tracking',
        description: 'Create design with contract compliance documentation',
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      const context = {
        formalContracts: {
          openApiSpecs: [{
            path: '/contracts/simple-api.yaml',
            content: `openapi: 3.0.0
info:
  title: Simple API
  version: 1.0.0
paths:
  /health:
    get:
      summary: Health check
      responses:
        '200':
          description: OK`
          }]
        }
      };

      await architect.receiveTask(task, context);

      mockClaudeClient.sendMessage.mockResolvedValue({
        content: `# Architecture with Contract Compliance

## Contract Compliance Report
### OpenAPI Specification Alignment
- **Endpoint Coverage**: All required endpoints implemented
- **Schema Validation**: Response schemas match specifications
- **HTTP Methods**: Correct methods mapped to operations
- **Status Codes**: Proper error handling implemented

## Implementation Notes
The design ensures full compliance with provided formal contracts.`,
        tokenUsage: { inputTokens: 300, outputTokens: 200, totalTokens: 500 },
        model: 'claude-3-sonnet-20240229'
      });

      const result = await architect.run();
      
      expect(result.success).toBe(true);
      expect(result.result.designDocument).toContain('Contract Compliance Report');
      expect(result.result.designDocument).toContain('OpenAPI Specification Alignment');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await architect.initialize(mockConfig);
    });

    it('should handle empty Canvas responses', async () => {
      mockCognitiveCanvas.getArchitecturalDecisionsByProject.mockResolvedValue([]);
      mockCognitiveCanvas.findSimilarTasks.mockResolvedValue([]);

      const task = {
        id: 'task-1',
        title: 'Design new system',
        description: 'Create architecture for novel system',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await architect.receiveTask(task, {});
      const result = await architect.run();
      
      expect(result.success).toBe(true);
    });

    it('should handle very long task descriptions', async () => {
      const longDescription = 'A'.repeat(10000);
      const task = {
        id: 'task-1',
        title: 'Complex system design',
        description: longDescription,
        status: 'assigned',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await architect.receiveTask(task, {});
      
      // Should not throw due to length
      await expect(architect.run()).resolves.toBeDefined();
    });

    it('should handle missing project context', async () => {
      const task = {
        id: 'task-1',
        title: 'Design system',
        description: 'Basic system design',
        status: 'assigned',
        priority: 'medium',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await architect.receiveTask(task, {}); // Empty context
      const result = await architect.run();
      
      expect(result.success).toBe(true);
    });
  });
});