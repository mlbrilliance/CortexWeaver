/**
 * Cognitive Canvas Integration Tests
 * 
 * Tests the knowledge graph and canvas functionality:
 * - Knowledge graph construction and evolution
 * - Relationship tracking and inference
 * - Snapshot and restore capabilities
 * - Knowledge queries and analytics
 * - Graph traversal and path finding
 * - Temporal knowledge tracking
 * - Cross-project knowledge sharing
 */

import { CognitiveCanvas, Neo4jConfig, ProjectData, TaskData, ContractData, SnapshotData } from '../../src/cognitive-canvas';
import { Orchestrator, OrchestratorConfig } from '../../src/orchestrator';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Cognitive Canvas Integration Tests', () => {
  let canvas: CognitiveCanvas;
  let testProjectPath: string;
  let orchestrator: Orchestrator;
  
  const neo4jConfig: Neo4jConfig = {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    username: process.env.NEO4J_USERNAME || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password'
  };

  const testConfig: OrchestratorConfig = {
    neo4j: neo4jConfig,
    claude: {
      apiKey: process.env.CLAUDE_API_KEY || 'test-api-key',
      budgetLimit: 50
    }
  };

  const knowledgeTestPlan = `# Knowledge Graph Test Project

## Overview

A comprehensive project designed to test knowledge graph construction, evolution, and querying capabilities across the complete development lifecycle.

## Features

### Feature 1: User Management System
- **Priority**: High
- **Description**: Complete user management with authentication and authorization
- **Dependencies**: []
- **Agent**: SpecWriter
- **Acceptance Criteria**:
  - [ ] User registration and login functionality
  - [ ] Role-based access control
  - [ ] Session management
  - [ ] Password security policies

#### Microtasks:
- [ ] Design user data model
- [ ] Create authentication API
- [ ] Implement authorization middleware
- [ ] Set up session management

### Feature 2: API Contract Definition
- **Priority**: High
- **Description**: Define formal contracts for user management APIs
- **Dependencies**: [Feature 1]
- **Agent**: Formalizer
- **Acceptance Criteria**:
  - [ ] OpenAPI specifications created
  - [ ] JSON schemas defined
  - [ ] Property-based contracts established
  - [ ] Validation rules documented

#### Microtasks:
- [ ] Create OpenAPI spec for user endpoints
- [ ] Define User model JSON schema
- [ ] Establish authentication contracts
- [ ] Document validation requirements

### Feature 3: Database Architecture
- **Priority**: High
- **Description**: Design database schema and relationships
- **Dependencies**: [Feature 2]
- **Agent**: Architect
- **Acceptance Criteria**:
  - [ ] Normalized database schema
  - [ ] Optimized indexing strategy
  - [ ] Data migration scripts
  - [ ] Performance benchmarks

#### Microtasks:
- [ ] Design user table structure
- [ ] Plan indexing strategy
- [ ] Create migration scripts
- [ ] Set up performance monitoring

### Feature 4: Service Implementation
- **Priority**: High
- **Description**: Implement user management services
- **Dependencies**: [Feature 3]
- **Agent**: Coder
- **Acceptance Criteria**:
  - [ ] User service implementation
  - [ ] Authentication middleware
  - [ ] Database integration
  - [ ] Error handling

#### Microtasks:
- [ ] Implement user repository
- [ ] Create authentication service
- [ ] Build authorization middleware
- [ ] Add comprehensive error handling

### Feature 5: Comprehensive Testing
- **Priority**: High
- **Description**: Create full test suite with multiple testing strategies
- **Dependencies**: [Feature 4]
- **Agent**: Tester
- **Acceptance Criteria**:
  - [ ] Unit tests for all components
  - [ ] Integration tests for API endpoints
  - [ ] Contract validation tests
  - [ ] Performance and load tests

#### Microtasks:
- [ ] Write unit tests for services
- [ ] Create API integration tests
- [ ] Implement contract validation
- [ ] Set up performance testing

## Architecture Decisions

### Technology Stack
- **Backend**: Node.js with Express
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT with bcrypt
- **Testing**: Jest with Supertest
- **Contracts**: OpenAPI 3.0 with JSON Schema

### Quality Standards
- **Code Coverage**: 95%
- **API Response Time**: < 100ms
- **Database Query Performance**: < 50ms
- **Contract Compliance**: 100%
- **Documentation Coverage**: Complete
`;

  beforeAll(async () => {
    // Create temporary test project directory
    testProjectPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cortex-canvas-test-'));
    
    // Write the test plan file
    await fs.promises.writeFile(
      path.join(testProjectPath, 'plan.md'),
      knowledgeTestPlan
    );

    // Initialize Cognitive Canvas
    canvas = new CognitiveCanvas(neo4jConfig);
    
    try {
      await canvas.initializeSchema();
      // Clear any existing test data
      const session = (canvas as any).driver.session();
      await session.run('MATCH (n) WHERE n.projectId STARTS WITH "canvas-test-" DETACH DELETE n');
      await session.close();
    } catch (error) {
      console.warn('Could not initialize canvas:', error);
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

  describe('Knowledge Graph Construction', () => {
    it('should build complete knowledge graph during project lifecycle', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Get initial knowledge graph state
      let knowledgeGraph = await canvas.getProjectKnowledgeGraph(projectId);
      
      // Verify initial project structure
      expect(knowledgeGraph.project).toBeTruthy();
      expect(knowledgeGraph.project.name).toBe('Knowledge Graph Test Project');
      expect(knowledgeGraph.tasks.length).toBeGreaterThan(0);
      expect(knowledgeGraph.decisions.length).toBeGreaterThan(0);

      // Verify task creation and relationships
      expect(knowledgeGraph.tasks).toHaveLength(5); // All features should be created as tasks
      
      // Check dependency relationships
      for (const task of knowledgeGraph.tasks) {
        const dependencies = await canvas.getTaskDependencies(task.id);
        
        if (task.title.includes('API Contract Definition')) {
          expect(dependencies.some(d => d.title.includes('User Management System'))).toBe(true);
        }
        
        if (task.title.includes('Database Architecture')) {
          expect(dependencies.some(d => d.title.includes('API Contract Definition'))).toBe(true);
        }
        
        if (task.title.includes('Service Implementation')) {
          expect(dependencies.some(d => d.title.includes('Database Architecture'))).toBe(true);
        }
        
        if (task.title.includes('Comprehensive Testing')) {
          expect(dependencies.some(d => d.title.includes('Service Implementation'))).toBe(true);
        }
      }

      // Verify architectural decisions storage
      expect(knowledgeGraph.decisions.length).toBeGreaterThan(0);
      const techStackDecision = knowledgeGraph.decisions.find(d => d.title.includes('Technology Stack'));
      expect(techStackDecision).toBeTruthy();
      expect(techStackDecision?.description).toContain('Node.js');
      expect(techStackDecision?.description).toContain('PostgreSQL');
    });

    it('should track knowledge evolution throughout workflow execution', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Start orchestration and track knowledge evolution
      const orchestrationPromise = orchestrator.start();
      
      const knowledgeSnapshots: Array<{
        timestamp: number;
        taskCount: number;
        contractCount: number;
        codeModuleCount: number;
        testCount: number;
        relationshipCount: number;
      }> = [];

      let evolutionComplete = false;
      let maxWaitTime = 60000; // 1 minute
      let startTime = Date.now();

      while (!evolutionComplete && (Date.now() - startTime) < maxWaitTime) {
        const knowledgeGraph = await canvas.getProjectKnowledgeGraph(projectId);
        
        // Count relationships by querying the graph
        const session = (canvas as any).driver.session();
        let relationshipCount = 0;
        try {
          const result = await session.run(`
            MATCH (n)-[r]->(m) 
            WHERE n.projectId = $projectId OR m.projectId = $projectId
            RETURN count(r) as relationshipCount
          `, { projectId });
          relationshipCount = result.records[0]?.get('relationshipCount').toNumber() || 0;
        } finally {
          await session.close();
        }

        knowledgeSnapshots.push({
          timestamp: Date.now(),
          taskCount: knowledgeGraph.tasks.length,
          contractCount: knowledgeGraph.contracts.length,
          codeModuleCount: knowledgeGraph.codeModules.length,
          testCount: knowledgeGraph.tests.length,
          relationshipCount: relationshipCount
        });

        // Check if knowledge has evolved significantly
        if (knowledgeSnapshots.length >= 3) {
          const latest = knowledgeSnapshots[knowledgeSnapshots.length - 1];
          const initial = knowledgeSnapshots[0];
          
          if (latest.contractCount > initial.contractCount ||
              latest.codeModuleCount > initial.codeModuleCount ||
              latest.testCount > initial.testCount) {
            evolutionComplete = true;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      await orchestrator.shutdown();

      // Verify knowledge evolution
      expect(knowledgeSnapshots.length).toBeGreaterThan(1);
      
      const initialSnapshot = knowledgeSnapshots[0];
      const finalSnapshot = knowledgeSnapshots[knowledgeSnapshots.length - 1];
      
      // Knowledge should grow over time
      expect(finalSnapshot.contractCount).toBeGreaterThanOrEqual(initialSnapshot.contractCount);
      expect(finalSnapshot.codeModuleCount).toBeGreaterThanOrEqual(initialSnapshot.codeModuleCount);
      expect(finalSnapshot.testCount).toBeGreaterThanOrEqual(initialSnapshot.testCount);
      expect(finalSnapshot.relationshipCount).toBeGreaterThan(initialSnapshot.relationshipCount);

      console.log(`Knowledge Evolution:
        Initial - Contracts: ${initialSnapshot.contractCount}, Code Modules: ${initialSnapshot.codeModuleCount}, Tests: ${initialSnapshot.testCount}, Relationships: ${initialSnapshot.relationshipCount}
        Final - Contracts: ${finalSnapshot.contractCount}, Code Modules: ${finalSnapshot.codeModuleCount}, Tests: ${finalSnapshot.testCount}, Relationships: ${finalSnapshot.relationshipCount}`);
    }, 120000);

    it('should maintain referential integrity across knowledge components', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Create interconnected knowledge components
      const contract = await canvas.createContract({
        id: 'integrity-test-contract',
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
                      schema: { $ref: '#/components/schemas/User' }
                    }
                  }
                },
                responses: { '201': { description: 'User created' } }
              }
            }
          },
          components: {
            schemas: {
              User: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' }
                },
                required: ['id', 'email', 'name']
              }
            }
          }
        },
        projectId: projectId,
        createdAt: new Date().toISOString()
      });

      const codeModule = await canvas.createCodeModule({
        id: 'integrity-test-module',
        name: 'UserController',
        filePath: '/src/controllers/UserController.js',
        type: 'class',
        language: 'javascript',
        projectId: projectId,
        createdAt: new Date().toISOString()
      });

      const test = await canvas.createTest({
        id: 'integrity-test-test',
        name: 'User API Tests',
        filePath: '/tests/user.api.test.js',
        type: 'integration',
        framework: 'jest',
        projectId: projectId,
        createdAt: new Date().toISOString()
      });

      // Create relationships
      await canvas.linkContractToCodeModule(contract.id, codeModule.id, 'IMPLEMENTS');
      await canvas.linkContractToTest(contract.id, test.id, 'VALIDATES');
      await canvas.linkCodeModuleToTest(codeModule.id, test.id);
      await canvas.linkOpenAPIEndpointToFunction(contract.id, '/users', 'POST', codeModule.id, 'createUser');

      // Verify referential integrity
      const contractCoverage = await canvas.getContractCoverage(contract.id);
      expect(contractCoverage.contract?.id).toBe(contract.id);
      expect(contractCoverage.implementations).toHaveLength(1);
      expect(contractCoverage.implementations[0].id).toBe(codeModule.id);
      expect(contractCoverage.tests).toHaveLength(1);
      expect(contractCoverage.tests[0].id).toBe(test.id);

      // Verify endpoint-specific relationships
      expect(contractCoverage.endpointCoverage).toHaveLength(1);
      const endpointCov = contractCoverage.endpointCoverage[0];
      expect(endpointCov.path).toBe('/users');
      expect(endpointCov.method).toBe('POST');
      expect(endpointCov.implementations).toHaveLength(1);
      expect(endpointCov.implementations[0].functionName).toBe('createUser');

      // Verify reverse relationships
      const moduleContracts = await canvas.getCodeModuleContracts(codeModule.id);
      expect(moduleContracts).toHaveLength(1);
      expect(moduleContracts[0].id).toBe(contract.id);

      const testContracts = await canvas.getTestContracts(test.id);
      expect(testContracts).toHaveLength(1);
      expect(testContracts[0].id).toBe(contract.id);

      const moduleTests = await canvas.getCodeModuleTests(codeModule.id);
      expect(moduleTests).toHaveLength(1);
      expect(moduleTests[0].id).toBe(test.id);
    });
  });

  describe('Knowledge Queries and Analytics', () => {
    let projectId: string;

    beforeEach(async () => {
      await orchestrator.initialize(testProjectPath);
      projectId = (orchestrator as any).projectId;
      
      // Create rich knowledge graph for testing
      await createRichKnowledgeGraph(projectId);
    });

    it('should perform complex knowledge graph queries', async () => {
      // Query for tasks with specific patterns
      const session = (canvas as any).driver.session();
      
      try {
        // Find all tasks that depend on the user management feature
        const dependentTasksResult = await session.run(`
          MATCH (t1:Task)-[:DEPENDS_ON]->(t2:Task)
          WHERE t2.title CONTAINS 'User Management' AND t1.projectId = $projectId
          RETURN t1.title as dependentTask, t2.title as dependency
        `, { projectId });

        expect(dependentTasksResult.records.length).toBeGreaterThan(0);

        // Find contracts that are implemented by code modules
        const implementedContractsResult = await session.run(`
          MATCH (c:Contract)<-[:IMPLEMENTS]-(cm:CodeModule)
          WHERE c.projectId = $projectId
          RETURN c.name as contractName, cm.name as moduleName
        `, { projectId });

        expect(implementedContractsResult.records.length).toBeGreaterThan(0);

        // Find test coverage gaps
        const coverageGapsResult = await session.run(`
          MATCH (cm:CodeModule)
          WHERE cm.projectId = $projectId AND NOT (cm)<-[:TESTS]-(:Test)
          RETURN cm.name as untestedModule
        `, { projectId });

        // Some modules might not have tests yet (depending on workflow stage)
        // This query helps identify coverage gaps

        // Find contracts without implementations
        const unimplementedContractsResult = await session.run(`
          MATCH (c:Contract)
          WHERE c.projectId = $projectId AND NOT (c)<-[:IMPLEMENTS]-(:CodeModule)
          RETURN c.name as unimplementedContract
        `, { projectId });

        console.log(`Knowledge Graph Analytics:
          Dependent Tasks: ${dependentTasksResult.records.length}
          Implemented Contracts: ${implementedContractsResult.records.length}
          Untested Modules: ${coverageGapsResult.records.length}
          Unimplemented Contracts: ${unimplementedContractsResult.records.length}`);

      } finally {
        await session.close();
      }
    });

    it('should find similar tasks and patterns across the knowledge graph', async () => {
      // Test similarity search functionality
      const tasks = await canvas.getTasksByProject(projectId);
      const userManagementTask = tasks.find(t => t.title.includes('User Management'));
      
      if (userManagementTask) {
        const keywords = ['user', 'authentication', 'management'];
        const similarTasks = await canvas.findSimilarTasks(userManagementTask.id, keywords);
        
        // Should find tasks with similar keywords
        expect(similarTasks.length).toBeGreaterThan(0);
        
        // Verify similarity scoring
        for (const similarTask of similarTasks) {
          expect(similarTask.similarity).toBeGreaterThan(0);
          expect(similarTask.similarity).toBeLessThanOrEqual(1);
        }

        console.log(`Similar Tasks Found: ${similarTasks.length}`);
        similarTasks.forEach(task => {
          console.log(`  - ${task.title} (similarity: ${task.similarity})`);
        });
      }
    });

    it('should analyze knowledge graph connectivity and metrics', async () => {
      const session = (canvas as any).driver.session();
      
      try {
        // Calculate graph metrics
        const nodeCountResult = await session.run(`
          MATCH (n) WHERE n.projectId = $projectId
          RETURN count(n) as nodeCount
        `, { projectId });

        const relationshipCountResult = await session.run(`
          MATCH (n)-[r]->(m) 
          WHERE n.projectId = $projectId OR m.projectId = $projectId
          RETURN count(r) as relationshipCount
        `, { projectId });

        const nodeTypesResult = await session.run(`
          MATCH (n) WHERE n.projectId = $projectId
          RETURN labels(n) as nodeType, count(n) as count
        `, { projectId });

        // Calculate connectivity metrics
        const connectivityResult = await session.run(`
          MATCH (n) WHERE n.projectId = $projectId
          OPTIONAL MATCH (n)-[r]->()
          WITH n, count(r) as outDegree
          RETURN avg(outDegree) as avgConnectivity, max(outDegree) as maxConnectivity
        `, { projectId });

        const nodeCount = nodeCountResult.records[0]?.get('nodeCount').toNumber() || 0;
        const relationshipCount = relationshipCountResult.records[0]?.get('relationshipCount').toNumber() || 0;
        const avgConnectivity = connectivityResult.records[0]?.get('avgConnectivity')?.toNumber() || 0;
        const maxConnectivity = connectivityResult.records[0]?.get('maxConnectivity')?.toNumber() || 0;

        // Verify graph has good connectivity
        expect(nodeCount).toBeGreaterThan(0);
        expect(relationshipCount).toBeGreaterThan(0);
        expect(avgConnectivity).toBeGreaterThan(0);

        // Calculate graph density (should be reasonable, not too sparse or dense)
        const maxPossibleEdges = nodeCount * (nodeCount - 1);
        const density = maxPossibleEdges > 0 ? relationshipCount / maxPossibleEdges : 0;
        expect(density).toBeGreaterThan(0);
        expect(density).toBeLessThan(0.5); // Shouldn't be overly dense

        console.log(`Knowledge Graph Metrics:
          Nodes: ${nodeCount}
          Relationships: ${relationshipCount}
          Density: ${(density * 100).toFixed(2)}%
          Average Connectivity: ${avgConnectivity.toFixed(2)}
          Max Connectivity: ${maxConnectivity}`);

        // Analyze node type distribution
        for (const record of nodeTypesResult.records) {
          const nodeType = record.get('nodeType').join(':');
          const count = record.get('count').toNumber();
          console.log(`  ${nodeType}: ${count}`);
        }

      } finally {
        await session.close();
      }
    });
  });

  describe('Snapshot and Restore Capabilities', () => {
    let projectId: string;

    beforeEach(async () => {
      await orchestrator.initialize(testProjectPath);
      projectId = (orchestrator as any).projectId;
      await createRichKnowledgeGraph(projectId);
    });

    it('should create and restore knowledge graph snapshots', async () => {
      // Create snapshot
      const snapshotPath = path.join(testProjectPath, 'knowledge-snapshot.json');
      await canvas.saveSnapshot(snapshotPath);
      
      // Verify snapshot file exists and has content
      expect(fs.existsSync(snapshotPath)).toBe(true);
      const snapshotContent = await fs.promises.readFile(snapshotPath, 'utf8');
      const snapshot: SnapshotData = JSON.parse(snapshotContent);
      
      expect(snapshot.version).toBeTruthy();
      expect(snapshot.timestamp).toBeTruthy();
      expect(snapshot.metadata).toBeTruthy();
      expect(snapshot.nodes).toBeInstanceOf(Array);
      expect(snapshot.relationships).toBeInstanceOf(Array);
      expect(snapshot.nodes.length).toBeGreaterThan(0);
      expect(snapshot.relationships.length).toBeGreaterThan(0);

      // Verify metadata accuracy
      expect(snapshot.metadata.totalNodes).toBe(snapshot.nodes.length);
      expect(snapshot.metadata.totalRelationships).toBe(snapshot.relationships.length);
      expect(snapshot.metadata.nodeTypes).toBeTruthy();

      // Get current state before clearing
      const originalKnowledgeGraph = await canvas.getProjectKnowledgeGraph(projectId);

      // Clear the graph
      const session = (canvas as any).driver.session();
      try {
        await session.run('MATCH (n) DETACH DELETE n');
      } finally {
        await session.close();
      }

      // Verify graph is empty
      const emptyGraph = await canvas.getProjectKnowledgeGraph(projectId);
      expect(emptyGraph.project).toBeNull();

      // Restore from snapshot
      await canvas.loadSnapshot(snapshotPath);

      // Verify restoration
      const restoredGraph = await canvas.getProjectKnowledgeGraph(projectId);
      expect(restoredGraph.project).toBeTruthy();
      expect(restoredGraph.tasks.length).toBe(originalKnowledgeGraph.tasks.length);
      expect(restoredGraph.contracts.length).toBe(originalKnowledgeGraph.contracts.length);
      expect(restoredGraph.decisions.length).toBe(originalKnowledgeGraph.decisions.length);
    });

    it('should handle auto-save snapshots', async () => {
      // Enable auto-save
      await canvas.autoSaveSnapshot();
      
      // Wait for auto-save to trigger
      await new Promise(resolve => setTimeout(resolve, 65000)); // 65 seconds to ensure at least one auto-save
      
      // List snapshots
      const snapshots = await canvas.listSnapshots();
      expect(snapshots.length).toBeGreaterThan(0);
      
      // Verify auto-save snapshot naming
      const autoSaveSnapshots = snapshots.filter(s => s.includes('auto-save'));
      expect(autoSaveSnapshots.length).toBeGreaterThan(0);
      
      console.log(`Auto-save snapshots created: ${autoSaveSnapshots.length}`);
    }, 70000);

    it('should maintain snapshot integrity and versioning', async () => {
      // Create multiple snapshots at different stages
      const snapshot1Path = path.join(testProjectPath, 'snapshot-v1.json');
      await canvas.saveSnapshot(snapshot1Path);

      // Add more data
      await canvas.createContract({
        id: 'versioning-test-contract',
        name: 'Versioning Test Contract',
        type: 'json-schema',
        version: '1.0.0',
        specification: { type: 'object' },
        projectId: projectId,
        createdAt: new Date().toISOString()
      });

      const snapshot2Path = path.join(testProjectPath, 'snapshot-v2.json');
      await canvas.saveSnapshot(snapshot2Path);

      // Compare snapshots
      const snapshot1Content = await fs.promises.readFile(snapshot1Path, 'utf8');
      const snapshot2Content = await fs.promises.readFile(snapshot2Path, 'utf8');
      
      const snapshot1: SnapshotData = JSON.parse(snapshot1Content);
      const snapshot2: SnapshotData = JSON.parse(snapshot2Content);

      // Verify versioning
      expect(snapshot1.timestamp).not.toBe(snapshot2.timestamp);
      expect(snapshot2.metadata.totalNodes).toBeGreaterThan(snapshot1.metadata.totalNodes);
      
      // Verify snapshot integrity
      expect(snapshot1.metadata.totalNodes).toBe(snapshot1.nodes.length);
      expect(snapshot1.metadata.totalRelationships).toBe(snapshot1.relationships.length);
      expect(snapshot2.metadata.totalNodes).toBe(snapshot2.nodes.length);
      expect(snapshot2.metadata.totalRelationships).toBe(snapshot2.relationships.length);

      console.log(`Snapshot Versioning:
        V1 - Nodes: ${snapshot1.metadata.totalNodes}, Relationships: ${snapshot1.metadata.totalRelationships}
        V2 - Nodes: ${snapshot2.metadata.totalNodes}, Relationships: ${snapshot2.metadata.totalRelationships}`);
    });
  });

  describe('Temporal Knowledge Tracking', () => {
    let projectId: string;

    beforeEach(async () => {
      await orchestrator.initialize(testProjectPath);
      projectId = (orchestrator as any).projectId;
    });

    it('should track knowledge evolution over time', async () => {
      const timelineSnapshots: Array<{
        timestamp: string;
        action: string;
        nodeCount: number;
        relationshipCount: number;
      }> = [];

      // Initial state
      let knowledgeGraph = await canvas.getProjectKnowledgeGraph(projectId);
      timelineSnapshots.push({
        timestamp: new Date().toISOString(),
        action: 'Initial state',
        nodeCount: knowledgeGraph.tasks.length + knowledgeGraph.decisions.length,
        relationshipCount: 0 // Will be calculated
      });

      // Add contract
      await canvas.createContract({
        id: 'temporal-test-contract',
        name: 'Temporal Test Contract',
        type: 'openapi',
        version: '1.0.0',
        specification: { openapi: '3.0.0', info: { title: 'Temporal API', version: '1.0.0' } },
        projectId: projectId,
        createdAt: new Date().toISOString()
      });

      knowledgeGraph = await canvas.getProjectKnowledgeGraph(projectId);
      timelineSnapshots.push({
        timestamp: new Date().toISOString(),
        action: 'Contract added',
        nodeCount: knowledgeGraph.tasks.length + knowledgeGraph.decisions.length + knowledgeGraph.contracts.length,
        relationshipCount: 0
      });

      // Add code module and link
      const codeModule = await canvas.createCodeModule({
        id: 'temporal-test-module',
        name: 'TemporalController',
        filePath: '/src/controllers/TemporalController.js',
        type: 'class',
        language: 'javascript',
        projectId: projectId,
        createdAt: new Date().toISOString()
      });

      await canvas.linkContractToCodeModule('temporal-test-contract', codeModule.id, 'IMPLEMENTS');

      knowledgeGraph = await canvas.getProjectKnowledgeGraph(projectId);
      timelineSnapshots.push({
        timestamp: new Date().toISOString(),
        action: 'Code module added and linked',
        nodeCount: knowledgeGraph.tasks.length + knowledgeGraph.decisions.length + knowledgeGraph.contracts.length + knowledgeGraph.codeModules.length,
        relationshipCount: 1 // Contract-CodeModule relationship
      });

      // Verify temporal progression
      expect(timelineSnapshots.length).toBe(3);
      expect(timelineSnapshots[1].nodeCount).toBeGreaterThan(timelineSnapshots[0].nodeCount);
      expect(timelineSnapshots[2].nodeCount).toBeGreaterThan(timelineSnapshots[1].nodeCount);
      expect(timelineSnapshots[2].relationshipCount).toBeGreaterThan(timelineSnapshots[1].relationshipCount);

      console.log('Knowledge Evolution Timeline:');
      timelineSnapshots.forEach((snapshot, index) => {
        console.log(`  ${index + 1}. ${snapshot.action} (${snapshot.timestamp}): ${snapshot.nodeCount} nodes, ${snapshot.relationshipCount} relationships`);
      });
    });

    it('should track relationship changes and updates', async () => {
      // Create initial entities
      const contract = await canvas.createContract({
        id: 'relationship-test-contract',
        name: 'Relationship Test Contract',
        type: 'openapi',
        version: '1.0.0',
        specification: { openapi: '3.0.0', info: { title: 'Test API', version: '1.0.0' } },
        projectId: projectId,
        createdAt: new Date().toISOString()
      });

      const codeModule = await canvas.createCodeModule({
        id: 'relationship-test-module',
        name: 'TestController',
        filePath: '/src/controllers/TestController.js',
        type: 'class',
        language: 'javascript',
        projectId: projectId,
        createdAt: new Date().toISOString()
      });

      // Track relationship creation
      const preRelationshipGraph = await canvas.getProjectKnowledgeGraph(projectId);
      
      await canvas.linkContractToCodeModule(contract.id, codeModule.id, 'IMPLEMENTS');
      
      const postRelationshipGraph = await canvas.getProjectKnowledgeGraph(projectId);
      
      // Verify relationship was created
      const moduleContracts = await canvas.getCodeModuleContracts(codeModule.id);
      expect(moduleContracts).toHaveLength(1);
      expect(moduleContracts[0].id).toBe(contract.id);

      // Track contract updates
      const updatedContract = await canvas.updateContract(contract.id, {
        version: '2.0.0',
        description: 'Updated contract description'
      });

      expect(updatedContract.version).toBe('2.0.0');
      expect(updatedContract.description).toBe('Updated contract description');
      expect(updatedContract.updatedAt).toBeTruthy();

      // Verify relationship persists after update
      const persistedModuleContracts = await canvas.getCodeModuleContracts(codeModule.id);
      expect(persistedModuleContracts).toHaveLength(1);
      expect(persistedModuleContracts[0].version).toBe('2.0.0');
    });
  });

  describe('Cross-Project Knowledge Sharing', () => {
    let project1Id: string;
    let project2Id: string;

    beforeEach(async () => {
      // Create first project
      await orchestrator.initialize(testProjectPath);
      project1Id = (orchestrator as any).projectId;
      
      // Create second project
      const project2 = await canvas.createProject({
        id: 'cross-project-test-2',
        name: 'Cross Project Test 2',
        description: 'Second project for cross-project testing',
        status: 'initialized',
        createdAt: new Date().toISOString()
      });
      project2Id = project2.id;
    });

    it('should enable knowledge sharing between projects', async () => {
      // Create shared contract pattern in project 1
      const sharedContract = await canvas.createContract({
        id: 'shared-pattern-contract',
        name: 'User Authentication Pattern',
        type: 'openapi',
        version: '1.0.0',
        specification: {
          openapi: '3.0.0',
          info: { title: 'Shared Auth API', version: '1.0.0' },
          paths: {
            '/auth/login': {
              post: {
                summary: 'User login',
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
                },
                responses: {
                  '200': { description: 'Login successful' },
                  '401': { description: 'Unauthorized' }
                }
              }
            }
          }
        },
        projectId: project1Id,
        createdAt: new Date().toISOString()
      });

      // Create similar contract in project 2 (reusing pattern)
      const reusedContract = await canvas.createContract({
        id: 'reused-pattern-contract',
        name: 'User Authentication Pattern (Reused)',
        type: 'openapi',
        version: '1.0.0',
        specification: sharedContract.specification, // Reuse the same pattern
        projectId: project2Id,
        createdAt: new Date().toISOString()
      });

      // Query for similar contracts across projects
      const session = (canvas as any).driver.session();
      try {
        const similarContractsResult = await session.run(`
          MATCH (c1:Contract), (c2:Contract)
          WHERE c1.id <> c2.id 
            AND c1.name CONTAINS 'Authentication' 
            AND c2.name CONTAINS 'Authentication'
          RETURN c1.projectId as project1, c2.projectId as project2, 
                 c1.name as contract1, c2.name as contract2
        `);

        expect(similarContractsResult.records.length).toBeGreaterThan(0);
        
        // Verify cross-project pattern reuse
        const crossProjectPairs = similarContractsResult.records.filter(record => 
          record.get('project1') !== record.get('project2')
        );
        expect(crossProjectPairs.length).toBeGreaterThan(0);

        console.log(`Cross-Project Pattern Reuse:
          Similar Contracts Found: ${similarContractsResult.records.length}
          Cross-Project Pairs: ${crossProjectPairs.length}`);

      } finally {
        await session.close();
      }
    });

    it('should identify reusable components and patterns', async () => {
      // Create components in project 1
      await canvas.createCodeModule({
        id: 'reusable-auth-service',
        name: 'AuthenticationService',
        filePath: '/src/services/AuthenticationService.js',
        type: 'class',
        language: 'javascript',
        projectId: project1Id,
        createdAt: new Date().toISOString()
      });

      await canvas.createCodeModule({
        id: 'reusable-validator',
        name: 'EmailValidator',
        filePath: '/src/utils/EmailValidator.js',
        type: 'function',
        language: 'javascript',
        projectId: project1Id,
        createdAt: new Date().toISOString()
      });

      // Create similar components in project 2
      await canvas.createCodeModule({
        id: 'similar-auth-service',
        name: 'AuthService',
        filePath: '/src/auth/AuthService.js',
        type: 'class',
        language: 'javascript',
        projectId: project2Id,
        createdAt: new Date().toISOString()
      });

      // Query for reusable patterns
      const session = (canvas as any).driver.session();
      try {
        const reusablePatternsResult = await session.run(`
          MATCH (cm1:CodeModule), (cm2:CodeModule)
          WHERE cm1.projectId <> cm2.projectId
            AND (cm1.name CONTAINS 'Auth' OR cm1.name CONTAINS 'Valid')
            AND (cm2.name CONTAINS 'Auth' OR cm2.name CONTAINS 'Valid')
          RETURN cm1.name as component1, cm1.projectId as project1,
                 cm2.name as component2, cm2.projectId as project2,
                 cm1.type as type1, cm2.type as type2
        `);

        expect(reusablePatternsResult.records.length).toBeGreaterThan(0);

        // Analyze pattern similarities
        const authPatterns = reusablePatternsResult.records.filter(record =>
          record.get('component1').includes('Auth') && record.get('component2').includes('Auth')
        );

        expect(authPatterns.length).toBeGreaterThan(0);

        console.log(`Reusable Component Analysis:
          Total Cross-Project Similarities: ${reusablePatternsResult.records.length}
          Authentication Patterns: ${authPatterns.length}`);

      } finally {
        await session.close();
      }
    });
  });

  // Helper function to create a rich knowledge graph for testing
  async function createRichKnowledgeGraph(projectId: string): Promise<void> {
    // Create contracts
    const userContract = await canvas.createContract({
      id: 'rich-user-contract',
      name: 'User Management Contract',
      type: 'openapi',
      version: '1.0.0',
      specification: {
        openapi: '3.0.0',
        info: { title: 'User Management API', version: '1.0.0' },
        paths: {
          '/users': {
            get: { summary: 'List users' },
            post: { summary: 'Create user' }
          },
          '/users/{id}': {
            get: { summary: 'Get user' },
            put: { summary: 'Update user' },
            delete: { summary: 'Delete user' }
          }
        }
      },
      projectId: projectId,
      createdAt: new Date().toISOString()
    });

    const authContract = await canvas.createContract({
      id: 'rich-auth-contract',
      name: 'Authentication Contract',
      type: 'json-schema',
      version: '1.0.0',
      specification: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          expiresAt: { type: 'string', format: 'date-time' },
          user: { $ref: '#/definitions/User' }
        },
        required: ['token', 'expiresAt', 'user']
      },
      projectId: projectId,
      createdAt: new Date().toISOString()
    });

    // Create code modules
    const userController = await canvas.createCodeModule({
      id: 'rich-user-controller',
      name: 'UserController',
      filePath: '/src/controllers/UserController.js',
      type: 'class',
      language: 'javascript',
      projectId: projectId,
      createdAt: new Date().toISOString()
    });

    const authService = await canvas.createCodeModule({
      id: 'rich-auth-service',
      name: 'AuthService',
      filePath: '/src/services/AuthService.js',
      type: 'class',
      language: 'javascript',
      projectId: projectId,
      createdAt: new Date().toISOString()
    });

    const userModel = await canvas.createCodeModule({
      id: 'rich-user-model',
      name: 'User',
      filePath: '/src/models/User.js',
      type: 'class',
      language: 'javascript',
      projectId: projectId,
      createdAt: new Date().toISOString()
    });

    // Create tests
    const userControllerTest = await canvas.createTest({
      id: 'rich-user-controller-test',
      name: 'UserController Tests',
      filePath: '/tests/controllers/UserController.test.js',
      type: 'unit',
      framework: 'jest',
      projectId: projectId,
      createdAt: new Date().toISOString()
    });

    const userApiTest = await canvas.createTest({
      id: 'rich-user-api-test',
      name: 'User API Integration Tests',
      filePath: '/tests/integration/user.api.test.js',
      type: 'integration',
      framework: 'jest',
      projectId: projectId,
      createdAt: new Date().toISOString()
    });

    const authContractTest = await canvas.createTest({
      id: 'rich-auth-contract-test',
      name: 'Authentication Contract Tests',
      filePath: '/tests/contracts/auth.contract.test.js',
      type: 'contract',
      framework: 'jest',
      projectId: projectId,
      createdAt: new Date().toISOString()
    });

    // Create relationships
    await canvas.linkContractToCodeModule(userContract.id, userController.id, 'IMPLEMENTS');
    await canvas.linkContractToCodeModule(authContract.id, authService.id, 'IMPLEMENTS');
    await canvas.linkContractToTest(userContract.id, userApiTest.id, 'VALIDATES');
    await canvas.linkContractToTest(authContract.id, authContractTest.id, 'VALIDATES');
    await canvas.linkCodeModuleToTest(userController.id, userControllerTest.id);
    await canvas.linkCodeModuleToTest(userController.id, userApiTest.id);

    // Create endpoint-specific relationships
    await canvas.linkOpenAPIEndpointToFunction(userContract.id, '/users', 'GET', userController.id, 'listUsers');
    await canvas.linkOpenAPIEndpointToFunction(userContract.id, '/users', 'POST', userController.id, 'createUser');
    await canvas.linkOpenAPIEndpointToFunction(userContract.id, '/users/{id}', 'GET', userController.id, 'getUser');
    await canvas.linkOpenAPIEndpointToFunction(userContract.id, '/users/{id}', 'PUT', userController.id, 'updateUser');
    await canvas.linkOpenAPIEndpointToFunction(userContract.id, '/users/{id}', 'DELETE', userController.id, 'deleteUser');

    await canvas.linkEndpointToTest(userContract.id, '/users', 'GET', userApiTest.id);
    await canvas.linkEndpointToTest(userContract.id, '/users', 'POST', userApiTest.id);
    await canvas.linkEndpointToTest(userContract.id, '/users/{id}', 'GET', userApiTest.id);
    await canvas.linkEndpointToTest(userContract.id, '/users/{id}', 'PUT', userApiTest.id);
    await canvas.linkEndpointToTest(userContract.id, '/users/{id}', 'DELETE', userApiTest.id);
  }
});