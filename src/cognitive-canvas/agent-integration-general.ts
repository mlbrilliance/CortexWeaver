import { Driver, Session, ManagedTransaction } from 'neo4j-driver';
import { TransactionManager } from './transaction/transaction-manager.js';

/**
 * General Agent Integration Operations
 * Handles common operations shared across multiple agents
 */
export class GeneralAgentIntegration {
  private transactionManager: TransactionManager;
  
  constructor(private driver: Driver, sharedTransactionManager?: TransactionManager) {
    this.transactionManager = sharedTransactionManager || new TransactionManager(driver);
  }

  /**
   * Get project context (for various agents)
   */
  async getProjectContext(projectId: string): Promise<any> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(`
          MATCH (p:Project {id: $projectId})
          OPTIONAL MATCH (p)-[:CONTAINS]->(t:Task)
          OPTIONAL MATCH (p)-[:HAS_ARCHITECTURE]->(ad:ArchitecturalDecision)
          OPTIONAL MATCH (p)-[:HAS_CONTRACT]->(c:Contract)
          RETURN p,
                 collect(DISTINCT t) as tasks,
                 collect(DISTINCT ad) as architecturalDecisions,
                 collect(DISTINCT c) as contracts
        `, { projectId });
        
        if (queryResult.records.length === 0) {
          return null;
        }
        
        const record = queryResult.records[0];
        return {
          project: record.get('p').properties,
          tasks: record.get('tasks').map((t: any) => t.properties),
          architecturalDecisions: record.get('architecturalDecisions').map((ad: any) => ad.properties),
          contracts: record.get('contracts').map((c: any) => c.properties)
        };
      }
    );
    
    return result.data;
  }

  /**
   * Create knowledge entry (for general knowledge management)
   */
  async createKnowledgeEntry(projectId: string, entryData: {
    type: string;
    data?: any;
    timestamp: Date;
  }): Promise<void> {
    const id = `knowledge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await this.transactionManager.executeInWriteTransaction(
      async (tx: ManagedTransaction) => {
        await tx.run(
          'CREATE (k:KnowledgeEntry {id: $id, type: $type, data: $data, projectId: $projectId, createdAt: $createdAt})',
          {
            id,
            type: entryData.type,
            data: JSON.stringify(entryData.data || {}),
            projectId,
            createdAt: entryData.timestamp.toISOString()
          }
        );
        return true;
      }
    );
  }

  /**
   * Get knowledge entries by type
   */
  async getKnowledgeEntriesByType(projectId: string, type: string): Promise<any[]> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(
          'MATCH (k:KnowledgeEntry {projectId: $projectId, type: $type}) RETURN k ORDER BY k.createdAt',
          { projectId, type }
        );
        return queryResult.records.map((record: any) => {
          const props = record.get('k').properties;
          return {
            ...props,
            data: JSON.parse(props.data || '{}')
          };
        });
      }
    );
    
    return result.data;
  }

  /**
   * Get knowledge entries by query with filtering
   */
  async getKnowledgeEntriesByQuery(projectId: string, query: {
    type?: string;
    filter?: Record<string, any>;
  }): Promise<any[]> {
    let cypher = 'MATCH (k:KnowledgeEntry {projectId: $projectId';
    const params: any = { projectId };
    
    if (query.type) {
      cypher += ', type: $type';
      params.type = query.type;
    }
    
    cypher += '}) RETURN k ORDER BY k.createdAt';
    
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(cypher, params);
        let entries = queryResult.records.map((record: any) => {
          const props = record.get('k').properties;
          return {
            ...props,
            data: JSON.parse(props.data || '{}')
          };
        });

        // Apply additional filtering if provided
        if (query.filter) {
          entries = entries.filter((entry: any) => {
            return Object.entries(query.filter!).every(([key, value]) => {
              const keyPath = key.split('.');
              let current = entry;
              for (const segment of keyPath) {
                current = current[segment];
                if (current === undefined) return false;
              }
              return Array.isArray(current) ? current.includes(value) : current === value;
            });
          });
        }
        
        return entries;
      }
    );
    
    return result.data;
  }
}
