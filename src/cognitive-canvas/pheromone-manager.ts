import { Driver, Session } from 'neo4j-driver';
import { 
  PheromoneData, 
  EnhancedPheromoneData,
  PheromonePattern,
  PheromoneQueryOptions,
  PatternCorrelation,
  TemporalPattern,
  PheromoneAnalysis,
  PheromoneDecayResult,
  ContextPheromonesResult
} from './types';

export class PheromoneManager {
  constructor(private driver: Driver) {}

  async createPheromone(pheromoneData: PheromoneData | EnhancedPheromoneData): Promise<PheromoneData> {
    this.validatePheromoneData(pheromoneData);
    
    // Handle legacy pheromone types with warning
    if (!['guide_pheromone', 'warn_pheromone', 'guide', 'warn'].includes(pheromoneData.type)) {
      console.warn(`Using legacy pheromone type: ${pheromoneData.type}. Consider migrating to guide_pheromone or warn_pheromone.`);
    }

    // Convert Date objects to ISO strings for Neo4j storage
    const dbData = {
      ...pheromoneData,
      pattern: (pheromoneData as EnhancedPheromoneData).pattern ? JSON.stringify((pheromoneData as EnhancedPheromoneData).pattern) : null,
      decayRate: (pheromoneData as EnhancedPheromoneData).decayRate || (pheromoneData.type.includes('warn') ? 0.15 : 0.05),
      createdAt: pheromoneData.createdAt,
      expiresAt: pheromoneData.expiresAt || null
    };
    
    const session = this.driver.session();
    try {
      const labels = pheromoneData.type.includes('_') ? `:${pheromoneData.type}` : '';
      const result = await session.run(
        `CREATE (ph:Pheromone${labels} {id: $id, type: $type, strength: $strength, context: $context, metadata: $metadata, pattern: $pattern, decayRate: $decayRate, createdAt: $createdAt, expiresAt: $expiresAt}) RETURN ph`,
        dbData
      );
      
      if (result.records.length === 0) {
        throw new Error('Failed to create pheromone');
      }
      
      return pheromoneData; // Return original data with Date objects
    } finally {
      await session.close();
    }
  }

  async createGuidePheromone(context: string, pattern: PheromonePattern, strength: number): Promise<EnhancedPheromoneData> {
    const id = `guide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pheromoneData: EnhancedPheromoneData = {
      id,
      type: 'guide_pheromone',
      strength,
      context,
      pattern,
      decayRate: 0.05,
      metadata: { 
        successPattern: true,
        agentType: pattern.agentType,
        complexity: pattern.complexity
      },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    };
    
    return this.createPheromone(pheromoneData) as Promise<EnhancedPheromoneData>;
  }

  async createWarnPheromone(context: string, pattern: PheromonePattern, strength: number): Promise<EnhancedPheromoneData> {
    const id = `warn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pheromoneData: EnhancedPheromoneData = {
      id,
      type: 'warn_pheromone',
      strength,
      context,
      pattern,
      decayRate: 0.15,
      metadata: { 
        failurePattern: true,
        agentType: pattern.agentType,
        complexity: pattern.complexity
      },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days
    };
    
    return this.createPheromone(pheromoneData) as Promise<EnhancedPheromoneData>;
  }

