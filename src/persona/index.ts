import { PersonaLoader } from './loader';
import { PersonaValidator } from './validator';
import { 
  Persona, 
  PersonaVersion, 
  PersonaMetadata, 
  PersonaConfig, 
  PersonaLoadResult, 
  PersonaDiff, 
  PersonaChange, 
  PersonaMetrics,
  PersonaVersionEntry,
  PersonaCacheEntry,
  ValidationResult,
  QualityAssessment,
  BestPracticesResult
} from './types';

/**
 * Main PersonaLoader class - refactored to use modular components
 * This serves as the main entry point and orchestrates the various persona modules
 */
export class PersonaLoaderMain {
  private loader: PersonaLoader;
  private validator: PersonaValidator;

  constructor(config: Partial<PersonaConfig> = {}) {
    this.loader = new PersonaLoader(config);
    this.validator = new PersonaValidator();
  }

  // Core loading functionality
  async loadPersona(agentName: string): Promise<PersonaLoadResult> {
    return this.loader.loadPersona(agentName);
  }

  // Validation and analysis functionality
  generatePromptTemplate(persona: Persona, context: Record<string, any> = {}): string {
    return this.validator.generatePromptTemplate(persona, context);
  }

  generatePersonaDiff(oldPersona: Persona, newPersona: Persona): PersonaDiff {
    return this.validator.generatePersonaDiff(oldPersona, newPersona);
  }

  validatePersonaStructure(persona: Persona): ValidationResult {
    return this.validator.validatePersonaStructure(persona);
  }

  validatePersonaQuality(persona: Persona): QualityAssessment {
    return this.validator.validatePersonaQuality(persona);
  }

  validateBestPractices(persona: Persona): BestPracticesResult {
    return this.validator.validateBestPractices(persona);
  }

  // Utility methods delegated to loader
  getAvailablePersonas(): string[] {
    return this.loader.getAvailablePersonas();
  }

  getPersonaMetrics(agentName: string): PersonaMetrics | null {
    return this.loader.getPersonaMetrics(agentName);
  }

  async savePersonaVersion(persona: Persona, changes: string[], reason: string): Promise<void> {
    return this.loader.savePersonaVersion(persona, changes, reason);
  }

  // Cleanup
  dispose(): void {
    this.loader.dispose();
  }

  // Enhanced validation method that combines all validation types
  async validatePersonaComplete(agentName: string): Promise<CompleteValidationResult> {
    const loadResult = await this.loadPersona(agentName);
    
    if (!loadResult.success || !loadResult.persona) {
      return {
        loadResult,
        structureValidation: null,
        qualityAssessment: null,
        bestPracticesResult: null,
        overallScore: 0,
        overallAssessment: 'failed'
      };
    }

    const persona = loadResult.persona;
    const structureValidation = this.validatePersonaStructure(persona);
    const qualityAssessment = this.validatePersonaQuality(persona);
    const bestPracticesResult = this.validateBestPractices(persona);

    // Calculate overall score
    const qualityScores = qualityAssessment.scores;
    const avgQualityScore = (qualityScores.completeness + qualityScores.clarity + qualityScores.specificity + qualityScores.consistency) / 4;
    const overallScore = Math.round(
      (structureValidation.score + avgQualityScore + bestPracticesResult.practiceScore) / 3
    );

    let overallAssessment: 'excellent' | 'good' | 'fair' | 'poor' | 'failed';
    if (overallScore >= 85) {
      overallAssessment = 'excellent';
    } else if (overallScore >= 70) {
      overallAssessment = 'good';
    } else if (overallScore >= 50) {
      overallAssessment = 'fair';
    } else {
      overallAssessment = 'poor';
    }

    return {
      loadResult,
      structureValidation,
      qualityAssessment,
      bestPracticesResult,
      overallScore,
      overallAssessment
    };
  }
}

// Maintain backward compatibility by exporting the main class as PersonaLoader
export { PersonaLoaderMain as PersonaLoader };

// Export modular components for direct access
export { PersonaLoader as PersonaLoaderCore } from './loader';
export { PersonaValidator } from './validator';

// Export all types and interfaces
export type {
  Persona,
  PersonaVersion,
  PersonaVersionEntry,
  PersonaMetadata,
  PersonaConfig,
  PersonaLoadResult,
  PersonaDiff,
  PersonaChange,
  PersonaMetrics,
  PersonaCacheEntry,
  ValidationResult,
  QualityAssessment,
  BestPracticesResult
};

// Additional combined validation result type
export interface CompleteValidationResult {
  loadResult: PersonaLoadResult;
  structureValidation: ValidationResult | null;
  qualityAssessment: QualityAssessment | null;
  bestPracticesResult: BestPracticesResult | null;
  overallScore: number;
  overallAssessment: 'excellent' | 'good' | 'fair' | 'poor' | 'failed';
}