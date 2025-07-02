import { Driver, Session } from 'neo4j-driver';
import { DiagnosticData } from './types';

/**
 * Debugger Agent Integration Operations
 * Handles operations specific to the Debugger agent
 */
export class DebuggerAgentIntegration {
  constructor(private driver: Driver) {}

  /**
   * Get failure by ID (for Debugger agent)
   */
  async getFailureById(failureId: string): Promise<any> {
    const session: Session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (f:Failure {id: $failureId})
        RETURN f
      `, { failureId });

      if (result.records.length === 0) {
        return null;
      }

      return result.records[0].get('f').properties;
    } finally {
      await session.close();
    }
  }

  /**
   * Get related artifacts (for Debugger agent)
   */
  async getRelatedArtifacts(failureId: string): Promise<any[]> {
    const session: Session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (f:Failure {id: $failureId})-[:RELATED_TO]->(a)
        RETURN a
      `, { failureId });

      return result.records.map(record => record.get('a').properties);
    } finally {
      await session.close();
    }
  }

  /**
   * Create diagnostic node (for Debugger agent)
   */
  async createDiagnosticNode(diagnosticData: any): Promise<string> {
    const session: Session = this.driver.session();
    try {
      const result = await session.run(`
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

      return result.records[0].get('id');
    } finally {
      await session.close();
    }
  }

  /**
   * Link diagnostic to failure (for Debugger agent)
   */
  async linkDiagnosticToFailure(diagnosticId: string, failureId: string): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.run(`
        MATCH (d:Diagnostic {id: $diagnosticId}), (f:Failure {id: $failureId})
        CREATE (d)-[:DIAGNOSES]->(f)
      `, { diagnosticId, failureId });
    } finally {
      await session.close();
    }
  }

  /**
   * Get failure history (for Debugger agent)
   */
  async getFailureHistory(taskIdOrProjectId?: string, hoursBack?: number): Promise<any[]> {
    const session: Session = this.driver.session();
    try {
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

      const result = await session.run(query, params);
      return result.records.map(record => record.get('f').properties);
    } finally {
      await session.close();
    }
  }

  /**
   * Get agent interactions (for Debugger agent)
   */
  async getAgentInteractions(taskIdOrProjectId: string, hoursBack?: number): Promise<any[]> {
    const session: Session = this.driver.session();
    try {
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

      const result = await session.run(query, params);
      return result.records.map(record => ({
        agent: record.get('a').properties,
        interaction: record.get('r').properties,
        task: record.get('t').properties
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Store failure information for error tracking
   */
  async storeFailure(failureData: any): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.run(`
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
    } finally {
      await session.close();
    }
  }

  /**
   * Get task retry count for recovery strategies
   */
  async getTaskRetryCount(taskId: string): Promise<{ count: number }> {
    const session: Session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (t:Task {id: $taskId})
        RETURN coalesce(t.retryCount, 0) as count
      `, { taskId });

      if (result.records.length === 0) {
        return { count: 0 };
      }

      return { count: result.records[0].get('count').toNumber() };
    } finally {
      await session.close();
    }
  }

  /**
   * Store escalated error context for manual intervention
   */
  async storeEscalatedError(errorData: any): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.run(`
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
    } finally {
      await session.close();
    }
  }
}
