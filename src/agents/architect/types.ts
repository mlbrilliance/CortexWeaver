/**
 * Architect Agent Types
 * 
 * Contains all type definitions and interfaces used by the Architect Agent
 */

/**
 * Interface for architectural analysis results
 */
export interface ArchitecturalAnalysis {
  designDocument: string;
  mermaidDiagram: string;
  apiSpec: string;
  dataModels: Record<string, any>;
  decisions: ArchitecturalDecision[];
  contractCompliance?: ContractCompliance;
}

/**
 * Interface for formal contract files
 */
export interface FormalContracts {
  openApiSpecs?: ContractFile[];
  jsonSchemas?: ContractFile[];
}

/**
 * Interface for individual contract files
 */
export interface ContractFile {
  path: string;
  content: string;
}

/**
 * Interface for contract compliance tracking
 */
export interface ContractCompliance {
  openApiCompliance: OpenApiCompliance[];
  schemaCompliance: SchemaCompliance[];
  overallScore: number;
}

/**
 * Interface for OpenAPI compliance details
 */
export interface OpenApiCompliance {
  specPath: string;
  endpointsCovered: string[];
  missingEndpoints: string[];
  complianceScore: number;
}

/**
 * Interface for JSON Schema compliance details
 */
export interface SchemaCompliance {
  schemaPath: string;
  modelsAligned: string[];
  missingModels: string[];
  complianceScore: number;
}

/**
 * Interface for architectural decisions
 */
export interface ArchitecturalDecision {
  title: string;
  description: string;
  rationale: string;
  alternatives?: string[];
  consequences?: string[];
}

/**
 * Interface for existing patterns from Cognitive Canvas
 */
export interface ExistingPatterns {
  decisions: any[];
  similarTasks: any[];
}

/**
 * Interface for contract context used in prompt templates
 */
export interface ContractContext {
  contractSection: string;
  contractComplianceSection: string;
  contractRequirements: string;
  contractComplianceFormat: string;
}