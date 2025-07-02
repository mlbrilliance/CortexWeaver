/**
 * Architect Agent Core Logic
 * 
 * Contains the main architectural design logic and analysis functionality
 */

import { Agent } from '../../agent';
import { 
  ArchitecturalAnalysis, 
  ArchitecturalDecision, 
  FormalContracts, 
  ContractCompliance,
  OpenApiCompliance,
  SchemaCompliance,
  ExistingPatterns,
  ContractContext
} from './types';

export class ArchitectCore {
  constructor(private agent: Agent) {}

  /**
   * Query Cognitive Canvas for existing architectural patterns and decisions
   */
  async queryExistingPatterns(): Promise<ExistingPatterns> {
    const cognitiveCanvas = this.agent.getCognitiveCanvas();
    const currentTask = this.agent.getCurrentTask();
    if (!cognitiveCanvas || !currentTask) {
      return { decisions: [], similarTasks: [] };
    }

    try {
      const [decisions, similarTasks] = await Promise.all([
        cognitiveCanvas.getArchitecturalDecisionsByProject(currentTask.projectId),
        cognitiveCanvas.findSimilarTasks(
          currentTask.id, 
          [currentTask.title, ...currentTask.description.split(' ').slice(0, 10)]
        )
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
  async generateArchitecturalDesign(patterns: ExistingPatterns): Promise<ArchitecturalAnalysis> {
    // Process formal contracts if available
    const taskContext = this.agent.getTaskContext();
    const formalContracts = (taskContext as any)?.formalContracts as FormalContracts;
    const contractContext = this.buildContractContext(formalContracts);

    const currentTask = this.agent.getCurrentTask()!;
    const prompt = this.agent.formatPrompt(this.getPromptTemplate(), {
      task: currentTask.description,
      context: JSON.stringify(taskContext, null, 2),
      projectName: taskContext?.projectInfo?.name || 'Unknown Project',
      existingDecisions: patterns.decisions.map(d => `- ${d.title}: ${d.description}`).join('\n'),
      similarPatterns: patterns.similarTasks.map(t => `- ${t.title}: ${t.description}`).join('\n'),
      ...contractContext
    });

    const systemPrompt = formalContracts ? 
      'You are an expert software architect specializing in contract-driven development. Provide detailed, practical architectural designs that align with formal contracts (OpenAPI specs, JSON schemas) while maintaining clear documentation and visual diagrams.' :
      'You are an expert software architect. Provide detailed, practical architectural designs with clear documentation and visual diagrams.';

    const response = await this.agent.sendToClaude(prompt, {
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
   * Get architect-specific prompt template
   */
  private getPromptTemplate(): string {
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
      
      const { alternatives, consequences } = this.extractDecisionDetails(description);
      decisions.push({
        title,
        description,
        rationale: this.extractRationale(description),
        alternatives,
        consequences
      });
    }

    // If no explicit decisions found, create one from the main content
    if (decisions.length === 0) {
      const currentTask = this.agent.getCurrentTask();
      decisions.push({
        title: currentTask?.title || 'System Architecture',
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
   * Extract alternatives and consequences from decision content
   */
  private extractDecisionDetails(content: string): { alternatives: string[]; consequences: string[] } {
    const alternativesMatch = content.match(/(?:alternatives?|options?)[:\s]*(.*?)(?:\n|$)/i);
    const alternatives = alternativesMatch ? 
      alternativesMatch[1].split(',').map(alt => alt.trim()).filter(alt => alt.length > 0) : [];

    const consequencesMatch = content.match(/(?:consequences?|implications?)[:\s]*(.*?)(?:\n|$)/i);
    const consequences = consequencesMatch ? 
      consequencesMatch[1].split(',').map(cons => cons.trim()).filter(cons => cons.length > 0) : [];

    return { alternatives, consequences };
  }

  /**
   * Build contract context for prompt template
   */
  private buildContractContext(formalContracts?: FormalContracts): ContractContext {
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
  async storeArchitecturalDecisions(decisions: ArchitecturalDecision[]): Promise<void> {
    const cognitiveCanvas = this.agent.getCognitiveCanvas();
    const currentTask = this.agent.getCurrentTask();
    if (!cognitiveCanvas || !currentTask) {
      return;
    }

    try {
      for (const decision of decisions) {
        await cognitiveCanvas.storeArchitecturalDecision({
          id: `decision-${currentTask.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          projectId: currentTask.projectId,
          title: decision.title,
          description: decision.description,
          rationale: decision.rationale,
          status: 'approved',
          createdAt: new Date().toISOString()
        });
      }

      // Create pheromone for architectural work completion
      const taskContext = this.agent.getTaskContext();
      const formalContracts = (taskContext as any)?.formalContracts as FormalContracts;
      await cognitiveCanvas.createPheromone({
        id: `arch-${currentTask.id}-${Date.now()}`,
        type: 'architectural',
        strength: 0.8,
        context: 'design_completed',
        metadata: {
          taskId: currentTask.id,
          projectId: currentTask.projectId,
          agentId: this.agent.getConfig()?.id,
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