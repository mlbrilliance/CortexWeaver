/**
 * Context Primer Types and Interfaces
 * 
 * Contains all type definitions used by the Context Primer system
 */

import { TaskData, PheromoneData, ArchitecturalDecisionData, ContractData, CodeModuleData } from '../cognitive-canvas';

export interface ContextData {
  architecturalDecisions: ArchitecturalDecisionData[];
  codeModules: CodeModuleData[];
  contracts: ContractData[];
  pheromones: PheromoneData[];
  dependencies: TaskData[];
  similarTasks: Array<TaskData & { similarity: number }>;
  workspaceFiles: WorkspaceFileInfo[];
  contractSnippets: ContractSnippet[];
}

export interface WorkspaceFileInfo {
  path: string;
  type: 'source' | 'test' | 'config' | 'documentation';
  language: string;
  size: number;
  lastModified: Date;
  relevanceScore: number;
}

export interface ContractSnippet {
  file: string;
  type: 'openapi' | 'json-schema' | 'property-definition';
  content: string;
  description: string;
  relevanceScore: number;
}

export interface ContextPrimingOptions {
  maxCodeModules?: number;
  maxPheromones?: number;
  maxSimilarTasks?: number;
  maxWorkspaceFiles?: number;
  maxContractSnippets?: number;
  includeTests?: boolean;
  includeDocs?: boolean;
}