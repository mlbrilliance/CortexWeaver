import { Agent, AgentConfig, TaskResult } from '../agent';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Core interfaces for formal specifications
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

export interface BDDAnalysis {
  apiOperations: ApiOperation[];
  dataModels: string[];
  businessRules: string[];
  securityRequirements: string[];
  stateTransitions: StateTransition[];
}

export interface ApiOperation {
  method: string;
  path: string;
  summary: string;
  description?: string;
  requestBody?: string;
  responses: Record<string, string>;
  security?: string[];
  tags?: string[];
}

export interface StateTransition {
  from: string;
  to: string;
  trigger: string;
  conditions: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ContractFiles {
  openApiFile?: string;
  schemasFile?: string;
  testStubsFile?: string;
}

export interface FormalizationResult {
  openApiSpec: OpenApiSpec;
  jsonSchemas: Record<string, JsonSchema>;
  propertyTestStubs: PropertyTestStub[];
  contractFiles: ContractFiles;
  validationResults: {
    openApiSpec: ValidationResult;
    jsonSchemas: ValidationResult;
    propertyTestStubs: ValidationResult;
  };
  metadata: {
    processedFeatures: number;
    generatedAt: string;
    bddAnalysis: BDDAnalysis;
  };
}

/**
 * Formalizer agent - Converts BDD scenarios to formal specifications
 * Implements Specification-Driven Development (SDD) by creating:
 * - OpenAPI specifications for API contracts
 * - JSON schemas for data models
 * - Property-based test stubs for verification
 */
export class Formalizer extends Agent {
  
  // Initialize the Formalizer agent
  async initialize(config: AgentConfig): Promise<void> {
    // Set temperature low for consistency in formal specification generation
    config.claudeConfig.temperature = 0.1;
    await super.initialize(config);
  }

  // Execute the formalization task
  async executeTask(): Promise<FormalizationResult> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    if (!this.claudeClient) {
      throw new Error('Claude client not initialized');
    }

    try {
      await this.reportProgress('analyzing', 'Analyzing BDD scenarios');

      // Read and analyze BDD feature files
      const bddContent = await this.readBDDFeatureFiles();
      const bddAnalysis = this.analyzeBDDScenarios(bddContent);

      await this.reportProgress('generating', 'Generating formal specifications with Claude');

      // Generate formal specifications using Claude
      const prompt = this.formatPrompt(this.getPromptTemplate(), {
        bddContent,
        taskDescription: this.currentTask.description,
        taskTitle: this.currentTask.title,
        projectInfo: JSON.stringify(this.taskContext.projectInfo || {}),
        dependencies: JSON.stringify(this.taskContext.dependencies || []),
        analysisContext: JSON.stringify(bddAnalysis)
      });

      const response = await this.sendToClaude(prompt, {
        maxTokens: 8192, // Increased for complex specifications
        temperature: 0.1
      });

      // Parse Claude's response
      let claudeData;
      try {
        claudeData = JSON.parse(response.content);
      } catch (error) {
        throw new Error(`Failed to parse Claude response: ${(error as Error).message}`);
      }

      await this.reportProgress('validating', 'Validating generated specifications');

      // Validate generated specifications
      const validationResults = {
        openApiSpec: this.validateOpenApiSpec(claudeData.openApiSpec),
        jsonSchemas: this.validateJsonSchemas(claudeData.jsonSchemas),
        propertyTestStubs: this.validatePropertyTestStubs(claudeData.propertyTestStubs)
      };

      await this.reportProgress('writing-contracts', 'Writing contract files');

      // Write contract files to /contracts directory
      const contractFiles = await this.writeContractFiles(
        claudeData.openApiSpec,
        claudeData.jsonSchemas,
        claudeData.propertyTestStubs
      );

      await this.reportProgress('updating-canvas', 'Updating Cognitive Canvas');

      // Update Cognitive Canvas with relationships
      await this.updateCognitiveCanvas(contractFiles, bddAnalysis);

      const result: FormalizationResult = {
        openApiSpec: claudeData.openApiSpec,
        jsonSchemas: claudeData.jsonSchemas,
        propertyTestStubs: claudeData.propertyTestStubs,
        contractFiles,
        validationResults,
        metadata: {
          processedFeatures: this.taskContext.featureFiles?.length || 0,
          generatedAt: new Date().toISOString(),
          bddAnalysis
        }
      };

      await this.reportProgress('completed', 'Formalization completed successfully');
      return result;

    } catch (error) {
      await this.reportProgress('error', `Failed to generate formal specifications: ${(error as Error).message}`);
      throw new Error(`Failed to generate formal specifications: ${(error as Error).message}`);
    }
  }

