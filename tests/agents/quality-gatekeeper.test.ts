import { QualityGatekeeperAgent } from '../../src/agents/quality-gatekeeper';
import { Agent, AgentConfig, TaskContext } from '../../src/agent';
import { TaskData } from '../../src/cognitive-canvas';
import { CommandResult } from '../../src/workspace';

// Mock dependencies
jest.mock('../../src/claude-client');
jest.mock('../../src/workspace');
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/session');

describe('QualityGatekeeperAgent', () => {
  let agent: QualityGatekeeperAgent;
  let mockConfig: AgentConfig;
  let mockTask: TaskData;
  let mockContext: TaskContext;

  beforeEach(() => {
    mockConfig = {
      id: 'quality-gatekeeper-1',
      role: 'quality_gatekeeper',
      capabilities: ['linting', 'testing', 'coverage', 'quality_assurance'],
      claudeConfig: {
        apiKey: 'test-api-key',
        maxTokens: 4096,
        temperature: 0.7
      },
      workspaceRoot: '/test/workspace',
      cognitiveCanvasConfig: {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password'
      }
    };

    mockTask = {
      id: 'test-task-1',
      title: 'Quality Check Task',
      description: 'Validate code quality after coder completion',
      status: 'assigned',
      priority: 'high',
      projectId: 'test-project-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockContext = {
      projectInfo: {
        language: 'typescript',
        framework: 'node',
        testFramework: 'jest'
      },
      coverageThresholds: {
        statements: 80,
        branches: 75,
        functions: 85,
        lines: 80
      }
    };

    agent = new QualityGatekeeperAgent();
  });

  describe('initialization', () => {
    it('should initialize with proper configuration', async () => {
      await agent.initialize(mockConfig);
      
      expect(agent.getRole()).toBe('quality_gatekeeper');
      expect(agent.getCapabilities()).toEqual(['linting', 'testing', 'coverage', 'quality_assurance']);
      expect(agent.getStatus()).toBe('initialized');
    });
  });

  describe('receiveNotification', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
      await agent.receiveTask(mockTask, mockContext);
    });

    it('should receive coder completion notification', async () => {
      const notification = {
        type: 'coder_completion' as const,
        taskId: 'coder-task-1',
        timestamp: new Date().toISOString(),
        metadata: {
          filesModified: ['src/test.ts'],
          testsGenerated: ['tests/test.test.ts']
        }
      };

      const result = await agent.receiveNotification(notification);
      
      expect(result.success).toBe(true);
      expect(result.notificationReceived).toBe(true);
    });

    it('should reject invalid notification format', async () => {
      const invalidNotification = {
        type: 'invalid_type',
        timestamp: new Date().toISOString()
      } as any;

      await expect(agent.receiveNotification(invalidNotification))
        .rejects.toThrow('Invalid notification format');
    });
  });

  describe('runLinter', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
      await agent.receiveTask(mockTask, mockContext);
    });

    it('should run ESLint successfully', async () => {
      // Mock successful ESLint execution
      const mockExecuteCommand = jest.spyOn(agent as any, 'executeCommand');
      mockExecuteCommand.mockResolvedValue({
        exitCode: 0,
        stdout: 'ESLint passed with no errors',
        stderr: ''
      } as CommandResult);

      const result = await agent.runLinter();
      
      expect(result.success).toBe(true);
      expect(result.lintingPassed).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockExecuteCommand).toHaveBeenCalledWith('npx eslint src tests --ext .ts,.js --format json');
    });

    it('should handle ESLint errors', async () => {
      const mockExecuteCommand = jest.spyOn(agent as any, 'executeCommand');
      const eslintOutput = JSON.stringify([
        {
          filePath: '/test/src/test.ts',
          messages: [
            {
              ruleId: 'no-unused-vars',
              severity: 2,
              message: 'Variable is defined but never used',
              line: 10,
              column: 5
            }
          ]
        }
      ]);
      
      mockExecuteCommand
        .mockResolvedValueOnce({
          exitCode: 1,
          stdout: eslintOutput,
          stderr: ''
        } as CommandResult) // ESLint
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: '',
          stderr: ''
        } as CommandResult); // Prettier

      const result = await agent.runLinter();
      
      expect(result.success).toBe(false);
      expect(result.lintingPassed).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('no-unused-vars');
    });

    it('should run Prettier check', async () => {
      const mockExecuteCommand = jest.spyOn(agent as any, 'executeCommand');
      mockExecuteCommand
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as CommandResult) // ESLint
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as CommandResult); // Prettier

      const result = await agent.runLinter();
      
      expect(result.success).toBe(true);
      expect(mockExecuteCommand).toHaveBeenCalledWith('npx prettier --check src tests --parser typescript');
    });
  });

  describe('runTests', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
      await agent.receiveTask(mockTask, mockContext);
    });

    it('should run unit tests successfully', async () => {
      const mockExecuteCommand = jest.spyOn(agent as any, 'executeCommand');
      mockExecuteCommand.mockResolvedValue({
        exitCode: 0,
        stdout: 'Tests: 5 passed, 5 total',
        stderr: ''
      } as CommandResult);

      const result = await agent.runTests();
      
      expect(result.success).toBe(true);
      expect(result.unitTestsPassed).toBe(true);
      expect(result.integrationTestsPassed).toBe(true);
      expect(mockExecuteCommand).toHaveBeenCalledWith('npm test');
    });

    it('should handle test failures', async () => {
      const mockExecuteCommand = jest.spyOn(agent as any, 'executeCommand');
      mockExecuteCommand
        .mockResolvedValueOnce({
          exitCode: 1,
          stdout: 'Tests: 3 passed, 2 failed, 5 total',
          stderr: 'Test suite failed'
        } as CommandResult) // Unit tests
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'Integration tests passed', 
          stderr: ''
        } as CommandResult); // Integration tests

      const result = await agent.runTests();
      
      expect(result.success).toBe(false);
      expect(result.unitTestsPassed).toBe(false);
      expect(result.errors[0]).toContain('Test suite failed');
    });

    it('should run integration tests separately', async () => {
      const mockExecuteCommand = jest.spyOn(agent as any, 'executeCommand');
      mockExecuteCommand
        .mockResolvedValueOnce({ exitCode: 0, stdout: 'Unit tests passed', stderr: '' } as CommandResult)
        .mockResolvedValueOnce({ exitCode: 0, stdout: 'Integration tests passed', stderr: '' } as CommandResult);

      const result = await agent.runTests();
      
      expect(result.success).toBe(true);
      expect(mockExecuteCommand).toHaveBeenCalledWith('npm test -- --testPathPattern=integration');
    });
  });

  describe('validateCoverage', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
      await agent.receiveTask(mockTask, mockContext);
    });

    it('should validate coverage thresholds successfully', async () => {
      const mockExecuteCommand = jest.spyOn(agent as any, 'executeCommand');
      const coverageOutput = JSON.stringify({
        total: {
          statements: { pct: 85 },
          branches: { pct: 80 },
          functions: { pct: 90 },
          lines: { pct: 85 }
        }
      });
      
      mockExecuteCommand.mockResolvedValue({
        exitCode: 0,
        stdout: coverageOutput,
        stderr: ''
      } as CommandResult);

      const result = await agent.validateCoverage();
      
      expect(result.success).toBe(true);
      expect(result.coverageThresholdsMet).toBe(true);
      expect(result.coverageData.statements).toBe(85);
    });

    it('should fail when coverage thresholds not met', async () => {
      const mockExecuteCommand = jest.spyOn(agent as any, 'executeCommand');
      const coverageOutput = JSON.stringify({
        total: {
          statements: { pct: 70 }, // Below 80% threshold
          branches: { pct: 60 },   // Below 75% threshold
          functions: { pct: 90 },
          lines: { pct: 75 }       // Below 80% threshold
        }
      });
      
      mockExecuteCommand.mockResolvedValue({
        exitCode: 0,
        stdout: coverageOutput,
        stderr: ''
      } as CommandResult);

      const result = await agent.validateCoverage();
      
      expect(result.success).toBe(false);
      expect(result.coverageThresholdsMet).toBe(false);
      expect(result.errors).toHaveLength(3); // statements, branches, lines
    });
  });

  describe('generateReport', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
      await agent.receiveTask(mockTask, mockContext);
    });

    it('should generate comprehensive PASS report', async () => {
      const mockResults = {
        linting: { success: true, lintingPassed: true, errors: [], warnings: [] },
        testing: { success: true, unitTestsPassed: true, integrationTestsPassed: true, errors: [] },
        coverage: { success: true, coverageThresholdsMet: true, coverageData: { statements: 85, branches: 80, functions: 90, lines: 85 }, errors: [] }
      };

      const report = await agent.generateReport(mockResults);
      
      expect(report.overallStatus).toBe('PASS');
      expect(report.summary).toContain('All quality checks passed');
      expect(report.linting.status).toBe('PASS');
      expect(report.testing.status).toBe('PASS');
      expect(report.coverage.status).toBe('PASS');
    });

    it('should generate detailed FAIL report', async () => {
      const mockResults = {
        linting: { 
          success: false, 
          lintingPassed: false, 
          errors: ['ESLint: no-unused-vars at line 10'],
          warnings: []
        },
        testing: { 
          success: false, 
          unitTestsPassed: false, 
          integrationTestsPassed: true, 
          errors: ['Unit test failed: should validate input'] 
        },
        coverage: { 
          success: false, 
          coverageThresholdsMet: false, 
          coverageData: { statements: 70, branches: 60, functions: 80, lines: 75 }, 
          errors: ['Statements coverage 70% below threshold 80%'] 
        }
      };

      const report = await agent.generateReport(mockResults);
      
      expect(report.overallStatus).toBe('FAIL');
      expect(report.summary).toContain('Quality checks failed');
      expect(report.linting.status).toBe('FAIL');
      expect(report.testing.status).toBe('FAIL');
      expect(report.coverage.status).toBe('FAIL');
      expect(report.linting.errors).toHaveLength(1);
      expect(report.testing.errors).toHaveLength(1);
      expect(report.coverage.errors).toHaveLength(1);
    });
  });

  describe('executeTask', () => {
    beforeEach(async () => {
      await agent.initialize(mockConfig);
      await agent.receiveTask(mockTask, mockContext);
    });

    it('should execute complete quality check workflow successfully', async () => {
      // First provide a notification
      const notification = {
        type: 'coder_completion' as const,
        taskId: 'coder-task-1',
        timestamp: new Date().toISOString(),
        metadata: {
          filesModified: ['src/test.ts'],
          testsGenerated: ['tests/test.test.ts']
        }
      };
      await agent.receiveNotification(notification);

      const mockExecuteCommand = jest.spyOn(agent as any, 'executeCommand');
      
      // Mock all command executions to succeed
      mockExecuteCommand
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as CommandResult) // ESLint
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as CommandResult) // Prettier
        .mockResolvedValueOnce({ exitCode: 0, stdout: 'Tests passed', stderr: '' } as CommandResult) // Unit tests
        .mockResolvedValueOnce({ exitCode: 0, stdout: 'Integration tests passed', stderr: '' } as CommandResult) // Integration tests
        .mockResolvedValueOnce({ 
          exitCode: 0, 
          stdout: JSON.stringify({
            total: {
              statements: { pct: 85 },
              branches: { pct: 80 },
              functions: { pct: 90 },
              lines: { pct: 85 }
            }
          }), 
          stderr: '' 
        } as CommandResult); // Coverage

      const result = await agent.run();
      
      expect(result.success).toBe(true);
      expect(result.result.overallStatus).toBe('PASS');
    });

    it('should handle quality check failures', async () => {
      // First provide a notification
      const notification = {
        type: 'coder_completion' as const,
        taskId: 'coder-task-1',
        timestamp: new Date().toISOString(),
        metadata: {
          filesModified: ['src/test.ts'],
          testsGenerated: ['tests/test.test.ts']
        }
      };
      await agent.receiveNotification(notification);

      const mockExecuteCommand = jest.spyOn(agent as any, 'executeCommand');
      
      // Mock ESLint to fail
      mockExecuteCommand.mockResolvedValue({
        exitCode: 1,
        stdout: JSON.stringify([{
          filePath: '/test/src/test.ts',
          messages: [{ ruleId: 'error', severity: 2, message: 'Syntax error', line: 1 }]
        }]),
        stderr: ''
      } as CommandResult);

      const result = await agent.run();
      
      expect(result.success).toBe(true); // Task completes but with FAIL status
      expect(result.result.overallStatus).toBe('FAIL');
    });
  });

  describe('getPromptTemplate', () => {
    it('should return quality gatekeeper prompt template', () => {
      const template = agent.getPromptTemplate();
      
      expect(template).toContain('Quality Gatekeeper');
      expect(template).toContain('validating code quality');
      expect(template).toContain('linting');
      expect(template).toContain('tests pass');
      expect(template).toContain('coverage');
    });
  });
});