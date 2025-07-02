import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for analyzing diff content
 */
export interface DiffAnalysis {
  addedLines: number;
  removedLines: number;
  modifiedLines: number;
  complexity: 'low' | 'medium' | 'high';
  hasStructuralChanges: boolean;
}

/**
 * Interface for content validation
 */
export interface ContentValidation {
  isValid: boolean;
  hasContent: boolean;
  hasChanges: boolean;
  estimatedImpact: 'minimal' | 'moderate' | 'significant';
}

/**
 * PromptAnalyzer handles diff generation, content analysis, and validation
 * for prompt improvement workflows
 */
export class PromptAnalyzer {
  /**
   * Generate unified diff between original and improved content
   */
  async generateUnifiedDiff(originalContent: string, improvedContent: string, filename: string): Promise<string> {
    if (originalContent === improvedContent) {
      return '';
    }

    const originalLines = originalContent.split('\n');
    const improvedLines = improvedContent.split('\n');
    
    // Simple diff algorithm - for production, consider using a more sophisticated library
    const diff = this.createUnifiedDiff(originalLines, improvedLines, filename);
    
    return diff;
  }

  /**
   * Create a unified diff format string
   */
  private createUnifiedDiff(originalLines: string[], improvedLines: string[], filename: string): string {
    const diffLines: string[] = [];
    
    diffLines.push(`--- ${filename}`);
    diffLines.push(`+++ ${filename}`);
    
    // Simple implementation - track changes line by line
    let originalIndex = 0;
    let improvedIndex = 0;
    
    while (originalIndex < originalLines.length || improvedIndex < improvedLines.length) {
      const originalLine = originalLines[originalIndex];
      const improvedLine = improvedLines[improvedIndex];
      
      if (originalLine === improvedLine) {
        // Lines match
        originalIndex++;
        improvedIndex++;
        continue;
      }
      
      // Find next matching line to determine context
      const contextStart = Math.max(0, originalIndex - 1);
      const contextEnd = Math.min(originalLines.length, originalIndex + 3);
      
      diffLines.push(`@@ -${originalIndex + 1},${contextEnd - contextStart} +${improvedIndex + 1},${contextEnd - contextStart} @@`);
      
      // Add context before change
      if (contextStart < originalIndex) {
        diffLines.push(` ${originalLines[contextStart]}`);
      }
      
      // Add removed line
      if (originalIndex < originalLines.length) {
        diffLines.push(`-${originalLine || ''}`);
        originalIndex++;
      }
      
      // Add added line
      if (improvedIndex < improvedLines.length) {
        diffLines.push(`+${improvedLine || ''}`);
        improvedIndex++;
      }
      
      // Add context after change
      if (originalIndex < originalLines.length && improvedIndex < improvedLines.length) {
        const nextOriginal = originalLines[originalIndex];
        const nextImproved = improvedLines[improvedIndex];
        if (nextOriginal === nextImproved) {
          diffLines.push(` ${nextOriginal}`);
        }
      }
    }
    
    return diffLines.join('\n');
  }

