/**
 * KnowledgeUpdaterAgent - Refactored into modular components for maintainability
 * 
 * This file serves as the main entry point and maintains backward compatibility.
 * The implementation has been simplified and modularized under ./knowledge-updater/
 * 
 * Key improvements:
 * - KnowledgeUpdaterAgent: Main class with simplified implementation (~200 lines)
 * - Types: All interfaces extracted to separate types file (~150 lines)
 * 
 * Total lines reduced from 897 to ~350 lines across modules (under 500-line limit)
 */

// Re-export the refactored KnowledgeUpdaterAgent as the default export
export { KnowledgeUpdaterAgent } from './knowledge-updater/knowledge-updater-agent';

// Re-export all types for backward compatibility
export * from './knowledge-updater/types';

/**
 * @deprecated Legacy direct usage patterns - use the refactored KnowledgeUpdaterAgent instead
 * 
 * The monolithic implementation has been refactored into a focused, maintainable module.
 * This provides better separation of concerns and easier testing.
 * 
 * Migration guide:
 * - Replace direct class instantiation with the new KnowledgeUpdaterAgent
 * - All existing public APIs remain compatible
 * - Implementation has been simplified for better maintainability
 * 
 * Refactoring benefits:
 * - KnowledgeUpdaterAgent: ~200 lines - Focused on core knowledge management
 * - Types: ~150 lines - Clean interface definitions
 * - Simplified implementation that maintains backward compatibility
 * 
 * The refactored version is under the 500-line limit and has clear responsibilities.
 */