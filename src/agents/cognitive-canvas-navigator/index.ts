/**
 * Cognitive Canvas Navigator Agent - Main Entry Point
 * 
 * This file serves as the main entry point for the Cognitive Canvas Navigator Agent,
 * refactored to use a modular structure to maintain the 500-line limit per file.
 * 
 * Modular structure:
 * - types.ts - All interfaces and type definitions
 * - navigator-agent.ts - Main navigation logic and orchestration
 * - cache-manager.ts - Advanced caching and memory management
 * - query-optimizer.ts - Query optimization and natural language processing
 * - performance-monitor.ts - Performance monitoring and analytics
 */

// Re-export the main agent class
export { CognitiveCanvasNavigatorAgent } from './navigator-agent';

// Re-export all types and interfaces
export type { 
  NavigationQuery,
  NavigationFilter,
  NavigationResult,
  KnowledgeNode,
  KnowledgeRelationship,
  NavigationPath,
  NavigationInsight,
  PerformanceMetrics,
  CacheEntry,
  QueryPlan
} from './types';

// Re-export individual components for advanced usage
export { CacheManager } from './cache-manager';
export { QueryOptimizer } from './query-optimizer';
export { PerformanceMonitor } from './performance-monitor';

// Maintain backward compatibility with existing imports
export { CognitiveCanvasNavigatorAgent as CognitiveCanvasNavigator } from './navigator-agent';