  async queryPheromones(options: PheromoneQueryOptions): Promise<PheromoneData[]> {
    const session = this.driver.session();
    try {
      let whereClauses = ['ph.expiresAt > $now'];
      const params: any = { now: new Date().toISOString() };
      
      if (options.type) {
        whereClauses.push('ph.type = $type');
        params.type = options.type;
      }
      
      if (options.agentType) {
        whereClauses.push('ph.pattern CONTAINS $agentType');
        params.agentType = options.agentType;
      }
      
      if (options.minStrength !== undefined) {
        whereClauses.push('ph.strength >= $minStrength');
        params.minStrength = options.minStrength;
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const limit = options.limit ? `LIMIT ${options.limit}` : '';
      
      const query = `
        MATCH (ph:Pheromone)
        ${whereClause}
        RETURN ph
        ORDER BY ph.strength DESC
        ${limit}
      `;
      
      const result = await session.run(query, params);
      return result.records.map(record => {
        const properties = record.get('ph').properties;
        return {
          ...properties,
          pattern: properties.pattern ? JSON.parse(properties.pattern) : undefined
        };
      });
    } finally {
      await session.close();
    }
  }

  async linkPheromoneToTask(pheromoneId: string, taskId: string, influence: 'positive' | 'negative' = 'positive'): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        'MATCH (ph:Pheromone {id: $pheromoneId}), (t:Task {id: $taskId}) CREATE (ph)-[r:INFLUENCES {type: $influence, createdAt: $createdAt}]->(t) RETURN r',
        { pheromoneId, taskId, influence, createdAt: new Date().toISOString() }
      );
    } finally {
      await session.close();
    }
  }

  async getPheromonesByType(type: string): Promise<PheromoneData[]> {
    return this.queryPheromones({ type });
  }

  async getContextPheromones(agentType: string, taskContext: string, taskComplexity: string): Promise<ContextPheromonesResult> {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (ph:Pheromone)
        WHERE ph.expiresAt > $now
        AND (
          ph.context CONTAINS $taskContext 
          OR ph.metadata.agentType = $agentType
          OR ph.metadata.complexity = $taskComplexity
        )
        RETURN ph
        ORDER BY ph.strength DESC
        LIMIT 20
      `, {
        now: new Date().toISOString(),
        agentType,
        taskContext,
        taskComplexity
      });

      const allPheromones = result.records.map(record => {
        const properties = record.get('ph').properties;
        return {
          ...properties,
          pattern: properties.pattern ? JSON.parse(properties.pattern) : undefined
        } as PheromoneData;
      });
      
      // Separate into guides and warnings based on pheromone type
      const guides = allPheromones.filter(ph => ph.type === 'guide' || ph.type === 'guide_pheromone');
      const warnings = allPheromones.filter(ph => ph.type === 'warn' || ph.type === 'warn_pheromone');
      
      return { guides, warnings };
    } finally {
      await session.close();
    }
  }

  async analyzePatternCorrelations(agentType?: string): Promise<PatternCorrelation[]> {
    const session = this.driver.session();
    try {
      const whereClause = agentType ? 'WHERE ph.pattern CONTAINS $agentType AND' : 'WHERE';
      const params = agentType ? { agentType, now: new Date().toISOString() } : { now: new Date().toISOString() };
      
      const result = await session.run(`
        MATCH (ph:Pheromone)
        ${whereClause} ph.expiresAt > $now
        RETURN ph, ph.pattern as pattern, 
               collect(DISTINCT ph.context) as promptPatterns,
               count(ph) as frequency,
               avg(toFloat(ph.strength)) as successRate
        ORDER BY successRate DESC
      `, params);

      return result.records.map(record => {
        const ph = record.get('ph');
        const pattern = record.get('pattern') ? JSON.parse(record.get('pattern')) : {};
        const frequency = record.get('frequency').low || record.get('frequency');
        const successRate = record.get('successRate');
        
        // Calculate correlation score
        const correlationScore = successRate * Math.min(frequency / 10, 1);
        
        return {
          pheromoneId: ph.properties.id,
          correlatedPatterns: [pattern],
          correlationScore,
          temporalTrend: 'stable' as const,
          recommendations: correlationScore > 0.7 ? ['replicate pattern'] : ['review pattern']
        };
      });
    } finally {
      await session.close();
    }
  }

  async analyzeTemporalPatterns(agentType: string, timeWindowMs?: number): Promise<TemporalPattern[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (ph:Pheromone)
        WHERE ph.pattern CONTAINS $agentType
        AND ph.expiresAt > $now
        RETURN ph.pattern as pattern, 
               count(ph) as frequency,
               avg(toFloat(ph.strength)) as successRate,
               min(ph.createdAt) as startTime,
               max(ph.createdAt) as endTime
        ORDER BY successRate DESC
      `, { agentType, now: new Date().toISOString() });

      return result.records.map(record => {
        const pattern = record.get('pattern') ? JSON.parse(record.get('pattern')) : {};
        const frequency = record.get('frequency').low || record.get('frequency');
        const successRate = record.get('successRate');
        const startTime = record.get('startTime');
        const endTime = record.get('endTime');
        
        // Determine evolution trend
        let evolutionTrend: 'improving' | 'degrading' | 'stable' = 'stable';
        if (successRate > 0.8) evolutionTrend = 'improving';
        else if (successRate < 0.5) evolutionTrend = 'degrading';
        
        return {
          pattern,
          frequency,
          successRate,
          evolutionTrend,
          timeframe: { start: startTime, end: endTime }
        };
      });
    } finally {
      await session.close();
    }
  }

  async getPheromoneAnalysis(agentType: string): Promise<PheromoneAnalysis> {
    const session = this.driver.session();
    try {
      const statsResult = await session.run(`
        MATCH (ph:Pheromone)
        WHERE ph.expiresAt > $now
        RETURN count(ph) as totalPheromones,
               sum(CASE WHEN ph.type CONTAINS 'guide' THEN 1 ELSE 0 END) as guidePheromones,
               sum(CASE WHEN ph.type CONTAINS 'warn' THEN 1 ELSE 0 END) as warnPheromones,
               avg(toFloat(ph.strength)) as avgStrength
      `, { now: new Date().toISOString() });

      const stats = statsResult.records[0];
      const totalPheromones = stats.get('totalPheromones').low || 0;
      const guidePheromones = stats.get('guidePheromones').low || 0;
      const warnPheromones = stats.get('warnPheromones').low || 0;
      const avgStrength = stats.get('avgStrength') || 0;

      const [correlations, temporalInsights] = await Promise.all([
        this.analyzePatternCorrelations(agentType),
        this.analyzeTemporalPatterns(agentType)
      ]);

      return {
        totalPheromones,
        guidePheromones,
        warnPheromones,
        avgStrength,
        correlations,
        temporalInsights
      };
    } finally {
      await session.close();
    }
  }

  async applyPheromoneDecay(): Promise<PheromoneDecayResult> {
    const session = this.driver.session();
    try {
      // Apply decay to active pheromones
      const updateResult = await session.run(`
        MATCH (ph:Pheromone)
        WHERE ph.expiresAt > $now
        SET ph.strength = ph.strength * (1 - ph.decayRate)
        RETURN count(ph) as updated
      `, { now: new Date().toISOString() });

      // Remove expired or very weak pheromones
      const expireResult = await session.run(`
        MATCH (ph:Pheromone)
        WHERE ph.expiresAt <= $now OR ph.strength <= 0.1
        DETACH DELETE ph
        RETURN count(ph) as expired
      `, { now: new Date().toISOString() });

      return {
        updated: updateResult.records[0]?.get('updated').low || 0,
        expired: expireResult.records[0]?.get('expired').low || 0
      };
    } finally {
      await session.close();
    }
  }

  async cleanExpiredPheromones(): Promise<number> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (ph:Pheromone) WHERE ph.expiresAt <= $now DETACH DELETE ph',
        { now: new Date().toISOString() }
      );
      return result.summary.counters.updates().nodesDeleted;
    } finally {
      await session.close();
    }
  }

  private validatePheromoneData(data: any): void {
    this.validateRequiredFields(data, ['id', 'type', 'strength', 'context', 'metadata', 'createdAt'], 'pheromone');
    
    if (data.strength < 0 || data.strength > 1) {
      throw new Error('Pheromone strength must be between 0 and 1');
    }

    // Validate pattern if present
    if ((data as EnhancedPheromoneData).pattern) {
      const pattern = (data as EnhancedPheromoneData).pattern!;
      if (!['success', 'failure', 'partial'].includes(pattern.taskOutcome)) {
        throw new Error('Invalid task outcome');
      }
    }
    
    // Validate that createdAt is a valid ISO string or Date object
    if (typeof data.createdAt === 'string') {
      if (isNaN(Date.parse(data.createdAt))) {
        throw new Error('Pheromone createdAt must be a valid ISO date string');
      }
    } else if (!(data.createdAt instanceof Date)) {
      throw new Error('Pheromone createdAt must be a Date object or ISO date string');
    }
    
    // Validate that expiresAt is a valid ISO string or Date object if provided
    if (data.expiresAt !== undefined) {
      if (typeof data.expiresAt === 'string') {
        if (isNaN(Date.parse(data.expiresAt))) {
          throw new Error('Pheromone expiresAt must be a valid ISO date string');
        }
      } else if (!(data.expiresAt instanceof Date)) {
        throw new Error('Pheromone expiresAt must be a Date object or ISO date string if provided');
      }
    }
  }

  private validateRequiredFields(data: any, fields: string[], type: string): void {
    if (!fields.every(field => data[field] !== undefined && data[field] !== null)) {
      throw new Error(`Missing required ${type} fields: ${fields.join(', ')}`);
    }
  }
}