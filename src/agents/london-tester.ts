import { Agent } from '../agent';

export interface MockStrategy {
  dependency: string;
  mockType: 'full-mock' | 'spy' | 'stub';
  reason: string;
  methods: string[];
}

export interface TestQualityValidation {
  isValid: boolean;
  score: number;
  violations: string[];
  suggestions: string[];
}

export interface InteractionPattern {
  sequence: string[];
  conditions: string[];
  assertions: string[];
}

export interface ErrorTestScenario {
  name: string;
  setup: string;
  expectation: string;
  mockConfiguration: string;
}

/**
 * London Tester - Mockist Style Testing Agent
 * 
 * Implements the London School of TDD approach, focusing on:
 * - Behavior verification over state verification
 * - Extensive use of mocks, stubs, and spies
 * - Testing units in complete isolation
 * - Interaction-based testing patterns
 */
export class LondonTester extends Agent {
  
  getPromptTemplate(): string {
    return `You are a London School (Mockist) Testing Agent specializing in behavior-driven unit testing.

CORE PRINCIPLES:
- Test behavior, not state
- Mock ALL dependencies 
- Verify interactions between objects
- Test units in complete isolation
- Focus on how objects collaborate

TESTING APPROACH:
1. Identify all dependencies of the unit under test
2. Create mocks/stubs for every dependency
3. Verify method calls, parameters, and call sequences
4. Test error conditions through mock failures
5. Ensure no real objects are used in tests

TASK CONTEXT:
- Target Class: {{className}}
- Dependencies: {{dependencies}}
- Test Framework: {{testFramework}}
- Source Files: {{sourceFiles}}

DELIVERABLES:
1. Comprehensive mock-based test suite
2. Dependency analysis and mocking strategy
3. Interaction sequence verification
4. Error scenario testing with mocks
5. Test quality validation report

Generate mockist-style tests that verify behavior through interaction testing.
Focus on call verification, parameter validation, and collaboration patterns.
Ensure complete isolation by mocking all external dependencies.`;
  }

  async executeTask(): Promise<any> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    const metadata = (this.currentTask as any).metadata || {};
    const { files, testFramework = 'jest' } = this.taskContext;
    
    // Read source files to analyze
    const sourceFiles = await this.readSourceFiles(files || []);
    
    // Generate comprehensive mockist tests
    const testSuite = await this.generateMockistTestSuite(
      metadata?.targetClass || 'UnknownClass',
      sourceFiles,
      testFramework
    );
    
    // Write test files
    const testFilePath = this.generateTestFilePath(metadata?.targetClass || 'UnknownClass');
    await this.writeFile(testFilePath, testSuite.code);
    
