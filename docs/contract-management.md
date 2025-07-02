# Contract Management in Cognitive Canvas

This document describes how to use the extended Cognitive Canvas to store relationships between contracts, code modules, and tests as required by the **Specification-Driven Development (SDD)** approach.

> **Note**: For a complete overview of the SDD workflow, see [SDD_WORKFLOW.md](../.claude/SDD_WORKFLOW.md).

## Overview

The Cognitive Canvas has been extended to support Specification-Driven Development (SDD), which addresses **"The Oracle's Dilemma"** - the challenge of providing unambiguous specifications to AI agents. Instead of relying on natural language requirements that can be interpreted differently, SDD uses formal contracts stored in the Cognitive Canvas as the single source of truth.

The Cognitive Canvas has been extended to support:

- **Contract nodes**: OpenAPI specs, JSON schemas, and property definitions
- **Code Module nodes**: Functions, classes, modules, and components that implement contracts
- **Test nodes**: Unit, integration, e2e, and contract tests that validate implementations
- **Rich relationships**: Links between contracts, features, implementations, and tests
- **SDD Workflow Tracking**: Complete traceability from BDD scenarios to formal contracts to implementation

## Key Features

### Contract Types Supported

1. **OpenAPI contracts**: REST API specifications with endpoint-to-function mapping
2. **JSON Schema contracts**: Data structure definitions
3. **Property Definition contracts**: Formal property specifications

### Relationship Types

- `DEFINES`: Contract defines a feature/task
- `IMPLEMENTS`: Code module implements a contract
- `USES`: Code module uses/depends on a contract
- `VALIDATES`: Test validates a contract
- `TESTS`: Test validates a code module
- `IMPLEMENTS_ENDPOINT`: Specific endpoint implementation (OpenAPI)
- `TESTS_ENDPOINT`: Specific endpoint testing (OpenAPI)

## API Reference

### Contract Management

```typescript
// Create a contract
const contract = await canvas.createContract({
  id: 'user-api-v1',
  name: 'User API Contract',
  type: 'openapi',
  version: '1.0.0',
  specification: { /* OpenAPI spec */ },
  description: 'User management API contract',
  projectId: 'project-1',
  createdAt: new Date().toISOString()
});

// Get contract by ID
const contract = await canvas.getContract('user-api-v1');

// Update contract
const updated = await canvas.updateContract('user-api-v1', {
  version: '1.1.0',
  description: 'Updated user API contract'
});

// Get all contracts for a project
const contracts = await canvas.getContractsByProject('project-1');
```

### Code Module Management

```typescript
// Create a code module
const module = await canvas.createCodeModule({
  id: 'user-controller',
  name: 'UserController',
  filePath: '/src/controllers/UserController.ts',
  type: 'class',
  language: 'typescript',
  projectId: 'project-1',
  createdAt: new Date().toISOString()
});

// Get module by ID
const module = await canvas.getCodeModule('user-controller');

// Update module
const updated = await canvas.updateCodeModule('user-controller', {
  filePath: '/src/controllers/v2/UserController.ts'
});

// Get all modules for a project
const modules = await canvas.getCodeModulesByProject('project-1');
```

### Test Management

```typescript
// Create a test
const test = await canvas.createTest({
  id: 'user-api-tests',
  name: 'User API Contract Tests',
  filePath: '/tests/contracts/user-api.test.ts',
  type: 'contract',
  framework: 'jest-supertest',
  projectId: 'project-1',
  createdAt: new Date().toISOString()
});

// Get test by ID
const test = await canvas.getTest('user-api-tests');

// Update test
const updated = await canvas.updateTest('user-api-tests', {
  framework: 'playwright'
});

// Get all tests for a project
const tests = await canvas.getTestsByProject('project-1');
```

### Creating Relationships

```typescript
// Link contract to feature/task
await canvas.linkContractToFeature('contract-1', 'feature-1');

// Link contract to code module
await canvas.linkContractToCodeModule('contract-1', 'module-1', 'IMPLEMENTS');

// Link contract to test
await canvas.linkContractToTest('contract-1', 'test-1', 'VALIDATES');

// Link code module to test
await canvas.linkCodeModuleToTest('module-1', 'test-1');

// OpenAPI-specific: Link endpoint to function
await canvas.linkOpenAPIEndpointToFunction(
  'contract-1',
  '/users/{id}',
  'GET',
  'user-controller',
  'getUserById'
);

// OpenAPI-specific: Link endpoint to test
await canvas.linkEndpointToTest(
  'contract-1',
  '/users/{id}',
  'GET',
  'endpoint-test-1'
);
```

### Querying Relationships

```typescript
// Get all implementations of a contract
const implementations = await canvas.getContractImplementations('contract-1');

// Get all tests for a contract
const tests = await canvas.getContractTests('contract-1');

// Get all features defined by a contract
const features = await canvas.getContractFeatures('contract-1');

// Get all contracts implemented by a code module
const contracts = await canvas.getCodeModuleContracts('module-1');

// Get all contracts validated by a test
const contracts = await canvas.getTestContracts('test-1');

// Get all tests for a code module
const tests = await canvas.getCodeModuleTests('module-1');
```

### OpenAPI-Specific Queries

