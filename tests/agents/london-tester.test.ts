import { LondonTester } from '../../src/agents/london-tester';
import { AgentConfig, TaskContext, TaskData } from '../../src/agent';
import { ClaudeModel } from '../../src/claude-client';

describe('LondonTester', () => {
  let londonTester: LondonTester;
  let mockConfig: AgentConfig;
  let mockTask: TaskData;
  let mockContext: TaskContext;

  beforeEach(() => {
    mockConfig = {
      id: 'london-tester-1',
      role: 'london-tester',
      capabilities: ['mock-based-testing', 'behavior-verification', 'interaction-testing'],
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
      title: 'Create unit tests for UserService',
      description: 'Write mockist-style tests focusing on behavior verification',
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

    (mockTask as any).assignedTo = 'london-tester-1';
    (mockTask as any).dependencies = [];
    (mockTask as any).metadata = {
      testType: 'unit',
      testingStyle: 'mockist',
      targetClass: 'UserService'
    };

    mockContext = {
      projectInfo: {
        name: 'TestProject',
        language: 'typescript'
      },
      files: ['src/services/UserService.ts'],
      testFramework: 'jest'
    };

    londonTester = new LondonTester();
  });

  describe('initialization', () => {
    it('should initialize with correct capabilities', () => {
      expect(londonTester.getCapabilities()).toEqual([]);
      expect(londonTester.getRole()).toBe('');
      expect(londonTester.getStatus()).toBe('uninitialized');
    });

    it('should initialize successfully with valid config', async () => {
      await londonTester.initialize(mockConfig);
      
      expect(londonTester.getId()).toBe('london-tester-1');
      expect(londonTester.getRole()).toBe('london-tester');
      expect(londonTester.getStatus()).toBe('initialized');
      expect(londonTester.getCapabilities()).toEqual([
        'mock-based-testing',
        'behavior-verification', 
        'interaction-testing'
      ]);
    });
  });

  describe('prompt template', () => {
    it('should return a London school testing prompt template', () => {
      const template = londonTester.getPromptTemplate();
      
      expect(template).toContain('London School');
      expect(template).toContain('mockist');
      expect(template).toContain('behavior');
      expect(template).toContain('interaction');
      expect(template).toContain('isolation');
    });

    it('should support template variable substitution', () => {
      const template = londonTester.getPromptTemplate();
      const context = {
        className: 'UserService',
        dependencies: 'UserRepository, EmailService',
        testFramework: 'jest'
      };
      
      const formatted = londonTester.formatPrompt(template, context);
      
      expect(formatted).toContain('UserService');
      expect(formatted).toContain('UserRepository, EmailService');
      expect(formatted).toContain('jest');
    });
  });

  describe('task execution', () => {
    beforeEach(async () => {
      await londonTester.initialize(mockConfig);
      await londonTester.receiveTask(mockTask, mockContext);
    });

    it('should accept a testing task', async () => {
      expect(londonTester.getCurrentTask()).toEqual(mockTask);
      expect(londonTester.getTaskContext()).toEqual(mockContext);
      expect(londonTester.getStatus()).toBe('assigned');
    });

    it('should generate mockist-style test code', async () => {
      // Mock the Claude client response
      const mockClaudeResponse = {
        content: `describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockEmailService: jest.Mocked<EmailService>;

  beforeEach(() => {
    mockUserRepository = {
      findById: jest.fn(),
      save: jest.fn()
    } as jest.Mocked<UserRepository>;
    
    mockEmailService = {
      sendWelcomeEmail: jest.fn()
    } as jest.Mocked<EmailService>;
    
    userService = new UserService(mockUserRepository, mockEmailService);
  });

  describe('createUser', () => {
    it('should save user and send welcome email', async () => {
      const userData = { name: 'John', email: 'john@test.com' };
      const savedUser = { id: 1, ...userData };
      
      mockUserRepository.save.mockResolvedValue(savedUser);
      
      const result = await userService.createUser(userData);
      
      expect(mockUserRepository.save).toHaveBeenCalledWith(userData);
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(savedUser);
      expect(result).toEqual(savedUser);
    });
  });
});`,
        tokenUsage: {
          inputTokens: 100,
          outputTokens: 1400,
          totalTokens: 1500
        },
        model: ClaudeModel.SONNET
      };

      jest.spyOn(londonTester, 'sendToClaude').mockResolvedValue(mockClaudeResponse);
      jest.spyOn(londonTester, 'writeFile').mockResolvedValue();

      const result = await londonTester.run();

      expect(result.success).toBe(true);
      expect(result.result).toContain('mockist-style tests');
      expect(londonTester.getStatus()).toBe('completed');
    });

    it('should handle errors during test generation', async () => {
      jest.spyOn(londonTester, 'sendToClaude').mockRejectedValue(new Error('Claude API error'));

      await expect(londonTester.run()).rejects.toThrow('Claude API error');
      expect(londonTester.getStatus()).toBe('error');
    });
  });

  describe('mock strategy generation', () => {
    beforeEach(async () => {
      await londonTester.initialize(mockConfig);
    });

    it('should analyze dependencies and suggest mocking strategies', async () => {
      const sourceCode = `
        class UserService {
          constructor(
            private userRepository: UserRepository,
            private emailService: EmailService,
            private logger: Logger
          ) {}
        }
      `;

      const strategies = await londonTester.analyzeDependenciesForMocking(sourceCode);
      
      expect(strategies).toHaveLength(3);
      expect(strategies[0]).toMatchObject({
        dependency: 'UserRepository',
        mockType: 'full-mock',
        reason: expect.stringContaining('data access')
      });
      expect(strategies[1]).toMatchObject({
        dependency: 'EmailService',
        mockType: 'full-mock',
        reason: expect.stringContaining('external service')
      });
      expect(strategies[2]).toMatchObject({
        dependency: 'Logger',
        mockType: 'spy',
        reason: expect.stringContaining('side effect')
      });
    });
  });

  describe('test quality validation', () => {
    beforeEach(async () => {
      await londonTester.initialize(mockConfig);
    });

    it('should validate mockist test principles', async () => {
      const testCode = `
        describe('UserService', () => {
          it('should create user', async () => {
            const userService = new UserService(new UserRepository(), new EmailService());
            const result = await userService.createUser({name: 'John'});
            expect(result.id).toBeDefined();
          });
        });
      `;

      const validation = await londonTester.validateTestQuality(testCode);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violations).toContain('Uses real dependencies instead of mocks');
      expect(validation.violations).toContain('Tests state instead of behavior');
      expect(validation.score).toBeLessThan(50);
    });

    it('should pass validation for proper mockist tests', async () => {
      const testCode = `
        describe('UserService', () => {
          let mockRepo: jest.Mocked<UserRepository>;
          
          beforeEach(() => {
            mockRepo = { save: jest.fn() } as jest.Mocked<UserRepository>;
          });
          
          it('should call repository save with user data', async () => {
            const userService = new UserService(mockRepo);
            const userData = {name: 'John'};
            
            await userService.createUser(userData);
            
            expect(mockRepo.save).toHaveBeenCalledWith(userData);
          });
        });
      `;

      const validation = await londonTester.validateTestQuality(testCode);
      
      expect(validation.isValid).toBe(true);
      expect(validation.violations).toHaveLength(0);
      expect(validation.score).toBeGreaterThan(80);
    });
  });

  describe('interaction testing', () => {
    beforeEach(async () => {
      await londonTester.initialize(mockConfig);
    });

    it('should generate tests for method call sequences', async () => {
      const methodSignature = 'async processOrder(orderId: string): Promise<Order>';
      const dependencies = ['OrderRepository', 'PaymentService', 'InventoryService'];

      const interactionTests = await londonTester.generateInteractionTests(methodSignature, dependencies);

      expect(interactionTests).toContain('expect(mockOrderRepository.findById).toHaveBeenCalledWith(orderId)');
      expect(interactionTests).toContain('expect(mockPaymentService.processPayment).toHaveBeenCalledAfter');
      expect(interactionTests).toContain('expect(mockInventoryService.updateStock).toHaveBeenCalled');
    });
  });

  describe('error scenarios', () => {
    beforeEach(async () => {
      await londonTester.initialize(mockConfig);
    });

    it('should generate error handling tests with mocks', async () => {
      const methodInfo = {
        name: 'createUser',
        parameters: ['userData: UserData'],
        throws: ['ValidationError', 'DatabaseError']
      };

      const errorTests = await londonTester.generateErrorHandlingTests(methodInfo);

      expect(errorTests).toContain('mockUserRepository.save.mockRejectedValue(new DatabaseError())');
      expect(errorTests).toContain('expect(() => userService.createUser(invalidData)).toThrow(ValidationError)');
    });
  });
});