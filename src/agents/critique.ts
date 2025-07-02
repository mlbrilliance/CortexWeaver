import { ClaudeClient, ClaudeResponse } from '../claude-client';
import { CognitiveCanvas, PheromoneData, ArtifactData } from '../cognitive-canvas';
import { MCPClient } from '../mcp-client';

export interface CritiqueResult {
  success: boolean;
  critique?: {
    issues: Array<{
      severity: 'low' | 'medium' | 'high';
      type: string;
      location: string;
      description: string;
      suggestion?: string;
    }>;
    overallQuality: 'poor' | 'fair' | 'good' | 'excellent';
    recommendations: string[];
  };
  critiqueNodeId?: string;
  error?: string;
  performance?: {
    analysisTimeMs: number;
    tokenUsage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  };
}

export interface StructuredFeedback {
  artifactId: string;
  overallSeverity: 'low' | 'medium' | 'high';
  issues: Array<{
    severity: 'low' | 'medium' | 'high';
    type: string;
    location: string;
    description: string;
    suggestion?: string;
  }>;
  actionRequired: boolean;
  pauseDownstream: boolean;
  recommendations: string[];
  resolutionSteps: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  immediateAction?: boolean;
}

export class CritiqueAgent {
  private claudeClient: ClaudeClient;
  private cognitiveCanvas: CognitiveCanvas;
  private mcpClient?: MCPClient;
  private _isRunning: boolean = false;
  private _currentScanId: string | null = null;
  private scanInterval?: NodeJS.Timeout;
  private feedbackCallback?: (feedback: StructuredFeedback) => void;

  constructor(
    claudeClient: ClaudeClient,
    cognitiveCanvas: CognitiveCanvas,
    mcpClient?: MCPClient
  ) {
    this.claudeClient = claudeClient;
    this.cognitiveCanvas = cognitiveCanvas;
    this.mcpClient = mcpClient;
  }

  public get role(): string {
    return 'Critique';
  }

  public get capabilities(): string[] {
    return ['continuous-scanning', 'artifact-analysis', 'structured-feedback', 'quality-assessment'];
  }

  public get isRunning(): boolean {
    return this._isRunning;
  }

  public get currentScanId(): string | null {
    return this._currentScanId;
  }

  /**
   * Start continuous scanning for new artifacts to critique
   */
  async startContinuousScanning(
    projectId: string, 
    feedbackCallback?: (feedback: StructuredFeedback) => void
  ): Promise<string | null> {
    try {
      // Prevent multiple concurrent scans
      if (this._isRunning) {
        return null;
      }

      // Test scan to ensure it works
      if (this.mcpClient) {
        await this.mcpClient.scanWorktreeForChanges(projectId);
      }

      this._isRunning = true;
      this._currentScanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store callback for later use
      if (feedbackCallback) {
        this.feedbackCallback = feedbackCallback;
      }

      // Set up periodic scanning (in real implementation)
      // For now, just return the scan ID
      return this._currentScanId;

    } catch (error) {
      this._isRunning = false;
      this._currentScanId = null;
      return null;
    }
  }

  /**
   * Stop continuous scanning
   */
  async stopScanning(): Promise<boolean> {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = undefined;
    }
    
