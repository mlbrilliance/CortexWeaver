import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from './config';
import { Orchestrator, OrchestratorConfig } from './orchestrator';

export class CLI {
  async init(projectRoot: string = process.cwd()): Promise<void> {
    const configService = new ConfigService(projectRoot);
    
    // Create .cortexweaver directory
    const cortexDir = configService.getCortexWeaverDir();
    if (!fs.existsSync(cortexDir)) {
      fs.mkdirSync(cortexDir, { recursive: true });
    }

    // Create contracts directory structure
    await this.createContractsStructure(projectRoot);

    // Create plan.md template
    await this.createPlanTemplate(projectRoot);
    
    // Create default config.json
    await this.createDefaultConfig(configService);
    
    // Create docker-compose.yml for MCP servers
    await this.createDockerCompose(projectRoot);
    
    // Create .env.example template
    await this.createEnvTemplate(projectRoot);

    console.log('✅ CortexWeaver project initialized successfully!');
    console.log(`
Next steps:
1. Copy .env.example to .env and fill in your API keys
2. Run 'docker-compose up -d' to start MCP servers
3. Edit plan.md to define your project features
4. Define formal contracts in the /contracts directory
5. Run 'cortex-weaver start' to begin orchestration

📋 Specification-Driven Development:
- Use /contracts/api/ for OpenAPI specifications
- Use /contracts/schemas/ for JSON Schema definitions
- Use /contracts/properties/ for property-based test invariants
- Use /contracts/examples/ for sample data and usage patterns
    `);
  }

  async status(projectRoot: string = process.cwd()): Promise<string> {
    if (!this.validateProject(projectRoot)) {
      return 'Error: Not a CortexWeaver project. Run "cortex-weaver init" first.';
    }

    // Check contracts directory structure
    const contractsPath = path.join(projectRoot, 'contracts');
    const contractsFiles = {
      readme: fs.existsSync(path.join(contractsPath, 'README.md')),
      openapi: fs.existsSync(path.join(contractsPath, 'api', 'openapi.yaml')),
      schemas: fs.readdirSync(path.join(contractsPath, 'schemas', 'models')).length > 0,
      properties: fs.readdirSync(path.join(contractsPath, 'properties', 'invariants')).length > 0,
      examples: fs.readdirSync(path.join(contractsPath, 'examples', 'requests')).length > 0
    };

    const contractsStatus = Object.entries(contractsFiles)
      .map(([key, exists]) => `${exists ? '✅' : '❌'} ${key}`)
      .join('\n');

    const statusReport = `
CortexWeaver Project Status
==========================

Project Root: ${projectRoot}
Configuration: ${path.join(projectRoot, '.cortexweaver', 'config.json')}
Plan File: ${path.join(projectRoot, 'plan.md')}
Contracts Directory: ${contractsPath}

📋 Specification-Driven Development Status:
${contractsStatus}

Status: Project initialized
Active Tasks: 0
Completed Tasks: 0

Next Steps:
1. Define formal contracts in /contracts directory
2. Use SDD workflow: Spec Writer → Formalizer → Architect → Coder → Testers
3. Run: cortex-weaver start
    `;

    return statusReport.trim();
  }

