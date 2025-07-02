import { Persona, PersonaDiff, PersonaChange, ValidationResult, QualityAssessment, BestPracticesResult } from './types';

// Re-export types for external use
export type { ValidationResult, QualityAssessment, BestPracticesResult };

/**
 * PersonaValidator class for validation and comparison operations
 * Extracted from the main persona.ts file to handle validation and analysis
 */
export class PersonaValidator {

  /**
   * Generate prompt template from persona
   */
  generatePromptTemplate(persona: Persona, context: Record<string, any> = {}): string {
    const sections: string[] = [];
    
    // Role and identity
    sections.push(`# ${persona.role}`);
    sections.push('');
    sections.push(`## Identity`);
    sections.push(persona.coreIdentity);
    sections.push('');
    
    // Primary responsibilities
    if (persona.primaryResponsibilities.length > 0) {
      sections.push('## Primary Responsibilities');
      persona.primaryResponsibilities.forEach(responsibility => {
        sections.push(`- ${responsibility}`);
      });
      sections.push('');
    }
    
    // Context variables
    if (Object.keys(context).length > 0) {
      sections.push('## Current Context');
      Object.entries(context).forEach(([key, value]) => {
        sections.push(`- ${key}: ${value}`);
      });
      sections.push('');
    }
    
    // Behavioral guidelines
    if (persona.behavioralGuidelines.length > 0) {
      sections.push('## Behavioral Guidelines');
      persona.behavioralGuidelines.forEach(guideline => {
        sections.push(`- ${guideline}`);
      });
      sections.push('');
    }
    
    return sections.join('\n');
  }

