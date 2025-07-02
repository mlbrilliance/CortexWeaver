/**
 * PromptTemplates contains prompt templates for the CoderAgent
 */
export class PromptTemplates {
  /**
   * Get the prompt template for coding tasks
   */
  static getCodePromptTemplate(): string {
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
  static getTestPromptTemplate(): string {
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
}
