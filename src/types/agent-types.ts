import { ClaudeModel } from '../claude-client';
import { CognitiveCanvas } from '../cognitive-canvas';

export interface AgentConfig {
  id: string;
  role: string;
  capabilities: string[];
  claudeConfig: {
    apiKey?: string;
    sessionToken?: string;
    defaultModel?: ClaudeModel;
    maxTokens?: number;
    temperature?: number;
  };
  workspaceRoot: string;
  cognitiveCanvas?: CognitiveCanvas;
  cognitiveCanvasConfig?: {
    uri: string;
    username: string;
    password: string;
  };
}

export interface TaskContext {
  projectInfo?: any;
  dependencies?: any[];
  files?: string[];
  [key: string]: any;
}

export interface TaskResult {
  success: boolean;
  result?: any;
  error?: string;
  artifacts?: string[];
  metadata?: Record<string, any>;
  output?: any;
}

export type AgentStatus = 'uninitialized' | 'initialized' | 'assigned' | 'running' | 'completed' | 'error' | 'idle' | 'impasse';