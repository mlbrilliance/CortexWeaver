/**
 * CodeSavant - A Gemini-powered helper agent that provides alternative solutions
 * and root cause analysis when the Coder agent gets stuck.
 */
export class CodeSavant {
  private readonly maxSuggestionLength = 150;
  private readonly maxAnalysisLength = 500;

  /**
   * Analyzes a problem by examining failed code and error messages
   * @param problemDescription - Original task description
   * @param failedCode - Code that failed to work
   * @param errorMessage - Error message or failure reason
   * @returns Analysis of the problem
   */
  async analyzeProblem(
    problemDescription: string,
    failedCode: string,
    errorMessage: string
  ): Promise<string> {
    if (!problemDescription && !failedCode && !errorMessage) {
      return 'Insufficient information provided for analysis.';
    }

    // Sanitize inputs
    const sanitizedCode = this.sanitizeInput(failedCode);
    const sanitizedError = this.sanitizeInput(errorMessage);

    // Analyze error patterns
    const errorPatterns = this.identifyErrorPatterns(sanitizedError);
    const codePatterns = this.identifyCodePatterns(sanitizedCode);

    let analysis = `Problem Analysis for: ${problemDescription}\n\n`;
    
    // Add error classification
    if (errorPatterns.isReferenceError) {
      analysis += 'Issue Type: Variable reference error - undefined variable or scope issue\n';
    } else if (errorPatterns.isTypeError) {
      analysis += 'Issue Type: Type error - null/undefined access or type mismatch\n';
    } else if (errorPatterns.isStackOverflow) {
      analysis += 'Issue Type: stack overflow - infinite recursion or deep call stack\n';
    } else if (errorPatterns.isSyntaxError) {
      analysis += 'Issue Type: Syntax error - code structure or format issue\n';
    } else if (errorPatterns.isModuleError) {
      analysis += 'Issue Type: Module error - missing dependency or import issue\n';
    } else {
      analysis += 'Issue Type: Generic error - requires detailed investigation\n';
    }

    // Add code context analysis
    if (codePatterns.hasRecursion) {
      analysis += 'Code Context: Recursive function detected\n';
    }
    if (codePatterns.hasNullAccess) {
      analysis += 'Code Context: Potential null/undefined property access\n';
    }
    if (codePatterns.hasUndefinedVariable) {
      analysis += 'Code Context: Undefined variable usage detected\n';
    }

    analysis += `\nError Details: ${sanitizedError}`;

    return analysis.substring(0, this.maxAnalysisLength);
  }

