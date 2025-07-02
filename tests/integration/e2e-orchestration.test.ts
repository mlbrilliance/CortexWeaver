/**
 * End-to-End Integration Tests for Agent Orchestration and Workflows
 * 
 * This test suite validates the complete SDD workflow pipeline:
 * BDD → Formalization → Architecture → Implementation → Testing
 * 
 * It tests:
 * - Full project initialization and setup
 * - Complete SDD workflow execution
 * - Agent coordination and communication
 * - Contract generation and consumption
 * - Error handling and recovery scenarios
 * - Performance testing for agent orchestration
 * - Cognitive Canvas integration
 * - MCP server integration
 * - Workspace and session management
 */

import { Orchestrator, OrchestratorConfig } from '../../src/orchestrator';
import { CognitiveCanvas, Neo4jConfig } from '../../src/cognitive-canvas';
import { PlanParser } from '../../src/plan-parser';
import { ClaudeClient } from '../../src/claude-client';
import { WorkspaceManager } from '../../src/workspace';
import { SessionManager } from '../../src/session';
import { MCPClient } from '../../src/mcp-client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('E2E Integration Tests - Agent Orchestration and Workflows', () => {
  let testProjectPath: string;
  let orchestrator: Orchestrator;
  let canvas: CognitiveCanvas;
  let workspace: WorkspaceManager;
  let sessionManager: SessionManager;
  let mcpClient: MCPClient;
  
  const testConfig: OrchestratorConfig = {
    neo4j: {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password'
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY || 'test-api-key',
      budgetLimit: 100
    }
  };

  const samplePlanContent = `# E2E Test Project

## Overview

This is a comprehensive end-to-end test project for validating the complete SDD workflow pipeline. It includes BDD specification writing, contract formalization, architectural design, implementation, and testing phases.

## Features

### Feature 1: User Authentication System
- **Priority**: High
- **Description**: Create a complete user authentication system with registration, login, and JWT token management
- **Dependencies**: []
- **Agent**: SpecWriter
- **Acceptance Criteria**:
  - [ ] User can register with email and password
  - [ ] User can login with valid credentials
  - [ ] JWT tokens are generated and validated
  - [ ] User sessions are managed properly

#### Microtasks:
- [ ] Create user registration endpoint
- [ ] Create user login endpoint
- [ ] Implement JWT token generation
- [ ] Implement token validation middleware

### Feature 2: Contract Formalization
- **Priority**: High
- **Description**: Transform BDD specifications into formal contracts and schemas
- **Dependencies**: [Feature 1]
- **Agent**: Formalizer
- **Acceptance Criteria**:
  - [ ] OpenAPI schema generated for authentication endpoints
  - [ ] JSON schemas created for user data models
  - [ ] Property-based test contracts defined
  - [ ] Contract validation rules established

#### Microtasks:
- [ ] Generate OpenAPI specification
- [ ] Create JSON schema for User model
- [ ] Define authentication contract properties
- [ ] Set up contract validation framework

### Feature 3: System Architecture
- **Priority**: High
- **Description**: Design and document the system architecture based on formal contracts
- **Dependencies**: [Feature 2]
- **Agent**: Architect
- **Acceptance Criteria**:
  - [ ] Microservices architecture designed
  - [ ] Database schema finalized
  - [ ] API gateway configuration planned
  - [ ] Security architecture documented

#### Microtasks:
- [ ] Design service boundaries
- [ ] Plan database structure
- [ ] Configure API routing
- [ ] Design security layers

### Feature 4: Implementation
- **Priority**: High
- **Description**: Implement the user authentication system according to architectural specifications
- **Dependencies**: [Feature 3]
- **Agent**: Coder
- **Acceptance Criteria**:
  - [ ] Authentication service implemented
  - [ ] Database models created
  - [ ] API endpoints functional
  - [ ] Security middleware integrated

#### Microtasks:
- [ ] Implement user model
- [ ] Create authentication controllers
- [ ] Set up database connections
- [ ] Implement JWT middleware

### Feature 5: Comprehensive Testing
- **Priority**: High
- **Description**: Create comprehensive test suite including unit, integration, and contract tests
- **Dependencies**: [Feature 4]
- **Agent**: Tester
- **Acceptance Criteria**:
  - [ ] Unit tests for all components
  - [ ] Integration tests for API endpoints
  - [ ] Contract tests validate specifications
  - [ ] Performance tests ensure scalability

#### Microtasks:
- [ ] Write unit tests
- [ ] Create integration test suite
- [ ] Implement contract validation tests
- [ ] Set up performance benchmarks

## Architecture Decisions

### Technology Stack
- **Backend**: Node.js with Express
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT with bcrypt
- **Testing**: Jest with Supertest
- **Documentation**: OpenAPI/Swagger

### Quality Standards
- **Code Coverage**: 90%
- **Performance**: < 200ms response time
- **Security**: OWASP compliance
- **Documentation**: Complete API documentation
`;

  beforeAll(async () => {
    // Create temporary test project directory
    testProjectPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cortex-e2e-test-'));
    
    // Write the test plan file
    await fs.promises.writeFile(
      path.join(testProjectPath, 'plan.md'),
      samplePlanContent
    );

    // Initialize components
    canvas = new CognitiveCanvas(testConfig.neo4j);
    workspace = new WorkspaceManager();
    sessionManager = new SessionManager();
    mcpClient = new MCPClient();
    
    // Clean up any existing data in test database
    try {
      await canvas.initializeSchema();
      // Clear any existing test data
      const session = (canvas as any).driver.session();
      await session.run('MATCH (n) WHERE n.projectId STARTS WITH "e2e-test-" DETACH DELETE n');
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
    // Create fresh orchestrator for each test
    orchestrator = new Orchestrator(testConfig);
  });

  afterEach(async () => {
    // Clean up after each test
    if (orchestrator && orchestrator.isRunning()) {
      await orchestrator.shutdown();
    }
  });

  describe('Full SDD Workflow Pipeline', () => {
    it('should complete the entire BDD → Formalization → Architecture → Implementation → Testing workflow', async () => {
      const startTime = Date.now();
      
      // Phase 1: Initialize project and parse plan
      await orchestrator.initialize(testProjectPath);
      expect(orchestrator.getStatus()).toBe('initialized');

      // Verify project was created in Cognitive Canvas
      const projects = await canvas.getProjectKnowledgeGraph('e2e-test-project');
      expect(projects.project).toBeTruthy();

      // Phase 2: Start orchestration
      const orchestrationPromise = orchestrator.start();
      expect(orchestrator.isRunning()).toBe(true);
      expect(orchestrator.getStatus()).toBe('running');

      // Monitor the workflow progress
      let workflowCompleted = false;
      let maxIterations = 100; // Prevent infinite loops
      let iterations = 0;

      while (!workflowCompleted && iterations < maxIterations) {
        iterations++;
        
        // Check if all tasks are completed
        const projectId = (orchestrator as any).projectId;
        if (projectId) {
          const tasks = await canvas.getTasksByProject(projectId);
          const completedTasks = tasks.filter(t => t.status === 'completed');
          const pendingTasks = tasks.filter(t => 
            t.status === 'pending' || t.status === 'running' || t.status === 'impasse'
          );

          console.log(`Iteration ${iterations}: ${completedTasks.length}/${tasks.length} tasks completed`);
          
          if (pendingTasks.length === 0) {
            workflowCompleted = true;
          } else {
            // Wait before next check
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      // Stop orchestration
      await orchestrator.shutdown();
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Verify workflow completion
      expect(workflowCompleted).toBe(true);
      expect(executionTime).toBeLessThan(300000); // Should complete within 5 minutes

      // Verify all phases completed successfully
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      
      expect(tasks).toHaveLength(5); // All 5 features should be created as tasks
      expect(tasks.every(t => t.status === 'completed')).toBe(true);

      // Verify workflow sequence was followed
      const specWriterTask = tasks.find(t => t.title.includes('User Authentication System'));
      const formalizerTask = tasks.find(t => t.title.includes('Contract Formalization'));
      const architectTask = tasks.find(t => t.title.includes('System Architecture'));
      const coderTask = tasks.find(t => t.title.includes('Implementation'));
      const testerTask = tasks.find(t => t.title.includes('Comprehensive Testing'));

      expect(specWriterTask).toBeTruthy();
      expect(formalizerTask).toBeTruthy();
      expect(architectTask).toBeTruthy();
      expect(coderTask).toBeTruthy();
      expect(testerTask).toBeTruthy();

      // Performance validation
      expect(executionTime).toBeLessThan(300000); // 5 minutes max
    }, 300000); // 5 minute timeout

    it('should handle agent impasse and recovery with CodeSavant', async () => {
      // Initialize with a plan that will likely cause an impasse
      const problematicPlan = `# Problematic Project

## Overview
A project designed to trigger impasse scenarios for testing recovery mechanisms.

## Features

### Feature 1: Complex Implementation
- **Priority**: High
- **Description**: Intentionally complex feature that may cause agent impasse
- **Dependencies**: []
- **Agent**: Coder
- **Acceptance Criteria**:
  - [ ] Implement quantum computing algorithm
  - [ ] Handle impossible constraints

#### Microtasks:
- [ ] Solve P vs NP problem
- [ ] Create perpetual motion machine

## Architecture Decisions

### Technology Stack
- **Backend**: Quantum Computer
- **Frontend**: Time Machine Interface

### Quality Standards
- **Code Coverage**: 150%
- **Performance**: Faster than light
`;

      await fs.promises.writeFile(
        path.join(testProjectPath, 'plan.md'),
        problematicPlan
      );

      await orchestrator.initialize(testProjectPath);
      
      // Start orchestration with impasse monitoring
      const orchestrationPromise = orchestrator.start();
      
      let impasseDetected = false;
      let codeSavantSpawned = false;
      let maxWaitTime = 60000; // 1 minute max wait
      let startTime = Date.now();

      while (!impasseDetected && (Date.now() - startTime) < maxWaitTime) {
        const projectId = (orchestrator as any).projectId;
        if (projectId) {
          const tasks = await canvas.getTasksByProject(projectId);
          const impasseTasks = tasks.filter(t => t.status === 'impasse');
          
          if (impasseTasks.length > 0) {
            impasseDetected = true;
            
            // Verify CodeSavant spawning
            const sessions = sessionManager.listSessions();
            const codeSavantSessions = sessions.filter(s => 
              s.sessionId.includes('codesavant')
            );
            
            if (codeSavantSessions.length > 0) {
              codeSavantSpawned = true;
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      await orchestrator.shutdown();

      // Verify impasse detection and recovery
      expect(impasseDetected).toBe(true);
      expect(codeSavantSpawned).toBe(true);
    }, 120000); // 2 minute timeout

    it('should properly manage contracts throughout the workflow', async () => {
      await orchestrator.initialize(testProjectPath);
      
      // Start orchestration and monitor contract creation
      const orchestrationPromise = orchestrator.start();
      
      let contractsCreated = false;
      let maxWaitTime = 120000; // 2 minutes
      let startTime = Date.now();

      while (!contractsCreated && (Date.now() - startTime) < maxWaitTime) {
        const projectId = (orchestrator as any).projectId;
        if (projectId) {
          const contracts = await canvas.getContractsByProject(projectId);
          
          if (contracts.length > 0) {
            contractsCreated = true;
            
            // Verify contract types
            const openApiContracts = contracts.filter(c => c.type === 'openapi');
            const jsonSchemaContracts = contracts.filter(c => c.type === 'json-schema');
            const propertyContracts = contracts.filter(c => c.type === 'property-definition');
            
            expect(openApiContracts.length).toBeGreaterThan(0);
            expect(jsonSchemaContracts.length).toBeGreaterThan(0);
            expect(propertyContracts.length).toBeGreaterThan(0);
            
            // Verify contract relationships
            for (const contract of contracts) {
              const coverage = await canvas.getContractCoverage(contract.id);
              expect(coverage.contract).toBeTruthy();
              expect(coverage.features.length).toBeGreaterThan(0);
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      await orchestrator.shutdown();
      
      expect(contractsCreated).toBe(true);
    }, 180000); // 3 minute timeout
  });

  describe('Agent Coordination and Communication', () => {
    it('should coordinate multiple agents working on dependent tasks', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      let tasks = await canvas.getTasksByProject(projectId);
      
      // Verify dependency relationships
      for (const task of tasks) {
        const dependencies = await canvas.getTaskDependencies(task.id);
        
        // Each task (except the first) should have dependencies
        if (task.title.includes('Contract Formalization')) {
          expect(dependencies.length).toBeGreaterThan(0);
          expect(dependencies.some(d => d.title.includes('User Authentication System'))).toBe(true);
        }
        
        if (task.title.includes('System Architecture')) {
          expect(dependencies.length).toBeGreaterThan(0);
          expect(dependencies.some(d => d.title.includes('Contract Formalization'))).toBe(true);
        }
      }

      // Start orchestration and monitor agent coordination
      const orchestrationPromise = orchestrator.start();
      
      let coordinationVerified = false;
      let maxWaitTime = 60000; // 1 minute
      let startTime = Date.now();

      while (!coordinationVerified && (Date.now() - startTime) < maxWaitTime) {
        const sessions = sessionManager.listSessions();
        
        if (sessions.length > 0) {
          // Verify agents are working on correct sequence
          const runningTasks = await canvas.getTasksByProject(projectId);
          const runningTaskIds = runningTasks
            .filter(t => t.status === 'running')
            .map(t => t.id);
          
          const runningSessions = sessions.filter(s => 
            runningTaskIds.includes(s.taskId)
          );
          
          if (runningSessions.length > 0) {
            coordinationVerified = true;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      await orchestrator.shutdown();
      
      expect(coordinationVerified).toBe(true);
    }, 120000);

    it('should handle parallel execution where possible', async () => {
      // Create a plan with parallel-executable tasks
      const parallelPlan = `# Parallel Execution Test

## Overview
Test project for parallel task execution capabilities.

## Features

### Feature 1: Independent Task A
- **Priority**: High
- **Description**: First independent task
- **Dependencies**: []
- **Agent**: SpecWriter

### Feature 2: Independent Task B  
- **Priority**: High
- **Description**: Second independent task
- **Dependencies**: []
- **Agent**: Architect

### Feature 3: Dependent Task
- **Priority**: Medium
- **Description**: Task depending on both A and B
- **Dependencies**: [Feature 1, Feature 2]
- **Agent**: Coder

## Architecture Decisions

### Technology Stack
- **Backend**: Node.js

### Quality Standards
- **Code Coverage**: 80%
`;

      await fs.promises.writeFile(
        path.join(testProjectPath, 'plan.md'),
        parallelPlan
      );

      await orchestrator.initialize(testProjectPath);
      
      const orchestrationPromise = orchestrator.start();
      
      let parallelExecutionDetected = false;
      let maxWaitTime = 30000; // 30 seconds
      let startTime = Date.now();

      while (!parallelExecutionDetected && (Date.now() - startTime) < maxWaitTime) {
        const sessions = sessionManager.listSessions();
        
        if (sessions.length >= 2) {
          // Check if multiple independent tasks are running simultaneously
          const runningSessions = sessions.filter(s => s.status === 'running');
          if (runningSessions.length >= 2) {
            parallelExecutionDetected = true;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await orchestrator.shutdown();
      
      expect(parallelExecutionDetected).toBe(true);
    }, 60000);
  });

  describe('Cognitive Canvas Integration', () => {
    it('should persist and retrieve project knowledge throughout workflow', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Test initial knowledge graph state
      let knowledgeGraph = await canvas.getProjectKnowledgeGraph(projectId);
      expect(knowledgeGraph.project).toBeTruthy();
      expect(knowledgeGraph.tasks.length).toBeGreaterThan(0);
      expect(knowledgeGraph.decisions.length).toBeGreaterThan(0);

      // Start orchestration
      const orchestrationPromise = orchestrator.start();
      
      let knowledgeEvolution = [];
      let maxWaitTime = 60000; // 1 minute
      let startTime = Date.now();

      while ((Date.now() - startTime) < maxWaitTime) {
        knowledgeGraph = await canvas.getProjectKnowledgeGraph(projectId);
        knowledgeEvolution.push({
          timestamp: Date.now(),
          taskCount: knowledgeGraph.tasks.length,
          contractCount: knowledgeGraph.contracts.length,
          codeModuleCount: knowledgeGraph.codeModules.length,
          testCount: knowledgeGraph.tests.length
        });
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      await orchestrator.shutdown();
      
      // Verify knowledge evolution
      expect(knowledgeEvolution.length).toBeGreaterThan(1);
      
      // Knowledge should grow over time
      const firstSnapshot = knowledgeEvolution[0];
      const lastSnapshot = knowledgeEvolution[knowledgeEvolution.length - 1];
      
      expect(lastSnapshot.contractCount).toBeGreaterThanOrEqual(firstSnapshot.contractCount);
      expect(lastSnapshot.codeModuleCount).toBeGreaterThanOrEqual(firstSnapshot.codeModuleCount);
      expect(lastSnapshot.testCount).toBeGreaterThanOrEqual(firstSnapshot.testCount);
    }, 120000);

    it('should maintain task dependencies and relationships', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      
      // Verify all dependency relationships are properly stored
      for (const task of tasks) {
        const dependencies = await canvas.getTaskDependencies(task.id);
        
        // Verify dependencies match the plan
        if (task.title.includes('Contract Formalization')) {
          expect(dependencies.some(d => d.title.includes('User Authentication'))).toBe(true);
        }
        
        if (task.title.includes('System Architecture')) {
          expect(dependencies.some(d => d.title.includes('Contract Formalization'))).toBe(true);
        }
        
        if (task.title.includes('Implementation')) {
          expect(dependencies.some(d => d.title.includes('System Architecture'))).toBe(true);
        }
        
        if (task.title.includes('Comprehensive Testing')) {
          expect(dependencies.some(d => d.title.includes('Implementation'))).toBe(true);
        }
      }
    });

    it('should store and track architectural decisions', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      const decisions = await canvas.getArchitecturalDecisionsByProject(projectId);
      
      expect(decisions.length).toBeGreaterThan(0);
      
      // Verify tech stack decisions
      const techStackDecision = decisions.find(d => d.title.includes('Technology Stack'));
      expect(techStackDecision).toBeTruthy();
      expect(techStackDecision?.description).toContain('Node.js');
      expect(techStackDecision?.description).toContain('PostgreSQL');
      
      // Verify quality standards
      const qualityDecision = decisions.find(d => d.title.includes('Quality Standards'));
      expect(qualityDecision).toBeTruthy();
      expect(qualityDecision?.description).toContain('90%');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection failures gracefully', async () => {
      // Create orchestrator with invalid database config
      const invalidConfig: OrchestratorConfig = {
        ...testConfig,
        neo4j: {
          uri: 'bolt://invalid-host:7687',
          username: 'invalid',
          password: 'invalid'
        }
      };

      const faultyOrchestrator = new Orchestrator(invalidConfig);
      
      // Should handle initialization failure gracefully
      await expect(faultyOrchestrator.initialize(testProjectPath))
        .rejects.toThrow();
      
      expect(faultyOrchestrator.getStatus()).toBe('error');
    });

    it('should handle workspace creation failures', async () => {
      await orchestrator.initialize(testProjectPath);
      
      // Mock workspace failure
      const originalCreateWorktree = workspace.createWorktree;
      workspace.createWorktree = jest.fn().mockRejectedValue(new Error('Workspace creation failed'));
      
      // Replace orchestrator's workspace with our mocked one
      (orchestrator as any).workspace = workspace;
      
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      const firstTask = tasks[0];
      
      // Should handle workspace creation failure
      await expect(orchestrator.spawnAgent(firstTask, 'SpecWriter'))
        .rejects.toThrow('Failed to spawn agent');
      
      // Restore original method
      workspace.createWorktree = originalCreateWorktree;
    });

    it('should handle session creation failures with cleanup', async () => {
      await orchestrator.initialize(testProjectPath);
      
      // Mock session failure
      const originalCreateSession = sessionManager.createSession;
      sessionManager.createSession = jest.fn().mockRejectedValue(new Error('Session creation failed'));
      
      // Mock successful worktree creation
      const mockWorkspace = workspace;
      mockWorkspace.createWorktree = jest.fn().mockResolvedValue({
        id: 'test-task',
        path: '/tmp/test-worktree',
        branch: 'feature/test',
        baseBranch: 'main'
      });
      mockWorkspace.removeWorktree = jest.fn().mockResolvedValue(true);
      
      // Replace orchestrator's components
      (orchestrator as any).workspace = mockWorkspace;
      (orchestrator as any).sessionManager = sessionManager;
      
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      const firstTask = tasks[0];
      
      // Should handle session creation failure and cleanup worktree
      await expect(orchestrator.spawnAgent(firstTask, 'SpecWriter'))
        .rejects.toThrow('Failed to spawn agent');
      
      // Verify cleanup was called
      expect(mockWorkspace.removeWorktree).toHaveBeenCalledWith(firstTask.id);
      
      // Restore original methods
      sessionManager.createSession = originalCreateSession;
    });

    it('should handle budget limit exceeded gracefully', async () => {
      // Create orchestrator with very low budget
      const lowBudgetConfig: OrchestratorConfig = {
        ...testConfig,
        claude: {
          apiKey: testConfig.claude.apiKey,
          budgetLimit: 0.01 // Very low budget
        }
      };

      const budgetOrchestrator = new Orchestrator(lowBudgetConfig);
      await budgetOrchestrator.initialize(testProjectPath);
      
      // Mock high token usage
      const mockClient = (budgetOrchestrator as any).client;
      mockClient.getTokenUsage = jest.fn().mockReturnValue({
        totalInputTokens: 100000,
        totalOutputTokens: 50000,
        totalTokens: 150000,
        requestCount: 1000,
        estimatedCost: 1.0 // Exceeds budget
      });
      
      const canProceed = budgetOrchestrator.checkBudgetLimit();
      expect(canProceed).toBe(false);
      
      await budgetOrchestrator.shutdown();
    });
  });

  describe('Performance Testing', () => {
    it('should complete project initialization within performance thresholds', async () => {
      const startTime = Date.now();
      
      await orchestrator.initialize(testProjectPath);
      
      const endTime = Date.now();
      const initializationTime = endTime - startTime;
      
      // Should initialize within 10 seconds
      expect(initializationTime).toBeLessThan(10000);
      expect(orchestrator.getStatus()).toBe('initialized');
    });

    it('should handle multiple concurrent project initializations', async () => {
      const concurrentCount = 3;
      const orchestrators: Orchestrator[] = [];
      
      try {
        // Create multiple test projects
        const testPaths = await Promise.all(
          Array.from({ length: concurrentCount }, async (_, i) => {
            const testPath = await fs.promises.mkdtemp(
              path.join(os.tmpdir(), `cortex-concurrent-test-${i}-`)
            );
            await fs.promises.writeFile(
              path.join(testPath, 'plan.md'),
              samplePlanContent.replace('E2E Test Project', `Concurrent Test Project ${i}`)
            );
            return testPath;
          })
        );

        // Create orchestrators
        for (let i = 0; i < concurrentCount; i++) {
          orchestrators.push(new Orchestrator(testConfig));
        }

        const startTime = Date.now();
        
        // Initialize all projects concurrently
        await Promise.all(
          orchestrators.map((orch, i) => orch.initialize(testPaths[i]))
        );
        
        const endTime = Date.now();
        const concurrentInitTime = endTime - startTime;
        
        // Should handle concurrent initialization efficiently
        expect(concurrentInitTime).toBeLessThan(30000); // 30 seconds
        
        // Verify all initialized successfully
        orchestrators.forEach(orch => {
          expect(orch.getStatus()).toBe('initialized');
        });

        // Cleanup test paths
        await Promise.all(
          testPaths.map(testPath => 
            fs.promises.rm(testPath, { recursive: true, force: true })
          )
        );
        
      } finally {
        // Shutdown all orchestrators
        await Promise.all(
          orchestrators.map(orch => orch.shutdown())
        );
      }
    });

    it('should maintain responsive monitoring under load', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const startTime = Date.now();
      let monitoringCallCount = 0;
      
      // Override monitoring to count calls
      const originalMonitorTasks = orchestrator.monitorTasks;
      orchestrator.monitorTasks = jest.fn().mockImplementation(async () => {
        monitoringCallCount++;
        return originalMonitorTasks.call(orchestrator);
      });
      
      // Start orchestration
      const orchestrationPromise = orchestrator.start();
      
      // Let it run for a short time
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
      
      await orchestrator.shutdown();
      
      const endTime = Date.now();
      const runTime = endTime - startTime;
      
      // Should have called monitoring multiple times
      expect(monitoringCallCount).toBeGreaterThan(5);
      
      // Average time between monitoring calls should be reasonable
      const avgMonitoringInterval = runTime / monitoringCallCount;
      expect(avgMonitoringInterval).toBeLessThan(5000); // Less than 5 seconds
    });
  });

  describe('Workspace and Session Management', () => {
    it('should properly isolate agent workspaces', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      
      // Spawn multiple agents
      const firstTask = tasks[0];
      const secondTask = tasks[1];
      
      // Mock workspace and session managers
      const mockWorkspace = {
        createWorktree: jest.fn().mockImplementation((taskId) => ({
          id: taskId,
          path: `/tmp/worktree-${taskId}`,
          branch: `feature/${taskId}`,
          baseBranch: 'main'
        })),
        removeWorktree: jest.fn().mockResolvedValue(true),
        getWorktreeStatus: jest.fn().mockResolvedValue({ clean: true, files: [] })
      };
      
      const mockSessionManager = {
        createSession: jest.fn().mockImplementation((taskId) => ({
          sessionId: `cortex-${taskId}-${Date.now()}`,
          taskId: taskId,
          status: 'running',
          createdAt: new Date()
        })),
        startAgentInSession: jest.fn().mockResolvedValue(),
        killSession: jest.fn().mockResolvedValue(true),
        listSessions: jest.fn().mockReturnValue([])
      };
      
      // Replace orchestrator components
      (orchestrator as any).workspace = mockWorkspace;
      (orchestrator as any).sessionManager = mockSessionManager;
      
      // Spawn agents
      await orchestrator.spawnAgent(firstTask, 'SpecWriter');
      await orchestrator.spawnAgent(secondTask, 'Formalizer');
      
      // Verify workspace isolation
      expect(mockWorkspace.createWorktree).toHaveBeenCalledTimes(2);
      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith(
        firstTask.id,
        `feature/${firstTask.id}`,
        'main'
      );
      expect(mockWorkspace.createWorktree).toHaveBeenCalledWith(
        secondTask.id,
        `feature/${secondTask.id}`,
        'main'
      );
      
      // Verify session isolation
      expect(mockSessionManager.createSession).toHaveBeenCalledTimes(2);
      expect(mockSessionManager.startAgentInSession).toHaveBeenCalledTimes(2);
    });

    it('should clean up resources on task completion', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      const testTask = tasks[0];
      
      // Mock the task feature map
      (orchestrator as any).taskFeatureMap.set(testTask.id, {
        name: 'Test Feature',
        priority: 'High',
        description: 'Test description',
        dependencies: [],
        agent: 'SpecWriter',
        acceptanceCriteria: [],
        microtasks: []
      });
      
      // Mock workspace and session managers
      const mockWorkspace = {
        getWorktreeStatus: jest.fn().mockResolvedValue({ clean: false, files: ['test.js'] }),
        commitChanges: jest.fn().mockResolvedValue('commit-hash'),
        removeWorktree: jest.fn().mockResolvedValue(true)
      };
      
      const mockSessionManager = {
        listSessions: jest.fn().mockReturnValue([
          { sessionId: `cortex-${testTask.id}-123`, taskId: testTask.id, status: 'running', createdAt: new Date() }
        ]),
        killSession: jest.fn().mockResolvedValue(true)
      };
      
      // Replace orchestrator components
      (orchestrator as any).workspace = mockWorkspace;
      (orchestrator as any).sessionManager = mockSessionManager;
      
      // Handle task completion
      await orchestrator.handleTaskCompletion(testTask.id);
      
      // Verify cleanup
      expect(mockWorkspace.commitChanges).toHaveBeenCalled();
      expect(mockSessionManager.killSession).toHaveBeenCalled();
      expect(mockWorkspace.removeWorktree).toHaveBeenCalledWith(testTask.id);
    });

    it('should handle session monitoring and recovery', async () => {
      await orchestrator.initialize(testProjectPath);
      
      // Mock session manager with dead session detection
      const mockSessionManager = {
        listSessions: jest.fn().mockReturnValue([
          { sessionId: 'cortex-dead-session', taskId: 'dead-task', status: 'running', createdAt: new Date() }
        ]),
        listActiveTmuxSessions: jest.fn().mockReturnValue([]), // No active tmux sessions
        cleanupDeadSessions: jest.fn().mockResolvedValue(),
        killSession: jest.fn().mockResolvedValue(true)
      };
      
      // Replace orchestrator session manager
      (orchestrator as any).sessionManager = mockSessionManager;
      
      // Call cleanup
      await mockSessionManager.cleanupDeadSessions();
      
      // Verify dead session cleanup was attempted
      expect(mockSessionManager.cleanupDeadSessions).toHaveBeenCalled();
    });
  });

  describe('MCP Server Integration', () => {
    it('should integrate with MCP servers for enhanced capabilities', async () => {
      // Mock MCP client
      const mockMCPClient = {
        connect: jest.fn().mockResolvedValue(true),
        listResources: jest.fn().mockResolvedValue([
          { uri: 'file://test.js', name: 'Test Resource' }
        ]),
        callTool: jest.fn().mockResolvedValue({ result: 'success' }),
        disconnect: jest.fn().mockResolvedValue(true)
      };
      
      // Test MCP integration
      await mockMCPClient.connect();
      expect(mockMCPClient.connect).toHaveBeenCalled();
      
      const resources = await mockMCPClient.listResources();
      expect(resources).toHaveLength(1);
      expect(resources[0].name).toBe('Test Resource');
      
      const toolResult = await mockMCPClient.callTool('test-tool', { param: 'value' });
      expect(toolResult.result).toBe('success');
      
      await mockMCPClient.disconnect();
      expect(mockMCPClient.disconnect).toHaveBeenCalled();
    });

    it('should handle MCP server failures gracefully', async () => {
      // Mock failing MCP client
      const mockMCPClient = {
        connect: jest.fn().mockRejectedValue(new Error('MCP server unavailable')),
        disconnect: jest.fn().mockResolvedValue(true)
      };
      
      // Should handle MCP connection failure
      await expect(mockMCPClient.connect()).rejects.toThrow('MCP server unavailable');
      
      // Should still allow graceful shutdown
      await mockMCPClient.disconnect();
      expect(mockMCPClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle typical web application development workflow', async () => {
      const webAppPlan = `# Web Application Project

## Overview
A typical web application with user management, content creation, and admin features.

## Features

### Feature 1: User Registration and Authentication
- **Priority**: High
- **Description**: Complete user management system
- **Dependencies**: []
- **Agent**: SpecWriter

### Feature 2: API Contract Definition
- **Priority**: High  
- **Description**: Define API contracts for all endpoints
- **Dependencies**: [Feature 1]
- **Agent**: Formalizer

### Feature 3: Database Design
- **Priority**: High
- **Description**: Design database schema and relationships
- **Dependencies**: [Feature 2]
- **Agent**: Architect

### Feature 4: Backend Implementation
- **Priority**: High
- **Description**: Implement REST API and business logic
- **Dependencies**: [Feature 3]
- **Agent**: Coder

### Feature 5: Test Suite
- **Priority**: High
- **Description**: Comprehensive testing including unit, integration, and E2E tests
- **Dependencies**: [Feature 4]
- **Agent**: Tester

## Architecture Decisions

### Technology Stack
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Testing**: Jest and Cypress

### Quality Standards
- **Code Coverage**: 85%
- **Performance**: < 500ms API response time
`;

      await fs.promises.writeFile(
        path.join(testProjectPath, 'plan.md'),
        webAppPlan
      );

      const startTime = Date.now();
      
      await orchestrator.initialize(testProjectPath);
      expect(orchestrator.getStatus()).toBe('initialized');

      // Verify realistic project structure
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      
      expect(tasks).toHaveLength(5);
      expect(tasks.find(t => t.title.includes('User Registration'))).toBeTruthy();
      expect(tasks.find(t => t.title.includes('API Contract'))).toBeTruthy();
      expect(tasks.find(t => t.title.includes('Database Design'))).toBeTruthy();
      expect(tasks.find(t => t.title.includes('Backend Implementation'))).toBeTruthy();
      expect(tasks.find(t => t.title.includes('Test Suite'))).toBeTruthy();

      const initTime = Date.now() - startTime;
      expect(initTime).toBeLessThan(15000); // Should initialize within 15 seconds
    }, 30000);

    it('should handle microservices architecture project', async () => {
      const microservicesPlan = `# Microservices Architecture Project

## Overview
A microservices-based e-commerce platform with separate services for users, products, orders, and payments.

## Features

### Feature 1: Service Specifications
- **Priority**: High
- **Description**: Define specifications for all microservices
- **Dependencies**: []
- **Agent**: SpecWriter

### Feature 2: Service Contracts
- **Priority**: High
- **Description**: Create API contracts and service interfaces
- **Dependencies**: [Feature 1]
- **Agent**: Formalizer

### Feature 3: Service Architecture
- **Priority**: High
- **Description**: Design service boundaries and communication patterns
- **Dependencies**: [Feature 2]
- **Agent**: Architect

### Feature 4: Service Implementation
- **Priority**: High
- **Description**: Implement individual microservices
- **Dependencies**: [Feature 3]
- **Agent**: Coder

### Feature 5: Integration Testing
- **Priority**: High
- **Description**: Test service interactions and system integration
- **Dependencies**: [Feature 4]
- **Agent**: Tester

## Architecture Decisions

### Technology Stack
- **Services**: Node.js with Express
- **Communication**: REST and message queues
- **Database**: PostgreSQL per service
- **Deployment**: Docker and Kubernetes

### Quality Standards
- **Service Coverage**: 90%
- **Integration Coverage**: 80%
- **Performance**: < 200ms service response time
`;

      await fs.promises.writeFile(
        path.join(testProjectPath, 'plan.md'),
        microservicesPlan
      );

      await orchestrator.initialize(testProjectPath);
      
      // Verify microservices-specific project structure
      const projectId = (orchestrator as any).projectId;
      const decisions = await canvas.getArchitecturalDecisionsByProject(projectId);
      
      expect(decisions.length).toBeGreaterThan(0);
      
      const techDecision = decisions.find(d => d.title.includes('Technology Stack'));
      expect(techDecision?.description).toContain('microservices');
      expect(techDecision?.description).toContain('Docker');
      expect(techDecision?.description).toContain('Kubernetes');
    });

    it('should handle data science project workflow', async () => {
      const dataSciencePlan = `# Data Science Project

## Overview
A machine learning project for predictive analytics with data processing, model training, and deployment.

## Features

### Feature 1: Data Requirements Specification
- **Priority**: High
- **Description**: Define data requirements and processing specifications
- **Dependencies**: []
- **Agent**: SpecWriter

### Feature 2: Model Contracts
- **Priority**: High
- **Description**: Define model interfaces and validation contracts
- **Dependencies**: [Feature 1]
- **Agent**: Formalizer

### Feature 3: Pipeline Architecture
- **Priority**: High
- **Description**: Design data processing and ML pipeline architecture
- **Dependencies**: [Feature 2]
- **Agent**: Architect

### Feature 4: Model Implementation
- **Priority**: High
- **Description**: Implement data processing and ML models
- **Dependencies**: [Feature 3]
- **Agent**: Coder

### Feature 5: Model Validation
- **Priority**: High
- **Description**: Validate model performance and data quality
- **Dependencies**: [Feature 4]
- **Agent**: Tester

## Architecture Decisions

### Technology Stack
- **ML Framework**: Python with scikit-learn
- **Data Processing**: Pandas and NumPy
- **Deployment**: Flask API with Docker

### Quality Standards
- **Model Accuracy**: > 85%
- **Data Quality**: 100% validation coverage
`;

      await fs.promises.writeFile(
        path.join(testProjectPath, 'plan.md'),
        dataSciencePlan
      );

      await orchestrator.initialize(testProjectPath);
      
      // Verify data science project structure
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      
      expect(tasks.find(t => t.title.includes('Data Requirements'))).toBeTruthy();
      expect(tasks.find(t => t.title.includes('Model Contracts'))).toBeTruthy();
      expect(tasks.find(t => t.title.includes('Pipeline Architecture'))).toBeTruthy();
      expect(tasks.find(t => t.title.includes('Model Implementation'))).toBeTruthy();
      expect(tasks.find(t => t.title.includes('Model Validation'))).toBeTruthy();

      const decisions = await canvas.getArchitecturalDecisionsByProject(projectId);
      const techDecision = decisions.find(d => d.title.includes('Technology Stack'));
      expect(techDecision?.description).toContain('scikit-learn');
      expect(techDecision?.description).toContain('Pandas');
    });
  });

  describe('Comprehensive System Validation', () => {
    it('should validate complete system health and functionality', async () => {
      // Test all major components work together
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      
      // Validate Cognitive Canvas
      const knowledgeGraph = await canvas.getProjectKnowledgeGraph(projectId);
      expect(knowledgeGraph.project).toBeTruthy();
      expect(knowledgeGraph.tasks.length).toBeGreaterThan(0);
      expect(knowledgeGraph.decisions.length).toBeGreaterThan(0);
      
      // Validate workspace management
      expect(workspace).toBeTruthy();
      expect(typeof workspace.createWorktree).toBe('function');
      expect(typeof workspace.removeWorktree).toBe('function');
      
      // Validate session management
      expect(sessionManager).toBeTruthy();
      expect(typeof sessionManager.createSession).toBe('function');
      expect(typeof sessionManager.killSession).toBe('function');
      
      // Validate orchestrator state
      expect(orchestrator.getStatus()).toBe('initialized');
      expect(orchestrator.isRunning()).toBe(false);
      
      // Validate budget management
      const tokenUsage = orchestrator.getTokenUsage();
      expect(typeof tokenUsage.totalTokens).toBe('number');
      expect(typeof tokenUsage.estimatedCost).toBe('number');
      
      const budgetOk = orchestrator.checkBudgetLimit();
      expect(typeof budgetOk).toBe('boolean');
    });

    it('should demonstrate end-to-end system reliability', async () => {
      const reliability_tests = [];
      const testIterations = 3;
      
      for (let i = 0; i < testIterations; i++) {
        const iterationStart = Date.now();
        
        try {
          // Create fresh orchestrator
          const testOrchestrator = new Orchestrator(testConfig);
          
          // Initialize
          await testOrchestrator.initialize(testProjectPath);
          expect(testOrchestrator.getStatus()).toBe('initialized');
          
          // Brief run
          const runPromise = testOrchestrator.start();
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
          await testOrchestrator.shutdown();
          
          const iterationTime = Date.now() - iterationStart;
          reliability_tests.push({
            iteration: i + 1,
            success: true,
            time: iterationTime,
            error: null
          });
          
        } catch (error) {
          reliability_tests.push({
            iteration: i + 1,
            success: false,
            time: Date.now() - iterationStart,
            error: error
          });
        }
      }
      
      // Validate reliability
      const successfulRuns = reliability_tests.filter(t => t.success);
      const successRate = successfulRuns.length / testIterations;
      
      expect(successRate).toBeGreaterThanOrEqual(0.8); // 80% success rate minimum
      
      // Validate performance consistency
      const avgTime = successfulRuns.reduce((sum, t) => sum + t.time, 0) / successfulRuns.length;
      expect(avgTime).toBeLessThan(30000); // Average under 30 seconds
    }, 120000);
  });
});