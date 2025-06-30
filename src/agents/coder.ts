import { Agent, TaskResult } from '../agent';
import { PheromoneData } from '../cognitive-canvas';

/**
 * Interface for formal contract files
 */
interface FormalContracts {
  openApiSpecs?: ContractFile[];
  jsonSchemas?: ContractFile[];
}

/**
 * Interface for individual contract files
 */
interface ContractFile {
  path: string;
  content: string;
}

/**
 * Interface for architectural design from Architect agent
 */
interface ArchitecturalDesign {
  designDocument: string;
  mermaidDiagram?: string;
  apiSpec?: string;
  dataModels?: Record<string, any>;
  decisions?: any[];
  contractCompliance?: any;
}

export interface CodeAttempt {
  code: string;
  timestamp: string;
  attemptNumber: number;
  errors?: string[];
}

export interface CoderResult {
  codeGenerated: boolean;
  testsGenerated: boolean;
  commitCreated: boolean;
  compilationSuccessful: boolean;
  testsPassedSuccessful: boolean;
  codeAttempts: CodeAttempt[];
  finalCode?: string;
  finalTests?: string;
  commitHash?: string;
}

/**
 * CoderAgent specializes in code implementation, testing, and version control
 * Implements impasse detection after 2 failed attempts at compilation or testing
 */
export class CoderAgent extends Agent {
  private codeAttempts: CodeAttempt[] = [];
  private testAttempts: number = 0;
  private maxAttempts = 2;

  /**
   * Get the prompt template for coding tasks
   */
  getPromptTemplate(): string {
    return `You are a expert software developer working on: {{taskDescription}}

Project Context:
- Language: {{language}}
- Framework: {{framework}}
- Dependencies: {{dependencies}}

{{contractSection}}

{{architecturalDesignSection}}

Coding Standards:
{{codingStandards}}

Requirements:
1. Implement clean, maintainable code following best practices
2. Include comprehensive error handling
3. Follow the specified coding standards
4. Write production-ready code with proper types/interfaces
5. Include JSDoc comments for public APIs
6. Ensure code is testable and follows SOLID principles
7. Code should be designed for easy unit tests
{{contractRequirements}}

Please provide only the implementation code without explanations.`;
  }

  /**
   * Get the prompt template for generating unit tests
   */
  private getTestPromptTemplate(): string {
    return `Generate comprehensive unit tests for the following code:

{{codeToTest}}

{{contractTestSection}}

Testing Requirements:
- Use the project's testing framework
- Cover all public methods and edge cases
- Include both positive and negative test scenarios
- Test error handling and boundary conditions
- Use proper mocking for dependencies
- Follow AAA pattern (Arrange, Act, Assert)
- Ensure tests are isolated and deterministic
{{contractTestRequirements}}

Language: {{language}}
Framework: {{framework}}

Please provide only the test code without explanations.`;
  }

  /**
   * Execute the coding task with impasse detection
   */
  async executeTask(): Promise<CoderResult> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    await this.reportProgress('started', 'Beginning code generation for task');

