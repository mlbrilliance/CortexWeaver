import { GuideAgent } from '../../src/agents/guide';
import { ClaudeClient, ClaudeModel } from '../../src/claude-client';
import { WorkspaceManager } from '../../src/workspace';
import { CognitiveCanvas } from '../../src/cognitive-canvas';
import { SessionManager } from '../../src/session';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock dependencies
jest.mock('../../src/claude-client');
jest.mock('../../src/workspace');
jest.mock('../../src/cognitive-canvas');
jest.mock('../../src/session');
jest.mock('@google/generative-ai');
jest.mock('fs');

describe('GuideAgent', () => {
  let guide: GuideAgent;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockWorkspace: jest.Mocked<WorkspaceManager>;
  let mockCognitiveCanvas: jest.Mocked<CognitiveCanvas>;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockGeminiClient: jest.Mocked<GoogleGenerativeAI>;
  let mockGeminiModel: any;

  const mockConfig = {
    id: 'guide-1',
    role: 'guide',
    capabilities: ['user-guidance', 'explanation', 'tutorial-creation', 'documentation'],
    claudeConfig: {
      apiKey: 'test-api-key',
      defaultModel: ClaudeModel.SONNET,
      maxTokens: 4000,
      temperature: 0.7
    },
    workspaceRoot: '/test/workspace',
    cognitiveCanvasConfig: {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'test'
    }
  };

  const mockTask = {
    id: 'task-1',
    title: 'Create User Guide',
    description: 'Create comprehensive user guide for new feature',
    projectId: 'project-1',
    status: 'assigned',
    priority: 'medium',
    dependencies: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockContext = {
    projectInfo: {
      name: 'Test Project',
      language: 'typescript',
      framework: 'react'
    },
    dependencies: ['react', 'typescript'],
    files: ['src/App.tsx', 'src/components/Button.tsx']
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    // Mock Gemini model
    mockGeminiModel = {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => 'Generated guide content with step-by-step instructions'
        }
      })
    };

    // Mock Gemini client
    mockGeminiClient = {
      getGenerativeModel: jest.fn().mockReturnValue(mockGeminiModel)
    } as any;

    (GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>).mockImplementation(() => mockGeminiClient);

    // Mock Claude client
    mockClaudeClient = {
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Guide analysis complete',
        tokenUsage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
        model: 'claude-3-sonnet-20240229'
      }),
      getConfiguration: jest.fn(),
      updateConfiguration: jest.fn(),
      sendMessageStream: jest.fn(),
      getTokenUsage: jest.fn(),
      resetTokenUsage: jest.fn(),
      setDefaultModel: jest.fn(),
      getAvailableModels: jest.fn()
    } as any;

    (ClaudeClient as jest.MockedClass<typeof ClaudeClient>).mockImplementation(() => mockClaudeClient);

    // Mock workspace
    mockWorkspace = {
      executeCommand: jest.fn().mockResolvedValue({
        stdout: 'Command executed successfully',
        stderr: '',
        exitCode: 0
      }),
      getWorktreePath: jest.fn().mockReturnValue('/test/workspace/task-1'),
      getProjectRoot: jest.fn().mockReturnValue('/test/workspace'),
      createWorktree: jest.fn(),
      removeWorktree: jest.fn(),
      listWorktrees: jest.fn(),
      commitChanges: jest.fn(),
      mergeToBranch: jest.fn(),
      getWorktreeStatus: jest.fn()
    } as any;

    (WorkspaceManager as jest.MockedClass<typeof WorkspaceManager>).mockImplementation(() => mockWorkspace);

    // Mock cognitive canvas
    mockCognitiveCanvas = {
      createPheromone: jest.fn().mockResolvedValue({
        id: 'pheromone-1',
        type: 'guide',
        strength: 0.8,
        context: 'guide_created',
        metadata: {},
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }),
      executeQuery: jest.fn().mockResolvedValue([]),
      getPheromonesByType: jest.fn().mockResolvedValue([])
    } as any;

    (CognitiveCanvas as jest.MockedClass<typeof CognitiveCanvas>).mockImplementation(() => mockCognitiveCanvas);

    // Mock session manager
    mockSessionManager = {} as any;
    (SessionManager as jest.MockedClass<typeof SessionManager>).mockImplementation(() => mockSessionManager);

    guide = new GuideAgent();
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await guide.initialize(mockConfig);
      expect(guide.getStatus()).toBe('initialized');
      expect(guide.getId()).toBe('guide-1');
      expect(guide.getRole()).toBe('guide');
    });

    it('should throw error if Gemini API key is missing', async () => {
      delete process.env.GEMINI_API_KEY;
      await expect(guide.initialize(mockConfig)).rejects.toThrow('Gemini API key is required');
    });

    it('should initialize Gemini client with correct model', async () => {
      await guide.initialize(mockConfig);
      expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-gemini-key');
      expect(mockGeminiClient.getGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-pro' });
    });
  });

  describe('executeTask', () => {
    beforeEach(async () => {
      await guide.initialize(mockConfig);
      await guide.receiveTask(mockTask, mockContext);
    });

    it('should execute guide creation task successfully', async () => {
      const result = await guide.executeTask();

      expect(result).toEqual({
        userGuide: expect.any(String),
        tutorialSteps: expect.any(Array),
        faqItems: expect.any(Array),
        troubleshootingGuide: expect.any(String),
        codeExamples: expect.any(Array),
        metadata: expect.objectContaining({
          totalSections: expect.any(Number),
          totalSteps: expect.any(Number),
          generatedAt: expect.any(String)
        })
      });
    });

    it('should throw error if no task is assigned', async () => {
      const emptyGuide = new GuideAgent();
      await emptyGuide.initialize(mockConfig);
      
      await expect(emptyGuide.executeTask()).rejects.toThrow('No task or context available');
    });

    it('should throw error if Gemini client is not initialized', async () => {
      const uninitializedGuide = new GuideAgent();
      await uninitializedGuide.receiveTask(mockTask, mockContext);
      
      await expect(uninitializedGuide.executeTask()).rejects.toThrow('Gemini client not initialized');
    });

    it('should generate guide with proper structure', async () => {
      mockGeminiModel.generateContent.mockResolvedValue({
        response: {
          text: () => `# User Guide

## Getting Started
Step 1: Install dependencies
Step 2: Configure settings

## FAQ
Q: How do I start?
A: Follow the getting started guide

## Troubleshooting
- Problem: App won't start
  Solution: Check configuration

## Code Examples
\`\`\`javascript
const app = new App();
\`\`\``
        }
      });

      const result = await guide.executeTask();

      expect(result.userGuide).toContain('User Guide');
      expect(result.tutorialSteps).toHaveLength(2);
      expect(result.faqItems).toHaveLength(1);
      expect(result.troubleshootingGuide).toContain('Problem');
      expect(result.codeExamples).toHaveLength(1);
    });

    it('should create guide files in workspace', async () => {
      const writeFileSpy = jest.spyOn(guide as any, 'writeFile').mockResolvedValue(undefined);
      
      await guide.executeTask();

      expect(writeFileSpy).toHaveBeenCalledWith(
        'USER_GUIDE.md',
        expect.stringContaining('User Guide')
      );
    });

    it('should report progress during execution', async () => {
      const reportProgressSpy = jest.spyOn(guide as any, 'reportProgress');
      
      await guide.executeTask();

      expect(reportProgressSpy).toHaveBeenCalledWith('started', 'Beginning guide generation');
      expect(reportProgressSpy).toHaveBeenCalledWith('completed', 'Guide generation completed');
    });

    it('should handle Gemini API errors gracefully', async () => {
      mockGeminiModel.generateContent.mockRejectedValue(new Error('Gemini API error'));
      
      await expect(guide.executeTask()).rejects.toThrow('Failed to generate guide');
    });
  });

  describe('getPromptTemplate', () => {
    it('should return comprehensive prompt template', () => {
      const template = guide.getPromptTemplate();
      
      expect(template).toContain('user-friendly guide');
      expect(template).toContain('{{taskDescription}}');
      expect(template).toContain('{{projectInfo}}');
      expect(template).toContain('step-by-step');
      expect(template).toContain('FAQ');
      expect(template).toContain('troubleshooting');
    });
  });

  describe('guide parsing', () => {
    beforeEach(async () => {
      await guide.initialize(mockConfig);
      await guide.receiveTask(mockTask, mockContext);
    });

    it('should parse tutorial steps correctly', () => {
      const content = `
## Getting Started
Step 1: Install dependencies
Step 2: Configure settings
Step 3: Run the application
`;
      const steps = (guide as any).parseTutorialSteps(content);
      expect(steps).toHaveLength(3);
      expect(steps[0].stepNumber).toBe(1);
      expect(steps[0].title).toBe('Install dependencies');
    });

    it('should parse FAQ items correctly', () => {
      const content = `
## FAQ
Q: How do I start?
A: Follow the getting started guide

Q: What if it doesn't work?
A: Check the troubleshooting section
`;
      const faqItems = (guide as any).parseFAQItems(content);
      expect(faqItems).toHaveLength(2);
      expect(faqItems[0].question).toBe('How do I start?');
      expect(faqItems[0].answer).toBe('Follow the getting started guide');
    });

    it('should extract code examples correctly', () => {
      const content = `
## Examples
\`\`\`javascript
const app = new App();
app.start();
\`\`\`

\`\`\`typescript
interface Config {
  port: number;
}
\`\`\`
`;
      const examples = (guide as any).extractCodeExamples(content);
      expect(examples).toHaveLength(2);
      expect(examples[0].language).toBe('javascript');
      expect(examples[0].code).toContain('const app = new App()');
    });

    it('should handle empty content gracefully', () => {
      const steps = (guide as any).parseTutorialSteps('');
      const faqItems = (guide as any).parseFAQItems('');
      const examples = (guide as any).extractCodeExamples('');

      expect(steps).toHaveLength(0);
      expect(faqItems).toHaveLength(0);
      expect(examples).toHaveLength(0);
    });
  });

  describe('guide storage', () => {
    beforeEach(async () => {
      await guide.initialize(mockConfig);
      await guide.receiveTask(mockTask, mockContext);
    });

    it('should store guide metadata in Cognitive Canvas via pheromone', async () => {
      await guide.executeTask();

      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'guide',
          context: 'guide_completed',
          metadata: expect.objectContaining({
            guideType: 'user_guide',
            title: expect.any(String),
            contentPreview: expect.any(String)
          })
        })
      );
    });

    it('should create appropriate pheromone', async () => {
      await guide.executeTask();

      expect(mockCognitiveCanvas.createPheromone).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'guide',
          strength: 0.8,
          context: 'guide_completed',
          metadata: expect.objectContaining({
            taskId: 'task-1',
            guideType: 'user_guide'
          })
        })
      );
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await guide.initialize(mockConfig);
      await guide.receiveTask(mockTask, mockContext);
    });

    it('should handle file writing errors', async () => {
      const writeFileSpy = jest.spyOn(guide as any, 'writeFile').mockRejectedValue(new Error('File write error'));
      
      await expect(guide.executeTask()).rejects.toThrow('Failed to create guide documentation');
    });

    it('should handle Cognitive Canvas storage errors gracefully', async () => {
      mockCognitiveCanvas.createPheromone.mockRejectedValue(new Error('Storage error'));
      
      // Should not throw, just warn
      const result = await guide.executeTask();
      expect(result).toBeDefined();
    });

    it('should validate task specification', async () => {
      const newGuide = new GuideAgent();
      await newGuide.initialize(mockConfig);
      
      const invalidTask = { ...mockTask, title: '', description: '' };
      await newGuide.receiveTask(invalidTask, mockContext);
      
      await expect(newGuide.executeTask()).rejects.toThrow('Invalid task specification');
    });
  });

  describe('configuration validation', () => {
    it('should validate required capabilities', async () => {
      const invalidConfig = {
        ...mockConfig,
        capabilities: ['wrong-capability']
      };
      
      await expect(guide.initialize(invalidConfig)).rejects.toThrow('Guide agent requires user-guidance capability');
    });
  });
});