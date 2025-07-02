import { Agent, TaskResult } from '../../agent';
import { PheromoneData } from '../../cognitive-canvas';
import { CodeAttempt, CoderResult, FormalContracts, ContractFile, ArchitecturalDesign } from './index';
import { CoderUtilities } from './coder-utilities';
import { ContractBuilder } from './contract-builder';
import { PromptTemplates } from './prompt-templates';

/**
 * CoderAgentImplementation contains the core implementation logic for the CoderAgent
 */
export class CoderAgentImplementation extends Agent {
  private codeAttempts: CodeAttempt[] = [];
  private testAttempts: number = 0;
  private maxAttempts = 2;

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
        const failureType = CoderUtilities.getFailureType(error as Error);
        const attemptCount = failureType === 'testing' ? this.testAttempts : this.codeAttempts.length;
        
        await this.reportImpasse(
          (error as Error).message,
          {
            failureType,
            attemptCount,
            lastError: CoderUtilities.getLastErrorMessage(error as Error),
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
        const contractContext = ContractBuilder.buildContractContext(formalContracts);
        const architecturalContext = ContractBuilder.buildArchitecturalContext(architecturalDesign);

        const prompt = this.formatPrompt(PromptTemplates.getCodePromptTemplate(), {
          taskDescription: this.currentTask!.description,
          language: this.taskContext!.projectInfo?.language || 'typescript',
          framework: this.taskContext!.projectInfo?.framework || 'node',
          dependencies: this.taskContext!.dependencies?.join(', ') || '',
          codingStandards: CoderUtilities.formatCodingStandards(codingStandards),
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
        const contractTestContext = ContractBuilder.buildContractTestContext(formalContracts);

        const prompt = this.formatPrompt(PromptTemplates.getTestPromptTemplate(), {
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
      
      const commitMessage = CoderUtilities.createCommitMessage(this.currentTask!);

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

      return pheromones.length > 0 ? pheromones[0].metadata : CoderUtilities.getDefaultCodingStandards();
    } catch (error) {
      console.warn(`Failed to retrieve coding standards: ${(error as Error).message}`);
      return CoderUtilities.getDefaultCodingStandards();
    }
  }

  /**
   * Get prompt template for the coder agent
   */
  getPromptTemplate(): string {
    return PromptTemplates.getCodePromptTemplate();
  }

  /**
   * Write code to the appropriate workspace file
   */
  private async writeCodeToWorkspace(code: string): Promise<void> {
    const language = this.taskContext!.projectInfo?.language || 'typescript';
    const paths = CoderUtilities.generateFilePaths(this.currentTask!.id, language);
    await this.writeFile(paths.codeFile, code);
  }

  /**
   * Write tests to the appropriate workspace file
   */
  private async writeTestsToWorkspace(tests: string): Promise<void> {
    const language = this.taskContext!.projectInfo?.language || 'typescript';
    const paths = CoderUtilities.generateFilePaths(this.currentTask!.id, language);
    await this.writeFile(paths.testFile, tests);
  }

}