  /**
   * Compare two personas and generate a diff
   */
  generatePersonaDiff(oldPersona: Persona, newPersona: Persona): PersonaDiff {
    const changes: PersonaChange[] = [];
    
    // Compare basic fields
    if (oldPersona.role !== newPersona.role) {
      changes.push({
        field: 'role',
        type: 'modified',
        oldValue: oldPersona.role,
        newValue: newPersona.role
      });
    }
    
    if (oldPersona.coreIdentity !== newPersona.coreIdentity) {
      changes.push({
        field: 'coreIdentity',
        type: 'modified',
        oldValue: oldPersona.coreIdentity,
        newValue: newPersona.coreIdentity
      });
    }
    
    // Compare arrays
    const responsibilityChanges = this.compareArrays(
      oldPersona.primaryResponsibilities,
      newPersona.primaryResponsibilities,
      'primaryResponsibilities'
    );
    changes.push(...responsibilityChanges);
    
    const guidelineChanges = this.compareArrays(
      oldPersona.behavioralGuidelines,
      newPersona.behavioralGuidelines,
      'behavioralGuidelines'
    );
    changes.push(...guidelineChanges);
    
    const metricsChanges = this.compareArrays(
      oldPersona.successMetrics,
      newPersona.successMetrics,
      'successMetrics'
    );
    changes.push(...metricsChanges);
    
    const triggerChanges = this.compareArrays(
      oldPersona.adaptationTriggers,
      newPersona.adaptationTriggers,
      'adaptationTriggers'
    );
    changes.push(...triggerChanges);
    
    return {
      oldVersion: oldPersona.version,
      newVersion: newPersona.version,
      changes,
      summary: this.generateChangeSummary(changes),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Compare two arrays and generate change entries
   */
  private compareArrays(oldArray: string[], newArray: string[], fieldName: string): PersonaChange[] {
    const changes: PersonaChange[] = [];
    
    // Find added items
    const added = newArray.filter(item => !oldArray.includes(item));
    added.forEach(item => {
      changes.push({
        field: fieldName,
        type: 'added',
        newValue: item
      });
    });
    
    // Find removed items
    const removed = oldArray.filter(item => !newArray.includes(item));
    removed.forEach(item => {
      changes.push({
        field: fieldName,
        type: 'removed',
        oldValue: item
      });
    });
    
    return changes;
  }

  /**
   * Generate a human-readable summary of changes
   */
  private generateChangeSummary(changes: PersonaChange[]): string {
    if (changes.length === 0) {
      return 'No changes detected';
    }
    
    const changesByType = changes.reduce((acc, change) => {
      if (!acc[change.type]) acc[change.type] = 0;
      acc[change.type]++;
      return acc;
    }, {} as Record<string, number>);
    
    const summaryParts: string[] = [];
    if (changesByType.added) summaryParts.push(`${changesByType.added} additions`);
    if (changesByType.removed) summaryParts.push(`${changesByType.removed} removals`);
    if (changesByType.modified) summaryParts.push(`${changesByType.modified} modifications`);
    
    return summaryParts.join(', ');
  }

  /**
   * Validate persona structure and completeness
   */
  validatePersonaStructure(persona: Persona): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required field validation
    if (!persona.role || persona.role.trim() === '' || persona.role === 'Unknown Role') {
      errors.push('Role is required and must be properly defined');
    }

    if (!persona.coreIdentity || persona.coreIdentity.trim() === '') {
      errors.push('Core identity is required');
    } else if (persona.coreIdentity.length < 50) {
      warnings.push('Core identity is very short - consider adding more detail');
    }

    // Content validation
    if (persona.primaryResponsibilities.length === 0) {
      warnings.push('No primary responsibilities defined');
    } else if (persona.primaryResponsibilities.length < 3) {
      suggestions.push('Consider adding more primary responsibilities for clarity');
    }

    if (persona.behavioralGuidelines.length === 0) {
      warnings.push('No behavioral guidelines defined');
    } else if (persona.behavioralGuidelines.length < 3) {
      suggestions.push('Consider adding more behavioral guidelines');
    }

    if (Object.keys(persona.interactionPatterns).length === 0) {
      warnings.push('No interaction patterns defined');
    }

    if (persona.successMetrics.length === 0) {
      warnings.push('No success metrics defined');
    }

    if (persona.adaptationTriggers.length === 0) {
      warnings.push('No adaptation triggers defined');
    }

    // Metadata validation
    if (!persona.metadata.id || persona.metadata.id.trim() === '') {
      errors.push('Persona metadata must include a valid ID');
    }

    if (!persona.metadata.name || persona.metadata.name.trim() === '') {
      warnings.push('Persona metadata should include a name');
    }

    if (persona.metadata.tags.length === 0) {
      suggestions.push('Consider adding tags for better categorization');
    }

    if (persona.metadata.capabilities.length === 0) {
      suggestions.push('Consider defining capabilities for this persona');
    }

    // Version validation
    if (!persona.version.initialRelease || persona.version.initialRelease === 'Unknown') {
      warnings.push('Version information is incomplete');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      score: this.calculateValidationScore(errors, warnings, suggestions)
    };
  }

  /**
   * Calculate a validation score based on errors, warnings, and suggestions
   */
  private calculateValidationScore(errors: string[], warnings: string[], suggestions: string[]): number {
    let score = 100;
    
    // Deduct points for errors (critical issues)
    score -= errors.length * 25;
    
    // Deduct points for warnings (important issues)
    score -= warnings.length * 10;
    
    // Deduct fewer points for suggestions (nice-to-have improvements)
    score -= suggestions.length * 5;
    
    return Math.max(0, score);
  }

  /**
   * Validate persona content quality
   */
  validatePersonaQuality(persona: Persona): QualityAssessment {
    const assessment: QualityAssessment = {
      overall: 'good',
      scores: {
        completeness: 0,
        clarity: 0,
        specificity: 0,
        consistency: 0
      },
      recommendations: []
    };

    // Completeness assessment
    let completenessScore = 0;
    const requiredSections = [
      'role', 'coreIdentity', 'primaryResponsibilities', 
      'behavioralGuidelines', 'interactionPatterns', 
      'successMetrics', 'adaptationTriggers'
    ];
    
    requiredSections.forEach(section => {
      if (section === 'role' && persona.role && persona.role !== 'Unknown Role') {
        completenessScore += 10;
      } else if (section === 'coreIdentity' && persona.coreIdentity && persona.coreIdentity.length > 50) {
        completenessScore += 15;
      } else if (section === 'interactionPatterns' && Object.keys(persona.interactionPatterns).length > 0) {
        completenessScore += 10;
      } else if (Array.isArray(persona[section as keyof Persona]) && (persona[section as keyof Persona] as string[]).length > 0) {
        completenessScore += 10;
      }
    });
    assessment.scores.completeness = Math.min(100, completenessScore);

    // Clarity assessment (based on content length and structure)
    let clarityScore = 0;
    if (persona.coreIdentity.length > 100) clarityScore += 25;
    if (persona.primaryResponsibilities.length >= 3) clarityScore += 25;
    if (persona.behavioralGuidelines.length >= 3) clarityScore += 25;
    if (Object.keys(persona.interactionPatterns).length >= 2) clarityScore += 25;
    assessment.scores.clarity = clarityScore;

    // Specificity assessment
    let specificityScore = 0;
    if (persona.technicalExpertise && persona.technicalExpertise.length > 0) specificityScore += 20;
    if (persona.toolsAndTechniques && persona.toolsAndTechniques.length > 0) specificityScore += 20;
    if (persona.metadata.capabilities.length > 0) specificityScore += 20;
    if (persona.metadata.dependencies.length > 0) specificityScore += 20;
    if (persona.successMetrics.length >= 3) specificityScore += 20;
    assessment.scores.specificity = specificityScore;

    // Consistency assessment (basic checks for now)
    let consistencyScore = 80; // Start high and deduct for inconsistencies
    
    // Check if role is mentioned in core identity
    if (!persona.coreIdentity.toLowerCase().includes(persona.role.toLowerCase().split(' ')[0])) {
      consistencyScore -= 20;
      assessment.recommendations.push('Consider mentioning the role in the core identity');
    }
    
    assessment.scores.consistency = Math.max(0, consistencyScore);

    // Calculate overall assessment
    const avgScore = Object.values(assessment.scores).reduce((sum, score) => sum + score, 0) / 4;
    
    if (avgScore >= 80) {
      assessment.overall = 'excellent';
    } else if (avgScore >= 60) {
      assessment.overall = 'good';
    } else if (avgScore >= 40) {
      assessment.overall = 'fair';
    } else {
      assessment.overall = 'poor';
    }

    // Add specific recommendations
    if (assessment.scores.completeness < 80) {
      assessment.recommendations.push('Add more comprehensive content to all sections');
    }
    if (assessment.scores.clarity < 60) {
      assessment.recommendations.push('Improve clarity with more detailed descriptions');
    }
    if (assessment.scores.specificity < 60) {
      assessment.recommendations.push('Add more specific technical details and capabilities');
    }

    return assessment;
  }

  /**
   * Check if persona follows best practices
   */
  validateBestPractices(persona: Persona): BestPracticesResult {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check naming conventions
    if (persona.metadata.id !== persona.metadata.id.toLowerCase().replace(/\s+/g, '-')) {
      issues.push('Persona ID should be lowercase with hyphens instead of spaces');
    }
    
    // Check role formatting
    if (!persona.role.includes('Agent') && !persona.role.includes('Specialist')) {
      recommendations.push('Consider including "Agent" or "Specialist" in the role title');
    }
    
    // Check for action-oriented responsibilities
    const actionWords = ['create', 'develop', 'implement', 'design', 'analyze', 'validate', 'ensure', 'manage'];
    const hasActionOrientedResponsibilities = persona.primaryResponsibilities.some(resp => 
      actionWords.some(word => resp.toLowerCase().includes(word))
    );
    if (!hasActionOrientedResponsibilities) {
      recommendations.push('Use action-oriented language in primary responsibilities');
    }
    
    // Check interaction patterns structure
    const hasMultipleInteractionTypes = Object.keys(persona.interactionPatterns).length >= 2;
    if (!hasMultipleInteractionTypes) {
      recommendations.push('Define interaction patterns with multiple agent types or roles');
    }
    
    // Check success metrics specificity
    const hasQuantifiableMetrics = persona.successMetrics.some(metric => 
      /\d+|percentage|rate|time|score/.test(metric.toLowerCase())
    );
    if (!hasQuantifiableMetrics) {
      recommendations.push('Include quantifiable metrics where possible');
    }
    
    return {
      followsBestPractices: issues.length === 0,
      issues,
      recommendations,
      practiceScore: Math.max(0, 100 - (issues.length * 20) - (recommendations.length * 10))
    };
  }
}