import { ChicagoTester } from '../../src/agents/chicago-tester';
import { AgentConfig, TaskContext, TaskData } from '../../src/agent';
import { ClaudeModel } from '../../src/claude-client';
import { setupMocks, createMockAgentConfig, createMockTask, createMockContext, suppressConsoleWarnings } from '../test-utils';

describe('ChicagoTester', () => {
  let chicagoTester: ChicagoTester;
  let mockConfig: AgentConfig;
  let mockTask: TaskData;
  let mockContext: TaskContext;

  setupMocks();
  suppressConsoleWarnings();

  beforeEach(() => {
    mockConfig = createMockAgentConfig(
      'chicago-tester-1',
      'chicago-tester',
      ['state-based-testing', 'integration-testing', 'end-to-end-verification']
    );

    mockTask = createMockTask(
      'test-task-1',
      'Create state-based tests for OrderProcessor',
      'Write classicist-style tests focusing on final state verification'
    );
    (mockTask as any).metadata = {
      testType: 'integration',
      testingStyle: 'classicist',
      targetClass: 'OrderProcessor'
    };

    mockContext = createMockContext({
      files: ['src/processors/OrderProcessor.ts'],
      database: 'in-memory'
    });

    chicagoTester = new ChicagoTester();
  });

  describe('initialization', () => {
    it('should initialize with correct capabilities', () => {
      expect(chicagoTester.getCapabilities()).toEqual([]);
      expect(chicagoTester.getRole()).toBe('');
      expect(chicagoTester.getStatus()).toBe('uninitialized');
    });

    it('should initialize successfully with valid config', async () => {
      await chicagoTester.initialize(mockConfig);
      
      expect(chicagoTester.getId()).toBe('chicago-tester-1');
      expect(chicagoTester.getRole()).toBe('chicago-tester');
      expect(chicagoTester.getStatus()).toBe('initialized');
      expect(chicagoTester.getCapabilities()).toEqual([
        'state-based-testing',
        'integration-testing',
        'end-to-end-verification'
      ]);
    });
  });

  describe('task execution', () => {
    beforeEach(async () => {
      await chicagoTester.initialize(mockConfig);
      await chicagoTester.receiveTask(mockTask, mockContext);
    });

    it('should accept a testing task', async () => {
      expect(chicagoTester.getCurrentTask()).toEqual(mockTask);
      expect(chicagoTester.getTaskContext()).toEqual(mockContext);
      expect(chicagoTester.getStatus()).toBe('assigned');
    });

    it('should generate Chicago-style test code', async () => {
      const mockClaudeResponse = {
        content: `Generated Chicago-style tests for OrderProcessor`,
        tokenUsage: {
          inputTokens: 150,
          outputTokens: 1650,
          totalTokens: 1800
        },
        model: ClaudeModel.SONNET
      };

      jest.spyOn(chicagoTester, 'sendToClaude').mockResolvedValue(mockClaudeResponse);
      jest.spyOn(chicagoTester, 'writeFile').mockResolvedValue();

      const result = await chicagoTester.run();

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('mockObjects');
      expect(chicagoTester.getStatus()).toBe('completed');
    });

    it('should handle errors during test generation', async () => {
      jest.spyOn(chicagoTester, 'sendToClaude').mockRejectedValue(new Error('Claude API error'));

      await expect(chicagoTester.run()).rejects.toThrow('Claude API error');
      expect(chicagoTester.getStatus()).toBe('error');
    });
  });

  describe('dependency analysis', () => {
    beforeEach(async () => {
      await chicagoTester.initialize(mockConfig);
    });

    it('should identify dependencies from source code', async () => {
      const sourceCode = `
        import { UserRepository } from './repositories/UserRepository';
        import { EmailService } from './services/EmailService';
        
        class UserService {
          constructor(
            private userRepository: UserRepository,
            private emailService: EmailService
          ) {}
        }
      `;

      const dependencies = await chicagoTester.identifyDependencies(sourceCode);
      
      expect(dependencies).toContain('UserRepository');
      expect(dependencies).toContain('EmailService');
    });

    it('should generate mock objects for dependencies', async () => {
      const dependencies = ['UserRepository', 'EmailService'];
      const sourceCode = `
        class UserService {
          constructor(
            private userRepository: UserRepository,
            private emailService: EmailService
          ) {}
          
          async createUser(userData: any) {
            this.userRepository.save(userData);
            this.emailService.sendWelcomeEmail(userData.email);
          }
        }
      `;

      const mockObjects = await chicagoTester.generateMockObjects(dependencies, sourceCode);
      
      expect(mockObjects).toHaveLength(2);
      expect(mockObjects[0].name).toBe('UserRepositoryMock');
      expect(mockObjects[1].name).toBe('EmailServiceMock');
    });
  });

  describe('test generation methods', () => {
    beforeEach(async () => {
      await chicagoTester.initialize(mockConfig);
    });

    it('should extract methods from dependency usage', () => {
      const sourceCode = `
        this.userRepository.save(userData);
        this.userRepository.findById(id);
        this.emailService.sendWelcomeEmail(email);
      `;

      const methods = (chicagoTester as any).extractMethodsForDependency('userRepository', sourceCode);
      
      expect(methods).toHaveLength(2);
      expect(methods[0].name).toBe('save');
      expect(methods[1].name).toBe('findById');
    });

    it('should extract properties from dependency usage', () => {
      const sourceCode = `
        if (this.userRepository.isConnected) {
          return this.userRepository.config.timeout;
        }
      `;

      const properties = (chicagoTester as any).extractPropertiesForDependency('userRepository', sourceCode);
      
      expect(properties).toHaveLength(2);
      expect(properties.some((p: any) => p.name === 'isConnected')).toBe(true);
      expect(properties.some((p: any) => p.name === 'config')).toBe(true);
    });
  });

  describe('test suite generation', () => {
    beforeEach(async () => {
      await chicagoTester.initialize(mockConfig);
    });

    it('should generate complete test suites', async () => {
      const testSuite = {
        suiteName: 'UserService Tests',
        testCases: [
          {
            name: 'should create user successfully',
            description: 'Test user creation with valid data',
            setup: 'Mock setup',
            execution: 'Execute method',
            verification: 'Verify results',
            mockingStrategy: 'strict' as const,
            dependencies: ['UserRepository']
          }
        ],
        mockObjects: [],
        testDoubles: [],
        interactions: [],
        coverage: {
          behavioral: 90,
          interaction: 85,
          state: 95
        }
      };

      const testCode = (chicagoTester as any).generateTestCode(testSuite);
      
      expect(testCode).toContain('describe(');
      expect(testCode).toContain('UserService Tests');
      expect(testCode).toContain('it(');
      expect(testCode).toContain('should create user successfully');
      expect(testCode).toContain('// Mock setup');
    });

    it('should generate proper file paths for test files', () => {
      const filePath = (chicagoTester as any).generateTestFilePath('UserService');
      
      expect(filePath).toContain('userservice.chicago.test.ts');
    });
  });
});