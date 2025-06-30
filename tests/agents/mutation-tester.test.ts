import { MutationTester } from '../../src/agents/mutation-tester';
import { AgentConfig, TaskContext, TaskData } from '../../src/agent';
import { ClaudeModel } from '../../src/claude-client';

describe('MutationTester', () => {
  let mutationTester: MutationTester;
  let mockConfig: AgentConfig;
  let mockTask: TaskData;
  let mockContext: TaskContext;

  beforeEach(() => {
    mockConfig = {
      id: 'mutation-tester-1',
      role: 'mutation-tester',
      capabilities: ['mutation-testing', 'test-quality-audit', 'coverage-analysis'],
      claudeConfig: {
        apiKey: 'test-api-key',
        defaultModel: ClaudeModel.SONNET,
        maxTokens: 4096,
        temperature: 0.7
      },
      workspaceRoot: '/tmp/test-workspace',
      cognitiveCanvasConfig: {
        uri: 'neo4j://localhost:7687',
        username: 'neo4j',
        password: 'test-password'
      }
    };

    mockTask = {
      id: 'test-task-1',
      title: 'Audit test suite effectiveness for Calculator',
      description: 'Run mutation testing to identify weak tests',
      status: 'pending',
      priority: 'high',
      projectId: 'test-project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as TaskData & {
      assignedTo: string;
      dependencies: any[];
      metadata: any;
    };

    (mockTask as any).assignedTo = 'mutation-tester-1';
    (mockTask as any).dependencies = [];
    (mockTask as any).metadata = {
      testType: 'mutation',
      targetClass: 'Calculator',
      mutationFramework: 'stryker'
    };

    mockContext = {
      projectInfo: {
        name: 'TestProject',
        language: 'typescript'
      },
      files: ['src/Calculator.ts'],
      testFiles: ['tests/Calculator.test.ts'],
      mutationFramework: 'stryker'
    };

    mutationTester = new MutationTester();
  });

  describe('initialization', () => {
    it('should initialize with correct capabilities', () => {
      expect(mutationTester.getCapabilities()).toEqual([]);
      expect(mutationTester.getRole()).toBe('');
      expect(mutationTester.getStatus()).toBe('uninitialized');
    });

    it('should initialize successfully with valid config', async () => {
      await mutationTester.initialize(mockConfig);
      
      expect(mutationTester.getId()).toBe('mutation-tester-1');
      expect(mutationTester.getRole()).toBe('mutation-tester');
      expect(mutationTester.getStatus()).toBe('initialized');
      expect(mutationTester.getCapabilities()).toEqual([
        'mutation-testing',
        'test-quality-audit',
        'coverage-analysis'
      ]);
    });
  });

  describe('prompt template', () => {
    it('should return a mutation testing prompt template', () => {
      const template = mutationTester.getPromptTemplate();
      
      expect(template).toContain('mutation testing');
      expect(template).toContain('test effectiveness');
      expect(template).toContain('survivors');
      expect(template).toContain('mutation score');
      expect(template).toContain('test quality');
    });

    it('should support template variable substitution', () => {
      const template = mutationTester.getPromptTemplate();
      const context = {
        targetClass: 'Calculator',
        mutationFramework: 'stryker',
        testFiles: 'Calculator.test.ts'
      };
      
      const formatted = mutationTester.formatPrompt(template, context);
      
      expect(formatted).toContain('Calculator');
      expect(formatted).toContain('stryker');
      expect(formatted).toContain('Calculator.test.ts');
    });
  });

  describe('task execution', () => {
    beforeEach(async () => {
      await mutationTester.initialize(mockConfig);
      await mutationTester.receiveTask(mockTask, mockContext);
    });

    it('should accept a mutation testing task', async () => {
      expect(mutationTester.getCurrentTask()).toEqual(mockTask);
      expect(mutationTester.getTaskContext()).toEqual(mockContext);
      expect(mutationTester.getStatus()).toBe('assigned');
    });

    it('should run mutation testing and generate report', async () => {
      const mockMutationResults = {
        mutationScore: 85.5,
        totalMutants: 50,
        killedMutants: 42,
        survivedMutants: 8,
        survivors: [
          {
            id: 'mutant-1',
            mutator: 'ArithmeticOperator',
            location: { line: 10, column: 15 },
            originalCode: 'a + b',
            mutatedCode: 'a - b',
            status: 'Survived'
          }
        ]
      };

      jest.spyOn(mutationTester, 'runMutationTesting').mockResolvedValue(mockMutationResults);
      jest.spyOn(mutationTester, 'writeFile').mockResolvedValue();

      const result = await mutationTester.run();

      expect(result.success).toBe(true);
      expect(result.result).toContain('mutation testing report');
      expect(mutationTester.getStatus()).toBe('completed');
    });

    it('should handle errors during mutation testing', async () => {
      jest.spyOn(mutationTester, 'runMutationTesting').mockRejectedValue(new Error('Stryker execution failed'));

      await expect(mutationTester.run()).rejects.toThrow('Stryker execution failed');
      expect(mutationTester.getStatus()).toBe('error');
    });
  });

  describe('mutation testing execution', () => {
    beforeEach(async () => {
      await mutationTester.initialize(mockConfig);
    });

    it('should run mutation testing with stryker', async () => {
      const mockExecuteCommand = jest.fn().mockResolvedValue({
        success: true,
        stdout: 'Mutation testing complete. Mutation score: 85.5%',
        stderr: '',
        exitCode: 0
      });

      jest.spyOn(mutationTester, 'executeCommand').mockImplementation(mockExecuteCommand);
      jest.spyOn(mutationTester, 'readFile').mockResolvedValue(`{
        "mutationScore": 85.5,
        "files": {
          "src/Calculator.ts": {
            "mutants": [
              {
                "id": "1",
                "mutatorName": "ArithmeticOperator",
                "location": {"start": {"line": 10, "column": 15}},
                "status": "Killed"
              }
            ]
          }
        }
      }`);

      const results = await mutationTester.runMutationTesting(['src/Calculator.ts'], ['tests/Calculator.test.ts']);

      expect(results.mutationScore).toBe(85.5);
      expect(mockExecuteCommand).toHaveBeenCalledWith('npx stryker run');
    });

    it('should handle different mutation frameworks', async () => {
      const newMockContext = { ...mockContext, mutationFramework: 'pitest' };
      await mutationTester.receiveTask(mockTask, mockContext);

      const framework = mutationTester.detectMutationFramework(newMockContext);
      expect(framework).toBe('pitest');
    });
  });

  describe('mutation analysis', () => {
    beforeEach(async () => {
      await mutationTester.initialize(mockConfig);
    });

    it('should analyze mutation survivors', async () => {
      const survivors = [
        {
          id: 'mutant-1',
          mutator: 'ArithmeticOperator',
          location: { line: 10, column: 15 },
          originalCode: 'a + b',
          mutatedCode: 'a - b',
          status: 'Survived'
        },
        {
          id: 'mutant-2',
          mutator: 'ConditionalExpression',
          location: { line: 15, column: 8 },
          originalCode: 'x > 0',
          mutatedCode: 'x >= 0',
          status: 'Survived'
        }
      ];

      const analysis = await mutationTester.analyzeSurvivors(survivors);

      expect(analysis.totalSurvivors).toBe(2);
      expect(analysis.survivorsByType).toEqual({
        'ArithmeticOperator': 1,
        'ConditionalExpression': 1
      });
      expect(analysis.recommendations).toContain('Add test cases for arithmetic operations');
      expect(analysis.recommendations).toContain('Improve boundary condition testing');
    });

    it('should identify test gaps from survivors', async () => {
      const survivors = [
        {
          id: 'mutant-1',
          mutator: 'ArithmeticOperator',
          location: { line: 10, column: 15 },
          originalCode: 'return a + b',
          mutatedCode: 'return a - b',
          status: 'Survived'
        }
      ];

      const testGaps = await mutationTester.identifyTestGaps(survivors);

      expect(testGaps).toContainEqual({
        type: 'arithmetic_operations',
        description: 'Missing tests for arithmetic operation variations',
        suggestedTests: ['Test with negative numbers', 'Test with zero values', 'Test with large numbers'],
        priority: 'high'
      });
    });
  });

  describe('mutation score calculation', () => {
    beforeEach(async () => {
      await mutationTester.initialize(mockConfig);
    });

    it('should calculate mutation score correctly', () => {
      const results = {
        totalMutants: 100,
        killedMutants: 85,
        survivedMutants: 15,
        timedOutMutants: 0,
        noCoverageMutants: 0
      };

      const score = mutationTester.calculateMutationScore(results);
      expect(score).toBe(85.0);
    });

    it('should handle edge cases in score calculation', () => {
      const results = {
        totalMutants: 0,
        killedMutants: 0,
        survivedMutants: 0,
        timedOutMutants: 0,
        noCoverageMutants: 0
      };

      const score = mutationTester.calculateMutationScore(results);
      expect(score).toBe(0);
    });
  });

  describe('report generation', () => {
    beforeEach(async () => {
      await mutationTester.initialize(mockConfig);
    });

    it('should generate comprehensive mutation testing report', async () => {
      const mutationResults = {
        mutationScore: 85.5,
        totalMutants: 50,
        killedMutants: 42,
        survivedMutants: 8,
        survivors: [
          {
            id: 'mutant-1',
            mutator: 'ArithmeticOperator',
            location: { line: 10, column: 15 },
            originalCode: 'a + b',
            mutatedCode: 'a - b',
            status: 'Survived'
          }
        ]
      };

      const report = await mutationTester.generateReport(mutationResults);

      expect(report).toContain('# Mutation Testing Report');
      expect(report).toContain('Mutation Score: 85.5%');
      expect(report).toContain('Total Mutants: 50');
      expect(report).toContain('Killed: 42');
      expect(report).toContain('Survived: 8');
      expect(report).toContain('## Survivors Analysis');
      expect(report).toContain('ArithmeticOperator');
    });

    it('should include recommendations in report', async () => {
      const mutationResults = {
        mutationScore: 65.0,
        totalMutants: 40,
        killedMutants: 26,
        survivedMutants: 14,
        survivors: []
      };

      const report = await mutationTester.generateReport(mutationResults);

      expect(report).toContain('## Recommendations');
      expect(report).toContain('improve test coverage');
    });
  });

  describe('test suite improvements', () => {
    beforeEach(async () => {
      await mutationTester.initialize(mockConfig);
    });

    it('should suggest test improvements based on survivors', async () => {
      const survivors = [
        {
          id: 'mutant-1',
          mutator: 'BooleanLiteral',
          location: { line: 5, column: 12 },
          originalCode: 'return true',
          mutatedCode: 'return false',
          status: 'Survived'
        }
      ];

      const improvements = await mutationTester.suggestTestImprovements(survivors);

      expect(improvements).toContainEqual({
        type: 'boolean_logic',
        description: 'Add tests for boolean return values',
        example: 'expect(result).toBe(true); expect(result).toBe(false);',
        priority: 'medium'
      });
    });

    it('should generate missing test cases', async () => {
      const mutationInfo = {
        mutator: 'ConditionalExpression',
        originalCode: 'x > 0',
        mutatedCode: 'x >= 0',
        location: { line: 10, column: 5 }
      };

      const testCases = await mutationTester.generateMissingTestCases(mutationInfo);

      expect(testCases).toContain('Test with x = 0 (boundary condition)');
      expect(testCases).toContain('Test with x = -1 (negative case)');
      expect(testCases).toContain('Test with x = 1 (positive case)');
    });
  });

  describe('framework detection', () => {
    beforeEach(async () => {
      await mutationTester.initialize(mockConfig);
    });

    it('should detect mutation testing framework from context', () => {
      const contextStryker = { mutationFramework: 'stryker' };
      expect(mutationTester.detectMutationFramework(contextStryker)).toBe('stryker');

      const contextPitest = { mutationFramework: 'pitest' };
      expect(mutationTester.detectMutationFramework(contextPitest)).toBe('pitest');

      const contextDefault = {};
      expect(mutationTester.detectMutationFramework(contextDefault)).toBe('stryker');
    });

    it('should get correct command for framework', () => {
      expect(mutationTester.getMutationCommand('stryker')).toBe('npx stryker run');
      expect(mutationTester.getMutationCommand('pitest')).toBe('mvn org.pitest:pitest-maven:mutationCoverage');
      expect(mutationTester.getMutationCommand('unknown')).toBe('npx stryker run');
    });
  });
});