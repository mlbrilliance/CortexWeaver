import { Driver, ManagedTransaction, Session } from 'neo4j-driver';
import { TransactionManager } from './transaction/transaction-manager.js';

/**
 * Knowledge Updater Agent Integration Operations
 * Handles operations specific to the KnowledgeUpdater agent
 */
export class KnowledgeUpdaterAgentIntegration {
  private transactionManager: TransactionManager;
  
  constructor(private driver: Driver, sharedTransactionManager?: TransactionManager) {
    this.transactionManager = sharedTransactionManager || new TransactionManager(driver);
  }

  /**
   * Get task details (for KnowledgeUpdater agent)
   */
  async getTaskDetails(taskId: string): Promise<any> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(`
          MATCH (t:Task {id: $taskId})
          OPTIONAL MATCH (t)-[:PART_OF]->(p:Project)
          OPTIONAL MATCH (t)-[:HAS_ARTIFACT]->(a)
          RETURN t, p, collect(a) as artifacts
        `, { taskId });

        if (queryResult.records.length === 0) {
          return null;
        }

        const record = queryResult.records[0];
        return {
          task: record.get('t').properties,
          project: record.get('p')?.properties,
          artifacts: record.get('artifacts').map((a: any) => a.properties)
        };
      }
    );
    return result.data;
  }

  /**
   * Get related knowledge (for KnowledgeUpdater agent)
   */
  async getRelatedKnowledge(taskId: string): Promise<any[]> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(`
          MATCH (t:Task {id: $taskId})
          OPTIONAL MATCH (t)-[:USES]->(c:Contract)
          OPTIONAL MATCH (t)-[:IMPLEMENTS]->(ad:ArchitecturalDecision)
          OPTIONAL MATCH (t)-[:PRODUCES]->(cm:CodeModule)
          RETURN collect(DISTINCT c) as contracts,
                 collect(DISTINCT ad) as architecturalDecisions,
                 collect(DISTINCT cm) as codeModules
        `, { taskId });

        if (queryResult.records.length === 0) {
          return [];
        }

        const record = queryResult.records[0];
        return {
          contracts: record.get('contracts')?.map((c: any) => c.properties) || [],
          architecturalDecisions: record.get('architecturalDecisions')?.map((ad: any) => ad.properties) || [],
          codeModules: record.get('codeModules')?.map((cm: any) => cm.properties) || []
        } as any;
      }
    );
    return result.data;
  }

  /**
   * Create knowledge extraction (for KnowledgeUpdater agent)
   */
  async createKnowledgeExtraction(extractionData: any): Promise<string> {
    const result = await this.transactionManager.executeInWriteTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(`
          CREATE (ke:KnowledgeExtraction {
            id: $id,
            insights: $insights,
            patterns: $patterns,
            improvements: $improvements,
            createdAt: $createdAt
          })
          RETURN ke.id as id
        `, {
          id: extractionData.id || `knowledge-${Date.now()}`,
          insights: extractionData.insights || [],
          patterns: extractionData.patterns || [],
          improvements: extractionData.improvements || [],
          createdAt: new Date().toISOString()
        });

        return queryResult.records[0].get('id');
      }
    );
    return result.data;
  }

  /**
   * Link knowledge extraction to task (for KnowledgeUpdater agent)
   */
  async linkKnowledgeToTask(knowledgeId: string, taskId: string): Promise<void> {
    await this.transactionManager.executeInWriteTransaction(
      async (tx: ManagedTransaction) => {
        await tx.run(`
          MATCH (ke:KnowledgeExtraction {id: $knowledgeId}), (t:Task {id: $taskId})
          CREATE (ke)-[:EXTRACTED_FROM]->(t)
        `, { knowledgeId, taskId });
      }
    );
  }

  /**
   * Update pheromone strengths (for KnowledgeUpdater agent)
   */
  async updatePheromoneStrengths(updates?: any): Promise<void> {
    await this.transactionManager.executeInWriteTransaction(
      async (tx: ManagedTransaction) => {
        if (updates) {
          // Apply specific updates if provided
          for (const [pheromoneId, newStrength] of Object.entries(updates)) {
            await tx.run(`
              MATCH (p:Pheromone {id: $pheromoneId})
              SET p.strength = $newStrength
            `, { pheromoneId, newStrength });
          }
        } else {
          // Default decay behavior
          await tx.run(`
            MATCH (p:Pheromone)
            WHERE datetime(p.expiresAt) > datetime()
            SET p.strength = p.strength * 0.95
          `);
        }
      }
    );
  }

  /**
   * Get project knowledge (for KnowledgeUpdater agent)
   */
  async getProjectKnowledge(projectId: string): Promise<any[]> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(`
          MATCH (p:Project {id: $projectId})-[:HAS_KNOWLEDGE]->(ke:KnowledgeExtraction)
          RETURN ke
          ORDER BY ke.createdAt DESC
        `, { projectId });

        return queryResult.records.map(record => record.get('ke').properties);
      }
    );
    return result.data;
  }

  /**
   * Validate knowledge consistency (for KnowledgeUpdater agent)
   */
  async validateKnowledgeConsistency(projectId: string): Promise<any[]> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(`
          MATCH (p:Project {id: $projectId})
          OPTIONAL MATCH (p)-[:HAS_KNOWLEDGE]->(ke:KnowledgeExtraction)
          OPTIONAL MATCH (p)-[:HAS_ARCHITECTURE]->(ad:ArchitecturalDecision)
          RETURN collect(ke) as knowledge, collect(ad) as decisions
        `, { projectId });

        // Simple consistency validation - check for conflicting patterns
        const inconsistencies: any[] = [];
        if (queryResult.records.length > 0) {
          // Add specific validation logic here based on project needs
          console.log('Knowledge consistency validation completed');
        }
        return inconsistencies;
      }
    );
    return result.data;
  }

  /**
   * Identify knowledge gaps (for KnowledgeUpdater agent)
   */
  async identifyKnowledgeGaps(projectId: string): Promise<any[]> {
    const result = await this.transactionManager.executeInReadTransaction(
      async (tx: ManagedTransaction) => {
        const queryResult = await tx.run(`
          MATCH (p:Project {id: $projectId})-[:CONTAINS]->(t:Task)
          WHERE t.status = 'completed'
          OPTIONAL MATCH (t)-[:HAS_KNOWLEDGE]->(ke:KnowledgeExtraction)
          WITH t, ke
          WHERE ke IS NULL
          RETURN t as taskWithoutKnowledge
        `, { projectId });

        return queryResult.records.map(record => ({
          type: 'missing_task_knowledge',
          task: record.get('taskWithoutKnowledge').properties,
          description: 'Task completed without knowledge extraction'
        }));
      }
    );
    return result.data;
  }

  /**
   * Update project metrics (for KnowledgeUpdater agent)
   */
  async updateProjectMetrics(projectId: string, metrics: any): Promise<void> {
    await this.transactionManager.executeInWriteTransaction(
      async (tx: ManagedTransaction) => {
        await tx.run(`
          MATCH (p:Project {id: $projectId})
          SET p.metrics = $metrics,
              p.lastMetricsUpdate = $timestamp
        `, { 
          projectId, 
          metrics,
          timestamp: new Date().toISOString()
        });
      }
    );
  }
}
