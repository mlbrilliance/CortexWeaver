import { PersonaLoader, PersonaConfig } from '../../src/persona';
import { Agent, AgentConfig } from '../../src/agent';
import { ClaudeModel } from '../../src/claude-client';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('../../src/claude-client');
jest.mock('../../src/workspace');
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/session');
jest.mock('fs');

describe('Persona Integration Tests', () => {
  let testAgent: TestIntegrationAgent;
  let mockFs: jest.Mocked<typeof fs>;
  let tempDir: string;

  // Test agent implementation
  class TestIntegrationAgent extends Agent {
    async executeTask(): Promise<any> {
      return { success: true, result: 'integration test completed' };
    }

    getPromptTemplate(): string {
      return 'Integration test agent prompt template: {{context}}';
    }
  }

  const baseConfig: AgentConfig = {
    id: 'test-integration-agent',
    role: 'integration-tester',
    capabilities: ['testing', 'integration'],
    claudeConfig: {
      apiKey: 'test-key',
      defaultModel: ClaudeModel.SONNET
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
    mockFs = fs as jest.Mocked<typeof fs>;
    tempDir = '/test/workspace/prompts';
    testAgent = new TestIntegrationAgent();

    // Setup default mocks
    setupDefaultMocks();
  });

  function setupDefaultMocks(): void {
    mockFs.existsSync.mockImplementation((path: string) => {
      return path.includes('prompts') || path.toString().endsWith('.md');
    });

    mockFs.statSync.mockReturnValue({
      mtime: new Date('2024-01-01T00:00:00Z'),
      isFile: () => true,
      isDirectory: () => false
    } as fs.Stats);

    mockFs.readFileSync.mockImplementation((filePath: string) => {
      const fileName = path.basename(filePath.toString());
      
      switch (fileName) {
        case 'test-integration.md':
          return `# Test Integration Agent Persona

## Role
**Integration Test Specialist**

## Core Identity
You are the Test Integration Agent, specialized in integration testing and system validation.

## Primary Responsibilities

### Integration Testing
- Design and execute integration test suites
- Validate system component interactions
- Identify integration failure points

### System Validation
- Verify end-to-end workflows
- Validate data flow between components
- Ensure system reliability

## Behavioral Guidelines

### Testing Approach
- Focus on real-world scenarios
- Test component boundaries
- Validate error handling

### Quality Standards
- Comprehensive integration coverage
- Realistic test data
- Clear failure reporting

## Interaction Patterns

### With Development Teams
- Collaborate on integration strategies
- Provide system-level feedback
- Support debugging complex issues

### With Quality Assurance
- Coordinate testing approaches
- Share integration insights
- Support quality metrics

## Success Metrics
- Integration test coverage
- System reliability metrics
- Issue detection rates

## Adaptation Triggers
- When integration patterns change
- When new components are added
- When system architecture evolves

## Version
- Initial Release: CortexWeaver 3.0
- Last Updated: Integration Test Setup
- Improvement Trigger: Integration effectiveness metrics`;

        case 'updated-test-integration.md':
          return `# Updated Test Integration Agent Persona

## Role
**Enhanced Integration Test Specialist**

## Core Identity
You are the enhanced Test Integration Agent with improved capabilities for integration testing and system validation.

## Primary Responsibilities

### Advanced Integration Testing
- Design comprehensive integration test suites
- Execute cross-system validation
- Perform load and stress testing
- Identify performance bottlenecks

### Enhanced System Validation
- Verify complex end-to-end workflows
- Validate data integrity across systems
- Ensure high availability and reliability
- Monitor system performance metrics

## Behavioral Guidelines

### Enhanced Testing Approach
- Use data-driven testing strategies
- Implement continuous integration testing
- Focus on automation and scalability
- Test failure recovery scenarios

### Elevated Quality Standards
- 95%+ integration test coverage
- Production-realistic test environments
- Automated failure detection and reporting
- Performance benchmarking

## Interaction Patterns

### With Development Teams
- Lead integration architecture discussions
- Provide proactive system feedback
- Support complex debugging scenarios
- Guide integration best practices

### With Quality Assurance
- Define integration quality standards
- Share advanced testing methodologies
- Coordinate cross-team testing efforts
- Support continuous improvement

## Success Metrics
- Integration test coverage >95%
- System uptime >99.9%
- Mean time to detection <5 minutes
- Issue resolution time reduction

## Adaptation Triggers
- When system complexity increases
- When performance requirements change
- When new integration patterns emerge
- When quality standards evolve

## Version
- Initial Release: CortexWeaver 3.0
- Last Updated: Enhanced Integration Setup
- Improvement Trigger: Advanced integration metrics, performance requirements`;

        default:
          return 'Default persona content';
      }
    });

    mockFs.readdirSync.mockReturnValue(['test-integration.md'] as any);
    mockFs.watch.mockReturnValue({
      close: jest.fn()
    } as any);
  }

  describe('End-to-End Persona Loading', () => {
    it('should load persona during agent initialization', async () => {
      await testAgent.initialize({
        ...baseConfig,
        personaConfig: {
          promptsDirectory: tempDir,
          enableHotReload: false,
          validateFormat: true
        }
      });

      const persona = testAgent.getCurrentPersona();
      expect(persona).toBeDefined();
      expect(persona?.role).toBe('Integration Test Specialist');
      expect(persona?.coreIdentity).toContain('Test Integration Agent');
    });

    it('should fallback gracefully when persona file missing', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('prompts') && !path.toString().endsWith('.md');
      });

      await testAgent.initialize({
        ...baseConfig,
        personaConfig: {
          promptsDirectory: tempDir,
          enableHotReload: false,
          validateFormat: true
        }
      });

      // Should still initialize successfully
      expect(testAgent.getStatus()).toBe('initialized');
      
      // Should use traditional prompt template
      const prompt = testAgent.getPersonaPrompt();
      expect(prompt).toBe('Integration test agent prompt template: {{context}}');
    });

    it('should use fallback when prompts directory does not exist', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        return !path.includes('prompts');
      });

      await testAgent.initialize({
        ...baseConfig,
        personaConfig: {
          promptsDirectory: '/nonexistent',
          enableHotReload: false
        }
      });

      expect(testAgent.getStatus()).toBe('initialized');
      expect(testAgent.getCurrentPersona()).toBeNull();
    });
  });

  describe('Hot Reloading Scenarios', () => {
    let watchCallback: (eventType: string, filename: string) => void;

    beforeEach(async () => {
      mockFs.watch.mockImplementation((path: string, callback: any) => {
        watchCallback = callback;
        return { close: jest.fn() } as any;
      });

      await testAgent.initialize({
        ...baseConfig,
        personaConfig: {
          promptsDirectory: tempDir,
          enableHotReload: true,
          validateFormat: true
        }
      });
    });

    it('should setup file watcher for hot reloading', async () => {
      expect(mockFs.watch).toHaveBeenCalledWith(
        expect.stringContaining('test-integration.md'),
        expect.any(Function)
      );
    });

    it('should clear cache when file changes', async () => {
      const originalPersona = testAgent.getCurrentPersona();
      expect(originalPersona?.version.lastUpdated).toBe('Integration Test Setup');

      // Simulate file change
      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.toString().includes('test-integration.md')) {
          return mockFs.readFileSync('updated-test-integration.md');
        }
        return 'default content';
      });

      // Trigger file change event
      watchCallback('change', 'test-integration.md');

      // Force reload by requesting persona again
      await testAgent.refreshPersona();

      const updatedPersona = testAgent.getCurrentPersona();
      expect(updatedPersona?.role).toBe('Enhanced Integration Test Specialist');
      expect(updatedPersona?.version.lastUpdated).toBe('Enhanced Integration Setup');
    });

    it('should handle file watcher errors gracefully', async () => {
      mockFs.watch.mockImplementation(() => {
        throw new Error('Watcher setup failed');
      });

      // Should not throw during initialization
      const newAgent = new TestIntegrationAgent();
      await expect(newAgent.initialize({
        ...baseConfig,
        personaConfig: {
          promptsDirectory: tempDir,
          enableHotReload: true
        }
      })).resolves.not.toThrow();

      expect(newAgent.getStatus()).toBe('initialized');
    });
  });

  describe('Fallback Scenarios', () => {
    it('should use raw content fallback for malformed persona', async () => {
      mockFs.readFileSync.mockReturnValue('Invalid persona content without proper markdown structure');

      await testAgent.initialize({
        ...baseConfig,
        personaConfig: {
          promptsDirectory: tempDir,
          fallbackToRaw: true,
          validateFormat: true
        }
      });

      const persona = testAgent.getCurrentPersona();
      expect(persona).toBeDefined();
      expect(persona?.role).toBe('Unknown Role');
      expect(persona?.rawContent).toBe('Invalid persona content without proper markdown structure');

      const loadResult = testAgent.getPersonaLoadResult();
      expect(loadResult?.usedFallback).toBe(true);
      expect(loadResult?.warnings.length).toBeGreaterThan(0);
    });

    it('should fail gracefully when fallback is disabled', async () => {
      mockFs.readFileSync.mockReturnValue('Invalid content');

      await testAgent.initialize({
        ...baseConfig,
        personaConfig: {
          promptsDirectory: tempDir,
          fallbackToRaw: false,
          validateFormat: true
        }
      });

      const persona = testAgent.getCurrentPersona();
      expect(persona).toBeNull();

      const loadResult = testAgent.getPersonaLoadResult();
      expect(loadResult?.success).toBe(false);
      expect(loadResult?.usedFallback).toBe(false);
    });

    it('should handle file read errors gracefully', async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      await testAgent.initialize({
        ...baseConfig,
        personaConfig: {
          promptsDirectory: tempDir,
          validateFormat: true
        }
      });

      expect(testAgent.getStatus()).toBe('initialized');
      expect(testAgent.getCurrentPersona()).toBeNull();

      const loadResult = testAgent.getPersonaLoadResult();
      expect(loadResult?.success).toBe(false);
      expect(loadResult?.error).toContain('File read error');
    });
  });

  describe('Cache Behavior Integration', () => {
    it('should respect cache TTL in real scenarios', async () => {
      await testAgent.initialize({
        ...baseConfig,
        personaConfig: {
          promptsDirectory: tempDir,
          cacheTtl: 100, // 100ms for testing
          validateFormat: true
        }
      });

      // First load
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);

      // Immediate second load should use cache
      await testAgent.refreshPersona();
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);

      // Wait for cache expiry
      await new Promise(resolve => setTimeout(resolve, 150));

      // Third load should reload due to expired cache
      await testAgent.refreshPersona();
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });

    it('should reload when file modification time changes', async () => {
      await testAgent.initialize({
        ...baseConfig,
        personaConfig: {
          promptsDirectory: tempDir,
          cacheTtl: 300000, // 5 minutes
          validateFormat: true
        }
      });

      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);

      // Simulate file modification
      mockFs.statSync.mockReturnValue({
        mtime: new Date('2024-01-02T00:00:00Z'), // Newer timestamp
        isFile: () => true,
        isDirectory: () => false
      } as fs.Stats);

      // Should reload due to file modification
      await testAgent.refreshPersona();
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('Prompt Generation Integration', () => {
    beforeEach(async () => {
      await testAgent.initialize({
        ...baseConfig,
        personaConfig: {
          promptsDirectory: tempDir,
          validateFormat: true
        }
      });
    });

    it('should generate contextual prompts with task information', async () => {
      const task = {
        id: 'integration-task-1',
        title: 'Integration Test Task',
        description: 'Test integration between components',
        status: 'pending',
        priority: 'high',
        projectId: 'test-project',
        createdAt: new Date().toISOString()
      };

      await testAgent.receiveTask(task, {
        projectInfo: { name: 'Test Integration Project' }
      });

      const prompt = testAgent.getPersonaPrompt({
        customContext: 'integration testing'
      });

      expect(prompt).toContain('Integration Test Specialist');
      expect(prompt).toContain('Test Integration Agent');
      expect(prompt).toContain('taskTitle: Integration Test Task');
      expect(prompt).toContain('customContext: integration testing');
    });

    it('should handle missing task gracefully in prompt generation', async () => {
      const prompt = testAgent.getPersonaPrompt({
        testMode: 'standalone'
      });

      expect(prompt).toContain('Integration Test Specialist');
      expect(prompt).toContain('taskTitle: No current task');
      expect(prompt).toContain('testMode: standalone');
    });
  });

  describe('Error Recovery Integration', () => {
    it('should continue working after persona loading failures', async () => {
      // First initialization with failing persona
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Initial read failure');
      });

      await testAgent.initialize({
        ...baseConfig,
        personaConfig: {
          promptsDirectory: tempDir,
          validateFormat: true
        }
      });

      expect(testAgent.getStatus()).toBe('initialized');
      expect(testAgent.getCurrentPersona()).toBeNull();

      // Fix the file and refresh
      setupDefaultMocks();
      await testAgent.refreshPersona();

      expect(testAgent.getCurrentPersona()).toBeDefined();
      expect(testAgent.getCurrentPersona()?.role).toBe('Integration Test Specialist');
    });

    it('should handle persona loader disposal during operation', async () => {
      await testAgent.initialize({
        ...baseConfig,
        personaConfig: {
          promptsDirectory: tempDir,
          enableHotReload: true
        }
      });

      expect(testAgent.getCurrentPersona()).toBeDefined();

      // Dispose and ensure graceful handling
      testAgent.dispose();

      expect(testAgent.getCurrentPersona()).toBeNull();
      expect(() => testAgent.getPersonaPrompt()).not.toThrow();
    });
  });
});