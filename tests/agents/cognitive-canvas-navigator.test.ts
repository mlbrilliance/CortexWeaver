import { CognitiveCanvasNavigator, NavigationQuery, NavigationResult } from '../../src/agents/cognitive-canvas-navigator';
import { AgentConfig, TaskContext, TaskData } from '../../src/agent';
import { ClaudeModel } from '../../src/claude-client';
import { setupMocks, createMockAgentConfig, createMockTask, createMockContext, suppressConsoleWarnings } from '../test-utils';

describe('CognitiveCanvasNavigator', () => {
  let navigator: CognitiveCanvasNavigator;
  let mockConfig: AgentConfig;
  let mockTask: TaskData;
  let mockContext: TaskContext;

  setupMocks();
  suppressConsoleWarnings();

  beforeEach(() => {
    mockConfig = createMockAgentConfig(
      'navigator-1',
      'cognitive-canvas-navigator',
      ['graph-navigation', 'knowledge-discovery', 'semantic-search']
    );

    mockTask = createMockTask(
      'nav-task-1',
      'Navigate project knowledge graph',
      'Find patterns and connections in the project knowledge base'
    );
    (mockTask as any).metadata = {
      queryType: 'semantic',
      searchTerms: 'user authentication patterns'
    };

    mockContext = createMockContext({
      query: {
        type: 'semantic',
        query: 'user authentication patterns',
        context: { domain: 'security' }
      }
    });

    navigator = new CognitiveCanvasNavigator();
  });

  describe('initialization', () => {
    it('should initialize with correct capabilities', () => {
      expect(navigator.getCapabilities()).toEqual([]);
      expect(navigator.getRole()).toBe('');
      expect(navigator.getStatus()).toBe('uninitialized');
    });

    it('should initialize successfully with valid config', async () => {
      await navigator.initialize(mockConfig);
      
      expect(navigator.getId()).toBe('navigator-1');
      expect(navigator.getRole()).toBe('cognitive-canvas-navigator');
      expect(navigator.getStatus()).toBe('initialized');
      expect(navigator.getCapabilities()).toEqual([
        'graph-navigation',
        'knowledge-discovery',
        'semantic-search'
      ]);
    });

    it('should require graph-navigation capability', async () => {
      const invalidConfig = createMockAgentConfig(
        'navigator-1',
        'cognitive-canvas-navigator',
        ['other-capability']
      );

      await expect(navigator.initialize(invalidConfig)).rejects.toThrow(
        'Cognitive Canvas Navigator requires graph-navigation capability'
      );
    });
  });

  describe('task execution', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
      await navigator.receiveTask(mockTask, mockContext);
    });

    it('should accept a navigation task', async () => {
      expect(navigator.getCurrentTask()).toEqual(mockTask);
      expect(navigator.getTaskContext()).toEqual(mockContext);
      expect(navigator.getStatus()).toBe('assigned');
    });

    it('should execute navigation successfully', async () => {
      const mockNavigationResult: NavigationResult = {
        nodes: [
          {
            id: 'node-1',
            type: 'authentication',
            properties: { name: 'JWT Authentication' },
            labels: ['security', 'auth'],
            relevanceScore: 0.95
          }
        ],
        relationships: [
          {
            id: 'rel-1',
            source: 'node-1',
            target: 'node-2',
            type: 'IMPLEMENTS',
            properties: {},
            weight: 0.8
          }
        ],
        paths: [
          {
            nodes: ['node-1', 'node-2'],
            relationships: ['rel-1'],
            weight: 0.8,
            length: 2,
            description: 'Authentication pattern path'
          }
        ],
        insights: [
          {
            type: 'pattern',
            description: 'Common authentication pattern found',
            confidence: 0.9,
            evidence: ['JWT usage', 'Token validation']
          }
        ],
        metadata: {
          queryTime: 150,
          resultCount: 1,
          confidence: 0.95
        }
      };

      jest.spyOn(navigator as any, 'executeNavigation').mockResolvedValue(mockNavigationResult);
      jest.spyOn(navigator as any, 'parseNavigationQuery').mockReturnValue({
        type: 'semantic',
        query: 'user authentication patterns',
        context: { domain: 'security' }
      });

      const result = await navigator.run();

      expect(result.success).toBe(true);
      expect(result.result).toEqual(mockNavigationResult);
      expect(navigator.getStatus()).toBe('completed');
    });

    it('should handle navigation errors', async () => {
      jest.spyOn(navigator as any, 'parseNavigationQuery').mockReturnValue({
        type: 'semantic',
        query: 'invalid query'
      });
      jest.spyOn(navigator as any, 'executeNavigation').mockRejectedValue(new Error('Navigation failed'));

      await expect(navigator.run()).rejects.toThrow('Navigation failed');
      expect(navigator.getStatus()).toBe('error');
    });
  });

  describe('navigation query parsing', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
      await navigator.receiveTask(mockTask, mockContext);
    });

    it('should parse navigation query from task context', () => {
      const query = (navigator as any).parseNavigationQuery();
      
      expect(query.type).toBe('semantic');
      expect(query.query).toBe('user authentication patterns');
      expect(query.context).toEqual({ domain: 'security' });
    });

    it('should handle missing navigation query', () => {
      const emptyContext = createMockContext({});
      (navigator as any).taskContext = emptyContext;

      expect(() => (navigator as any).parseNavigationQuery()).toThrow('No navigation query provided');
    });
  });

  describe('query execution', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
    });

    it('should execute semantic queries', async () => {
      const query: NavigationQuery = {
        type: 'semantic',
        query: 'authentication patterns',
        context: { domain: 'security' }
      };

      const mockResult: NavigationResult = {
        nodes: [],
        relationships: [],
        paths: [],
        insights: [],
        metadata: { queryTime: 100, resultCount: 0, confidence: 0.8 }
      };

      jest.spyOn(navigator as any, 'executeSemanticQuery').mockResolvedValue(mockResult);

      const result = await (navigator as any).executeNavigation(query);
      
      expect(result).toEqual(mockResult);
      expect((navigator as any).executeSemanticQuery).toHaveBeenCalledWith(query);
    });

    it('should execute structural queries', async () => {
      const query: NavigationQuery = {
        type: 'structural',
        query: 'find connected components',
        context: {}
      };

      const mockResult: NavigationResult = {
        nodes: [],
        relationships: [],
        paths: [],
        insights: [],
        metadata: { queryTime: 150, resultCount: 0, confidence: 0.7 }
      };

      jest.spyOn(navigator as any, 'executeStructuralQuery').mockResolvedValue(mockResult);

      const result = await (navigator as any).executeNavigation(query);
      
      expect(result).toEqual(mockResult);
      expect((navigator as any).executeStructuralQuery).toHaveBeenCalledWith(query);
    });

    it('should execute temporal queries', async () => {
      const query: NavigationQuery = {
        type: 'temporal',
        query: 'changes over time',
        context: { timeframe: '30d' }
      };

      const mockResult: NavigationResult = {
        nodes: [],
        relationships: [],
        paths: [],
        insights: [],
        metadata: { queryTime: 200, resultCount: 0, confidence: 0.6 }
      };

      jest.spyOn(navigator as any, 'executeTemporalQuery').mockResolvedValue(mockResult);

      const result = await (navigator as any).executeNavigation(query);
      
      expect(result).toEqual(mockResult);
      expect((navigator as any).executeTemporalQuery).toHaveBeenCalledWith(query);
    });

    it('should execute causal queries', async () => {
      const query: NavigationQuery = {
        type: 'causal',
        query: 'root cause analysis',
        context: { issue: 'performance degradation' }
      };

      const mockResult: NavigationResult = {
        nodes: [],
        relationships: [],
        paths: [],
        insights: [],
        metadata: { queryTime: 300, resultCount: 0, confidence: 0.85 }
      };

      jest.spyOn(navigator as any, 'executeCausalQuery').mockResolvedValue(mockResult);

      const result = await (navigator as any).executeNavigation(query);
      
      expect(result).toEqual(mockResult);
      expect((navigator as any).executeCausalQuery).toHaveBeenCalledWith(query);
    });
  });

  describe('caching', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
    });

    it('should cache navigation results', async () => {
      const query: NavigationQuery = {
        type: 'semantic',
        query: 'test query',
        context: {}
      };

      const mockResult: NavigationResult = {
        nodes: [],
        relationships: [],
        paths: [],
        insights: [],
        metadata: { queryTime: 100, resultCount: 0, confidence: 0.8 }
      };

      jest.spyOn(navigator as any, 'executeSemanticQuery').mockResolvedValue(mockResult);

      // First call should execute the query
      const result1 = await (navigator as any).executeNavigation(query);
      expect(result1).toEqual(mockResult);
      expect((navigator as any).executeSemanticQuery).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await (navigator as any).executeNavigation(query);
      expect(result2).toEqual(mockResult);
      expect((navigator as any).executeSemanticQuery).toHaveBeenCalledTimes(1);
    });

    it('should generate consistent cache keys', () => {
      const query1: NavigationQuery = {
        type: 'semantic',
        query: 'test',
        context: { a: 1 }
      };

      const query2: NavigationQuery = {
        type: 'semantic',
        query: 'test',
        context: { a: 1 }
      };

      const key1 = (navigator as any).generateCacheKey(query1);
      const key2 = (navigator as any).generateCacheKey(query2);

      expect(key1).toBe(key2);
    });
  });

  describe('internal state management', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
    });

    it('should maintain query cache', () => {
      expect((navigator as any).queryCache).toBeDefined();
      expect((navigator as any).queryCache instanceof Map).toBe(true);
    });

    it('should maintain indexed paths', () => {
      expect((navigator as any).indexedPaths).toBeDefined();
      expect((navigator as any).indexedPaths instanceof Map).toBe(true);
    });
  });

  // μT-2.4: Targeted query enforcement tests
  describe('μT-2.4: Targeted Query Enforcement', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
    });

    it('should enforce result limits for queries', async () => {
      const query: NavigationQuery = {
        type: 'semantic',
        query: 'find all nodes',
        context: { limit: 10 }
      };

      jest.spyOn(navigator as any, 'sendToClaude').mockResolvedValue({
        content: JSON.stringify({
          nodes: Array(50).fill(null).map((_, i) => ({ id: `node-${i}`, type: 'test' })),
          relationships: [],
          paths: [],
          insights: []
        })
      });

      const result = await (navigator as any).executeNavigation(query);
      
      expect(result.nodes.length).toBeLessThanOrEqual(10);
    });

    it('should validate query specificity', () => {
      const vagueQuery: NavigationQuery = {
        type: 'semantic',
        query: 'find everything',
        context: {}
      };

      const specificQuery: NavigationQuery = {
        type: 'semantic',
        query: 'find authentication nodes with JWT properties',
        context: { nodeType: 'auth', properties: ['jwt'] }
      };

      expect((navigator as any).isQueryTargeted(vagueQuery)).toBe(false);
      expect((navigator as any).isQueryTargeted(specificQuery)).toBe(true);
    });

    it('should enforce selective property retrieval', async () => {
      const query: NavigationQuery = {
        type: 'semantic',
        query: 'user authentication',
        context: { 
          selectProperties: ['name', 'type', 'createdAt'],
          excludeProperties: ['internalData', 'debugInfo']
        }
      };

      jest.spyOn(navigator as any, 'sendToClaude').mockResolvedValue({
        content: JSON.stringify({
          nodes: [{
            id: 'node-1',
            type: 'auth',
            properties: { name: 'JWT', type: 'token' },
            labels: ['security']
          }]
        })
      });

      const result = await (navigator as any).executeNavigation(query);
      
      const node = result.nodes[0];
      expect(node.properties).not.toHaveProperty('internalData');
      expect(node.properties).not.toHaveProperty('debugInfo');
    });

    it('should apply depth limitations for path queries', async () => {
      const sourceId = 'source-1';
      const targetId = 'target-1';
      const maxDepth = 3;

      jest.spyOn(navigator as any, 'sendToClaude').mockResolvedValue({
        content: JSON.stringify({
          paths: [{
            nodes: ['source-1', 'intermediate-1', 'intermediate-2', 'target-1'],
            relationships: ['rel-1', 'rel-2', 'rel-3'],
            length: 4,
            weight: 0.8
          }]
        })
      });

      const paths = await navigator.findOptimalPaths(sourceId, targetId, maxDepth);
      
      expect(paths.every(path => path.length <= maxDepth)).toBe(true);
    });

    it('should enforce node type filtering', async () => {
      const query: NavigationQuery = {
        type: 'structural',
        query: 'find hub nodes',
        context: {},
        filters: [{
          type: 'node',
          field: 'type',
          operator: 'equals',
          value: 'authentication'
        }]
      };

      jest.spyOn(navigator as any, 'sendToClaude').mockResolvedValue({
        content: JSON.stringify({
          nodes: [
            { id: 'node-1', type: 'authentication' },
            { id: 'node-2', type: 'authorization' }
          ]
        })
      });

      const result = await (navigator as any).executeNavigation(query);
      
      expect(result.nodes.every((node: any) => node.type === 'authentication')).toBe(true);
    });
  });

  // μT-2.5: Natural Language to Cypher translation tests
  describe('μT-2.5: Natural Language to Cypher Translation', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
    });

    it('should translate simple semantic queries to Cypher', () => {
      const nlQuery = 'find all users with name John';
      const expectedCypher = 'MATCH (u:User) WHERE u.name = "John" RETURN u';
      
      const cypher = (navigator as any).translateToCypher(nlQuery, { nodeType: 'User' });
      
      expect(cypher).toContain('MATCH (u:User)');
      expect(cypher).toContain('u.name = "John"');
      expect(cypher).toContain('RETURN u');
    });

    it('should handle relationship queries', () => {
      const nlQuery = 'find users who follow other users';
      const expectedPattern = 'MATCH (u1:User)-[:FOLLOWS]->(u2:User)';
      
      const cypher = (navigator as any).translateToCypher(nlQuery, { 
        relationship: 'FOLLOWS',
        sourceType: 'User',
        targetType: 'User'
      });
      
      expect(cypher).toContain('MATCH (u1:User)-[:FOLLOWS]->(u2:User)');
    });

    it('should build complex queries with multiple conditions', () => {
      const nlQuery = 'find active users created after 2023 who have more than 10 posts';
      
      const cypher = (navigator as any).translateToCypher(nlQuery, {
        nodeType: 'User',
        conditions: [
          { field: 'status', operator: '=', value: 'active' },
          { field: 'createdAt', operator: '>', value: '2023-01-01' },
          { field: 'postCount', operator: '>', value: 10 }
        ]
      });
      
      expect(cypher).toContain('u.status = "active"');
      expect(cypher).toContain('u.createdAt > "2023-01-01"');
      expect(cypher).toContain('u.postCount > 10');
    });

    it('should validate generated Cypher syntax', () => {
      const validCypher = 'MATCH (n:Node) RETURN n';
      const invalidCypher = 'MATCH (n:Node RETURN n'; // Missing closing parenthesis
      
      expect((navigator as any).validateCypherSyntax(validCypher)).toBe(true);
      expect((navigator as any).validateCypherSyntax(invalidCypher)).toBe(false);
    });

    it('should handle aggregation queries', () => {
      const nlQuery = 'count users by department';
      
      const cypher = (navigator as any).translateToCypher(nlQuery, {
        nodeType: 'User',
        aggregation: 'count',
        groupBy: 'department'
      });
      
      expect(cypher).toContain('COUNT(u)');
      expect(cypher).toContain('u.department');
      expect(cypher).toContain('GROUP BY');
    });
  });

  // μT-2.6: Advanced caching and optimization tests
  describe('μT-2.6: Advanced Caching and Optimization', () => {
    beforeEach(async () => {
      await navigator.initialize(mockConfig);
    });

    it('should implement LRU cache eviction', async () => {
      // Clear caches and set small cache size for testing
      (navigator as any).advancedCache.clear();
      (navigator as any).queryCache.clear();
      (navigator as any).cacheManager = { maxSize: 2, strategy: 'lru' };
      
      const queries = [
        { type: 'semantic', query: 'query1', context: {} },
        { type: 'semantic', query: 'query2', context: {} },
        { type: 'semantic', query: 'query3', context: {} }
      ];

      jest.spyOn(navigator as any, 'executeSemanticQuery').mockResolvedValue({
        nodes: [],
        relationships: [],
        paths: [],
        insights: [],
        metadata: { queryTime: 100, resultCount: 0, confidence: 0.8 }
      });

      // Execute queries sequentially and check cache size
      for (let i = 0; i < queries.length; i++) {
        const cacheKey = (navigator as any).generateCacheKey(queries[i]);
        console.log(`Query ${i + 1} cache key: ${cacheKey}`);
        await (navigator as any).executeNavigation(queries[i]);
        console.log(`After query ${i + 1}, cache size: ${(navigator as any).advancedCache.size}`);
      }

      // Cache should not exceed max size
      expect((navigator as any).advancedCache.size).toBeLessThanOrEqual(2);
    });

    it('should implement query plan optimization', () => {
      const complexQuery = {
        type: 'semantic',
        query: 'find connected patterns',
        context: {
          joins: ['users', 'posts', 'comments'],
          filters: [{ field: 'active', value: true }]
        }
      };

      const optimizedPlan = (navigator as any).optimizeQueryPlan(complexQuery);
      
      expect(optimizedPlan.executionOrder).toBeDefined();
      expect(optimizedPlan.indexUsage).toBeDefined();
      expect(optimizedPlan.estimatedCost).toBeLessThan(1000);
    });

    it('should cache with TTL (time-to-live)', async () => {
      const query: NavigationQuery = {
        type: 'semantic',
        query: 'time-sensitive data',
        context: { ttl: 1000 } // 1 second TTL
      };

      jest.spyOn(navigator as any, 'executeSemanticQuery').mockResolvedValue({
        nodes: [],
        relationships: [],
        paths: [],
        insights: [],
        metadata: { queryTime: 100, resultCount: 0, confidence: 0.8 }
      });

      // First execution
      await (navigator as any).executeNavigation(query);
      expect((navigator as any).executeSemanticQuery).toHaveBeenCalledTimes(1);

      // Second execution within TTL - should use cache
      await (navigator as any).executeNavigation(query);
      expect((navigator as any).executeSemanticQuery).toHaveBeenCalledTimes(1);

      // Wait for TTL to expire and test again
      await new Promise(resolve => setTimeout(resolve, 1100));
      await (navigator as any).executeNavigation(query);
      expect((navigator as any).executeSemanticQuery).toHaveBeenCalledTimes(2);
    });

    it('should track query performance metrics', async () => {
      const query: NavigationQuery = {
        type: 'semantic',
        query: 'performance test',
        context: {}
      };

      // Clear caches and reset performance stats for this test
      (navigator as any).advancedCache.clear();
      (navigator as any).queryCache.clear();
      (navigator as any).performanceStats = {
        queryTimes: [],
        cacheHits: 0,
        cacheMisses: 0,
        totalQueries: 0
      };

      jest.spyOn(navigator as any, 'executeSemanticQuery').mockResolvedValue({
        nodes: [],
        relationships: [],
        paths: [],
        insights: [],
        metadata: { queryTime: 250, resultCount: 5, confidence: 0.9 }
      });

      await (navigator as any).executeNavigation(query);
      
      const metrics = (navigator as any).getPerformanceMetrics();
      expect(metrics.averageQueryTime).toBeGreaterThan(0);
      expect(metrics.cacheHitRatio).toBeDefined();
      expect(metrics.queryCount).toBeGreaterThan(0);
    });

    it('should implement smart cache warming', async () => {
      const frequentQueries = [
        { type: 'semantic', query: 'common pattern 1', context: {} },
        { type: 'semantic', query: 'common pattern 2', context: {} }
      ];

      jest.spyOn(navigator as any, 'executeSemanticQuery').mockResolvedValue({
        nodes: [],
        relationships: [],
        paths: [],
        insights: [],
        metadata: { queryTime: 100, resultCount: 0, confidence: 0.8 }
      });

      await (navigator as any).warmCache(frequentQueries);
      
      // Verify queries are pre-loaded in cache
      for (const query of frequentQueries) {
        const cacheKey = (navigator as any).generateCacheKey(query);
        expect((navigator as any).queryCache.has(cacheKey)).toBe(true);
      }
    });
  });
});