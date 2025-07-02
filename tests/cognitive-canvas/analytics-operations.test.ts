import { AnalyticsOperations } from '../../src/cognitive-canvas/analytics-operations';
import { Driver, Session, Result, Record } from 'neo4j-driver';
import { SnapshotData, KnowledgeGraph, FailureData, DiagnosticData, PatternData, ArtifactData } from '../../src/cognitive-canvas/types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
jest.mock('neo4j-driver');
jest.mock('fs/promises');
jest.mock('path');

describe('AnalyticsOperations', () => {
  let analyticsOps: AnalyticsOperations;
  let mockDriver: jest.Mocked<Driver>;
  let mockSession: jest.Mocked<Session>;
  let mockResult: jest.Mocked<Result>;
  let mockRecord: jest.Mocked<Record>;

  const mockConfig = {
    uri: 'neo4j://localhost:7687',
    username: 'neo4j',
    password: 'password'
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock file system operations
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockResolvedValue('{"nodes": [], "relationships": []}');
    (path.dirname as jest.Mock).mockReturnValue('/snapshots');
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));

    // Mock Neo4j components
    mockRecord = {
      get: jest.fn(),
      keys: [],
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

    analyticsOps = new AnalyticsOperations();
    await analyticsOps.initialize(mockConfig);
    
    // Override the driver with our mock
    (analyticsOps as any).driver = mockDriver;
  });

  afterEach(async () => {
    await analyticsOps.close();
    jest.clearAllMocks();
  });

  describe('snapshot management', () => {
    it('should save snapshot to file', async () => {
      // Mock node data
      mockRecord.get.mockImplementation((key: string) => {
        if (key === 'n') {
          return {
            identity: { low: 123 },
            labels: ['Task'],
            properties: { id: 'task-1', title: 'Test Task' }
          };
        }
        return null;
      });

      // Create separate sessions for nodes and relationships
      const nodesSession = { ...mockSession };
      const relsSession = { ...mockSession };
      
      mockDriver.session
        .mockReturnValueOnce(nodesSession as any)
        .mockReturnValueOnce(relsSession as any);

      // Configure relationship mock for second call
      relsSession.run = jest.fn().mockResolvedValue({
        records: [{
          get: jest.fn().mockImplementation((key: string) => {
            switch (key) {
              case 'start': return { identity: { low: 123 } };
              case 'end': return { identity: { low: 456 } };
              case 'type': return 'DEPENDS_ON';
              case 'props': return { strength: 0.8 };
              default: return null;
            }
          })
        }]
      });

      await analyticsOps.saveSnapshot('/snapshots/test-snapshot.json');

      expect(fs.mkdir).toHaveBeenCalledWith('/snapshots', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/snapshots/test-snapshot.json',
        expect.stringContaining('"nodes"'),
        'utf8'
      );
      expect(nodesSession.close).toHaveBeenCalled();
      expect(relsSession.close).toHaveBeenCalled();
    });

    it('should load snapshot from file', async () => {
      const mockSnapshotData = {
        nodes: [
          { id: '1', labels: ['Task'], properties: { title: 'Test Task' } }
        ],
        relationships: [
          { id: '1', startNode: '1', endNode: '2', type: 'DEPENDS_ON', properties: {} }
        ],
        nodeTypes: { Task: 1 },
        relationshipTypes: { DEPENDS_ON: 1 },
        metadata: {
          created: '2024-01-01T00:00:00Z',
          version: '1.0.0',
          description: 'Test snapshot'
        }
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockSnapshotData));

      const result = await analyticsOps.loadSnapshot('/snapshots/test-snapshot.json');

      expect(fs.readFile).toHaveBeenCalledWith('/snapshots/test-snapshot.json', 'utf8');
      expect(result.nodes).toHaveLength(1);
      expect(result.relationships).toHaveLength(1);
      expect(result.metadata.description).toBe('Test snapshot');
    });

    it('should handle snapshot save errors', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      await expect(analyticsOps.saveSnapshot('/invalid/path.json'))
        .rejects.toThrow('Permission denied');
    });

    it('should handle snapshot load errors', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect(analyticsOps.loadSnapshot('/nonexistent/snapshot.json'))
        .rejects.toThrow('File not found');
    });

    it('should generate snapshot metadata', async () => {
      mockRecord.get.mockReturnValue({
        identity: { low: 123 },
        labels: ['Task'],
        properties: { id: 'task-1' }
      });

      const mockRelsSession = {
        ...mockSession,
        run: jest.fn().mockResolvedValue({ records: [] })
      };

      mockDriver.session
        .mockReturnValueOnce(mockSession as any)
        .mockReturnValueOnce(mockRelsSession as any);

      await analyticsOps.saveSnapshot('/snapshots/test.json');

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const snapshotData = JSON.parse(writeCall[1]);

      expect(snapshotData.metadata).toBeDefined();
      expect(snapshotData.metadata.created).toBeDefined();
      expect(snapshotData.metadata.nodeCount).toBeDefined();
      expect(snapshotData.metadata.relationshipCount).toBeDefined();
    });
  });

  describe('knowledge graph analytics', () => {
    it('should build knowledge graph for project', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'nodes':
            return [
              { id: 'task-1', type: 'Task', properties: { title: 'Auth Task' } },
              { id: 'contract-1', type: 'Contract', properties: { name: 'Auth API' } }
            ];
          case 'relationships':
            return [
              { source: 'task-1', target: 'contract-1', type: 'IMPLEMENTS', properties: {} }
            ];
          default:
            return null;
        }
      });

      const result = await analyticsOps.buildKnowledgeGraph('project-123');

      expect(result.nodes).toHaveLength(2);
      expect(result.relationships).toHaveLength(1);
      expect(result.nodes[0].type).toBe('Task');
      expect(result.relationships[0].type).toBe('IMPLEMENTS');
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (n)'),
        { projectId: 'project-123' }
      );
    });

    it('should calculate graph metrics', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'nodeCount': return { low: 50, high: 0 };
          case 'relationshipCount': return { low: 75, high: 0 };
          case 'avgDegree': return 3.2;
          case 'maxDegree': return { low: 12, high: 0 };
          case 'clusteringCoefficient': return 0.65;
          case 'diameter': return { low: 8, high: 0 };
          default: return null;
        }
      });

      const result = await analyticsOps.calculateGraphMetrics('project-123');

      expect(result.nodeCount).toBe(50);
      expect(result.relationshipCount).toBe(75);
      expect(result.averageDegree).toBe(3.2);
      expect(result.maxDegree).toBe(12);
      expect(result.clusteringCoefficient).toBe(0.65);
      expect(result.diameter).toBe(8);
    });

    it('should find graph communities', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'community': return 1;
          case 'nodes': return ['task-1', 'task-2', 'contract-1'];
          case 'size': return { low: 3, high: 0 };
          case 'density': return 0.75;
          default: return null;
        }
      });

      const result = await analyticsOps.findCommunities('project-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].nodes).toEqual(['task-1', 'task-2', 'contract-1']);
      expect(result[0].size).toBe(3);
      expect(result[0].density).toBe(0.75);
    });

    it('should identify critical paths', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'path': return ['task-1', 'task-2', 'task-3'];
          case 'length': return { low: 3, high: 0 };
          case 'criticality': return 0.9;
          case 'bottleneck': return 'task-2';
          default: return null;
        }
      });

      const result = await analyticsOps.identifyCriticalPaths('project-123');

      expect(result).toHaveLength(1);
      expect(result[0].path).toEqual(['task-1', 'task-2', 'task-3']);
      expect(result[0].length).toBe(3);
      expect(result[0].criticality).toBe(0.9);
      expect(result[0].bottleneck).toBe('task-2');
    });
  });

  describe('failure pattern analysis', () => {
    it('should analyze failure patterns', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'pattern': return 'null-pointer-exception';
          case 'frequency': return { low: 8, high: 0 };
          case 'severity': return 'high';
          case 'affectedAgents': return ['Architect', 'Coder'];
          case 'timeSpan': return '2024-01-01 to 2024-01-07';
          case 'trend': return 'increasing';
          default: return null;
        }
      });

      const result = await analyticsOps.analyzeFailurePatterns('project-123', 7);

      expect(result).toHaveLength(1);
      expect(result[0].pattern).toBe('null-pointer-exception');
      expect(result[0].frequency).toBe(8);
      expect(result[0].severity).toBe('high');
      expect(result[0].affectedAgents).toEqual(['Architect', 'Coder']);
      expect(result[0].trend).toBe('increasing');
    });

    it('should find recurring diagnostic patterns', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'rootCause': return 'input-validation';
          case 'count': return { low: 5, high: 0 };
          case 'confidence': return 0.85;
          case 'commonSolutions': return ['Add null checks', 'Validate inputs'];
          case 'effectiveness': return 0.9;
          default: return null;
        }
      });

      const result = await analyticsOps.findRecurringDiagnosticPatterns('project-123');

      expect(result).toHaveLength(1);
      expect(result[0].rootCause).toBe('input-validation');
      expect(result[0].occurrences).toBe(5);
      expect(result[0].confidence).toBe(0.85);
      expect(result[0].commonSolutions).toEqual(['Add null checks', 'Validate inputs']);
      expect(result[0].effectiveness).toBe(0.9);
    });

    it('should correlate failures with system state', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'failure': return { properties: { id: 'failure-1', type: 'system_failure' } };
          case 'systemMetrics': return { memoryUsage: 85, cpuUsage: 75 };
          case 'correlation': return 0.78;
          case 'predictive': return true;
          default: return null;
        }
      });

      const result = await analyticsOps.correlateFailuresWithSystemState('project-123');

      expect(result).toHaveLength(1);
      expect(result[0].failure.id).toBe('failure-1');
      expect(result[0].systemMetrics.memoryUsage).toBe(85);
      expect(result[0].correlation).toBe(0.78);
      expect(result[0].isPredictive).toBe(true);
    });
  });

  describe('performance analytics', () => {
    it('should analyze task completion trends', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'date': return '2024-01-01';
          case 'completedTasks': return { low: 12, high: 0 };
          case 'avgDuration': return 4.5;
          case 'successRate': return 0.85;
          case 'velocity': return 2.4;
          default: return null;
        }
      });

      const result = await analyticsOps.analyzeTaskCompletionTrends(
        'project-123',
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z'
      );

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-01');
      expect(result[0].completedTasks).toBe(12);
      expect(result[0].averageDuration).toBe(4.5);
      expect(result[0].successRate).toBe(0.85);
      expect(result[0].velocity).toBe(2.4);
    });

    it('should measure agent efficiency', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'agent': return { properties: { id: 'agent-1', type: 'Architect' } };
          case 'tasksCompleted': return { low: 25, high: 0 };
          case 'avgTaskTime': return 3.2;
          case 'successRate': return 0.92;
          case 'efficiency': return 0.78;
          case 'complexity': return 2.8;
          default: return null;
        }
      });

      const result = await analyticsOps.measureAgentEfficiency('project-123');

      expect(result).toHaveLength(1);
      expect(result[0].agent.id).toBe('agent-1');
      expect(result[0].tasksCompleted).toBe(25);
      expect(result[0].averageTaskTime).toBe(3.2);
      expect(result[0].successRate).toBe(0.92);
      expect(result[0].efficiency).toBe(0.78);
      expect(result[0].complexityScore).toBe(2.8);
    });

    it('should predict project completion', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'remainingTasks': return { low: 15, high: 0 };
          case 'avgVelocity': return 2.5;
          case 'estimatedDuration': return 6.0;
          case 'confidence': return 0.85;
          case 'riskFactors': return ['resource_constraints', 'technical_complexity'];
          default: return null;
        }
      });

      const result = await analyticsOps.predictProjectCompletion('project-123');

      expect(result.remainingTasks).toBe(15);
      expect(result.averageVelocity).toBe(2.5);
      expect(result.estimatedDuration).toBe(6.0);
      expect(result.confidence).toBe(0.85);
      expect(result.riskFactors).toEqual(['resource_constraints', 'technical_complexity']);
    });
  });

  describe('temporal analysis', () => {
    it('should analyze activity patterns over time', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'hour': return { low: 14, high: 0 }; // 2 PM
          case 'activityCount': return { low: 45, high: 0 };
          case 'successRate': return 0.88;
          case 'peakHour': return true;
          default: return null;
        }
      });

      const result = await analyticsOps.analyzeActivityPatterns(
        'project-123',
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z',
        'hourly'
      );

      expect(result).toHaveLength(1);
      expect(result[0].timeWindow).toBe(14);
      expect(result[0].activityCount).toBe(45);
      expect(result[0].successRate).toBe(0.88);
      expect(result[0].isPeak).toBe(true);
    });

    it('should detect seasonal patterns', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'season': return 'Q1';
          case 'pattern': return 'high-activity';
          case 'strength': return 0.85;
          case 'recurrence': return 'quarterly';
          default: return null;
        }
      });

      const result = await analyticsOps.detectSeasonalPatterns('project-123');

      expect(result).toHaveLength(1);
      expect(result[0].season).toBe('Q1');
      expect(result[0].pattern).toBe('high-activity');
      expect(result[0].strength).toBe(0.85);
      expect(result[0].recurrence).toBe('quarterly');
    });
  });

  describe('artifact relationship analysis', () => {
    it('should analyze artifact dependencies', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'source': return { properties: { id: 'contract-1', type: 'contract' } };
          case 'target': return { properties: { id: 'module-1', type: 'code_module' } };
          case 'relationship': return { type: 'IMPLEMENTS', strength: 0.9 };
          case 'depth': return { low: 2, high: 0 };
          default: return null;
        }
      });

      const result = await analyticsOps.analyzeArtifactDependencies('project-123');

      expect(result).toHaveLength(1);
      expect(result[0].source.id).toBe('contract-1');
      expect(result[0].target.id).toBe('module-1');
      expect(result[0].relationship.type).toBe('IMPLEMENTS');
      expect(result[0].relationship.strength).toBe(0.9);
      expect(result[0].depth).toBe(2);
    });

    it('should find artifact clusters', async () => {
      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'cluster': return 1;
          case 'artifacts': return ['contract-1', 'module-1', 'test-1'];
          case 'cohesion': return 0.85;
          case 'coupling': return 0.3;
          case 'purpose': return 'authentication-system';
          default: return null;
        }
      });

      const result = await analyticsOps.findArtifactClusters('project-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].artifacts).toEqual(['contract-1', 'module-1', 'test-1']);
      expect(result[0].cohesion).toBe(0.85);
      expect(result[0].coupling).toBe(0.3);
      expect(result[0].purpose).toBe('authentication-system');
    });
  });

  describe('export and reporting', () => {
    it('should export analytics data', async () => {
      const exportData = {
        projectMetrics: { taskCount: 50, completionRate: 75 },
        failureAnalysis: [{ pattern: 'timeout', frequency: 5 }],
        performanceData: [{ date: '2024-01-01', velocity: 2.5 }]
      };

      mockRecord.get.mockImplementation((key: string) => {
        if (key === 'data') return exportData;
        return null;
      });

      const result = await analyticsOps.exportAnalyticsData(
        'project-123',
        ['metrics', 'failures', 'performance']
      );

      expect(result.projectMetrics).toBeDefined();
      expect(result.failureAnalysis).toBeDefined();
      expect(result.performanceData).toBeDefined();
      expect(result.exportedAt).toBeDefined();
    });

    it('should generate comprehensive report', async () => {
      const mockReportData = {
        summary: { projectId: 'project-123', status: 'active' },
        metrics: { completionRate: 75, efficiency: 0.85 },
        insights: ['High success rate in afternoon hours'],
        recommendations: ['Optimize morning workflows']
      };

      mockRecord.get.mockImplementation((key: string) => {
        switch (key) {
          case 'summary': return mockReportData.summary;
          case 'metrics': return mockReportData.metrics;
          case 'insights': return mockReportData.insights;
          case 'recommendations': return mockReportData.recommendations;
          default: return null;
        }
      });

      const result = await analyticsOps.generateAnalyticsReport('project-123');

      expect(result.summary.projectId).toBe('project-123');
      expect(result.metrics.completionRate).toBe(75);
      expect(result.insights).toContain('High success rate in afternoon hours');
      expect(result.recommendations).toContain('Optimize morning workflows');
      expect(result.generatedAt).toBeDefined();
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle empty project data', async () => {
      mockResult.records = [];

      const result = await analyticsOps.buildKnowledgeGraph('empty-project');

      expect(result.nodes).toHaveLength(0);
      expect(result.relationships).toHaveLength(0);
    });

    it('should handle database query failures', async () => {
      mockSession.run.mockRejectedValue(new Error('Query failed'));

      await expect(analyticsOps.calculateGraphMetrics('project-123'))
        .rejects.toThrow('Query failed');

      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should handle file system errors in snapshots', async () => {
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('Disk full'));

      await expect(analyticsOps.saveSnapshot('/full/disk.json'))
        .rejects.toThrow('Disk full');
    });

    it('should validate input parameters', async () => {
      await expect(analyticsOps.analyzeTaskCompletionTrends('', '', ''))
        .rejects.toThrow(); // Should validate non-empty project ID
    });

    it('should handle malformed data gracefully', async () => {
      mockRecord.get.mockReturnValue(null); // Malformed data

      const result = await analyticsOps.buildKnowledgeGraph('project-123');

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]).toBeNull();
    });
  });

  describe('performance optimization', () => {
    it('should complete analytics operations within reasonable time', async () => {
      const startTime = Date.now();
      
      await analyticsOps.calculateGraphMetrics('project-123');
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should efficiently process large datasets', async () => {
      const largeResultSet = Array.from({ length: 10000 }, (_, i) => ({
        get: jest.fn().mockReturnValue({ id: `node-${i}`, type: 'Task' })
      }));

      mockResult.records = largeResultSet;

      const startTime = Date.now();
      const result = await analyticsOps.buildKnowledgeGraph('large-project');
      const duration = Date.now() - startTime;

      expect(result.nodes).toHaveLength(10000);
      expect(duration).toBeLessThan(5000); // Should handle large datasets efficiently
    });

    it('should optimize concurrent analytics operations', async () => {
      const promises = [
        analyticsOps.calculateGraphMetrics('project-1'),
        analyticsOps.analyzeFailurePatterns('project-2', 7),
        analyticsOps.measureAgentEfficiency('project-3')
      ];

      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(3000); // Should handle concurrency efficiently
    });
  });
});