```typescript
// Get implementations for a specific endpoint
const implementations = await canvas.getEndpointImplementations(
  'contract-1',
  '/users/{id}',
  'GET'
);
// Returns: [{ module: CodeModuleData, functionName: string }]

// Get tests for a specific endpoint
const tests = await canvas.getEndpointTests(
  'contract-1',
  '/users/{id}',
  'GET'
);
```

### Contract Coverage Analysis

```typescript
// Get comprehensive coverage analysis
const coverage = await canvas.getContractCoverage('contract-1');

console.log(coverage);
// {
//   contract: ContractData,
//   implementations: CodeModuleData[],
//   tests: TestData[],
//   features: TaskData[],
//   endpointCoverage: [{
//     path: '/users/{id}',
//     method: 'GET',
//     implementations: [{ module: CodeModuleData, functionName: 'getUserById' }],
//     tests: TestData[]
//   }]
// }
```

### Knowledge Graph Integration

The extended knowledge graph now includes contracts, code modules, and tests:

```typescript
const knowledgeGraph = await canvas.getProjectKnowledgeGraph('project-1');

console.log(knowledgeGraph);
// {
//   project: ProjectData,
//   tasks: TaskData[],
//   agents: AgentData[],
//   pheromones: PheromoneData[],
//   decisions: ArchitecturalDecisionData[],
//   contracts: ContractData[],      // NEW
//   codeModules: CodeModuleData[],  // NEW
//   tests: TestData[]               // NEW
// }
```

## Integration with SDD Workflow

### 1. Contract-First Development

```typescript
// 1. Create OpenAPI contract
const apiContract = await canvas.createContract({
  id: 'user-api-v1',
  name: 'User Management API',
  type: 'openapi',
  specification: openApiSpec,
  // ...
});

// 2. Link to feature requirements
await canvas.linkContractToFeature(apiContract.id, 'user-management-feature');

// 3. Create implementation stubs
const controller = await canvas.createCodeModule({
  id: 'user-controller',
  name: 'UserController',
  // ...
});

// 4. Link specific endpoints
await canvas.linkOpenAPIEndpointToFunction(
  apiContract.id,
  '/users',
  'POST',
  controller.id,
  'createUser'
);
```

### 2. Test-Driven Contract Validation

```typescript
// 1. Create contract tests
const contractTest = await canvas.createTest({
  id: 'user-api-contract-test',
  name: 'User API Contract Validation',
  type: 'contract',
  // ...
});

// 2. Link to contract
await canvas.linkContractToTest(apiContract.id, contractTest.id, 'VALIDATES');

// 3. Link specific endpoint tests
await canvas.linkEndpointToTest(
  apiContract.id,
  '/users',
  'POST',
  contractTest.id
);
```

### 3. Coverage Analysis

```typescript
// Analyze contract implementation coverage
const coverage = await canvas.getContractCoverage('user-api-v1');

// Check for missing implementations
const missingEndpoints = coverage.endpointCoverage.filter(
  endpoint => endpoint.implementations.length === 0
);

// Check for untested endpoints
const untestedEndpoints = coverage.endpointCoverage.filter(
  endpoint => endpoint.tests.length === 0
);

console.log('Missing implementations:', missingEndpoints.length);
console.log('Untested endpoints:', untestedEndpoints.length);
```

## Best Practices

### 1. Contract Versioning
- Always version your contracts
- Create new contract nodes for breaking changes
- Use semantic versioning (e.g., "1.0.0", "1.1.0", "2.0.0")

### 2. Relationship Management
- Link contracts to features/tasks for traceability
- Use `IMPLEMENTS` for direct implementations
- Use `USES` for dependencies
- Create both general and endpoint-specific relationships for OpenAPI contracts

### 3. Test Organization
- Create contract tests that validate the entire specification
- Create endpoint-specific tests for detailed validation
- Link unit tests to specific code modules
- Use appropriate test types (`unit`, `integration`, `e2e`, `contract`)

### 4. Coverage Monitoring
- Regularly analyze contract coverage
- Ensure all endpoints have implementations
- Ensure all endpoints have tests
- Track coverage metrics over time

## Example Use Cases

### API Development
- Track which endpoints are implemented
- Ensure all endpoints have tests
- Monitor API contract compliance
- Generate implementation reports

### Microservices Architecture
- Track service contracts and dependencies
- Monitor inter-service contract compliance
- Analyze impact of contract changes
- Ensure comprehensive testing coverage

### Compliance and Auditing
- Demonstrate requirements traceability
- Show test coverage for contracts
- Track implementation completeness
- Generate compliance reports

## Schema Constraints

The system automatically creates these Neo4j constraints:

```cypher
CREATE CONSTRAINT contract_id IF NOT EXISTS FOR (c:Contract) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT code_module_id IF NOT EXISTS FOR (cm:CodeModule) REQUIRE cm.id IS UNIQUE;
CREATE CONSTRAINT test_id IF NOT EXISTS FOR (t:Test) REQUIRE t.id IS UNIQUE;
```

## Error Handling

The system validates:

- **Contract types**: Must be `openapi`, `json-schema`, or `property-definition`
- **Code module types**: Must be `function`, `class`, `module`, or `component`
- **Test types**: Must be `unit`, `integration`, `e2e`, or `contract`
- **Required fields**: All mandatory fields must be provided
- **Relationship integrity**: Nodes must exist before creating relationships

## Performance Considerations

- Use batched queries for large datasets
- Index frequently queried properties
- Consider Neo4j query optimization for complex relationship queries
- Monitor query performance in production environments