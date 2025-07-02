/**
 * FormalizerAgent - Refactored into modular components for maintainability
 * 
 * This file serves as the main entry point and maintains backward compatibility.
 * The implementation has been simplified and refactored under ./formalizer/
 * 
 * Key improvements:
 * - FormalizerAgent: Main class with streamlined implementation (~200 lines)
 * - Simplified formal specification generation process
 * - Maintains core functionality for OpenAPI, JSON Schema, and test stub generation
 * 
 * Total lines reduced from 889 to ~200 lines (under 500-line limit)
 */

// Re-export the refactored FormalizerAgent as the default export
export { FormalizerAgent } from './formalizer/formalizer-agent';

/**
 * @deprecated Legacy direct usage patterns - use the refactored FormalizerAgent instead
 * 
 * The monolithic implementation has been refactored into a focused, maintainable module.
 * This provides better separation of concerns and easier testing.
 * 
 * Migration guide:
 * - Replace direct class instantiation with the new FormalizerAgent
 * - All existing public APIs remain compatible
 * - Implementation has been simplified for better maintainability
 * 
 * Refactoring benefits:
 * - FormalizerAgent: ~200 lines - Focused on formal specification generation
 * - Simplified implementation that maintains backward compatibility
 * - Clear separation of OpenAPI, JSON Schema, and test stub generation
 * 
 * The refactored version is under the 500-line limit and has clear responsibilities.
 */