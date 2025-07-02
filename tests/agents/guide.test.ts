import { Guide, GuideRecommendation, LearningPath } from '../../src/agents/guide';
import { AgentConfig, TaskContext, TaskData } from '../../src/agent';
import { ClaudeModel } from '../../src/claude-client';
import { setupMocks, createMockAgentConfig, createMockTask, createMockContext, suppressConsoleWarnings } from '../test-utils';

describe('Guide', () => {
  let guide: Guide;
  let mockConfig: AgentConfig;
  let mockTask: TaskData;
  let mockContext: TaskContext;

  setupMocks();
  suppressConsoleWarnings();

  beforeEach(() => {
    mockConfig = createMockAgentConfig(
      'guide-1',
      'guide',
      ['guidance', 'mentoring', 'best-practices', 'learning-paths']
    );

    mockTask = createMockTask(
      'guide-task-1',
      'Provide development guidance',
      'Help developers with best practices and learning paths'
    );
    (mockTask as any).metadata = {
      projectType: 'web-application',
      techStack: ['typescript', 'react', 'node.js'],
      experience: 'intermediate'
    };

    mockContext = createMockContext({
      projectType: 'web-application',
      techStack: ['typescript', 'react', 'node.js'],
      currentPhase: 'development',
      experience: 'intermediate',
      goals: ['improve testing', 'optimize performance']
    });

    guide = new Guide();
  });

  describe('initialization', () => {
    it('should initialize with correct capabilities', () => {
      expect(guide.getCapabilities()).toEqual([]);
      expect(guide.getRole()).toBe('');
      expect(guide.getStatus()).toBe('uninitialized');
    });

    it('should initialize successfully with valid config', async () => {
      await guide.initialize(mockConfig);
      
      expect(guide.getId()).toBe('guide-1');
      expect(guide.getRole()).toBe('guide');
      expect(guide.getStatus()).toBe('initialized');
      expect(guide.getCapabilities()).toEqual([
        'guidance',
        'mentoring',
        'best-practices',
        'learning-paths'
      ]);
    });
  });

  describe('task execution', () => {
    beforeEach(async () => {
      await guide.initialize(mockConfig);
      await guide.receiveTask(mockTask, mockContext);
    });

    it('should accept a guidance task', async () => {
      expect(guide.getCurrentTask()).toEqual(mockTask);
      expect(guide.getTaskContext()).toEqual(mockContext);
      expect(guide.getStatus()).toBe('assigned');
    });

    it('should generate guidance recommendations', async () => {
      const mockRecommendations: GuideRecommendation[] = [
        {
          id: 'rec-1',
          title: 'Implement Unit Testing',
          description: 'Add comprehensive unit tests for your React components',
          category: 'testing',
          priority: 'high',
          complexity: 'moderate',
          estimatedTime: '2-3 days',
          prerequisites: ['Jest', 'React Testing Library'],
          resources: [
            {
              type: 'documentation',
              title: 'Jest Documentation',
              url: 'https://jestjs.io/docs',
              description: 'Official Jest testing framework documentation'
            }
          ],
          actionItems: [
            'Set up Jest configuration',
            'Write component tests',
            'Add coverage reporting'
          ]
        }
      ];

      jest.spyOn(guide as any, 'generateRecommendations').mockResolvedValue(mockRecommendations);

      const result = await guide.run();

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('recommendations');
      expect(guide.getStatus()).toBe('completed');
    });

    it('should handle guidance generation errors', async () => {
      jest.spyOn(guide as any, 'generateRecommendations').mockRejectedValue(new Error('Guidance generation failed'));

      await expect(guide.run()).rejects.toThrow('Guidance generation failed');
      expect(guide.getStatus()).toBe('error');
    });
  });

  describe('recommendation generation', () => {
    beforeEach(async () => {
      await guide.initialize(mockConfig);
      await guide.receiveTask(mockTask, mockContext);
    });

    it('should generate context-aware recommendations', async () => {
      const context = {
        projectType: 'web-application',
        techStack: ['typescript', 'react'],
        currentPhase: 'development',
        experience: 'intermediate',
        goals: ['improve testing']
      };

      const recommendations = await (guide as any).generateRecommendations(context);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toHaveProperty('title');
      expect(recommendations[0]).toHaveProperty('category');
    });

    it('should prioritize recommendations based on experience level', async () => {
      const beginnerContext = {
        projectType: 'web-application',
        experience: 'beginner',
        goals: ['learn basics']
      };

      const advancedContext = {
        projectType: 'web-application',
        experience: 'advanced',
        goals: ['optimize architecture']
      };

      const beginnerRecs = await (guide as any).generateRecommendations(beginnerContext);
      const advancedRecs = await (guide as any).generateRecommendations(advancedContext);

      expect(beginnerRecs[0].complexity).toBe('simple');
      expect(advancedRecs[0].complexity).toBe('complex');
    });
  });

  describe('learning path creation', () => {
    beforeEach(async () => {
      await guide.initialize(mockConfig);
    });

    it('should create learning paths for specific goals', async () => {
      const goals = ['learn testing', 'improve performance'];
      const experience = 'intermediate';

      const learningPath: LearningPath = await (guide as any).createLearningPath(goals, experience);

      expect(learningPath.title).toBeDefined();
      expect(learningPath.difficulty).toBe('intermediate');
      expect(learningPath.modules.length).toBeGreaterThan(0);
      expect(learningPath.outcomes.length).toBeGreaterThan(0);
    });

    it('should customize learning paths by tech stack', async () => {
      const techStack = ['react', 'typescript'];
      const path = await (guide as any).createTechStackLearningPath(techStack);

      expect(path.title).toContain('React');
      expect(path.modules.some((m: any) => m.title.includes('TypeScript'))).toBe(true);
    });
  });

  describe('resource management', () => {
    beforeEach(async () => {
      await guide.initialize(mockConfig);
    });

    it('should curate resources by category', async () => {
      const category = 'testing';
      const resources = await (guide as any).curateResources(category);

      expect(Array.isArray(resources)).toBe(true);
      expect(resources.every((r: any) => r.type && r.title && r.description)).toBe(true);
    });

    it('should filter resources by experience level', async () => {
      const beginnerResources = await (guide as any).filterResourcesByExperience('beginner');
      const advancedResources = await (guide as any).filterResourcesByExperience('advanced');

      expect(beginnerResources.length).toBeGreaterThan(0);
      expect(advancedResources.length).toBeGreaterThan(0);
      // Resources should be different for different experience levels
      expect(beginnerResources[0].title).not.toBe(advancedResources[0].title);
    });
  });

  describe('guidance personalization', () => {
    beforeEach(async () => {
      await guide.initialize(mockConfig);
    });

    it('should personalize guidance based on project context', async () => {
      const webAppContext = { projectType: 'web-application', techStack: ['react'] };
      const mobileContext = { projectType: 'mobile-app', techStack: ['react-native'] };

      const webGuidance = await (guide as any).personalizeGuidance(webAppContext);
      const mobileGuidance = await (guide as any).personalizeGuidance(mobileContext);

      expect(webGuidance.focus).toContain('web');
      expect(mobileGuidance.focus).toContain('mobile');
    });

    it('should adapt recommendations to current project phase', async () => {
      const designPhase = { currentPhase: 'design' };
      const testingPhase = { currentPhase: 'testing' };

      const designGuidance = await (guide as any).getPhaseSpecificGuidance(designPhase);
      const testingGuidance = await (guide as any).getPhaseSpecificGuidance(testingPhase);

      expect(designGuidance.recommendations[0].category).toBe('architecture');
      expect(testingGuidance.recommendations[0].category).toBe('testing');
    });
  });
});