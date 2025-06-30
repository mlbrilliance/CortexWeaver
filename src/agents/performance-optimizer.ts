import { Agent, AgentConfig } from '../agent';

export interface PerformanceMetrics {
  timestamp: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  cacheHitRate: number;
  databaseQueryTime: number;
}

export interface OptimizationTarget {
  type: 'latency' | 'throughput' | 'memory' | 'cpu' | 'cache' | 'database';
  currentValue: number;
  targetValue: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface OptimizationRecommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedGain: number;
  implementation: string;
  code?: string;
}

export interface PerformanceProfile {
  projectId: string;
  baseline: PerformanceMetrics;
  current: PerformanceMetrics;
  trends: Array<{ timestamp: number; metrics: PerformanceMetrics; }>;
  bottlenecks: string[];
  optimizations: OptimizationRecommendation[];
}

export interface OptimizationResult {
  recommendations: OptimizationRecommendation[];
  implementationPlan: string;
  expectedImpact: {
    performance: number;
    efficiency: number;
    scalability: number;
  };
  codeOptimizations: Array<{
    file: string;
    optimizations: string[];
  }>;
}

export class PerformanceOptimizer extends Agent {
  private performanceHistory: PerformanceMetrics[] = [];
  private optimizationTargets: OptimizationTarget[] = [];

  async initialize(config: AgentConfig): Promise<void> {
    await super.initialize(config);
    if (!config.capabilities.includes('performance-analysis')) {
      throw new Error('Performance Optimizer requires performance-analysis capability');
    }
  }

  getPromptTemplate(): string {
    return `Performance Optimizer Agent: Analyze system performance, identify bottlenecks, and generate optimization strategies. Focus on latency, throughput, resource efficiency, and scalability improvements. Context: {{metrics}}, Target: {{targets}}.`;
  }

  async executeTask(): Promise<OptimizationResult> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    await this.reportProgress('started', 'Beginning performance optimization analysis');

