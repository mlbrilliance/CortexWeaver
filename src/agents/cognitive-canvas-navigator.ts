/**
 * Cognitive Canvas Navigator Agent - Main Entry Point
 * 
 * This file serves as the main entry point for the Cognitive Canvas Navigator Agent,
 * now refactored to use a modular structure to maintain the 500-line limit per file.
 * 
 * Modular structure:
 * - cognitive-canvas-navigator/types.ts - All interfaces and type definitions
 * - cognitive-canvas-navigator/navigator-agent.ts - Main navigation logic and orchestration
 * - cognitive-canvas-navigator/cache-manager.ts - Advanced caching and memory management
 * - cognitive-canvas-navigator/query-optimizer.ts - Query optimization and natural language processing
 * - cognitive-canvas-navigator/performance-monitor.ts - Performance monitoring and analytics
 */

// Re-export the main agent class and all related types/interfaces
export { 
  CognitiveCanvasNavigatorAgent,
  CognitiveCanvasNavigatorAgent as CognitiveCanvasNavigator,
  CacheManager,
  QueryOptimizer,
  PerformanceMonitor
} from './cognitive-canvas-navigator/index';

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
} from './cognitive-canvas-navigator/types';

// Maintain backward compatibility by providing a default export
import { CognitiveCanvasNavigatorAgent } from './cognitive-canvas-navigator/index';
export default CognitiveCanvasNavigatorAgent;