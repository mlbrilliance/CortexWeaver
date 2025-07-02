import { 
  ProjectData, 
  TaskData, 
  AgentData, 
  PheromoneData, 
  EnhancedPheromoneData,
  ArchitecturalDecisionData,
  ContractData,
  CodeModuleData,
  TestData,
  ArtifactData,
  FailureData,
  DiagnosticData,
  PatternData,
  PrototypeData
} from './types';

export class Validation {
  static validateRequiredFields(data: any, fields: string[], type: string): void {
    const missingFields = fields.filter(field => data[field] === undefined || data[field] === null);
    if (missingFields.length > 0) {
      throw new Error(`Missing required ${type} fields: ${missingFields.join(', ')}`);
    }
  }

  static validateProjectData(data: ProjectData): void {
    this.validateRequiredFields(data, ['id', 'name', 'description', 'status', 'createdAt'], 'project');
    
    if (typeof data.id !== 'string' || data.id.trim() === '') {
      throw new Error('Project id must be a non-empty string');
    }
    
    if (typeof data.name !== 'string' || data.name.trim() === '') {
      throw new Error('Project name must be a non-empty string');
    }
  }

  static validateTaskData(data: TaskData): void {
    this.validateRequiredFields(data, ['id', 'title', 'description', 'status', 'priority', 'projectId', 'createdAt'], 'task');
    
    const validStatuses = ['pending', 'in_progress', 'completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(data.status)) {
      throw new Error(`Invalid task status: ${data.status}. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (!validPriorities.includes(data.priority)) {
      throw new Error(`Invalid task priority: ${data.priority}. Must be one of: ${validPriorities.join(', ')}`);
    }
  }

  static validateAgentData(data: AgentData): void {
    this.validateRequiredFields(data, ['id', 'name', 'role', 'capabilities', 'status', 'createdAt'], 'agent');
    
    if (!Array.isArray(data.capabilities)) {
      throw new Error('Agent capabilities must be an array');
    }
    
    const validStatuses = ['active', 'inactive', 'busy', 'error'];
    if (!validStatuses.includes(data.status)) {
      throw new Error(`Invalid agent status: ${data.status}. Must be one of: ${validStatuses.join(', ')}`);
    }
  }

  static validatePheromoneData(data: PheromoneData | EnhancedPheromoneData): void {
    this.validateRequiredFields(data, ['id', 'type', 'strength', 'context', 'metadata', 'createdAt'], 'pheromone');
    
    if (typeof data.strength !== 'number' || data.strength < 0 || data.strength > 1) {
      throw new Error('Pheromone strength must be a number between 0 and 1');
    }
    
    // Enhanced validation for v3.0 pheromones
    if ((data as EnhancedPheromoneData).pattern) {
      const pattern = (data as EnhancedPheromoneData).pattern!;
      const validOutcomes = ['success', 'failure', 'partial'];
      if (!validOutcomes.includes(pattern.taskOutcome)) {
        throw new Error(`Invalid task outcome: ${pattern.taskOutcome}. Must be one of: ${validOutcomes.join(', ')}`);
      }
      
      const validComplexities = ['low', 'medium', 'high'];
      if (!validComplexities.includes(pattern.complexity)) {
        throw new Error(`Invalid complexity: ${pattern.complexity}. Must be one of: ${validComplexities.join(', ')}`);
      }
    }
    
    // Validate date fields
    this.validateDateField(data.createdAt, 'createdAt');
    if (data.expiresAt) {
      this.validateDateField(data.expiresAt, 'expiresAt');
    }
  }

  static validateArchitecturalDecisionData(data: ArchitecturalDecisionData): void {
    this.validateRequiredFields(data, ['id', 'title', 'description', 'rationale', 'status', 'projectId', 'createdAt'], 'architectural decision');
    
    const validStatuses = ['proposed', 'accepted', 'rejected', 'deprecated'];
    if (!validStatuses.includes(data.status)) {
      throw new Error(`Invalid architectural decision status: ${data.status}. Must be one of: ${validStatuses.join(', ')}`);
    }
  }

  static validateContractData(data: ContractData): void {
    this.validateRequiredFields(data, ['id', 'name', 'type', 'version', 'specification', 'projectId', 'createdAt'], 'contract');
    
    const validTypes = ['openapi', 'json-schema', 'property-definition'];
    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid contract type: ${data.type}. Must be one of: ${validTypes.join(', ')}`);
    }
    
    if (typeof data.specification !== 'object' || data.specification === null) {
      throw new Error('Contract specification must be a valid object');
    }
    
    // Validate version format (semantic versioning)
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(data.version)) {
      throw new Error('Contract version must follow semantic versioning format (e.g., 1.0.0)');
    }
  }

  static validateCodeModuleData(data: CodeModuleData): void {
    this.validateRequiredFields(data, ['id', 'name', 'filePath', 'type', 'language', 'projectId', 'createdAt'], 'code module');
    
    const validTypes = ['function', 'class', 'module', 'component'];
    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid code module type: ${data.type}. Must be one of: ${validTypes.join(', ')}`);
    }
    
    if (typeof data.filePath !== 'string' || data.filePath.trim() === '') {
      throw new Error('Code module filePath must be a non-empty string');
    }
  }

  static validateTestData(data: TestData): void {
    this.validateRequiredFields(data, ['id', 'name', 'filePath', 'type', 'framework', 'projectId', 'createdAt'], 'test');
    
    const validTypes = ['unit', 'integration', 'e2e', 'contract'];
    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid test type: ${data.type}. Must be one of: ${validTypes.join(', ')}`);
    }
    
    if (typeof data.filePath !== 'string' || data.filePath.trim() === '') {
      throw new Error('Test filePath must be a non-empty string');
    }
  }

  static validateArtifactData(data: ArtifactData): void {
    this.validateRequiredFields(data, ['id', 'type', 'name', 'data', 'projectId', 'createdAt'], 'artifact');
    
    if (typeof data.name !== 'string' || data.name.trim() === '') {
      throw new Error('Artifact name must be a non-empty string');
    }
  }

  static validateFailureData(data: FailureData): void {
    this.validateRequiredFields(data, ['id', 'message', 'context', 'severity', 'projectId', 'createdAt'], 'failure');
    
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(data.severity)) {
      throw new Error(`Invalid failure severity: ${data.severity}. Must be one of: ${validSeverities.join(', ')}`);
    }
    
    if (typeof data.message !== 'string' || data.message.trim() === '') {
      throw new Error('Failure message must be a non-empty string');
    }
  }

  static validateDiagnosticData(data: DiagnosticData): void {
    this.validateRequiredFields(data, ['id', 'rootCause', 'solution', 'confidence', 'considerations', 'failureId', 'createdAt'], 'diagnostic');
    
    if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) {
      throw new Error('Diagnostic confidence must be a number between 0 and 1');
    }
    
    if (!Array.isArray(data.considerations)) {
      throw new Error('Diagnostic considerations must be an array');
    }
  }

  static validatePatternData(data: PatternData): void {
    this.validateRequiredFields(data, ['id', 'type', 'pattern', 'context', 'frequency', 'projectId', 'createdAt'], 'pattern');
    
    if (typeof data.frequency !== 'number' || data.frequency < 0) {
      throw new Error('Pattern frequency must be a non-negative number');
    }
  }

  static validatePrototypeData(data: PrototypeData): void {
    this.validateRequiredFields(data, ['id', 'contractId', 'pseudocode', 'flowDiagram', 'outputPath', 'createdAt'], 'prototype');
    
    if (typeof data.pseudocode !== 'string' || data.pseudocode.trim() === '') {
      throw new Error('Prototype pseudocode must be a non-empty string');
    }
    
    if (typeof data.outputPath !== 'string' || data.outputPath.trim() === '') {
      throw new Error('Prototype outputPath must be a non-empty string');
    }
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static validateId(id: string): boolean {
    return typeof id === 'string' && id.trim().length > 0 && id.length <= 255;
  }

  private static validateDateField(dateValue: string | Date, fieldName: string): void {
    if (typeof dateValue === 'string') {
      if (isNaN(Date.parse(dateValue))) {
        throw new Error(`${fieldName} must be a valid ISO date string`);
      }
    } else if (!(dateValue instanceof Date)) {
      throw new Error(`${fieldName} must be a Date object or ISO date string`);
    }
  }
}