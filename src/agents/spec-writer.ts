import { Agent, AgentConfig, TaskResult } from '../agent';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

export interface UserStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: 'high' | 'medium' | 'low';
  storyPoints?: number;
}

export interface BDDSpec {
  name: string;
  content: string;
  feature: string;
  scenarios: string[];
}

export interface FeatureFile {
  filename: string;
  path: string;
  content: string;
}

export interface NonFunctionalRequirements {
  security: string[];
  performance: string[];
  scalability: string[];
  usability: string[];
  reliability: string[];
  maintainability: string[];
}

export interface GherkinValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SpecificationResult {
  userStories: UserStory[];
  bddSpecs: BDDSpec[];
  featureFiles: FeatureFile[];
  nonFunctionalRequirements: NonFunctionalRequirements;
  validationResults: GherkinValidationResult[];
  metadata: {
    totalFeatures: number;
    totalScenarios: number;
    generatedAt: string;
  };
}

// SpecWriter agent for creating specifications, user stories, and BDD scenarios using Gemini API
export class SpecWriter extends Agent {
  private geminiClient: GoogleGenerativeAI | null = null;
  private geminiModel: GenerativeModel | null = null;

  // Initialize the SpecWriter agent with Gemini API configuration
  async initialize(config: AgentConfig): Promise<void> {
    await super.initialize(config);
    
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error('Gemini API key is required. Set GEMINI_API_KEY environment variable.');
    }