    return {
      testSuite: testSuite.code,
      mockingStrategy: testSuite.mockingStrategy,
      interactionPatterns: testSuite.interactionPatterns,
      qualityScore: testSuite.qualityScore,
      message: 'Generated mockist-style tests focusing on behavior verification and interaction testing'
    };
  }

  /**
   * Analyze dependencies and generate mocking strategies
   */
  async analyzeDependenciesForMocking(sourceCode: string): Promise<MockStrategy[]> {
    const dependencies = this.extractDependencies(sourceCode);
    const strategies: MockStrategy[] = [];

    for (const dep of dependencies) {
      const strategy = this.determineMockingStrategy(dep);
      strategies.push(strategy);
    }

    return strategies;
  }

  /**
   * Validate test quality according to London School principles
   */
  async validateTestQuality(testCode: string): Promise<TestQualityValidation> {
    const violations: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check for mock usage
    if (!testCode.includes('jest.fn()') && !testCode.includes('mock')) {
      violations.push('Uses real dependencies instead of mocks');
      score -= 30;
    }

    // Check for state assertions vs behavior assertions
    if (testCode.includes('expect(result.') && !testCode.includes('toHaveBeenCalled')) {
      violations.push('Tests state instead of behavior');
      score -= 25;
    }

    // Check for interaction verification
    if (!testCode.includes('toHaveBeenCalledWith') && !testCode.includes('toHaveBeenCalled')) {
      violations.push('Missing interaction verification');
      score -= 20;
    }

    // Check for proper setup/teardown
    if (!testCode.includes('beforeEach')) {
      violations.push('Missing proper test setup');
      score -= 15;
    }

    // Check for isolation
    if (testCode.includes('new ') && !testCode.includes('mock')) {
      violations.push('Creating real objects instead of using mocks');
      score -= 20;
    }

    if (violations.length === 0) {
      suggestions.push('Excellent mockist test implementation');
    } else {
      suggestions.push('Consider using more mocks for better isolation');
      suggestions.push('Focus on verifying interactions rather than state');
      suggestions.push('Ensure all dependencies are mocked');
    }

    return {
      isValid: violations.length === 0,
      score: Math.max(0, score),
      violations,
      suggestions
    };
  }

  /**
   * Generate interaction tests for method sequences
   */
  async generateInteractionTests(methodSignature: string, dependencies: string[]): Promise<string> {
    const methodName = methodSignature.split('(')[0].replace('async ', '');
    const testCode = dependencies.map(dep => {
      const mockName = `mock${dep}`;
      return `expect(${mockName}.${this.inferPrimaryMethod(dep)}).toHaveBeenCalledWith(${methodName === 'processOrder' ? 'orderId' : 'expectedParam'});`;
    }).join('\n    ');

    return `
  describe('${methodName} interactions', () => {
    it('should call dependencies in correct sequence', async () => {
      // Arrange
      ${dependencies.map(dep => `const mock${dep} = jest.mocked(${dep.toLowerCase()});`).join('\n      ')}
      
      // Act
      await service.${methodName}(testData);
      
      // Assert
      ${testCode}
    });
  });`;
  }

  /**
   * Generate error handling tests with mocks
   */
  async generateErrorHandlingTests(methodInfo: any): Promise<string> {
    const { name, parameters, throws } = methodInfo;
    
    const errorTests = throws?.map((errorType: string) => `
    it('should handle ${errorType} from dependencies', async () => {
      // Arrange
      mockDependency.someMethod.mockRejectedValue(new ${errorType}('Test error'));
      
      // Act & Assert
      await expect(service.${name}(${parameters?.[0]?.split(':')[0] || 'testData'}))
        .rejects.toThrow(${errorType});
    });`).join('\n');

    return `
  describe('${name} error handling', () => {${errorTests}
  });`;
  }

  private async readSourceFiles(files: string[]): Promise<string[]> {
    const sourceFiles: string[] = [];
    
    for (const file of files) {
      try {
        const content = await this.readFile(file);
        sourceFiles.push(content);
      } catch (error) {
        console.warn(`Could not read file ${file}: ${(error as Error).message}`);
      }
    }
    
    return sourceFiles;
  }

  private async generateMockistTestSuite(
    className: string, 
    sourceFiles: string[], 
    testFramework: string
  ): Promise<any> {
    const sourceCode = sourceFiles.join('\n');
    const mockingStrategy = await this.analyzeDependenciesForMocking(sourceCode);
    
    const promptContext = {
      className,
      dependencies: mockingStrategy.map(s => s.dependency).join(', '),
      testFramework,
      sourceFiles: sourceFiles.length.toString(),
      mockingStrategy: JSON.stringify(mockingStrategy, null, 2)
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

SOURCE CODE TO TEST:
${sourceCode}

MOCKING STRATEGY:
${JSON.stringify(mockingStrategy, null, 2)}

Generate a comprehensive mockist test suite that:
1. Mocks all dependencies identified in the strategy
2. Tests behavior through interaction verification
3. Includes error scenarios with mock failures
4. Validates call sequences and parameters
5. Ensures complete unit isolation

Focus on interaction testing patterns and behavior verification.`;

    const response = await this.sendToClaude(prompt);
    
    const interactionPatterns = this.extractInteractionPatterns(response.content);
    const qualityScore = await this.calculateTestQuality(response.content);

    return {
      code: response.content,
      mockingStrategy,
      interactionPatterns,
      qualityScore
    };
  }

  private extractDependencies(sourceCode: string): string[] {
    const dependencies: string[] = [];
    
    // Extract constructor parameters
    const constructorMatch = sourceCode.match(/constructor\s*\([^)]*\)/);
    if (constructorMatch) {
      const params = constructorMatch[0].match(/:\s*([A-Z][a-zA-Z0-9]*)/g);
      if (params) {
        dependencies.push(...params.map(p => p.replace(/:\s*/, '')));
      }
    }
    
    // Extract imports
    const importMatches = sourceCode.match(/import\s+.*\s+from\s+['"].*['"]/g);
    if (importMatches) {
      importMatches.forEach(imp => {
        const match = imp.match(/import\s+{([^}]+)}/);
        if (match) {
          const imports = match[1].split(',').map(i => i.trim());
          dependencies.push(...imports.filter(i => /^[A-Z]/.test(i)));
        }
      });
    }
    
    return [...new Set(dependencies)];
  }

  private determineMockingStrategy(dependency: string): MockStrategy {
    const depLower = dependency.toLowerCase();
    
    if (depLower.includes('repository') || depLower.includes('dao')) {
      return {
        dependency,
        mockType: 'full-mock',
        reason: 'Data access layer should be mocked for isolation',
        methods: ['findById', 'save', 'update', 'delete']
      };
    }
    
    if (depLower.includes('service') || depLower.includes('client')) {
      return {
        dependency,
        mockType: 'full-mock',
        reason: 'External service dependencies should be mocked',
        methods: ['process', 'send', 'get', 'post']
      };
    }
    
    if (depLower.includes('logger') || depLower.includes('audit')) {
      return {
        dependency,
        mockType: 'spy',
        reason: 'Side effect dependencies should be spied on',
        methods: ['log', 'info', 'warn', 'error']
      };
    }
    
    return {
      dependency,
      mockType: 'full-mock',
      reason: 'Default to full mock for complete isolation',
      methods: ['execute', 'process', 'handle']
    };
  }

  private inferPrimaryMethod(dependency: string): string {
    const depLower = dependency.toLowerCase();
    
    if (depLower.includes('repository')) return 'findById';
    if (depLower.includes('service')) return 'process';
    if (depLower.includes('client')) return 'send';
    if (depLower.includes('logger')) return 'log';
    
    return 'execute';
  }

  private extractInteractionPatterns(testCode: string): InteractionPattern[] {
    const patterns: InteractionPattern[] = [];
    
    const callMatches = testCode.match(/expect\([^)]+\)\.toHaveBeenCalled/g);
    if (callMatches) {
      patterns.push({
        sequence: callMatches,
        conditions: ['Mock setup required'],
        assertions: callMatches
      });
    }
    
    return patterns;
  }

  private async calculateTestQuality(testCode: string): Promise<number> {
    const validation = await this.validateTestQuality(testCode);
    return validation.score;
  }

  private generateTestFilePath(className: string): string {
    const testFileName = `${className.toLowerCase()}.test.ts`;
    return `tests/units/${testFileName}`;
  }
}