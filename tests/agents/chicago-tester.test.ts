import { ChicagoTester } from '../../src/agents/chicago-tester';
import { AgentConfig, TaskContext, TaskData } from '../../src/agent';
import { ClaudeModel } from '../../src/claude-client';

describe('ChicagoTester', () => {
  let chicagoTester: ChicagoTester;
  let mockConfig: AgentConfig;
  let mockTask: TaskData;
  let mockContext: TaskContext;

  beforeEach(() => {
    mockConfig = {
      id: 'chicago-tester-1',
      role: 'chicago-tester',
      capabilities: ['state-based-testing', 'integration-testing', 'end-to-end-verification'],
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
      title: 'Create state-based tests for OrderProcessor',
      description: 'Write classicist-style tests focusing on final state verification',
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

    (mockTask as any).assignedTo = 'chicago-tester-1';
    (mockTask as any).dependencies = [];
    (mockTask as any).metadata = {
      testType: 'integration',
      testingStyle: 'classicist',
      targetClass: 'OrderProcessor'
    };

    mockContext = {
      projectInfo: {
        name: 'TestProject',
        language: 'typescript'
      },
      files: ['src/processors/OrderProcessor.ts'],
      testFramework: 'jest',
      database: 'in-memory'
    };

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

  describe('prompt template', () => {
    it('should return a Chicago school testing prompt template', () => {
      const template = chicagoTester.getPromptTemplate();
      
      expect(template).toContain('Chicago School');
      expect(template).toContain('classicist');
      expect(template).toContain('state');
      expect(template).toContain('final outcome');
      expect(template).toContain('real objects');
    });

    it('should support template variable substitution', () => {
      const template = chicagoTester.getPromptTemplate();
      const context = {
        className: 'OrderProcessor',
        dependencies: 'OrderRepository, PaymentService',
        testFramework: 'jest'
      };
      
      const formatted = chicagoTester.formatPrompt(template, context);
      
      expect(formatted).toContain('OrderProcessor');
      expect(formatted).toContain('OrderRepository, PaymentService');
      expect(formatted).toContain('jest');
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

    it('should generate classicist-style test code', async () => {
      const mockClaudeResponse = {
        content: `describe('OrderProcessor', () => {
  let orderProcessor: OrderProcessor;
  let orderRepository: OrderRepository;
  let paymentService: PaymentService;

  beforeEach(() => {
    orderRepository = new InMemoryOrderRepository();
    paymentService = new FakePaymentService();
    orderProcessor = new OrderProcessor(orderRepository, paymentService);
  });

  describe('processOrder', () => {
    it('should create order with correct final state', async () => {
      const orderData = {
        customerId: 'cust-123',
        items: [{ productId: 'prod-1', quantity: 2, price: 10.00 }],
        total: 20.00
      };
      
      const result = await orderProcessor.processOrder(orderData);
      
      expect(result.status).toBe('confirmed');
      expect(result.total).toBe(20.00);
      expect(result.paymentStatus).toBe('paid');
      
      const savedOrder = await orderRepository.findById(result.id);
      expect(savedOrder).toBeDefined();
      expect(savedOrder.status).toBe('confirmed');
    });

    it('should handle insufficient funds scenario', async () => {
      const orderData = {
        customerId: 'cust-123',
        items: [{ productId: 'prod-1', quantity: 1, price: 1000.00 }],
        total: 1000.00
      };
      
      paymentService.setBalance(10.00); // Insufficient funds
      
      const result = await orderProcessor.processOrder(orderData);
      
      expect(result.status).toBe('failed');
      expect(result.paymentStatus).toBe('declined');
      expect(result.errorMessage).toContain('insufficient funds');
    });
  });
});`,
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
      expect(result.result).toContain('classicist-style tests');
      expect(chicagoTester.getStatus()).toBe('completed');
    });

    it('should handle errors during test generation', async () => {
      jest.spyOn(chicagoTester, 'sendToClaude').mockRejectedValue(new Error('Claude API error'));

      await expect(chicagoTester.run()).rejects.toThrow('Claude API error');
      expect(chicagoTester.getStatus()).toBe('error');
    });
  });

  describe('state analysis', () => {
    beforeEach(async () => {
      await chicagoTester.initialize(mockConfig);
    });

    it('should analyze class state transitions', async () => {
      const sourceCode = `
        class OrderProcessor {
          private status: OrderStatus = 'pending';
          
          async processOrder(orderData: OrderData): Promise<Order> {
            this.status = 'processing';
            const order = await this.createOrder(orderData);
            this.status = 'completed';
            return order;
          }
        }
      `;

      const stateAnalysis = await chicagoTester.analyzeStateTransitions(sourceCode);
      
      expect(stateAnalysis.states).toContain('pending');
      expect(stateAnalysis.states).toContain('processing');
      expect(stateAnalysis.states).toContain('completed');
      expect(stateAnalysis.transitions).toHaveLength(2);
    });

    it('should identify testable outcomes', async () => {
      const methodSignature = 'async processPayment(amount: number): Promise<PaymentResult>';
      const sourceCode = 'class PaymentProcessor { /* implementation */ }';

      const outcomes = await chicagoTester.identifyTestableOutcomes(methodSignature, sourceCode);
      
      expect(outcomes).toContain('PaymentResult object structure');
      expect(outcomes).toContain('Payment status verification');
      expect(outcomes).toContain('Amount validation');
    });
  });

  describe('test quality validation', () => {
    beforeEach(async () => {
      await chicagoTester.initialize(mockConfig);
    });

    it('should validate classicist test principles', async () => {
      const testCode = `
        describe('UserService', () => {
          it('should create user', async () => {
            const mockRepo = { save: jest.fn() };
            const userService = new UserService(mockRepo);
            
            await userService.createUser({name: 'John'});
            
            expect(mockRepo.save).toHaveBeenCalled();
          });
        });
      `;

      const validation = await chicagoTester.validateTestQuality(testCode);
      
      expect(validation.isValid).toBe(false);
      expect(validation.violations).toContain('Uses mocks instead of real objects');
      expect(validation.violations).toContain('Tests interactions instead of final state');
      expect(validation.score).toBeLessThan(50);
    });

    it('should pass validation for proper classicist tests', async () => {
      const testCode = `
        describe('UserService', () => {
          let userRepository: InMemoryUserRepository;
          
          beforeEach(() => {
            userRepository = new InMemoryUserRepository();
          });
          
          it('should create user with correct properties', async () => {
            const userService = new UserService(userRepository);
            const userData = {name: 'John', email: 'john@test.com'};
            
            const result = await userService.createUser(userData);
            
            expect(result.id).toBeDefined();
            expect(result.name).toBe('John');
            expect(result.email).toBe('john@test.com');
            expect(result.createdAt).toBeInstanceOf(Date);
            
            const savedUser = await userRepository.findById(result.id);
            expect(savedUser).toEqual(result);
          });
        });
      `;

      const validation = await chicagoTester.validateTestQuality(testCode);
      
      expect(validation.isValid).toBe(true);
      expect(validation.violations).toHaveLength(0);
      expect(validation.score).toBeGreaterThan(80);
    });
  });

  describe('integration test generation', () => {
    beforeEach(async () => {
      await chicagoTester.initialize(mockConfig);
    });

    it('should generate integration tests with real dependencies', async () => {
      const classInfo = {
        name: 'OrderService',
        dependencies: ['OrderRepository', 'PaymentService', 'EmailService'],
        methods: ['createOrder', 'processPayment', 'sendConfirmation']
      };

      const integrationTests = await chicagoTester.generateIntegrationTests(classInfo);

      expect(integrationTests).toContain('new InMemoryOrderRepository()');
      expect(integrationTests).toContain('new FakePaymentService()');
      expect(integrationTests).toContain('new TestEmailService()');
      expect(integrationTests).toContain('expect(result.status).toBe');
      expect(integrationTests).toContain('expect(savedOrder).toEqual');
    });
  });

  describe('state verification', () => {
    beforeEach(async () => {
      await chicagoTester.initialize(mockConfig);
    });

    it('should generate state verification assertions', async () => {
      const returnType = 'Order';
      const expectedProperties = ['id', 'status', 'total', 'items', 'createdAt'];

      const assertions = await chicagoTester.generateStateVerificationAssertions(returnType, expectedProperties);

      expect(assertions).toContain('expect(result.id).toBeDefined()');
      expect(assertions).toContain('expect(result.status).toBe');
      expect(assertions).toContain('expect(result.total).toBeGreaterThan(0)');
      expect(assertions).toContain('expect(result.items).toHaveLength');
      expect(assertions).toContain('expect(result.createdAt).toBeInstanceOf(Date)');
    });
  });

  describe('end-to-end scenario testing', () => {
    beforeEach(async () => {
      await chicagoTester.initialize(mockConfig);
    });

    it('should generate end-to-end workflow tests', async () => {
      const workflow = {
        name: 'Order Processing Workflow',
        steps: [
          'Create order',
          'Validate inventory',
          'Process payment',
          'Update stock',
          'Send confirmation'
        ]
      };

      const e2eTests = await chicagoTester.generateEndToEndTests(workflow);

      expect(e2eTests).toContain('describe(\'Order Processing Workflow\')');
      expect(e2eTests).toContain('it(\'should complete full order workflow\')');
      expect(e2eTests).toContain('const order = await orderService.createOrder');
      expect(e2eTests).toContain('expect(finalOrder.status).toBe(\'completed\')');
    });
  });
});