  async start(projectRoot: string = process.cwd()): Promise<void> {
    // 1. Validate CortexWeaver project
    if (!this.validateProject(projectRoot)) {
      throw new Error('Not a CortexWeaver project. Run "cortex-weaver init" first.');
    }

    console.log('🔍 Validating project setup...');

    // 2. Load configuration and environment variables
    const configService = new ConfigService(projectRoot);
    const projectConfig = configService.loadProjectConfig();
    
    // Load environment variables from .env file
    const envVars = configService.loadEnvironmentVariables();
    
    // Override process.env with loaded variables for validation
    Object.assign(process.env, envVars);

    // 3. Validate required environment variables
    try {
      const claudeApiKey = configService.getRequiredEnvVar('CLAUDE_API_KEY');
      const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
      const neo4jUsername = process.env.NEO4J_USERNAME || 'neo4j';
      const neo4jPassword = configService.getRequiredEnvVar('NEO4J_PASSWORD');

      // 4. Create Orchestrator configuration
      const orchestratorConfig: OrchestratorConfig = {
        neo4j: {
          uri: neo4jUri,
          username: neo4jUsername,
          password: neo4jPassword
        },
        claude: {
          apiKey: claudeApiKey,
          defaultModel: projectConfig.models.claude as any,
          budgetLimit: projectConfig.budget.maxCost
        }
      };

      console.log('🚀 Initializing Orchestrator...');

      // 5. Initialize Orchestrator with project root
      const orchestrator = new Orchestrator(orchestratorConfig);
      
      // Set up signal handlers for graceful shutdown
      const shutdownHandler = async (signal: string) => {
        console.log(`\n⚠️  Received ${signal}. Shutting down gracefully...`);
        try {
          await orchestrator.shutdown();
          console.log('✅ Orchestrator shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', (error as Error).message);
          process.exit(1);
        }
      };

      process.on('SIGINT', () => shutdownHandler('SIGINT'));
      process.on('SIGTERM', () => shutdownHandler('SIGTERM'));

      try {
        // 6. Initialize Orchestrator with project path
        await orchestrator.initialize(projectRoot);
        console.log('✅ Orchestrator initialized successfully');

        // 7. Budget validation before starting
        const tokenUsage = orchestrator.getTokenUsage();
        if (tokenUsage.estimatedCost > projectConfig.budget.maxCost) {
          console.log(`⚠️  Current usage ($${tokenUsage.estimatedCost.toFixed(2)}) approaches budget limit ($${projectConfig.budget.maxCost})`);
          console.log('📊 Budget monitoring will continue during orchestration');
        }

        console.log('🎯 Starting orchestration loop...');
        console.log('📊 Real-time status monitoring enabled');
        console.log('💡 Use Ctrl+C to stop gracefully');

        // 8. Start orchestration loop with proper error handling
        await orchestrator.start();

        // 9. Provide final status
        const finalStatus = orchestrator.getStatus();
        const finalUsage = orchestrator.getTokenUsage();
        
        console.log(`\n🏁 Orchestration completed with status: ${finalStatus}`);
        console.log(`📊 Final token usage: ${finalUsage.totalTokens} tokens ($${finalUsage.estimatedCost.toFixed(2)})`);

      } catch (error) {
        console.error('❌ Orchestration error:', (error as Error).message);
        await orchestrator.shutdown();
        throw error;
      }

    } catch (error) {
      if ((error as Error).message.includes('Required environment variable')) {
        throw new Error(`Missing required configuration: ${(error as Error).message}`);
      }
      throw error;
    }
  }

  validateProject(projectRoot: string): boolean {
    const requiredFiles = [
      path.join(projectRoot, '.cortexweaver', 'config.json'),
      path.join(projectRoot, 'plan.md')
    ];

    const requiredDirectories = [
      path.join(projectRoot, 'contracts'),
      path.join(projectRoot, 'contracts', 'api'),
      path.join(projectRoot, 'contracts', 'schemas'),
      path.join(projectRoot, 'contracts', 'properties'),
      path.join(projectRoot, 'contracts', 'examples')
    ];

    const filesExist = requiredFiles.every(file => fs.existsSync(file));
    const directoriesExist = requiredDirectories.every(dir => fs.existsSync(dir));

    return filesExist && directoriesExist;
  }

