import * as fs from 'fs';

/**
 * Interface representing a parsed persona
 */
export interface Persona {
  /** The agent's role title */
  role: string;
  
  /** Core identity description */
  coreIdentity: string;
  
  /** Primary responsibilities */
  primaryResponsibilities: string[];
  
  /** Behavioral guidelines */
  behavioralGuidelines: string[];
  
  /** Interaction patterns */
  interactionPatterns: Record<string, string[]>;
  
  /** Success metrics */
  successMetrics: string[];
  
  /** Adaptation triggers */
  adaptationTriggers: string[];
  
  /** Version information */
  version: PersonaVersion;
  
  /** Optional technical expertise section */
  technicalExpertise?: string[];
  
  /** Optional tools and techniques */
  toolsAndTechniques?: string[];
  
  /** Front-matter metadata */
  metadata: PersonaMetadata;
  
  /** Raw markdown content for fallback */
  rawContent: string;
  
  /** File path for the persona */
  filePath: string;
  
  /** Last modified timestamp */
  lastModified: Date;
}

/**
 * Version information for personas
 */
export interface PersonaVersion {
  /** Initial release version */
  initialRelease: string;
  
  /** Last updated timestamp */
  lastUpdated: string;
  
  /** Improvement trigger conditions */
  improvementTrigger: string;
  
  /** Version history entries */
  history?: PersonaVersionEntry[];
}

/**
 * Version history entry
 */
export interface PersonaVersionEntry {
  /** Version identifier */
  version: string;
  
  /** Timestamp of this version */
  timestamp: string;
  
  /** Changes made in this version */
  changes: string[];
  
  /** Reason for the change */
  reason: string;
  
  /** Performance metrics if available */
  metrics?: Record<string, number>;
}

/**
 * Front-matter metadata for personas
 */
export interface PersonaMetadata {
  /** Agent identifier */
  id: string;
  
  /** Agent name */
  name: string;
  
  /** Agent category/type */
  category: string;
  
  /** Priority level */
  priority: 'high' | 'medium' | 'low';
  
  /** Tags for categorization */
  tags: string[];
  
  /** Dependencies on other agents */
  dependencies: string[];
  
  /** Capabilities this agent provides */
  capabilities: string[];
  
  /** Model preferences */
  modelPreferences?: {
    preferred: string;
    alternatives: string[];
    complexity: 'low' | 'medium' | 'high';
  };
  
  /** Performance settings */
  performance?: {
    cacheEnabled: boolean;
    hotReloadEnabled: boolean;
    timeoutMs: number;
  };
  
  /** Custom metadata fields */
  custom?: Record<string, any>;
}

/**
 * Persona diff result
 */
export interface PersonaDiff {
  /** Old version information */
  oldVersion: PersonaVersion;
  
  /** New version information */
  newVersion: PersonaVersion;
  
  /** List of changes */
  changes: PersonaChange[];
  
  /** Summary of changes */
  summary: string;
  
  /** Timestamp of diff generation */
  timestamp: string;
}

/**
 * Individual persona change
 */
export interface PersonaChange {
  /** Field that changed */
  field: string;
  
  /** Type of change */
  type: 'added' | 'removed' | 'modified';
  
  /** Old value (for removed/modified) */
  oldValue?: any;
  
  /** New value (for added/modified) */
  newValue?: any;
}

/**
 * Persona performance metrics
 */
export interface PersonaMetrics {
  /** Load time in milliseconds */
  loadTime: number;
  
  /** Number of cache hits */
  cacheHits: number;
  
  /** Last loaded timestamp */
  lastLoaded: Date;
  
  /** File size in bytes */
  fileSize: number;
  
  /** Complexity score */
  complexity: number;
}

/**
 * Configuration for persona loading
 */
export interface PersonaConfig {
  /** Directory containing persona files */
  promptsDirectory: string;
  
  /** Whether to enable hot reloading */
  enableHotReload: boolean;
  
  /** Cache TTL in milliseconds */
  cacheTtl: number;
  
  /** Whether to validate persona format */
  validateFormat: boolean;
  
  /** Fallback to raw content if parsing fails */
  fallbackToRaw: boolean;
  
  /** Workspace root directory */
  workspaceRoot?: string;
}

/**
 * Persona loading result
 */
export interface PersonaLoadResult {
  /** Whether loading was successful */
  success: boolean;
  
  /** Loaded persona (if successful) */
  persona?: Persona;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Whether fallback was used */
  usedFallback: boolean;
  
  /** Validation warnings */
  warnings: string[];
}

/**
 * Persona cache entry
 */
export interface PersonaCacheEntry {
  persona: Persona;
  loadedAt: Date;
  fileStats: fs.Stats;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  score: number;
}

/**
 * Quality assessment interface
 */
export interface QualityAssessment {
  overall: 'excellent' | 'good' | 'fair' | 'poor';
  scores: {
    completeness: number;
    clarity: number;
    specificity: number;
    consistency: number;
  };
  recommendations: string[];
}

/**
 * Best practices result interface
 */
export interface BestPracticesResult {
  followsBestPractices: boolean;
  issues: string[];
  recommendations: string[];
  practiceScore: number;
}