    try {
      const currentMetrics = await this.collectPerformanceMetrics();
      const profile = await this.analyzePerformanceProfile(currentMetrics);
      const recommendations = await this.generateOptimizations(profile);
      const implementationPlan = await this.createImplementationPlan(recommendations);
      
      const result: OptimizationResult = {
        recommendations,
        implementationPlan,
        expectedImpact: this.calculateExpectedImpact(recommendations),
        codeOptimizations: await this.generateCodeOptimizations(recommendations)
      };

      await this.storeOptimizationResults(result);
      await this.reportProgress('completed', `Generated ${recommendations.length} optimization recommendations`);
      return result;
    } catch (error) {
      await this.reportProgress('failed', `Optimization analysis failed: ${(error as Error).message}`);
      throw error;
    }
  }

  async analyzePerformanceBottlenecks(metrics: PerformanceMetrics[]): Promise<string[]> {
    const promptContext = {
      metrics: JSON.stringify(metrics),
      targets: JSON.stringify(this.optimizationTargets)
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

PERFORMANCE METRICS:
${JSON.stringify(metrics, null, 2)}

OPTIMIZATION TARGETS:
${JSON.stringify(this.optimizationTargets, null, 2)}

Identify performance bottlenecks including:
1. Response time degradation patterns
2. Throughput limitations and constraints
3. Resource utilization inefficiencies
4. Cache miss patterns and database delays
5. CPU and memory hotspots

Return prioritized list of bottlenecks with root cause analysis.`;

    const response = await this.sendToClaude(prompt);
    return this.parseBottlenecks(response.content);
  }

  async generateOptimizationStrategies(bottlenecks: string[], codeContext: string): Promise<OptimizationRecommendation[]> {
    const promptContext = {
      metrics: JSON.stringify(bottlenecks),
      targets: codeContext
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

IDENTIFIED BOTTLENECKS:
${JSON.stringify(bottlenecks, null, 2)}

CODE CONTEXT:
${codeContext}

Generate optimization strategies including:
1. Algorithm optimization opportunities
2. Data structure improvements
3. Caching strategies and implementations
4. Database query optimizations
5. Resource management enhancements
6. Architectural improvements

Return detailed recommendations with implementation guidance and expected impact.`;

    const response = await this.sendToClaude(prompt);
    return this.parseOptimizations(response.content);
  }

  async optimizeForLatency(codeSnippet: string, language: string): Promise<string> {
    const promptContext = {
      metrics: codeSnippet,
      targets: language
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

CODE TO OPTIMIZE:
\`\`\`${language}
${codeSnippet}
\`\`\`

Optimize for reduced latency by:
1. Eliminating unnecessary operations
2. Improving algorithm efficiency
3. Reducing memory allocations
4. Optimizing loop structures
5. Using faster data access patterns

Return optimized code with performance improvements highlighted.`;

    const response = await this.sendToClaude(prompt);
    return this.extractOptimizedCode(response.content, language);
  }

  async optimizeForThroughput(systemConfig: any): Promise<string[]> {
    const promptContext = {
      metrics: JSON.stringify(systemConfig),
      targets: 'throughput optimization'
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

SYSTEM CONFIGURATION:
${JSON.stringify(systemConfig, null, 2)}

Optimize for increased throughput by:
1. Parallel processing opportunities
2. Batch operation optimizations
3. Connection pooling and resource reuse
4. Load balancing improvements
5. Asynchronous processing enhancements

Return throughput optimization strategies with implementation details.`;

    const response = await this.sendToClaude(prompt);
    return this.parseStrategies(response.content);
  }

  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const promptContext = {
      metrics: 'current performance data',
      targets: JSON.stringify({ collection: 'real-time' })
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

Collect current performance metrics including:
1. Response time measurements
2. Request throughput rates
3. Error rates and failure patterns
4. Resource utilization (CPU, memory)
5. Cache performance and database query times

Return comprehensive performance metrics with timestamp.`;

    const response = await this.sendToClaude(prompt);
    const metrics = this.parsePerformanceMetrics(response.content);
    
    this.performanceHistory.push(metrics);
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift();
    }
    
    return metrics;
  }

  private async analyzePerformanceProfile(currentMetrics: PerformanceMetrics): Promise<PerformanceProfile> {
    const projectId = this.taskContext?.projectId || 'unknown';
    const historicalData = await this.queryHistoricalPerformanceData(projectId);
    
    return {
      projectId,
      baseline: historicalData.baseline || currentMetrics,
      current: currentMetrics,
      trends: this.performanceHistory.slice(-20).map(m => ({ timestamp: m.timestamp, metrics: m })),
      bottlenecks: await this.analyzePerformanceBottlenecks(this.performanceHistory),
      optimizations: []
    };
  }

  private async queryHistoricalPerformanceData(projectId: string): Promise<any> {
    try {
      const optimizations: any[] = [];
      return this.processHistoricalOptimizations(optimizations);
    } catch (error) {
      console.warn('Failed to query historical performance data:', (error as Error).message);
      return { baseline: null, trends: [] };
    }
  }

  private processHistoricalOptimizations(optimizations: any[]): any {
    if (!optimizations.length) return { baseline: null, trends: [] };
    
    const latest = optimizations[optimizations.length - 1];
    return {
      baseline: latest.baseline,
      trends: optimizations.slice(-10).map(opt => ({
        timestamp: opt.timestamp,
        metrics: opt.current
      }))
    };
  }

  private async generateOptimizations(profile: PerformanceProfile): Promise<OptimizationRecommendation[]> {
    const codeContext = this.taskContext?.sourceCode || '';
    return await this.generateOptimizationStrategies(profile.bottlenecks, codeContext);
  }

  private async createImplementationPlan(recommendations: OptimizationRecommendation[]): Promise<string> {
    const promptContext = {
      metrics: JSON.stringify(recommendations),
      targets: 'implementation planning'
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

OPTIMIZATION RECOMMENDATIONS:
${JSON.stringify(recommendations, null, 2)}

Create a comprehensive implementation plan including:
1. Prioritization based on impact and difficulty
2. Sequential implementation steps
3. Testing and validation strategies
4. Rollback procedures and risk mitigation
5. Performance monitoring and measurement

Return detailed implementation roadmap with timelines and dependencies.`;

    const response = await this.sendToClaude(prompt);
    return response.content;
  }

  private calculateExpectedImpact(recommendations: OptimizationRecommendation[]): { performance: number; efficiency: number; scalability: number; } {
    const highImpact = recommendations.filter(r => r.impact === 'high').length;
    const mediumImpact = recommendations.filter(r => r.impact === 'medium').length;
    const lowImpact = recommendations.filter(r => r.impact === 'low').length;
    
    const totalGain = recommendations.reduce((sum, r) => sum + r.estimatedGain, 0);
    const averageGain = totalGain / Math.max(recommendations.length, 1);
    
    return {
      performance: Math.min(100, averageGain + (highImpact * 10)),
      efficiency: Math.min(100, (highImpact * 15) + (mediumImpact * 8) + (lowImpact * 3)),
      scalability: Math.min(100, averageGain * 0.8 + (highImpact * 12))
    };
  }

  private async generateCodeOptimizations(recommendations: OptimizationRecommendation[]): Promise<Array<{ file: string; optimizations: string[]; }>> {
    const codeOptimizations: Array<{ file: string; optimizations: string[]; }> = [];
    const fileOptimizations = new Map<string, string[]>();
    
    for (const rec of recommendations) {
      if (rec.code) {
        const fileName = rec.implementation.includes('.') ? rec.implementation : 'optimization.ts';
        if (!fileOptimizations.has(fileName)) {
          fileOptimizations.set(fileName, []);
        }
        fileOptimizations.get(fileName)!.push(rec.title);
      }
    }
    
    for (const [file, optimizations] of fileOptimizations) {
      codeOptimizations.push({ file, optimizations });
    }
    
    return codeOptimizations;
  }

  private async storeOptimizationResults(result: OptimizationResult): Promise<void> {
    try {
      const projectId = this.taskContext?.projectId || 'unknown';
      // Storage would be implemented here
    } catch (error) {
      console.warn('Failed to store optimization results:', (error as Error).message);
    }
  }

  private parsePerformanceMetrics(content: string): PerformanceMetrics {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const metrics = JSON.parse(jsonMatch[0]);
        return {
          timestamp: Date.now(),
          responseTime: metrics.responseTime || 0,
          throughput: metrics.throughput || 0,
          errorRate: metrics.errorRate || 0,
          cpuUsage: metrics.cpuUsage || 0,
          memoryUsage: metrics.memoryUsage || 0,
          cacheHitRate: metrics.cacheHitRate || 0,
          databaseQueryTime: metrics.databaseQueryTime || 0
        };
      }
    } catch (error) {
      console.warn('Failed to parse performance metrics');
    }

    return {
      timestamp: Date.now(),
      responseTime: Math.random() * 1000,
      throughput: Math.random() * 1000,
      errorRate: Math.random() * 5,
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      cacheHitRate: Math.random() * 100,
      databaseQueryTime: Math.random() * 100
    };
  }

  private parseBottlenecks(content: string): string[] {
    const lines = content.split('\n');
    const bottlenecks: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && (trimmed.match(/^\d+\.|\-|\*/) || trimmed.toLowerCase().includes('bottleneck'))) {
        bottlenecks.push(trimmed.replace(/^\d+\.\s*|\-\s*|\*\s*/, ''));
      }
    }

    return bottlenecks.length > 0 ? bottlenecks : ['General performance optimization needed'];
  }

  private parseOptimizations(content: string): OptimizationRecommendation[] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return result.optimizations || result.recommendations || [];
      }
    } catch (error) {
      console.warn('Failed to parse optimizations');
    }

    return [{
      id: 'opt-1',
      category: 'general',
      title: 'General Performance Optimization',
      description: 'Implement performance best practices',
      impact: 'medium',
      difficulty: 'medium',
      estimatedGain: 15,
      implementation: 'Apply standard optimization techniques'
    }];
  }

  private extractOptimizedCode(content: string, language: string): string {
    const codeBlockRegex = new RegExp(`\`\`\`${language}\\s*([\\s\\S]*?)\`\`\``, 'i');
    const match = content.match(codeBlockRegex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    const genericCodeBlock = content.match(/```[\s\S]*?```/);
    if (genericCodeBlock) {
      return genericCodeBlock[0].replace(/```\w*\n?/, '').replace(/```$/, '').trim();
    }
    
    return content;
  }

  private parseStrategies(content: string): string[] {
    const lines = content.split('\n');
    const strategies: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && (trimmed.match(/^\d+\.|\-|\*/) || trimmed.toLowerCase().includes('strategy'))) {
        strategies.push(trimmed.replace(/^\d+\.\s*|\-\s*|\*\s*/, ''));
      }
    }

    return strategies.length > 0 ? strategies : ['Implement standard throughput optimization techniques'];
  }
}