  // Get the prompt template for formalization
  getPromptTemplate(): string {
    return `You are a formal methods specialist and expert in Specification-Driven Development (SDD). Your role is to convert BDD scenarios into precise, machine-readable formal contracts.

Task: {{taskTitle}}
Description: {{taskDescription}}
Project Info: {{projectInfo}}
Dependencies: {{dependencies}}
Analysis Context: {{analysisContext}}

BDD Content to Formalize:
{{bddContent}}

INSTRUCTIONS:
1. Analyze the BDD scenarios to understand business logic, API operations, data models, and constraints
2. Generate a comprehensive OpenAPI 3.0 specification that formally describes all API contracts
3. Create JSON schemas for all data models with proper validation rules
4. Generate property-based test stubs that capture business invariants and rules

Your response must be valid JSON with this exact structure:
{
  "openApiSpec": {
    "openapi": "3.0.0",
    "info": {
      "title": "API Title",
      "version": "1.0.0",
      "description": "API description"
    },
    "servers": [{"url": "https://api.example.com", "description": "Production server"}],
    "paths": {
      "/resource": {
        "post": {
          "summary": "Operation summary",
          "description": "Detailed description",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {"$ref": "#/components/schemas/RequestModel"}
              }
            }
          },
          "responses": {
            "200": {
              "description": "Success response",
              "content": {
                "application/json": {
                  "schema": {"$ref": "#/components/schemas/ResponseModel"}
                }
              }
            },
            "400": {"description": "Bad request"},
            "401": {"description": "Unauthorized"},
            "500": {"description": "Internal server error"}
          }
        }
      }
    },
    "components": {
      "schemas": {
        "RequestModel": {
          "type": "object",
          "required": ["field1"],
          "properties": {
            "field1": {"type": "string", "description": "Field description"}
          }
        }
      },
      "securitySchemes": {
        "bearerAuth": {
          "type": "http",
          "scheme": "bearer",
          "bearerFormat": "JWT"
        }
      }
    }
  },
  "jsonSchemas": {
    "ModelName": {
      "type": "object",
      "required": ["id"],
      "properties": {
        "id": {"type": "string", "format": "uuid"},
        "name": {"type": "string", "minLength": 1, "maxLength": 100}
      },
      "additionalProperties": false
    }
  },
  "propertyTestStubs": [
    {
      "name": "test_operation_invariant",
      "description": "Description of what this property tests",
      "properties": [
        "For any valid input X, operation Y must return Z",
        "Result must satisfy condition A"
      ],
      "invariants": ["State consistency rules"],
      "preconditions": ["Input requirements"],
      "postconditions": ["Output guarantees"]
    }
  ]
}

REQUIREMENTS:
- OpenAPI spec must be valid 3.0.0 format
- Include comprehensive error responses (400, 401, 403, 404, 500)
- JSON schemas must include proper validation constraints
- Property test stubs must capture business invariants
- All fields must have descriptions
- Use proper HTTP methods and status codes
- Include security schemes where authentication is required
- Generate realistic examples and constraints based on BDD scenarios

Generate only the JSON response, no additional text.`.trim();
  }

  // Read BDD feature files from the workspace
  private async readBDDFeatureFiles(): Promise<string> {
    const featureFiles = this.taskContext?.featureFiles || [];
    
    if (featureFiles.length === 0) {
      throw new Error('No BDD feature files provided in task context');
    }

    let combinedContent = '';
    
    for (const featureFile of featureFiles) {
      try {
        const content = await this.readFile(featureFile);
        combinedContent += `\n--- Feature File: ${featureFile} ---\n${content}\n`;
      } catch (error) {
        throw new Error(`Failed to read BDD feature file ${featureFile}: ${(error as Error).message}`);
      }
    }

    return combinedContent;
  }

