/**
 * Query Optimization and Natural Language Processing for Cognitive Canvas Navigator
 */

import { NavigationQuery, NavigationFilter, QueryPlan } from './types';

export class QueryOptimizer {
  private optimizationCount = 0;

  optimizeQuery(query: NavigationQuery): NavigationQuery {
    const optimized = { ...query };
    
    if (!this.isQueryTargeted(query)) {
      optimized.context = { ...optimized.context, limit: 50 };
      console.warn('Query optimized: Added limit due to broad scope');
    }
    
    if (!optimized.filters?.length) {
      optimized.filters = this.inferFiltersFromQuery(query.query);
    }
    
    optimized.context = this.optimizeQueryContext(optimized.context || {});
    this.optimizationCount++;
    return optimized;
  }

  createQueryPlan(query: NavigationQuery): QueryPlan {
    let complexity: 'low' | 'medium' | 'high' = 'low';
    let estimatedCost = 10;
    const optimizations: string[] = [];
    
    if ((query.filters?.length || 0) > 3) complexity = 'medium', estimatedCost += 20;
    if (query.type === 'temporal' || query.type === 'causal') complexity = 'high', estimatedCost += 50;
    if (!this.isQueryTargeted(query)) complexity = 'high', estimatedCost += 30;
    
    if (complexity === 'low') optimizations.push('fast_path');
    if (query.context?.limit < 50) optimizations.push('result_limiting');
    if (this.isQueryCacheable(query)) optimizations.push('caching_enabled');
    
    return {
      executionOrder: ['validate', 'cache_check', 'execute', 'optimize_result'],
      estimatedCost,
      optimizations,
      complexity
    };
  }

  async translateNaturalLanguageToCypher(nlQuery: string, context: Record<string, any> = {}): Promise<string> {
    const semantics = this.analyzeQuerySemantics(nlQuery);
    let cypher = this.constructCypherQuery({...context, ...semantics}, nlQuery);
    return this.validateCypherSyntax(cypher) ? this.optimizeCypherQuery(cypher) : this.fallbackCypherGeneration(nlQuery, context);
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

  private analyzeQuerySemantics(nlQuery: string): Record<string, any> {
    return {
      entities: nlQuery.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [],
      intent: /find|search|get|show/i.test(nlQuery) ? 'retrieve' : /connect|relate|path/i.test(nlQuery) ? 'path_finding' : /count|how many/i.test(nlQuery) ? 'aggregation' : 'retrieve',
      hasRelationships: /related to|connected to|depends on/i.test(nlQuery)
    };
  }

  private constructCypherQuery(context: Record<string, any>, nlQuery: string): string {
    const nodePattern = context.nodeType ? `(n:${context.nodeType})` : '(n)';
    const relPattern = context.hasRelationships && context.relationshipType ? `-[:${context.relationshipType}]-(m)` : '';
    const conditions = this.extractAdvancedConditions(nlQuery);
    const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.map(c => `n.${c.field} ${c.operator} ${c.value}`).join(' AND ') : '';
    const returnClause = context.hasRelationships ? ' RETURN n, m' : ' RETURN n';
    const limitClause = this.extractLimitFromQuery(nlQuery) ? ` LIMIT ${this.extractLimitFromQuery(nlQuery)}` : '';
    return `MATCH ${nodePattern}${relPattern}${whereClause}${returnClause}${limitClause}`;
  }

  private extractAdvancedConditions(nlQuery: string): Array<{field: string, operator: string, value: string}> {
    const patterns = [
      [/name\s+(?:is|equals?)\s+["']([^"']+)["']/i, 'name', '=', 1],
      [/status\s+(?:is|equals?)\s+["']?(\w+)["']?/i, 'status', '=', 1],
      [/(\w+)\s+(?:greater than|>)\s+(\d+)/i, 1, '>', 2],
      [/(\w+)\s+(?:less than|<)\s+(\d+)/i, 1, '<', 2],
      [/created\s+after\s+(\d{4}-\d{2}-\d{2})/i, 'createdAt', '>', 1]
    ];
    
    return patterns.map(([regex, field, op, group]: any) => {
      const match = nlQuery.match(regex);
      if (!match) return null;
      const f = typeof field === 'number' ? match[field] : field;
      const v = match[group];
      return { field: f, operator: op, value: isNaN(Number(v)) ? `"${v}"` : v };
    }).filter((item): item is { field: string; operator: string; value: string } => item !== null);
  }

  private inferFiltersFromQuery(query: string): NavigationFilter[] {
    const filters: NavigationFilter[] = [];
    const nodeTypes = ['user', 'project', 'task', 'document', 'event'];
    
    nodeTypes.forEach(type => {
      if (query.toLowerCase().includes(type)) {
        filters.push({ type: 'node', field: 'type', operator: 'equals', value: type });
      }
    });
    
    return filters;
  }

  private optimizeQueryContext(context: Record<string, any>): Record<string, any> {
    const optimized = { ...context };
    
    if (!optimized.limit) optimized.limit = 100;
    if (optimized.limit > 500) optimized.limit = 500;
    
    return optimized;
  }

  private isQueryCacheable(query: NavigationQuery): boolean {
    const nonCacheableTerms = ['current', 'now', 'today', 'latest', 'my'];
    return !nonCacheableTerms.some(term => query.query.toLowerCase().includes(term));
  }

  private validateCypherSyntax(cypher: string): boolean {
    const required = ['MATCH', 'RETURN'];
    const hasRequired = required.every(kw => cypher.toUpperCase().includes(kw));
    const balancedParens = (cypher.match(/\(/g) || []).length === (cypher.match(/\)/g) || []).length;
    return hasRequired && balancedParens;
  }

  private fallbackCypherGeneration(nlQuery: string, context: Record<string, any>): string {
    return `MATCH (n) WHERE n.name CONTAINS "${nlQuery.toLowerCase()}" RETURN n LIMIT 10`;
  }

  private optimizeCypherQuery(cypher: string): string {
    return cypher.replace(/\s+/g, ' ').trim().replace(/RETURN \*/, 'RETURN n');
  }

  private extractLimitFromQuery(nlQuery: string): number | null {
    const match = nlQuery.match(/(?:limit|top|first)\s+(\d+)/i);
    return match ? Math.min(parseInt(match[1]), 500) : null;
  }

  getOptimizationCount(): number {
    return this.optimizationCount;
  }
}