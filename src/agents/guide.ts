import { Agent, AgentConfig } from '../agent';

export interface GuideContext {
  projectType: string;
  techStack: string[];
  currentPhase: string;
  experience: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
}

export interface GuideRecommendation {
  id: string;
  title: string;
  description: string;
  category: 'architecture' | 'testing' | 'performance' | 'security' | 'best-practices';
  priority: 'low' | 'medium' | 'high' | 'critical';
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedTime: string;
  prerequisites: string[];
  resources: GuideResource[];
  actionItems: string[];
}

export interface GuideResource {
  type: 'documentation' | 'tutorial' | 'example' | 'tool' | 'article';
  title: string;
  url?: string;
  description: string;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  duration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  modules: LearningModule[];
  outcomes: string[];
}

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  topics: string[];
  exercises: string[];
  resources: GuideResource[];
}

export interface ProjectGuidance {
  phase: string;
  recommendations: GuideRecommendation[];
  nextSteps: string[];
  learningPaths: LearningPath[];
  warnings: string[];
  tips: string[];
}

export class Guide extends Agent {
  private knowledgeBase: Map<string, any> = new Map();
  private userPreferences: GuideContext | null = null;

  async initialize(config: AgentConfig): Promise<void> {
    await super.initialize(config);
    if (!config.capabilities.includes('guidance')) {
      throw new Error('Guide agent requires guidance capability');
    }
    await this.loadKnowledgeBase();
  }

  getPromptTemplate(): string {
    return `Development Guide Agent: Provide intelligent guidance, recommendations, and learning paths for software development projects. Adapt advice to user experience level and project context. Context: {{context}}, Phase: {{phase}}, Goals: {{goals}}.`;
  }

  async executeTask(): Promise<ProjectGuidance> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    await this.reportProgress('started', 'Analyzing project for guidance recommendations');

