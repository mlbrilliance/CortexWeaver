/**
 * Persona Entry Point - Stub File
 * 
 * This file serves as a stub that delegates to the modular Persona implementation
 * in the persona/ directory. The actual implementation has been refactored into
 * multiple modules to maintain the 500-line limit per file.
 * 
 * Modular structure:
 * - persona/index.ts - Main PersonaLoader orchestrator
 * - persona/loader.ts - Core loading functionality (502 lines - needs further refactoring)
 * - persona/validator.ts - Validation and analysis functionality
 * - persona/types.ts - Type definitions and interfaces
 */

// Re-export the main PersonaLoader class and all related types/interfaces
export { 
  PersonaLoader,
  PersonaLoaderCore,
  PersonaValidator,
  CompleteValidationResult
} from './persona/index';

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
} from './persona/types';

// Maintain backward compatibility by providing default exports
import { PersonaLoader } from './persona/index';
export default PersonaLoader;