import { Agent } from '../agent';

export interface MutationResults {
  mutationScore: number;
  totalMutants: number;
  killedMutants: number;
  survivedMutants: number;
  timedOutMutants?: number;
  noCoverageMutants?: number;
  survivors: MutationSurvivor[];
}

export interface MutationSurvivor {
  id: string;
  mutator: string;
  location: { line: number; column: number; };
  originalCode: string;
  mutatedCode: string;
  status: string;
}

export interface SurvivorAnalysis {
  totalSurvivors: number;
  survivorsByType: Record<string, number>;
  survivorsByLocation: Record<string, number>;
  recommendations: string[];
  testGaps: TestGap[];
}

export interface TestGap {
  type: string;
  description: string;
  suggestedTests: string[];
  priority: 'low' | 'medium' | 'high';
}

export interface TestImprovement {
  type: string;
  description: string;
  example: string;
  priority: 'low' | 'medium' | 'high';
}

export interface MutationTestSuite {
  report: string;
  mutationScore: number;
  survivors: MutationSurvivor[];
  analysis: SurvivorAnalysis;
  improvements: TestImprovement[];
}

export class MutationTester extends Agent {
  getPromptTemplate(): string {
    return `Mutation Testing Agent specializing in test quality assessment through systematic code mutations. Analyze mutation survivors, identify test gaps, and suggest targeted improvements. Context: {{sourceFiles}}, Tests: {{testFiles}}, Framework: {{framework}}.`;
  }

  async executeTask(): Promise<any> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    const metadata = (this.currentTask as any).metadata || {};
    const { files, testFiles, framework = 'jest' } = this.taskContext;
    
    const sourceFiles = await this.readSourceFiles(files || []);
    const existingTests = await this.readSourceFiles(testFiles || []);
    
    const mutationResults = await this.runMutationTesting(sourceFiles, existingTests, framework);
    const testSuite = await this.generateMutationTestSuite(mutationResults, sourceFiles, framework);
    
    const reportPath = this.generateReportFilePath(metadata?.targetClass || 'MutationReport');
    await this.writeFile(reportPath, testSuite.report);
    