    this.geminiClient = new GoogleGenerativeAI(geminiApiKey);
    this.geminiModel = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
  }

  // Execute the specification writing task
  async executeTask(): Promise<SpecificationResult> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    if (!this.geminiModel) {
      throw new Error('Gemini client not initialized');
    }

    try {
      await this.reportProgress('analyzing', 'Analyzing task requirements');

      // Generate comprehensive specifications using Gemini
      const prompt = this.formatPrompt(this.getPromptTemplate(), {
        taskDescription: this.currentTask.description,
        taskTitle: this.currentTask.title,
        projectInfo: JSON.stringify(this.taskContext.projectInfo || {}),
        dependencies: JSON.stringify(this.taskContext.dependencies || []),
        files: JSON.stringify(this.taskContext.files || [])
      });

      await this.reportProgress('generating', 'Generating specifications with Gemini API');
      
      const response = await this.geminiModel.generateContent(prompt);
      const content = response.response.text();

      // Parse and structure the generated content
      const userStories = await this.parseUserStories(content);
      const bddSpecs = await this.parseBDDSpecs(content);
      const nonFunctionalRequirements = this.extractNonFunctionalRequirements(content);

      await this.reportProgress('validating', 'Validating Gherkin syntax');
      
      // Validate Gherkin syntax
      const validationResults = bddSpecs.map(spec => 
        this.validateGherkinSyntax(spec.content)
      );

      await this.reportProgress('creating-files', 'Creating feature files');
      
      // Create .feature files
      let featureFiles: FeatureFile[] = [];
      try {
        featureFiles = await this.createFeatureFiles(bddSpecs);
      } catch (error) {
        throw new Error(`Failed to write feature file: ${(error as Error).message}`);
      }

      const result: SpecificationResult = {
        userStories,
        bddSpecs,
        featureFiles,
        nonFunctionalRequirements,
        validationResults,
        metadata: {
          totalFeatures: bddSpecs.length,
          totalScenarios: bddSpecs.reduce((acc, spec) => acc + spec.scenarios.length, 0),
          generatedAt: new Date().toISOString()
        }
      };

      await this.reportProgress('completed', 'Specification generation completed');
      return result;

    } catch (error) {
      await this.reportProgress('error', `Failed to generate specifications: ${(error as Error).message}`);
      throw new Error(`Failed to generate specifications: ${(error as Error).message}`);
    }
  }

  // Get the prompt template for specification writing
  getPromptTemplate(): string {
    return `You are an expert specification writer and business analyst. Create comprehensive specifications for software features.

Task: {{taskTitle}}
Description: {{taskDescription}}
Project Info: {{projectInfo}}
Dependencies: {{dependencies}}
Files: {{files}}

Generate:
1. User Stories with As a/I want/So that format, acceptance criteria, priority, story points
2. BDD Specifications in Gherkin format with Feature/Scenario/Given/When/Then
3. Non-Functional Requirements for security, performance, scalability, usability, reliability, maintainability

Format:
# User Stories
### User Story 1: [Title]
**As a** [user] **I want to** [goal] **So that** [benefit]
**Acceptance Criteria:** - [criteria]
**Priority:** [high/medium/low] **Story Points:** [1-13]

# BDD Specifications
\`\`\`gherkin
Feature: [Name]
  Scenario: [Name]
    Given [state]
    When [action]
    Then [outcome]
\`\`\`

# Non-Functional Requirements
## Security Requirements
- [requirement]
## Performance Requirements  
- [requirement]
## Scalability Requirements
- [requirement]
## Usability Requirements
- [requirement]
## Reliability Requirements
- [requirement]
## Maintainability Requirements
- [requirement]

Make specifications clear, testable, complete, and properly formatted.`.trim();
  }

  // Generate user stories from task description
  private async generateUserStories(taskDescription: string): Promise<UserStory[]> {
    if (!this.geminiModel) throw new Error('Gemini model not initialized');
    const prompt = `Generate user stories for: ${taskDescription}\nFormat: ### User Story X: [Title]\n**As a** [user] **I want to** [goal] **So that** [benefit]\n**Acceptance Criteria:** - [criteria]\n**Priority:** [high/medium/low] **Story Points:** [1-13]`;
    const response = await this.geminiModel.generateContent(prompt);
    return this.parseUserStories(response.response.text());
  }

  // Generate BDD specifications from user stories
  private async generateBDDSpecs(userStory: string): Promise<string> {
    if (!this.geminiModel) throw new Error('Gemini model not initialized');
    const prompt = `Convert to BDD Gherkin: ${userStory}\nInclude Feature, Scenarios (happy path, edge cases, errors), Given-When-Then structure, tags.`;
    const response = await this.geminiModel.generateContent(prompt);
    return response.response.text();
  }

  // Parse user stories from generated content
  private parseUserStories(content: string): UserStory[] {
    const userStories: UserStory[] = [];
    const storyRegex = /### User Story \d+: (.+?)\n\*\*As a\*\* (.+?)\n\*\*I want to\*\* (.+?)\n\*\*So that\*\* (.+?)\n\n\*\*Acceptance Criteria:\*\*\n((?:- .+\n?)+)/g;
    
    let match;
    let index = 1;
    
    while ((match = storyRegex.exec(content)) !== null) {
      const [, title, userType, goal, benefit, criteriaText] = match;
      const acceptanceCriteria = criteriaText.split('\n')
        .filter(line => line.trim().startsWith('- '))
        .map(line => line.trim().substring(2));

      // Extract priority and story points if present
      const storySection = content.substring(match.index, match.index + match[0].length + 200);
      const priorityMatch = storySection.match(/\*\*Priority:\*\* (high|medium|low)/);
      const pointsMatch = storySection.match(/\*\*Story Points:\*\* (\d+)/);

      userStories.push({
        id: `story-${index}`,
        title: title.trim(),
        description: `As a ${userType}, I want to ${goal} so that ${benefit}`,
        acceptanceCriteria,
        priority: (priorityMatch?.[1] as 'high' | 'medium' | 'low') || 'medium',
        storyPoints: pointsMatch ? parseInt(pointsMatch[1]) : undefined
      });
      
      index++;
    }

    return userStories;
  }

  // Parse BDD specifications from generated content
  private async parseBDDSpecs(content: string): Promise<BDDSpec[]> {
    const bddSpecs: BDDSpec[] = [];
    const featureRegex = /```gherkin\n(Feature: .+?)\n```/gs;
    
    let match;
    while ((match = featureRegex.exec(content)) !== null) {
      const gherkinContent = match[1];
      const featureNameMatch = gherkinContent.match(/Feature: (.+)/);
      const featureName = featureNameMatch ? featureNameMatch[1].trim() : 'Unknown Feature';
      
      // Extract scenarios
      const scenarioRegex = /(?:Scenario|Scenario Outline): (.+)/g;
      const scenarios: string[] = [];
      let scenarioMatch;
      
      while ((scenarioMatch = scenarioRegex.exec(gherkinContent)) !== null) {
        scenarios.push(scenarioMatch[1].trim());
      }

      bddSpecs.push({
        name: featureName,
        content: gherkinContent,
        feature: featureName,
        scenarios
      });
    }

    return bddSpecs;
  }

  // Validate Gherkin syntax
  private validateGherkinSyntax(gherkinContent: string): GherkinValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required Feature keyword
    if (!gherkinContent.includes('Feature:')) {
      errors.push('Missing Feature keyword');
    }

    // Check for at least one scenario
    if (!gherkinContent.match(/(?:Scenario|Scenario Outline):/)) {
      errors.push('No scenarios found');
    }

    // Check for proper Given-When-Then structure
    const scenarioBlocks = gherkinContent.split(/(?:Scenario|Scenario Outline):/);
    for (let i = 1; i < scenarioBlocks.length; i++) {
      const scenario = scenarioBlocks[i];
      
      if (!scenario.includes('Given') && !scenario.includes('When') && !scenario.includes('Then')) {
        warnings.push(`Scenario ${i} may be missing Given-When-Then structure`);
      }
    }

    // Check for proper indentation (basic check)
    const lines = gherkinContent.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('Given') || line.trim().startsWith('When') || 
          line.trim().startsWith('Then') || line.trim().startsWith('And') || 
          line.trim().startsWith('But')) {
        if (!line.startsWith('    ') && !line.startsWith('\t')) {
          warnings.push('Step may not be properly indented');
          break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Create .feature files in the workspace
  private async createFeatureFiles(bddSpecs: BDDSpec[]): Promise<FeatureFile[]> {
    const featureFiles: FeatureFile[] = [];
    const featuresDir = path.resolve(this.config!.workspaceRoot, 'features');

    // Ensure features directory exists
    if (!fs.existsSync(featuresDir)) {
      fs.mkdirSync(featuresDir, { recursive: true });
    }

    for (const spec of bddSpecs) {
      try {
        // Generate filename from feature name
        const filename = spec.name.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '-') + '.feature';
        
        const filePath = path.join(featuresDir, filename);

        // Write feature file
        fs.writeFileSync(filePath, spec.content, 'utf-8');

        featureFiles.push({
          filename,
          path: filePath,
          content: spec.content
        });
      } catch (error) {
        throw new Error(`Failed to write feature file for ${spec.name}: ${(error as Error).message}`);
      }
    }

    return featureFiles;
  }

  // Extract non-functional requirements from generated content
  private extractNonFunctionalRequirements(content: string): NonFunctionalRequirements {
    const requirements: NonFunctionalRequirements = {
      security: [],
      performance: [],
      scalability: [],
      usability: [],
      reliability: [],
      maintainability: []
    };

    const sections = [
      { key: 'security', patterns: ['## Security Requirements', '## Security', '### Security'] },
      { key: 'performance', patterns: ['## Performance Requirements', '## Performance', '### Performance'] },
      { key: 'scalability', patterns: ['## Scalability Requirements', '## Scalability', '### Scalability'] },
      { key: 'usability', patterns: ['## Usability Requirements', '## Usability', '### Usability'] },
      { key: 'reliability', patterns: ['## Reliability Requirements', '## Reliability', '### Reliability'] },
      { key: 'maintainability', patterns: ['## Maintainability Requirements', '## Maintainability', '### Maintainability'] }
    ];

    for (const section of sections) {
      for (const pattern of section.patterns) {
        const regex = new RegExp(`${pattern}\\n((?:- .+\\n?)+)`, 'gi');
        const match = regex.exec(content);
        
        if (match) {
          const items = match[1].split('\n')
            .filter(line => line.trim().startsWith('- '))
            .map(line => line.trim().substring(2));
          
          (requirements as any)[section.key].push(...items);
        }
      }
    }

    return requirements;
  }
}