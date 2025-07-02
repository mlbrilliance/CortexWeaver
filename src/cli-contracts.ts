import * as fs from 'fs';
import * as path from 'path';

/**
 * CLI Contracts Module
 * Handles creation of formal contract structures and templates
 */
export class CLIContracts {
  
  static async createContractsStructure(projectRoot: string): Promise<void> {
    const contractsPath = path.join(projectRoot, 'contracts');
    
    // Create main contracts directory and subdirectories
    const contractsDirs = [
      contractsPath,
      path.join(contractsPath, 'api'),
      path.join(contractsPath, 'api', 'endpoints'),
      path.join(contractsPath, 'schemas'),
      path.join(contractsPath, 'schemas', 'models'),
      path.join(contractsPath, 'schemas', 'validation'),
      path.join(contractsPath, 'properties'),
      path.join(contractsPath, 'properties', 'invariants'),
      path.join(contractsPath, 'properties', 'oracles'),
      path.join(contractsPath, 'examples'),
      path.join(contractsPath, 'examples', 'requests'),
      path.join(contractsPath, 'examples', 'responses'),
      path.join(contractsPath, 'examples', 'data')
    ];

    contractsDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Create README.md for contracts directory
    await this.createContractsReadme(contractsPath);

    // Create property-based test template
    await this.createPropertyTestTemplate(path.join(contractsPath, 'properties'));

    // Create example files
    await this.createExampleFiles(path.join(contractsPath, 'examples'));
  }

  static async createContractsReadme(contractsPath: string): Promise<void> {
    const readmePath = path.join(contractsPath, 'README.md');
    
    if (fs.existsSync(readmePath)) {
      return; // Don't overwrite existing README
    }

    const readmeContent = `# CortexWeaver Contracts Directory

This directory contains formal specifications and contracts for Specification-Driven Development (SDD) in CortexWeaver. Following the principles outlined in "The Oracle's Dilemma," this directory serves as the **formal source of truth** for AI agents, eliminating ambiguity in natural language requirements.

## Purpose

The \`/contracts\` directory implements the core SDD principle where:
- High-level goals are translated into formal, machine-readable specifications
- These specifications serve as unambiguous contracts for AI agents
- The **Architect** and **Spec Writer** agents populate this directory
- The **Coder** and **Tester** agents use these contracts as their primary source of truth

## Directory Structure

\`\`\`
contracts/
├── README.md              # This file - explains the contracts system
├── api/                   # OpenAPI specifications and API contracts
│   ├── openapi.yaml      # Main OpenAPI specification
│   └── endpoints/        # Individual endpoint specifications
├── schemas/              # JSON Schema definitions for data models
│   ├── models/          # Core data model schemas
│   └── validation/      # Input/output validation schemas
├── properties/          # Property-based test invariants and oracles
│   ├── invariants/      # System invariants and properties
│   └── oracles/         # Test oracles and verification rules
└── examples/            # Example data, usage patterns, and test cases
    ├── requests/        # Example API requests
    ├── responses/       # Example API responses
    └── data/           # Sample data sets
\`\`\`

## Getting Started

1. **For new features**: Start by defining contracts before implementation
2. **For existing features**: Formalize existing behavior into contracts
3. **For testing**: Use contracts to generate comprehensive test suites
4. **For documentation**: Contracts serve as living API documentation

See the template files in each subdirectory for examples and guidance.

---

*This directory is automatically created by \`cortex-weaver init\` and managed by CortexWeaver's multi-agent system.*`;

    fs.writeFileSync(readmePath, readmeContent);
  }

  static async createPropertyTestTemplate(propertiesPath: string): Promise<void> {
    const propertiesTemplatePath = path.join(propertiesPath, 'invariants', 'example.properties.ts');
    
    if (fs.existsSync(propertiesTemplatePath)) {
      return; // Don't overwrite existing properties
    }

    const propertiesContent = `/**
 * Example Property-Based Test Invariants
 * 
 * This file demonstrates how to define property-based test invariants
 * for your CortexWeaver project following SDD principles.
 */

export interface ExampleInvariants {
  /**
   * INVARIANT: All user IDs must be valid UUIDs
   */
  validUserIds: (userId: string) => boolean;

  /**
   * INVARIANT: All email addresses must be valid
   */
  validEmails: (email: string) => boolean;

  /**
   * INVARIANT: Timestamps must be valid ISO 8601 format
   */
  validTimestamps: (timestamp: string) => boolean;
}

/**
 * Property-based test generators
 */
export interface ExampleGenerators {
  generateValidUserId(): string;
  generateValidEmail(): string;
  generateValidTimestamp(): string;
}

/**
 * Test oracles for validation
 */
export interface ExampleOracles {
  isUserIdValid(userId: string): boolean;
  isEmailValid(email: string): boolean;
  isTimestampValid(timestamp: string): boolean;
}

export default {
  invariants: {} as ExampleInvariants,
  generators: {} as ExampleGenerators,
  oracles: {} as ExampleOracles,
};`;

    fs.writeFileSync(propertiesTemplatePath, propertiesContent);
  }

  static async createExampleFiles(examplesPath: string): Promise<void> {
    const requestExamplePath = path.join(examplesPath, 'requests', 'example-request.json');
    
    if (fs.existsSync(requestExamplePath)) {
      return; // Don't overwrite existing examples
    }

    const requestExampleContent = `{
  "description": "Example API request data",
  "examples": [
    {
      "name": "Example request",
      "description": "A sample API request for reference",
      "data": {
        "message": "Hello, CortexWeaver!"
      },
      "expectedStatus": 200,
      "expectedResponse": "example-response.json"
    }
  ]
}`;

    fs.writeFileSync(requestExamplePath, requestExampleContent);

    const responseExamplePath = path.join(examplesPath, 'responses', 'example-response.json');
    const responseExampleContent = `{
  "description": "Example API response data",
  "examples": [
    {
      "name": "Example response",
      "description": "A sample API response for reference",
      "statusCode": 200,
      "body": {
        "message": "Hello from CortexWeaver!",
        "timestamp": "2023-12-07T10:00:00.000Z"
      }
    }
  ]
}`;

    fs.writeFileSync(responseExamplePath, responseExampleContent);
  }
}