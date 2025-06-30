import { Agent, AgentConfig } from '../agent';

export interface NavigationQuery {
  type: 'semantic' | 'structural' | 'temporal' | 'causal';
  query: string;
  context?: Record<string, any>;
  filters?: NavigationFilter[];
}

export interface NavigationFilter {
  type: 'node' | 'relationship' | 'property';
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less';
  value: any;
}

export interface NavigationResult {
  nodes: KnowledgeNode[];
  relationships: KnowledgeRelationship[];
  paths: NavigationPath[];
  insights: NavigationInsight[];
  metadata: {
    queryTime: number;
    resultCount: number;
    confidence: number;
  };
}

export interface KnowledgeNode {
  id: string;
  type: string;
  properties: Record<string, any>;
  labels: string[];
  relevanceScore: number;
}

export interface KnowledgeRelationship {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, any>;
  weight: number;
}

export interface NavigationPath {
  nodes: string[];
  relationships: string[];
  weight: number;
  length: number;
  description: string;
}

export interface NavigationInsight {
  type: string;
  description: string;
  confidence: number;
  evidence: string[];
}

export interface GraphStatistics {
  nodeCount: number;
  relationshipCount: number;
  density: number;
  clusteringCoefficient: number;
  averagePathLength: number;
}

export class CognitiveCanvasNavigator extends Agent {
  private queryCache: Map<string, NavigationResult> = new Map();
  private indexedPaths: Map<string, NavigationPath[]> = new Map();

  async initialize(config: AgentConfig): Promise<void> {
    await super.initialize(config);
    if (!config.capabilities.includes('graph-navigation')) {
      throw new Error('Cognitive Canvas Navigator requires graph-navigation capability');
    }
  }

  getPromptTemplate(): string {
    return `Cognitive Canvas Navigator: Navigate knowledge graphs to discover insights, patterns, and connections. Execute semantic queries, analyze graph structures, and provide intelligent navigation paths. Query: {{query}}, Context: {{context}}.`;
  }

  async executeTask(): Promise<NavigationResult> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    const query = this.parseNavigationQuery();
    await this.reportProgress('started', `Navigating cognitive canvas with ${query.type} query`);

