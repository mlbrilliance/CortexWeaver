import * as path from 'path';
import { Agent, AgentConfig, TaskContext, TaskResult } from '../agent';

/**
 * Interface for architectural analysis results
 */
interface ArchitecturalAnalysis {
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
interface FormalContracts {
  openApiSpecs?: ContractFile[];
  jsonSchemas?: ContractFile[];
}

/**
 * Interface for individual contract files
 */
interface ContractFile {
  path: string;
  content: string;
}

/**
 * Interface for contract compliance tracking
 */
interface ContractCompliance {
  openApiCompliance: OpenApiCompliance[];
  schemaCompliance: SchemaCompliance[];
  overallScore: number;
}

/**
 * Interface for OpenAPI compliance details
 */
interface OpenApiCompliance {
  specPath: string;
  endpointsCovered: string[];
  missingEndpoints: string[];
  complianceScore: number;
}

/**
 * Interface for JSON Schema compliance details
 */
interface SchemaCompliance {
  schemaPath: string;
  modelsAligned: string[];
  missingModels: string[];
  complianceScore: number;
}

/**
 * Interface for architectural decisions
 */
interface ArchitecturalDecision {
  title: string;
  description: string;
  rationale: string;
  alternatives?: string[];
  consequences?: string[];
}

/**
 * ArchitectAgent specializes in system architecture design and technical specifications.
 * Extends the base Agent class to provide architectural design capabilities.
 */
export class ArchitectAgent extends Agent {
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
      const existingPatterns = await this.queryExistingPatterns();
      
      // Analyze requirements and generate architectural design
      const analysis = await this.generateArchitecturalDesign(existingPatterns);
      
      // Create design documentation files
      await this.createDesignDocumentation(analysis);
      
      // Store architectural decisions in Cognitive Canvas
      await this.storeArchitecturalDecisions(analysis.decisions);
      
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

  /**
   * Query Cognitive Canvas for existing architectural patterns and decisions
   */
  private async queryExistingPatterns(): Promise<{
    decisions: any[];
    similarTasks: any[];
  }> {
    if (!this.cognitiveCanvas || !this.currentTask) {
      return { decisions: [], similarTasks: [] };
    }

    try {
      const [decisions, similarTasks] = await Promise.all([
        this.cognitiveCanvas.getArchitecturalDecisionsByProject(this.currentTask.projectId),
        this.cognitiveCanvas.findSimilarTasks(this.currentTask.id, [this.currentTask.title, ...this.currentTask.description.split(' ').slice(0, 10)])
      ]);

      return { decisions, similarTasks };
    } catch (error) {
      console.warn('Failed to query existing patterns:', (error as Error).message);
      return { decisions: [], similarTasks: [] };
    }
  }

  /**
   * Generate comprehensive architectural design using Claude API
   */
  private async generateArchitecturalDesign(patterns: {
    decisions: any[];
    similarTasks: any[];
  }): Promise<ArchitecturalAnalysis> {
    // Process formal contracts if available
    const formalContracts = (this.taskContext as any)?.formalContracts as FormalContracts;
    const contractContext = this.buildContractContext(formalContracts);

    const prompt = this.formatPrompt(this.getPromptTemplate(), {
      task: this.currentTask!.description,
      context: JSON.stringify(this.taskContext, null, 2),
      projectName: this.taskContext?.projectInfo?.name || 'Unknown Project',
      existingDecisions: patterns.decisions.map(d => `- ${d.title}: ${d.description}`).join('\n'),
      similarPatterns: patterns.similarTasks.map(t => `- ${t.title}: ${t.description}`).join('\n'),
      ...contractContext
    });

    const systemPrompt = formalContracts ? 
      'You are an expert software architect specializing in contract-driven development. Provide detailed, practical architectural designs that align with formal contracts (OpenAPI specs, JSON schemas) while maintaining clear documentation and visual diagrams.' :
      'You are an expert software architect. Provide detailed, practical architectural designs with clear documentation and visual diagrams.';

    const response = await this.sendToClaude(prompt, {
      maxTokens: 8000,
      temperature: 0.3,
      systemPrompt
    });

    const analysis = this.parseArchitecturalResponse(response.content);
    
    // Add contract compliance analysis if contracts were provided
    if (formalContracts) {
      analysis.contractCompliance = this.analyzeContractCompliance(formalContracts, analysis);
    }

    return analysis;
  }

