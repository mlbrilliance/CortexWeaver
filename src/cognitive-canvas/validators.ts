export class CognitiveCanvasValidators {
  static validateRequiredFields(data: any, fields: string[], type: string): void {
    if (!fields.every(field => data[field] !== undefined && data[field] !== null)) {
      throw new Error(`Missing required ${type} fields: ${fields.join(', ')}`);
    }
  }

  static validateProjectData(data: any): void {
    this.validateRequiredFields(data, ['id', 'name', 'description', 'status', 'createdAt'], 'project');
  }

  static validateTaskData(data: any): void {
    this.validateRequiredFields(data, ['id', 'title', 'description', 'status', 'priority', 'projectId', 'createdAt'], 'task');
  }

  static validateAgentData(data: any): void {
    this.validateRequiredFields(data, ['id', 'name', 'role', 'capabilities', 'status', 'createdAt'], 'agent');
  }

  static validatePheromoneData(data: any): void {
    this.validateRequiredFields(data, ['id', 'type', 'strength', 'context', 'metadata', 'createdAt', 'expiresAt'], 'pheromone');
  }

  static validateArchitecturalDecisionData(data: any): void {
    this.validateRequiredFields(data, ['id', 'title', 'description', 'rationale', 'status', 'projectId', 'createdAt'], 'architectural decision');
  }

  static validateContractData(data: any): void {
    this.validateRequiredFields(data, ['id', 'name', 'type', 'version', 'specification', 'projectId', 'createdAt'], 'contract');
    const validTypes = ['openapi', 'json-schema', 'property-definition'];
    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid contract type: ${data.type}. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  static validateCodeModuleData(data: any): void {
    this.validateRequiredFields(data, ['id', 'name', 'filePath', 'type', 'language', 'projectId', 'createdAt'], 'code module');
    const validTypes = ['function', 'class', 'module', 'component'];
    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid code module type: ${data.type}. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  static validateTestData(data: any): void {
    this.validateRequiredFields(data, ['id', 'name', 'filePath', 'type', 'framework', 'projectId', 'createdAt'], 'test');
    const validTypes = ['unit', 'integration', 'e2e', 'contract'];
    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid test type: ${data.type}. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  static validateArtifactData(data: any): void {
    this.validateRequiredFields(data, ['id', 'type', 'name', 'data', 'projectId', 'createdAt'], 'artifact');
  }

  static validateFailureData(data: any): void {
    this.validateRequiredFields(data, ['id', 'message', 'context', 'severity', 'projectId', 'createdAt'], 'failure');
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(data.severity)) {
      throw new Error(`Invalid failure severity: ${data.severity}. Must be one of: ${validSeverities.join(', ')}`);
    }
  }

  static validateDiagnosticData(data: any): void {
    this.validateRequiredFields(data, ['id', 'rootCause', 'solution', 'confidence', 'considerations', 'failureId', 'createdAt'], 'diagnostic');
  }

  static validatePatternData(data: any): void {
    this.validateRequiredFields(data, ['id', 'type', 'pattern', 'context', 'frequency', 'projectId', 'createdAt'], 'pattern');
  }
}