    try {
      const result = await this.executeNavigation(query);
      await this.reportProgress('completed', `Navigation completed: ${result.nodes.length} nodes, ${result.relationships.length} relationships`);
      return result;
    } catch (error) {
      await this.reportProgress('failed', `Navigation failed: ${(error as Error).message}`);
      throw error;
    }
  }

  async executeNavigation(query: NavigationQuery): Promise<NavigationResult> {
    const cacheKey = this.generateCacheKey(query);
    
    if (this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey)!;
    }

    const startTime = Date.now();
    
    let result: NavigationResult;
    switch (query.type) {
      case 'semantic':
        result = await this.executeSemanticQuery(query);
        break;
      case 'structural':
        result = await this.executeStructuralQuery(query);
        break;
      case 'temporal':
        result = await this.executeTemporalQuery(query);
        break;
      case 'causal':
        result = await this.executeCausalQuery(query);
        break;
      default:
        throw new Error(`Unsupported query type: ${query.type}`);
    }

    result.metadata.queryTime = Date.now() - startTime;
    this.queryCache.set(cacheKey, result);
    
    return result;
  }

  async findOptimalPaths(sourceId: string, targetId: string, maxDepth: number = 6): Promise<NavigationPath[]> {
    const cacheKey = `paths:${sourceId}:${targetId}:${maxDepth}`;
    
    if (this.indexedPaths.has(cacheKey)) {
      return this.indexedPaths.get(cacheKey)!;
    }

    const paths = await this.discoverPaths(sourceId, targetId, maxDepth);
    const optimizedPaths = this.optimizePaths(paths);
    
    this.indexedPaths.set(cacheKey, optimizedPaths);
    return optimizedPaths;
  }

  async analyzeGraphStructure(): Promise<GraphStatistics> {
    const promptContext = {
      query: 'graph structure analysis',
      context: JSON.stringify({ analysis: 'structure' })
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

Analyze the current knowledge graph structure and provide:
1. Node and relationship counts
2. Graph density and clustering coefficient
3. Average path length between nodes
4. Key structural insights and patterns

Return structured statistics about the graph topology.`;

    const response = await this.sendToClaude(prompt);
    return this.parseGraphStatistics(response.content);
  }

  async discoverInsights(context: Record<string, any>): Promise<NavigationInsight[]> {
    const promptContext = {
      query: 'insight discovery',
      context: JSON.stringify(context)
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

CONTEXT:
${JSON.stringify(context, null, 2)}

Discover insights from the knowledge graph including:
1. Hidden patterns and correlations
2. Anomalies and outliers
3. Emerging trends and relationships
4. Knowledge gaps and opportunities

Provide insights with confidence scores and supporting evidence.`;

    const response = await this.sendToClaude(prompt);
    return this.parseInsights(response.content);
  }

  private parseNavigationQuery(): NavigationQuery {
    const taskQuery = this.taskContext?.query;
    if (!taskQuery) {
      throw new Error('No navigation query provided');
    }

    return {
      type: taskQuery.type || 'semantic',
      query: taskQuery.query || '',
      context: taskQuery.context || {},
      filters: taskQuery.filters || []
    };
  }

  private generateCacheKey(query: NavigationQuery): string {
    return `${query.type}:${query.query}:${JSON.stringify(query.context)}:${JSON.stringify(query.filters)}`;
  }

  private async executeSemanticQuery(query: NavigationQuery): Promise<NavigationResult> {
    const promptContext = {
      query: query.query,
      context: JSON.stringify(query.context || {})
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

SEMANTIC QUERY: ${query.query}
CONTEXT: ${JSON.stringify(query.context, null, 2)}
FILTERS: ${JSON.stringify(query.filters, null, 2)}

Execute semantic search to find:
1. Conceptually related nodes and relationships
2. Similar patterns and structures
3. Relevant knowledge connections
4. Contextual insights and recommendations

Return structured results with nodes, relationships, paths, and insights.`;

    const response = await this.sendToClaude(prompt);
    return this.parseNavigationResult(response.content);
  }

  private async executeStructuralQuery(query: NavigationQuery): Promise<NavigationResult> {
    const promptContext = {
      query: query.query,
      context: JSON.stringify(query.context || {})
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

STRUCTURAL QUERY: ${query.query}
CONTEXT: ${JSON.stringify(query.context, null, 2)}

Analyze graph structure to find:
1. Structural patterns and motifs
2. Central nodes and hub connections
3. Community clusters and groups
4. Structural anomalies and gaps

Return nodes, relationships, and structural insights.`;

    const response = await this.sendToClaude(prompt);
    return this.parseNavigationResult(response.content);
  }

  private async executeTemporalQuery(query: NavigationQuery): Promise<NavigationResult> {
    const promptContext = {
      query: query.query,
      context: JSON.stringify(query.context || {})
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

TEMPORAL QUERY: ${query.query}
CONTEXT: ${JSON.stringify(query.context, null, 2)}

Analyze temporal patterns to find:
1. Evolution and change patterns
2. Temporal correlations and trends
3. Sequential dependencies
4. Time-based insights and predictions

Return temporal analysis with timeline insights.`;

    const response = await this.sendToClaude(prompt);
    return this.parseNavigationResult(response.content);
  }

  private async executeCausalQuery(query: NavigationQuery): Promise<NavigationResult> {
    const promptContext = {
      query: query.query,
      context: JSON.stringify(query.context || {})
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

CAUSAL QUERY: ${query.query}
CONTEXT: ${JSON.stringify(query.context, null, 2)}

Analyze causal relationships to find:
1. Cause-effect chains and dependencies
2. Root causes and contributing factors
3. Impact propagation paths
4. Causal insights and interventions

Return causal analysis with dependency insights.`;

    const response = await this.sendToClaude(prompt);
    return this.parseNavigationResult(response.content);
  }

  private async discoverPaths(sourceId: string, targetId: string, maxDepth: number): Promise<NavigationPath[]> {
    const promptContext = {
      query: `path discovery from ${sourceId} to ${targetId}`,
      context: JSON.stringify({ sourceId, targetId, maxDepth })
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

Find paths from ${sourceId} to ${targetId} with maximum depth ${maxDepth}.

Discover:
1. Direct and indirect connection paths
2. Weighted paths based on relationship strength
3. Semantic relevance of path connections
4. Alternative routes and redundancies

Return paths with weights, descriptions, and relevance scores.`;

    const response = await this.sendToClaude(prompt);
    return this.parsePaths(response.content);
  }

  private optimizePaths(paths: NavigationPath[]): NavigationPath[] {
    return paths
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10)
      .map(path => ({
        ...path,
        weight: this.normalizeWeight(path.weight)
      }));
  }

  private normalizeWeight(weight: number): number {
    return Math.max(0, Math.min(1, weight));
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

  private parseGraphStatistics(content: string): GraphStatistics {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const stats = JSON.parse(jsonMatch[0]);
        return {
          nodeCount: stats.nodeCount || 0,
          relationshipCount: stats.relationshipCount || 0,
          density: stats.density || 0,
          clusteringCoefficient: stats.clusteringCoefficient || 0,
          averagePathLength: stats.averagePathLength || 0
        };
      }
    } catch (error) {
      console.warn('Failed to parse graph statistics');
    }

    return {
      nodeCount: 0,
      relationshipCount: 0,
      density: 0,
      clusteringCoefficient: 0,
      averagePathLength: 0
    };
  }

  private parseInsights(content: string): NavigationInsight[] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return result.insights || [];
      }
    } catch (error) {
      console.warn('Failed to parse insights');
    }

    return [];
  }

  private parsePaths(content: string): NavigationPath[] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return result.paths || [];
      }
    } catch (error) {
      console.warn('Failed to parse paths');
    }

    return [];
  }
}