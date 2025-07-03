export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  projectId?: string;
  sessionId?: string;
}

export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
}

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TaskData {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  projectId: string;
  createdAt: string;
  updatedAt?: string;
  errorLogs?: string[];
  testResults?: TestResult[];
  requirements?: string[];
  metadata?: Record<string, any>;
}

export interface AgentData {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  status: string;
  createdAt: string;
}

export interface PheromoneData {
  id: string;
  type: string;
  content?: string;
  strength: number;
  context: string;
  metadata: Record<string, any>;
  createdAt: string;
  expiresAt: string;
  pattern?: PheromonePattern;
  decayRate?: number;
}

export interface ArchitecturalDecisionData {
  id: string;
  title: string;
  description: string;
  rationale: string;
  status: string;
  projectId: string;
  createdAt: string;
}

export interface ContractData {
  id: string;
  name: string;
  type: 'openapi' | 'json-schema' | 'property-definition';
  version: string;
  specification: Record<string, any>;
  description?: string;
  projectId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ArtifactData {
  id: string;
  type: string;
  name: string;
  data: any;
  content?: string;
  projectId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FailureData {
  id: string;
  message: string;
  stack?: string;
  stackTrace?: string;
  context: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type?: string;
  agentId?: string;
  errorMessage?: string;
  timestamp?: string;
  taskId?: string;
  projectId: string;
  createdAt: string;
}

export interface DiagnosticData {
  id: string;
  rootCause: string;
  solution: string;
  confidence: number;
  considerations: string[];
  failureId: string;
  createdAt: string;
}

export interface PatternData {
  id: string;
  type: string;
  pattern: string;
  context: string;
  frequency: number;
  taskOutcome?: string;
  projectId: string;
  createdAt: string;
}

export interface CodeModuleData {
  id: string;
  name: string;
  filePath: string;
  type: 'function' | 'class' | 'module' | 'component';
  language: string;
  projectId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TestData {
  id: string;
  name: string;
  filePath: string;
  type: 'unit' | 'integration' | 'e2e' | 'contract';
  framework: string;
  projectId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface KnowledgeGraph {
  project: any;
  tasks: any[];
  agents: any[];
  pheromones: any[];
  architecturalDecisions: any[];
  contracts: any[];
  codeModules: any[];
  tests: any[];
}

export interface SnapshotData {
  version: string;
  timestamp: string;
  metadata: {
    totalNodes: number;
    totalRelationships: number;
    nodeTypes: Record<string, number>;
  };
  nodes: Array<{
    id: string;
    labels: string[];
    properties: Record<string, any>;
  }>;
  relationships: Array<{
    id: string;
    startNode: string;
    endNode: string;
    type: string;
    properties: Record<string, any>;
  }>;
}

export interface PrototypeData {
  id: string;
  contractId: string;
  pseudocode: string;
  flowDiagram: string;
  outputPath: string;
  createdAt: string;
  updatedAt?: string;
}

// Enhanced Pheromone Types for v3.0 Learning System
export interface PheromonePattern {
  taskOutcome: 'success' | 'failure' | 'partial';
  promptPattern: string;
  codePattern?: string;
  agentType: string;
  complexity: 'low' | 'medium' | 'high';
  duration: number;
  errorTypes: string[];
}

export interface EnhancedPheromoneData extends PheromoneData {
  pattern?: PheromonePattern;
  decayRate?: number;
}

export interface PheromoneQueryOptions {
  type?: string;
  agentType?: string;
  minStrength?: number;
  limit?: number;
  complexity?: string;
  taskContext?: string;
}

export interface PatternCorrelation {
  pheromoneId: string;
  correlatedPatterns: PheromonePattern[];
  correlationScore: number;
  temporalTrend: 'increasing' | 'decreasing' | 'stable';
  recommendations: string[];
}

export interface TemporalPattern {
  pattern: PheromonePattern;
  frequency: number;
  successRate: number;
  evolutionTrend: 'improving' | 'degrading' | 'stable';
  timeframe: { start: string; end: string };
}

export interface PheromoneAnalysis {
  totalPheromones: number;
  guidePheromones: number;
  warnPheromones: number;
  avgStrength: number;
  correlations: PatternCorrelation[];
  temporalInsights: TemporalPattern[];
}

export interface PheromoneDecayResult {
  updated: number;
  expired: number;
}

export interface ContextPheromonesResult {
  guides: PheromoneData[];
  warnings: PheromoneData[];
}