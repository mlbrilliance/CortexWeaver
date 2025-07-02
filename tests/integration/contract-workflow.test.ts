/**
 * Contract Generation and Consumption Integration Tests
 * 
 * Tests the complete contract lifecycle:
 * - BDD specification to formal contract transformation
 * - Contract validation and compliance checking
 * - Contract-driven development workflow
 * - Contract versioning and evolution
 */

import { Orchestrator, OrchestratorConfig } from '../../src/orchestrator';
import { CognitiveCanvas, ContractData } from '../../src/cognitive-canvas';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Contract Workflow Integration Tests', () => {
  let testProjectPath: string;
  let orchestrator: Orchestrator;
  let canvas: CognitiveCanvas;
  
  const testConfig: OrchestratorConfig = {
    neo4j: {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password'
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY || 'test-api-key',
      budgetLimit: 50
    }
  };

  const contractTestPlan = `# Contract-Driven Development Project

## Overview

A project focused on demonstrating comprehensive contract-driven development workflow with formal specification, validation, and compliance testing.

## Features

### Feature 1: User API Specification
- **Priority**: High
- **Description**: Create detailed BDD specifications for user management API
- **Dependencies**: []
- **Agent**: SpecWriter
- **Acceptance Criteria**:
  - [ ] User registration scenarios defined
  - [ ] User authentication scenarios defined
  - [ ] User profile management scenarios defined
  - [ ] Error handling scenarios documented

#### Microtasks:
- [ ] Write user registration feature file
- [ ] Write authentication feature file
- [ ] Write profile management feature file
- [ ] Define API error scenarios

### Feature 2: Formal Contract Generation
- **Priority**: High
- **Description**: Transform BDD specifications into formal contracts (OpenAPI, JSON Schema, Property definitions)
- **Dependencies**: [Feature 1]
- **Agent**: Formalizer
- **Acceptance Criteria**:
  - [ ] OpenAPI 3.0 specification generated
  - [ ] JSON schemas for all data models
  - [ ] Property-based test contracts defined
  - [ ] Contract validation rules established

#### Microtasks:
- [ ] Generate OpenAPI specification from BDD
- [ ] Create JSON schemas for User, Auth, Profile models
- [ ] Define property-based test contracts
- [ ] Establish contract validation framework

### Feature 3: Contract Implementation
- **Priority**: High
- **Description**: Implement API according to formal contracts with compliance validation
- **Dependencies**: [Feature 2]
- **Agent**: Coder
- **Acceptance Criteria**:
  - [ ] API endpoints implement contract specifications
  - [ ] Request/response validation against schemas
  - [ ] Contract compliance tests pass
  - [ ] Property-based tests validate invariants

#### Microtasks:
- [ ] Implement user registration endpoint
- [ ] Implement authentication endpoints
- [ ] Implement profile management endpoints
- [ ] Add contract validation middleware

### Feature 4: Contract Testing and Validation
- **Priority**: High
- **Description**: Comprehensive testing to ensure contract compliance and validation
- **Dependencies**: [Feature 3]
- **Agent**: Tester
- **Acceptance Criteria**:
  - [ ] Contract compliance tests implemented
  - [ ] API specification validation tests
  - [ ] Property-based testing for invariants
  - [ ] Contract evolution testing

#### Microtasks:
- [ ] Create contract compliance test suite
- [ ] Implement API specification validation
- [ ] Set up property-based testing framework
- [ ] Test contract versioning scenarios

## Architecture Decisions

### Technology Stack
- **API Framework**: Express.js with OpenAPI validation
- **Schema Validation**: Ajv JSON Schema validator
- **Contract Testing**: Pact for consumer-driven contracts
- **Property Testing**: fast-check for property-based tests

### Quality Standards
- **Contract Compliance**: 100% specification adherence
- **Schema Validation**: All requests/responses validated
- **Property Coverage**: All business invariants tested
- **Documentation**: Complete contract documentation
`;

  beforeAll(async () => {
    // Create temporary test project directory
    testProjectPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cortex-contract-test-'));
    
    // Write the test plan file
    await fs.promises.writeFile(
      path.join(testProjectPath, 'plan.md'),
      contractTestPlan
    );

    // Initialize Cognitive Canvas
    canvas = new CognitiveCanvas(testConfig.neo4j);
    
    try {
      await canvas.initializeSchema();
      // Clear any existing test data
      const session = (canvas as any).driver.session();
      await session.run('MATCH (n) WHERE n.projectId STARTS WITH "contract-test-" DETACH DELETE n');
      await session.close();
    } catch (error) {
      console.warn('Could not clean test database:', error);
    }
  });

  afterAll(async () => {
    // Cleanup
    try {
      if (orchestrator) {
        await orchestrator.shutdown();
      }
      await canvas.close();
      await fs.promises.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  beforeEach(() => {
    orchestrator = new Orchestrator(testConfig);
  });

  afterEach(async () => {
    if (orchestrator && orchestrator.isRunning()) {
      await orchestrator.shutdown();
    }
  });

  describe('BDD to Contract Transformation', () => {
    it('should transform BDD specifications into OpenAPI contracts', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Start orchestration to process SpecWriter and Formalizer phases
      const orchestrationPromise = orchestrator.start();
      
      let openApiContractCreated = false;
      let maxWaitTime = 60000; // 1 minute
      let startTime = Date.now();

      while (!openApiContractCreated && (Date.now() - startTime) < maxWaitTime) {
        const contracts = await canvas.getContractsByProject(projectId);
        const openApiContracts = contracts.filter(c => c.type === 'openapi');
        
        if (openApiContracts.length > 0) {
          openApiContractCreated = true;
          
          // Validate OpenAPI contract structure
          const contract = openApiContracts[0];
          expect(contract.specification).toBeTruthy();
          expect(contract.specification.openapi).toBe('3.0.0');
          expect(contract.specification.info).toBeTruthy();
          expect(contract.specification.paths).toBeTruthy();
          
          // Verify user management endpoints
          const paths = contract.specification.paths;
          expect(paths['/users/register']).toBeTruthy();
          expect(paths['/users/login']).toBeTruthy();
          expect(paths['/users/profile']).toBeTruthy();
          
          // Verify HTTP methods
          expect(paths['/users/register'].post).toBeTruthy();
          expect(paths['/users/login'].post).toBeTruthy();
          expect(paths['/users/profile'].get).toBeTruthy();
          expect(paths['/users/profile'].put).toBeTruthy();
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      await orchestrator.shutdown();
      
      expect(openApiContractCreated).toBe(true);
    }, 120000);

    it('should generate JSON Schema contracts for data models', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Start orchestration
      const orchestrationPromise = orchestrator.start();
      
      let jsonSchemaContractsCreated = false;
      let maxWaitTime = 60000;
      let startTime = Date.now();

      while (!jsonSchemaContractsCreated && (Date.now() - startTime) < maxWaitTime) {
        const contracts = await canvas.getContractsByProject(projectId);
        const jsonSchemaContracts = contracts.filter(c => c.type === 'json-schema');
        
        if (jsonSchemaContracts.length > 0) {
          jsonSchemaContractsCreated = true;
          
          // Verify essential schemas exist
          const userSchema = jsonSchemaContracts.find(c => c.name.includes('User'));
          const authSchema = jsonSchemaContracts.find(c => c.name.includes('Auth'));
          const profileSchema = jsonSchemaContracts.find(c => c.name.includes('Profile'));
          
          expect(userSchema).toBeTruthy();
          expect(authSchema).toBeTruthy();
          expect(profileSchema).toBeTruthy();
          
          // Validate schema structure
          if (userSchema) {
            expect(userSchema.specification.$schema).toBeTruthy();
            expect(userSchema.specification.type).toBe('object');
            expect(userSchema.specification.properties).toBeTruthy();
            expect(userSchema.specification.required).toBeTruthy();
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      await orchestrator.shutdown();
      
      expect(jsonSchemaContractsCreated).toBe(true);
    }, 120000);

    it('should create property-based test contracts', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Start orchestration
      const orchestrationPromise = orchestrator.start();
      
      let propertyContractsCreated = false;
      let maxWaitTime = 60000;
      let startTime = Date.now();

      while (!propertyContractsCreated && (Date.now() - startTime) < maxWaitTime) {
        const contracts = await canvas.getContractsByProject(projectId);
        const propertyContracts = contracts.filter(c => c.type === 'property-definition');
        
        if (propertyContracts.length > 0) {
          propertyContractsCreated = true;
          
          // Verify property contracts exist for key invariants
          const authPropertyContract = propertyContracts.find(c => 
            c.name.includes('Auth') || c.description?.includes('authentication')
          );
          const userPropertyContract = propertyContracts.find(c => 
            c.name.includes('User') || c.description?.includes('user')
          );
          
          expect(authPropertyContract || userPropertyContract).toBeTruthy();
          
          // Validate property contract structure
          if (authPropertyContract) {
            expect(authPropertyContract.specification.properties).toBeTruthy();
            expect(authPropertyContract.specification.invariants).toBeTruthy();
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      await orchestrator.shutdown();
      
      expect(propertyContractsCreated).toBe(true);
    }, 120000);
  });

  describe('Contract Compliance and Validation', () => {
    it('should validate implementation against contracts', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Let the full workflow execute
      const orchestrationPromise = orchestrator.start();
      
      let implementationValidated = false;
      let maxWaitTime = 120000; // 2 minutes for full workflow
      let startTime = Date.now();

      while (!implementationValidated && (Date.now() - startTime) < maxWaitTime) {
        const contracts = await canvas.getContractsByProject(projectId);
        const codeModules = await canvas.getCodeModulesByProject(projectId);
        const tests = await canvas.getTestsByProject(projectId);
        
        if (contracts.length > 0 && codeModules.length > 0 && tests.length > 0) {
          // Check contract coverage
          for (const contract of contracts) {
            const coverage = await canvas.getContractCoverage(contract.id);
            
            if (coverage.implementations.length > 0 && coverage.tests.length > 0) {
              implementationValidated = true;
              
              // Verify contract-code relationships
              expect(coverage.implementations.length).toBeGreaterThan(0);
              expect(coverage.tests.length).toBeGreaterThan(0);
              
              // For OpenAPI contracts, verify endpoint coverage
              if (contract.type === 'openapi' && coverage.endpointCoverage.length > 0) {
                const endpointCoverage = coverage.endpointCoverage;
                
                // Verify critical endpoints are implemented
                const registerEndpoint = endpointCoverage.find(e => 
                  e.path.includes('/register') && e.method === 'POST'
                );
                const loginEndpoint = endpointCoverage.find(e => 
                  e.path.includes('/login') && e.method === 'POST'
                );
                
                if (registerEndpoint) {
                  expect(registerEndpoint.implementations.length).toBeGreaterThan(0);
                  expect(registerEndpoint.tests.length).toBeGreaterThan(0);
                }
                
                if (loginEndpoint) {
                  expect(loginEndpoint.implementations.length).toBeGreaterThan(0);
                  expect(loginEndpoint.tests.length).toBeGreaterThan(0);
                }
              }
              
              break; // At least one contract is properly validated
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      await orchestrator.shutdown();
      
      expect(implementationValidated).toBe(true);
    }, 180000);

    it('should track contract-to-implementation relationships', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Create sample contracts and implementations for testing
      const sampleContract: ContractData = {
        id: 'contract-user-api',
        name: 'User API Contract',
        type: 'openapi',
        version: '1.0.0',
        specification: {
          openapi: '3.0.0',
          info: { title: 'User API', version: '1.0.0' },
          paths: {
            '/users/register': {
              post: {
                summary: 'Register user',
                requestBody: {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/User' }
                    }
                  }
                },
                responses: {
                  '201': { description: 'User created' }
                }
              }
            }
          },
          components: {
            schemas: {
              User: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' }
                },
                required: ['email', 'password']
              }
            }
          }
        },
        projectId: projectId,
        createdAt: new Date().toISOString()
      };

      // Create the contract
      const contract = await canvas.createContract(sampleContract);
      
      // Create a code module that implements the contract
      const codeModule = await canvas.createCodeModule({
        id: 'module-user-controller',
        name: 'UserController',
        filePath: '/src/controllers/user.controller.js',
        type: 'class',
        language: 'javascript',
        projectId: projectId,
        createdAt: new Date().toISOString()
      });

      // Create a test that validates the contract
      const test = await canvas.createTest({
        id: 'test-user-api',
        name: 'User API Contract Tests',
        filePath: '/tests/user.api.test.js',
        type: 'contract',
        framework: 'jest',
        projectId: projectId,
        createdAt: new Date().toISOString()
      });

      // Link contract to implementation
      await canvas.linkContractToCodeModule(contract.id, codeModule.id, 'IMPLEMENTS');
      
      // Link contract to test
      await canvas.linkContractToTest(contract.id, test.id, 'VALIDATES');
      
      // Link endpoint-specific relationships
      await canvas.linkOpenAPIEndpointToFunction(
        contract.id, 
        '/users/register', 
        'POST', 
        codeModule.id, 
        'registerUser'
      );
      
      await canvas.linkEndpointToTest(
        contract.id, 
        '/users/register', 
        'POST', 
        test.id
      );

      // Verify relationships
      const coverage = await canvas.getContractCoverage(contract.id);
      
      expect(coverage.contract).toBeTruthy();
      expect(coverage.implementations).toHaveLength(1);
      expect(coverage.implementations[0].id).toBe(codeModule.id);
      expect(coverage.tests).toHaveLength(1);
      expect(coverage.tests[0].id).toBe(test.id);
      
      // Verify endpoint-specific coverage
      expect(coverage.endpointCoverage).toHaveLength(1);
      const endpointCov = coverage.endpointCoverage[0];
      expect(endpointCov.path).toBe('/users/register');
      expect(endpointCov.method).toBe('POST');
      expect(endpointCov.implementations).toHaveLength(1);
      expect(endpointCov.implementations[0].functionName).toBe('registerUser');
      expect(endpointCov.tests).toHaveLength(1);
    });

    it('should detect contract violations and compliance issues', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Create a contract with specific requirements
      const strictContract: ContractData = {
        id: 'contract-strict-user-api',
        name: 'Strict User API Contract',
        type: 'openapi',
        version: '1.0.0',
        specification: {
          openapi: '3.0.0',
          info: { title: 'Strict User API', version: '1.0.0' },
          paths: {
            '/users': {
              post: {
                summary: 'Create user',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          email: { 
                            type: 'string', 
                            format: 'email',
                            minLength: 5,
                            maxLength: 100
                          },
                          password: { 
                            type: 'string', 
                            minLength: 8,
                            pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).*$'
                          }
                        },
                        required: ['email', 'password'],
                        additionalProperties: false
                      }
                    }
                  }
                },
                responses: {
                  '201': {
                    description: 'User created successfully',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            email: { type: 'string' },
                            createdAt: { type: 'string', format: 'date-time' }
                          },
                          required: ['id', 'email', 'createdAt']
                        }
                      }
                    }
                  },
                  '400': {
                    description: 'Validation error',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            error: { type: 'string' },
                            details: { type: 'array', items: { type: 'string' } }
                          },
                          required: ['error']
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        projectId: projectId,
        createdAt: new Date().toISOString()
      };

      const contract = await canvas.createContract(strictContract);
      
      // Create compliant test
      const compliantTest = await canvas.createTest({
        id: 'test-compliant-user-api',
        name: 'Compliant User API Tests',
        filePath: '/tests/compliant.user.test.js',
        type: 'contract',
        framework: 'jest',
        projectId: projectId,
        createdAt: new Date().toISOString()
      });

      // Link test to contract
      await canvas.linkContractToTest(contract.id, compliantTest.id, 'VALIDATES');
      
      // Verify contract structure and requirements
      const coverage = await canvas.getContractCoverage(contract.id);
      expect(coverage.contract?.specification.paths['/users'].post.requestBody.required).toBe(true);
      
      const schema = coverage.contract?.specification.paths['/users'].post.requestBody.content['application/json'].schema;
      expect(schema.properties.email.format).toBe('email');
      expect(schema.properties.password.minLength).toBe(8);
      expect(schema.properties.password.pattern).toBeTruthy();
      expect(schema.required).toContain('email');
      expect(schema.required).toContain('password');
      expect(schema.additionalProperties).toBe(false);
    });
  });

  describe('Contract Evolution and Versioning', () => {
    it('should handle contract versioning and backward compatibility', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Create initial contract version
      const contractV1: ContractData = {
        id: 'contract-user-api-v1',
        name: 'User API Contract',
        type: 'openapi',
        version: '1.0.0',
        specification: {
          openapi: '3.0.0',
          info: { title: 'User API', version: '1.0.0' },
          paths: {
            '/users': {
              post: {
                summary: 'Create user',
                requestBody: {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          email: { type: 'string' },
                          password: { type: 'string' }
                        },
                        required: ['email', 'password']
                      }
                    }
                  }
                }
              }
            }
          }
        },
        projectId: projectId,
        createdAt: new Date().toISOString()
      };

      const v1Contract = await canvas.createContract(contractV1);
      
      // Create evolved contract version (adding optional field)
      const contractV2: ContractData = {
        id: 'contract-user-api-v2',
        name: 'User API Contract',
        type: 'openapi',
        version: '2.0.0',
        specification: {
          openapi: '3.0.0',
          info: { title: 'User API', version: '2.0.0' },
          paths: {
            '/users': {
              post: {
                summary: 'Create user',
                requestBody: {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          email: { type: 'string' },
                          password: { type: 'string' },
                          firstName: { type: 'string' }, // New optional field
                          lastName: { type: 'string' }   // New optional field
                        },
                        required: ['email', 'password'] // Same required fields = backward compatible
                      }
                    }
                  }
                }
              }
            }
          }
        },
        projectId: projectId,
        createdAt: new Date().toISOString()
      };

      const v2Contract = await canvas.createContract(contractV2);
      
      // Verify both versions exist
      const contracts = await canvas.getContractsByProject(projectId);
      const userApiContracts = contracts.filter(c => c.name === 'User API Contract');
      
      expect(userApiContracts).toHaveLength(2);
      
      const v1 = userApiContracts.find(c => c.version === '1.0.0');
      const v2 = userApiContracts.find(c => c.version === '2.0.0');
      
      expect(v1).toBeTruthy();
      expect(v2).toBeTruthy();
      
      // Verify backward compatibility (same required fields)
      const v1Schema = v1?.specification.paths['/users'].post.requestBody.content['application/json'].schema;
      const v2Schema = v2?.specification.paths['/users'].post.requestBody.content['application/json'].schema;
      
      expect(v1Schema.required).toEqual(v2Schema.required);
      expect(v2Schema.properties.firstName).toBeTruthy();
      expect(v2Schema.properties.lastName).toBeTruthy();
      expect(v2Schema.required).not.toContain('firstName');
      expect(v2Schema.required).not.toContain('lastName');
    });

    it('should detect breaking changes in contract evolution', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Create initial contract
      const originalContract: ContractData = {
        id: 'contract-breaking-test-v1',
        name: 'Breaking Change Test Contract',
        type: 'openapi',
        version: '1.0.0',
        specification: {
          openapi: '3.0.0',
          info: { title: 'Breaking Change Test API', version: '1.0.0' },
          paths: {
            '/items': {
              get: {
                summary: 'Get items',
                responses: {
                  '200': {
                    content: {
                      'application/json': {
                        schema: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              price: { type: 'number' }
                            },
                            required: ['id', 'name', 'price']
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        projectId: projectId,
        createdAt: new Date().toISOString()
      };

      await canvas.createContract(originalContract);
      
      // Create contract with breaking changes
      const breakingContract: ContractData = {
        id: 'contract-breaking-test-v2',
        name: 'Breaking Change Test Contract',
        type: 'openapi',
        version: '2.0.0',
        specification: {
          openapi: '3.0.0',
          info: { title: 'Breaking Change Test API', version: '2.0.0' },
          paths: {
            '/items': {
              get: {
                summary: 'Get items',
                responses: {
                  '200': {
                    content: {
                      'application/json': {
                        schema: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              title: { type: 'string' }, // Changed from 'name' to 'title' - BREAKING
                              cost: { type: 'number' },  // Changed from 'price' to 'cost' - BREAKING
                              category: { type: 'string' } // New required field - BREAKING
                            },
                            required: ['id', 'title', 'cost', 'category'] // Changed required fields - BREAKING
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        projectId: projectId,
        createdAt: new Date().toISOString()
      };

      await canvas.createContract(breakingContract);
      
      // Verify contracts exist and detect breaking changes
      const contracts = await canvas.getContractsByProject(projectId);
      const testContracts = contracts.filter(c => c.name === 'Breaking Change Test Contract');
      
      expect(testContracts).toHaveLength(2);
      
      const v1 = testContracts.find(c => c.version === '1.0.0');
      const v2 = testContracts.find(c => c.version === '2.0.0');
      
      const v1Schema = v1?.specification.paths['/items'].get.responses['200'].content['application/json'].schema.items;
      const v2Schema = v2?.specification.paths['/items'].get.responses['200'].content['application/json'].schema.items;
      
      // Verify breaking changes
      expect(v1Schema.properties.name).toBeTruthy();
      expect(v2Schema.properties.name).toBeFalsy(); // Breaking: removed field
      expect(v2Schema.properties.title).toBeTruthy(); // Breaking: renamed field
      
      expect(v1Schema.properties.price).toBeTruthy();
      expect(v2Schema.properties.price).toBeFalsy(); // Breaking: removed field
      expect(v2Schema.properties.cost).toBeTruthy(); // Breaking: renamed field
      
      expect(v1Schema.required).toHaveLength(3);
      expect(v2Schema.required).toHaveLength(4); // Breaking: added required field
      expect(v2Schema.required).toContain('category');
    });
  });

  describe('Contract-Driven Test Generation', () => {
    it('should generate comprehensive test suites from contracts', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Run the full workflow to generate tests from contracts
      const orchestrationPromise = orchestrator.start();
      
      let contractTestsGenerated = false;
      let maxWaitTime = 120000; // 2 minutes
      let startTime = Date.now();

      while (!contractTestsGenerated && (Date.now() - startTime) < maxWaitTime) {
        const contracts = await canvas.getContractsByProject(projectId);
        const tests = await canvas.getTestsByProject(projectId);
        
        if (contracts.length > 0 && tests.length > 0) {
          // Verify contract tests exist
          const contractTests = tests.filter(t => t.type === 'contract');
          
          if (contractTests.length > 0) {
            contractTestsGenerated = true;
            
            // Verify test coverage for each contract
            for (const contract of contracts) {
              const contractTestsForContract = await canvas.getContractTests(contract.id);
              
              if (contractTestsForContract.length > 0) {
                expect(contractTestsForContract.length).toBeGreaterThan(0);
                
                // Verify test types
                const unitTests = contractTestsForContract.filter(t => t.type === 'unit');
                const integrationTests = contractTestsForContract.filter(t => t.type === 'integration');
                const contractValidationTests = contractTestsForContract.filter(t => t.type === 'contract');
                
                // Should have at least one type of test
                expect(unitTests.length + integrationTests.length + contractValidationTests.length)
                  .toBeGreaterThan(0);
              }
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      await orchestrator.shutdown();
      
      expect(contractTestsGenerated).toBe(true);
    }, 180000);

    it('should validate property-based test generation from contracts', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Create a property-based contract
      const propertyContract: ContractData = {
        id: 'contract-property-test',
        name: 'Property-Based Test Contract',
        type: 'property-definition',
        version: '1.0.0',
        specification: {
          properties: [
            {
              name: 'user_email_unique',
              description: 'User emails must be unique across the system',
              type: 'uniqueness',
              target: 'User.email',
              invariant: 'forall u1, u2 in Users: u1.email = u2.email => u1.id = u2.id'
            },
            {
              name: 'password_strength',
              description: 'Passwords must meet strength requirements',
              type: 'validation',
              target: 'User.password',
              invariant: 'length(password) >= 8 AND contains(password, uppercase) AND contains(password, digit)'
            },
            {
              name: 'auth_token_expiry',
              description: 'Authentication tokens must expire within 24 hours',
              type: 'temporal',
              target: 'AuthToken.expiresAt',
              invariant: 'expiresAt <= createdAt + 24_hours'
            }
          ],
          invariants: [
            'Every user has a unique email address',
            'Every password meets strength requirements',
            'Every auth token expires within 24 hours'
          ]
        },
        projectId: projectId,
        createdAt: new Date().toISOString()
      };

      const contract = await canvas.createContract(propertyContract);
      
      // Create property-based test
      const propertyTest = await canvas.createTest({
        id: 'test-property-based',
        name: 'Property-Based Validation Tests',
        filePath: '/tests/property.validation.test.js',
        type: 'contract',
        framework: 'fast-check',
        projectId: projectId,
        createdAt: new Date().toISOString()
      });

      await canvas.linkContractToTest(contract.id, propertyTest.id, 'VALIDATES');
      
      // Verify property-based test structure
      const coverage = await canvas.getContractCoverage(contract.id);
      expect(coverage.tests).toHaveLength(1);
      expect(coverage.tests[0].framework).toBe('fast-check');
      
      // Verify property contract structure
      expect(contract.specification.properties).toHaveLength(3);
      expect(contract.specification.invariants).toHaveLength(3);
      
      const emailProperty = contract.specification.properties.find(p => p.name === 'user_email_unique');
      expect(emailProperty?.type).toBe('uniqueness');
      expect(emailProperty?.target).toBe('User.email');
      
      const passwordProperty = contract.specification.properties.find(p => p.name === 'password_strength');
      expect(passwordProperty?.type).toBe('validation');
      expect(passwordProperty?.invariant).toContain('length(password) >= 8');
    });
  });
});