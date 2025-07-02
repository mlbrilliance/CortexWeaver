/**
 * Architect Agent - Main Entry Point
 * 
 * This file serves as the main entry point for the Architect Agent, now refactored
 * to use a modular structure to maintain the 500-line limit per file.
 * 
 * Modular structure:
 * - architect/types.ts - All interfaces and type definitions
 * - architect/core.ts - Main architectural design logic and analysis
 * - architect/documentation.ts - Documentation generation and file operations
 */

import { Agent, AgentConfig, TaskContext, TaskResult } from '../agent';
import { ArchitectCore } from './architect/core';
import { ArchitectDocumentation } from './architect/documentation';
import { ArchitecturalAnalysis } from './architect/types';

/**
 * ArchitectAgent specializes in system architecture design and technical specifications.
 * Extends the base Agent class to provide architectural design capabilities.
 */
export class ArchitectAgent extends Agent {
  private core: ArchitectCore;
  private documentation: ArchitectDocumentation;

  constructor(config: AgentConfig) {
    super();
    this.initialize(config);
    this.core = new ArchitectCore(this);
    this.documentation = new ArchitectDocumentation(this);
  }

  /**
   * Execute architectural design task
   * Main entry point for processing architectural design requests
   */
  async executeTask(): Promise<ArchitecturalAnalysis> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    // Validate task specification
    this.validateTaskSpecification();

    await this.reportProgress('started', 'Beginning architectural analysis');

    try {
      // Query Cognitive Canvas for existing patterns and decisions
      const existingPatterns = await this.core.queryExistingPatterns();
      
      // Analyze requirements and generate architectural design
      const analysis = await this.core.generateArchitecturalDesign(existingPatterns);
      
      // Create design documentation files
      await this.documentation.createDesignDocumentation(analysis);
      
      // Store architectural decisions in Cognitive Canvas
      await this.core.storeArchitecturalDecisions(analysis.decisions);
      
      await this.reportProgress('completed', 'Architectural design completed');
      
      return analysis;
    } catch (error) {
      await this.reportProgress('error', `Architectural analysis failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get architect-specific prompt template
   * Returns a comprehensive template for architectural design tasks
   */
  getPromptTemplate(): string {
    return `You are an expert software architect tasked with creating comprehensive architectural designs.

TASK: {{task}}
CONTEXT: {{context}}
PROJECT: {{projectName}}

{{contractSection}}

Please provide a detailed architectural design that includes:

1. **System Overview**: High-level description of the system architecture
2. **Component Design**: Individual components and their responsibilities
3. **Data Models**: Database schemas and data structures
4. **API Specifications**: RESTful endpoints and contracts (OpenAPI format when applicable)
5. **Mermaid Diagrams**: Visual representations of the architecture
6. **Architectural Decisions**: Key design decisions with rationale
{{contractComplianceSection}}

## Requirements:
- Use Mermaid.js syntax for all diagrams
- Provide OpenAPI 3.0 specifications for APIs
- Include database schemas with proper relationships
- Consider scalability, security, and maintainability
- Document decision rationale and trade-offs
{{contractRequirements}}

## Output Format:
Structure your response with clear sections and include:
- Component diagrams using Mermaid syntax
- API endpoint specifications
- Database schema definitions
- Architectural decision records
{{contractComplianceFormat}}

Focus on creating a DESIGN.md file content that will be saved to the project worktree.

Previous architectural decisions for this project:
{{existingDecisions}}

Similar patterns found:
{{similarPatterns}}`;
  }

  /**
   * Validate task specification for architectural work
   */
  private validateTaskSpecification(): void {
    if (!this.currentTask?.title?.trim() || !this.currentTask?.description?.trim()) {
      throw new Error('Invalid task specification: title and description are required');
    }
  }
}

// Re-export types for external use
export type { 
  ArchitecturalAnalysis, 
  ArchitecturalDecision, 
  FormalContracts,
  ContractFile,
  ContractCompliance,
  OpenApiCompliance,
  SchemaCompliance
} from './architect/types';