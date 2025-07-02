import * as fs from 'fs';
import * as path from 'path';

/**
 * PrototypeTemplates handles the creation of prototype directories and templates
 */
export class PrototypeTemplates {
  
  static async createPrototypesDirectory(projectRoot: string): Promise<void> {
    const prototypesPath = path.join(projectRoot, 'prototypes');
    
    // Create main prototypes directory and subdirectories
    const prototypeDirs = [
      prototypesPath,
      path.join(prototypesPath, 'features'),
      path.join(prototypesPath, 'experiments'),
      path.join(prototypesPath, 'proofs-of-concept'),
      path.join(prototypesPath, 'spike-solutions'),
      path.join(prototypesPath, 'technical-demos'),
      path.join(prototypesPath, 'ui-mockups'),
      path.join(prototypesPath, 'data-models'),
      path.join(prototypesPath, 'algorithms')
    ];

    prototypeDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Create README.md for prototypes directory
    await this.createPrototypesReadme(prototypesPath);

    // Create example prototype files
    await this.createPrototypeTemplates(prototypesPath);
  }

  static async createPrototypesReadme(prototypesPath: string): Promise<void> {
    const readmePath = path.join(prototypesPath, 'README.md');
    
    if (fs.existsSync(readmePath)) {
      return; // Don't overwrite existing README
    }

    const readmeContent = `# CortexWeaver Prototypes Directory

This directory contains rapid prototypes, experiments, and proof-of-concept implementations for your CortexWeaver project. The prototyping phase allows for quick exploration of technical feasibility and design alternatives before formal contract creation.

## Purpose

The \`/prototypes\` directory serves several key purposes in the CortexWeaver development workflow:

- **Rapid Experimentation**: Test new ideas and approaches quickly
- **Technical Feasibility**: Validate technical assumptions before formal development
- **Design Exploration**: Explore different architectural and UI/UX approaches
- **Risk Mitigation**: Identify potential issues early in the development process
- **Proof of Concept**: Demonstrate core functionality to stakeholders

## Directory Structure

\`\`\`
prototypes/
├── README.md                  # This file - explains the prototyping system
├── features/                  # Feature prototypes and early implementations
├── experiments/               # Experimental code and research implementations
├── proofs-of-concept/        # POCs for core system functionality
├── spike-solutions/          # Time-boxed investigation solutions
├── technical-demos/          # Demonstrations of technical capabilities
├── ui-mockups/              # User interface prototypes and mockups
├── data-models/             # Data structure and database prototypes
└── algorithms/              # Algorithm implementations and testing
\`\`\`

## Workflow Integration

### 1. Pre-Contract Prototyping
- Create prototypes to explore technical solutions
- Test assumptions before writing formal contracts
- Validate performance and scalability concerns

### 2. Agent-Driven Prototyping
- **Prototyper Agent**: Creates initial implementations
- **Architect Agent**: Reviews and refines prototypes
- **Coder Agent**: Extracts patterns for formal implementation

### 3. Prototype to Production
- Successful prototypes inform contract specifications
- Validated approaches guide formal architecture decisions
- Lessons learned improve development velocity

## Best Practices

### Prototype Guidelines
- Keep prototypes simple and focused
- Document assumptions and limitations
- Time-box prototype development (spike solutions)
- Include README files explaining the prototype purpose

### Quality Standards
- Prototypes should be functional but not production-ready
- Focus on proving concepts, not code quality
- Include basic tests for core functionality
- Document what works and what doesn't

### Transitioning to Formal Development
- Extract successful patterns into formal contracts
- Document lessons learned in the main project plan
- Archive or clean up unsuccessful prototypes
- Use prototype insights to inform architecture decisions

## Getting Started

1. **Choose a subdirectory** based on your prototype type
2. **Create a focused prototype** that tests a specific assumption
3. **Document your findings** in the prototype's README
4. **Share results** with the development team
5. **Extract successful patterns** for formal implementation

See the template files in each subdirectory for examples and guidance.

---

*This directory is automatically created by \`cortex-weaver init\` and populated by CortexWeaver's prototyping agents.*`;

    fs.writeFileSync(readmePath, readmeContent);
  }