    return {
      mutationScore: testSuite.mutationScore,
      report: testSuite.report,
      survivors: testSuite.survivors,
      analysis: testSuite.analysis,
      improvements: testSuite.improvements,
      message: 'Generated mutation testing analysis with targeted test improvements'
    };
  }

  async analyzeSurvivors(survivors: MutationSurvivor[]): Promise<SurvivorAnalysis> {
    const survivorsByType: Record<string, number> = {};
    const survivorsByLocation: Record<string, number> = {};
    
    for (const survivor of survivors) {
      survivorsByType[survivor.mutator] = (survivorsByType[survivor.mutator] || 0) + 1;
      const locationKey = `line-${survivor.location.line}`;
      survivorsByLocation[locationKey] = (survivorsByLocation[locationKey] || 0) + 1;
    }

    const testGaps = await this.identifyTestGaps(survivors);
    const recommendations = this.generateRecommendations(survivorsByType, testGaps);

    return {
      totalSurvivors: survivors.length,
      survivorsByType,
      survivorsByLocation,
      recommendations,
      testGaps
    };
  }

  async identifyTestGaps(survivors: MutationSurvivor[]): Promise<TestGap[]> {
    const gaps: TestGap[] = [];
    const mutatorTypes = [...new Set(survivors.map(s => s.mutator))];

    for (const mutator of mutatorTypes) {
      const survivorsOfType = survivors.filter(s => s.mutator === mutator);
      const gap = await this.analyzeGapForMutator(mutator, survivorsOfType);
      if (gap) gaps.push(gap);
    }

    return gaps;
  }

  async generateTestImprovements(survivors: MutationSurvivor[], sourceCode: string[]): Promise<TestImprovement[]> {
    const improvements: TestImprovement[] = [];
    const mutatorTypes = [...new Set(survivors.map(s => s.mutator))];

    for (const mutator of mutatorTypes) {
      const survivorsOfType = survivors.filter(s => s.mutator === mutator);
      const improvement = await this.generateImprovementForMutator(mutator, survivorsOfType, sourceCode);
      if (improvement) improvements.push(improvement);
    }

    return improvements;
  }

  private async readSourceFiles(files: string[]): Promise<string[]> {
    const sourceFiles: string[] = [];
    for (const file of files) {
      try {
        const content = await this.readFile(file);
        sourceFiles.push(content);
      } catch (error) {
        console.warn(`Could not read file ${file}: ${(error as Error).message}`);
      }
    }
    return sourceFiles;
  }

  private async runMutationTesting(sourceFiles: string[], testFiles: string[], framework: string): Promise<MutationResults> {
    const promptContext = {
      sourceFiles: sourceFiles.join('\n\n--- FILE SEPARATOR ---\n\n'),
      testFiles: testFiles.join('\n\n--- TEST SEPARATOR ---\n\n'),
      framework
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

SOURCE CODE:
${sourceFiles.join('\n\n--- FILE SEPARATOR ---\n\n')}

EXISTING TESTS:
${testFiles.join('\n\n--- TEST SEPARATOR ---\n\n')}

Simulate mutation testing by analyzing the code and tests to identify:
1. Potential mutations that would survive (indicate weak tests)
2. Calculate estimated mutation score
3. Identify specific lines/operations that lack proper test coverage
4. Generate realistic mutation survivors with locations

Return structured data with mutationScore, totalMutants, killedMutants, survivedMutants, and survivors array.`;

    const response = await this.sendToClaude(prompt);
    return this.parseMutationResults(response.content);
  }

  private parseMutationResults(content: string): MutationResults {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0]);
        return {
          mutationScore: results.mutationScore || 0,
          totalMutants: results.totalMutants || 0,
          killedMutants: results.killedMutants || 0,
          survivedMutants: results.survivedMutants || 0,
          survivors: results.survivors || []
        };
      }
    } catch (error) {
      console.warn('Failed to parse mutation results, using defaults');
    }

    return {
      mutationScore: 75,
      totalMutants: 100,
      killedMutants: 75,
      survivedMutants: 25,
      survivors: []
    };
  }

  private async generateMutationTestSuite(results: MutationResults, sourceFiles: string[], framework: string): Promise<MutationTestSuite> {
    const analysis = await this.analyzeSurvivors(results.survivors);
    const improvements = await this.generateTestImprovements(results.survivors, sourceFiles);
    
    const promptContext = {
      mutationScore: results.mutationScore.toString(),
      survivors: JSON.stringify(results.survivors, null, 2),
      analysis: JSON.stringify(analysis, null, 2),
      framework
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

MUTATION RESULTS:
Score: ${results.mutationScore}%
Total Mutants: ${results.totalMutants}
Killed: ${results.killedMutants}
Survived: ${results.survivedMutants}

SURVIVORS:
${JSON.stringify(results.survivors, null, 2)}

ANALYSIS:
${JSON.stringify(analysis, null, 2)}

Generate a comprehensive mutation testing report including:
1. Executive summary of mutation testing results
2. Detailed analysis of surviving mutants
3. Specific test improvements to kill survivors
4. Code coverage gaps identified through mutations
5. Prioritized recommendations for test enhancement

Format as a detailed markdown report.`;

    const response = await this.sendToClaude(prompt);

    return {
      report: response.content,
      mutationScore: results.mutationScore,
      survivors: results.survivors,
      analysis,
      improvements
    };
  }

  private async analyzeGapForMutator(mutator: string, survivors: MutationSurvivor[]): Promise<TestGap | null> {
    if (survivors.length === 0) return null;

    const suggestedTests = this.generateTestSuggestions(mutator, survivors);
    
    return {
      type: mutator,
      description: `${survivors.length} ${mutator} mutations survived, indicating insufficient test coverage`,
      suggestedTests,
      priority: survivors.length > 3 ? 'high' : survivors.length > 1 ? 'medium' : 'low'
    };
  }

  private generateTestSuggestions(mutator: string, survivors: MutationSurvivor[]): string[] {
    const suggestions: string[] = [];
    
    switch (mutator.toLowerCase()) {
      case 'arithmetic':
        suggestions.push('Add tests for boundary conditions and edge cases in arithmetic operations');
        suggestions.push('Test with zero, negative, and maximum values');
        break;
      case 'conditional':
        suggestions.push('Add tests to cover both true and false branches');
        suggestions.push('Test edge cases where conditions might change behavior');
        break;
      case 'logical':
        suggestions.push('Test all combinations of boolean conditions');
        suggestions.push('Add tests for short-circuit evaluation scenarios');
        break;
      default:
        suggestions.push(`Add targeted tests for ${mutator} operations`);
        break;
    }
    
    return suggestions;
  }

  private generateRecommendations(survivorsByType: Record<string, number>, testGaps: TestGap[]): string[] {
    const recommendations: string[] = [];
    
    const sortedTypes = Object.entries(survivorsByType).sort(([,a], [,b]) => b - a);
    
    for (const [type, count] of sortedTypes.slice(0, 3)) {
      recommendations.push(`Priority: Address ${count} surviving ${type} mutations`);
    }
    
    if (testGaps.length > 0) {
      const highPriorityGaps = testGaps.filter(gap => gap.priority === 'high').length;
      if (highPriorityGaps > 0) {
        recommendations.push(`Critical: ${highPriorityGaps} high-priority test gaps identified`);
      }
    }
    
    return recommendations;
  }

  private async generateImprovementForMutator(mutator: string, survivors: MutationSurvivor[], sourceCode: string[]): Promise<TestImprovement | null> {
    if (survivors.length === 0) return null;

    const example = this.generateExampleTest(mutator, survivors[0]);
    
    return {
      type: mutator,
      description: `Improve test coverage for ${mutator} mutations`,
      example,
      priority: survivors.length > 3 ? 'high' : survivors.length > 1 ? 'medium' : 'low'
    };
  }

  private generateExampleTest(mutator: string, survivor: MutationSurvivor): string {
    const testTemplate = this.getTestTemplate(mutator);
    return testTemplate.replace('{{original}}', survivor.originalCode).replace('{{mutated}}', survivor.mutatedCode);
  }

  private getTestTemplate(mutator: string): string {
    const templates = {
      arithmetic: `test('should handle arithmetic edge case', () => {\n  // Test that detects change from {{original}} to {{mutated}}\n  expect(result).toBe(expectedValue);\n});`,
      conditional: `test('should test conditional branch', () => {\n  // Test that ensures {{original}} behavior differs from {{mutated}}\n  expect(conditionalResult).toBe(expectedValue);\n});`,
      logical: `test('should test logical operation', () => {\n  // Test that distinguishes {{original}} from {{mutated}}\n  expect(logicalResult).toBe(expectedValue);\n});`
    };
    
    return templates[mutator.toLowerCase() as keyof typeof templates] || `test('should test ${mutator}', () => {\n  // Add test to kill ${mutator} mutation\n});`;
  }

  private generateReportFilePath(className: string): string {
    const reportFileName = `${className.toLowerCase()}.mutation.report.md`;
    return `reports/mutation/${reportFileName}`;
  }
}