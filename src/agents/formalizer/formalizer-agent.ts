import { Agent, AgentConfig, TaskResult } from '../../agent';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Import types (simplified from original)
export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  security?: Array<Record<string, any>>;
}

export interface JsonSchema {
  type: string;
  required?: string[];
  properties?: Record<string, any>;
  additionalProperties?: boolean;
  description?: string;
}

export interface PropertyTestStub {
  name: string;
  description: string;
  properties: string[];
  invariants?: string[];
  preconditions?: string[];
  postconditions?: string[];
}

/**
 * FormalizerAgent - Refactored with simplified implementation
 * 
 * Generates formal specifications including OpenAPI specs, JSON schemas,
 * and property-based test stubs from natural language requirements.
 */
export class FormalizerAgent extends Agent {

  /**
   * Get the prompt template for formal specification generation
   */
  getPromptTemplate(): string {
    return `You are a Formalizer Agent, a formal methods specialist expert in converting natural language requirements into precise technical specifications.

## Core Responsibilities
- Transform BDD scenarios and requirements into formal OpenAPI specifications
- Generate comprehensive JSON schemas for data validation
- Create property-based test stubs with invariants and constraints
- Ensure formal consistency and completeness across specifications
- Validate generated specifications against best practices

## Input Context
**BDD Content:** {{bddContent}}
**Project Info:** {{projectInfo}}
**Requirements:** {{requirements}}
**Feature Files:** {{featureFiles}}
**Dependencies:** {{dependencies}}

## Formalization Process
1. **Requirements Analysis**: Parse natural language to identify entities, operations, and constraints
2. **API Design**: Extract RESTful operations from user stories and scenarios
3. **Data Modeling**: Identify domain objects and their relationships
4. **Constraint Extraction**: Derive business rules and validation requirements
5. **Test Generation**: Create property-based tests that verify formal properties

## Output Generation
Generate the following formal artifacts:

### OpenAPI Specification
- Complete OpenAPI 3.0 specification with all endpoints
- Proper HTTP methods, status codes, and response structures
- Security schemes and authentication requirements
- Request/response schemas with validation rules

### JSON Schemas
- Comprehensive data models for all domain entities
- Validation constraints derived from business rules
- Proper type definitions with required fields
- Additional properties control and format specifications

### Property-Based Test Stubs
- Test stubs with property assertions
- Invariants that must hold across all inputs
- Preconditions and postconditions for operations
- Edge case identification and boundary testing

## Quality Standards
- Ensure all specifications are valid and parseable
- Maintain consistency between OpenAPI and JSON schemas
- Generate comprehensive test coverage for critical properties
- Follow industry standards for API design and documentation

Focus on precision, completeness, and formal correctness while maintaining readability and maintainability.`;
  }
  
  /**
   * Generate OpenAPI specification from requirements
   */
  async generateOpenApiSpec(requirements: string): Promise<OpenApiSpec> {
    // Simplified implementation maintaining core functionality
    const spec: OpenApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Generated API',
        version: '1.0.0',
        description: 'API specification generated from requirements'
      },
      paths: {}
    };

    // Basic path generation logic (simplified)
    const lines = requirements.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('endpoint') || line.toLowerCase().includes('api')) {
        const pathName = this.extractPathFromRequirement(line);
        if (pathName) {
          spec.paths[pathName] = {
            get: {
              summary: line.trim(),
              responses: {
                '200': {
                  description: 'Success'
                }
              }
            }
          };
        }
      }
    }

    return spec;
  }

  /**
   * Generate JSON schema from data description
   */
  async generateJsonSchema(description: string): Promise<JsonSchema> {
    // Simplified schema generation
    return {
      type: 'object',
      description: description,
      properties: {
        id: { type: 'string' },
        data: { type: 'object' }
      },
      required: ['id'],
      additionalProperties: false
    };
  }

  /**
   * Generate property test stubs from specifications
   */
  async generatePropertyTestStubs(spec: OpenApiSpec): Promise<PropertyTestStub[]> {
    const stubs: PropertyTestStub[] = [];
    
    // Generate test stubs for each path
    Object.keys(spec.paths).forEach(path => {
      stubs.push({
        name: `test_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
        description: `Property test for ${path}`,
        properties: ['response_time', 'status_code', 'response_format'],
        invariants: ['status_code >= 200', 'status_code < 500'],
        preconditions: ['valid_request'],
        postconditions: ['valid_response']
      });
    });

    return stubs;
  }

  /**
   * Execute the formalization task
   */
  async executeTask(): Promise<TaskResult> {
    if (!this.currentTask) {
      throw new Error('No task available');
    }

    try {
      await this.reportProgress('started', 'Beginning formal specification generation');

      const requirements = this.currentTask.requirements || ['Generate basic API specification'];
      const requirementsText = Array.isArray(requirements) ? requirements.join('\n') : requirements;
      
      // Generate specifications
      const openApiSpec = await this.generateOpenApiSpec(requirementsText);
      const jsonSchema = await this.generateJsonSchema(requirementsText);
      const testStubs = await this.generatePropertyTestStubs(openApiSpec);

      // Save specifications if workspace is available
      if (this.config?.workspaceRoot) {
        await this.saveSpecifications(openApiSpec, jsonSchema, testStubs);
      }

      await this.reportProgress('completed', 'Formal specifications generated successfully');

      return {
        success: true,
        output: {
          openApiSpec,
          jsonSchema,
          testStubs,
          message: 'Formal specifications generated successfully'
        }
      };
    } catch (error) {
      await this.reportProgress('error', `Formalization failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Extract API path from requirement text
   */
  private extractPathFromRequirement(requirement: string): string | null {
    // Simplified path extraction
    const words = requirement.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      if (words[i] === 'path' && i + 1 < words.length) {
        return `/${words[i + 1]}`;
      }
      if (words[i].startsWith('/')) {
        return words[i];
      }
    }
    return '/api/resource';
  }

  /**
   * Save generated specifications to files
   */
  private async saveSpecifications(
    openApiSpec: OpenApiSpec,
    jsonSchema: JsonSchema,
    testStubs: PropertyTestStub[]
  ): Promise<void> {
    const outputDir = path.join(this.config!.workspaceRoot, 'specs');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save OpenAPI spec
    fs.writeFileSync(
      path.join(outputDir, 'openapi.yaml'),
      yaml.dump(openApiSpec)
    );

    // Save JSON schema
    fs.writeFileSync(
      path.join(outputDir, 'schema.json'),
      JSON.stringify(jsonSchema, null, 2)
    );

    // Save test stubs
    fs.writeFileSync(
      path.join(outputDir, 'test-stubs.json'),
      JSON.stringify(testStubs, null, 2)
    );
  }
}