    try {
      // Reset attempts for new task
      this.codeAttempts = [];
      this.testAttempts = 0;

      // Get coding standards from Cognitive Canvas
      const codingStandards = await this.getCodingStandards();

      // Generate initial code implementation
      const codeResult = await this.generateCodeWithRetries(codingStandards);

      // Generate unit tests
      const testsResult = await this.generateTestsWithRetries(codeResult.finalCode);

      // Run compilation and tests
      await this.verifyImplementation();

      // Commit changes to git
      const commitResult = await this.commitChanges();

      await this.reportProgress('completed', 'Code implementation completed successfully');

      return {
        codeGenerated: true,
        testsGenerated: testsResult.success,
        commitCreated: commitResult.success,
        compilationSuccessful: true,
        testsPassedSuccessful: true,
        codeAttempts: this.codeAttempts,
        finalCode: codeResult.finalCode,
        finalTests: testsResult.tests,
        commitHash: commitResult.commitHash
      };

    } catch (error) {
      if ((error as Error).message.includes('IMPASSE')) {
        const failureType = this.getFailureType(error as Error);
        const attemptCount = failureType === 'testing' ? this.testAttempts : this.codeAttempts.length;
        
        await this.reportImpasse(
          (error as Error).message,
          {
            failureType,
            attemptCount,
            lastError: this.getLastErrorMessage(error as Error),
            conversationHistory: this.conversationHistory,
            taskId: this.currentTask.id,
            taskTitle: this.currentTask.title,
            fullCodeAttempts: this.codeAttempts
          },
          'high'
        );
      }
      throw error;
    }
  }

  /**
   * Generate code implementation with retry logic and impasse detection
   */
  private async generateCodeWithRetries(codingStandards: any): Promise<{ success: boolean; finalCode: string }> {
    let lastError = '';
    
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        await this.reportProgress('in_progress', `Code generation attempt ${attempt}`);
        
        // Build contract and architectural context
        const formalContracts = (this.taskContext as any)?.formalContracts as FormalContracts;
        const architecturalDesign = (this.taskContext as any)?.architecturalDesign as ArchitecturalDesign;
        const contractContext = this.buildContractContext(formalContracts);
        const architecturalContext = this.buildArchitecturalContext(architecturalDesign);

        const prompt = this.formatPrompt(this.getPromptTemplate(), {
          taskDescription: this.currentTask!.description,
          language: this.taskContext!.projectInfo?.language || 'typescript',
          framework: this.taskContext!.projectInfo?.framework || 'node',
          dependencies: this.taskContext!.dependencies?.join(', ') || '',
          codingStandards: this.formatCodingStandards(codingStandards),
          ...contractContext,
          ...architecturalContext
        });

        // Add context from previous attempts if retrying
        let fullPrompt = prompt;
        if (attempt > 1) {
          fullPrompt += `\n\nPrevious attempt failed with error: ${lastError}\n\nPlease fix the issues and provide corrected code.`;
        }

        const response = await this.sendToClaude(fullPrompt);
        
        const codeAttempt: CodeAttempt = {
          code: response.content,
          timestamp: new Date().toISOString(),
          attemptNumber: attempt
        };
        this.codeAttempts.push(codeAttempt);

        // Write the code to workspace
        await this.writeCodeToWorkspace(response.content);

        // Try to compile the code
        const compileResult = await this.executeCommand('npm run build || tsc --noEmit');
        
        if (compileResult.exitCode === 0) {
          return { success: true, finalCode: response.content };
        } else {
          lastError = compileResult.stderr || compileResult.stdout;
          codeAttempt.errors = [lastError];

          if (attempt >= this.maxAttempts) {
            throw new Error(`IMPASSE: Code compilation failed after ${this.maxAttempts} attempts. Last error: ${lastError}`);
          }
        }

      } catch (error) {
        if ((error as Error).message.includes('IMPASSE')) {
          throw error;
        }
        lastError = (error as Error).message;
        
        if (attempt >= this.maxAttempts) {
          throw new Error(`IMPASSE: Code generation failed after ${this.maxAttempts} attempts. Last error: ${lastError}`);
        }
      }
    }

    throw new Error(`IMPASSE: Code generation failed after ${this.maxAttempts} attempts. Last error: ${lastError}`);
  }

  /**
   * Generate unit tests with retry logic
   */
  private async generateTestsWithRetries(codeToTest: string): Promise<{ success: boolean; tests: string }> {
    let lastError = '';

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        this.testAttempts = attempt;
        await this.reportProgress('in_progress', `Test generation attempt ${attempt}`);

        // Build contract testing context
        const formalContracts = (this.taskContext as any)?.formalContracts as FormalContracts;
        const contractTestContext = this.buildContractTestContext(formalContracts);

        const prompt = this.formatPrompt(this.getTestPromptTemplate(), {
          codeToTest,
          language: this.taskContext!.projectInfo?.language || 'typescript',
          framework: this.taskContext!.projectInfo?.framework || 'node',
          ...contractTestContext
        });

        let fullPrompt = prompt;
        if (attempt > 1) {
          fullPrompt += `\n\nPrevious test attempt failed with error: ${lastError}\n\nPlease fix the test issues.`;
        }

        const response = await this.sendToClaude(fullPrompt);

        // Write tests to workspace
        await this.writeTestsToWorkspace(response.content);

        // Run tests
        const testResult = await this.executeCommand('npm test');
        
        if (testResult.exitCode === 0) {
          return { success: true, tests: response.content };
        } else {
          lastError = testResult.stderr || testResult.stdout;

          if (attempt >= this.maxAttempts) {
            throw new Error(`IMPASSE: Tests failed after ${this.maxAttempts} attempts. Last error: ${lastError}`);
          }
        }

      } catch (error) {
        if ((error as Error).message.includes('IMPASSE')) {
          throw error;
        }
        lastError = (error as Error).message;
        
        if (attempt >= this.maxAttempts) {
          throw new Error(`IMPASSE: Test generation failed after ${this.maxAttempts} attempts. Last error: ${lastError}`);
        }
      }
    }

    throw new Error(`IMPASSE: Test generation failed after ${this.maxAttempts} attempts. Last error: ${lastError}`);
  }

  /**
   * Verify the implementation by running compilation and tests
   */
  private async verifyImplementation(): Promise<void> {
    await this.reportProgress('in_progress', 'Verifying implementation');

    // Final compilation check
    const compileResult = await this.executeCommand('npm run build || tsc --noEmit');
    if (compileResult.exitCode !== 0) {
      throw new Error(`Final compilation failed: ${compileResult.stderr || compileResult.stdout}`);
    }

    // Final test run
    const testResult = await this.executeCommand('npm test');
    if (testResult.exitCode !== 0) {
      throw new Error(`Final tests failed: ${testResult.stderr || testResult.stdout}`);
    }
  }

  /**
   * Commit changes to the worktree
   */
  private async commitChanges(): Promise<{ success: boolean; commitHash?: string }> {
    try {
      await this.reportProgress('in_progress', 'Committing changes to git');
      
      const commitMessage = `feat: ${this.currentTask!.title.toLowerCase()}

${this.currentTask!.description}

- Implemented core functionality
- Added comprehensive unit tests
- Verified compilation and test passes`;

      const commitHash = await this.workspace!.commitChanges(this.currentTask!.id, commitMessage);
      
      return {
        success: true,
        commitHash: commitHash
      };
    } catch (error) {
      console.warn(`Git commit failed: ${(error as Error).message}`);
      return { success: false };
    }
  }

  /**
   * Get coding standards from Cognitive Canvas
   */
  private async getCodingStandards(): Promise<any> {
    try {
      const pheromones = await this.cognitiveCanvas!.getPheromonesByType('coding_standards');

      return pheromones.length > 0 ? pheromones[0].metadata : this.getDefaultCodingStandards();
    } catch (error) {
      console.warn(`Failed to retrieve coding standards: ${(error as Error).message}`);
      return this.getDefaultCodingStandards();
    }
  }

  /**
   * Get default coding standards
   */
  private getDefaultCodingStandards(): any {
    return {
      language: 'typescript',
      standards: {
        indentation: 2,
        quotes: 'single',
        semicolons: true,
        maxLineLength: 100,
        naming: 'camelCase'
      }
    };
  }

  /**
   * Format coding standards for prompt
   */
  private formatCodingStandards(standards: any): string {
    if (!standards || !standards.standards) {
      return 'Follow TypeScript best practices with 2-space indentation and single quotes.';
    }

    const std = standards.standards;
    return `- Use ${std.indentation || 2} spaces for indentation
- Use ${std.quotes || 'single'} quotes for strings
- ${std.semicolons ? 'Include' : 'Omit'} semicolons
- Maximum line length: ${std.maxLineLength || 100} characters
- Use ${std.naming || 'camelCase'} naming convention`;
  }

  /**
   * Write code to the appropriate workspace file
   */
  private async writeCodeToWorkspace(code: string): Promise<void> {
    const language = this.taskContext!.projectInfo?.language || 'typescript';
    const extension = language === 'typescript' ? '.ts' : '.js';
    const fileName = `src/${this.currentTask!.id}${extension}`;
    
    await this.writeFile(fileName, code);
  }

  /**
   * Write tests to the appropriate workspace file
   */
  private async writeTestsToWorkspace(tests: string): Promise<void> {
    const language = this.taskContext!.projectInfo?.language || 'typescript';
    const extension = language === 'typescript' ? '.test.ts' : '.test.js';
    const fileName = `tests/${this.currentTask!.id}${extension}`;
    
    await this.writeFile(fileName, tests);
  }

  /**
   * Determine failure type from error
   */
  private getFailureType(error: Error): string {
    const message = error.message;
    if (message.includes('compilation failed')) {
      return 'compilation';
    } else if (message.includes('Tests failed') || message.includes('Test generation failed')) {
      return 'testing';
    } else {
      return 'unknown';
    }
  }

  /**
   * Build contract context for code generation prompts
   */
  private buildContractContext(formalContracts?: FormalContracts): Record<string, string> {
    if (!formalContracts) {
      return {
        contractSection: '',
        contractRequirements: ''
      };
    }

    const hasOpenApi = formalContracts.openApiSpecs && formalContracts.openApiSpecs.length > 0;
    const hasSchemas = formalContracts.jsonSchemas && formalContracts.jsonSchemas.length > 0;

    let contractSection = 'FORMAL CONTRACTS TO IMPLEMENT:\n';
    let contractRequirements = '8. ENSURE implementation satisfies all provided formal contracts\n';
    
    if (hasOpenApi) {
      contractSection += 'OpenAPI Specifications:\n';
      formalContracts.openApiSpecs!.forEach(spec => {
        contractSection += `- ${spec.path}\n`;
        const preview = spec.content.substring(0, 800).replace(/\n/g, '\n  ');
        contractSection += `  Contract content:\n  ${preview}${spec.content.length > 800 ? '...' : ''}\n\n`;
      });
      contractRequirements += '9. IMPLEMENT all endpoints specified in OpenAPI contracts\n';
      contractRequirements += '10. ENSURE response formats match OpenAPI schema definitions\n';
      contractRequirements += '11. VALIDATE request/response data against contract specifications\n';
    }

    if (hasSchemas) {
      contractSection += 'JSON Schemas for Data Models:\n';
      formalContracts.jsonSchemas!.forEach(schema => {
        contractSection += `- ${schema.path}\n`;
        const preview = schema.content.substring(0, 500).replace(/\n/g, '\n  ');
        contractSection += `  Schema content:\n  ${preview}${schema.content.length > 500 ? '...' : ''}\n\n`;
      });
      contractRequirements += '12. ALIGN data models with provided JSON schemas\n';
      contractRequirements += '13. INCLUDE proper validation based on schema constraints\n';
    }

    return { contractSection, contractRequirements };
  }

  /**
   * Build architectural design context for code generation prompts
   */
  private buildArchitecturalContext(architecturalDesign?: ArchitecturalDesign): Record<string, string> {
    if (!architecturalDesign) {
      return {
        architecturalDesignSection: ''
      };
    }

    let architecturalDesignSection = 'ARCHITECTURAL DESIGN TO FOLLOW:\n';
    architecturalDesignSection += `Design Document:\n${architecturalDesign.designDocument.substring(0, 1000)}${architecturalDesign.designDocument.length > 1000 ? '...' : ''}\n\n`;
    
    if (architecturalDesign.apiSpec) {
      architecturalDesignSection += `API Specifications:\n${architecturalDesign.apiSpec.substring(0, 500)}${architecturalDesign.apiSpec.length > 500 ? '...' : ''}\n\n`;
    }
    
    if (architecturalDesign.dataModels && Object.keys(architecturalDesign.dataModels).length > 0) {
      architecturalDesignSection += `Data Models:\n${JSON.stringify(architecturalDesign.dataModels, null, 2).substring(0, 400)}...\n\n`;
    }

    return { architecturalDesignSection };
  }

  /**
   * Build contract testing context for test generation prompts
   */
  private buildContractTestContext(formalContracts?: FormalContracts): Record<string, string> {
    if (!formalContracts) {
      return {
        contractTestSection: '',
        contractTestRequirements: ''
      };
    }

    const hasOpenApi = formalContracts.openApiSpecs && formalContracts.openApiSpecs.length > 0;
    const hasSchemas = formalContracts.jsonSchemas && formalContracts.jsonSchemas.length > 0;

    let contractTestSection = 'CONTRACT COMPLIANCE TESTING:\n';
    let contractTestRequirements = '- INCLUDE tests that validate contract compliance\n';
    
    if (hasOpenApi) {
      contractTestSection += 'Test OpenAPI Contract Compliance:\n';
      formalContracts.openApiSpecs!.forEach(spec => {
        contractTestSection += `- Validate endpoints from ${spec.path}\n`;
        contractTestSection += `- Test response formats match OpenAPI schemas\n`;
        contractTestSection += `- Verify HTTP status codes align with contract\n`;
      });
      contractTestRequirements += '- TEST that API endpoints return correct status codes per OpenAPI spec\n';
      contractTestRequirements += '- VALIDATE response schemas match OpenAPI definitions\n';
      contractTestRequirements += '- TEST request validation according to OpenAPI parameters\n';
    }

    if (hasSchemas) {
      contractTestSection += 'Test JSON Schema Compliance:\n';
      formalContracts.jsonSchemas!.forEach(schema => {
        contractTestSection += `- Validate data models against ${schema.path}\n`;
        contractTestSection += `- Test schema validation and constraints\n`;
      });
      contractTestRequirements += '- TEST data model validation against JSON schemas\n';
      contractTestRequirements += '- VERIFY required fields and data types per schemas\n';
    }

    return { contractTestSection, contractTestRequirements };
  }

  /**
   * Extract last error message
   */
  private getLastErrorMessage(error: Error): string {
    const message = error.message;
    const lastErrorMatch = message.match(/Last error: (.+)$/);
    return lastErrorMatch ? lastErrorMatch[1] : message;
  }
}