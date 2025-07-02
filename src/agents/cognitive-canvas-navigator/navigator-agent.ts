/**
 * Main Cognitive Canvas Navigator Agent - Orchestrates navigation and query execution
 */

import { Agent, AgentConfig } from '../../agent';
import { NavigationQuery, NavigationResult, QueryPlan, PerformanceMetrics } from './types';
import { CacheManager } from './cache-manager';
import { QueryOptimizer } from './query-optimizer';
import { PerformanceMonitor } from './performance-monitor';

export class CognitiveCanvasNavigatorAgent extends Agent {
  private cacheManager: CacheManager;
  private queryOptimizer: QueryOptimizer;
  private performanceMonitor: PerformanceMonitor;

  constructor() {
    super();
    this.cacheManager = new CacheManager();
    this.queryOptimizer = new QueryOptimizer();
    this.performanceMonitor = new PerformanceMonitor();
  }

  async initialize(config: AgentConfig): Promise<void> {
    await super.initialize(config);
    if (!config.capabilities.includes('graph-navigation')) {
      throw new Error('Cognitive Canvas Navigator requires graph-navigation capability');
    }
    this.performanceMonitor.startPerformanceMonitoring();
  }

  getPromptTemplate(): string {
    return `Cognitive Canvas Navigator: Navigate knowledge graphs efficiently. Execute optimized queries with intelligent caching. Query: {{query}}, Context: {{context}}.`;
  }

  async executeTask(): Promise<NavigationResult> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    const query = this.parseNavigationQuery();
    const startTime = Date.now();
    
    try {
      // Analyze and optimize query before execution
      const optimizedQuery = this.queryOptimizer.optimizeQuery(query);
      const plan = this.queryOptimizer.createQueryPlan(optimizedQuery);
      
      await this.reportProgress('started', `Executing ${plan.complexity} complexity ${query.type} query`);
      
      const result = await this.executeOptimizedNavigation(optimizedQuery, plan);
      
      // Track performance metrics
      const queryTime = Date.now() - startTime;
      this.performanceMonitor.updateMetrics(queryTime, result.metadata.cacheHit || false);
      
      // Update cache metrics
      const cacheMetrics = this.cacheManager.getCacheMetrics();
      this.performanceMonitor.updateCacheHitRatio(cacheMetrics.cacheHitRatio);
      this.performanceMonitor.updateMemoryUsage(cacheMetrics.cacheSize);
      this.performanceMonitor.updateOptimizationCount(this.queryOptimizer.getOptimizationCount());
      
      await this.reportProgress('completed', 
        `Query completed in ${queryTime}ms: ${result.nodes.length} nodes, ${result.relationships.length} relationships`);
      
      return result;
    } catch (error) {
      await this.reportProgress('failed', `Navigation failed: ${(error as Error).message}`);
      throw error;
    }
  }

  async translateNaturalLanguageToCypher(nlQuery: string, context: Record<string, any> = {}): Promise<string> {
    return this.queryOptimizer.translateNaturalLanguageToCypher(nlQuery, context);
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMonitor.getPerformanceMetrics();
  }

  private async executeOptimizedNavigation(query: NavigationQuery, plan: QueryPlan): Promise<NavigationResult> {
    const cacheKey = this.cacheManager.generateOptimizedCacheKey(query);
    
    const cachedResult = this.cacheManager.getAdvancedCachedResult(cacheKey);
    if (cachedResult) {
      cachedResult.metadata.cacheHit = true;
      return cachedResult;
    }
    
    const startTime = Date.now();
    const result = await this.executeQueryByType(query);
    const queryTime = Date.now() - startTime;
    
    const optimizedResult = this.applyResultOptimizations(result, query, plan);
    optimizedResult.metadata.queryTime = queryTime;
    optimizedResult.metadata.optimized = true;
    
    this.cacheManager.storeIntelligentCache(cacheKey, optimizedResult, plan.estimatedCost);
    
    return optimizedResult;
  }

  private parseNavigationQuery(): NavigationQuery {
    const taskQuery = this.taskContext?.query;
    if (!taskQuery) throw new Error('No navigation query provided');
    
    return {
      type: taskQuery.type || 'semantic',
      query: taskQuery.query || '',
      context: taskQuery.context || {},
      filters: taskQuery.filters || []
    };
  }

  private async executeQueryByType(query: NavigationQuery): Promise<NavigationResult> {
    const basePrompt = this.formatPrompt(this.getPromptTemplate(), {
      query: query.query,
      context: JSON.stringify(query.context || {})
    });
    
    const typeSpecificPrompt = this.buildTypeSpecificPrompt(query);
    const response = await this.sendToClaude(basePrompt + typeSpecificPrompt);
    
    return this.parseNavigationResult(response.content);
  }

  private buildTypeSpecificPrompt(query: NavigationQuery): string {
    const prompts = {
      semantic: 'Execute semantic search for conceptually related nodes and insights.',
      structural: 'Analyze graph structure for patterns, hubs, and communities.',
      temporal: 'Analyze temporal patterns and evolution over time.',
      causal: 'Identify causal relationships and dependency chains.'
    };
    
    return `\n\n${prompts[query.type]} Query: ${query.query}\nFilters: ${JSON.stringify(query.filters)}\nReturn structured results.`;
  }

  private applyResultOptimizations(result: NavigationResult, query: NavigationQuery, plan: QueryPlan): NavigationResult {
    let optimized = { ...result };
    
    const limit = query.context?.limit || (this.isQueryTargeted(query) ? 100 : 50);
    optimized.nodes = optimized.nodes.slice(0, limit);
    optimized.relationships = optimized.relationships.slice(0, limit);
    optimized.paths = optimized.paths.slice(0, Math.min(20, limit / 5));
    
    optimized.nodes.sort((a, b) => b.relevanceScore - a.relevanceScore);
    optimized.relationships.sort((a, b) => b.weight - a.weight);
    
    return optimized;
  }

  private parseNavigationResult(content: string): NavigationResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          nodes: result.nodes || [], 
          relationships: result.relationships || [],
          paths: result.paths || [], 
          insights: result.insights || [],
          metadata: { 
            queryTime: 0, 
            resultCount: (result.nodes || []).length + (result.relationships || []).length, 
            confidence: result.confidence || 0.8 
          }
        };
      }
    } catch (error) { 
      console.warn('Failed to parse navigation result'); 
    }
    return { 
      nodes: [], 
      relationships: [], 
      paths: [], 
      insights: [], 
      metadata: { queryTime: 0, resultCount: 0, confidence: 0.5 } 
    };
  }

  private isQueryTargeted(query: NavigationQuery): boolean {
    const vagueTerms = ['everything', 'all', 'any', 'find stuff', 'show me'];
    const hasVagueTerms = vagueTerms.some(term => 
      query.query.toLowerCase().includes(term.toLowerCase())
    );
    
    const hasSpecificCriteria = 
      (query.filters?.length || 0) > 0 ||
      query.context?.nodeType ||
      query.context?.limit < 100 ||
      query.query.length > 15;
    
    return !hasVagueTerms && hasSpecificCriteria;
  }
}