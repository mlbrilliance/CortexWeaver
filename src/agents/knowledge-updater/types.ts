// Extract all interfaces from the original knowledge-updater.ts
export interface KnowledgeExtractionResult {
  success: boolean;
  insights?: Array<{
    type: 'pattern' | 'best_practice' | 'anti_pattern' | 'technique';
    description: string;
    applicability: string;
    confidence: number;
    evidence?: string[];
  }>;
  codePatterns?: Array<{
    pattern: string;
    description: string;
    codeSnippet?: string;
    reusability: 'low' | 'medium' | 'high';
    complexity: 'low' | 'medium' | 'high';
  }>;
  pheromoneRecommendations?: Array<{
    type: 'guide_pheromone' | 'warn_pheromone';
    context: string;
    strength: number;
    reason: string;
    ttl?: number;
  }>;
  knowledgeNodeId?: string;
  error?: string;
  performance?: {
    extractionTimeMs: number;
    tokenUsage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  };
}

export interface PheromoneOptimizationResult {
  success: boolean;
  strengthened?: Array<{
    context: string;
    newStrength: number;
    adjustment: string;
    reason: string;
  }>;
  weakened?: Array<{
    context: string;
    newStrength: number;
    adjustment: string;
    reason: string;
  }>;
  deprecated?: Array<{
    context: string;
    reason: string;
  }>;
  error?: string;
}

export interface ConsistencyValidationResult {
  success: boolean;
  conflicts?: Array<{
    type: string;
    knowledge1: string;
    knowledge2: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    resolution?: string;
  }>;
  resolutions?: Array<{
    action: 'deprecate' | 'strengthen' | 'merge' | 'clarify';
    knowledgeId: string;
    reason: string;
  }>;
  knowledgeGaps?: Array<{
    domain: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    suggestedSources: string[];
  }>;
  error?: string;
}

export interface PatternSynthesisResult {
  success: boolean;
  emergingPatterns?: Array<{
    name: string;
    description: string;
    frequency: number;
    successRate: number;
    components: string[];
    reusabilityScore: number;
    complexity: 'low' | 'medium' | 'high';
  }>;
  evolutionInsights?: Array<{
    pattern: string;
    trend: 'emerging' | 'maturing' | 'declining' | 'increasingly_sophisticated';
    recommendation: string;
  }>;
  pheromoneRecommendations?: Array<{
    type: 'guide_pheromone' | 'warn_pheromone';
    context: string;
    strength: number;
    ttl: number;
    metadata: Record<string, any>;
  }>;
  error?: string;
}

export interface KnowledgeRecommendationResult {
  success: boolean;
  relevantKnowledge?: Array<{
    knowledgeId: string;
    relevanceScore: number;
    application: string;
    confidence: number;
  }>;
  recommendations?: string[];
  error?: string;
}

export interface TaskCompletionEvent {
  taskId: string;
  status: 'completed' | 'failed';
  outcome: 'success' | 'failure';
  timestamp: string;
}

export interface TaskCompletionResult {
  success: boolean;
  knowledgeUpdated: boolean;
  error?: string;
}

export interface ProjectMetricsResult {
  success: boolean;
  knowledgeMaturity?: {
    score: number;
    level: 'nascent' | 'developing' | 'mature' | 'advanced';
    strengths: string[];
    gaps: string[];
  };
  patternEffectiveness?: {
    averageSuccessRate: number;
    topPatterns: string[];
    underperformingPatterns: string[];
  };
  recommendations?: string[];
  error?: string;
}