  /**
   * Analyze diff content for complexity and impact
   */
  analyzeDiff(diff: string): DiffAnalysis {
    const lines = diff.split('\n');
    let addedLines = 0;
    let removedLines = 0;
    let modifiedLines = 0;
    let hasStructuralChanges = false;

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        addedLines++;
        if (line.includes('##') || line.includes('###') || line.includes('```')) {
          hasStructuralChanges = true;
        }
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removedLines++;
        if (line.includes('##') || line.includes('###') || line.includes('```')) {
          hasStructuralChanges = true;
        }
      }
    }

    modifiedLines = Math.min(addedLines, removedLines);

    // Determine complexity based on changes
    let complexity: 'low' | 'medium' | 'high' = 'low';
    const totalChanges = addedLines + removedLines;
    
    if (totalChanges > 20 || hasStructuralChanges) {
      complexity = 'high';
    } else if (totalChanges > 5) {
      complexity = 'medium';
    }

    return {
      addedLines,
      removedLines,
      modifiedLines,
      complexity,
      hasStructuralChanges
    };
  }

  /**
   * Validate content for basic requirements
   */
  validateContent(originalContent: string, improvedContent: string): ContentValidation {
    const hasContent = originalContent.trim().length > 0 && improvedContent.trim().length > 0;
    const hasChanges = originalContent !== improvedContent;
    
    let estimatedImpact: 'minimal' | 'moderate' | 'significant' = 'minimal';
    
    if (hasChanges) {
      const lengthDifference = Math.abs(improvedContent.length - originalContent.length);
      const lengthRatio = lengthDifference / originalContent.length;
      
      if (lengthRatio > 0.5) {
        estimatedImpact = 'significant';
      } else if (lengthRatio > 0.2) {
        estimatedImpact = 'moderate';
      }
    }

    return {
      isValid: hasContent,
      hasContent,
      hasChanges,
      estimatedImpact
    };
  }

  /**
   * Apply diff to content (simplified implementation)
   */
  applyDiffToContent(originalContent: string, diff: string): string {
    // This is a simplified implementation
    // In production, use a proper diff library
    const lines = originalContent.split('\n');
    const diffLines = diff.split('\n');
    
    let result = [...lines];
    
    for (const diffLine of diffLines) {
      if (diffLine.startsWith('+') && !diffLine.startsWith('+++')) {
        result.push(diffLine.substring(1));
      } else if (diffLine.startsWith('-') && !diffLine.startsWith('---')) {
        const lineToRemove = diffLine.substring(1);
        const index = result.indexOf(lineToRemove);
        if (index !== -1) {
          result.splice(index, 1);
        }
      }
    }
    
    return result.join('\n');
  }

  /**
   * Extract key metrics from prompt content
   */
  extractContentMetrics(content: string): {
    wordCount: number;
    lineCount: number;
    characterCount: number;
    hasInstructions: boolean;
    hasExamples: boolean;
    hasConstraints: boolean;
  } {
    const words = content.trim().split(/\s+/).filter(w => w.length > 0);
    const lines = content.split('\n');
    
    const hasInstructions = /you\s+(should|must|need|will)/i.test(content) || 
                          /please\s+/i.test(content) ||
                          /instructions?:/i.test(content);
    
    const hasExamples = /example[s]?[:.]?/i.test(content) ||
                       /for\s+instance/i.test(content) ||
                       /such\s+as/i.test(content);
    
    const hasConstraints = /don['']?t|do\s+not|avoid|never|always/i.test(content) ||
                          /constraint[s]?[:.]?/i.test(content) ||
                          /limit[s]?[:.]?/i.test(content);

    return {
      wordCount: words.length,
      lineCount: lines.length,
      characterCount: content.length,
      hasInstructions,
      hasExamples,
      hasConstraints
    };
  }

  /**
   * Compare content metrics between original and improved versions
   */
  compareContentMetrics(originalContent: string, improvedContent: string): {
    wordCountDelta: number;
    lineCountDelta: number;
    characterCountDelta: number;
    structuralChanges: string[];
    improvementIndicators: string[];
  } {
    const originalMetrics = this.extractContentMetrics(originalContent);
    const improvedMetrics = this.extractContentMetrics(improvedContent);

    const structuralChanges: string[] = [];
    const improvementIndicators: string[] = [];

    // Detect structural changes
    if (originalMetrics.hasInstructions !== improvedMetrics.hasInstructions) {
      structuralChanges.push(improvedMetrics.hasInstructions ? 'Added instructions' : 'Removed instructions');
    }
    
    if (originalMetrics.hasExamples !== improvedMetrics.hasExamples) {
      structuralChanges.push(improvedMetrics.hasExamples ? 'Added examples' : 'Removed examples');
    }
    
    if (originalMetrics.hasConstraints !== improvedMetrics.hasConstraints) {
      structuralChanges.push(improvedMetrics.hasConstraints ? 'Added constraints' : 'Removed constraints');
    }

    // Detect improvement indicators
    if (improvedMetrics.hasExamples && !originalMetrics.hasExamples) {
      improvementIndicators.push('Added examples for clarity');
    }
    
    if (improvedMetrics.hasConstraints && !originalMetrics.hasConstraints) {
      improvementIndicators.push('Added constraints for better control');
    }

    const wordCountDelta = improvedMetrics.wordCount - originalMetrics.wordCount;
    if (wordCountDelta > 0 && wordCountDelta < originalMetrics.wordCount * 0.3) {
      improvementIndicators.push('Added helpful detail while maintaining conciseness');
    }

    return {
      wordCountDelta: improvedMetrics.wordCount - originalMetrics.wordCount,
      lineCountDelta: improvedMetrics.lineCount - originalMetrics.lineCount,
      characterCountDelta: improvedMetrics.characterCount - originalMetrics.characterCount,
      structuralChanges,
      improvementIndicators
    };
  }
}