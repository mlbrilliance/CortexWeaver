import { Agent, AgentConfig, TaskResult } from '../agent';

export interface TestFailure {
  testName: string;
  reason: string;
  stackTrace?: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CoverageData {
  overall: number;
  details: Array<{
    type: string;
    percentage: number;
    covered: number;
    total: number;
  }>;
}

export interface ChartData {
  type: 'pie' | 'bar' | 'line';
  title: string;
  data: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
}

export interface TestDocumentationResult {
  testSummary: string;
  coverageReport: string;
  failureAnalysis: TestFailure[];
  trendAnalysis: string;
  recommendations: string[];
  charts: ChartData[];
  metadata: {
    totalTests: number;
    passRate: number;
    coveragePercentage: number;
    generatedAt: string;
  };
}

export class TestResultDocumenterAgent extends Agent {
  async initialize(config: AgentConfig): Promise<void> {
    await super.initialize(config);
    if (!config.capabilities.includes('test-analysis')) {
      throw new Error('Test Result Documenter agent requires test-analysis capability');
    }
  }

  async executeTask(): Promise<TestDocumentationResult> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    this.validateTaskSpecification();
    this.validateTestResultsAvailable();
    await this.reportProgress('started', 'Beginning test result documentation');

    try {
      const testResults = this.taskContext.testResults;
      const coverageData = testResults.coverage;
      const historicalData = await this.queryHistoricalTestData();
      const documentationContent = await this.generateTestDocumentation(testResults, historicalData);
      
      const results = {
        testSummary: documentationContent.summary,
        coverageReport: documentationContent.coverage,
        failureAnalysis: this.analyzeFailures(testResults.failures || []),
        trendAnalysis: documentationContent.trends,
        recommendations: documentationContent.recommendations,
        charts: this.generateCharts(testResults, coverageData),
        metadata: {
          totalTests: testResults.totalTests || 0,
          passRate: testResults.passRate || 0,
          coveragePercentage: coverageData?.overall || 0,
          generatedAt: new Date().toISOString()
        }
      };

      await this.storeTestReport(results);
      await this.reportProgress('completed', 'Test documentation generated successfully');
      return results;
    } catch (error) {
      await this.reportProgress('failed', `Documentation generation failed: ${(error as Error).message}`);
      throw error;
    }
  }

  getPromptTemplate(): string {
    return `Test Documentation Agent: Generate comprehensive test reports with coverage analysis, failure categorization, trend analysis, and actionable recommendations. Context: {{testResults}}, Historical: {{historicalData}}.`;
  }

