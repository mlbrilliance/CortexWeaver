import { Agent, TaskResult } from '../agent';

export interface CoderNotification {
  type: 'coder_completion';
  taskId: string;
  timestamp: string;
  metadata: {
    filesModified: string[];
    testsGenerated: string[];
  };
}

export interface LinterResult {
  success: boolean;
  lintingPassed: boolean;
  errors: string[];
  warnings: string[];
}

export interface TestResult {
  success: boolean;
  unitTestsPassed: boolean;
  integrationTestsPassed: boolean;
  errors: string[];
  testStats?: {
    total: number;
    passed: number;
    failed: number;
  };
}

export interface CoverageResult {
  success: boolean;
  coverageThresholdsMet: boolean;
  coverageData: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  errors: string[];
}

export interface QualityReport {
  overallStatus: 'PASS' | 'FAIL';
  summary: string;
  timestamp: string;
  linting: {
    status: 'PASS' | 'FAIL';
    errors: string[];
    warnings: string[];
  };
  testing: {
    status: 'PASS' | 'FAIL';
    errors: string[];
    unitTests: boolean;
    integrationTests: boolean;
  };
  coverage: {
    status: 'PASS' | 'FAIL';
    errors: string[];
    data: {
      statements: number;
      branches: number;
      functions: number;
      lines: number;
    };
  };
}

export interface QualityGatekeeperResult {
  notificationReceived: boolean;
  qualityChecksPassed: boolean;
  overallStatus: 'PASS' | 'FAIL';
  report: QualityReport;
  executionTime: number;
}

/**
 * QualityGatekeeperAgent validates code quality after Coder completion
 * Runs linting, testing, and coverage validation
 */
export class QualityGatekeeperAgent extends Agent {
  private notification: CoderNotification | null = null;
  private startTime: number = 0;

  /**
   * Get the prompt template for quality gatekeeper tasks
   */
  getPromptTemplate(): string {
    return `You are a Quality Gatekeeper responsible for validating code quality after development completion.

Task: {{taskDescription}}

Your responsibilities:
1. Validate code meets quality standards through linting
2. Ensure all tests pass (unit and integration)
3. Verify code coverage meets thresholds
4. Generate comprehensive quality reports

Quality Standards:
- ESLint must pass with no errors
- Prettier formatting must be consistent
- All unit tests must pass
- Integration tests must pass
- Code coverage must meet configured thresholds

Project Context:
- Language: {{language}}
- Framework: {{framework}}
- Test Framework: {{testFramework}}

Coverage Thresholds:
- Statements: {{statementsThreshold}}%
- Branches: {{branchesThreshold}}%
- Functions: {{functionsThreshold}}%
- Lines: {{linesThreshold}}%

Please provide detailed analysis and recommendations for any quality issues found.`;
  }

  /**
   * Execute quality gatekeeper task
   */
  async executeTask(): Promise<QualityGatekeeperResult> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    this.startTime = Date.now();
    await this.reportProgress('started', 'Beginning quality validation');

    try {
      // Wait for coder notification if not already received
      if (!this.notification) {
        await this.waitForCoderNotification();
      }

      // Run linting checks
      await this.reportProgress('in_progress', 'Running linting checks');
      const lintingResult = await this.runLinter();

      // Run test suites
      await this.reportProgress('in_progress', 'Running test suites');
      const testingResult = await this.runTests();

      // Validate coverage
      await this.reportProgress('in_progress', 'Validating code coverage');
      const coverageResult = await this.validateCoverage();

      // Generate comprehensive report
      const report = await this.generateReport({
        linting: lintingResult,
        testing: testingResult,
        coverage: coverageResult
      });

      const overallStatus = this.determineOverallStatus(lintingResult, testingResult, coverageResult);
      const executionTime = Date.now() - this.startTime;

      await this.reportProgress('completed', `Quality validation completed: ${overallStatus}`);

      return {
        notificationReceived: true,
        qualityChecksPassed: overallStatus === 'PASS',
        overallStatus,
        report,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - this.startTime;
      await this.reportProgress('error', `Quality validation failed: ${(error as Error).message}`);
      
      throw error;
    }
  }

