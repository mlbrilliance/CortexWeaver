import { Driver, Session } from 'neo4j-driver';
import { DiagnosticData } from './types';

/**
 * Critique Agent Integration Operations
 * Handles operations specific to the Critique agent
 */
export class CritiqueAgentIntegration {
  constructor(private driver: Driver) {}

  /**
   * Get artifact details by ID (for Critique agent)
   */
  async getArtifactDetails(artifactId: string): Promise<any> {
    const session: Session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (a)
        WHERE a.id = $artifactId
        RETURN a
      `, { artifactId });

      if (result.records.length === 0) {
        return null;
      }

      return result.records[0].get('a').properties;
    } finally {
      await session.close();
    }
  }

  /**
   * Create critique node (for Critique agent)
   */
  async createCritiqueNode(critiqueData: any): Promise<string> {
    const session: Session = this.driver.session();
    try {
      const result = await session.run(`
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

      return result.records[0].get('id');
    } finally {
      await session.close();
    }
  }

  /**
   * Link critique to artifact (for Critique agent)
   */
  async linkCritiqueToArtifact(critiqueId: string, artifactId: string): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.run(`
        MATCH (c:Critique {id: $critiqueId}), (a {id: $artifactId})
        CREATE (c)-[:CRITIQUES]->(a)
      `, { critiqueId, artifactId });
    } finally {
      await session.close();
    }
  }
}