  /**
   * Generates concrete alternative suggestions for the failed code
   * @param problemDescription - Original task description
   * @param failedCode - Code that failed to work
   * @param errorMessage - Error message or failure reason
   * @returns Array of 3 specific suggestions
   */
  async generateSuggestions(
    problemDescription: string,
    failedCode: string,
    errorMessage: string
  ): Promise<string[]> {
    const suggestions: string[] = [];
    const errorPatterns = this.identifyErrorPatterns(errorMessage);
    const codePatterns = this.identifyCodePatterns(failedCode);

    if (errorPatterns.isReferenceError) {
      suggestions.push('import or declare the missing variable/module at the top of the file');
      suggestions.push('declare the variable in the current scope before using it');
      suggestions.push('Pass the required object as a parameter');
    }
    else if (errorPatterns.isTypeError || codePatterns.hasNullAccess) {
      suggestions.push('Add null check before accessing properties (if obj && obj.prop)');
      suggestions.push('Use optional chaining operator (obj?.prop?.method())');
      suggestions.push('Initialize variables with default values or use fallback logic');
    }
    else if (codePatterns.hasUndefinedVariable) {
      suggestions.push('import or declare the missing variable/module at the top of the file');
      suggestions.push('declare the variable in the current scope before using it');
      suggestions.push('Pass the required object as a parameter');
    }
    else if (errorPatterns.isStackOverflow || codePatterns.hasRecursion) {
      suggestions.push('Replace recursion with iterative approach using loops');
      suggestions.push('Add proper base case condition to stop recursion');
      suggestions.push('Use memoization to cache results and reduce recursive calls');
    }
    else if (errorPatterns.isModuleError) {
      suggestions.push('Install missing dependency using npm install or yarn add');
      suggestions.push('Check import path spelling and file location');
      suggestions.push('Use alternative built-in library or different implementation');
    }
    else if (errorPatterns.isSyntaxError) {
      suggestions.push('Check bracket/parentheses matching and proper syntax');
      suggestions.push('Verify string quotes are properly escaped');
      suggestions.push('Ensure proper indentation and statement termination');
    }
    else {
      // Generic fallback suggestions
      suggestions.push('Add error handling with try-catch blocks');
      suggestions.push('Validate input parameters before processing');
      suggestions.push('Break down complex logic into smaller, testable functions');
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Identifies the root cause of the error
   * @param errorMessage - Error message to analyze
   * @param failedCode - Code that caused the error
   * @returns Root cause analysis
   */
  async identifyRootCause(errorMessage: string, failedCode: string): Promise<string> {
    const errorPatterns = this.identifyErrorPatterns(errorMessage);
    const codePatterns = this.identifyCodePatterns(failedCode);

    if (errorPatterns.isReferenceError) {
      return 'Root cause: variable not declared in current scope or missing import statement';
    }
    
    if (errorPatterns.isTypeError && codePatterns.hasNullAccess) {
      return 'Root cause: Attempting to access property on null/undefined object - needs validation';
    }
    
    if (errorPatterns.isStackOverflow) {
      if (codePatterns.hasRecursion) {
        return 'Root cause: infinite recursion due to missing or incorrect base case condition';
      }
      return 'Root cause: Deep call stack exceeded - consider iterative approach';
    }
    
    if (errorPatterns.isModuleError) {
      return 'Root cause: Missing dependency or incorrect import path specification';
    }
    
    if (errorPatterns.isSyntaxError) {
      return 'Root cause: Code syntax violation - check brackets, quotes, and structure';
    }
    
    if (errorMessage.toLowerCase().includes('type')) {
      return 'Root cause: Type mismatch - incorrect data type usage or conversion needed';
    }

    return 'Root cause: Complex issue requiring step-by-step debugging and analysis';
  }

  /**
   * Formats suggestions into structured output for the Orchestrator
   * @param suggestions - Array of suggestion strings
   * @returns Formatted suggestion string
   */
  formatSuggestions(suggestions: string[]): string {
    if (suggestions.length === 0) {
      return 'No specific suggestions available.';
    }

    return suggestions
      .map((suggestion, index) => {
        const truncated = suggestion.length > this.maxSuggestionLength
          ? suggestion.substring(0, this.maxSuggestionLength - 3) + '...'
          : suggestion;
        return `Suggestion ${index + 1}: ${truncated}`;
      })
      .join('\n');
  }

  /**
   * Sanitizes input to prevent injection and handle special characters
   */
  private sanitizeInput(input: string): string {
    if (!input) return '';
    return input
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .substring(0, 1000) // Limit length
      .trim();
  }

  /**
   * Identifies patterns in error messages
   */
  private identifyErrorPatterns(errorMessage: string): {
    isReferenceError: boolean;
    isTypeError: boolean;
    isStackOverflow: boolean;
    isSyntaxError: boolean;
    isModuleError: boolean;
  } {
    const lowerError = errorMessage.toLowerCase();
    
    return {
      isReferenceError: lowerError.includes('referenceerror') || lowerError.includes('is not defined'),
      isTypeError: lowerError.includes('typeerror') || lowerError.includes('cannot read property'),
      isStackOverflow: lowerError.includes('maximum call stack') || lowerError.includes('stack overflow'),
      isSyntaxError: lowerError.includes('syntaxerror') || lowerError.includes('unexpected token'),
      isModuleError: lowerError.includes('module not found') || lowerError.includes('cannot resolve')
    };
  }

  /**
   * Identifies patterns in code structure
   */
  private identifyCodePatterns(code: string): {
    hasRecursion: boolean;
    hasNullAccess: boolean;
    hasUndefinedVariable: boolean;
  } {
    if (!code) return { hasRecursion: false, hasNullAccess: false, hasUndefinedVariable: false };

    const lowerCode = code.toLowerCase();
    
    // Simple pattern detection
    const functionName = this.extractFunctionName(code);
    const hasRecursion = functionName ? lowerCode.includes(functionName.toLowerCase()) : false;
    
    return {
      hasRecursion,
      hasNullAccess: lowerCode.includes('.') && !lowerCode.includes('?.'),
      hasUndefinedVariable: this.hasUndeclaredVariablePattern(code)
    };
  }

  /**
   * Extracts function name from code for recursion detection
   */
  private extractFunctionName(code: string): string | null {
    const functionMatch = code.match(/function\s+(\w+)/);
    const arrowMatch = code.match(/const\s+(\w+)\s*=/);
    return functionMatch?.[1] || arrowMatch?.[1] || null;
  }

  /**
   * Simple heuristic to detect undeclared variable usage
   */
  private hasUndeclaredVariablePattern(code: string): boolean {
    // This is a simplified check - in real implementation would use AST
    const lines = code.split('\n');
    const declaredVars = new Set<string>();
    
    for (const line of lines) {
      // Track variable declarations
      const varMatch = line.match(/(?:var|let|const)\s+(\w+)/);
      if (varMatch) {
        declaredVars.add(varMatch[1]);
      }
      
      // Check for function parameters
      const paramMatch = line.match(/function\s+\w+\s*\(([^)]*)\)/);
      if (paramMatch) {
        const params = paramMatch[1].split(',').map(p => p.trim().split(' ')[0]);
        params.forEach(p => declaredVars.add(p));
      }
    }
    
    // Look for variable usage that might be undeclared
    for (const line of lines) {
      const usageMatch = line.match(/\b(\w+)\./);
      if (usageMatch && !declaredVars.has(usageMatch[1]) && 
          !['console', 'window', 'document', 'process'].includes(usageMatch[1])) {
        return true;
      }
    }
    
    return false;
  }
}