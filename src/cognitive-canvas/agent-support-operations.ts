import { CognitiveCanvasBase } from './base';
import { Session } from 'neo4j-driver';

export class AgentSupportOperations extends CognitiveCanvasBase {
  
  // Critique Agent Support
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

  // Debugger Agent Support
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
        rootCause: diagnosticData.rootCause,
        solution: diagnosticData.solution,
        confidence: diagnosticData.confidence || 0.7,
        considerations: diagnosticData.considerations || [],
        createdAt: new Date().toISOString()
      });

      return result.records[0].get('id');
    } finally {
      await session.close();
    }
  }

  // Task Context Support (for various agents)
  async getTaskContext(taskId: string): Promise<any> {
    const session: Session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (t:Task {id: $taskId})
        OPTIONAL MATCH (t)-[:PART_OF]->(p:Project)
        OPTIONAL MATCH (t)-[:HAS_ARTIFACT]->(a)
        RETURN t, p, collect(a) as artifacts
      `, { taskId });

      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      return {
        task: record.get('t').properties,
        project: record.get('p')?.properties,
        artifacts: record.get('artifacts').map((a: any) => a.properties)
      };
    } finally {
      await session.close();
    }
  }

  // Knowledge Updater Agent Support
  async getRelatedKnowledge(taskId: string): Promise<any[]> {
    const session: Session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (t:Task {id: $taskId})
        OPTIONAL MATCH (t)-[:USES]->(c:Contract)
        OPTIONAL MATCH (t)-[:IMPLEMENTS]->(ad:ArchitecturalDecision)
        OPTIONAL MATCH (t)-[:PRODUCES]->(cm:CodeModule)
        RETURN collect(DISTINCT c) as contracts,
               collect(DISTINCT ad) as architecturalDecisions,
               collect(DISTINCT cm) as codeModules
      `, { taskId });

      if (result.records.length === 0) {
        return [];
      }

      const record = result.records[0];
      return {
        contracts: record.get('contracts')?.map((c: any) => c.properties) || [],
        architecturalDecisions: record.get('architecturalDecisions')?.map((ad: any) => ad.properties) || [],
        codeModules: record.get('codeModules')?.map((cm: any) => cm.properties) || []
      } as any;
    } finally {
      await session.close();
    }
  }

  async createKnowledgeExtraction(extractionData: any): Promise<string> {
    const session: Session = this.driver.session();
    try {
      const result = await session.run(`
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

      return result.records[0].get('id');
    } finally {
      await session.close();
    }
  }

  // Project Context Support
  async getProjectContext(projectId: string): Promise<any> {
    const session: Session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (p:Project {id: $projectId})
        OPTIONAL MATCH (p)-[:CONTAINS]->(t:Task)
        OPTIONAL MATCH (p)-[:HAS_ARCHITECTURE]->(ad:ArchitecturalDecision)
        OPTIONAL MATCH (p)-[:HAS_CONTRACT]->(c:Contract)
        RETURN p,
               collect(DISTINCT t) as tasks,
               collect(DISTINCT ad) as architecturalDecisions,
               collect(DISTINCT c) as contracts
      `, { projectId });

      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      return {
        project: record.get('p').properties,
        tasks: record.get('tasks').map((t: any) => t.properties),
        architecturalDecisions: record.get('architecturalDecisions').map((ad: any) => ad.properties),
        contracts: record.get('contracts').map((c: any) => c.properties)
      };
    } finally {
      await session.close();
    }
  }

  // Relationship linking support
  async linkContractToFeature(contractId: string, featureId: string): Promise<void> {
    await this.executeQuery(
      'MATCH (c:Contract {id: $contractId}), (f:Task {id: $featureId}) CREATE (c)-[r:DEFINES {linkedAt: $linkedAt}]->(f) RETURN r',
      { contractId, featureId, linkedAt: new Date().toISOString() }
    );
  }

  async linkContractToCodeModule(contractId: string, codeModuleId: string, relationshipType: 'IMPLEMENTS' | 'USES' = 'IMPLEMENTS'): Promise<void> {
    await this.executeQuery(
      `MATCH (c:Contract {id: $contractId}), (cm:CodeModule {id: $codeModuleId}) CREATE (cm)-[r:${relationshipType} {linkedAt: $linkedAt}]->(c) RETURN r`,
      { contractId, codeModuleId, linkedAt: new Date().toISOString() }
    );
  }

  async linkContractToTest(contractId: string, testId: string, relationshipType: 'VALIDATES' | 'TESTS' = 'VALIDATES'): Promise<void> {
    await this.executeQuery(
      `MATCH (c:Contract {id: $contractId}), (t:Test {id: $testId}) CREATE (t)-[r:${relationshipType} {linkedAt: $linkedAt}]->(c) RETURN r`,
      { contractId, testId, linkedAt: new Date().toISOString() }
    );
  }

  // Create snapshot method implementation (required by base class)
  async createSnapshot(): Promise<string> {
    // This will be implemented in the main class
    throw new Error('createSnapshot must be implemented in the main CognitiveCanvas class');
  }
}