  // Analyze BDD scenarios to extract formal specification requirements
  private analyzeBDDScenarios(bddContent: string): BDDAnalysis {
    const apiOperations: ApiOperation[] = [];
    const dataModels: string[] = [];
    const businessRules: string[] = [];
    const securityRequirements: string[] = [];
    const stateTransitions: StateTransition[] = [];

    // Extract features and scenarios
    const featureRegex = /Feature: (.+)/g;
    const scenarioRegex = /Scenario: (.+)/g;
    const stepRegex = /(Given|When|Then|And|But) (.+)/g;

    let match;

    // Extract data models from steps
    const dataModelPatterns = [
      /I (?:am a|have a|create a|register as a|login as a) (.+?)(?:\s|$)/gi,
      /(?:user|customer|admin|account|profile|order|product|item|payment|token|session|credential)s?/gi,
      /the (.+?) (?:is|should|must|contains|includes)/gi
    ];

    dataModelPatterns.forEach(pattern => {
      let patternMatch;
      while ((patternMatch = pattern.exec(bddContent)) !== null) {
        const model = this.capitalizeFirstLetter(patternMatch[1] || patternMatch[0]);
        if (model && !dataModels.includes(model)) {
          dataModels.push(model);
        }
      }
    });

    // Extract API operations from When steps
    while ((match = stepRegex.exec(bddContent)) !== null) {
      const [, stepType, stepText] = match;
      
      if (stepType === 'When') {
        const apiOperation = this.extractApiOperation(stepText);
        if (apiOperation) {
          apiOperations.push(apiOperation);
        }
      }

      // Extract business rules from Then steps
      if (stepType === 'Then') {
        businessRules.push(stepText);
      }

      // Extract security requirements
      if (stepText.toLowerCase().includes('authent') || 
          stepText.toLowerCase().includes('login') ||
          stepText.toLowerCase().includes('token') ||
          stepText.toLowerCase().includes('credential')) {
        securityRequirements.push('JWT Authentication');
      }
    }

    // Remove duplicates
    const uniqueDataModels = [...new Set(dataModels)];
    const uniqueBusinessRules = [...new Set(businessRules)];
    const uniqueSecurityRequirements = [...new Set(securityRequirements)];

    return {
      apiOperations,
      dataModels: uniqueDataModels,
      businessRules: uniqueBusinessRules,
      securityRequirements: uniqueSecurityRequirements,
      stateTransitions
    };
  }

  // Extract API operation from When step text
  private extractApiOperation(stepText: string): ApiOperation | null {
    const lowerText = stepText.toLowerCase();
    
    // Common API operation patterns
    const operationPatterns = [
      { pattern: /I (?:submit|send|post|create) (?:a |an |the )?(.+?)(?:\s|$)/, method: 'POST', pathPattern: '/{resource}' },
      { pattern: /I (?:get|retrieve|fetch|view|see) (?:a |an |the )?(.+?)(?:\s|$)/, method: 'GET', pathPattern: '/{resource}' },
      { pattern: /I (?:update|modify|change|edit) (?:a |an |the )?(.+?)(?:\s|$)/, method: 'PUT', pathPattern: '/{resource}' },
      { pattern: /I (?:delete|remove) (?:a |an |the )?(.+?)(?:\s|$)/, method: 'DELETE', pathPattern: '/{resource}' },
      { pattern: /I (?:login|authenticate|sign in)/, method: 'POST', pathPattern: '/auth/login' },
      { pattern: /I (?:register|sign up|create account)/, method: 'POST', pathPattern: '/auth/register' },
      { pattern: /I (?:logout|sign out)/, method: 'POST', pathPattern: '/auth/logout' }
    ];

    for (const { pattern, method, pathPattern } of operationPatterns) {
      const match = stepText.match(pattern);
      if (match) {
        const resource = match[1] ? match[1].replace(/\s+/g, '-').toLowerCase() : 'resource';
        const path = pathPattern.replace('{resource}', resource);
        
        return {
          method,
          path,
          summary: this.capitalizeFirstLetter(stepText),
          description: `API operation derived from: ${stepText}`,
          responses: {
            '200': 'Success response',
            '400': 'Bad request',
            '401': 'Unauthorized',
            '500': 'Internal server error'
          }
        };
      }
    }

    return null;
  }

