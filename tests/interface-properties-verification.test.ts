/**
 * Test suite to verify all required interface properties are present and accessible
 * This test verifies the properties mentioned in the Phase 1 TypeScript compilation fixes task
 */

import { TaskData, TestResult, Neo4jConfig, PheromoneData } from '../src/cognitive-canvas';
import { TaskResult } from '../src/agent';
import { PersonaConfig } from '../src/persona';

describe('Interface Properties Verification', () => {
  describe('TaskData Interface', () => {
    it('should have errorLogs property accessible', () => {
      const taskData: TaskData = {
        id: 'test-task',
        title: 'Test Task',
        description: 'Test description',
        status: 'pending',
        priority: 'high',
        projectId: 'test-project',
        createdAt: '2023-01-01T00:00:00Z',
        errorLogs: ['Error 1', 'Error 2']
      };

      expect(taskData.errorLogs).toBeDefined();
      expect(Array.isArray(taskData.errorLogs)).toBe(true);
      expect(taskData.errorLogs?.[0]).toBe('Error 1');
    });

    it('should have testResults property accessible', () => {
      const testResult: TestResult = {
        name: 'Test 1',
        status: 'passed',
        duration: 100
      };

      const taskData: TaskData = {
        id: 'test-task',
        title: 'Test Task',
        description: 'Test description',
        status: 'pending',
        priority: 'high',
        projectId: 'test-project',
        createdAt: '2023-01-01T00:00:00Z',
        testResults: [testResult]
      };

      expect(taskData.testResults).toBeDefined();
      expect(Array.isArray(taskData.testResults)).toBe(true);
      expect(taskData.testResults?.[0]?.name).toBe('Test 1');
    });

    it('should have requirements property accessible', () => {
      const taskData: TaskData = {
        id: 'test-task',
        title: 'Test Task',
        description: 'Test description',
        status: 'pending',
        priority: 'high',
        projectId: 'test-project',
        createdAt: '2023-01-01T00:00:00Z',
        requirements: ['Requirement 1', 'Requirement 2']
      };

      expect(taskData.requirements).toBeDefined();
      expect(Array.isArray(taskData.requirements)).toBe(true);
      expect(taskData.requirements?.[0]).toBe('Requirement 1');
    });

    it('should have metadata property accessible', () => {
      const taskData: TaskData = {
        id: 'test-task',
        title: 'Test Task',
        description: 'Test description',
        status: 'pending',
        priority: 'high',
        projectId: 'test-project',
        createdAt: '2023-01-01T00:00:00Z',
        metadata: { agentType: 'debugger', complexity: 'high' }
      };

      expect(taskData.metadata).toBeDefined();
      expect(typeof taskData.metadata).toBe('object');
      expect(taskData.metadata?.agentType).toBe('debugger');
    });
  });

  describe('TaskResult Interface', () => {
    it('should have output property accessible', () => {
      const taskResult: TaskResult = {
        success: true,
        result: 'Test result',
        output: 'Test output data'
      };

      expect(taskResult.output).toBeDefined();
      expect(taskResult.output).toBe('Test output data');
    });
  });

  describe('PersonaConfig Interface', () => {
    it('should have workspaceRoot property accessible', () => {
      const personaConfig: PersonaConfig = {
        promptsDirectory: '/prompts',
        enableHotReload: true,
        cacheTtl: 300000,
        validateFormat: true,
        fallbackToRaw: true,
        workspaceRoot: '/workspace'
      };

      expect(personaConfig.workspaceRoot).toBeDefined();
      expect(personaConfig.workspaceRoot).toBe('/workspace');
    });
  });

  describe('Neo4jConfig Interface', () => {
    it('should have projectId property accessible', () => {
      const neo4jConfig: Neo4jConfig = {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password',
        projectId: 'test-project-123'
      };

      expect(neo4jConfig.projectId).toBeDefined();
      expect(neo4jConfig.projectId).toBe('test-project-123');
    });
  });

  describe('PheromoneData Interface', () => {
    it('should have id property accessible', () => {
      const pheromoneData: PheromoneData = {
        id: 'pheromone-123',
        type: 'guide',
        strength: 0.8,
        context: 'test context',
        metadata: {},
        createdAt: '2023-01-01T00:00:00Z',
        expiresAt: '2023-01-01T01:00:00Z'
      };

      expect(pheromoneData.id).toBeDefined();
      expect(pheromoneData.id).toBe('pheromone-123');
    });

    it('should have createdAt property accessible', () => {
      const pheromoneData: PheromoneData = {
        id: 'pheromone-123',
        type: 'guide',
        strength: 0.8,
        context: 'test context',
        metadata: {},
        createdAt: '2023-01-01T00:00:00Z',
        expiresAt: '2023-01-01T01:00:00Z'
      };

      expect(pheromoneData.createdAt).toBeDefined();
      expect(pheromoneData.createdAt).toBe('2023-01-01T00:00:00Z');
    });

    it('should have expiresAt property accessible', () => {
      const pheromoneData: PheromoneData = {
        id: 'pheromone-123',
        type: 'guide',
        strength: 0.8,
        context: 'test context',
        metadata: {},
        createdAt: '2023-01-01T00:00:00Z',
        expiresAt: '2023-01-01T01:00:00Z'
      };

      expect(pheromoneData.expiresAt).toBeDefined();
      expect(pheromoneData.expiresAt).toBe('2023-01-01T01:00:00Z');
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should allow property access like in debugger agent (line 99)', () => {
      const task: TaskData = {
        id: 'debug-task',
        title: 'Debug Task',
        description: 'Task to debug',
        status: 'pending',
        priority: 'high',
        projectId: 'test-project',
        createdAt: '2023-01-01T00:00:00Z',
        errorLogs: ['Error message 1', 'Error message 2']
      };

      // This simulates src/agents/debugger/debugger-agent.ts:99
      const errorLogs = task.errorLogs || [];
      expect(errorLogs).toBeDefined();
      expect(errorLogs.length).toBe(2);
    });

    it('should allow property access like in debugger agent (line 100)', () => {
      const testResult: TestResult = {
        name: 'Unit Test 1',
        status: 'failed',
        error: 'Assertion failed'
      };

      const task: TaskData = {
        id: 'debug-task',
        title: 'Debug Task',
        description: 'Task to debug',
        status: 'pending',
        priority: 'high',
        projectId: 'test-project',
        createdAt: '2023-01-01T00:00:00Z',
        testResults: [testResult]
      };

      // This simulates src/agents/debugger/debugger-agent.ts:100
      const testResults = task.testResults || [];
      expect(testResults).toBeDefined();
      expect(testResults.length).toBe(1);
      expect(testResults[0].status).toBe('failed');
    });

    it('should allow property access like in formalizer agent (line 138)', () => {
      const task: TaskData = {
        id: 'formalizer-task',
        title: 'Formalizer Task',
        description: 'Task to formalize',
        status: 'pending',
        priority: 'high',
        projectId: 'test-project',
        createdAt: '2023-01-01T00:00:00Z',
        requirements: ['REQ-1: System must handle authentication', 'REQ-2: API must be RESTful']
      };

      // This simulates src/agents/formalizer/formalizer-agent.ts:138
      const requirements = task.requirements || ['Generate basic API specification'];
      expect(requirements).toBeDefined();
      expect(requirements.length).toBe(2);
      expect(requirements[0]).toContain('authentication');
    });

    it('should allow property access like in cost monitor (line 85)', () => {
      const task: TaskData = {
        id: 'cost-task',
        title: 'Cost Task',
        description: 'Task for cost monitoring',
        status: 'pending',
        priority: 'high',
        projectId: 'test-project',
        createdAt: '2023-01-01T00:00:00Z',
        metadata: { agentType: 'debugger', complexity: 'high' }
      };

      // This simulates src/agents/governor/cost-monitor.ts:85
      const agentType = task.metadata?.agentType || 'unknown';
      expect(agentType).toBeDefined();
      expect(agentType).toBe('debugger');
    });

    it('should allow TaskResult output property access (line 154)', () => {
      const taskResult: TaskResult = {
        success: true,
        result: { contractId: 'contract-123' },
        output: 'Generated OpenAPI specification'
      };

      // This simulates the usage mentioned for line 154
      expect(taskResult.output).toBeDefined();
      expect(typeof taskResult.output).toBe('string');
      expect(taskResult.output).toBe('Generated OpenAPI specification');
    });

    it('should demonstrate all properties working together in orchestrator context', () => {
      // Create a comprehensive task with all properties
      const task: TaskData = {
        id: 'comprehensive-task',
        title: 'Comprehensive Task',
        description: 'Task with all properties',
        status: 'running',
        priority: 'high',
        projectId: 'test-project',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T01:00:00Z',
        errorLogs: ['Warning: deprecated API usage'],
        testResults: [{
          name: 'Integration Test',
          status: 'passed',
          duration: 2500
        }],
        requirements: ['REQ-1: Authentication', 'REQ-2: Authorization'],
        metadata: {
          agentType: 'debugger',
          complexity: 'medium',
          estimatedTime: 3600,
          dependencies: ['auth-service', 'user-service']
        }
      };

      // Verify all properties are accessible
      expect(task.errorLogs).toBeDefined();
      expect(task.testResults).toBeDefined();
      expect(task.requirements).toBeDefined();
      expect(task.metadata).toBeDefined();

      // Verify they can be used in real scenarios
      const hasErrors = (task.errorLogs?.length || 0) > 0;
      const allTestsPassed = task.testResults?.every(t => t.status === 'passed') || false;
      const hasRequirements = (task.requirements?.length || 0) > 0;
      const agentType = task.metadata?.agentType;

      expect(hasErrors).toBe(true);
      expect(allTestsPassed).toBe(true);
      expect(hasRequirements).toBe(true);
      expect(agentType).toBe('debugger');
    });
  });
});