import { SpecWriter } from '../../src/agents/spec-writer';
import { AgentConfig, TaskContext } from '../../src/agent';
import { TaskData, CognitiveCanvas } from '../../src/cognitive-canvas';
import { WorkspaceManager } from '../../src/workspace';
import { SessionManager } from '../../src/session';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('@google/generative-ai');
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/workspace');
jest.mock('../../src/session');
jest.mock('fs');
jest.mock('path');

describe('SpecWriter', () => {
  let specWriter: SpecWriter;
  let mockConfig: AgentConfig;
  let mockTask: TaskData;
  let mockContext: TaskContext;
  let mockGeminiClient: jest.Mocked<any>;
  let mockGenerateContent: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Gemini client
    mockGenerateContent = jest.fn();
    mockGeminiClient = {
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: mockGenerateContent
      })
    };
    (GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>).mockImplementation(
      () => mockGeminiClient
    );

    // Mock fs operations
    (fs.existsSync as jest.MockedFunction<typeof fs.existsSync>).mockReturnValue(true);
    (fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>).mockImplementation();
    (fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>).mockImplementation();
    (fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>).mockReturnValue('mock file content');
    
    // Mock path operations
    (path.resolve as jest.MockedFunction<typeof path.resolve>).mockImplementation((...args) => args.join('/'));
    (path.dirname as jest.MockedFunction<typeof path.dirname>).mockImplementation((p) => p.split('/').slice(0, -1).join('/'));
    (path.join as jest.MockedFunction<typeof path.join>).mockImplementation((...args) => args.join('/'));

    mockConfig = {
      id: 'spec-writer-test',
      role: 'SpecWriter',
      capabilities: ['specification-writing', 'user-story-generation', 'bdd-testing'],
      claudeConfig: {
        apiKey: 'test-api-key',
        defaultModel: 'claude-3-sonnet-20240229' as any,
        maxTokens: 4096,
        temperature: 0.7
      },
      workspaceRoot: '/test/workspace',
      cognitiveCanvasConfig: {
        uri: 'neo4j://localhost:7687',
        username: 'neo4j',
        password: 'password'
      }
    };

    mockTask = {
      id: 'spec-task-1',
      title: 'Write specifications for user authentication feature',
      description: 'Create detailed user stories and BDD specifications for user authentication',
      priority: 'high',
      status: 'pending',
      projectId: 'test-project-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockContext = {
      projectInfo: {
        name: 'Test Project',
        description: 'A test project for specification writing'
      },
      files: ['README.md', 'plan.md'],
      dependencies: []
    };

    specWriter = new SpecWriter();
  });

  describe('initialization', () => {
    it('should initialize with valid configuration', async () => {
      // Set environment variable for this test
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      
      await specWriter.initialize(mockConfig);
      expect(specWriter.getId()).toBe('spec-writer-test');
      expect(specWriter.getRole()).toBe('SpecWriter');
      expect(specWriter.getCapabilities()).toEqual(['specification-writing', 'user-story-generation', 'bdd-testing']);
    });

    it('should initialize Gemini client with API key', async () => {
      // Set environment variable for Gemini API key
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      
      await specWriter.initialize(mockConfig);
      
      expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-gemini-key');
    });

    it('should throw error if Gemini API key is missing', async () => {
      delete process.env.GEMINI_API_KEY;
      
      await expect(specWriter.initialize(mockConfig)).rejects.toThrow('Gemini API key is required');
    });
  });

  describe('getPromptTemplate', () => {
    beforeEach(async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      await specWriter.initialize(mockConfig);
    });

    it('should return a comprehensive prompt template', () => {
      const template = specWriter.getPromptTemplate();
      
      expect(template).toContain('specification writer');
      expect(template).toContain('User Stories');
      expect(template).toContain('Gherkin');
      expect(template).toContain('BDD');
      expect(template).toContain('Non-Functional Requirements');
      expect(template).toContain('{{taskDescription}}');
      expect(template).toContain('{{projectInfo}}');
    });
  });

  describe('executeTask', () => {
    beforeEach(async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      await specWriter.initialize(mockConfig);
      await specWriter.receiveTask(mockTask, mockContext);
    });

    it('should generate user stories successfully', async () => {
      const mockResponse = {
        response: {
          text: () => `
# User Stories

## Epic: User Authentication

### User Story 1: User Registration
**As a** new user  
**I want to** register for an account  
**So that** I can access the application

**Acceptance Criteria:**
- User can enter email and password
- Password must meet security requirements
- Email validation is performed
- User receives confirmation email

### User Story 2: User Login
**As a** registered user  
**I want to** log into my account  
**So that** I can access protected features

**Acceptance Criteria:**
- User can enter email and password
- Invalid credentials show error message
- Successful login redirects to dashboard
- Session is maintained across browser refresh

# BDD Specifications

## Feature: User Registration
\`\`\`gherkin
Feature: User Registration
  As a new user
  I want to register for an account
  So that I can access the application

  Scenario: Successful registration
    Given I am on the registration page
    When I enter a valid email "test@example.com"
    And I enter a valid password "SecurePass123!"
    And I click the register button
    Then I should see a success message
    And I should receive a confirmation email

  Scenario: Registration with invalid email
    Given I am on the registration page
    When I enter an invalid email "invalid-email"
    And I enter a valid password "SecurePass123!"
    And I click the register button
    Then I should see an error message "Please enter a valid email address"
\`\`\`

# Non-Functional Requirements

## Security Requirements
- Passwords must be at least 8 characters long
- Passwords must contain uppercase, lowercase, numbers, and special characters
- User sessions must expire after 24 hours of inactivity
- All authentication endpoints must use HTTPS

## Performance Requirements
- Registration should complete within 3 seconds
- Login should complete within 2 seconds
- System should handle 1000 concurrent users
          `
        }
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await specWriter.executeTask();

      expect(result).toBeDefined();
      expect(result.userStories).toBeDefined();
      expect(result.bddSpecs).toBeDefined();
      expect(result.nonFunctionalRequirements).toBeDefined();
      expect(result.featureFiles).toBeDefined();
    });

    it('should create .feature files in workspace', async () => {
      const mockResponse = {
        response: {
          text: () => `
# BDD Specifications

## Feature: User Registration
\`\`\`gherkin
Feature: User Registration
  As a new user
  I want to register for an account
  So that I can access the application

  Scenario: Successful registration
    Given I am on the registration page
    When I enter a valid email "test@example.com"
    And I enter a valid password "SecurePass123!"
    And I click the register button
    Then I should see a success message
\`\`\`
          `
        }
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      await specWriter.executeTask();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('user-registration.feature'),
        expect.stringContaining('Feature: User Registration'),
        'utf-8'
      );
    });

    it('should handle Gemini API errors gracefully', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Gemini API error'));

      await expect(specWriter.executeTask()).rejects.toThrow('Failed to generate specifications');
    });

    it('should validate generated Gherkin syntax', async () => {
      const mockResponse = {
        response: {
          text: () => `
# BDD Specifications

## Feature: Invalid Gherkin
\`\`\`gherkin
Feature: Invalid Gherkin
  Missing scenario structure
\`\`\`
          `
        }
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await specWriter.executeTask();
      expect(result.validationResults).toBeDefined();
      expect(result.validationResults.some((r: any) => !r.isValid)).toBe(true);
    });
  });

  describe('generateUserStories', () => {
    beforeEach(async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      await specWriter.initialize(mockConfig);
      await specWriter.receiveTask(mockTask, mockContext);
    });

    it('should generate structured user stories', async () => {
      const mockResponse = {
        response: {
          text: () => `
### User Story 1: User Registration
**As a** new user  
**I want to** register for an account  
**So that** I can access the application

**Acceptance Criteria:**
- User can enter email and password
- Password meets security requirements
          `
        }
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const userStories = await (specWriter as any).generateUserStories('User authentication feature');

      expect(userStories).toBeDefined();
      expect(userStories.length).toBeGreaterThan(0);
      expect(userStories[0].description).toContain('As a');
      expect(userStories[0].description).toContain('I want to');
      expect(userStories[0].description).toContain('so that');
    });
  });

  describe('generateBDDSpecs', () => {
    beforeEach(async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      await specWriter.initialize(mockConfig);
      await specWriter.receiveTask(mockTask, mockContext);
    });

    it('should generate valid Gherkin specifications', async () => {
      const mockResponse = {
        response: {
          text: () => `
Feature: User Registration
  As a new user
  I want to register for an account
  So that I can access the application

  Scenario: Successful registration
    Given I am on the registration page
    When I enter a valid email "test@example.com"
    And I enter a valid password "SecurePass123!"
    And I click the register button
    Then I should see a success message
          `
        }
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const bddSpecs = await (specWriter as any).generateBDDSpecs('User registration user story');

      expect(bddSpecs).toBeDefined();
      expect(bddSpecs).toContain('Feature:');
      expect(bddSpecs).toContain('Scenario:');
      expect(bddSpecs).toContain('Given');
      expect(bddSpecs).toContain('When');
      expect(bddSpecs).toContain('Then');
    });
  });

  describe('validateGherkinSyntax', () => {
    beforeEach(async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      await specWriter.initialize(mockConfig);
    });

    it('should validate correct Gherkin syntax', () => {
      const validGherkin = `
Feature: User Registration
  As a new user
  I want to register for an account
  So that I can access the application

  Scenario: Successful registration
    Given I am on the registration page
    When I enter a valid email
    Then I should see a success message
      `;

      const result = (specWriter as any).validateGherkinSyntax(validGherkin);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid Gherkin syntax', () => {
      const invalidGherkin = `
Feature: Invalid Feature
  Missing scenario structure
  Random text without proper keywords
      `;

      const result = (specWriter as any).validateGherkinSyntax(invalidGherkin);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('createFeatureFiles', () => {
    beforeEach(async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      await specWriter.initialize(mockConfig);
      await specWriter.receiveTask(mockTask, mockContext);
    });

    it('should create feature files with proper naming', async () => {
      const bddSpecs = [
        {
          name: 'User Registration',
          content: `
Feature: User Registration
  Scenario: Successful registration
    Given I am on the registration page
    When I enter valid credentials
    Then I should be registered
          `
        }
      ];

      const featureFiles = await (specWriter as any).createFeatureFiles(bddSpecs);

      expect(featureFiles).toBeDefined();
      expect(featureFiles.length).toBe(1);
      expect(featureFiles[0].filename).toBe('user-registration.feature');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('user-registration.feature'),
        expect.stringContaining('Feature: User Registration'),
        'utf-8'
      );
    });

    it('should handle multiple feature files', async () => {
      const bddSpecs = [
        {
          name: 'User Registration',
          content: 'Feature: User Registration\nScenario: Test'
        },
        {
          name: 'User Login',
          content: 'Feature: User Login\nScenario: Test'
        }
      ];

      const featureFiles = await (specWriter as any).createFeatureFiles(bddSpecs);

      expect(featureFiles.length).toBe(2);
      expect(featureFiles[0].filename).toBe('user-registration.feature');
      expect(featureFiles[1].filename).toBe('user-login.feature');
    });
  });

  describe('extractNonFunctionalRequirements', () => {
    beforeEach(async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      await specWriter.initialize(mockConfig);
    });

    it('should extract security requirements', () => {
      const content = `
# Non-Functional Requirements

## Security Requirements
- Passwords must be at least 8 characters long
- All authentication endpoints must use HTTPS

## Performance Requirements
- Login should complete within 2 seconds
      `;

      const requirements = (specWriter as any).extractNonFunctionalRequirements(content);

      expect(requirements.security).toBeDefined();
      expect(requirements.security.length).toBe(2);
      expect(requirements.performance).toBeDefined();
      expect(requirements.performance.length).toBe(1);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      await specWriter.initialize(mockConfig);
      await specWriter.receiveTask(mockTask, mockContext);
    });

    it('should handle rate limiting from Gemini API', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      mockGenerateContent.mockRejectedValueOnce(rateLimitError);

      await expect(specWriter.executeTask()).rejects.toThrow('Failed to generate specifications');
    });

    it('should handle file system errors', async () => {
      const mockResponse = {
        response: {
          text: () => `
# User Stories
### User Story 1: Test Story
**As a** test user
**I want to** test
**So that** it works

# BDD Specifications
\`\`\`gherkin
Feature: Test Feature
  Scenario: Test scenario
    Given I am testing
    When I run the test
    Then it should work
\`\`\`
          `
        }
      };
      mockGenerateContent.mockResolvedValue(mockResponse);
      
      (fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>).mockImplementation(() => {
        throw new Error('File system error');
      });

      await expect(specWriter.executeTask()).rejects.toThrow('Failed to write feature file');
    });
  });

  describe('integration scenarios', () => {
    beforeEach(async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      await specWriter.initialize(mockConfig);
    });

    it('should handle complex task with multiple features', async () => {
      const complexTask = {
        ...mockTask,
        description: 'Create specifications for user management system including registration, login, password reset, and profile management'
      };

      await specWriter.receiveTask(complexTask, mockContext);

      const mockResponse = {
        response: {
          text: () => `
# User Stories
## User Registration
As a new user, I want to register...

## User Login  
As a registered user, I want to login...

# BDD Specifications
\`\`\`gherkin
Feature: User Registration
  Scenario: Successful registration
    Given I am on the registration page
    When I enter valid details
    Then I should be registered
\`\`\`

\`\`\`gherkin
Feature: User Login
  Scenario: Successful login
    Given I am on the login page
    When I enter valid credentials
    Then I should be logged in
\`\`\`

# Non-Functional Requirements
## Security Requirements
- Use HTTPS for all endpoints
## Performance Requirements  
- Response time under 2 seconds
          `
        }
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await specWriter.executeTask();

      expect(result).toBeDefined();
      expect(result.featureFiles.length).toBeGreaterThan(1);
    });
  });
});