  // Generate OpenAPI specification from analysis
  private generateOpenApiSpec(analysis: BDDAnalysis, title: string): OpenApiSpec {
    const spec: OpenApiSpec = {
      openapi: '3.0.0',
      info: {
        title,
        version: '1.0.0',
        description: `API specification generated from BDD scenarios for ${title}`
      },
      servers: [
        {
          url: 'https://api.example.com',
          description: 'Production server'
        }
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {}
      }
    };

    // Add security schemes if authentication is required
    if (analysis.securityRequirements.includes('JWT Authentication')) {
      spec.components!.securitySchemes!.bearerAuth = {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      };
      spec.security = [{ bearerAuth: [] }];
    }

    // Add paths from API operations
    analysis.apiOperations.forEach(operation => {
      if (!spec.paths[operation.path]) {
        spec.paths[operation.path] = {};
      }
      
      spec.paths[operation.path][operation.method.toLowerCase()] = {
        summary: operation.summary,
        description: operation.description,
        responses: Object.entries(operation.responses).reduce((acc, [code, desc]) => {
          acc[code] = { description: desc };
          return acc;
        }, {} as Record<string, any>)
      };
    });

    return spec;
  }

  // Generate JSON schemas from analysis
  private generateJsonSchemas(analysis: BDDAnalysis): Record<string, JsonSchema> {
    const schemas: Record<string, JsonSchema> = {};

    analysis.dataModels.forEach(model => {
      const schema: JsonSchema = {
        type: 'object',
        description: `${model} data model`,
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: `Unique identifier for ${model.toLowerCase()}`
          }
        },
        additionalProperties: false
      };

      // Add common properties based on model type
      if (model.toLowerCase().includes('user')) {
        schema.properties!.email = { type: 'string', format: 'email' };
        schema.properties!.name = { type: 'string', minLength: 1, maxLength: 100 };
        schema.required!.push('email');
      }

      if (model.toLowerCase().includes('credential') || model.toLowerCase().includes('login')) {
        schema.properties!.email = { type: 'string', format: 'email' };
        schema.properties!.password = { type: 'string', minLength: 8 };
        schema.required = ['email', 'password'];
      }

      if (model.toLowerCase().includes('token') || model.toLowerCase().includes('auth')) {
        schema.properties!.token = { type: 'string' };
        schema.properties!.expiresAt = { type: 'string', format: 'date-time' };
        schema.required!.push('token');
      }

      schemas[model] = schema;
    });

    return schemas;
  }

  // Generate property-based test stubs from analysis
  private generatePropertyTestStubs(analysis: BDDAnalysis): PropertyTestStub[] {
    const testStubs: PropertyTestStub[] = [];

    // Generate test stubs from business rules
    analysis.businessRules.forEach((rule, index) => {
      const testStub: PropertyTestStub = {
        name: `property_test_${index + 1}_${rule.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`,
        description: `Property test for: ${rule}`,
        properties: [
          `Given any valid input, ${rule.toLowerCase()}`,
          'Result must be deterministic',
          'Operation must be idempotent where applicable'
        ],
        invariants: [
          'Data integrity must be maintained',
          'System state must remain consistent'
        ],
        preconditions: [
          'Input data must be valid',
          'System must be in stable state'
        ],
        postconditions: [
          'Output must satisfy business rule',
          'System state must be updated correctly'
        ]
      };

      testStubs.push(testStub);
    });

    // Generate test stubs for API operations
    analysis.apiOperations.forEach(operation => {
      const testStub: PropertyTestStub = {
        name: `api_test_${operation.method.toLowerCase()}_${operation.path.replace(/[^a-z0-9]/g, '_')}`,
        description: `Property test for ${operation.method} ${operation.path}`,
        properties: [
          `${operation.method} ${operation.path} must respond within acceptable time`,
          'Response must match schema specification',
          'Error responses must include proper error codes'
        ],
        invariants: [
          'API contract must be maintained',
          'Response format must be consistent'
        ]
      };

      testStubs.push(testStub);
    });

    return testStubs;
  }

  // Validate OpenAPI specification
  private validateOpenApiSpec(spec: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!spec.openapi) {
      errors.push('Missing required field: openapi');
    } else if (!spec.openapi.startsWith('3.0')) {
      warnings.push('OpenAPI version should be 3.0.x');
    }

    if (!spec.info) {
      errors.push('Missing required field: info');
    } else {
      if (!spec.info.title) {
        errors.push('Missing required field: info.title');
      }
      if (!spec.info.version) {
        errors.push('Missing required field: info.version');
      }
    }

    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      warnings.push('No paths defined in specification');
    } else {
      // Validate paths
      Object.entries(spec.paths).forEach(([path, pathObj]: [string, any]) => {
        if (!pathObj || typeof pathObj !== 'object') {
          errors.push(`Invalid path object for ${path}`);
          return;
        }

        const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
        const hasHttpMethod = httpMethods.some(method => pathObj[method]);
        
        if (!hasHttpMethod) {
          warnings.push(`Path ${path} has no HTTP operations defined`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Validate JSON schemas
  private validateJsonSchemas(schemas: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!schemas || typeof schemas !== 'object') {
      errors.push('Invalid schemas object');
      return { isValid: false, errors, warnings };
    }

    Object.entries(schemas).forEach(([name, schema]: [string, any]) => {
      if (!schema.type) {
        errors.push(`Schema ${name}: Missing required field: type`);
      }

      if (schema.type === 'object') {
        if (!schema.properties) {
          warnings.push(`Schema ${name}: Object type without properties defined`);
        }
        
        if (schema.required && !Array.isArray(schema.required)) {
          errors.push(`Schema ${name}: Required field must be an array`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Validate property test stubs
  private validatePropertyTestStubs(testStubs: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(testStubs)) {
      errors.push('Property test stubs must be an array');
      return { isValid: false, errors, warnings };
    }

    testStubs.forEach((stub: any, index: number) => {
      if (!stub.name) {
        errors.push(`Test stub ${index}: Missing required field: name`);
      }
      
      if (!stub.description) {
        errors.push(`Test stub ${index}: Missing required field: description`);
      }
      
      if (!stub.properties || !Array.isArray(stub.properties)) {
        errors.push(`Test stub ${index}: Properties must be an array`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Write contract files to /contracts directory
  private async writeContractFiles(
    openApiSpec: OpenApiSpec,
    jsonSchemas: Record<string, JsonSchema>,
    propertyTestStubs: PropertyTestStub[]
  ): Promise<ContractFiles> {
    try {
      const contractsDir = path.resolve(this.config!.workspaceRoot, 'contracts');
      
      // Ensure contracts directory exists
      if (!fs.existsSync(contractsDir)) {
        fs.mkdirSync(contractsDir, { recursive: true });
      }

      const contractFiles: ContractFiles = {};

      // Write OpenAPI spec as YAML
      if (openApiSpec) {
        const openApiPath = path.join(contractsDir, 'openapi.yaml');
        const yamlContent = yaml.dump(openApiSpec, { 
          indent: 2,
          lineWidth: 120,
          noRefs: true
        });
        fs.writeFileSync(openApiPath, yamlContent, 'utf-8');
        contractFiles.openApiFile = openApiPath;
      }

      // Write JSON schemas
      if (jsonSchemas && Object.keys(jsonSchemas).length > 0) {
        const schemasPath = path.join(contractsDir, 'schemas.json');
        fs.writeFileSync(schemasPath, JSON.stringify(jsonSchemas, null, 2), 'utf-8');
        contractFiles.schemasFile = schemasPath;
      }

      // Write property test stubs as TypeScript
      if (propertyTestStubs && propertyTestStubs.length > 0) {
        const testStubsPath = path.join(contractsDir, 'property-test-stubs.ts');
        const tsContent = this.generatePropertyTestStubsFile(propertyTestStubs);
        fs.writeFileSync(testStubsPath, tsContent, 'utf-8');
        contractFiles.testStubsFile = testStubsPath;
      }

      return contractFiles;
    } catch (error) {
      throw new Error(`Failed to write contract files: ${(error as Error).message}`);
    }
  }

  // Generate TypeScript file content for property test stubs
  private generatePropertyTestStubsFile(testStubs: PropertyTestStub[]): string {
    const header = `/**
 * Property-based test stubs generated from BDD scenarios
 * These stubs define the properties and invariants that must be tested
 * Use with property-based testing libraries like fast-check or JSVerify
 */

export interface PropertyTest {
  name: string;
  description: string;
  properties: string[];
  invariants?: string[];
  preconditions?: string[];
  postconditions?: string[];
}

`;

    const testDefinitions = testStubs.map(stub => {
      const properties = stub.properties.map(p => `    "${p}"`).join(',\n');
      const invariants = stub.invariants ? stub.invariants.map(i => `    "${i}"`).join(',\n') : '';
      const preconditions = stub.preconditions ? stub.preconditions.map(p => `    "${p}"`).join(',\n') : '';
      const postconditions = stub.postconditions ? stub.postconditions.map(p => `    "${p}"`).join(',\n') : '';

      return `export const ${stub.name}: PropertyTest = {
  name: "${stub.name}",
  description: "${stub.description}",
  properties: [
${properties}
  ]${invariants ? `,
  invariants: [
${invariants}
  ]` : ''}${preconditions ? `,
  preconditions: [
${preconditions}
  ]` : ''}${postconditions ? `,
  postconditions: [
${postconditions}
  ]` : ''}
};`;
    }).join('\n\n');

    const allTestsExport = `\nexport const ALL_PROPERTY_TESTS: PropertyTest[] = [
  ${testStubs.map(stub => stub.name).join(',\n  ')}
];`;

    return header + testDefinitions + allTestsExport;
  }

  // Update Cognitive Canvas with specification relationships
  private async updateCognitiveCanvas(contractFiles: ContractFiles, analysis: BDDAnalysis): Promise<void> {
    if (!this.cognitiveCanvas || !this.currentTask) {
      return;
    }

    try {
      const contractIds = [];

      // Create OpenAPI contract
      if (contractFiles.openApiFile) {
        const openApiContract = await this.cognitiveCanvas.createContract({
          id: `openapi-${this.currentTask.id}-${Date.now()}`,
          name: `OpenAPI Specification for ${this.currentTask.title}`,
          type: 'openapi',
          version: '3.0.0',
          specification: {
            filePath: contractFiles.openApiFile,
            apiOperations: analysis.apiOperations,
            securityRequirements: analysis.securityRequirements
          },
          description: `OpenAPI specification generated from BDD scenarios for ${this.currentTask.title}`,
          projectId: this.currentTask.projectId,
          createdAt: new Date().toISOString()
        });
        contractIds.push(openApiContract.id);
      }

      // Create JSON Schema contract
      if (contractFiles.schemasFile) {
        const schemasContract = await this.cognitiveCanvas.createContract({
          id: `schemas-${this.currentTask.id}-${Date.now()}`,
          name: `JSON Schemas for ${this.currentTask.title}`,
          type: 'json-schema',
          version: '1.0.0',
          specification: {
            filePath: contractFiles.schemasFile,
            dataModels: analysis.dataModels,
            businessRules: analysis.businessRules
          },
          description: `JSON schemas generated from BDD scenarios for ${this.currentTask.title}`,
          projectId: this.currentTask.projectId,
          createdAt: new Date().toISOString()
        });
        contractIds.push(schemasContract.id);
      }

      // Create Property Tests contract
      if (contractFiles.testStubsFile) {
        const testStubsContract = await this.cognitiveCanvas.createContract({
          id: `property-tests-${this.currentTask.id}-${Date.now()}`,
          name: `Property Test Stubs for ${this.currentTask.title}`,
          type: 'property-definition',
          version: '1.0.0',
          specification: {
            filePath: contractFiles.testStubsFile,
            businessRules: analysis.businessRules,
            stateTransitions: analysis.stateTransitions
          },
          description: `Property-based test stubs generated from BDD scenarios for ${this.currentTask.title}`,
          projectId: this.currentTask.projectId,
          createdAt: new Date().toISOString()
        });
        contractIds.push(testStubsContract.id);
      }

      // Link contracts to the original task/feature
      for (const contractId of contractIds) {
        await this.cognitiveCanvas.linkContractToFeature(contractId, this.currentTask.id);
      }

    } catch (error) {
      // Don't fail the main task if Cognitive Canvas update fails
      console.warn(`Failed to update Cognitive Canvas: ${(error as Error).message}`);
    }
  }

  // Utility method to capitalize first letter
  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}