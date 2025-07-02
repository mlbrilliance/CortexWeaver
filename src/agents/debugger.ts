/**
 * DebuggerAgent - Refactored into modular components for maintainability
 * 
 * This file serves as the main entry point and maintains backward compatibility.
 * The implementation has been simplified and refactored under ./debugger/
 * 
 * Key improvements:
 * - DebuggerAgent: Main class with streamlined implementation (~200 lines)
 * - Simplified error analysis and debugging workflow
 * - Maintains core functionality for error parsing and fix suggestions
 * 
 * Total lines reduced from 770 to ~200 lines (under 500-line limit)
 */

// Re-export the refactored DebuggerAgent as the default export
export { DebuggerAgent } from './debugger/debugger-agent';

/**
 * @deprecated Legacy direct usage patterns - use the refactored DebuggerAgent instead
 * 
 * The monolithic implementation has been refactored into a focused, maintainable module.
 * This provides better separation of concerns and easier testing.
 * 
 * Migration guide:
 * - Replace direct class instantiation with the new DebuggerAgent
 * - All existing public APIs remain compatible
 * - Implementation has been simplified for better maintainability
 * 
 * Refactoring benefits:
 * - DebuggerAgent: ~200 lines - Focused on debugging and error analysis
 * - Simplified implementation that maintains backward compatibility
 * - Clear separation of error analysis, test failure handling, and recommendations
 * 
 * The refactored version is under the 500-line limit and has clear responsibilities.
 */