    try {
      const context = this.parseGuideContext();
      const guidance = await this.generateProjectGuidance(context);
      
      await this.updateUserPreferences(context);
      await this.reportProgress('completed', `Generated ${guidance.recommendations.length} recommendations and ${guidance.learningPaths.length} learning paths`);
      
      return guidance;
    } catch (error) {
      await this.reportProgress('failed', `Guidance generation failed: ${(error as Error).message}`);
      throw error;
    }
  }

  async generateRecommendations(context: GuideContext): Promise<GuideRecommendation[]> {
    const promptContext = {
      context: JSON.stringify(context),
      phase: context.currentPhase,
      goals: JSON.stringify(context.goals)
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

PROJECT CONTEXT:
${JSON.stringify(context, null, 2)}

Generate targeted recommendations including:
1. Architecture and design guidance
2. Testing strategies and best practices
3. Performance optimization opportunities
4. Security considerations and implementations
5. Development workflow improvements
6. Code quality and maintainability advice

Tailor recommendations to ${context.experience} level developers working on ${context.projectType} projects.
Return structured recommendations with priorities, complexity, and actionable steps.`;

    const response = await this.sendToClaude(prompt);
    return this.parseRecommendations(response.content);
  }

  async createLearningPath(topic: string, currentLevel: string, targetLevel: string): Promise<LearningPath> {
    const promptContext = {
      context: topic,
      phase: currentLevel,
      goals: JSON.stringify([targetLevel])
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

LEARNING REQUEST:
Topic: ${topic}
Current Level: ${currentLevel}
Target Level: ${targetLevel}

Create a structured learning path including:
1. Progressive learning modules
2. Practical exercises and projects
3. Recommended resources and materials
4. Timeline and milestones
5. Assessment criteria and outcomes

Design for practical skill development with hands-on experience.`;

    const response = await this.sendToClaude(prompt);
    return this.parseLearningPath(response.content);
  }

  async assessProjectHealth(projectData: any): Promise<{ score: number; areas: string[]; recommendations: string[]; }> {
    const promptContext = {
      context: JSON.stringify(projectData),
      phase: 'assessment',
      goals: JSON.stringify(['health-check'])
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

PROJECT DATA:
${JSON.stringify(projectData, null, 2)}

Assess project health across:
1. Code quality and maintainability
2. Test coverage and reliability
3. Performance and scalability
4. Security and compliance
5. Documentation and knowledge sharing
6. Team practices and workflows

Provide health score (0-100) and specific improvement recommendations.`;

    const response = await this.sendToClaude(prompt);
    return this.parseHealthAssessment(response.content);
  }

  async suggestNextSteps(currentState: any, goals: string[]): Promise<string[]> {
    const promptContext = {
      context: JSON.stringify(currentState),
      phase: 'planning',
      goals: JSON.stringify(goals)
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

CURRENT STATE:
${JSON.stringify(currentState, null, 2)}

PROJECT GOALS:
${JSON.stringify(goals, null, 2)}

Suggest immediate next steps prioritized by:
1. Impact on project goals
2. Risk mitigation and blockers
3. Resource requirements and dependencies
4. Timeline and deliverable alignment

Return actionable next steps with clear priorities and reasoning.`;

    const response = await this.sendToClaude(prompt);
    return this.parseNextSteps(response.content);
  }

  private async loadKnowledgeBase(): Promise<void> {
    const defaultKnowledge = {
      'react': { type: 'framework', category: 'frontend', complexity: 'moderate' },
      'node.js': { type: 'runtime', category: 'backend', complexity: 'moderate' },
      'typescript': { type: 'language', category: 'full-stack', complexity: 'moderate' },
      'testing': { patterns: ['unit', 'integration', 'e2e'], tools: ['jest', 'cypress'] },
      'performance': { metrics: ['latency', 'throughput', 'memory'], tools: ['lighthouse', 'profiler'] }
    };

    for (const [key, value] of Object.entries(defaultKnowledge)) {
      this.knowledgeBase.set(key, value);
    }
  }

  private parseGuideContext(): GuideContext {
    const context = this.taskContext?.context;
    if (!context) {
      throw new Error('No guidance context provided');
    }

    return {
      projectType: context.projectType || 'web-application',
      techStack: context.techStack || ['javascript'],
      currentPhase: context.currentPhase || 'development',
      experience: context.experience || 'intermediate',
      goals: context.goals || ['build-quality-software']
    };
  }

  private async generateProjectGuidance(context: GuideContext): Promise<ProjectGuidance> {
    const recommendations = await this.generateRecommendations(context);
    const nextSteps = await this.suggestNextSteps(context, context.goals);
    const learningPaths = await this.generateRelevantLearningPaths(context);
    
    return {
      phase: context.currentPhase,
      recommendations,
      nextSteps,
      learningPaths,
      warnings: this.generateWarnings(context),
      tips: this.generateTips(context)
    };
  }

  private async generateRelevantLearningPaths(context: GuideContext): Promise<LearningPath[]> {
    const paths: LearningPath[] = [];
    
    for (const tech of context.techStack.slice(0, 3)) {
      try {
        const path = await this.createLearningPath(tech, context.experience, 'advanced');
        paths.push(path);
      } catch (error) {
        console.warn(`Failed to generate learning path for ${tech}`);
      }
    }
    
    return paths;
  }

  private generateWarnings(context: GuideContext): string[] {
    const warnings: string[] = [];
    
    if (context.experience === 'beginner' && context.techStack.length > 3) {
      warnings.push('Consider focusing on fewer technologies to avoid overwhelming complexity');
    }
    
    if (context.currentPhase === 'production' && !context.techStack.includes('testing')) {
      warnings.push('Production deployment without adequate testing strategy detected');
    }
    
    return warnings;
  }

  private generateTips(context: GuideContext): string[] {
    const tips: string[] = [];
    
    if (context.experience === 'beginner') {
      tips.push('Start with small, incremental changes to build confidence');
      tips.push('Focus on understanding core concepts before exploring advanced features');
    }
    
    if (context.currentPhase === 'development') {
      tips.push('Implement testing early in the development cycle');
      tips.push('Use version control with meaningful commit messages');
    }
    
    return tips;
  }

  private async updateUserPreferences(context: GuideContext): Promise<void> {
    this.userPreferences = context;
  }

  private parseRecommendations(content: string): GuideRecommendation[] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return result.recommendations || [];
      }
    } catch (error) {
      console.warn('Failed to parse recommendations');
    }

    return [{
      id: 'rec-1',
      title: 'Follow Development Best Practices',
      description: 'Implement standard development practices for code quality',
      category: 'best-practices',
      priority: 'medium',
      complexity: 'moderate',
      estimatedTime: '1-2 weeks',
      prerequisites: ['basic programming knowledge'],
      resources: [{ type: 'documentation', title: 'Development Guidelines', description: 'Standard development practices' }],
      actionItems: ['Set up linting', 'Implement code reviews', 'Write documentation']
    }];
  }

  private parseLearningPath(content: string): LearningPath {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const path = JSON.parse(jsonMatch[0]);
        return {
          id: path.id || 'path-1',
          title: path.title || 'Learning Path',
          description: path.description || 'Structured learning progression',
          duration: path.duration || '4-6 weeks',
          difficulty: path.difficulty || 'intermediate',
          prerequisites: path.prerequisites || [],
          modules: path.modules || [],
          outcomes: path.outcomes || ['Improved skills and knowledge']
        };
      }
    } catch (error) {
      console.warn('Failed to parse learning path');
    }

    return {
      id: 'path-1',
      title: 'General Learning Path',
      description: 'Structured approach to skill development',
      duration: '4-6 weeks',
      difficulty: 'intermediate',
      prerequisites: [],
      modules: [],
      outcomes: ['Enhanced development skills']
    };
  }

  private parseHealthAssessment(content: string): { score: number; areas: string[]; recommendations: string[]; } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const assessment = JSON.parse(jsonMatch[0]);
        return {
          score: assessment.score || 75,
          areas: assessment.areas || ['code quality', 'testing', 'documentation'],
          recommendations: assessment.recommendations || ['Improve test coverage', 'Add documentation']
        };
      }
    } catch (error) {
      console.warn('Failed to parse health assessment');
    }

    return {
      score: 75,
      areas: ['general improvement needed'],
      recommendations: ['Follow development best practices']
    };
  }

  private parseNextSteps(content: string): string[] {
    const lines = content.split('\n');
    const steps: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && (trimmed.match(/^\d+\.|\-|\*/) || trimmed.toLowerCase().includes('step'))) {
        steps.push(trimmed.replace(/^\d+\.\s*|\-\s*|\*\s*/, ''));
      }
    }

    return steps.length > 0 ? steps : ['Continue with current development approach'];
  }
}