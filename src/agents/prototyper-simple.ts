import { ClaudeClient, ClaudeResponse } from '../claude-client';
import { CognitiveCanvas, PheromoneData } from '../cognitive-canvas';
import { MCPClient } from '../mcp-client';

export interface ContractData {
  id: string;
  name?: string;
  path?: string;
  specification: {
    endpoints?: Array<{
      path: string;
      method: string;
      parameters?: Record<string, any>;
      responses?: Record<string, any>;
    }>;
    [key: string]: any;
  };
}

export interface PrototypeResult {
  success: boolean;
  pseudocode?: string;
  flowDiagram?: string;
  outputPath?: string;
  error?: string;
  architectureReady?: boolean;
  implementationNotes?: string;
  metadata?: {
    contractId: string;
    complexity: string;
    dependencies: string[];
  };
  tokenUsage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export class PrototyperAgent {
  private claudeClient: ClaudeClient;
  private cognitiveCanvas: CognitiveCanvas;
  private mcpClient?: MCPClient;

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
    return 'Prototyper';
  }

  public get capabilities(): string[] {
    return ['pseudocode-generation', 'logic-flow-design', 'mermaid-diagrams'];
  }

  async processContract(contractId: string): Promise<PrototypeResult> {
    try {
      // Get contract details from Cognitive Canvas
      const contractData = await this.cognitiveCanvas.getContract(contractId);
      if (!contractData) {
        return {
          success: false,
          error: 'Contract not found'
        };
      }

      // Get guide pheromones for patterns
      const pheromones = await this.cognitiveCanvas.getPheromonesByType('guide');

      // Generate pseudocode and collect token usage
      const pseudocodeResponse = await this.generatePseudocodeWithUsage(contractData, pheromones);
      const pseudocode = pseudocodeResponse.content;

      // Generate flow diagram and collect token usage
      const flowDiagramResponse = await this.generateFlowDiagramWithUsage(pseudocode);
      const flowDiagram = flowDiagramResponse.content;

      // Aggregate token usage
      const totalTokenUsage = {
        input_tokens: pseudocodeResponse.tokenUsage.inputTokens + flowDiagramResponse.tokenUsage.inputTokens,
        output_tokens: pseudocodeResponse.tokenUsage.outputTokens + flowDiagramResponse.tokenUsage.outputTokens,
        total_tokens: pseudocodeResponse.tokenUsage.totalTokens + flowDiagramResponse.tokenUsage.totalTokens
      };

      // Save to /prototypes directory
      const outputPath = `/prototypes/${contractData.name || contractId}_prototype.md`;
      const prototypeContent = `# ${contractData.name || contractId} Prototype\n\n## Pseudocode\n${pseudocode}\n\n## Flow Diagram\n${flowDiagram}`;
      
      if (this.mcpClient) {
        await this.mcpClient.writeFileToWorktree(outputPath, contractData.name || contractId, prototypeContent);
      }

      // Create prototype node in Cognitive Canvas
      const prototypeNodeId = await this.cognitiveCanvas.createPrototypeNode({
        contractId,
        pseudocode,
        flowDiagram,
        outputPath
      });

      // Link to contract
      await this.cognitiveCanvas.linkPrototypeToContract(prototypeNodeId, contractId);

      return {
        success: true,
        pseudocode,
        flowDiagram,
        outputPath,
        architectureReady: true,
        implementationNotes: `Prototype contains detailed pseudocode ready for implementation`,
        metadata: {
          contractId,
          complexity: 'medium',
          dependencies: []
        },
        tokenUsage: totalTokenUsage
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to process contract: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async generatePseudocode(contract: any, pheromones: PheromoneData[] = []): Promise<string> {
    try {
      const prompt = this.buildPseudocodePrompt(contract, pheromones);
      const response = await this.claudeClient.sendMessage(prompt);
      return response.content;
    } catch (error) {
      throw new Error(`Failed to generate pseudocode: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generatePseudocodeWithUsage(contract: any, pheromones: PheromoneData[] = []): Promise<ClaudeResponse> {
    try {
      const prompt = this.buildPseudocodePrompt(contract, pheromones);
      return await this.claudeClient.sendMessage(prompt);
    } catch (error) {
      throw new Error(`Failed to generate pseudocode: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateFlowDiagram(pseudocode: string): Promise<string> {
    try {
      const prompt = `Convert the following pseudocode into a Mermaid flowchart diagram:\n\n${pseudocode}`;
      const response = await this.claudeClient.sendMessage(prompt);
      return response.content;
    } catch (error) {
      throw new Error(`Failed to generate flow diagram: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateFlowDiagramWithUsage(pseudocode: string): Promise<ClaudeResponse> {
    try {
      const prompt = `Convert the following pseudocode into a Mermaid flowchart diagram:\n\n${pseudocode}`;
      return await this.claudeClient.sendMessage(prompt);
    } catch (error) {
      throw new Error(`Failed to generate flow diagram: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildPseudocodePrompt(contract: any, pheromones: PheromoneData[]): string {
    let prompt = `Generate detailed pseudocode for the following contract:\n\n`;
    prompt += `Contract: ${JSON.stringify(contract, null, 2)}\n\n`;
    
    if (pheromones.length > 0) {
      prompt += `Apply these successful patterns (guide pheromones):\n`;
      pheromones.forEach(p => {
        prompt += `- ${p.context} (strength: ${p.strength})\n`;
      });
      prompt += '\n';
    }

    prompt += `Please provide:\n`;
    prompt += `1. Detailed pseudocode for each endpoint\n`;
    prompt += `2. Error handling paths\n`;
    prompt += `3. Input validation logic\n`;
    prompt += `4. Return value specifications\n`;

    return prompt;
  }
}