  private async createPlanTemplate(projectRoot: string): Promise<void> {
    const planPath = path.join(projectRoot, 'plan.md');
    
    if (fs.existsSync(planPath)) {
      return; // Don't overwrite existing plan
    }

    const planTemplate = `# Project Plan

## Overview
Describe your project goals and high-level architecture here.

## Specification-Driven Development (SDD)

This project follows CortexWeaver's Specification-Driven Development approach:

1. **Contracts First**: All features begin with formal specifications in \`/contracts/\`
2. **Agent Verification**: Multiple AI agents verify implementation against contracts
3. **Oracle-Driven Testing**: Property-based tests derive from formal contracts

### Contract Structure
- \`/contracts/api/\` - OpenAPI specifications for all endpoints
- \`/contracts/schemas/\` - JSON Schema definitions for data models
- \`/contracts/properties/\` - Property-based test invariants and oracles
- \`/contracts/examples/\` - Sample data and usage patterns

## Features

### Feature 1: Authentication System
- **Priority**: High
- **Description**: Implement user authentication with JWT tokens
- **Dependencies**: []
- **Agent**: Architect → Formalizer → Coder → Testers
- **Contracts Required**:
  - [ ] OpenAPI spec for auth endpoints (\`/contracts/api/auth-api.yaml\`)
  - [ ] User schema definition (\`/contracts/schemas/models/user.schema.json\`)
  - [ ] Auth property tests (\`/contracts/properties/invariants/auth.properties.ts\`)
  - [ ] Request/response examples (\`/contracts/examples/\`)
- **Acceptance Criteria**:
  - [ ] User registration endpoint
  - [ ] User login endpoint  
  - [ ] JWT token validation middleware
  - [ ] Password hashing and verification

#### SDD Workflow:
1. [ ] **Spec Writer**: Define BDD scenarios for authentication
2. [ ] **Formalizer**: Create formal contracts from BDD scenarios
3. [ ] **Architect**: Design architecture based on contracts
4. [ ] **Coder**: Implement code satisfying contracts
5. [ ] **Property Tester**: Verify implementation against invariants
6. [ ] **Quality Gatekeeper**: Validate contract compliance

#### Microtasks:
- [ ] Define authentication BDD scenarios
- [ ] Create OpenAPI spec for auth endpoints
- [ ] Define user data model schema
- [ ] Specify password security invariants
- [ ] Design token validation properties
- [ ] Implement authentication service
- [ ] Create comprehensive property-based tests
- [ ] Validate contract compliance

### Feature 2: User Dashboard
- **Priority**: Medium
- **Description**: Create user dashboard with profile management
- **Dependencies**: [Feature 1]
- **Agent**: Coder → Property Tester
- **Contracts Required**:
  - [ ] Dashboard API specification
  - [ ] Profile data schemas
  - [ ] UI component invariants
  - [ ] User interaction examples
- **Acceptance Criteria**:
  - [ ] User profile display
  - [ ] Profile editing functionality
  - [ ] Activity history
  - [ ] Settings management

#### SDD Workflow:
1. [ ] **Spec Writer**: Define dashboard BDD scenarios
2. [ ] **Formalizer**: Create dashboard contracts
3. [ ] **Architect**: Design dashboard architecture
4. [ ] **Coder**: Implement dashboard components
5. [ ] **Property Tester**: Test UI invariants
6. [ ] **Quality Gatekeeper**: Validate user experience

## Architecture Decisions

### Technology Stack
- **Backend**: Node.js with Express/Fastify
- **Database**: PostgreSQL with TypeORM
- **Frontend**: React with TypeScript
- **Testing**: Jest with Supertest + Property-based testing
- **Documentation**: OpenAPI/Swagger (auto-generated from contracts)
- **Contracts**: OpenAPI 3.0+, JSON Schema Draft 7+

### SDD Quality Standards
- **Contract Coverage**: All features must have formal contracts
- **Property Testing**: Minimum 80% property-based test coverage
- **Oracle Verification**: All critical paths verified by test oracles
- **Contract-Code Sync**: Implementation must match contracts (CI/CD enforced)
- **Multi-Agent Verification**: At least 2 agents must verify each feature

### Quality Standards
- **Test Coverage**: Minimum 80%
- **Code Style**: ESLint + Prettier
- **Documentation**: All public APIs documented via contracts
- **Performance**: API responses < 200ms p95
- **Contract Compliance**: All endpoints must match OpenAPI specs

## Agent Workflow

The CortexWeaver multi-agent system follows this verification ecosystem:

1. **Orchestrator**: Coordinates the entire workflow
2. **Spec Writer**: Creates human-readable BDD scenarios
3. **Formalizer**: Translates BDD to formal machine-readable contracts
4. **Architect**: Designs system architecture from contracts
5. **Coder**: Implements code satisfying contracts
6. **Property Tester**: Verifies implementation with property-based tests
7. **Quality Gatekeeper**: Ensures contract compliance and quality

## Notes
- All features must start with contract definition in \`/contracts/\`
- Use property-based testing for comprehensive verification
- Contracts serve as the "oracle" for determining correct behavior
- Multiple AI agents provide verification redundancy
- Implementation is contract-driven, not prompt-driven
`;

    fs.writeFileSync(planPath, planTemplate);
  }

  private async createDefaultConfig(configService: ConfigService): Promise<void> {
    const defaultConfig = {
      models: {
        claude: 'claude-3-opus-20240229',
        gemini: 'gemini-pro'
      },
      costs: {
        claudeTokenCost: 0.015,
        geminiTokenCost: 0.0005
      },
      budget: {
        maxTokens: 50000,
        maxCost: 500
      },
      parallelism: {
        maxConcurrentTasks: 5,
        maxConcurrentAgents: 3
      },
      monitoring: {
        enableMetrics: true,
        logLevel: 'info'
      }
    };

    configService.saveProjectConfig(defaultConfig);
  }

