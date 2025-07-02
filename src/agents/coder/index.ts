import { CoderAgentImplementation } from './coder-agent';

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
 * Interface for architectural design from Architect agent
 */
export interface ArchitecturalDesign {
  designDocument: string;
  mermaidDiagram?: string;
  apiSpec?: string;
  dataModels?: Record<string, any>;
  decisions?: any[];
  contractCompliance?: any;
}

export interface CodeAttempt {
  code: string;
  timestamp: string;
  attemptNumber: number;
  errors?: string[];
}

export interface CoderResult {
  codeGenerated: boolean;
  testsGenerated: boolean;
  commitCreated: boolean;
  compilationSuccessful: boolean;
  testsPassedSuccessful: boolean;
  codeAttempts: CodeAttempt[];
  finalCode?: string;
  finalTests?: string;
  commitHash?: string;
}

/**
 * CoderAgent specializes in code implementation, testing, and version control
 * Implements impasse detection after 2 failed attempts at compilation or testing
 */
export class CoderAgent extends CoderAgentImplementation {
  // Inherits all functionality from CoderAgentImplementation
  // This allows for easy extension and testing while maintaining a clean public interface
  
  /**
   * Get prompt template for the coder agent
   */
  getPromptTemplate(): string {
    return super.getPromptTemplate();
  }
}

// Re-export implementation for testing and extensibility
export { CoderAgentImplementation };