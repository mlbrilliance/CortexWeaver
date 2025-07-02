/**
 * ReflectorAgent - Refactored into modular components for maintainability
 * 
 * This file serves as the main entry point and maintains backward compatibility.
 * The implementation has been split into focused modules under ./reflector/
 * 
 * Key modules:
 * - PatternAnalyzer: Handles performance pattern analysis
 * - PheromoneGenerator: Manages pheromone creation for guidance
 * - PromptAnalyzer: Analyzes prompt performance and correlations
 * - ImprovementGenerator: Generates prompt improvement proposals
 * - ReflectorAgent: Main orchestration class using composition pattern
 * 
 * Total lines reduced from 1382 to ~200-300 per module (under 500-line limit)
 */

// Re-export the refactored ReflectorAgent as the default export
export { ReflectorAgent } from './reflector/reflector-agent';

// Re-export all types for backward compatibility
export * from './reflector/types';

// Re-export individual modules for advanced usage
export {
  PatternAnalyzer,
  PheromoneGenerator,
  PromptAnalyzer,
  ImprovementGenerator
} from './reflector/index';

/**
 * @deprecated Legacy direct usage patterns - use the modular ReflectorAgent instead
 * 
 * The monolithic implementation has been refactored into focused, testable modules.
 * This provides better separation of concerns, easier testing, and maintainability.
 * 
 * Migration guide:
 * - Replace direct class instantiation with the new ReflectorAgent
 * - Individual modules can be imported for unit testing or custom usage
 * - All existing public APIs remain compatible
 * 
 * Refactoring benefits:
 * - PatternAnalyzer: ~300 lines - Focused on performance pattern analysis
 * - PheromoneGenerator: ~150 lines - Handles pheromone creation and management
 * - PromptAnalyzer: ~200 lines - Analyzes prompt performance correlations
 * - ImprovementGenerator: ~200 lines - Generates improvement proposals
 * - ReflectorAgent: ~250 lines - Main orchestration with composition
 * 
 * Each module is now under the 500-line limit and has clear responsibilities.
 */