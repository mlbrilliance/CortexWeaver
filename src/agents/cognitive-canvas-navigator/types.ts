/**
 * Types and interfaces for Cognitive Canvas Navigator Agent
 */

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
    cacheHit?: boolean;
    optimized?: boolean;
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

export interface PerformanceMetrics {
  averageQueryTime: number; 
  cacheHitRatio: number; 
  queryCount: number;
  totalExecutionTime: number; 
  slowQueries: Array<{ query: string; time: number }>;
  memoryUsage: number; 
  optimizationCount: number;
}

export interface CacheEntry {
  result: NavigationResult; 
  timestamp: number; 
  ttl: number; 
  accessCount: number; 
  cost: number;
}

export interface QueryPlan {
  executionOrder: string[]; 
  estimatedCost: number; 
  optimizations: string[]; 
  complexity: 'low' | 'medium' | 'high';
}