/**
 * Context Primer - Main Entry Point
 * 
 * This file serves as the main entry point for the Context Primer, now refactored
 * to use a modular structure to maintain the 500-line limit per file.
 * 
 * Modular structure:
 * - context-primer/types.ts - All interfaces and type definitions
 * - context-primer/core.ts - Main context priming orchestration logic
 * - context-primer/analysis.ts - File scanning, analysis, and relevance calculations
 */

import { CognitiveCanvas } from './cognitive-canvas';
import { AgentType } from './orchestrator';
import { WorkspaceManager } from './workspace';
import { ContextPrimerCore } from './context-primer/core';
import { ContextData, ContextPrimingOptions } from './context-primer/types';

export class ContextPrimer {
  private core: ContextPrimerCore;

  constructor(canvas: CognitiveCanvas, workspace: WorkspaceManager, contractsPath: string = './contracts') {
    this.core = new ContextPrimerCore(canvas, workspace, contractsPath);
  }

  async primeContext(
    task: any, 
    agentType: AgentType, 
    projectId: string,
    options: ContextPrimingOptions = {}
  ): Promise<ContextData> {
    return this.core.primeContext(task, agentType, projectId, options);
  }
}

// Re-export types and interfaces for external use
export type {
  ContextData,
  WorkspaceFileInfo,
  ContractSnippet,
  ContextPrimingOptions
} from './context-primer/types';

// Re-export modular components for direct access
export { ContextPrimerCore } from './context-primer/core';
export { ContextAnalysis } from './context-primer/analysis';