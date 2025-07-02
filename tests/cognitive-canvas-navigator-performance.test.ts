import { CognitiveCanvasNavigator, NavigationQuery, NavigationResult, PerformanceMetrics } from '../src/agents/cognitive-canvas-navigator';

describe('CognitiveCanvasNavigator 1.0 Performance Optimizations', () => {
  let navigator: CognitiveCanvasNavigator;

  beforeEach(() => {
    navigator = new CognitiveCanvasNavigator();
    // Don't initialize to avoid Neo4j connection issues in tests
  });

  describe('μT-2.4: Targeted Query Optimization', () => {
    test('should detect and optimize broad queries', () => {
      const broadQuery: NavigationQuery = {
        type: 'semantic',
        query: 'show me everything',
        context: {},
        filters: []
      };

      // Access private method for testing
      const optimizeQuery = (navigator as any).optimizeQuery.bind(navigator);
      const optimized = optimizeQuery(broadQuery);

      expect(optimized.context.limit).toBe(50); // Should add limit to broad queries
      expect(optimized.filters).toBeDefined();
    });

    test('should maintain targeted queries without over-optimization', () => {
      const targetedQuery: NavigationQuery = {
        type: 'semantic',
        query: 'find users with status active in project alpha',
        context: { nodeType: 'User', limit: 20 },
        filters: [{ type: 'node', field: 'status', operator: 'equals', value: 'active' }]
      };

      const optimizeQuery = (navigator as any).optimizeQuery.bind(navigator);
      const optimized = optimizeQuery(targetedQuery);

      expect(optimized.context.limit).toBe(20); // Should preserve original limit
      expect(optimized.filters.length).toBeGreaterThan(0);
    });

    test('should detect targeted vs broad queries correctly', () => {
      const isQueryTargeted = (navigator as any).isQueryTargeted.bind(navigator);
      
      const targetedQuery: NavigationQuery = {
        type: 'semantic',
        query: 'find users with specific criteria',
        context: { nodeType: 'User', limit: 10 },
        filters: [{ type: 'node', field: 'status', operator: 'equals', value: 'active' }]
      };

      const broadQuery: NavigationQuery = {
        type: 'semantic',
        query: 'show me everything',
        context: {},
        filters: []
      };

      expect(isQueryTargeted(targetedQuery)).toBe(true);
      expect(isQueryTargeted(broadQuery)).toBe(false);
    });

    test('should create appropriate query plans based on complexity', () => {
      const createQueryPlan = (navigator as any).createQueryPlan.bind(navigator);
      
      const simpleQuery: NavigationQuery = {
        type: 'semantic',
        query: 'find user John',
        context: { nodeType: 'User', limit: 10 },
        filters: [{ type: 'node', field: 'name', operator: 'equals', value: 'John' }]
      };

      const complexQuery: NavigationQuery = {
        type: 'temporal',
        query: 'analyze all relationships over time',
        context: {},
        filters: []
      };

      const simplePlan = createQueryPlan(simpleQuery);
      const complexPlan = createQueryPlan(complexQuery);

      expect(simplePlan.complexity).toBe('low');
      expect(simplePlan.estimatedCost).toBeLessThan(50);
      expect(simplePlan.optimizations).toContain('fast_path');

      expect(complexPlan.complexity).toBe('high');
      expect(complexPlan.estimatedCost).toBeGreaterThan(50);
    });
  });

  describe('μT-2.5: Natural Language to Cypher Translation', () => {
    test('should translate simple queries correctly', async () => {
      const cypher = await navigator.translateNaturalLanguageToCypher(
        'find all users with name John',
        { nodeType: 'User' }
      );

      expect(cypher).toContain('MATCH (n:User)');
      expect(cypher).toContain('WHERE');
      expect(cypher).toContain('name');
      expect(cypher).toContain('RETURN n');
    });

    test('should handle relationship queries', async () => {
      const cypher = await navigator.translateNaturalLanguageToCypher(
        'find users connected to projects',
        { nodeType: 'User', relationshipType: 'WORKS_ON', hasRelationships: true }
      );

      expect(cypher).toContain('MATCH (n:User)');
      expect(cypher).toContain('[:WORKS_ON]');
      expect(cypher).toContain('RETURN n, m');
    });

    test('should extract advanced conditions from natural language', () => {
      const extractConditions = (navigator as any).extractAdvancedConditions.bind(navigator);
      
      const conditions = extractConditions('find users with status "active" and age greater than 25');
      
      expect(conditions).toHaveLength(2);
      expect(conditions[0]).toMatchObject({
        field: 'status',
        operator: '=',
        value: '"active"'
      });
      expect(conditions[1]).toMatchObject({
        field: 'age',
        operator: '>',
        value: '25'
      });
    });

    test('should validate Cypher syntax', () => {
      const validateSyntax = (navigator as any).validateCypherSyntax.bind(navigator);

      expect(validateSyntax('MATCH (n) RETURN n')).toBe(true);
      expect(validateSyntax('MATCH (n WHERE n.name = "test" RETURN n')).toBe(false); // Missing parenthesis
      expect(validateSyntax('SELECT * FROM users')).toBe(false); // Wrong query language
    });

    test('should provide fallback for invalid queries', async () => {
      const cypher = await navigator.translateNaturalLanguageToCypher(
        'invalid query with special characters @#$%',
        {}
      );

      expect(cypher).toContain('MATCH (n)');
      expect(cypher).toContain('LIMIT 10');
    });

    test('should optimize generated Cypher queries', () => {
      const optimizeCypher = (navigator as any).optimizeCypherQuery.bind(navigator);

      const messy = '  MATCH   (n)     RETURN  *  ';
      const clean = optimizeCypher(messy);

      expect(clean).toBe('MATCH (n) RETURN n');
    });
  });

  describe('μT-2.6: Advanced Caching and Memory Management', () => {
    test('should cache query results with intelligent storage', () => {
      const mockResult: NavigationResult = {
        nodes: [],
        relationships: [],
        paths: [],
        insights: [],
        metadata: { queryTime: 100, resultCount: 0, confidence: 0.8 }
      };

      const storeCache = (navigator as any).storeIntelligentCache.bind(navigator);
      const getCache = (navigator as any).getAdvancedCachedResult.bind(navigator);

      const cacheKey = 'test-key';
      storeCache(cacheKey, mockResult, 50);

      const cachedResult = getCache(cacheKey);
      expect(cachedResult).toEqual(mockResult);
    });

    test('should calculate eviction scores correctly', () => {
      const calculateScore = (navigator as any).calculateEvictionScore.bind(navigator);

      const oldEntry = {
        result: {} as NavigationResult,
        timestamp: Date.now() - 100000, // Old entry
        ttl: 300000,
        accessCount: 1,
        cost: 10
      };

      const frequentEntry = {
        result: {} as NavigationResult,
        timestamp: Date.now() - 10000,
        ttl: 300000,
        accessCount: 10, // Frequently accessed
        cost: 30
      };

      const oldScore = calculateScore(oldEntry);
      const frequentScore = calculateScore(frequentEntry);

      expect(oldScore).toBeGreaterThan(frequentScore); // Old entry should be evicted first
    });

    test('should detect non-cacheable queries', () => {
      const isCacheable = (navigator as any).isQueryCacheable.bind(navigator);

      const cacheableQuery: NavigationQuery = {
        type: 'semantic',
        query: 'find all users',
        context: {}
      };

      const nonCacheableQuery: NavigationQuery = {
        type: 'semantic',
        query: 'find my current tasks',
        context: {}
      };

      expect(isCacheable(cacheableQuery)).toBe(true);
      expect(isCacheable(nonCacheableQuery)).toBe(false);
    });

    test('should generate optimized cache keys', () => {
      const generateKey = (navigator as any).generateOptimizedCacheKey.bind(navigator);

      const query: NavigationQuery = {
        type: 'semantic',
        query: 'test query',
        context: { limit: 10 },
        filters: []
      };

      const key = generateKey(query);
      
      expect(key).toContain('semantic:');
      expect(key.length).toBeGreaterThan(10);
    });
  });

  describe('Performance Metrics and Monitoring', () => {
    test('should track query performance metrics', () => {
      const updateMetrics = (navigator as any).updateMetrics.bind(navigator);

      updateMetrics(150, false); // Slow query, cache miss
      updateMetrics(50, true);   // Fast query, cache hit
      updateMetrics(1200, false); // Very slow query

      const metrics = navigator.getPerformanceMetrics();

      expect(metrics.queryCount).toBe(3);
      expect(metrics.averageQueryTime).toBeGreaterThan(0);
      expect(metrics.cacheHitRatio).toBeCloseTo(0.33, 1); // 1 hit out of 3
      expect(metrics.slowQueries.length).toBe(1); // Only the 1200ms query
    });

    test('should clean up old metrics', () => {
      const cleanupMetrics = (navigator as any).cleanupOldMetrics.bind(navigator);
      const queryTimes = (navigator as any).queryTimes;

      // Add many query times
      for (let i = 0; i < 1500; i++) {
        queryTimes.push(100);
      }

      cleanupMetrics();

      expect(queryTimes.length).toBe(1000); // Should be limited to 1000
    });

    test('should provide comprehensive performance metrics', () => {
      const metrics = navigator.getPerformanceMetrics();

      expect(metrics).toHaveProperty('averageQueryTime');
      expect(metrics).toHaveProperty('cacheHitRatio');
      expect(metrics).toHaveProperty('queryCount');
      expect(metrics).toHaveProperty('totalExecutionTime');
      expect(metrics).toHaveProperty('slowQueries');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('optimizationCount');
    });

    test('should update memory usage tracking', () => {
      const updateMemory = (navigator as any).updateMemoryUsage.bind(navigator);
      
      updateMemory();
      const metrics = navigator.getPerformanceMetrics();

      expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(typeof metrics.memoryUsage).toBe('number');
    });
  });

  describe('Performance Validation', () => {
    test('should meet performance targets for query optimization', () => {
      const startTime = Date.now();
      
      // Simulate multiple optimized queries
      const queries = [
        { type: 'semantic' as const, query: 'find users', context: { limit: 50 } },
        { type: 'structural' as const, query: 'analyze network', context: { nodeType: 'User', limit: 30 } },
        { type: 'temporal' as const, query: 'track changes', context: { limit: 20 } }
      ];

      for (const query of queries) {
        const optimizeQuery = (navigator as any).optimizeQuery.bind(navigator);
        const createPlan = (navigator as any).createQueryPlan.bind(navigator);
        
        const optimized = optimizeQuery(query);
        const plan = createPlan(optimized);
        
        // Verify optimization occurred
        expect(plan.optimizations.length).toBeGreaterThan(0);
        expect(optimized.context.limit).toBeLessThanOrEqual(100);
      }

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(100); // Should be very fast for planning
    });

    test('should demonstrate cache effectiveness measurement', () => {
      const metrics = navigator.getPerformanceMetrics();

      // Validate cache metrics are tracked
      expect(typeof metrics.cacheHitRatio).toBe('number');
      expect(metrics.cacheHitRatio).toBeGreaterThanOrEqual(0);
      expect(metrics.cacheHitRatio).toBeLessThanOrEqual(1);
    });

    test('should validate query complexity analysis', () => {
      const createQueryPlan = (navigator as any).createQueryPlan.bind(navigator);
      
      const lowComplexityQuery: NavigationQuery = {
        type: 'semantic',
        query: 'find specific user by id',
        context: { nodeType: 'User', limit: 1 },
        filters: [{ type: 'node', field: 'id', operator: 'equals', value: '123' }]
      };

      const highComplexityQuery: NavigationQuery = {
        type: 'causal',
        query: 'find all possible connections',
        context: {},
        filters: []
      };

      const lowPlan = createQueryPlan(lowComplexityQuery);
      const highPlan = createQueryPlan(highComplexityQuery);

      expect(lowPlan.complexity).toBe('low');
      expect(highPlan.complexity).toBe('high');
      expect(lowPlan.estimatedCost).toBeLessThan(highPlan.estimatedCost);
    });
  });
});