    this._isRunning = false;
    this._currentScanId = null;
    return true;
  }

  /**
   * Analyze a specific artifact and provide critique
   */
  async analyzeArtifact(artifactId: string): Promise<CritiqueResult> {
    const startTime = Date.now();
    
    try {
      // Get artifact details
      const artifact = await this.cognitiveCanvas.getArtifactDetails(artifactId);
      if (!artifact) {
        return {
          success: false,
          error: 'Artifact not found'
        };
      }

      // Get relevant warning pheromones for context
      const warningPheromones = await this.cognitiveCanvas.getPheromonesByType('warn_pheromone');

      // Build critique prompt
      const prompt = this.buildCritiquePrompt(artifact, warningPheromones);

      // Get critique from Claude
      const response = await this.claudeClient.sendMessage(prompt);
      
      let critique;
      try {
        critique = JSON.parse(response.content);
        if (!critique) {
          throw new Error('Parsed critique is null or undefined');
        }
      } catch (parseError) {
        return {
          success: false,
          error: 'Failed to parse critique response'
        };
      }

      // Determine overall severity
      const overallSeverity = this.determineOverallSeverity(critique.issues || []);

      // Create critique node in Cognitive Canvas
      const critiqueNodeId = await this.cognitiveCanvas.createCritiqueNode({
        artifactId,
        critique,
        severity: overallSeverity,
        tokenUsage: response.tokenUsage
      });

      // Link critique to artifact
      await this.cognitiveCanvas.linkCritiqueToArtifact(critiqueNodeId, artifactId);

      // Call feedback callback if available
      if (this.feedbackCallback) {
        const feedback = await this.generateStructuredFeedback(artifactId, critique, overallSeverity);
        this.feedbackCallback(feedback);
      }

      const endTime = Date.now();
      
      return {
        success: true,
        critique,
        critiqueNodeId,
        performance: {
          analysisTimeMs: endTime - startTime,
          tokenUsage: response.tokenUsage
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to analyze artifact: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate structured feedback for Orchestrator consumption
   */
  async generateStructuredFeedback(
    artifactId: string,
    critique: any,
    overallSeverity: 'low' | 'medium' | 'high'
  ): Promise<StructuredFeedback> {
    const issues = critique.issues || [];
    const highSeverityIssues = issues.filter((issue: any) => issue.severity === 'high');
    const actionRequired = issues.length > 0;
    const pauseDownstream = overallSeverity === 'high' || highSeverityIssues.length > 0;
    
    // Generate resolution steps
    const resolutionSteps = this.generateResolutionSteps(issues);
    
    // Determine priority
    let priority: 'low' | 'medium' | 'high' | 'urgent' = 'low';
    if (overallSeverity === 'high') {
      priority = 'urgent';
    } else if (overallSeverity === 'medium') {
      priority = 'high';
    } else if (actionRequired) {
      priority = 'medium';
    }

    return {
      artifactId,
      overallSeverity,
      issues,
      actionRequired,
      pauseDownstream,
      recommendations: critique.recommendations || [],
      resolutionSteps,
      priority,
      immediateAction: priority === 'urgent'
    };
  }

  /**
   * Batch analyze multiple artifacts efficiently
   */
  async batchAnalyzeArtifacts(artifactIds: string[]): Promise<CritiqueResult[]> {
    const results: CritiqueResult[] = [];
    
    // Process artifacts in parallel for efficiency
    const analysisPromises = artifactIds.map(id => this.analyzeArtifact(id));
    const batchResults = await Promise.all(analysisPromises);
    
    return batchResults;
  }

  /**
   * Build critique prompt for Claude
   */
  private buildCritiquePrompt(artifact: ArtifactData, warningPheromones: PheromoneData[]): string {
    let prompt = `Analyze the following ${artifact.type} artifact for quality and completeness:\n\n`;
    prompt += `Artifact Name: ${artifact.name}\n`;
    prompt += `Type: ${artifact.type}\n`;
    prompt += `Content:\n${artifact.content}\n\n`;

    if (warningPheromones.length > 0) {
      prompt += `Consider these known issues from previous analyses:\n`;
      warningPheromones.forEach(p => {
        prompt += `- ${p.context} (${p.type}, strength: ${p.strength})\n`;
      });
      prompt += '\n';
    }

    prompt += `Please provide a structured critique in JSON format with the following structure:\n`;
    prompt += `{\n`;
    prompt += `  "issues": [\n`;
    prompt += `    {\n`;
    prompt += `      "severity": "low|medium|high",\n`;
    prompt += `      "type": "issue-category",\n`;
    prompt += `      "location": "specific-location",\n`;
    prompt += `      "description": "detailed-description",\n`;
    prompt += `      "suggestion": "how-to-fix"\n`;
    prompt += `    }\n`;
    prompt += `  ],\n`;
    prompt += `  "overallQuality": "poor|fair|good|excellent",\n`;
    prompt += `  "recommendations": ["list", "of", "recommendations"]\n`;
    prompt += `}\n\n`;

    prompt += `Focus on:\n`;
    prompt += `- Completeness and correctness\n`;
    prompt += `- Logic flaws or missing steps\n`;
    prompt += `- Error handling gaps\n`;
    prompt += `- Input validation issues\n`;
    prompt += `- Security concerns\n`;
    prompt += `- Performance implications\n`;

    return prompt;
  }

  /**
   * Determine overall severity from individual issues
   */
  private determineOverallSeverity(issues: Array<{ severity: string }> | undefined): 'low' | 'medium' | 'high' {
    if (!issues || !Array.isArray(issues)) {
      return 'low';
    }
    if (issues.some(issue => issue.severity === 'high')) {
      return 'high';
    }
    if (issues.some(issue => issue.severity === 'medium')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Generate resolution steps from issues
   */
  private generateResolutionSteps(issues: Array<{ suggestion?: string; description: string }>): string[] {
    const steps: string[] = [];
    
    issues.forEach(issue => {
      if (issue.suggestion) {
        steps.push(issue.suggestion);
      } else {
        steps.push(`Address: ${issue.description}`);
      }
    });

    return steps;
  }
}