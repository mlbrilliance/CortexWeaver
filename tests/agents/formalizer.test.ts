import { Formalizer } from '../../src/agents/formalizer';
import { AgentConfig, TaskContext } from '../../src/agent';
import { TaskData, CognitiveCanvas } from '../../src/cognitive-canvas';
import { WorkspaceManager } from '../../src/workspace';
import { SessionManager } from '../../src/session';
import { ClaudeClient } from '../../src/claude-client';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('../../src/claude-client');
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/workspace');
jest.mock('../../src/session');
jest.mock('fs');
jest.mock('path');

describe('Formalizer', () => {
  let formalizer: Formalizer;
  let mockConfig: AgentConfig;
  let mockTask: TaskData;
  let mockContext: TaskContext;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockCognitiveCanvas: jest.Mocked<CognitiveCanvas>;

  const mockBDDContent = `
Feature: User Authentication
  As a user
  I want to authenticate with the system
  So that I can access protected resources

  Scenario: Successful login
    Given I am a registered user
    When I provide valid credentials
    Then I should be authenticated
    And I should receive an access token

  Scenario: Invalid credentials
    Given I am on the login page
    When I provide invalid credentials
    Then I should see an error message
    And I should not be authenticated
  `;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Claude client
    mockClaudeClient = {
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Mock Claude response',
        tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        model: 'claude-3-sonnet-20240229'
      })
    } as any;
    (ClaudeClient as jest.MockedClass<typeof ClaudeClient>).mockImplementation(() => mockClaudeClient);

    // Mock Cognitive Canvas
    mockCognitiveCanvas = {
      createContract: jest.fn().mockResolvedValue({ id: 'contract-1' }),
      linkContractToFeature: jest.fn().mockResolvedValue(undefined),
      createPheromone: jest.fn().mockResolvedValue({ id: 'pheromone-1' }),
      initializeSchema: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    } as any;
    (CognitiveCanvas as jest.MockedClass<typeof CognitiveCanvas>).mockImplementation(() => mockCognitiveCanvas);

    // Mock fs operations
    (fs.existsSync as jest.MockedFunction<typeof fs.existsSync>).mockReturnValue(true);
    (fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>).mockImplementation();
    (fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>).mockImplementation();
    (fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>).mockReturnValue(mockBDDContent);
    
    // Mock path operations
    (path.resolve as jest.MockedFunction<typeof path.resolve>).mockImplementation((...args) => args.join('/'));
    (path.dirname as jest.MockedFunction<typeof path.dirname>).mockImplementation((p) => p.split('/').slice(0, -1).join('/'));
    (path.join as jest.MockedFunction<typeof path.join>).mockImplementation((...args) => args.join('/'));

    mockConfig = {
      id: 'formalizer-test',
      role: 'Formalizer',
      capabilities: ['formal-specification', 'openapi-generation', 'property-testing', 'contract-creation'],
      claudeConfig: {
        apiKey: 'test-api-key',
        defaultModel: 'claude-3-sonnet-20240229' as any,
        maxTokens: 4096,
        temperature: 0.1
      },
      workspaceRoot: '/test/workspace',
      cognitiveCanvasConfig: {
        uri: 'neo4j://localhost:7687',
        username: 'neo4j',
        password: 'password'
      }
    };

    mockTask = {
      id: 'formalize-task-1',
      title: 'Formalize user authentication feature',
      description: 'Convert BDD scenarios to formal specifications and property-based test stubs',
      priority: 'high',
      status: 'pending',
      projectId: 'test-project-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockContext = {
      projectInfo: {
        name: 'Authentication Service',
        description: 'A microservice for user authentication'
      },
      featureFiles: ['/test/workspace/features/user-authentication.feature'],
      dependencies: ['JWT', 'bcrypt', 'passport']
    };

    formalizer = new Formalizer();
  });

  describe('initialization', () => {
    it('should initialize with valid configuration', async () => {
      await formalizer.initialize(mockConfig);
      expect(formalizer.getId()).toBe('formalizer-test');
      expect(formalizer.getRole()).toBe('Formalizer');
      expect(formalizer.getCapabilities()).toEqual(['formal-specification', 'openapi-generation', 'property-testing', 'contract-creation']);
    });

    it('should initialize Claude client with low temperature for consistency', async () => {
      await formalizer.initialize(mockConfig);
      expect(ClaudeClient).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.1
        })
      );
    });
  });

  describe('getPromptTemplate', () => {
    beforeEach(async () => {
      await formalizer.initialize(mockConfig);
    });

    it('should return a comprehensive prompt template for formalization', () => {
      const template = formalizer.getPromptTemplate();
      
      expect(template).toContain('formal methods specialist');
      expect(template).toContain('OpenAPI');
      expect(template).toContain('JSON Schema');
      expect(template).toContain('property-based test');
      expect(template).toContain('BDD scenarios');
      expect(template).toContain('{{bddContent}}');
      expect(template).toContain('{{projectInfo}}');
    });
  });

  describe('executeTask', () => {
    beforeEach(async () => {
      await formalizer.initialize(mockConfig);
      await formalizer.receiveTask(mockTask, mockContext);
    });

    it('should generate formal specifications from BDD scenarios', async () => {
      const mockClaudeResponse = {
        content: JSON.stringify({
          openApiSpec: {
            openapi: '3.0.0',
            info: { title: 'Authentication API', version: '1.0.0' },
            paths: {
              '/auth/login': {
                post: {
                  summary: 'User login',
                  requestBody: {
                    content: {
                      'application/json': {
                        schema: { $ref: '#/components/schemas/LoginRequest' }
                      }
                    }
                  },
                  responses: {
                    '200': {
                      description: 'Successful authentication',
                      content: {
                        'application/json': {
                          schema: { $ref: '#/components/schemas/AuthResponse' }
                        }
                      }
                    }
                  }
                }
              }
            },
            components: {
              schemas: {
                LoginRequest: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 }
                  }
                },
                AuthResponse: {
                  type: 'object',
                  required: ['token', 'user'],
                  properties: {
                    token: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' }
                  }
                }
              }
            }
          },
          jsonSchemas: {
            User: {
              type: 'object',
              required: ['id', 'email'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string', format: 'email' },
                name: { type: 'string' }
              }
            }
          },
          propertyTestStubs: [
            {
              name: 'login_with_valid_credentials_returns_token',
              description: 'For any valid user credentials, login should return an access token',
              properties: [
                'token is not null or empty',
                'token is a valid JWT format',
                'user information is included in response'
              ]
            }
          ]
        }),
        tokenUsage: { inputTokens: 500, outputTokens: 800, totalTokens: 1300 },
        model: 'claude-3-sonnet-20240229'
      };

      mockClaudeClient.sendMessage.mockResolvedValue(mockClaudeResponse);

      const result = await formalizer.executeTask();

      expect(result).toBeDefined();
      expect(result.openApiSpec).toBeDefined();
      expect(result.jsonSchemas).toBeDefined();
      expect(result.propertyTestStubs).toBeDefined();
      expect(result.contractFiles).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should create contracts directory and write specification files', async () => {
      const mockClaudeResponse = {
        content: JSON.stringify({
          openApiSpec: {
            openapi: '3.0.0',
            info: { title: 'Test API', version: '1.0.0' },
            paths: {}
          },
          jsonSchemas: {
            TestSchema: {
              type: 'object',
              properties: { id: { type: 'string' } }
            }
          },
          propertyTestStubs: [
            {
              name: 'test_property',
              description: 'Test property description',
              properties: ['test property']
            }
          ]
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        model: 'claude-3-sonnet-20240229'
      };

      mockClaudeClient.sendMessage.mockResolvedValue(mockClaudeResponse);

      await formalizer.executeTask();

      // Verify contracts directory creation
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('contracts'),
        { recursive: true }
      );

      // Verify OpenAPI spec file creation
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('openapi.yaml'),
        expect.stringContaining('openapi: 3.0.0'),
        'utf-8'
      );

      // Verify JSON schema files creation
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('schemas.json'),
        expect.stringContaining('TestSchema'),
        'utf-8'
      );

      // Verify property test stubs creation
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('property-test-stubs.ts'),
        expect.stringContaining('test_property'),
        'utf-8'
      );
    });

    it('should update Cognitive Canvas with specification relationships', async () => {
      const mockClaudeResponse = {
        content: JSON.stringify({
          openApiSpec: { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' }, paths: {} },
          jsonSchemas: {},
          propertyTestStubs: []
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        model: 'claude-3-sonnet-20240229'
      };

      mockClaudeClient.sendMessage.mockResolvedValue(mockClaudeResponse);

      await formalizer.executeTask();

      // Verify contract creation for specifications
      expect(mockCognitiveCanvas.createContract).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'openapi',
          name: expect.stringContaining('OpenAPI')
        })
      );

      // Verify relationship creation between feature and specifications
      expect(mockCognitiveCanvas.linkContractToFeature).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String)
      );
    });

    it('should handle multiple BDD feature files', async () => {
      const contextWithMultipleFiles = {
        ...mockContext,
        featureFiles: [
          '/test/workspace/features/authentication.feature',
          '/test/workspace/features/authorization.feature'
        ]
      };

      await formalizer.receiveTask(mockTask, contextWithMultipleFiles);

      const mockClaudeResponse = {
        content: JSON.stringify({
          openApiSpec: { openapi: '3.0.0', info: { title: 'Multi-Feature API', version: '1.0.0' }, paths: {} },
          jsonSchemas: {},
          propertyTestStubs: []
        }),
        tokenUsage: { inputTokens: 200, outputTokens: 400, totalTokens: 600 },
        model: 'claude-3-sonnet-20240229'
      };

      mockClaudeClient.sendMessage.mockResolvedValue(mockClaudeResponse);

      const result = await formalizer.executeTask();

      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
      expect(result.metadata.processedFeatures).toBe(2);
    });

    it('should validate generated OpenAPI specifications', async () => {
      const invalidOpenApiSpec = {
        // Missing required openapi field
        info: { title: 'Invalid API', version: '1.0.0' },
        paths: {}
      };

      const mockClaudeResponse = {
        content: JSON.stringify({
          openApiSpec: invalidOpenApiSpec,
          jsonSchemas: {},
          propertyTestStubs: []
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        model: 'claude-3-sonnet-20240229'
      };

      mockClaudeClient.sendMessage.mockResolvedValue(mockClaudeResponse);

      const result = await formalizer.executeTask();

      expect(result.validationResults).toBeDefined();
      expect(result.validationResults.openApiSpec.isValid).toBe(false);
      expect(result.validationResults.openApiSpec.errors).toContain('Missing required field: openapi');
    });

    it('should handle Claude API errors gracefully', async () => {
      mockClaudeClient.sendMessage.mockRejectedValue(new Error('Claude API error'));

      await expect(formalizer.executeTask()).rejects.toThrow('Failed to generate formal specifications');
    });

    it('should handle invalid JSON response from Claude', async () => {
      const mockInvalidResponse = {
        content: 'This is not valid JSON',
        tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        model: 'claude-3-sonnet-20240229'
      };

      mockClaudeClient.sendMessage.mockResolvedValue(mockInvalidResponse);

      await expect(formalizer.executeTask()).rejects.toThrow('Failed to parse Claude response');
    });
  });

  describe('analyzeBDDScenarios', () => {
    beforeEach(async () => {
      await formalizer.initialize(mockConfig);
      await formalizer.receiveTask(mockTask, mockContext);
    });

    it('should extract API operations from BDD scenarios', () => {
      const analysis = (formalizer as any).analyzeBDDScenarios(mockBDDContent);

      expect(analysis).toBeDefined();
      expect(analysis.apiOperations).toBeDefined();
      expect(analysis.dataModels).toBeDefined();
      expect(analysis.businessRules).toBeDefined();
      expect(analysis.securityRequirements).toBeDefined();
    });

    it('should identify data models from Given-When-Then steps', () => {
      const analysis = (formalizer as any).analyzeBDDScenarios(mockBDDContent);

      expect(analysis.dataModels).toContain('User');
      expect(analysis.dataModels).toContain('Credentials');
      expect(analysis.dataModels).toContain('Token');
    });

    it('should extract business rules from scenarios', () => {
      const analysis = (formalizer as any).analyzeBDDScenarios(mockBDDContent);

      expect(analysis.businessRules).toContain('Valid credentials are required for authentication');
      expect(analysis.businessRules).toContain('Invalid credentials should return error message');
    });
  });

  describe('generateOpenApiSpec', () => {
    beforeEach(async () => {
      await formalizer.initialize(mockConfig);
    });

    it('should generate valid OpenAPI 3.0 specification', () => {
      const analysis = {
        apiOperations: [
          {
            method: 'POST',
            path: '/auth/login',
            summary: 'User authentication',
            requestBody: 'LoginRequest',
            responses: { '200': 'AuthResponse', '401': 'ErrorResponse' }
          }
        ],
        dataModels: ['User', 'LoginRequest', 'AuthResponse', 'ErrorResponse']
      };

      const openApiSpec = (formalizer as any).generateOpenApiSpec(analysis, 'Authentication API');

      expect(openApiSpec.openapi).toBe('3.0.0');
      expect(openApiSpec.info.title).toBe('Authentication API');
      expect(openApiSpec.paths['/auth/login']).toBeDefined();
      expect(openApiSpec.paths['/auth/login'].post).toBeDefined();
      expect(openApiSpec.components.schemas).toBeDefined();
    });

    it('should include security schemes for authentication operations', () => {
      const analysis = {
        apiOperations: [
          {
            method: 'POST',
            path: '/auth/login',
            summary: 'User authentication',
            requestBody: 'LoginRequest',
            responses: { '200': 'AuthResponse' }
          }
        ],
        dataModels: [],
        securityRequirements: ['JWT Authentication']
      };

      const openApiSpec = (formalizer as any).generateOpenApiSpec(analysis, 'Secure API');

      expect(openApiSpec.components.securitySchemes).toBeDefined();
      expect(openApiSpec.components.securitySchemes.bearerAuth).toBeDefined();
    });
  });

  describe('generateJsonSchemas', () => {
    beforeEach(async () => {
      await formalizer.initialize(mockConfig);
    });

    it('should generate JSON schemas for identified data models', () => {
      const analysis = {
        dataModels: ['User', 'LoginRequest'],
        apiOperations: [
          {
            requestBody: 'LoginRequest',
            responses: { '200': 'User' }
          }
        ]
      };

      const schemas = (formalizer as any).generateJsonSchemas(analysis);

      expect(schemas.User).toBeDefined();
      expect(schemas.LoginRequest).toBeDefined();
      expect(schemas.User.type).toBe('object');
      expect(schemas.LoginRequest.type).toBe('object');
    });

    it('should include validation rules based on business requirements', () => {
      const analysis = {
        dataModels: ['User'],
        businessRules: ['Email must be valid format', 'Password must be at least 8 characters']
      };

      const schemas = (formalizer as any).generateJsonSchemas(analysis);

      expect(schemas.User.properties.email.format).toBe('email');
      expect(schemas.User.properties.password.minLength).toBe(8);
    });
  });

  describe('generatePropertyTestStubs', () => {
    beforeEach(async () => {
      await formalizer.initialize(mockConfig);
    });

    it('should generate property-based test stubs from business rules', () => {
      const analysis = {
        businessRules: [
          'Valid credentials should return access token',
          'Invalid credentials should return error'
        ],
        apiOperations: [
          { method: 'POST', path: '/auth/login', summary: 'User login' }
        ]
      };

      const testStubs = (formalizer as any).generatePropertyTestStubs(analysis);

      expect(testStubs).toBeDefined();
      expect(testStubs.length).toBeGreaterThan(0);
      expect(testStubs[0].name).toContain('login');
      expect(testStubs[0].properties).toBeDefined();
    });

    it('should include invariants for data consistency', () => {
      const analysis = {
        businessRules: ['User ID must be unique'],
        dataModels: ['User']
      };

      const testStubs = (formalizer as any).generatePropertyTestStubs(analysis);

      expect(testStubs).toContain(
        expect.objectContaining({
          properties: expect.arrayContaining([
            expect.stringContaining('unique')
          ])
        })
      );
    });
  });

  describe('validateOpenApiSpec', () => {
    beforeEach(async () => {
      await formalizer.initialize(mockConfig);
    });

    it('should validate correct OpenAPI specification', () => {
      const validSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {}
      };

      const result = (formalizer as any).validateOpenApiSpec(validSpec);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidSpec = {
        info: { title: 'Invalid API', version: '1.0.0' },
        paths: {}
      };

      const result = (formalizer as any).validateOpenApiSpec(invalidSpec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: openapi');
    });

    it('should validate path operations', () => {
      const specWithInvalidPath = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/test': {
            // Missing HTTP method
          }
        }
      };

      const result = (formalizer as any).validateOpenApiSpec(specWithInvalidPath);

      expect(result.warnings).toContain('Path /test has no HTTP operations defined');
    });
  });

  describe('validateJsonSchemas', () => {
    beforeEach(async () => {
      await formalizer.initialize(mockConfig);
    });

    it('should validate correct JSON schemas', () => {
      const validSchemas = {
        User: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' }
          }
        }
      };

      const result = (formalizer as any).validateJsonSchemas(validSchemas);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid schema definitions', () => {
      const invalidSchemas = {
        User: {
          // Missing type field
          properties: {
            id: { type: 'string' }
          }
        }
      };

      const result = (formalizer as any).validateJsonSchemas(invalidSchemas);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Schema User: Missing required field: type');
    });
  });

  describe('writeContractFiles', () => {
    beforeEach(async () => {
      await formalizer.initialize(mockConfig);
      await formalizer.receiveTask(mockTask, mockContext);
    });

    it('should write OpenAPI spec as YAML file', async () => {
      const openApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {}
      };

      const files = await (formalizer as any).writeContractFiles(openApiSpec, {}, []);

      expect(files.openApiFile).toBeDefined();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('openapi.yaml'),
        expect.stringContaining('openapi: 3.0.0'),
        'utf-8'
      );
    });

    it('should write JSON schemas as separate JSON file', async () => {
      const jsonSchemas = {
        User: {
          type: 'object',
          properties: { id: { type: 'string' } }
        }
      };

      const files = await (formalizer as any).writeContractFiles({}, jsonSchemas, []);

      expect(files.schemasFile).toBeDefined();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('schemas.json'),
        expect.stringContaining('"User"'),
        'utf-8'
      );
    });

    it('should write property test stubs as TypeScript file', async () => {
      const testStubs = [
        {
          name: 'test_user_creation',
          description: 'Test user creation properties',
          properties: ['user.id is not empty', 'user.email is valid format']
        }
      ];

      const files = await (formalizer as any).writeContractFiles({}, {}, testStubs);

      expect(files.testStubsFile).toBeDefined();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('property-test-stubs.ts'),
        expect.stringContaining('test_user_creation'),
        'utf-8'
      );
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await formalizer.initialize(mockConfig);
      await formalizer.receiveTask(mockTask, mockContext);
    });

    it('should handle missing feature files gracefully', async () => {
      (fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>).mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(formalizer.executeTask()).rejects.toThrow('Failed to read BDD feature file');
    });

    it('should handle file system write errors', async () => {
      const mockClaudeResponse = {
        content: JSON.stringify({
          openApiSpec: { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' }, paths: {} },
          jsonSchemas: {},
          propertyTestStubs: []
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        model: 'claude-3-sonnet-20240229'
      };

      mockClaudeClient.sendMessage.mockResolvedValue(mockClaudeResponse);
      
      (fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>).mockImplementation(() => {
        throw new Error('Write permission denied');
      });

      await expect(formalizer.executeTask()).rejects.toThrow('Failed to write contract files');
    });

    it('should handle Cognitive Canvas connection errors', async () => {
      const mockClaudeResponse = {
        content: JSON.stringify({
          openApiSpec: { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' }, paths: {} },
          jsonSchemas: {},
          propertyTestStubs: []
        }),
        tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        model: 'claude-3-sonnet-20240229'
      };

      mockClaudeClient.sendMessage.mockResolvedValue(mockClaudeResponse);
      mockCognitiveCanvas.createContract.mockRejectedValue(new Error('Database connection failed'));

      // Should not throw - Cognitive Canvas errors should not fail the main task
      const result = await formalizer.executeTask();
      expect(result).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    beforeEach(async () => {
      await formalizer.initialize(mockConfig);
    });

    it('should handle complex multi-feature BDD scenarios', async () => {
      const complexBDDContent = `
Feature: User Management
  Scenario: User registration
    Given I am a new user
    When I register with valid information
    Then I should receive a confirmation email

Feature: Product Catalog
  Scenario: Browse products
    Given I am an authenticated user
    When I browse the product catalog
    Then I should see available products

Feature: Order Processing
  Scenario: Place order
    Given I have items in my cart
    When I place an order
    Then I should receive order confirmation
      `;

      (fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>).mockReturnValue(complexBDDContent);

      const complexTask = {
        ...mockTask,
        description: 'Formalize multi-feature e-commerce system'
      };

      const complexContext = {
        ...mockContext,
        featureFiles: ['/workspace/features/user-management.feature', '/workspace/features/products.feature', '/workspace/features/orders.feature']
      };

      await formalizer.receiveTask(complexTask, complexContext);

      const mockClaudeResponse = {
        content: JSON.stringify({
          openApiSpec: {
            openapi: '3.0.0',
            info: { title: 'E-commerce API', version: '1.0.0' },
            paths: {
              '/users/register': { post: {} },
              '/products': { get: {} },
              '/orders': { post: {} }
            }
          },
          jsonSchemas: {
            User: { type: 'object' },
            Product: { type: 'object' },
            Order: { type: 'object' }
          },
          propertyTestStubs: [
            { name: 'user_registration_test', description: 'Test user registration', properties: [] },
            { name: 'product_listing_test', description: 'Test product listing', properties: [] },
            { name: 'order_creation_test', description: 'Test order creation', properties: [] }
          ]
        }),
        tokenUsage: { inputTokens: 1000, outputTokens: 1500, totalTokens: 2500 },
        model: 'claude-3-sonnet-20240229'
      };

      mockClaudeClient.sendMessage.mockResolvedValue(mockClaudeResponse);

      const result = await formalizer.executeTask();

      expect(result).toBeDefined();
      expect(result.metadata.processedFeatures).toBe(3);
      expect(Object.keys(result.openApiSpec.paths)).toHaveLength(3);
      expect(Object.keys(result.jsonSchemas)).toHaveLength(3);
      expect(result.propertyTestStubs).toHaveLength(3);
    });
  });
});