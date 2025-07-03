import { Driver, ManagedTransaction, Session } from 'neo4j-driver';
import { TransactionManager } from './transaction/transaction-manager.js';
import { DiagnosticData } from './types';

/**
 * Debugger Agent Integration Operations
 * Handles operations specific to the Debugger agent
 */
export class DebuggerAgentIntegration {
  private transactionManager: TransactionManager;
  
  constructor(private driver: Driver, sharedTransactionManager?: TransactionManager) {
    this.transactionManager = sharedTransactionManager || new TransactionManager(driver);
  }

  /**
   * Get failure by ID (for Debugger agent)
   */
  async getFailureById(failureId: string): Promise<any> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(`
          MATCH (f:Failure {id: $failureId})
          RETURN f
        `, { failureId });

        if (queryResult.records.length === 0) {
          return null;
        }

        return queryResult.records[0].get('f').properties;
      }
    );
    return result.data;
  }

  /**
   * Get related artifacts (for Debugger agent)
   */
  async getRelatedArtifacts(failureId: string): Promise<any[]> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(`
          MATCH (f:Failure {id: $failureId})-[:RELATED_TO]->(a)
          RETURN a
        `, { failureId });

        return queryResult.records.map(record => record.get('a').properties);
      }
    );
    return result.data;
  }

  /**
   * Create diagnostic node (for Debugger agent)
   */
  async createDiagnosticNode(diagnosticData: any): Promise<string> {
    const result = await this.transactionManager.executeInWriteTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(`
          CREATE (d:Diagnostic {
            id: $id,
            rootCause: $rootCause,
            solution: $solution,
            confidence: $confidence,
            considerations: $considerations,
            createdAt: $createdAt
          })
          RETURN d.id as id
        `, {
          id: diagnosticData.id || `diagnostic-${Date.now()}`,
          rootCause: diagnosticData.rootCause || '',
          solution: diagnosticData.solution || '',
          confidence: diagnosticData.confidence || 0.5,
          considerations: diagnosticData.considerations || [],
          createdAt: new Date().toISOString()
        });

        return queryResult.records[0].get('id');
      }
    );
    return result.data;
  }

  /**
   * Link diagnostic to failure (for Debugger agent)
   */
  async linkDiagnosticToFailure(diagnosticId: string, failureId: string): Promise<void> {
    await this.transactionManager.executeInWriteTransaction(
      async (tx: ManagedTransaction) => {
        await tx.run(`
          MATCH (d:Diagnostic {id: $diagnosticId}), (f:Failure {id: $failureId})
          CREATE (d)-[:DIAGNOSES]->(f)
        `, { diagnosticId, failureId });
      }
    );
  }

  /**
   * Get failure history (for Debugger agent)
   */
  async getFailureHistory(taskIdOrProjectId?: string, hoursBack?: number): Promise<any[]> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        let query: string;
        let params: any = {};

        if (taskIdOrProjectId && hoursBack) {
          // Project ID with time filter
          query = `
            MATCH (f:Failure)
            WHERE f.projectId = $projectId
            AND datetime(f.createdAt) > datetime() - duration({hours: $hoursBack})
            RETURN f
            ORDER BY f.createdAt DESC
          `;
          params = { projectId: taskIdOrProjectId, hoursBack };
        } else if (taskIdOrProjectId) {
          // Task ID filter
          query = `
            MATCH (f:Failure)-[:OCCURRED_IN]->(t:Task {id: $taskId})
            RETURN f
            ORDER BY f.createdAt DESC
          `;
          params = { taskId: taskIdOrProjectId };
        } else {
          // Default: recent failures
          query = `
            MATCH (f:Failure)
            RETURN f
            ORDER BY f.createdAt DESC
            LIMIT 50
          `;
        }

        const queryResult = await tx.run(query, params);
        return queryResult.records.map(record => record.get('f').properties);
      }
    );
    return result.data;
  }

  /**
   * Get agent interactions (for Debugger agent)
   */
  async getAgentInteractions(taskIdOrProjectId: string, hoursBack?: number): Promise<any[]> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        let query: string;
        let params: any = {};

        if (hoursBack) {
          // Project ID with time filter
          query = `
            MATCH (a:Agent)-[r:WORKED_ON]->(t:Task)
            WHERE t.projectId = $projectId
            AND datetime(r.createdAt) > datetime() - duration({hours: $hoursBack})
            RETURN a, r, t
            ORDER BY r.createdAt ASC
          `;
          params = { projectId: taskIdOrProjectId, hoursBack };
        } else {
          // Task ID filter
          query = `
            MATCH (a:Agent)-[r:WORKED_ON]->(t:Task {id: $taskId})
            RETURN a, r, t
            ORDER BY r.createdAt ASC
          `;
          params = { taskId: taskIdOrProjectId };
        }

        const queryResult = await tx.run(query, params);
        return queryResult.records.map(record => ({
          agent: record.get('a').properties,
          interaction: record.get('r').properties,
          task: record.get('t').properties
        }));
      }
    );
    return result.data;
  }

  /**
   * Store failure information for error tracking
   */
  async storeFailure(failureData: any): Promise<void> {
    await this.transactionManager.executeInWriteTransaction(
      async (tx: ManagedTransaction) => {
        await tx.run(`
          CREATE (f:Failure {
            id: $id,
            type: $type,
            severity: $severity,
            message: $message,
            taskId: $taskId,
            step: $step,
            timestamp: $timestamp,
            metadata: $metadata
          })
        `, {
          id: failureData.id || `failure-${Date.now()}`,
          type: failureData.type || 'unknown',
          severity: failureData.severity || 'medium',
          message: failureData.message || '',
          taskId: failureData.taskId || '',
          step: failureData.step || '',
          timestamp: failureData.timestamp || new Date().toISOString(),
          metadata: JSON.stringify(failureData.metadata || {})
        });
      }
    );
  }

  /**
   * Get task retry count for recovery strategies
   */
  async getTaskRetryCount(taskId: string): Promise<{ count: number }> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(`
          MATCH (t:Task {id: $taskId})
          RETURN coalesce(t.retryCount, 0) as count
        `, { taskId });

        if (queryResult.records.length === 0) {
          return { count: 0 };
        }

        return { count: queryResult.records[0].get('count').toNumber() };
      }
    );
    return result.data;
  }

  /**
   * Store escalated error context for manual intervention
   */
  async storeEscalatedError(errorData: any): Promise<void> {
    await this.transactionManager.executeInWriteTransaction(
      async (tx: ManagedTransaction) => {
        await tx.run(`
          CREATE (e:EscalatedError {
            id: $id,
            taskId: $taskId,
            errorContext: $errorContext,
            escalatedAt: $escalatedAt,
            requiresManualIntervention: $requiresManualIntervention
          })
        `, {
          id: `escalated-${Date.now()}`,
          taskId: errorData.taskId || '',
          errorContext: JSON.stringify(errorData.errorContext || {}),
          escalatedAt: errorData.escalatedAt || new Date().toISOString(),
          requiresManualIntervention: errorData.requiresManualIntervention || true
        });
      }
    );
  }
}
