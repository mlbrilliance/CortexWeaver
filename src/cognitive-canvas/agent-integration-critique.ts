import { Driver, ManagedTransaction, Session } from 'neo4j-driver';
import { TransactionManager } from './transaction/transaction-manager.js';
import { DiagnosticData } from './types';

/**
 * Critique Agent Integration Operations
 * Handles operations specific to the Critique agent
 */
export class CritiqueAgentIntegration {
  private transactionManager: TransactionManager;
  
  constructor(private driver: Driver, sharedTransactionManager?: TransactionManager) {
    this.transactionManager = sharedTransactionManager || new TransactionManager(driver);
  }

  /**
   * Get artifact details by ID (for Critique agent)
   */
  async getArtifactDetails(artifactId: string): Promise<any> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(`
          MATCH (a)
          WHERE a.id = $artifactId
          RETURN a
        `, { artifactId });

        if (queryResult.records.length === 0) {
          return null;
        }

        return queryResult.records[0].get('a').properties;
      }
    );
    return result.data;
  }

  /**
   * Create critique node (for Critique agent)
   */
  async createCritiqueNode(critiqueData: any): Promise<string> {
    const result = await this.transactionManager.executeInWriteTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(`
          CREATE (c:Critique {
            id: $id,
            issues: $issues,
            suggestions: $suggestions,
            severity: $severity,
            createdAt: $createdAt
          })
          RETURN c.id as id
        `, {
          id: critiqueData.id || `critique-${Date.now()}`,
          issues: critiqueData.issues || [],
          suggestions: critiqueData.suggestions || [],
          severity: critiqueData.severity || 'medium',
          createdAt: new Date().toISOString()
        });

        return queryResult.records[0].get('id');
      }
    );
    return result.data;
  }

  /**
   * Link critique to artifact (for Critique agent)
   */
  async linkCritiqueToArtifact(critiqueId: string, artifactId: string): Promise<void> {
    await this.transactionManager.executeInWriteTransaction(
      async (tx: ManagedTransaction) => {
        await tx.run(`
          MATCH (c:Critique {id: $critiqueId}), (a {id: $artifactId})
          CREATE (c)-[:CRITIQUES]->(a)
        `, { critiqueId, artifactId });
      }
    );
  }
}