  /**
   * Receive notification from Coder completion
   */
  async receiveNotification(notification: CoderNotification): Promise<{ success: boolean; notificationReceived: boolean }> {
    if (!notification.type || notification.type !== 'coder_completion') {
      throw new Error('Invalid notification format');
    }

    if (!notification.taskId || !notification.timestamp) {
      throw new Error('Invalid notification format');
    }

    this.notification = notification;
    await this.reportProgress('notification_received', `Received coder completion for task ${notification.taskId}`);

    return {
      success: true,
      notificationReceived: true
    };
  }

  /**
   * Run project linters (ESLint, Prettier)
   */
  async runLinter(): Promise<LinterResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Run ESLint
      const eslintResult = await this.executeCommand('npx eslint src tests --ext .ts,.js --format json');
      
      if (eslintResult.exitCode !== 0) {
        try {
          const eslintData = JSON.parse(eslintResult.stdout);
          for (const file of eslintData) {
            for (const message of file.messages) {
              const errorMsg = `${file.filePath}: ${message.ruleId} - ${message.message} (line ${message.line})`;
              if (message.severity === 2) {
                errors.push(errorMsg);
              } else {
                warnings.push(errorMsg);
              }
            }
          }
        } catch (parseError) {
          errors.push(`ESLint parsing error: ${eslintResult.stderr || eslintResult.stdout}`);
        }
      }

      // Run Prettier check
      const prettierResult = await this.executeCommand('npx prettier --check src tests --parser typescript');
      
      if (prettierResult.exitCode !== 0) {
        errors.push(`Prettier formatting issues: ${prettierResult.stdout}`);
      }

