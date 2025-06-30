import { PlanParser, ParsedPlan, Feature, ArchitectureDecision, QualityStandard } from '../src/plan-parser';

describe('PlanParser', () => {
  let parser: PlanParser;

  beforeEach(() => {
    parser = new PlanParser();
  });

  const validPlan = `# Project Plan

## Overview
This is a test project for demonstrating the plan parser functionality.

## Features

### Feature 1: Authentication System
- **Priority**: High
- **Description**: Implement user authentication with JWT tokens
- **Dependencies**: []
- **Agent**: Architect
- **Acceptance Criteria**:
  - [ ] User registration endpoint
  - [ ] User login endpoint
  - [ ] JWT token validation middleware

#### Microtasks:
- [ ] Design authentication architecture
- [ ] Implement user model
- [ ] Create endpoints

### Feature 2: User Dashboard
- **Priority**: Medium
- **Description**: Create user dashboard
- **Dependencies**: [Feature 1]
- **Agent**: Coder
- **Acceptance Criteria**:
  - [ ] User profile display
  - [ ] Profile editing

#### Microtasks:
- [ ] Design dashboard UI
- [ ] Implement API

## Architecture Decisions

### Technology Stack
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Frontend**: React

### Quality Standards
- **Test Coverage**: Minimum 80%
- **Code Style**: ESLint + Prettier
`;

  describe('Valid plan parsing', () => {
    test('should parse a complete valid plan.md', () => {
      const result = parser.parse(validPlan);

      expect(result.overview).toBe('This is a test project for demonstrating the plan parser functionality.');
      expect(result.features).toHaveLength(2);
      
      const authFeature = result.features[0];
      expect(authFeature.name).toBe('Authentication System');
      expect(authFeature.priority).toBe('High');
      expect(authFeature.description).toBe('Implement user authentication with JWT tokens');
      expect(authFeature.dependencies).toEqual([]);
      expect(authFeature.agent).toBe('Architect');
      expect(authFeature.acceptanceCriteria).toHaveLength(3);
      expect(authFeature.microtasks).toHaveLength(3);

      const dashboardFeature = result.features[1];
      expect(dashboardFeature.dependencies).toEqual(['Feature 1']);
      
      expect(result.architectureDecisions.technologyStack).toHaveProperty('Backend');
      expect(result.architectureDecisions.qualityStandards).toHaveProperty('Test Coverage');
    });

    test('should handle features with complex dependencies', () => {
      const planContent = `# Project Plan
## Overview
Test overview for complex dependencies
## Features
### Feature A: Base System
- **Priority**: High
- **Description**: Base system
- **Dependencies**: []
- **Agent**: Architect
#### Microtasks:
- [ ] Task A1

### Feature B: Module 1
- **Priority**: Medium
- **Description**: Module 1
- **Dependencies**: [Feature A]
- **Agent**: Coder
#### Microtasks:
- [ ] Task B1

### Feature C: Module 2
- **Priority**: Low
- **Description**: Module 2
- **Dependencies**: [Feature A, Feature B]
- **Agent**: Tester
#### Microtasks:
- [ ] Task C1
`;

      const result = parser.parse(planContent);
      
      expect(result.features).toHaveLength(3);
      expect(result.features[2].dependencies).toEqual(['Feature A', 'Feature B']);
    });
  });

  describe('Invalid markdown handling', () => {
    test('should throw error for missing sections', () => {
      expect(() => parser.parse('## Overview\nNo title here')).toThrow('Missing project title');
      expect(() => parser.parse('# Project Plan\n## Features\nSome features')).toThrow('Missing overview section');
      expect(() => parser.parse('# Project Plan\n## Overview\nThis is the overview')).toThrow('Missing features section');
    });

    test('should handle malformed markdown gracefully', () => {
      const malformed = `# Project Plan
## Overview
Test overview
## Features
### Malformed Feature
- **Priority**: High
- **Description**: 
- **Dependencies**: []
- **Agent**: Architect
#### Microtasks:
- [ ] Malformed task
`;
      expect(() => parser.parse(malformed)).toThrow('Description cannot be empty');
    });
  });

  describe('Feature validation', () => {
    test('should validate required feature fields', () => {
      const planContent = `# Project Plan
## Overview
Test
## Features
### Feature 1: Test Feature
- **Priority**: High
- **Description**: Test description
- **Agent**: Architect
#### Microtasks:
- [ ] Task 1
`;

      const result = parser.parse(planContent);
      expect(result.features[0].dependencies).toEqual([]);
    });

    test('should throw error for missing required fields and invalid values', () => {
      const missingField = `# Project Plan
## Overview
Test
## Features
### Feature 1: Test Feature
- **Description**: Test description
`;
      expect(() => parser.parse(missingField)).toThrow('Missing required field: Priority');

      const invalidPriority = `# Project Plan
## Overview
Test
## Features
### Feature 1: Test Feature
- **Priority**: Invalid
- **Description**: Test description
- **Dependencies**: []
- **Agent**: Architect
#### Microtasks:
- [ ] Task 1
`;
      expect(() => parser.parse(invalidPriority)).toThrow('Invalid priority value: Invalid');

      const invalidAgent = `# Project Plan
## Overview
Test
## Features
### Feature 1: Test Feature
- **Priority**: High
- **Description**: Test description
- **Dependencies**: []
- **Agent**: InvalidAgent
#### Microtasks:
- [ ] Task 1
`;
      expect(() => parser.parse(invalidAgent)).toThrow('Invalid agent: InvalidAgent');
    });
  });

  describe('Dependency resolution', () => {
    test('should detect circular dependencies', () => {
      const circular = `# Project Plan
## Overview
Test
## Features
### Feature A: First
- **Priority**: High
- **Description**: First feature
- **Dependencies**: [Feature B]
- **Agent**: Architect
#### Microtasks:
- [ ] Task A

### Feature B: Second
- **Priority**: High
- **Description**: Second feature
- **Dependencies**: [Feature A]
- **Agent**: Coder
#### Microtasks:
- [ ] Task B
`;
      expect(() => parser.parse(circular)).toThrow('Circular dependency detected');
    });

    test('should detect complex circular dependencies', () => {
      const complexCircular = `# Project Plan
## Overview
Test
## Features
### Feature A: First
- **Priority**: High
- **Description**: First
- **Dependencies**: [Feature C]
- **Agent**: Architect
#### Microtasks:
- [ ] Task A

### Feature B: Second
- **Priority**: High
- **Description**: Second
- **Dependencies**: [Feature A]
- **Agent**: Coder
#### Microtasks:
- [ ] Task B

### Feature C: Third
- **Priority**: High
- **Description**: Third
- **Dependencies**: [Feature B]
- **Agent**: Tester
#### Microtasks:
- [ ] Task C
`;
      expect(() => parser.parse(complexCircular)).toThrow('Circular dependency detected');
    });

    test('should validate dependency references exist', () => {
      const invalidDep = `# Project Plan
## Overview
Test
## Features
### Feature A: First
- **Priority**: High
- **Description**: First
- **Dependencies**: [Feature B, Feature C]
- **Agent**: Architect
#### Microtasks:
- [ ] Task A
`;
      expect(() => parser.parse(invalidDep)).toThrow('Dependency not found: Feature B');
    });
  });

  describe('Architecture decisions parsing', () => {
    test('should parse technology stack and quality standards correctly', () => {
      const planContent = `# Project Plan
## Overview
Test
## Features
### Feature 1: Test
- **Priority**: High
- **Description**: Test
- **Dependencies**: []
- **Agent**: Architect
#### Microtasks:
- [ ] Task 1

## Architecture Decisions
### Technology Stack
- **Backend**: Node.js with Express
- **Database**: PostgreSQL with TypeORM
- **Frontend**: React with TypeScript
- **Testing**: Jest

### Quality Standards
- **Test Coverage**: Minimum 80%
- **Code Style**: ESLint + Prettier
- **Performance**: API responses < 200ms p95
`;

      const result = parser.parse(planContent);
      
      expect(result.architectureDecisions.technologyStack).toEqual({
        'Backend': 'Node.js with Express',
        'Database': 'PostgreSQL with TypeORM',
        'Frontend': 'React with TypeScript',
        'Testing': 'Jest'
      });
      
      expect(result.architectureDecisions.qualityStandards).toEqual({
        'Test Coverage': 'Minimum 80%',
        'Code Style': 'ESLint + Prettier',
        'Performance': 'API responses < 200ms p95'
      });
    });
  });

  describe('Edge cases and complex structures', () => {
    test('should handle features with no acceptance criteria or microtasks', () => {
      const noAcceptance = `# Project Plan
## Overview
Test
## Features
### Feature 1: Test
- **Priority**: High
- **Description**: Test feature
- **Dependencies**: []
- **Agent**: Architect
#### Microtasks:
- [ ] Task 1
- [ ] Task 2
`;

      const noMicrotasks = `# Project Plan
## Overview
Test
## Features
### Feature 1: Test
- **Priority**: High
- **Description**: Test feature
- **Dependencies**: []
- **Agent**: Architect
- **Acceptance Criteria**:
  - [ ] Criteria 1
  - [ ] Criteria 2
`;

      const result1 = parser.parse(noAcceptance);
      expect(result1.features[0].acceptanceCriteria).toEqual([]);
      expect(result1.features[0].microtasks).toHaveLength(2);

      const result2 = parser.parse(noMicrotasks);
      expect(result2.features[0].microtasks).toEqual([]);
      expect(result2.features[0].acceptanceCriteria).toHaveLength(2);
    });

    test('should handle empty dependency arrays and whitespace variations', () => {
      const formatted = `# Project Plan
## Overview
  Test with extra spaces  
## Features
### Feature 1: Test Feature  
-   **Priority**:   High  
-   **Description**:   Test description with spaces  
-   **Dependencies**:   []  
-   **Agent**:   Architect  
#### Microtasks:
-   [ ]   Task with spaces  
`;

      const result = parser.parse(formatted);
      expect(result.overview).toBe('Test with extra spaces');
      expect(result.features[0].name).toBe('Test Feature');
      expect(result.features[0].priority).toBe('High');
      expect(result.features[0].dependencies).toEqual([]);
      expect(result.features[0].microtasks[0]).toBe('Task with spaces');
    });

    test('should parse dependency resolution order correctly', () => {
      const unordered = `# Project Plan
## Overview
Test
## Features
### Feature C: Third
- **Priority**: Low
- **Description**: Third feature
- **Dependencies**: [Feature A, Feature B]
- **Agent**: Tester
#### Microtasks:
- [ ] Task C

### Feature A: First
- **Priority**: High
- **Description**: First feature
- **Dependencies**: []
- **Agent**: Architect
#### Microtasks:
- [ ] Task A

### Feature B: Second
- **Priority**: Medium
- **Description**: Second feature
- **Dependencies**: [Feature A]
- **Agent**: Coder
#### Microtasks:
- [ ] Task B
`;

      const result = parser.parse(unordered);
      expect(result.features).toHaveLength(3);
      
      // Verify dependencies are correctly parsed regardless of order
      const featureC = result.features.find(f => f.description === 'Third feature');
      expect(featureC?.dependencies).toEqual(['Feature A', 'Feature B']);
    });
  });

  describe('getDependencyOrder', () => {
    test('should return features in correct dependency order', () => {
      const result = parser.parse(validPlan);
      const orderedFeatures = parser.getDependencyOrder(result.features);
      
      expect(orderedFeatures.map(f => f.name)).toEqual(['Authentication System', 'User Dashboard']);
    });
  });

  describe('validatePlan', () => {
    test('should validate complete plan structure', () => {
      const result = parser.parse(validPlan);
      expect(() => parser.validatePlan(result)).not.toThrow();
    });
  });
});