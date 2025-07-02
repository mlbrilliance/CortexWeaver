import { FormalContracts, ArchitecturalDesign, ContractFile } from './index';

/**
 * ContractBuilder handles building contract context for prompts
 */
export class ContractBuilder {
  /**
   * Build contract context for code generation prompts
   */
  static buildContractContext(formalContracts?: FormalContracts): Record<string, string> {
    if (!formalContracts) {
      return {
        contractSection: '',
        contractRequirements: ''
      };
    }

    const hasOpenApi = formalContracts.openApiSpecs && formalContracts.openApiSpecs.length > 0;
    const hasSchemas = formalContracts.jsonSchemas && formalContracts.jsonSchemas.length > 0;

    let contractSection = 'FORMAL CONTRACTS TO IMPLEMENT:\n';
    let contractRequirements = '8. ENSURE implementation satisfies all provided formal contracts\n';
    
    if (hasOpenApi) {
      contractSection += 'OpenAPI Specifications:\n';
      formalContracts.openApiSpecs!.forEach(spec => {
        contractSection += `- ${spec.path}\n`;
        const preview = spec.content.substring(0, 800).replace(/\n/g, '\n  ');
        contractSection += `  Contract content:\n  ${preview}${spec.content.length > 800 ? '...' : ''}\n\n`;
      });
      contractRequirements += '9. IMPLEMENT all endpoints specified in OpenAPI contracts\n';
      contractRequirements += '10. ENSURE response formats match OpenAPI schema definitions\n';
      contractRequirements += '11. VALIDATE request/response data against contract specifications\n';
    }

    if (hasSchemas) {
      contractSection += 'JSON Schemas for Data Models:\n';
      formalContracts.jsonSchemas!.forEach(schema => {
        contractSection += `- ${schema.path}\n`;
        const preview = schema.content.substring(0, 500).replace(/\n/g, '\n  ');
        contractSection += `  Schema content:\n  ${preview}${schema.content.length > 500 ? '...' : ''}\n\n`;
      });
      contractRequirements += '12. ALIGN data models with provided JSON schemas\n';
      contractRequirements += '13. INCLUDE proper validation based on schema constraints\n';
    }

    return { contractSection, contractRequirements };
  }

  /**
   * Build architectural design context for code generation prompts
   */
  static buildArchitecturalContext(architecturalDesign?: ArchitecturalDesign): Record<string, string> {
    if (!architecturalDesign) {
      return {
        architecturalDesignSection: ''
      };
    }

    let architecturalDesignSection = 'ARCHITECTURAL DESIGN TO FOLLOW:\n';
    architecturalDesignSection += `Design Document:\n${architecturalDesign.designDocument.substring(0, 1000)}${architecturalDesign.designDocument.length > 1000 ? '...' : ''}\n\n`;
    
    if (architecturalDesign.apiSpec) {
      architecturalDesignSection += `API Specifications:\n${architecturalDesign.apiSpec.substring(0, 500)}${architecturalDesign.apiSpec.length > 500 ? '...' : ''}\n\n`;
    }
    
    if (architecturalDesign.dataModels && Object.keys(architecturalDesign.dataModels).length > 0) {
      architecturalDesignSection += `Data Models:\n${JSON.stringify(architecturalDesign.dataModels, null, 2).substring(0, 400)}...\n\n`;
    }

    return { architecturalDesignSection };
  }

  /**
   * Build contract testing context for test generation prompts
   */
  static buildContractTestContext(formalContracts?: FormalContracts): Record<string, string> {
    if (!formalContracts) {
      return {
        contractTestSection: '',
        contractTestRequirements: ''
      };
    }

    const hasOpenApi = formalContracts.openApiSpecs && formalContracts.openApiSpecs.length > 0;
    const hasSchemas = formalContracts.jsonSchemas && formalContracts.jsonSchemas.length > 0;

    let contractTestSection = 'CONTRACT COMPLIANCE TESTING:\n';
    let contractTestRequirements = '- INCLUDE tests that validate contract compliance\n';
    
    if (hasOpenApi) {
      contractTestSection += 'Test OpenAPI Contract Compliance:\n';
      formalContracts.openApiSpecs!.forEach(spec => {
        contractTestSection += `- Validate endpoints from ${spec.path}\n`;
        contractTestSection += `- Test response formats match OpenAPI schemas\n`;
        contractTestSection += `- Verify HTTP status codes align with contract\n`;
      });
      contractTestRequirements += '- TEST that API endpoints return correct status codes per OpenAPI spec\n';
      contractTestRequirements += '- VALIDATE response schemas match OpenAPI definitions\n';
      contractTestRequirements += '- TEST request validation according to OpenAPI parameters\n';
    }

    if (hasSchemas) {
      contractTestSection += 'Test JSON Schema Compliance:\n';
      formalContracts.jsonSchemas!.forEach(schema => {
        contractTestSection += `- Validate data models against ${schema.path}\n`;
        contractTestSection += `- Test schema validation and constraints\n`;
      });
      contractTestRequirements += '- TEST data model validation against JSON schemas\n';
      contractTestRequirements += '- VERIFY required fields and data types per schemas\n';
    }

    return { contractTestSection, contractTestRequirements };
  }
}