      const success = errors.length === 0;
      return {
        success,
        lintingPassed: success,
        errors,
        warnings
      };

    } catch (error) {
      return {
        success: false,
        lintingPassed: false,
        errors: [`Linting execution failed: ${(error as Error).message}`],
        warnings: []
      };
    }
  }

  /**
   * Run unit and integration tests
   */
  async runTests(): Promise<TestResult> {
    const errors: string[] = [];
    let unitTestsPassed = false;
    let integrationTestsPassed = false;
    let testStats = { total: 0, passed: 0, failed: 0 };

    try {
      // Run unit tests
      const unitTestResult = await this.executeCommand('npm test');
      
      if (unitTestResult.exitCode === 0) {
        unitTestsPassed = true;
        // Parse test statistics if available
        const testOutput = unitTestResult.stdout;
        const testMatch = testOutput.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
        if (testMatch) {
          testStats.passed = parseInt(testMatch[1]);
          testStats.total = parseInt(testMatch[2]);
          testStats.failed = testStats.total - testStats.passed;
        }
      } else {
        errors.push(`Unit tests failed: ${unitTestResult.stderr || unitTestResult.stdout}`);
      }

      // Run integration tests if they exist
      const integrationTestResult = await this.executeCommand('npm test -- --testPathPattern=integration');
      
      if (integrationTestResult.exitCode === 0) {
        integrationTestsPassed = true;
      } else {
        // Integration tests might not exist, check if that's the case
        if (!integrationTestResult.stderr?.includes('No tests found')) {
          errors.push(`Integration tests failed: ${integrationTestResult.stderr || integrationTestResult.stdout}`);
        } else {
          integrationTestsPassed = true; // No integration tests is OK
        }
      }

      const success = unitTestsPassed && integrationTestsPassed;
      return {
        success,
        unitTestsPassed,
        integrationTestsPassed,
        errors,
        testStats
      };

    } catch (error) {
      return {
        success: false,
        unitTestsPassed: false,
        integrationTestsPassed: false,
        errors: [`Test execution failed: ${(error as Error).message}`],
        testStats
      };
    }
  }

  /**
   * Validate code coverage thresholds
   */
  async validateCoverage(): Promise<CoverageResult> {
    const errors: string[] = [];
    let coverageData = { statements: 0, branches: 0, functions: 0, lines: 0 };

    try {
      // Run coverage report
      const coverageResult = await this.executeCommand('npm run test:coverage -- --coverageReporters=json');
      
      if (coverageResult.exitCode === 0) {
        try {
          const coverageJson = JSON.parse(coverageResult.stdout);
          const total = coverageJson.total;
          
          coverageData = {
            statements: total.statements.pct,
            branches: total.branches.pct,
            functions: total.functions.pct,
            lines: total.lines.pct
          };

          // Check thresholds
          const thresholds = this.getCoverageThresholds();
          
          if (coverageData.statements < thresholds.statements) {
            errors.push(`Statements coverage ${coverageData.statements}% below threshold ${thresholds.statements}%`);
          }
          if (coverageData.branches < thresholds.branches) {
            errors.push(`Branches coverage ${coverageData.branches}% below threshold ${thresholds.branches}%`);
          }
          if (coverageData.functions < thresholds.functions) {
            errors.push(`Functions coverage ${coverageData.functions}% below threshold ${thresholds.functions}%`);
          }
          if (coverageData.lines < thresholds.lines) {
            errors.push(`Lines coverage ${coverageData.lines}% below threshold ${thresholds.lines}%`);
          }

        } catch (parseError) {
          errors.push(`Coverage parsing error: ${parseError}`);
        }
      } else {
        errors.push(`Coverage execution failed: ${coverageResult.stderr || coverageResult.stdout}`);
      }

      const success = errors.length === 0;
      return {
        success,
        coverageThresholdsMet: success,
        coverageData,
        errors
      };

    } catch (error) {
      return {
        success: false,
        coverageThresholdsMet: false,
        coverageData,
        errors: [`Coverage validation failed: ${(error as Error).message}`]
      };
    }
  }

  /**
   * Generate detailed quality report
   */
  async generateReport(results: {
    linting: LinterResult;
    testing: TestResult;
    coverage: CoverageResult;
  }): Promise<QualityReport> {
    const { linting, testing, coverage } = results;
    
    const overallStatus = this.determineOverallStatus(linting, testing, coverage);
    const timestamp = new Date().toISOString();
    
    let summary = '';
    if (overallStatus === 'PASS') {
      summary = 'All quality checks passed successfully. Code is ready for deployment.';
    } else {
      const failedChecks = [];
      if (!linting.success) failedChecks.push('linting');
      if (!testing.success) failedChecks.push('testing');
      if (!coverage.success) failedChecks.push('coverage');
      summary = `Quality checks failed: ${failedChecks.join(', ')}. Review errors and fix issues.`;
    }

    return {
      overallStatus,
      summary,
      timestamp,
      linting: {
        status: linting.success ? 'PASS' : 'FAIL',
        errors: linting.errors,
        warnings: linting.warnings
      },
      testing: {
        status: testing.success ? 'PASS' : 'FAIL',
        errors: testing.errors,
        unitTests: testing.unitTestsPassed,
        integrationTests: testing.integrationTestsPassed
      },
      coverage: {
        status: coverage.success ? 'PASS' : 'FAIL',
        errors: coverage.errors,
        data: coverage.coverageData
      }
    };
  }

  /**
   * Wait for coder notification (with timeout)
   */
  private async waitForCoderNotification(timeoutMs: number = 60000): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (this.notification) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve();
        }
      }, 1000);

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for coder notification'));
      }, timeoutMs);
    });
  }

  /**
   * Get coverage thresholds from context or defaults
   */
  private getCoverageThresholds(): { statements: number; branches: number; functions: number; lines: number } {
    const contextThresholds = this.taskContext?.coverageThresholds;
    
    return {
      statements: contextThresholds?.statements || 80,
      branches: contextThresholds?.branches || 75,
      functions: contextThresholds?.functions || 85,
      lines: contextThresholds?.lines || 80
    };
  }

  /**
   * Determine overall status from individual check results
   */
  private determineOverallStatus(linting: LinterResult, testing: TestResult, coverage: CoverageResult): 'PASS' | 'FAIL' {
    return linting.success && testing.success && coverage.success ? 'PASS' : 'FAIL';
  }
}