  static async createPrototypeTemplates(prototypesPath: string): Promise<void> {
    // Create feature prototype template
    const featureTemplatePath = path.join(prototypesPath, 'features', 'example-feature.md');
    if (!fs.existsSync(featureTemplatePath)) {
      const featureTemplate = `# Example Feature Prototype

## Overview
Brief description of the feature being prototyped.

## Goals
- Primary goal of this prototype
- Specific questions to answer
- Assumptions to validate

## Implementation Notes
- Key technologies used
- Important design decisions
- Known limitations

## Results
- What worked well
- What didn't work
- Lessons learned
- Next steps

## Files
- \`feature-impl.js\` - Core implementation
- \`feature-test.js\` - Basic tests
- \`feature-demo.html\` - Visual demonstration

---
*Created: ${new Date().toISOString()}*
*Status: In Progress*`;

      fs.writeFileSync(featureTemplatePath, featureTemplate);
    }

    // Create experiment template
    const experimentTemplatePath = path.join(prototypesPath, 'experiments', 'example-experiment.md');
    if (!fs.existsSync(experimentTemplatePath)) {
      const experimentTemplate = `# Example Experiment

## Hypothesis
What we believe to be true and want to test.

## Experiment Design
- Independent variables
- Dependent variables
- Control conditions
- Success criteria

## Implementation
Brief description of the experimental setup.

## Data Collection
- Metrics to measure
- Data collection methods
- Duration of experiment

## Results
- Quantitative results
- Qualitative observations
- Statistical significance
- Conclusion

## Next Steps
- Follow-up experiments
- Implementation recommendations
- Further research needed

---
*Created: ${new Date().toISOString()}*
*Status: Planning*`;

      fs.writeFileSync(experimentTemplatePath, experimentTemplate);
    }

    // Create proof-of-concept template
    const pocTemplatePath = path.join(prototypesPath, 'proofs-of-concept', 'example-poc.md');
    if (!fs.existsSync(pocTemplatePath)) {
      const pocTemplate = `# Example Proof of Concept

## Objective
Clear statement of what this POC aims to prove or demonstrate.

## Success Criteria
- Specific, measurable criteria for success
- Performance benchmarks
- Functional requirements

## Technical Approach
- Architecture overview
- Key technologies and libraries
- Implementation strategy

## Assumptions
- Technical assumptions being tested
- Known limitations and constraints
- Risk factors

## Implementation
Brief description of the POC implementation.

## Results
- Functional test results
- Performance measurements
- Lessons learned

## Production Readiness
- Scaling considerations
- Security implications
- Additional work needed

---
*Created: ${new Date().toISOString()}*
*Status: Concept*`;

      fs.writeFileSync(pocTemplatePath, pocTemplate);
    }

    // Create spike solution template
    const spikeTemplatePath = path.join(prototypesPath, 'spike-solutions', 'example-spike.md');
    if (!fs.existsSync(spikeTemplatePath)) {
      const spikeTemplate = `# Example Spike Solution

## Research Question
What specific question does this spike aim to answer?

## Time Box
- Start date: ${new Date().toDateString()}
- Duration: 2-4 hours
- End date: [Set deadline]

## Investigation Scope
- Specific areas to investigate
- Technologies to evaluate
- Questions to answer
- Out of scope items

## Approach
- Research methodology
- Experiments to conduct
- Success criteria

## Findings
- What was learned
- Answers to research questions
- Unexpected discoveries

## Decision
- Go/No-go decision
- Recommended approach
- Risk assessment

---
*Type: Time-boxed investigation*
*Status: Planning*`;

      fs.writeFileSync(spikeTemplatePath, spikeTemplate);
    }

    // Create algorithm template
    const algorithmTemplatePath = path.join(prototypesPath, 'algorithms', 'example-algorithm.js');
    if (!fs.existsSync(algorithmTemplatePath)) {
      const algorithmTemplate = `/**
 * Example Algorithm Prototype
 * 
 * This is a template for algorithm prototyping and testing.
 * Replace this example sorting algorithm with your own implementation.
 */

/**
 * Example sorting algorithm implementation
 * @param {number[]} arr - Array of numbers to sort
 * @returns {number[]} - Sorted array
 */
function exampleSort(arr) {
  // Replace with your algorithm implementation
  return [...arr].sort((a, b) => a - b);
}

/**
 * Performance testing function
 * @param {Function} algorithm - Algorithm function to test
 * @param {Array} testData - Test data array
 * @returns {Object} - Performance results
 */
function performanceTest(algorithm, testData) {
  const start = process.hrtime.bigint();
  const result = algorithm([...testData]);
  const end = process.hrtime.bigint();
  
  const executionTime = Number(end - start) / 1000000; // Convert to milliseconds
  
  return {
    result,
    executionTimeMs: executionTime,
    isCorrect: isSorted(result)
  };
}

/**
 * Verify if array is sorted correctly
 * @param {number[]} arr - Array to check
 * @returns {boolean} - True if sorted
 */
function isSorted(arr) {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[i - 1]) {
      return false;
    }
  }
  return true;
}

/**
 * Run test cases
 */
function runTests() {
  const testCases = [
    [3, 1, 4, 1, 5, 9, 2, 6],
    [1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1],
    [1],
    [],
    Array.from({length: 1000}, () => Math.floor(Math.random() * 1000))
  ];

  console.log('Running algorithm tests...');
  
  testCases.forEach((testCase, index) => {
    const result = performanceTest(exampleSort, testCase);
    console.log(\`Test \${index + 1}: \${result.isCorrect ? 'PASS' : 'FAIL'} (\${result.executionTimeMs.toFixed(3)}ms)\`);
  });
}

// Export for testing
module.exports = {
  exampleSort,
  performanceTest,
  runTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}`;

      fs.writeFileSync(algorithmTemplatePath, algorithmTemplate);
    }
  }
}
