import { PropertyTester } from '../../src/agents/property-tester';
import { AgentConfig, TaskContext, TaskData } from '../../src/agent';
import { ClaudeModel } from '../../src/claude-client';
import { setupMocks, suppressConsoleWarnings } from '../test-utils';

describe('PropertyTester', () => {
  let propertyTester: PropertyTester;
  let mockConfig: AgentConfig;
  let mockTask: TaskData;
  let mockContext: TaskContext;

  setupMocks();
  suppressConsoleWarnings();

  beforeEach(() => {
    mockConfig = {
      id: 'property-tester-1',
      role: 'property-tester',
      capabilities: ['property-based-testing', 'invariant-validation', 'edge-case-generation'],
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
      title: 'Create property-based tests for MathUtils',
      description: 'Write property tests with diverse input generation',
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

    (mockTask as any).assignedTo = 'property-tester-1';
    (mockTask as any).dependencies = [];
    (mockTask as any).metadata = {
      testType: 'property',
      testingStyle: 'property-based',
      targetClass: 'MathUtils'
    };

    mockContext = {
      projectInfo: {
        name: 'TestProject',
        language: 'typescript'
      },
      files: ['src/utils/MathUtils.ts'],
      testFramework: 'jest',
      propertyLibrary: 'fast-check'
    };

    propertyTester = new PropertyTester();
  });

  describe('initialization', () => {
    it('should initialize with correct capabilities', () => {
      expect(propertyTester.getCapabilities()).toEqual([]);
      expect(propertyTester.getRole()).toBe('');
      expect(propertyTester.getStatus()).toBe('uninitialized');
    });

    it('should initialize successfully with valid config', async () => {
      await propertyTester.initialize(mockConfig);
      
      expect(propertyTester.getId()).toBe('property-tester-1');
      expect(propertyTester.getRole()).toBe('property-tester');
      expect(propertyTester.getStatus()).toBe('initialized');
      expect(propertyTester.getCapabilities()).toEqual([
        'property-based-testing',
        'invariant-validation',
        'edge-case-generation'
      ]);
    });
  });

  describe('prompt template', () => {
    it('should return a property-based testing prompt template', () => {
      const template = propertyTester.getPromptTemplate();
      
      expect(template).toContain('property-based');
      expect(template).toContain('invariant');
      expect(template).toContain('generators');
      expect(template).toContain('edge cases');
      expect(template).toContain('fast-check');
    });

    it('should support template variable substitution', () => {
      const template = propertyTester.getPromptTemplate();
      const context = {
        className: 'MathUtils',
        methods: 'add, subtract, multiply',
        propertyLibrary: 'fast-check'
      };
      
      const formatted = propertyTester.formatPrompt(template, context);
      
      expect(formatted).toContain('MathUtils');
      expect(formatted).toContain('add, subtract, multiply');
      expect(formatted).toContain('fast-check');
    });
  });

  describe('task execution', () => {
    beforeEach(async () => {
      await propertyTester.initialize(mockConfig);
      await propertyTester.receiveTask(mockTask, mockContext);
    });

    it('should accept a property testing task', async () => {
      expect(propertyTester.getCurrentTask()).toEqual(mockTask);
      expect(propertyTester.getTaskContext()).toEqual(mockContext);
      expect(propertyTester.getStatus()).toBe('assigned');
    });

    it('should generate property-based test code', async () => {
      const mockClaudeResponse = {
        content: `import fc from 'fast-check';
import { MathUtils } from '../src/utils/MathUtils';

describe('MathUtils property tests', () => {
  describe('add method', () => {
    it('should be commutative', () => {
      fc.assert(fc.property(
        fc.integer(),
        fc.integer(),
        (a, b) => {
          const result1 = MathUtils.add(a, b);
          const result2 = MathUtils.add(b, a);
          return result1 === result2;
        }
      ));
    });

    it('should be associative', () => {
      fc.assert(fc.property(
        fc.integer(),
        fc.integer(),
        fc.integer(),
        (a, b, c) => {
          const result1 = MathUtils.add(MathUtils.add(a, b), c);
          const result2 = MathUtils.add(a, MathUtils.add(b, c));
          return result1 === result2;
        }
      ));
    });

    it('should have identity element', () => {
      fc.assert(fc.property(
        fc.integer(),
        (n) => {
          return MathUtils.add(n, 0) === n && MathUtils.add(0, n) === n;
        }
      ));
    });
  });

  describe('multiply method', () => {
    it('should satisfy distributive property', () => {
      fc.assert(fc.property(
        fc.integer(),
        fc.integer(),
        fc.integer(),
        (a, b, c) => {
          const result1 = MathUtils.multiply(a, MathUtils.add(b, c));
          const result2 = MathUtils.add(MathUtils.multiply(a, b), MathUtils.multiply(a, c));
          return result1 === result2;
        }
      ));
    });
  });
});`,
        tokenUsage: {
          inputTokens: 200,
          outputTokens: 1800,
          totalTokens: 2000
        },
        model: ClaudeModel.SONNET
      };

      jest.spyOn(propertyTester, 'sendToClaude').mockResolvedValue(mockClaudeResponse);
      jest.spyOn(propertyTester, 'writeFile').mockResolvedValue();

      const result = await propertyTester.run();

      expect(result.success).toBe(true);
      expect(result.result).toContain('property-based tests');
      expect(propertyTester.getStatus()).toBe('completed');
    });

    it('should handle errors during test generation', async () => {
      jest.spyOn(propertyTester, 'sendToClaude').mockRejectedValue(new Error('Claude API error'));

      await expect(propertyTester.run()).rejects.toThrow('Claude API error');
      expect(propertyTester.getStatus()).toBe('error');
    });
  });

  describe('invariant analysis', () => {
    beforeEach(async () => {
      await propertyTester.initialize(mockConfig);
    });

    it('should identify mathematical invariants', async () => {
      const sourceCode = `
        class MathUtils {
          static add(a: number, b: number): number {
            return a + b;
          }
          
          static multiply(a: number, b: number): number {
            return a * b;
          }
        }
      `;

      const invariants = await propertyTester.identifyInvariants(sourceCode);
      
      expect(invariants).toContainEqual({
        name: 'commutativity',
        description: 'add(a, b) === add(b, a)',
        applicableMethods: ['add'],
        generators: ['fc.integer()', 'fc.integer()']
      });

      expect(invariants).toContainEqual({
        name: 'associativity',
        description: 'add(add(a, b), c) === add(a, add(b, c))',
        applicableMethods: ['add'],
        generators: ['fc.integer()', 'fc.integer()', 'fc.integer()']
      });
    });

    it('should identify domain-specific invariants', async () => {
      const sourceCode = `
        class StringUtils {
          static concat(a: string, b: string): string {
            return a + b;
          }
          
          static reverse(s: string): string {
            return s.split('').reverse().join('');
          }
        }
      `;

      const invariants = await propertyTester.identifyInvariants(sourceCode);
      
      expect(invariants).toContainEqual({
        name: 'reverse_involution',
        description: 'reverse(reverse(s)) === s',
        applicableMethods: ['reverse'],
        generators: ['fc.string()']
      });

      expect(invariants).toContainEqual({
        name: 'concat_length',
        description: 'concat(a, b).length === a.length + b.length',
        applicableMethods: ['concat'],
        generators: ['fc.string()', 'fc.string()']
      });
    });
  });

  describe('generator selection', () => {
    beforeEach(async () => {
      await propertyTester.initialize(mockConfig);
    });

    it('should select appropriate generators for parameter types', async () => {
      const methodSignature = 'calculateTax(income: number, rate: number): number';
      
      const generators = await propertyTester.selectGenerators(methodSignature);
      
      expect(generators).toEqual([
        'fc.float({ min: 0, max: 1000000 })', // income
        'fc.float({ min: 0, max: 1 })'        // rate
      ]);
    });

    it('should handle complex parameter types', async () => {
      const methodSignature = 'processUser(user: User, options: ProcessOptions): UserResult';
      
      const generators = await propertyTester.selectGenerators(methodSignature);
      
      expect(generators).toContain('fc.record');
      expect(generators.length).toBe(2);
    });

    it('should generate edge case generators', async () => {
      const methodSignature = 'divide(dividend: number, divisor: number): number';
      
      const edgeCaseGenerators = await propertyTester.generateEdgeCaseGenerators(methodSignature);
      
      expect(edgeCaseGenerators).toContain('fc.constantFrom(0, -0)'); // divisor edge cases
      expect(edgeCaseGenerators).toContain('fc.constantFrom(Infinity, -Infinity, NaN)');
    });
  });

  describe('property generation', () => {
    beforeEach(async () => {
      await propertyTester.initialize(mockConfig);
    });

    it('should generate round-trip properties', async () => {
      const methods = ['encode', 'decode'];
      
      const properties = await propertyTester.generateRoundTripProperties(methods);
      
      expect(properties).toContain('decode(encode(data)) === data');
    });

    it('should generate metamorphic properties', async () => {
      const methodInfo = {
        name: 'sort',
        parameters: ['array: number[]'],
        returnType: 'number[]'
      };
      
      const properties = await propertyTester.generateMetamorphicProperties(methodInfo);
      
      expect(properties).toContain('sort(array).length === array.length');
      expect(properties).toContain('sort(sort(array)) deep equals sort(array)');
    });

    it('should generate contract properties', async () => {
      const methodInfo = {
        name: 'withdraw',
        parameters: ['amount: number'],
        returnType: 'boolean',
        preconditions: ['amount > 0', 'balance >= amount'],
        postconditions: ['balance reduced by amount']
      };
      
      const properties = await propertyTester.generateContractProperties(methodInfo);
      
      expect(properties).toContain('amount > 0 && balance >= amount');
      expect(properties).toContain('newBalance === oldBalance - amount');
    });
  });

  describe('shrinking strategy', () => {
    beforeEach(async () => {
      await propertyTester.initialize(mockConfig);
    });

    it('should define shrinking strategies for complex types', async () => {
      const dataType = 'User';
      const structure = {
        id: 'number',
        name: 'string',
        age: 'number',
        addresses: 'Address[]'
      };
      
      const shrinkingStrategy = await propertyTester.defineShrinkingStrategy(dataType, structure);
      
      expect(shrinkingStrategy).toContain('fc.record({');
      expect(shrinkingStrategy).toContain('id: fc.integer()');
      expect(shrinkingStrategy).toContain('name: fc.string()');
      expect(shrinkingStrategy).toContain('age: fc.nat()');
    });
  });

  describe('test quality validation', () => {
    beforeEach(async () => {
      await propertyTester.initialize(mockConfig);
    });

    it('should validate property test quality', async () => {
      const testCode = `
        it('should test something', () => {
          expect(add(1, 2)).toBe(3);
          expect(add(2, 3)).toBe(5);
        });
      `;

      const validation = await propertyTester.validateTestQuality(testCode);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violations).toContain('Uses example-based testing instead of property-based');
      expect(validation.score).toBeLessThan(50);
    });

    it('should pass validation for proper property tests', async () => {
      const testCode = `
        it('should be commutative', () => {
          fc.assert(fc.property(
            fc.integer(),
            fc.integer(),
            (a, b) => add(a, b) === add(b, a)
          ));
        });
      `;

      const validation = await propertyTester.validateTestQuality(testCode);
      
      expect(validation.isValid).toBe(true);
      expect(validation.violations).toHaveLength(0);
      expect(validation.score).toBeGreaterThan(80);
    });
  });

  describe('coverage analysis', () => {
    beforeEach(async () => {
      await propertyTester.initialize(mockConfig);
    });

    it('should analyze input space coverage', async () => {
      const generators = ['fc.integer()', 'fc.string()', 'fc.boolean()'];
      const testRuns = 1000;
      
      const coverage = await propertyTester.analyzeCoverage(generators, testRuns);
      
      expect(coverage.inputSpaceCoverage).toBeGreaterThan(0);
      expect(coverage.edgeCasesCovered).toBeGreaterThan(0);
      expect(coverage.recommendations).toBeDefined();
    });
  });
});