  private validateTaskSpecification(): void {
    const requiredFields = ['testResults'];
    for (const field of requiredFields) {
      if (!this.taskContext?.[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  private validateTestResultsAvailable(): void {
    if (!this.taskContext?.testResults) {
      throw new Error('No test results available for documentation');
    }
  }

  private async queryHistoricalTestData(): Promise<any> {
    try {
      const projectId = this.taskContext?.projectId || 'unknown';
      const reports: any[] = [];
      return this.processHistoricalData(reports);
    } catch (error) {
      console.warn('Failed to query historical test data:', (error as Error).message);
      return { trends: [], averages: {} };
    }
  }

  private processHistoricalData(reports: any[]): any {
    if (!reports.length) return { trends: [], averages: {} };

    const trends = reports.slice(-10).map(report => ({
      date: report.generatedAt,
      passRate: report.metadata?.passRate || 0,
      coverage: report.metadata?.coveragePercentage || 0,
      totalTests: report.metadata?.totalTests || 0
    }));

    const averages = {
      passRate: trends.reduce((sum, t) => sum + t.passRate, 0) / trends.length,
      coverage: trends.reduce((sum, t) => sum + t.coverage, 0) / trends.length
    };

    return { trends, averages };
  }

  private async generateTestDocumentation(testResults: any, historicalData: any): Promise<any> {
    const promptContext = {
      testResults: JSON.stringify(testResults, null, 2),
      historicalData: JSON.stringify(historicalData, null, 2),
      projectName: this.taskContext?.projectName || 'Unknown Project'
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

TEST RESULTS:
${JSON.stringify(testResults, null, 2)}

HISTORICAL DATA:
${JSON.stringify(historicalData, null, 2)}

Generate comprehensive test documentation including:
1. Executive summary of test results
2. Detailed coverage analysis with insights
3. Trend analysis comparing to historical data
4. Specific recommendations for improvement
5. Risk assessment and priority actions

Format as structured JSON with summary, coverage, trends, and recommendations fields.`;

    const response = await this.sendToClaude(prompt);
    return this.parseDocumentationResponse(response.content);
  }

  private parseDocumentationResponse(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.warn('Failed to parse structured response, using fallback');
    }

    return {
      summary: this.extractSection(content, 'summary') || 'Test results documented',
      coverage: this.extractSection(content, 'coverage') || 'Coverage analysis completed',
      trends: this.extractSection(content, 'trends') || 'Trend analysis performed',
      recommendations: this.extractRecommendations(content)
    };
  }

  private extractSection(content: string, section: string): string {
    const regex = new RegExp(`${section}:?\\s*([^\\n]*(?:\\n(?!\\w+:)[^\\n]*)*)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  private extractRecommendations(content: string): string[] {
    const lines = content.split('\n');
    const recommendations: string[] = [];
    let inRecommendations = false;

    for (const line of lines) {
      if (line.toLowerCase().includes('recommendation')) {
        inRecommendations = true;
        continue;
      }
      if (inRecommendations && line.trim()) {
        if (line.match(/^\d+\.|\-|\*/)) {
          recommendations.push(line.trim());
        } else if (!line.includes(':')) {
          recommendations.push(line.trim());
        }
      }
    }

    return recommendations.length > 0 ? recommendations : ['Continue monitoring test health'];
  }

  private analyzeFailures(failures: any[]): TestFailure[] {
    return failures.map(failure => ({
      testName: failure.name || 'Unknown test',
      reason: failure.message || 'Test failed',
      stackTrace: failure.stack,
      category: this.categorizeFailure(failure),
      priority: this.prioritizeFailure(failure)
    }));
  }

  private categorizeFailure(failure: any): string {
    const message = (failure.message || '').toLowerCase();
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('assertion') || message.includes('expect')) return 'assertion';
    if (message.includes('network') || message.includes('connection')) return 'network';
    if (message.includes('permission') || message.includes('auth')) return 'permission';
    return 'unknown';
  }

  private prioritizeFailure(failure: any): 'high' | 'medium' | 'low' {
    const message = (failure.message || '').toLowerCase();
    if (message.includes('critical') || message.includes('security')) return 'high';
    if (message.includes('performance') || message.includes('timeout')) return 'medium';
    return 'low';
  }

  private generateCharts(testResults: any, coverageData: CoverageData): ChartData[] {
    const charts: ChartData[] = [];

    if (testResults.passed && testResults.failed) {
      charts.push({
        type: 'pie',
        title: 'Test Results Distribution',
        data: [
          { label: 'Passed', value: testResults.passed, color: '#28a745' },
          { label: 'Failed', value: testResults.failed, color: '#dc3545' }
        ]
      });
    }

    if (coverageData?.details) {
      charts.push({
        type: 'bar',
        title: 'Coverage by Type',
        data: coverageData.details.map(detail => ({
          label: detail.type,
          value: detail.percentage,
          color: detail.percentage > 80 ? '#28a745' : detail.percentage > 60 ? '#ffc107' : '#dc3545'
        }))
      });
    }

    return charts;
  }

  private async storeTestReport(results: TestDocumentationResult): Promise<void> {
    try {
      const projectId = this.taskContext?.projectId || 'unknown';
      // Storage would be implemented here
    } catch (error) {
      console.warn('Failed to store test report:', (error as Error).message);
    }
  }
}