  private async createDockerCompose(projectRoot: string): Promise<void> {
    const dockerComposePath = path.join(projectRoot, 'docker-compose.yml');
    
    if (fs.existsSync(dockerComposePath)) {
      return; // Don't overwrite existing docker-compose
    }

    const dockerComposeContent = `version: '3.8'

services:
  neo4j:
    image: neo4j:5.15
    container_name: cortexweaver-neo4j
    environment:
      NEO4J_AUTH: neo4j/cortexweaver
      NEO4J_dbms_memory_heap_initial__size: 512m
      NEO4J_dbms_memory_heap_max__size: 1G
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    restart: unless-stopped

  mcp-neo4j-memory:
    image: mcpneo4j/memory:latest
    container_name: cortexweaver-mcp-neo4j
    environment:
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_USERNAME: neo4j
      NEO4J_PASSWORD: cortexweaver
    depends_on:
      - neo4j
    restart: unless-stopped

  github-mcp-server:
    image: ghcr.io/github/github-mcp-server:latest
    container_name: cortexweaver-github-mcp
    environment:
      GITHUB_PERSONAL_ACCESS_TOKEN: \${GITHUB_TOKEN}
      GITHUB_TOOLSETS: "context,repos,issues,pull_requests,actions,code_security"
      GITHUB_READ_ONLY: "1"
      GITHUB_DYNAMIC_TOOLSETS: "1"
    restart: unless-stopped

volumes:
  neo4j_data:
  neo4j_logs:
`;

    fs.writeFileSync(dockerComposePath, dockerComposeContent);
  }

  private async createEnvTemplate(projectRoot: string): Promise<void> {
    const envTemplatePath = path.join(projectRoot, '.env.example');
    
    const envTemplate = `# CortexWeaver Environment Configuration

# AI Model API Keys
CLAUDE_API_KEY=your_claude_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# GitHub Integration (optional)
GITHUB_TOKEN=your_github_personal_access_token_here

# Neo4j Database Configuration (for MCP)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=cortexweaver

# Optional: Custom model endpoints
# CLAUDE_API_URL=https://api.anthropic.com
# GEMINI_API_URL=https://generativelanguage.googleapis.com

# Debugging and Development
DEBUG=false
LOG_LEVEL=info
`;

    fs.writeFileSync(envTemplatePath, envTemplate);
  }

  private async createContractsStructure(projectRoot: string): Promise<void> {
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

    // Create template OpenAPI specification
    await this.createOpenApiTemplate(path.join(contractsPath, 'api'));

    // Create sample JSON schema
    await this.createJsonSchemaTemplates(path.join(contractsPath, 'schemas'));

    // Create property-based test template
    await this.createPropertyTestTemplate(path.join(contractsPath, 'properties'));

    // Create example files
    await this.createExampleFiles(path.join(contractsPath, 'examples'));
  }

  private async createContractsReadme(contractsPath: string): Promise<void> {
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

  private async createOpenApiTemplate(apiPath: string): Promise<void> {
    const openApiPath = path.join(apiPath, 'openapi.yaml');
    
    if (fs.existsSync(openApiPath)) {
      return; // Don't overwrite existing OpenAPI spec
    }

    const openApiContent = `openapi: 3.0.3
info:
  title: CortexWeaver Project API
  description: |
    This is a template OpenAPI specification for your CortexWeaver project.
    
    This contract serves as the formal specification for your API, following
    Specification-Driven Development (SDD) principles. AI agents will use this
    contract as their source of truth for implementation and testing.
    
  version: 1.0.0
  contact:
    name: Project Team
    email: team@example.com

servers:
  - url: http://localhost:3000/api/v1
    description: Development server

paths:
  /health:
    get:
      summary: Health check endpoint
      description: Returns the health status of the API
      operationId: getHealth
      tags:
        - Health
      responses:
        '200':
          description: API is healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [healthy]
                  timestamp:
                    type: string
                    format: date-time

components:
  schemas:
    ErrorResponse:
      type: object
      required:
        - error
        - message
      properties:
        error:
          type: string
          description: Error code or type
        message:
          type: string
          description: Human-readable error message

tags:
  - name: Health
    description: Health check endpoints`;

    fs.writeFileSync(openApiPath, openApiContent);
  }

  private async createJsonSchemaTemplates(schemasPath: string): Promise<void> {
    const userSchemaPath = path.join(schemasPath, 'models', 'user.schema.json');
    
    if (fs.existsSync(userSchemaPath)) {
      return; // Don't overwrite existing schema
    }

    const userSchemaContent = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://example.com/schemas/user.schema.json",
  "title": "User",
  "description": "User entity schema for CortexWeaver project",
  "type": "object",
  "required": [
    "id",
    "email",
    "firstName",
    "lastName",
    "createdAt"
  ],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique identifier for the user"
    },
    "email": {
      "type": "string",
      "format": "email",
      "description": "User's email address"
    },
    "firstName": {
      "type": "string",
      "description": "User's first name",
      "minLength": 1,
      "maxLength": 50
    },
    "lastName": {
      "type": "string",
      "description": "User's last name",
      "minLength": 1,
      "maxLength": 50
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "description": "Timestamp when the user was created"
    }
  },
  "additionalProperties": false
}`;

    fs.writeFileSync(userSchemaPath, userSchemaContent);
  }

  private async createPropertyTestTemplate(propertiesPath: string): Promise<void> {
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

  private async createExampleFiles(examplesPath: string): Promise<void> {
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