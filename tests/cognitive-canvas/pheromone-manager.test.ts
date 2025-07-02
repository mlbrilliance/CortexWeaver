import { PheromoneManager } from '../../src/cognitive-canvas/pheromone-manager';
import { Driver, Session, Result, Record, Node } from 'neo4j-driver';
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
} from '../../src/cognitive-canvas/types';

// Mock Neo4j driver
jest.mock('neo4j-driver');

describe('PheromoneManager', () => {
  let pheromoneManager: PheromoneManager;
  let mockDriver: jest.Mocked<Driver>;
  let mockSession: jest.Mocked<Session>;
  let mockResult: jest.Mocked<Result>;
  let mockRecord: jest.Mocked<Record>;
  let mockNode: jest.Mocked<Node>;

  const basePheromoneData: PheromoneData = {
    id: 'pheromone-123',
    type: 'guide_pheromone',
    strength: 0.8,
    context: 'api-design-pattern',
    metadata: {
      pattern: 'rest-api',
      source: 'architect-agent',
      confidence: 0.9
    },
    createdAt: '2024-01-01T00:00:00Z',
    expiresAt: '2024-12-31T23:59:59Z'
  };

  const enhancedPheromoneData: EnhancedPheromoneData = {
    ...basePheromoneData,
    pattern: {
      type: 'architectural',
      frequency: 5,
      lastSeen: '2024-01-01T10:00:00Z',
      associatedTasks: ['task-1', 'task-2'],
      effectiveness: 0.85
    },
    decayRate: 0.05,
    correlations: [
      {
        pheromoneId: 'pheromone-456',
        strength: 0.7,
        type: 'positive'
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Neo4j components
    mockNode = {
      properties: {},
      labels: ['Pheromone'],
      identity: { low: 1, high: 0 },
      elementId: 'element-1'
    } as any;

    mockRecord = {
      get: jest.fn().mockReturnValue(mockNode),
      keys: ['ph'],
      length: 1,
      forEach: jest.fn(),
      map: jest.fn(),
      toObject: jest.fn()
    } as any;

    mockResult = {
      records: [mockRecord],
      summary: {} as any,
      subscribe: jest.fn(),
      pipe: jest.fn(),
      then: jest.fn()
    } as any;

    mockSession = {
      run: jest.fn().mockResolvedValue(mockResult),
      close: jest.fn().mockResolvedValue(undefined),
      beginTransaction: jest.fn(),
      lastBookmark: jest.fn(),
      lastBookmarks: jest.fn(),
      readTransaction: jest.fn(),
      writeTransaction: jest.fn(),
      executeRead: jest.fn(),
      executeWrite: jest.fn()
    } as any;

    mockDriver = {
      session: jest.fn().mockReturnValue(mockSession),
      close: jest.fn().mockResolvedValue(undefined),
      getServerInfo: jest.fn(),
      supportsMultiDb: jest.fn(),
      supportsTransactionConfig: jest.fn(),
      verifyConnectivity: jest.fn(),
      executeQuery: jest.fn(),
      getNegotiatedAuth: jest.fn(),
      isEncrypted: jest.fn()
    } as any;

    pheromoneManager = new PheromoneManager(mockDriver);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPheromone', () => {
    it('should create basic pheromone successfully', async () => {
      const result = await pheromoneManager.createPheromone(basePheromoneData);

      expect(result).toEqual(basePheromoneData);
      expect(mockDriver.session).toHaveBeenCalled();
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (ph:Pheromone:guide_pheromone'),
        expect.objectContaining({
          id: 'pheromone-123',
          type: 'guide_pheromone',
          strength: 0.8,
          context: 'api-design-pattern'
        })
      );
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should create enhanced pheromone with pattern data', async () => {
      const result = await pheromoneManager.createPheromone(enhancedPheromoneData);

      expect(result).toEqual(enhancedPheromoneData);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (ph:Pheromone:guide_pheromone'),
        expect.objectContaining({
          pattern: JSON.stringify(enhancedPheromoneData.pattern),
          decayRate: 0.05
        })
      );
    });

    it('should handle legacy pheromone types with warning', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const legacyPheromone = {
        ...basePheromoneData,
        type: 'error' as any
      };

      await pheromoneManager.createPheromone(legacyPheromone);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Using legacy pheromone type: error. Consider migrating to guide_pheromone or warn_pheromone.'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should set default decay rate based on pheromone type', async () => {
      const warnPheromone = {
        ...basePheromoneData,
        type: 'warn_pheromone' as const
      };

      await pheromoneManager.createPheromone(warnPheromone);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          decayRate: 0.15 // Higher decay rate for warning pheromones
        })
      );
    });

    it('should handle creation failure', async () => {
      mockResult.records = [];

      await expect(pheromoneManager.createPheromone(basePheromoneData))
        .rejects.toThrow('Failed to create pheromone');
    });

    it('should close session on error', async () => {
      mockSession.run.mockRejectedValue(new Error('Database error'));

      await expect(pheromoneManager.createPheromone(basePheromoneData))
        .rejects.toThrow('Database error');
      
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should validate pheromone data before creation', async () => {
      const invalidPheromone = {
        id: '', // Invalid empty ID
        type: 'guide_pheromone',
        strength: 1.5, // Invalid strength > 1
        context: 'test',
        metadata: {},
        createdAt: '2024-01-01T00:00:00Z'
      } as PheromoneData;

      await expect(pheromoneManager.createPheromone(invalidPheromone))
        .rejects.toThrow();
    });
  });

  describe('getPheromonesByType', () => {
    it('should retrieve pheromones by type', async () => {
      mockRecord.get.mockReturnValue({
        properties: {
          id: 'pheromone-123',
          type: 'guide_pheromone',
          strength: 0.8,
          context: 'api-design-pattern',
          metadata: JSON.stringify({ pattern: 'rest-api' }),
          createdAt: '2024-01-01T00:00:00Z'
        }
      });

      const result = await pheromoneManager.getPheromonesByType('guide_pheromone');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pheromone-123');
      expect(result[0].type).toBe('guide_pheromone');
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (ph:Pheromone {type: $type})'),
        { type: 'guide_pheromone' }
      );
    });

    it('should handle empty results', async () => {
      mockResult.records = [];

      const result = await pheromoneManager.getPheromonesByType('nonexistent');

      expect(result).toHaveLength(0);
    });

    it('should parse metadata from JSON string', async () => {
      mockRecord.get.mockReturnValue({
        properties: {
          id: 'pheromone-123',
          type: 'guide_pheromone',
          strength: 0.8,
          context: 'test',
          metadata: JSON.stringify({ key: 'value' }),
          createdAt: '2024-01-01T00:00:00Z'
        }
      });

      const result = await pheromoneManager.getPheromonesByType('guide_pheromone');

      expect(result[0].metadata).toEqual({ key: 'value' });
    });
  });

  describe('getPheromonesByContext', () => {
    const queryOptions: PheromoneQueryOptions = {
      context: 'api-design',
      strengthThreshold: 0.5,
      timeRange: {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-31T23:59:59Z'
      },
      limit: 10
    };

    it('should retrieve pheromones by context with filters', async () => {
      mockRecord.get.mockReturnValue({
        properties: {
          id: 'pheromone-123',
          type: 'guide_pheromone',
          strength: 0.8,
          context: 'api-design-pattern',
          metadata: JSON.stringify({}),
          createdAt: '2024-01-15T00:00:00Z'
        }
      });

      const result = await pheromoneManager.getPheromonesByContext(queryOptions);

      expect(result.pheromones).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ph.context CONTAINS $context'),
        expect.objectContaining({
          context: 'api-design',
          strengthThreshold: 0.5,
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-31T23:59:59Z',
          limit: 10
        })
      );
    });

    it('should handle optional query parameters', async () => {
      const minimalOptions: PheromoneQueryOptions = {
        context: 'test'
      };

      await pheromoneManager.getPheromonesByContext(minimalOptions);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          context: 'test',
          strengthThreshold: 0.0, // Default
          limit: 50 // Default
        })
      );
    });
  });

  describe('analyzePheromonePatterns', () => {
    it('should analyze temporal patterns', async () => {
      const mockPatternData = [
        {
          get: jest.fn().mockImplementation((key: string) => {
            switch (key) {
              case 'context':
                return 'api-design';
              case 'count':
                return { low: 5, high: 0 };
              case 'avgStrength':
                return 0.75;
              case 'timeWindow':
                return '2024-01-01';
              default:
                return null;
            }
          })
        }
      ];

      mockResult.records = mockPatternData;

      const result = await pheromoneManager.analyzePheromonePatterns(
        'test-project',
        'temporal'
      );

      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0].type).toBe('temporal');
      expect(result.analysis.dominantContexts).toBeDefined();
    });

    it('should analyze frequency patterns', async () => {
      const result = await pheromoneManager.analyzePheromonePatterns(
        'test-project',
        'frequency'
      );

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('frequency analysis'),
        expect.objectContaining({
          projectId: 'test-project'
        })
      );
    });

    it('should analyze correlation patterns', async () => {
      const result = await pheromoneManager.analyzePheromonePatterns(
        'test-project',
        'correlation'
      );

      expect(result.patterns).toBeDefined();
      expect(result.analysis).toBeDefined();
    });
  });

  describe('decayPheromones', () => {
    it('should decay pheromones based on their decay rate', async () => {
      mockResult.records = [
        {
          get: jest.fn().mockImplementation((key: string) => {
            switch (key) {
              case 'id':
                return 'pheromone-123';
              case 'oldStrength':
                return 0.8;
              case 'newStrength':
                return 0.76; // Decayed strength
              default:
                return null;
            }
          })
        }
      ];

      const result = await pheromoneManager.decayPheromones();

      expect(result.processedCount).toBe(1);
      expect(result.decayedPheromones).toHaveLength(1);
      expect(result.decayedPheromones[0].newStrength).toBe(0.76);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('SET ph.strength = ph.strength * (1 - ph.decayRate)')
      );
    });

    it('should remove expired pheromones', async () => {
      const result = await pheromoneManager.decayPheromones();

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (ph:Pheromone) WHERE ph.expiresAt < datetime()')
      );
    });

    it('should handle no pheromones to decay', async () => {
      mockResult.records = [];

      const result = await pheromoneManager.decayPheromones();

      expect(result.processedCount).toBe(0);
      expect(result.decayedPheromones).toHaveLength(0);
      expect(result.removedExpiredCount).toBe(0);
    });
  });

  describe('findPatternCorrelations', () => {
    it('should find correlations between pheromone patterns', async () => {
      mockResult.records = [
        {
          get: jest.fn().mockImplementation((key: string) => {
            switch (key) {
              case 'pattern1':
                return 'api-design';
              case 'pattern2':
                return 'database-schema';
              case 'correlation':
                return 0.85;
              case 'significance':
                return 0.95;
              case 'cooccurrenceCount':
                return { low: 12, high: 0 };
              default:
                return null;
            }
          })
        }
      ];

      const result = await pheromoneManager.findPatternCorrelations([
        'api-design',
        'database-schema'
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].pattern1).toBe('api-design');
      expect(result[0].pattern2).toBe('database-schema');
      expect(result[0].correlationStrength).toBe(0.85);
      expect(result[0].significance).toBe(0.95);
    });

    it('should handle no correlations found', async () => {
      mockResult.records = [];

      const result = await pheromoneManager.findPatternCorrelations(['pattern1']);

      expect(result).toHaveLength(0);
    });
  });

  describe('getTemporalPatterns', () => {
    it('should analyze temporal patterns in pheromone creation', async () => {
      mockResult.records = [
        {
          get: jest.fn().mockImplementation((key: string) => {
            switch (key) {
              case 'timeWindow':
                return '2024-01-01T10:00:00Z';
              case 'pheromoneCount':
                return { low: 5, high: 0 };
              case 'avgStrength':
                return 0.75;
              case 'dominantContext':
                return 'api-design';
              default:
                return null;
            }
          })
        }
      ];

      const result = await pheromoneManager.getTemporalPatterns(
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z',
        'hourly'
      );

      expect(result).toHaveLength(1);
      expect(result[0].timeWindow).toBe('2024-01-01T10:00:00Z');
      expect(result[0].pheromoneCount).toBe(5);
      expect(result[0].averageStrength).toBe(0.75);
      expect(result[0].dominantContext).toBe('api-design');
    });

    it('should handle different time intervals', async () => {
      await pheromoneManager.getTemporalPatterns(
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z',
        'daily'
      );

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('daily interval'),
        expect.anything()
      );
    });
  });

  describe('createWarnPheromone', () => {
    it('should create warning pheromone with appropriate strength', async () => {
      const result = await pheromoneManager.createWarnPheromone(
        'memory-leak-detected',
        {
          taskOutcome: 'failure',
          errorTypes: ['memory_leak', 'performance_degradation'],
          agentType: 'coder',
          complexity: 'high'
        },
        0.9,
        86400000 // 24 hours TTL
      );

      expect(result.type).toBe('warn_pheromone');
      expect(result.strength).toBe(0.9);
      expect(result.context).toBe('memory-leak-detected');
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('warn_pheromone'),
        expect.objectContaining({
          type: 'warn_pheromone',
          strength: 0.9,
          context: 'memory-leak-detected'
        })
      );
    });

    it('should set appropriate expiration time', async () => {
      const ttl = 3600000; // 1 hour
      const beforeCreation = Date.now();

      await pheromoneManager.createWarnPheromone(
        'test-warning',
        {},
        0.8,
        ttl
      );

      const afterCreation = Date.now();

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          expiresAt: expect.any(String)
        })
      );

      // Verify expiration time is approximately correct
      const callArgs = mockSession.run.mock.calls[0][1];
      const expirationTime = new Date(callArgs.expiresAt).getTime();
      expect(expirationTime).toBeGreaterThanOrEqual(beforeCreation + ttl);
      expect(expirationTime).toBeLessThanOrEqual(afterCreation + ttl);
    });
  });

  describe('error handling and validation', () => {
    it('should validate pheromone strength is between 0 and 1', async () => {
      const invalidPheromone = {
        ...basePheromoneData,
        strength: 1.5 // Invalid strength
      };

      await expect(pheromoneManager.createPheromone(invalidPheromone))
        .rejects.toThrow('Pheromone strength must be between 0 and 1');
    });

    it('should validate required fields', async () => {
      const incompletePheromone = {
        id: 'test',
        type: 'guide_pheromone',
        // Missing strength and context
        metadata: {},
        createdAt: '2024-01-01T00:00:00Z'
      } as PheromoneData;

      await expect(pheromoneManager.createPheromone(incompletePheromone))
        .rejects.toThrow();
    });

    it('should handle database connection errors gracefully', async () => {
      mockSession.run.mockRejectedValue(new Error('Connection failed'));

      await expect(pheromoneManager.createPheromone(basePheromoneData))
        .rejects.toThrow('Connection failed');

      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should handle malformed JSON in metadata', async () => {
      mockRecord.get.mockReturnValue({
        properties: {
          id: 'pheromone-123',
          type: 'guide_pheromone',
          strength: 0.8,
          context: 'test',
          metadata: 'invalid json{',
          createdAt: '2024-01-01T00:00:00Z'
        }
      });

      const result = await pheromoneManager.getPheromonesByType('guide_pheromone');

      expect(result[0].metadata).toEqual({}); // Should default to empty object
    });
  });

  describe('performance and optimization', () => {
    it('should complete pheromone creation within reasonable time', async () => {
      const startTime = Date.now();
      
      await pheromoneManager.createPheromone(basePheromoneData);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should efficiently query large pheromone datasets', async () => {
      const largeResultSet = Array.from({ length: 1000 }, (_, i) => ({
        get: jest.fn().mockReturnValue({
          properties: {
            id: `pheromone-${i}`,
            type: 'guide_pheromone',
            strength: 0.5 + (i % 50) / 100,
            context: `context-${i % 10}`,
            metadata: JSON.stringify({}),
            createdAt: '2024-01-01T00:00:00Z'
          }
        })
      }));

      mockResult.records = largeResultSet;

      const startTime = Date.now();
      const result = await pheromoneManager.getPheromonesByType('guide_pheromone');
      const duration = Date.now() - startTime;

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(2000); // Should process efficiently
    });

    it('should batch decay operations efficiently', async () => {
      const startTime = Date.now();
      
      await pheromoneManager.decayPheromones();
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
      
      // Should use a single query for all decay operations
      expect(mockSession.run).toHaveBeenCalledTimes(2); // One for decay, one for cleanup
    });
  });
});