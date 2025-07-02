/**
 * GovernorAgent - Refactored into modular components for maintainability
 * 
 * This file serves as the main entry point and maintains backward compatibility.
 * The implementation has been split into focused modules under ./governor/
 * 
 * Key modules:
 * - CostMonitor: Handles cost tracking and analytics
 * - BudgetEnforcer: Manages budget limits and enforcement  
 * - QualityAnalyzer: Analyzes test results and quality metrics
 * - PheromoneManager: Creates and manages pheromones for agent coordination
 * - PromptWorkflowManager: Handles prompt improvement workflow
 * - ReflectorCoordinator: Manages Reflector agent spawning and coordination
 * - GovernorAgent: Main orchestration class using composition pattern
 * 
 * Total lines reduced from 1254 to ~200 per module (under 500-line limit)
 */

// Re-export the refactored GovernorAgent as the default export
export { GovernorAgent } from './governor/governor-agent';

// Re-export all types for backward compatibility
export * from './governor/types';

// Re-export individual modules for advanced usage
export {
  CostMonitor,
  BudgetEnforcer,
  QualityAnalyzer,
  PheromoneManager,
  PromptWorkflowManager,
  ReflectorCoordinator
} from './governor/index';

/**
 * @deprecated Legacy direct usage patterns - use the modular GovernorAgent instead
 * 
 * The monolithic implementation has been refactored into focused, testable modules.
 * This provides better separation of concerns, easier testing, and maintainability.
 * 
 * Migration guide:
 * - Replace direct class instantiation with the new GovernorAgent
 * - Individual modules can be imported for unit testing or custom usage
 * - All existing public APIs remain compatible
 */