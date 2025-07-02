import { TaskContext } from '../../types/agent-types';
import { CodeAttempt, FormalContracts, ArchitecturalDesign, ContractFile } from './index';

/**
 * CoderUtilities contains helper functions for the CoderAgent
 */
export class CoderUtilities {
  /**
   * Get default coding standards
   */
  static getDefaultCodingStandards(): any {
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
  static formatCodingStandards(standards: any): string {
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
   * Determine failure type from error
   */
  static getFailureType(error: Error): string {
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
   * Extract last error message
   */
  static getLastErrorMessage(error: Error): string {
    const message = error.message;
    const lastErrorMatch = message.match(/Last error: (.+)$/);
    return lastErrorMatch ? lastErrorMatch[1] : message;
  }

  /**
   * Generate file paths for code and tests
   */
  static generateFilePaths(taskId: string, language: string = 'typescript') {
    const extension = language === 'typescript' ? '.ts' : '.js';
    const testExtension = language === 'typescript' ? '.test.ts' : '.test.js';
    
    return {
      codeFile: `src/${taskId}${extension}`,
      testFile: `tests/${taskId}${testExtension}`
    };
  }

  /**
   * Create commit message for task
   */
  static createCommitMessage(task: any): string {
    return `feat: ${task.title.toLowerCase()}

${task.description}

- Implemented core functionality
- Added comprehensive unit tests
- Verified compilation and test passes`;
  }
}
