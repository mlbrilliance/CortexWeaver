import { CodeSavant } from '../src/code-savant';

describe('CodeSavant', () => {
  let codeSavant: CodeSavant;

  beforeEach(() => {
    codeSavant = new CodeSavant();
  });

  describe('analyzeProblem', () => {
    it('should analyze compilation errors correctly', async () => {
      const problemDescription = 'Implement user authentication';
      const failedCode = `
        function authenticateUser(username, password) {
          return user.authenticate(username, password);
        }
      `;
      const errorMessage = 'ReferenceError: user is not defined';

      const analysis = await codeSavant.analyzeProblem(
        problemDescription,
        failedCode,
        errorMessage
      );

      expect(analysis).toContain('user is not defined');
      expect(analysis).toContain('reference error');
    });

    it('should handle runtime errors', async () => {
      const problemDescription = 'Process user data';
      const failedCode = `
        function processUserData(userData) {
          return userData.name.toUpperCase();
        }
      `;
      const errorMessage = 'TypeError: Cannot read property \'toUpperCase\' of undefined';

      const analysis = await codeSavant.analyzeProblem(
        problemDescription,
        failedCode,
        errorMessage
      );

      expect(analysis).toContain('null');
      expect(analysis).toContain('undefined');
    });

    it('should analyze logic errors', async () => {
      const problemDescription = 'Calculate factorial';
      const failedCode = `
        function factorial(n) {
          if (n <= 1) return 1;
          return n * factorial(n + 1);
        }
      `;
      const errorMessage = 'Maximum call stack size exceeded';

      const analysis = await codeSavant.analyzeProblem(
        problemDescription,
        failedCode,
        errorMessage
      );

      expect(analysis).toContain('recursion');
      expect(analysis).toContain('stack overflow');
    });

    it('should handle empty or malformed input', async () => {
      const analysis = await codeSavant.analyzeProblem('', '', '');
      expect(analysis).toBeDefined();
      expect(typeof analysis).toBe('string');
    });
  });

  describe('generateSuggestions', () => {
    it('should generate concrete suggestions for undefined variable error', async () => {
      const problemDescription = 'User authentication';
      const failedCode = 'return user.authenticate();';
      const errorMessage = 'ReferenceError: user is not defined';

      const suggestions = await codeSavant.generateSuggestions(
        problemDescription,
        failedCode,
        errorMessage
      );

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toContain('import');
      expect(suggestions[1]).toContain('declare');
      expect(suggestions[2]).toContain('parameter');
    });

    it('should suggest alternatives for null/undefined errors', async () => {
      const problemDescription = 'Process data';
      const failedCode = 'return data.value.toString();';
      const errorMessage = 'TypeError: Cannot read property \'toString\' of undefined';

      const suggestions = await codeSavant.generateSuggestions(
        problemDescription,
        failedCode,
        errorMessage
      );

      expect(suggestions).toHaveLength(3);
      expect(suggestions.some(s => s.includes('null check'))).toBe(true);
      expect(suggestions.some(s => s.includes('optional chaining'))).toBe(true);
    });

    it('should provide iterative alternatives for recursion issues', async () => {
      const problemDescription = 'Calculate sum';
      const failedCode = 'return n + sum(n-1);';
      const errorMessage = 'Maximum call stack size exceeded';

      const suggestions = await codeSavant.generateSuggestions(
        problemDescription,
        failedCode,
        errorMessage
      );

      expect(suggestions).toHaveLength(3);
      expect(suggestions.some(s => s.includes('iterative'))).toBe(true);
      expect(suggestions.some(s => s.includes('loop'))).toBe(true);
    });

    it('should handle dependency-related errors', async () => {
      const problemDescription = 'Use external library';
      const failedCode = 'import { helper } from "missing-lib";';
      const errorMessage = 'Module not found: missing-lib';

      const suggestions = await codeSavant.generateSuggestions(
        problemDescription,
        failedCode,
        errorMessage
      );

      expect(suggestions).toHaveLength(3);
      expect(suggestions.some(s => s.includes('install'))).toBe(true);
      expect(suggestions.some(s => s.includes('alternative'))).toBe(true);
    });
  });

  describe('identifyRootCause', () => {
    it('should identify variable scope issues', async () => {
      const errorMessage = 'ReferenceError: variable is not defined';
      const failedCode = 'return variable.method();';

      const rootCause = await codeSavant.identifyRootCause(errorMessage, failedCode);

      expect(rootCause).toContain('scope');
      expect(rootCause).toContain('variable not declared');
    });

    it('should identify null pointer issues', async () => {
      const errorMessage = 'TypeError: Cannot read property of null';
      const failedCode = 'return object.property;';

      const rootCause = await codeSavant.identifyRootCause(errorMessage, failedCode);

      expect(rootCause).toContain('null');
      expect(rootCause).toContain('validation');
    });

    it('should identify infinite recursion', async () => {
      const errorMessage = 'Maximum call stack size exceeded';
      const failedCode = 'function test() { return test(); }';

      const rootCause = await codeSavant.identifyRootCause(errorMessage, failedCode);

      expect(rootCause).toContain('infinite recursion');
      expect(rootCause).toContain('base case');
    });

    it('should identify type mismatches', async () => {
      const errorMessage = 'TypeError: Expected string but got number';
      const failedCode = 'return parseInt(123);';

      const rootCause = await codeSavant.identifyRootCause(errorMessage, failedCode);

      expect(rootCause).toContain('type');
      expect(rootCause).toContain('conversion');
    });
  });

  describe('formatSuggestions', () => {
    it('should format suggestions with numbered list', () => {
      const suggestions = [
        'Add null check before accessing property',
        'Use optional chaining operator',
        'Initialize variable with default value'
      ];

      const formatted = codeSavant.formatSuggestions(suggestions);

      expect(formatted).toContain('Suggestion 1:');
      expect(formatted).toContain('Suggestion 2:');
      expect(formatted).toContain('Suggestion 3:');
      expect(formatted).toContain('Add null check');
      expect(formatted).toContain('optional chaining');
      expect(formatted).toContain('default value');
    });

    it('should handle empty suggestions array', () => {
      const formatted = codeSavant.formatSuggestions([]);
      expect(formatted).toBe('No specific suggestions available.');
    });

    it('should handle single suggestion', () => {
      const suggestions = ['Check variable initialization'];
      const formatted = codeSavant.formatSuggestions(suggestions);
      
      expect(formatted).toContain('Suggestion 1:');
      expect(formatted).toContain('Check variable initialization');
    });

    it('should truncate very long suggestions', () => {
      const longSuggestion = 'A'.repeat(200) + ' very long suggestion';
      const suggestions = [longSuggestion];
      
      const formatted = codeSavant.formatSuggestions(suggestions);
      
      expect(formatted.length).toBeLessThan(300);
      expect(formatted).toContain('...');
    });
  });

  describe('integration tests', () => {
    it('should provide end-to-end analysis and suggestions', async () => {
      const problemDescription = 'Implement user validation';
      const failedCode = `
        function validateUser(user) {
          if (user.email.includes('@')) {
            return true;
          }
          return false;
        }
      `;
      const errorMessage = 'TypeError: Cannot read property \'includes\' of undefined';

      const analysis = await codeSavant.analyzeProblem(
        problemDescription,
        failedCode,
        errorMessage
      );
      const suggestions = await codeSavant.generateSuggestions(
        problemDescription,
        failedCode,
        errorMessage
      );
      const rootCause = await codeSavant.identifyRootCause(errorMessage, failedCode);
      const formatted = codeSavant.formatSuggestions(suggestions);

      expect(analysis).toBeDefined();
      expect(suggestions).toHaveLength(3);
      expect(rootCause).toContain('null');
      expect(formatted).toContain('Suggestion 1:');
    });

    it('should handle complex nested errors', async () => {
      const problemDescription = 'Process nested data structure';
      const failedCode = `
        function processData(data) {
          return data.users.map(user => user.profile.name);
        }
      `;
      const errorMessage = 'TypeError: Cannot read property \'map\' of undefined';

      const suggestions = await codeSavant.generateSuggestions(
        problemDescription,
        failedCode,
        errorMessage
      );

      expect(suggestions).toHaveLength(3);
      expect(suggestions.some(s => s.includes('check'))).toBe(true);
      expect(suggestions.some(s => s.includes('default'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle malformed error messages', async () => {
      const suggestions = await codeSavant.generateSuggestions(
        'test',
        'test code',
        'malformed error: {invalid json}'
      );

      expect(suggestions).toHaveLength(3);
      expect(suggestions.every(s => typeof s === 'string')).toBe(true);
    });

    it('should handle very long code snippets', async () => {
      const longCode = 'function test() {\n' + '  console.log("test");\n'.repeat(100) + '}';
      
      const analysis = await codeSavant.analyzeProblem(
        'test function',
        longCode,
        'SyntaxError: Unexpected token'
      );

      expect(analysis).toBeDefined();
      expect(typeof analysis).toBe('string');
    });

    it('should handle special characters in code', async () => {
      const codeWithSpecialChars = 'const msg = "Hello 🌍! Use quotes: \\"test\\"";';
      
      const suggestions = await codeSavant.generateSuggestions(
        'message handling',
        codeWithSpecialChars,
        'SyntaxError: Invalid character'
      );

      expect(suggestions).toHaveLength(3);
    });
  });
});