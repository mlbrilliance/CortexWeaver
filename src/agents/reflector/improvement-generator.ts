import * as fs from 'fs';
import * as path from 'path';
import { 
  PromptImprovements, 
  PromptImprovement, 
  PatternAnalysis, 
  PromptAnalysis 
} from './types';

/**
 * ImprovementGenerator handles generating prompt improvements and proposals
 */
export class ImprovementGenerator {
  constructor(
    private config: any | null,
    private analyzePromptPerformance: () => Promise<PromptAnalysis>,
    private analyzePerformancePatterns: () => Promise<PatternAnalysis>
  ) {}

  /**
   * Generate prompt improvements based on analysis
   */
  async generatePromptImprovements(): Promise<PromptImprovements> {
    if (!this.config) {
      return { proposals: [] };
    }

    try {
      const promptsDir = path.resolve(this.config.workspaceRoot, 'prompts');
      const proposals: PromptImprovement[] = [];

      // Check if prompts directory exists
      if (!fs.existsSync(promptsDir)) {
        return { proposals: [] };
      }

      // Get prompt analysis
      const analysis = await this.analyzePromptPerformance();
      
      // Get prompt files
      const promptFiles = fs.readdirSync(promptsDir).filter(file => 
        file.endsWith('.md') || file.endsWith('.txt')
      );

      // Generate improvements for underperforming prompts
      for (const underperforming of analysis.underperforming) {
        const promptFile = promptFiles.find(file => 
          file.includes(underperforming.version) || 
          path.basename(file, path.extname(file)) === underperforming.version
        );

        if (promptFile) {
          const filePath = path.join(promptsDir, promptFile);
          const content = fs.readFileSync(filePath, 'utf-8');
          
          const improvement = await this.generatePromptDiff(
            content,
            underperforming.issues,
            underperforming.suggestedImprovements
          );

          if (improvement) {
            proposals.push({
              file: filePath,
              diff: improvement.diff,
              rationale: improvement.rationale,
              priority: this.determinePriority(underperforming.issues)
            });
          }
        }
      }

      // Generate improvements based on successful patterns
      const patterns = await this.analyzePerformancePatterns();
      const successfulPromptSuggestions = this.generateSuccessBasedImprovements(patterns, analysis);
      
      proposals.push(...successfulPromptSuggestions);

      return { proposals };
    } catch (error) {
      console.warn('Prompt improvement generation failed:', (error as Error).message);
      return { proposals: [] };
    }
  }

  /**
   * Generate prompt diff with improvements
   */
  private async generatePromptDiff(
    content: string,
    issues: string[],
    suggestions: string[]
  ): Promise<{ diff: string; rationale: string } | null> {
    try {
      // Simplified diff generation
      const diff = this.createSimpleDiff(content, suggestions);
      const rationale = `Addressing issues: ${issues.join(', ')}. Improvements: ${suggestions.join(', ')}.`;
      
      return { diff, rationale };
    } catch (error) {
      console.warn('Failed to generate prompt diff:', error);
      return null;
    }
  }

  /**
   * Create simplified diff
   */
  private createSimpleDiff(content: string, suggestions: string[]): string {
    // Simplified implementation - in production would use proper diff generation
    let diff = `--- Original\n+++ Improved\n`;
    diff += `@@ -1,${content.split('\n').length} +1,${content.split('\n').length + suggestions.length} @@\n`;
    diff += content.split('\n').map(line => ` ${line}`).join('\n');
    diff += '\n+\n';
    diff += suggestions.map(suggestion => `+ ${suggestion}`).join('\n');
    return diff;
  }

  /**
   * Determine priority based on issues
   */
  private determinePriority(issues: string[]): 'low' | 'medium' | 'high' {
    if (issues.some(issue => issue.toLowerCase().includes('very low'))) {
      return 'high';
    }
    if (issues.some(issue => issue.toLowerCase().includes('high'))) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Generate improvements based on successful patterns
   */
  private generateSuccessBasedImprovements(
    patterns: PatternAnalysis,
    analysis: PromptAnalysis
  ): PromptImprovement[] {
    const improvements: PromptImprovement[] = [];
    
    // Simplified implementation
    if (patterns.successPatterns.length > 0) {
      const topPattern = patterns.successPatterns[0];
      if (topPattern.successRate && topPattern.successRate > 0.8) {
        improvements.push({
          file: 'prompts/general-improvements.md',
          diff: `+ Apply successful pattern: ${topPattern.pattern}`,
          rationale: `Replicate high-performing pattern with ${Math.round(topPattern.successRate * 100)}% success rate`,
          priority: 'medium'
        });
      }
    }

    return improvements;
  }

  /**
   * Update config reference
   */
  updateConfig(config: any | null): void {
    this.config = config;
  }
}