  /**
   * Parse Claude's response into structured architectural analysis
   */
  private parseArchitecturalResponse(content: string): ArchitecturalAnalysis {
    // Extract Mermaid diagrams
    const mermaidMatches = content.match(/```mermaid\n([\s\S]*?)\n```/g);
    const mermaidDiagram = mermaidMatches ? mermaidMatches.join('\n\n') : '';

    // Extract OpenAPI specifications
    const apiMatches = content.match(/```(?:yaml|yml)\n([\s\S]*?)\n```/g);
    const apiSpec = apiMatches ? apiMatches.join('\n\n') : '';

    // Extract architectural decisions (look for decision sections)
    const decisions = this.extractArchitecturalDecisions(content);

    // Extract data models (look for schema/model sections)
    const dataModels = this.extractDataModels(content);

    return {
      designDocument: content,
      mermaidDiagram,
      apiSpec,
      dataModels,
      decisions
    };
  }

  /**
   * Extract architectural decisions from the design document
   */
  private extractArchitecturalDecisions(content: string): ArchitecturalDecision[] {
    const decisions: ArchitecturalDecision[] = [];
    
    // Look for sections that indicate architectural decisions
    const decisionPattern = /(?:## (?:Decision|Choice|Architectural Decision)[:\s]*(.+?)(?:\n|$))([\s\S]*?)(?=\n## |$)/gi;
    let match;

    while ((match = decisionPattern.exec(content)) !== null) {
      const title = match[1]?.trim() || 'Architectural Decision';
      const description = match[2]?.trim() || '';
      
      decisions.push({
        title,
        description,
        rationale: this.extractRationale(description),
        alternatives: this.extractAlternatives(description),
        consequences: this.extractConsequences(description)
      });
    }

    // If no explicit decisions found, create one from the main content
    if (decisions.length === 0) {
      decisions.push({
        title: this.currentTask?.title || 'System Architecture',
        description: content.substring(0, 500) + '...',
        rationale: 'Based on requirements analysis and best practices'
      });
    }

    return decisions;
  }

  /**
   * Extract data models from the design document
   */
  private extractDataModels(content: string): Record<string, any> {
    const models: Record<string, any> = {};

    // Look for database schemas, table definitions, etc.
    const schemaPattern = /(?:table|model|schema)[:\s]+(\w+)[\s\S]*?(?=\n(?:table|model|schema|##)|$)/gi;
    let match;

    while ((match = schemaPattern.exec(content)) !== null) {
      const modelName = match[1];
      const definition = match[0];
      models[modelName] = {
        definition,
        extracted: true
      };
    }

    // If no explicit models found, create a generic structure
    if (Object.keys(models).length === 0) {
      models.generic = {
        description: 'Data models as described in the architectural design',
        source: 'architectural_design'
      };
    }

    return models;
  }

  /**
   * Extract rationale from decision content
   */
  private extractRationale(content: string): string {
    const rationaleMatch = content.match(/(?:rationale|reason|why)[:\s]*(.*?)(?:\n|$)/i);
    return rationaleMatch ? rationaleMatch[1].trim() : 'Design decision based on architectural requirements';
  }

  /**
   * Extract alternatives from decision content
   */
  private extractAlternatives(content: string): string[] {
    const alternativesMatch = content.match(/(?:alternatives?|options?)[:\s]*(.*?)(?:\n|$)/i);
    if (alternativesMatch) {
      return alternativesMatch[1].split(',').map(alt => alt.trim()).filter(alt => alt.length > 0);
    }
    return [];
  }

  /**
   * Extract consequences from decision content
   */
  private extractConsequences(content: string): string[] {
    const consequencesMatch = content.match(/(?:consequences?|implications?)[:\s]*(.*?)(?:\n|$)/i);
    if (consequencesMatch) {
      return consequencesMatch[1].split(',').map(cons => cons.trim()).filter(cons => cons.length > 0);
    }
    return [];
  }

  /**
   * Create design documentation files in the worktree
   */
  private async createDesignDocumentation(analysis: ArchitecturalAnalysis): Promise<void> {
    if (!this.currentTask) {
      throw new Error('No current task available');
    }

    try {
      // Get worktree path
      const worktreePath = this.workspace?.getWorktreePath(this.currentTask.id) || this.config?.workspaceRoot || '';
      const designFilePath = path.join(worktreePath, 'DESIGN.md');

      // Create comprehensive design document
      const designContent = this.formatDesignDocument(analysis);

      // Write DESIGN.md file
      await this.writeFile('DESIGN.md', designContent);

      // Create additional files if API spec or data models are significant
      if (analysis.apiSpec.length > 100) {
        await this.writeFile('api-spec.yaml', analysis.apiSpec);
      }

      if (Object.keys(analysis.dataModels).length > 1) {
        await this.writeFile('data-models.json', JSON.stringify(analysis.dataModels, null, 2));
      }

    } catch (error) {
      throw new Error(`Failed to create design documentation: ${(error as Error).message}`);
    }
  }

  /**
   * Format the complete design document
   */
  private formatDesignDocument(analysis: ArchitecturalAnalysis): string {
    const timestamp = new Date().toISOString();
    const taskTitle = this.currentTask?.title || 'Architectural Design';
    const formalContracts = (this.taskContext as any)?.formalContracts as FormalContracts;

    let document = `# Architectural Design: ${taskTitle}

*Generated on: ${timestamp}*
*Task ID: ${this.currentTask?.id}*
${formalContracts ? '*Contract-Driven Design: Yes*' : ''}

## Overview

${analysis.designDocument}

## Mermaid Diagrams

${analysis.mermaidDiagram}

## API Specifications

${analysis.apiSpec}

## Data Models

\`\`\`json
${JSON.stringify(analysis.dataModels, null, 2)}
\`\`\`

## Architectural Decisions

${analysis.decisions.map(decision => `
### ${decision.title}

**Description:** ${decision.description}

**Rationale:** ${decision.rationale}

${decision.alternatives && decision.alternatives.length > 0 ? `**Alternatives:** ${decision.alternatives.join(', ')}` : ''}

${decision.consequences && decision.consequences.length > 0 ? `**Consequences:** ${decision.consequences.join(', ')}` : ''}
`).join('\n')}`;

    // Add contract compliance section if available
    if (analysis.contractCompliance) {
      document += this.formatContractComplianceSection(analysis.contractCompliance, formalContracts!);
    }

    document += `

---
*This document was generated by the CortexWeaver Architect Agent.*
`;

    return document;
  }

  /**
   * Format contract compliance section for the design document
   */
  private formatContractComplianceSection(compliance: ContractCompliance, contracts: FormalContracts): string {
    let section = `

## Contract Compliance Analysis

**Overall Compliance Score: ${(compliance.overallScore * 100).toFixed(1)}%**

`;

    if (compliance.openApiCompliance.length > 0) {
      section += `### OpenAPI Specification Compliance

`;
      compliance.openApiCompliance.forEach(apiComp => {
        section += `#### ${apiComp.specPath}
`;
        section += `- **Compliance Score:** ${(apiComp.complianceScore * 100).toFixed(1)}%\n`;
        section += `- **Endpoints Covered:** ${apiComp.endpointsCovered.length > 0 ? apiComp.endpointsCovered.join(', ') : 'None'}\n`;
        if (apiComp.missingEndpoints.length > 0) {
          section += `- **Missing Endpoints:** ${apiComp.missingEndpoints.join(', ')}\n`;
        }
        section += `\n`;
      });
    }

    if (compliance.schemaCompliance.length > 0) {
      section += `### JSON Schema Compliance

`;
      compliance.schemaCompliance.forEach(schemaComp => {
        section += `#### ${schemaComp.schemaPath}
`;
        section += `- **Compliance Score:** ${(schemaComp.complianceScore * 100).toFixed(1)}%\n`;
        section += `- **Models Aligned:** ${schemaComp.modelsAligned.length > 0 ? schemaComp.modelsAligned.join(', ') : 'None'}\n`;
        if (schemaComp.missingModels.length > 0) {
          section += `- **Missing Models:** ${schemaComp.missingModels.join(', ')}\n`;
        }
        section += `\n`;
      });
    }

    // Add recommendations for improvement
    const lowComplianceItems = [
      ...compliance.openApiCompliance.filter(comp => comp.complianceScore < 0.8),
      ...compliance.schemaCompliance.filter(comp => comp.complianceScore < 0.8)
    ];

    if (lowComplianceItems.length > 0) {
      section += `### Recommendations for Improvement

`;
      section += `The following contract files have compliance scores below 80% and may need attention:\n\n`;
      lowComplianceItems.forEach(item => {
        const path = 'specPath' in item ? item.specPath : item.schemaPath;
        section += `- **${path}**: Consider reviewing the design to ensure all contract requirements are addressed\n`;
      });
    }

    return section;
  }

  /**
   * Build contract context for prompt template
   */
  private buildContractContext(formalContracts?: FormalContracts): Record<string, string> {
    if (!formalContracts) {
      return {
        contractSection: '',
        contractComplianceSection: '',
        contractRequirements: '',
        contractComplianceFormat: ''
      };
    }

    const hasOpenApi = formalContracts.openApiSpecs && formalContracts.openApiSpecs.length > 0;
    const hasSchemas = formalContracts.jsonSchemas && formalContracts.jsonSchemas.length > 0;

    let contractSection = 'FORMAL CONTRACTS PROVIDED:\n';
    
    if (hasOpenApi) {
      contractSection += 'OpenAPI Specifications:\n';
      formalContracts.openApiSpecs!.forEach(spec => {
        contractSection += `- ${spec.path}\n`;
        // Include a preview of the contract content (first 500 chars)
        const preview = spec.content.substring(0, 500).replace(/\n/g, '\n  ');
        contractSection += `  Content preview:\n  ${preview}${spec.content.length > 500 ? '...' : ''}\n\n`;
      });
    }

    if (hasSchemas) {
      contractSection += 'JSON Schemas:\n';
      formalContracts.jsonSchemas!.forEach(schema => {
        contractSection += `- ${schema.path}\n`;
        // Include a preview of the schema content (first 300 chars)
        const preview = schema.content.substring(0, 300).replace(/\n/g, '\n  ');
        contractSection += `  Content preview:\n  ${preview}${schema.content.length > 300 ? '...' : ''}\n\n`;
      });
    }

    return {
      contractSection,
      contractComplianceSection: '7. **Contract Compliance**: Analysis of how the design aligns with provided formal contracts',
      contractRequirements: `- ENSURE all provided OpenAPI endpoints are covered in the design\n- ALIGN data models with provided JSON schemas\n- VALIDATE that the architecture can satisfy all contract requirements\n- DOCUMENT any deviations or limitations in contract compliance`,
      contractComplianceFormat: '- Contract compliance analysis with specific coverage details\n- Mapping between contracts and architectural components'
    };
  }

  /**
   * Analyze contract compliance of the architectural design
   */
  private analyzeContractCompliance(formalContracts: FormalContracts, analysis: ArchitecturalAnalysis): ContractCompliance {
    const openApiCompliance: OpenApiCompliance[] = [];
    const schemaCompliance: SchemaCompliance[] = [];

    // Analyze OpenAPI specifications
    if (formalContracts.openApiSpecs) {
      for (const spec of formalContracts.openApiSpecs) {
        try {
          const endpoints = this.extractEndpointsFromOpenApi(spec.content);
          const coveredEndpoints = this.findCoveredEndpoints(endpoints, analysis.designDocument);
          const missingEndpoints = endpoints.filter(ep => !coveredEndpoints.includes(ep));
          
          openApiCompliance.push({
            specPath: spec.path,
            endpointsCovered: coveredEndpoints,
            missingEndpoints,
            complianceScore: endpoints.length > 0 ? (coveredEndpoints.length / endpoints.length) : 1
          });
        } catch (error) {
          console.warn(`Failed to analyze OpenAPI spec ${spec.path}:`, (error as Error).message);
          openApiCompliance.push({
            specPath: spec.path,
            endpointsCovered: [],
            missingEndpoints: [],
            complianceScore: 0
          });
        }
      }
    }

    // Analyze JSON schemas
    if (formalContracts.jsonSchemas) {
      for (const schema of formalContracts.jsonSchemas) {
        try {
          const models = this.extractModelsFromSchema(schema.content);
          const alignedModels = this.findAlignedModels(models, analysis.dataModels);
          const missingModels = models.filter(model => !alignedModels.includes(model));
          
          schemaCompliance.push({
            schemaPath: schema.path,
            modelsAligned: alignedModels,
            missingModels,
            complianceScore: models.length > 0 ? (alignedModels.length / models.length) : 1
          });
        } catch (error) {
          console.warn(`Failed to analyze JSON schema ${schema.path}:`, (error as Error).message);
          schemaCompliance.push({
            schemaPath: schema.path,
            modelsAligned: [],
            missingModels: [],
            complianceScore: 0
          });
        }
      }
    }

    // Calculate overall compliance score
    const allCompliance = [...openApiCompliance, ...schemaCompliance];
    const overallScore = allCompliance.length > 0 ? 
      allCompliance.reduce((sum, comp) => sum + comp.complianceScore, 0) / allCompliance.length : 1;

    return {
      openApiCompliance,
      schemaCompliance,
      overallScore
    };
  }

  /**
   * Extract endpoints from OpenAPI specification content
   */
  private extractEndpointsFromOpenApi(content: string): string[] {
    const endpoints: string[] = [];
    
    try {
      // Simple regex-based extraction for paths section
      const pathsMatch = content.match(/paths:\s*([\s\S]*?)(?=\n\w|$)/);
      if (pathsMatch) {
        const pathsSection = pathsMatch[1];
        const pathMatches = pathsSection.match(/^\s*([^\s:]+):/gm);
        if (pathMatches) {
          pathMatches.forEach(match => {
            const path = match.replace(/^\s*/, '').replace(/:$/, '');
            if (path.startsWith('/')) {
              endpoints.push(path);
            }
          });
        }
      }
    } catch (error) {
      console.warn('Failed to extract endpoints from OpenAPI spec:', (error as Error).message);
    }

    return endpoints;
  }

  /**
   * Find covered endpoints in the design document
   */
  private findCoveredEndpoints(endpoints: string[], designDocument: string): string[] {
    return endpoints.filter(endpoint => {
      // Check if the endpoint path is mentioned in the design document
      const escapedEndpoint = endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedEndpoint, 'i');
      return regex.test(designDocument);
    });
  }

  /**
   * Extract model names from JSON schema
   */
  private extractModelsFromSchema(content: string): string[] {
    const models: string[] = [];
    
    try {
      const schema = JSON.parse(content);
      if (schema.title) {
        models.push(schema.title);
      } else if (schema.properties) {
        // If no title, use 'Schema' as default model name
        models.push('Schema');
      }
    } catch (error) {
      console.warn('Failed to parse JSON schema:', (error as Error).message);
    }

    return models;
  }

  /**
   * Find aligned models in the data models
   */
  private findAlignedModels(schemaModels: string[], dataModels: Record<string, any>): string[] {
    const alignedModels: string[] = [];
    const dataModelNames = Object.keys(dataModels);
    
    schemaModels.forEach(schemaModel => {
      // Check for exact match or partial match
      const found = dataModelNames.find(dataModel => 
        dataModel.toLowerCase().includes(schemaModel.toLowerCase()) ||
        schemaModel.toLowerCase().includes(dataModel.toLowerCase())
      );
      if (found) {
        alignedModels.push(schemaModel);
      }
    });

    return alignedModels;
  }

  /**
   * Store architectural decisions in Cognitive Canvas
   */
  private async storeArchitecturalDecisions(decisions: ArchitecturalDecision[]): Promise<void> {
    if (!this.cognitiveCanvas || !this.currentTask) {
      return;
    }

    try {
      for (const decision of decisions) {
        await this.cognitiveCanvas.storeArchitecturalDecision({
          id: `decision-${this.currentTask.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          projectId: this.currentTask.projectId,
          title: decision.title,
          description: decision.description,
          rationale: decision.rationale,
          status: 'approved',
          createdAt: new Date().toISOString()
        });
      }

      // Create pheromone for architectural work completion
      const formalContracts = (this.taskContext as any)?.formalContracts as FormalContracts;
      await this.cognitiveCanvas.createPheromone({
        id: `arch-${this.currentTask.id}-${Date.now()}`,
        type: 'architectural',
        strength: 0.8,
        context: 'design_completed',
        metadata: {
          taskId: this.currentTask.id,
          projectId: this.currentTask.projectId,
          agentId: this.config?.id,
          decisionsCount: decisions.length,
          designType: 'system_architecture',
          contractDriven: !!formalContracts,
          hasOpenApiSpecs: !!(formalContracts?.openApiSpecs?.length),
          hasJsonSchemas: !!(formalContracts?.jsonSchemas?.length)
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7200000).toISOString() // 2 hours
      });

    } catch (error) {
      console.warn('Failed to store architectural decisions:', (error as Error).message);
    }
  }
}