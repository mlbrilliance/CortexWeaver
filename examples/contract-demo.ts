/**
 * Demonstration of Contract Management in Cognitive Canvas
 * 
 * This file shows how to use the extended Cognitive Canvas to store
 * relationships between contracts, code modules, and tests as required
 * by the SDD approach.
 */

import { CognitiveCanvas, ContractData, CodeModuleData, TestData } from '../src/cognitive-canvas';

async function demonstrateContractManagement() {
  // Initialize Cognitive Canvas
  const canvas = new CognitiveCanvas({
    uri: 'bolt://localhost:7687',
    username: 'neo4j',
    password: 'password'
  });

  try {
    // Initialize schema with contract constraints
    await canvas.initializeSchema();

    // Create a project
    const project = await canvas.createProject({
      id: 'user-management-api',
      name: 'User Management API',
      description: 'REST API for user management operations',
      status: 'active',
      createdAt: new Date().toISOString()
    });

    // Create an OpenAPI contract
    const userApiContract: ContractData = {
      id: 'user-api-contract-v1',
      name: 'User API Contract',
      type: 'openapi',
      version: '1.0.0',
      specification: {
        openapi: '3.0.0',
        info: {
          title: 'User Management API',
          version: '1.0.0'
        },
        paths: {
          '/users': {
            get: {
              summary: 'Get all users',
              responses: {
                '200': {
                  description: 'List of users'
                }
              }
            },
            post: {
              summary: 'Create a new user',
              responses: {
                '201': {
                  description: 'User created successfully'
                }
              }
            }
          },
          '/users/{id}': {
            get: {
              summary: 'Get user by ID',
              responses: {
                '200': {
                  description: 'User details'
                }
              }
            }
          }
        }
      },
      description: 'OpenAPI specification for user management endpoints',
      projectId: project.id,
      createdAt: new Date().toISOString()
    };

    const contract = await canvas.createContract(userApiContract);
    console.log('Created contract:', contract.id);

    // Create code modules that implement the contract
    const userController: CodeModuleData = {
      id: 'user-controller',
      name: 'UserController',
      filePath: '/src/controllers/UserController.ts',
      type: 'class',
      language: 'typescript',
      projectId: project.id,
      createdAt: new Date().toISOString()
    };

    const userService: CodeModuleData = {
      id: 'user-service',
      name: 'UserService',
      filePath: '/src/services/UserService.ts',
      type: 'class',
      language: 'typescript',
      projectId: project.id,
      createdAt: new Date().toISOString()
    };

    await canvas.createCodeModule(userController);
    await canvas.createCodeModule(userService);
    console.log('Created code modules');

    // Create tests that validate the contract
    const contractTests: TestData = {
      id: 'user-api-contract-tests',
      name: 'User API Contract Tests',
      filePath: '/tests/contracts/user-api.test.ts',
      type: 'contract',
      framework: 'jest-supertest',
      projectId: project.id,
      createdAt: new Date().toISOString()
    };

    const unitTests: TestData = {
      id: 'user-controller-unit-tests',
      name: 'UserController Unit Tests',
      filePath: '/tests/unit/UserController.test.ts',
      type: 'unit',
      framework: 'jest',
      projectId: project.id,
      createdAt: new Date().toISOString()
    };

    await canvas.createTest(contractTests);
    await canvas.createTest(unitTests);
    console.log('Created tests');

    // Link specific OpenAPI endpoints to implementing functions
    await canvas.linkOpenAPIEndpointToFunction(
      contract.id,
      '/users',
      'GET',
      userController.id,
      'getAllUsers'
    );

    await canvas.linkOpenAPIEndpointToFunction(
      contract.id,
      '/users',
      'POST',
      userController.id,
      'createUser'
    );

    await canvas.linkOpenAPIEndpointToFunction(
      contract.id,
      '/users/{id}',
      'GET',
      userController.id,
      'getUserById'
    );

    console.log('Linked endpoints to functions');

    // Link contract to general code modules
    await canvas.linkContractToCodeModule(contract.id, userService.id, 'USES');

    // Link tests to contract and code modules
    await canvas.linkContractToTest(contract.id, contractTests.id, 'VALIDATES');
    await canvas.linkCodeModuleToTest(userController.id, unitTests.id);

    console.log('Created relationships');

    // Query contract coverage
    const coverage = await canvas.getContractCoverage(contract.id);
    console.log('\nContract Coverage Analysis:');
    console.log('Contract:', coverage.contract?.name);
    console.log('Implementations:', coverage.implementations.length);
    console.log('Tests:', coverage.tests.length);
    
    console.log('\nEndpoint Coverage:');
    coverage.endpointCoverage.forEach(endpoint => {
      console.log(`${endpoint.method} ${endpoint.path}:`);
      console.log(`  Implementations: ${endpoint.implementations.length}`);
      console.log(`  Tests: ${endpoint.tests.length}`);
      endpoint.implementations.forEach(impl => {
        console.log(`    - ${impl.module.name}.${impl.functionName}`);
      });
    });

    // Get the full knowledge graph including contracts
    const knowledgeGraph = await canvas.getProjectKnowledgeGraph(project.id);
    console.log('\nProject Knowledge Graph:');
    console.log('Contracts:', knowledgeGraph.contracts.length);
    console.log('Code Modules:', knowledgeGraph.codeModules.length);
    console.log('Tests:', knowledgeGraph.tests.length);

    // Demonstrate querying relationships
    console.log('\nRelationship Queries:');
    
    const contractImplementations = await canvas.getContractImplementations(contract.id);
    console.log('Contract implementations:', contractImplementations.map(impl => impl.name));
    
    const contractTests = await canvas.getContractTests(contract.id);
    console.log('Contract tests:', contractTests.map(test => test.name));
    
    const endpointImplementations = await canvas.getEndpointImplementations(
      contract.id,
      '/users',
      'GET'
    );
    console.log('GET /users implementations:', 
      endpointImplementations.map(impl => `${impl.module.name}.${impl.functionName}`)
    );

  } catch (error) {
    console.error('Demo failed:', error);
  } finally {
    await canvas.close();
  }
}

// Export for use in other examples
export { demonstrateContractManagement };

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateContractManagement()
    .then(() => {
      console.log('\nDemo completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Demo failed:', error);
      process.exit(1);
    });
}