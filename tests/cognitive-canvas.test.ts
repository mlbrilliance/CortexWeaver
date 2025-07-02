import { CognitiveCanvas } from '../src/cognitive-canvas';
import neo4j, { Driver, Session } from 'neo4j-driver';

// Mock Neo4j driver and fs
jest.mock('neo4j-driver');
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  readdir: jest.fn(),
  access: jest.fn(),
}));

// Import the mocked fs module
const fs = require('fs/promises');

describe('CognitiveCanvas', () => {
  let cognitiveCanvas: CognitiveCanvas;
  let mockDriver: jest.Mocked<Driver>;
  let mockSession: jest.Mocked<Session>;

  beforeEach(() => {
    mockSession = {
      run: jest.fn(),
      close: jest.fn(),
    } as any;

    mockDriver = {
      session: jest.fn().mockReturnValue(mockSession),
      close: jest.fn(),
    } as any;

    // Reset all fs mocks
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
    fs.readFile.mockResolvedValue('{}');
    fs.readdir.mockResolvedValue([]);
    fs.access.mockResolvedValue(undefined);

    (neo4j.driver as jest.Mock).mockReturnValue(mockDriver);
    
    cognitiveCanvas = new CognitiveCanvas({
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'password'
    }, './test-snapshots');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create a new CognitiveCanvas instance', () => {
      expect(cognitiveCanvas).toBeInstanceOf(CognitiveCanvas);
      expect(neo4j.driver).toHaveBeenCalledWith(
        'bolt://localhost:7687',
        neo4j.auth.basic('neo4j', 'password')
      );
    });

    it('should initialize schema constraints', async () => {
      mockSession.run.mockResolvedValue({ records: [] } as any);

      await cognitiveCanvas.initializeSchema();

      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE'
      );
      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE CONSTRAINT task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE'
      );
      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE CONSTRAINT agent_id IF NOT EXISTS FOR (a:Agent) REQUIRE a.id IS UNIQUE'
      );
      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE CONSTRAINT pheromone_id IF NOT EXISTS FOR (ph:Pheromone) REQUIRE ph.id IS UNIQUE'
      );
      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE CONSTRAINT guide_pheromone_id IF NOT EXISTS FOR (gp:guide_pheromone) REQUIRE gp.id IS UNIQUE'
      );
      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE CONSTRAINT warn_pheromone_id IF NOT EXISTS FOR (wp:warn_pheromone) REQUIRE wp.id IS UNIQUE'
      );
      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE CONSTRAINT contract_id IF NOT EXISTS FOR (c:Contract) REQUIRE c.id IS UNIQUE'
      );
      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE CONSTRAINT code_module_id IF NOT EXISTS FOR (cm:CodeModule) REQUIRE cm.id IS UNIQUE'
      );
      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE CONSTRAINT test_id IF NOT EXISTS FOR (t:Test) REQUIRE t.id IS UNIQUE'
      );
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should handle schema initialization errors gracefully', async () => {
      mockSession.run.mockRejectedValue(new Error('Schema creation failed'));

      await expect(cognitiveCanvas.initializeSchema()).rejects.toThrow('Schema creation failed');
      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('project management', () => {
    it('should create a new project node', async () => {
      const projectData = {
        id: 'project-1',
        name: 'Test Project',
        description: 'A test project',
        status: 'active',
        createdAt: new Date().toISOString()
      };

      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            properties: projectData
          })
        }]
      } as any);

      const result = await cognitiveCanvas.createProject(projectData);

      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE (p:Project {id: $id, name: $name, description: $description, status: $status, createdAt: $createdAt}) RETURN p',
        projectData
      );
      expect(result).toEqual(projectData);
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should retrieve a project by id', async () => {
      const projectData = {
        id: 'project-1',
        name: 'Test Project',
        description: 'A test project',
        status: 'active'
      };

      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            properties: projectData
          })
        }]
      } as any);

      const result = await cognitiveCanvas.getProject('project-1');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (p:Project {id: $id}) RETURN p',
        { id: 'project-1' }
      );
      expect(result).toEqual(projectData);
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should return null when project not found', async () => {
      mockSession.run.mockResolvedValue({ records: [] } as any);

      const result = await cognitiveCanvas.getProject('nonexistent');

      expect(result).toBeNull();
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should update project status', async () => {
      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            properties: { id: 'project-1', status: 'completed' }
          })
        }]
      } as any);

      const result = await cognitiveCanvas.updateProjectStatus('project-1', 'completed');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (p:Project {id: $id}) SET p.status = $status, p.updatedAt = $updatedAt RETURN p',
        expect.objectContaining({
          id: 'project-1',
          status: 'completed',
          updatedAt: expect.any(String)
        })
      );
      expect(result.status).toBe('completed');
      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('task management', () => {
    it('should create a new task node', async () => {
      const taskData = {
        id: 'task-1',
        title: 'Test Task',
        description: 'A test task',
        status: 'pending',
        priority: 'high',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            properties: taskData
          })
        }]
      } as any);

      const result = await cognitiveCanvas.createTask(taskData);

      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE (t:Task {id: $id, title: $title, description: $description, status: $status, priority: $priority, projectId: $projectId, createdAt: $createdAt}) RETURN t',
        taskData
      );
      expect(result).toEqual(taskData);
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should create task dependencies', async () => {
      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            type: 'DEPENDS_ON'
          })
        }]
      } as any);

      await cognitiveCanvas.createTaskDependency('task-1', 'task-2');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (t1:Task {id: $fromTaskId}), (t2:Task {id: $toTaskId}) CREATE (t1)-[r:DEPENDS_ON]->(t2) RETURN r',
        { fromTaskId: 'task-1', toTaskId: 'task-2' }
      );
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should retrieve tasks by project', async () => {
      const tasks = [
        { properties: { id: 'task-1', title: 'Task 1' } },
        { properties: { id: 'task-2', title: 'Task 2' } }
      ];

      mockSession.run.mockResolvedValue({
        records: tasks.map(task => ({
          get: jest.fn().mockReturnValue(task)
        }))
      } as any);

      const result = await cognitiveCanvas.getTasksByProject('project-1');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (t:Task {projectId: $projectId}) RETURN t ORDER BY t.createdAt',
        { projectId: 'project-1' }
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'task-1', title: 'Task 1' });
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should get task dependencies', async () => {
      const dependencies = [
        { properties: { id: 'task-2', title: 'Dependency Task' } }
      ];

      mockSession.run.mockResolvedValue({
        records: dependencies.map(dep => ({
          get: jest.fn().mockReturnValue(dep)
        }))
      } as any);

      const result = await cognitiveCanvas.getTaskDependencies('task-1');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (t:Task {id: $taskId})-[:DEPENDS_ON]->(dep:Task) RETURN dep',
        { taskId: 'task-1' }
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: 'task-2', title: 'Dependency Task' });
      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('agent management', () => {
    it('should create a new agent node', async () => {
      const agentData = {
        id: 'agent-1',
        name: 'Test Agent',
        role: 'developer',
        capabilities: ['coding', 'testing'],
        status: 'active',
        createdAt: new Date().toISOString()
      };

      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            properties: agentData
          })
        }]
      } as any);

      const result = await cognitiveCanvas.createAgent(agentData);

      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE (a:Agent {id: $id, name: $name, role: $role, capabilities: $capabilities, status: $status, createdAt: $createdAt}) RETURN a',
        agentData
      );
      expect(result).toEqual(agentData);
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should assign agent to task', async () => {
      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            type: 'ASSIGNED_TO'
          })
        }]
      } as any);

      await cognitiveCanvas.assignAgentToTask('agent-1', 'task-1');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (a:Agent {id: $agentId}), (t:Task {id: $taskId}) CREATE (t)-[r:ASSIGNED_TO {assignedAt: $assignedAt}]->(a) RETURN r',
        expect.objectContaining({
          agentId: 'agent-1',
          taskId: 'task-1',
          assignedAt: expect.any(String)
        })
      );
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should get agent assignments', async () => {
      const assignments = [
        { properties: { id: 'task-1', title: 'Assigned Task' } }
      ];

      mockSession.run.mockResolvedValue({
        records: assignments.map(task => ({
          get: jest.fn().mockReturnValue(task)
        }))
      } as any);

      const result = await cognitiveCanvas.getAgentAssignments('agent-1');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (a:Agent {id: $agentId})<-[:ASSIGNED_TO]-(t:Task) RETURN t',
        { agentId: 'agent-1' }
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: 'task-1', title: 'Assigned Task' });
      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('enhanced pheromone learning system (3.0)', () => {
    const samplePattern = {
      taskOutcome: 'success' as const,
      promptPattern: 'implement unit tests for class',
      codePattern: 'Jest test framework',
      agentType: 'coder',
      complexity: 'medium' as const,
      duration: 1200,
      errorTypes: []
    };

    describe('basic pheromone creation', () => {
      it('should create a new pheromone node with enhanced structure', async () => {
        const pheromoneData = {
          id: 'pheromone-1',
          type: 'guide_pheromone',
          strength: 0.8,
          context: 'task completion',
          pattern: samplePattern,
          metadata: { taskId: 'task-1', agentId: 'agent-1' },
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          decayRate: 0.05
        };

        mockSession.run.mockResolvedValue({
          records: [{
            get: jest.fn().mockReturnValue({
              properties: pheromoneData
            })
          }]
        } as any);

        const result = await cognitiveCanvas.createPheromone(pheromoneData);

        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (ph:Pheromone:guide_pheromone'),
          expect.objectContaining({
            ...pheromoneData,
            decayRate: 0.05
          })
        );
        expect(result).toEqual(pheromoneData);
        expect(mockSession.close).toHaveBeenCalled();
      });

      it('should validate pheromone data structure', async () => {
        const invalidPheromoneData = {
          id: 'pheromone-1',
          type: 'guide_pheromone',
          strength: 1.5, // Invalid: > 1
          context: 'task completion',
          metadata: {},
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString()
        };

        await expect(cognitiveCanvas.createPheromone(invalidPheromoneData as any))
          .rejects.toThrow('Pheromone strength must be between 0 and 1');
      });

      it('should validate pattern data', async () => {
        const invalidPatternData = {
          id: 'pheromone-1',
          type: 'guide_pheromone',
          strength: 0.8,
          context: 'task completion',
          pattern: {
            taskOutcome: 'invalid_outcome', // Invalid outcome
            promptPattern: 'test pattern',
            agentType: 'coder',
            complexity: 'medium',
            duration: 1000
          },
          metadata: {},
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString()
        };

        await expect(cognitiveCanvas.createPheromone(invalidPatternData as any))
          .rejects.toThrow('Invalid task outcome');
      });
    });

    describe('specialized pheromone creation', () => {
      it('should create guide pheromone for successful patterns', async () => {
        const expectedPheromone = {
          id: expect.stringMatching(/^guide_/),
          type: 'guide_pheromone',
          strength: 0.7,
          context: 'successful testing approach',
          pattern: samplePattern,
          decayRate: 0.05,
          metadata: expect.any(Object),
          createdAt: expect.any(String),
          expiresAt: expect.any(String)
        };
        
        mockSession.run.mockResolvedValue({
          records: [{
            get: jest.fn().mockReturnValue({
              properties: expectedPheromone
            })
          }]
        } as any);

        const result = await cognitiveCanvas.createGuidePheromone(
          'successful testing approach',
          samplePattern,
          0.7
        );

        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (ph:Pheromone:guide_pheromone'),
          expect.objectContaining({
            type: 'guide_pheromone',
            strength: 0.7,
            context: 'successful testing approach',
            pattern: samplePattern,
            decayRate: 0.05
          })
        );
        expect(result).toEqual(expectedPheromone);
        expect(mockSession.close).toHaveBeenCalled();
      });

      it('should create warn pheromone for failed patterns', async () => {
        const failurePattern = {
          ...samplePattern,
          taskOutcome: 'failure' as const,
          errorTypes: ['timeout', 'compilation_error']
        };

        const expectedWarnPheromone = {
          id: expect.stringMatching(/^warn_/),
          type: 'warn_pheromone',
          strength: 0.8,
          context: 'problematic approach',
          pattern: failurePattern,
          decayRate: 0.15,
          metadata: expect.any(Object),
          createdAt: expect.any(String),
          expiresAt: expect.any(String)
        };

        mockSession.run.mockResolvedValue({
          records: [{
            get: jest.fn().mockReturnValue({
              properties: expectedWarnPheromone
            })
          }]
        } as any);

        const result = await cognitiveCanvas.createWarnPheromone(
          'problematic approach',
          failurePattern,
          0.8
        );

        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (ph:Pheromone:warn_pheromone'),
          expect.objectContaining({
            type: 'warn_pheromone',
            strength: 0.8,
            context: 'problematic approach',
            pattern: failurePattern,
            decayRate: 0.15
          })
        );
        expect(result).toEqual(expectedWarnPheromone);
        expect(mockSession.close).toHaveBeenCalled();
      });
    });

    describe('advanced querying', () => {
      it('should query pheromones with complex filters', async () => {
        const mockPheromones = [
          { properties: { id: 'ph-1', type: 'guide_pheromone', strength: 0.8, pattern: { agentType: 'coder' } } },
          { properties: { id: 'ph-2', type: 'guide_pheromone', strength: 0.6, pattern: { agentType: 'coder' } } }
        ];

        mockSession.run.mockResolvedValue({
          records: mockPheromones.map(ph => ({
            get: jest.fn().mockReturnValue(ph)
          }))
        } as any);

        const result = await cognitiveCanvas.queryPheromones({
          type: 'guide_pheromone',
          agentType: 'coder',
          minStrength: 0.5,
          limit: 10
        });

        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (ph:Pheromone)'),
          expect.objectContaining({
            type: 'guide_pheromone',
            agentType: 'coder',
            minStrength: 0.5,
            limit: 10,
            now: expect.any(String)
          })
        );
        expect(result).toHaveLength(2);
        expect(mockSession.close).toHaveBeenCalled();
      });

      it('should get context-relevant pheromones for orchestrator', async () => {
        const mockGuides = [
          { properties: { id: 'guide-1', type: 'guide_pheromone', pattern: { agentType: 'coder', complexity: 'medium' } } }
        ];
        const mockWarnings = [
          { properties: { id: 'warn-1', type: 'warn_pheromone', pattern: { agentType: 'coder', complexity: 'medium' } } }
        ];

        mockSession.run
          .mockResolvedValueOnce({
            records: mockGuides.map(ph => ({ get: jest.fn().mockReturnValue(ph) }))
          } as any)
          .mockResolvedValueOnce({
            records: mockWarnings.map(ph => ({ get: jest.fn().mockReturnValue(ph) }))
          } as any);

        const result = await cognitiveCanvas.getContextPheromones(
          'coder',
          'implement unit tests',
          'medium'
        );

        expect(result.guides).toHaveLength(1);
        expect(result.warnings).toHaveLength(1);
        expect(result.guides[0].pattern?.agentType).toBe('coder');
        expect(mockSession.close).toHaveBeenCalledTimes(2);
      });
    });

    describe('pattern analysis and correlations', () => {
      it('should analyze pattern correlations', async () => {
        // Mock the record object with proper get method that returns correct values
        const mockRecord = {
          get: jest.fn((key: string) => {
            switch (key) {
              case 'ph': return { properties: { id: 'ph-1' } };
              case 'pattern': return samplePattern;
              case 'promptPatterns': return ['test pattern 1', 'test pattern 2'];
              case 'frequency': return 5;
              case 'successRate': return 0.8;
              default: return null;
            }
          })
        };
        
        const mockCorrelationData = [mockRecord];

        mockSession.run.mockResolvedValue({
          records: mockCorrelationData
        } as any);

        const result = await cognitiveCanvas.analyzePatternCorrelations('coder');

        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (ph:Pheromone)'),
          expect.objectContaining({
            agentType: 'coder',
            now: expect.any(String)
          })
        );
        expect(result).toHaveLength(1);
        expect(result[0].pheromoneId).toBe('ph-1');
        expect(result[0].correlationScore).toBe(0.4); // 0.8 * Math.min(5/10, 1) = 0.8 * 0.5 = 0.4
        expect(mockSession.close).toHaveBeenCalled();
      });

      it('should perform temporal analysis of patterns', async () => {
        const mockTemporalData = [
          {
            get: jest.fn()
              .mockReturnValueOnce(samplePattern)
              .mockReturnValueOnce(3)
              .mockReturnValueOnce(0.9)
              .mockReturnValueOnce('2024-01-01T00:00:00Z')
              .mockReturnValueOnce('2024-01-03T00:00:00Z')
          }
        ];

        mockSession.run.mockResolvedValue({
          records: mockTemporalData
        } as any);

        const result = await cognitiveCanvas.analyzeTemporalPatterns('coder');

        expect(result).toHaveLength(1);
        expect(result[0].pattern).toEqual(samplePattern);
        expect(result[0].frequency).toBe(3);
        expect(result[0].successRate).toBe(0.9);
        expect(result[0].evolutionTrend).toBe('improving');
        expect(mockSession.close).toHaveBeenCalled();
      });

      it('should provide comprehensive pheromone analysis', async () => {
        const mockStatsData = [
          {
            get: jest.fn()
              .mockReturnValueOnce(10)   // totalPheromones
              .mockReturnValueOnce(6)    // guidePheromones
              .mockReturnValueOnce(4)    // warnPheromones
              .mockReturnValueOnce(0.7)  // avgStrength
          }
        ];

        mockSession.run.mockResolvedValueOnce({
          records: mockStatsData
        } as any);

        // Mock correlation analysis
        jest.spyOn(cognitiveCanvas, 'analyzePatternCorrelations').mockResolvedValue([
          {
            pheromoneId: 'ph-1',
            correlatedPatterns: [samplePattern],
            correlationScore: 0.8,
            temporalTrend: 'increasing',
            recommendations: ['replicate pattern']
          }
        ]);

        // Mock temporal analysis
        jest.spyOn(cognitiveCanvas, 'analyzeTemporalPatterns').mockResolvedValue([
          {
            pattern: samplePattern,
            frequency: 5,
            successRate: 0.9,
            evolutionTrend: 'improving',
            timeframe: { start: '2024-01-01T00:00:00Z', end: '2024-01-07T00:00:00Z' }
          }
        ]);

        const result = await cognitiveCanvas.getPheromoneAnalysis('coder');

        expect(result.totalPheromones).toBe(10);
        expect(result.guidePheromones).toBe(6);
        expect(result.warnPheromones).toBe(4);
        expect(result.avgStrength).toBe(0.7);
        expect(result.correlations).toHaveLength(1);
        expect(result.temporalInsights).toHaveLength(1);
      });
    });

    describe('pheromone decay and lifecycle', () => {
      it('should apply pheromone decay correctly', async () => {
        mockSession.run
          .mockResolvedValueOnce({
            records: [{ get: jest.fn().mockReturnValue(5) }]
          } as any)
          .mockResolvedValueOnce({
            records: [{ get: jest.fn().mockReturnValue(2) }]
          } as any);

        const result = await cognitiveCanvas.applyPheromoneDecay();

        expect(result.updated).toBe(5);
        expect(result.expired).toBe(2);
        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('SET ph.strength = ph.strength * (1 - ph.decayRate)'),
          expect.any(Object)
        );
        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('ph.expiresAt <= $now OR ph.strength <= 0.1'),
          expect.any(Object)
        );
        expect(mockSession.close).toHaveBeenCalledTimes(2);
      });

      it('should link pheromone to task with influence type', async () => {
        mockSession.run.mockResolvedValue({
          records: [{
            get: jest.fn().mockReturnValue({
              type: 'INFLUENCES'
            })
          }]
        } as any);

        await cognitiveCanvas.linkPheromoneToTask('pheromone-1', 'task-1', 'negative');

        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (ph)-[r:INFLUENCES {type: $influence'),
          expect.objectContaining({
            pheromoneId: 'pheromone-1',
            taskId: 'task-1',
            influence: 'negative',
            createdAt: expect.any(String)
          })
        );
        expect(mockSession.close).toHaveBeenCalled();
      });
    });

    describe('backwards compatibility', () => {
      it('should maintain compatibility with legacy pheromone queries', async () => {
        const legacyPheromones = [
          { properties: { id: 'legacy-1', type: 'success', strength: 0.8 } }
        ];

        // Mock the new queryPheromones method which getPheromonesByType now uses
        jest.spyOn(cognitiveCanvas, 'queryPheromones').mockResolvedValue(
          legacyPheromones.map(ph => ph.properties as any)
        );

        const result = await cognitiveCanvas.getPheromonesByType('success');

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('legacy-1');
      });

      it('should handle legacy pheromone types with warning', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        const legacyPheromoneData = {
          id: 'legacy-1',
          type: 'success', // Legacy type
          strength: 0.8,
          context: 'legacy context',
          metadata: {},
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString()
        };

        mockSession.run.mockResolvedValue({
          records: [{
            get: jest.fn().mockReturnValue({
              properties: legacyPheromoneData
            })
          }]
        } as any);

        await cognitiveCanvas.createPheromone(legacyPheromoneData);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Using legacy pheromone type: success')
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe('error handling', () => {
      it('should handle malformed pheromone data gracefully', async () => {
        const malformedData = {
          id: 'bad-pheromone',
          // Missing required fields
          strength: 0.8
        };

        await expect(cognitiveCanvas.createPheromone(malformedData as any))
          .rejects.toThrow('Missing required pheromone fields');
      });

      it('should handle database errors in pattern analysis', async () => {
        mockSession.run.mockRejectedValue(new Error('Database connection failed'));

        await expect(cognitiveCanvas.analyzePatternCorrelations())
          .rejects.toThrow('Database connection failed');
        
        expect(mockSession.close).toHaveBeenCalled();
      });

      it('should handle empty results in temporal analysis', async () => {
        mockSession.run.mockResolvedValue({
          records: []
        } as any);

        const result = await cognitiveCanvas.analyzeTemporalPatterns('nonexistent-agent');

        expect(result).toEqual([]);
        expect(mockSession.close).toHaveBeenCalled();
      });
    });

    describe('orchestrator integration', () => {
      it('should support Orchestrator context priming with enhanced pheromones', async () => {
        // Mock context pheromones response
        const mockGuides = [
          { properties: { id: 'guide-1', type: 'guide_pheromone', strength: 0.9, pattern: { agentType: 'coder', complexity: 'medium' } } }
        ];
        const mockWarnings = [
          { properties: { id: 'warn-1', type: 'warn_pheromone', strength: 0.8, pattern: { agentType: 'coder', complexity: 'medium' } } }
        ];

        mockSession.run
          .mockResolvedValueOnce({
            records: mockGuides.map(ph => ({ get: jest.fn().mockReturnValue(ph) }))
          } as any)
          .mockResolvedValueOnce({
            records: mockWarnings.map(ph => ({ get: jest.fn().mockReturnValue(ph) }))
          } as any);

        const result = await cognitiveCanvas.getContextPheromones(
          'coder',
          'implement unit tests for authentication',
          'medium'
        );

        expect(result.guides).toHaveLength(1);
        expect(result.warnings).toHaveLength(1);
        expect(result.guides[0].type).toBe('guide_pheromone');
        expect(result.warnings[0].type).toBe('warn_pheromone');
        expect(mockSession.close).toHaveBeenCalledTimes(2);
      });

      it('should create learning patterns from task outcomes', async () => {
        const successPattern = {
          taskOutcome: 'success' as const,
          promptPattern: 'implement unit tests with mocking',
          codePattern: 'Jest with @jest/globals',
          agentType: 'coder',
          complexity: 'medium' as const,
          duration: 1800,
          errorTypes: []
        };

        const expectedGuidePheromone = {
          id: expect.stringMatching(/^guide_/),
          type: 'guide_pheromone',
          strength: 0.8,
          context: 'successful testing implementation',
          pattern: successPattern,
          decayRate: 0.05,
          metadata: expect.objectContaining({
            successPattern: true,
            agentType: 'coder'
          }),
          createdAt: expect.any(String),
          expiresAt: expect.any(String)
        };

        mockSession.run.mockResolvedValue({
          records: [{
            get: jest.fn().mockReturnValue({
              properties: expectedGuidePheromone
            })
          }]
        } as any);

        const result = await cognitiveCanvas.createGuidePheromone(
          'successful testing implementation',
          successPattern,
          0.8
        );

        expect(result).toEqual(expectedGuidePheromone);
        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (ph:Pheromone:guide_pheromone'),
          expect.objectContaining({
            type: 'guide_pheromone',
            pattern: successPattern,
            decayRate: 0.05
          })
        );
      });

      it('should provide pattern evolution insights for agent improvement', async () => {
        const mockEvolutionData = [
          {
            get: jest.fn()
              .mockReturnValueOnce(samplePattern)
              .mockReturnValueOnce(10)
              .mockReturnValueOnce(0.85)
              .mockReturnValueOnce('2024-01-01T00:00:00Z')
              .mockReturnValueOnce('2024-01-07T00:00:00Z')
          }
        ];

        mockSession.run.mockResolvedValue({
          records: mockEvolutionData
        } as any);

        const insights = await cognitiveCanvas.analyzeTemporalPatterns('coder', 604800000);

        expect(insights).toHaveLength(1);
        expect(insights[0].evolutionTrend).toBe('improving');
        expect(insights[0].frequency).toBe(10);
        expect(insights[0].successRate).toBe(0.85);
        expect(insights[0].pattern).toEqual(samplePattern);
      });
    });
  });

  describe('architectural decisions', () => {
    it('should store architectural decision', async () => {
      const decisionData = {
        id: 'decision-1',
        title: 'Use TypeScript',
        description: 'Decision to use TypeScript for the project',
        rationale: 'Better type safety and developer experience',
        status: 'accepted',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            properties: decisionData
          })
        }]
      } as any);

      const result = await cognitiveCanvas.storeArchitecturalDecision(decisionData);

      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE (ad:ArchitecturalDecision {id: $id, title: $title, description: $description, rationale: $rationale, status: $status, projectId: $projectId, createdAt: $createdAt}) RETURN ad',
        decisionData
      );
      expect(result).toEqual(decisionData);
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should get architectural decisions by project', async () => {
      const decisions = [
        { properties: { id: 'decision-1', title: 'Use TypeScript' } },
        { properties: { id: 'decision-2', title: 'Use React' } }
      ];

      mockSession.run.mockResolvedValue({
        records: decisions.map(decision => ({
          get: jest.fn().mockReturnValue(decision)
        }))
      } as any);

      const result = await cognitiveCanvas.getArchitecturalDecisionsByProject('project-1');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (ad:ArchitecturalDecision {projectId: $projectId}) RETURN ad ORDER BY ad.createdAt DESC',
        { projectId: 'project-1' }
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'decision-1', title: 'Use TypeScript' });
      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('contract management', () => {
    it('should create a new contract node', async () => {
      const contractData = {
        id: 'contract-1',
        name: 'User API Contract',
        type: 'openapi' as const,
        version: '1.0.0',
        specification: {
          openapi: '3.0.0',
          paths: {
            '/users': {
              get: { summary: 'Get users' }
            }
          }
        },
        description: 'API contract for user management',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            properties: contractData
          })
        }]
      } as any);

      const result = await cognitiveCanvas.createContract(contractData);

      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE (c:Contract {id: $id, name: $name, type: $type, version: $version, specification: $specification, description: $description, projectId: $projectId, createdAt: $createdAt}) RETURN c',
        contractData
      );
      expect(result).toEqual(contractData);
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should retrieve a contract by id', async () => {
      const contractData = {
        id: 'contract-1',
        name: 'User API Contract',
        type: 'openapi'
      };

      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            properties: contractData
          })
        }]
      } as any);

      const result = await cognitiveCanvas.getContract('contract-1');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (c:Contract {id: $id}) RETURN c',
        { id: 'contract-1' }
      );
      expect(result).toEqual(contractData);
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should update contract', async () => {
      const updates = { version: '1.1.0', description: 'Updated description' };
      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            properties: { id: 'contract-1', ...updates }
          })
        }]
      } as any);

      const result = await cognitiveCanvas.updateContract('contract-1', updates);

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (c:Contract {id: $id}) SET c += $updates RETURN c',
        expect.objectContaining({
          id: 'contract-1',
          updates: expect.objectContaining(updates)
        })
      );
      expect(result).toEqual(expect.objectContaining(updates));
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should get contracts by project', async () => {
      const contracts = [
        { properties: { id: 'contract-1', name: 'Contract 1' } },
        { properties: { id: 'contract-2', name: 'Contract 2' } }
      ];

      mockSession.run.mockResolvedValue({
        records: contracts.map(contract => ({
          get: jest.fn().mockReturnValue(contract)
        }))
      } as any);

      const result = await cognitiveCanvas.getContractsByProject('project-1');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (c:Contract {projectId: $projectId}) RETURN c ORDER BY c.createdAt',
        { projectId: 'project-1' }
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'contract-1', name: 'Contract 1' });
      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('code module management', () => {
    it('should create a new code module node', async () => {
      const moduleData = {
        id: 'module-1',
        name: 'UserService',
        filePath: '/src/services/UserService.ts',
        type: 'class' as const,
        language: 'typescript',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            properties: moduleData
          })
        }]
      } as any);

      const result = await cognitiveCanvas.createCodeModule(moduleData);

      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE (cm:CodeModule {id: $id, name: $name, filePath: $filePath, type: $type, language: $language, projectId: $projectId, createdAt: $createdAt}) RETURN cm',
        moduleData
      );
      expect(result).toEqual(moduleData);
      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('test management', () => {
    it('should create a new test node', async () => {
      const testData = {
        id: 'test-1',
        name: 'UserService Tests',
        filePath: '/src/tests/UserService.test.ts',
        type: 'unit' as const,
        framework: 'jest',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            properties: testData
          })
        }]
      } as any);

      const result = await cognitiveCanvas.createTest(testData);

      expect(mockSession.run).toHaveBeenCalledWith(
        'CREATE (t:Test {id: $id, name: $name, filePath: $filePath, type: $type, framework: $framework, projectId: $projectId, createdAt: $createdAt}) RETURN t',
        testData
      );
      expect(result).toEqual(testData);
      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('contract relationships', () => {
    it('should link contract to feature', async () => {
      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            type: 'DEFINES'
          })
        }]
      } as any);

      await cognitiveCanvas.linkContractToFeature('contract-1', 'task-1');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (c:Contract {id: $contractId}), (f:Task {id: $featureId}) CREATE (c)-[r:DEFINES {linkedAt: $linkedAt}]->(f) RETURN r',
        expect.objectContaining({
          contractId: 'contract-1',
          featureId: 'task-1',
          linkedAt: expect.any(String)
        })
      );
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should link contract to code module', async () => {
      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            type: 'IMPLEMENTS'
          })
        }]
      } as any);

      await cognitiveCanvas.linkContractToCodeModule('contract-1', 'module-1', 'IMPLEMENTS');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (c:Contract {id: $contractId}), (cm:CodeModule {id: $codeModuleId}) CREATE (cm)-[r:IMPLEMENTS {linkedAt: $linkedAt}]->(c) RETURN r',
        expect.objectContaining({
          contractId: 'contract-1',
          codeModuleId: 'module-1',
          linkedAt: expect.any(String)
        })
      );
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should link contract to test', async () => {
      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            type: 'VALIDATES'
          })
        }]
      } as any);

      await cognitiveCanvas.linkContractToTest('contract-1', 'test-1', 'VALIDATES');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (c:Contract {id: $contractId}), (t:Test {id: $testId}) CREATE (t)-[r:VALIDATES {linkedAt: $linkedAt}]->(c) RETURN r',
        expect.objectContaining({
          contractId: 'contract-1',
          testId: 'test-1',
          linkedAt: expect.any(String)
        })
      );
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should link OpenAPI endpoint to function', async () => {
      mockSession.run.mockResolvedValue({
        records: [{
          get: jest.fn().mockReturnValue({
            type: 'IMPLEMENTS_ENDPOINT'
          })
        }]
      } as any);

      await cognitiveCanvas.linkOpenAPIEndpointToFunction('contract-1', '/users', 'GET', 'module-1', 'getUsers');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (c:Contract {id: $contractId}), (cm:CodeModule {id: $codeModuleId}) CREATE (cm)-[r:IMPLEMENTS_ENDPOINT {endpointPath: $endpointPath, httpMethod: $httpMethod, functionName: $functionName, linkedAt: $linkedAt}]->(c) RETURN r',
        expect.objectContaining({
          contractId: 'contract-1',
          endpointPath: '/users',
          httpMethod: 'GET',
          codeModuleId: 'module-1',
          functionName: 'getUsers',
          linkedAt: expect.any(String)
        })
      );
      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('contract queries', () => {
    it('should get contract implementations', async () => {
      const implementations = [
        { properties: { id: 'module-1', name: 'UserService' } },
        { properties: { id: 'module-2', name: 'UserController' } }
      ];

      mockSession.run.mockResolvedValue({
        records: implementations.map(impl => ({
          get: jest.fn().mockReturnValue(impl)
        }))
      } as any);

      const result = await cognitiveCanvas.getContractImplementations('contract-1');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (c:Contract {id: $contractId})<-[:IMPLEMENTS|USES]-(cm:CodeModule) RETURN cm',
        { contractId: 'contract-1' }
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'module-1', name: 'UserService' });
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should get contract tests', async () => {
      const tests = [
        { properties: { id: 'test-1', name: 'Contract Test 1' } }
      ];

      mockSession.run.mockResolvedValue({
        records: tests.map(test => ({
          get: jest.fn().mockReturnValue(test)
        }))
      } as any);

      const result = await cognitiveCanvas.getContractTests('contract-1');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (c:Contract {id: $contractId})<-[:VALIDATES|TESTS|TESTS_ENDPOINT]-(t:Test) RETURN t',
        { contractId: 'contract-1' }
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: 'test-1', name: 'Contract Test 1' });
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should get endpoint implementations', async () => {
      const mockRecord = {
        get: jest.fn()
          .mockReturnValueOnce({ properties: { id: 'module-1', name: 'UserController' } })
          .mockReturnValueOnce('getUsers')
      };

      mockSession.run.mockResolvedValue({
        records: [mockRecord]
      } as any);

      const result = await cognitiveCanvas.getEndpointImplementations('contract-1', '/users', 'GET');

      expect(mockSession.run).toHaveBeenCalledWith(
        'MATCH (c:Contract {id: $contractId})<-[r:IMPLEMENTS_ENDPOINT {endpointPath: $endpointPath, httpMethod: $httpMethod}]-(cm:CodeModule) RETURN cm, r.functionName as functionName',
        { contractId: 'contract-1', endpointPath: '/users', httpMethod: 'GET' }
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        module: { id: 'module-1', name: 'UserController' },
        functionName: 'getUsers'
      });
      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('knowledge queries', () => {
    it('should get project knowledge graph', async () => {
      const knowledgeGraph = {
        project: { properties: { id: 'project-1', name: 'Test Project' } },
        tasks: [{ properties: { id: 'task-1', title: 'Task 1' } }],
        agents: [{ properties: { id: 'agent-1', name: 'Agent 1' } }],
        pheromones: [{ properties: { id: 'pheromone-1', type: 'success' } }],
        decisions: [{ properties: { id: 'decision-1', title: 'Decision 1' } }],
        contracts: [{ properties: { id: 'contract-1', name: 'Contract 1' } }],
        codeModules: [{ properties: { id: 'module-1', name: 'Module 1' } }],
        tests: [{ properties: { id: 'test-1', name: 'Test 1' } }]
      };

      mockSession.run
        .mockResolvedValueOnce({
          records: [{ get: jest.fn().mockReturnValue(knowledgeGraph.project) }]
        } as any)
        .mockResolvedValueOnce({
          records: knowledgeGraph.tasks.map(task => ({ get: jest.fn().mockReturnValue(task) }))
        } as any)
        .mockResolvedValueOnce({
          records: knowledgeGraph.agents.map(agent => ({ get: jest.fn().mockReturnValue(agent) }))
        } as any)
        .mockResolvedValueOnce({
          records: knowledgeGraph.pheromones.map(ph => ({ get: jest.fn().mockReturnValue(ph) }))
        } as any)
        .mockResolvedValueOnce({
          records: knowledgeGraph.decisions.map(decision => ({ get: jest.fn().mockReturnValue(decision) }))
        } as any)
        .mockResolvedValueOnce({
          records: knowledgeGraph.contracts.map(contract => ({ get: jest.fn().mockReturnValue(contract) }))
        } as any)
        .mockResolvedValueOnce({
          records: knowledgeGraph.codeModules.map(module => ({ get: jest.fn().mockReturnValue(module) }))
        } as any)
        .mockResolvedValueOnce({
          records: knowledgeGraph.tests.map(test => ({ get: jest.fn().mockReturnValue(test) }))
        } as any);

      const result = await cognitiveCanvas.getProjectKnowledgeGraph('project-1');

      expect(result).toEqual({
        project: knowledgeGraph.project.properties,
        tasks: [knowledgeGraph.tasks[0].properties],
        agents: [knowledgeGraph.agents[0].properties],
        pheromones: [knowledgeGraph.pheromones[0].properties],
        decisions: [knowledgeGraph.decisions[0].properties],
        contracts: [knowledgeGraph.contracts[0].properties],
        codeModules: [knowledgeGraph.codeModules[0].properties],
        tests: [knowledgeGraph.tests[0].properties]
      });
      expect(mockSession.close).toHaveBeenCalledTimes(8);
    });

    it('should find similar tasks', async () => {
      const mockRecord = {
        get: jest.fn()
          .mockReturnValueOnce({ properties: { id: 'task-2', title: 'Similar Task' } })
          .mockReturnValueOnce(0.8)
      };

      mockSession.run.mockResolvedValue({
        records: [mockRecord]
      } as any);

      const result = await cognitiveCanvas.findSimilarTasks('task-1', ['keyword1', 'keyword2']);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (t1:Task {id: $taskId})'),
        expect.objectContaining({
          taskId: 'task-1',
          keywords: ['keyword1', 'keyword2']
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: 'task-2', title: 'Similar Task', similarity: 0.8 });
      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      mockSession.run.mockRejectedValue(new Error('Connection failed'));

      await expect(cognitiveCanvas.getProject('project-1')).rejects.toThrow('Connection failed');
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should handle malformed data gracefully', async () => {
      const invalidProjectData = {
        // Missing required fields
        name: 'Test Project'
      };

      await expect(cognitiveCanvas.createProject(invalidProjectData as any)).rejects.toThrow();
    });

    it('should validate required fields', async () => {
      const incompleteTaskData = {
        title: 'Test Task'
        // Missing required fields
      };

      await expect(cognitiveCanvas.createTask(incompleteTaskData as any)).rejects.toThrow();
    });

    it('should validate contract data', async () => {
      const invalidContractData = {
        id: 'contract-1',
        name: 'Test Contract',
        type: 'invalid-type', // Invalid type
        version: '1.0.0',
        specification: {},
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await expect(cognitiveCanvas.createContract(invalidContractData as any)).rejects.toThrow('Invalid contract type');
    });

    it('should validate code module data', async () => {
      const invalidModuleData = {
        id: 'module-1',
        name: 'Test Module',
        filePath: '/test.ts',
        type: 'invalid-type', // Invalid type
        language: 'typescript',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await expect(cognitiveCanvas.createCodeModule(invalidModuleData as any)).rejects.toThrow('Invalid code module type');
    });

    it('should validate test data', async () => {
      const invalidTestData = {
        id: 'test-1',
        name: 'Test',
        filePath: '/test.test.ts',
        type: 'invalid-type', // Invalid type
        framework: 'jest',
        projectId: 'project-1',
        createdAt: new Date().toISOString()
      };

      await expect(cognitiveCanvas.createTest(invalidTestData as any)).rejects.toThrow('Invalid test type');
    });
  });

  describe('cleanup', () => {
    it('should close driver connection', async () => {
      await cognitiveCanvas.close();
      expect(mockDriver.close).toHaveBeenCalled();
    });
  });

  describe('snapshot functionality', () => {
    const sampleSnapshot = {
      version: '1.0.0',
      timestamp: '2024-01-01T00:00:00.000Z',
      metadata: {
        totalNodes: 5,
        totalRelationships: 3,
        nodeTypes: { Project: 1, Task: 2, Agent: 1, Pheromone: 1 }
      },
      nodes: [
        {
          id: '1',
          labels: ['Project'],
          properties: { id: 'proj-1', name: 'Test Project', status: 'active' }
        },
        {
          id: '2', 
          labels: ['Task'],
          properties: { id: 'task-1', title: 'Test Task', projectId: 'proj-1' }
        }
      ],
      relationships: [
        {
          id: '1',
          startNode: '2',
          endNode: '1',
          type: 'BELONGS_TO',
          properties: {}
        }
      ]
    };

    describe('saveSnapshot', () => {
      it('should save complete graph snapshot to file', async () => {
        // Mock database query results
        mockSession.run
          .mockResolvedValueOnce({
            records: [
              {
                get: jest.fn().mockReturnValueOnce({
                  identity: { low: 1, high: 0 },
                  labels: ['Project'],
                  properties: { id: 'proj-1', name: 'Test Project' }
                })
              }
            ]
          } as any)
          .mockResolvedValueOnce({
            records: [
              {
                get: jest.fn()
                  .mockReturnValueOnce({ identity: { low: 1, high: 0 } })
                  .mockReturnValueOnce({ identity: { low: 2, high: 0 } })
                  .mockReturnValueOnce('BELONGS_TO')
                  .mockReturnValueOnce({})
              }
            ]
          } as any);

        await cognitiveCanvas.saveSnapshot('./test-snapshots/test.json');

        expect(fs.mkdir).toHaveBeenCalledWith('./test-snapshots', { recursive: true });
        expect(fs.writeFile).toHaveBeenCalledWith(
          './test-snapshots/test.json',
          expect.stringContaining('"version": "1.0.0"'),
          'utf8'
        );
        expect(mockSession.close).toHaveBeenCalledTimes(2);
      });

      it('should handle empty database gracefully', async () => {
        mockSession.run
          .mockResolvedValueOnce({ records: [] } as any)
          .mockResolvedValueOnce({ records: [] } as any);

        await cognitiveCanvas.saveSnapshot('./test-snapshots/empty.json');

        expect(fs.writeFile).toHaveBeenCalledWith(
          './test-snapshots/empty.json',
          expect.stringContaining('"totalNodes": 0'),
          'utf8'
        );
      });

      it('should create snapshots directory if it does not exist', async () => {
        mockSession.run
          .mockResolvedValueOnce({ records: [] } as any)
          .mockResolvedValueOnce({ records: [] } as any);

        await cognitiveCanvas.saveSnapshot('./new-dir/snapshot.json');

        expect(fs.mkdir).toHaveBeenCalledWith('./new-dir', { recursive: true });
      });
    });

    describe('loadSnapshot', () => {
      it('should load snapshot and restore all nodes and relationships', async () => {
        fs.readFile.mockResolvedValue(JSON.stringify(sampleSnapshot));
        mockSession.run.mockResolvedValue({ records: [] } as any);

        await cognitiveCanvas.loadSnapshot('./test-snapshots/test.json');

        expect(fs.readFile).toHaveBeenCalledWith('./test-snapshots/test.json', 'utf8');
        
        // Should clear existing data first
        expect(mockSession.run).toHaveBeenCalledWith('MATCH (n) DETACH DELETE n');
        
        // Should create nodes
        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (n:Project'),
          expect.objectContaining({ 
            properties: expect.objectContaining({ id: 'proj-1', name: 'Test Project' }) 
          })
        );
        
        // Should create relationships
        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (start), (end)'),
          expect.any(Object)
        );
      });

      it('should handle corrupted snapshot files', async () => {
        fs.readFile.mockResolvedValue('invalid json');

        await expect(cognitiveCanvas.loadSnapshot('./test-snapshots/corrupt.json'))
          .rejects.toThrow();
      });

      it('should handle missing snapshot files', async () => {
        fs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

        await expect(cognitiveCanvas.loadSnapshot('./test-snapshots/missing.json'))
          .rejects.toThrow();
      });

      it('should validate snapshot format before loading', async () => {
        const invalidSnapshot = { version: '1.0.0' }; // Missing required fields
        fs.readFile.mockResolvedValue(JSON.stringify(invalidSnapshot));

        await expect(cognitiveCanvas.loadSnapshot('./test-snapshots/invalid.json'))
          .rejects.toThrow('Invalid snapshot format');
      });
    });

    describe('listSnapshots', () => {
      it('should return list of available snapshot files', async () => {
        fs.readdir.mockResolvedValue([
          'snapshot1.json' as any,
          'snapshot2.json' as any,
          'other.txt' as any
        ]);

        const snapshots = await cognitiveCanvas.listSnapshots();

        expect(fs.readdir).toHaveBeenCalledWith('./test-snapshots');
        expect(snapshots).toEqual(['snapshot1.json', 'snapshot2.json']);
      });

      it('should return empty array if snapshots directory does not exist', async () => {
        const error = new Error('ENOENT: no such file') as any;
        error.code = 'ENOENT';
        fs.readdir.mockRejectedValue(error);

        const snapshots = await cognitiveCanvas.listSnapshots();

        expect(snapshots).toEqual([]);
      });

      it('should handle empty snapshots directory', async () => {
        fs.readdir.mockResolvedValue([]);

        const snapshots = await cognitiveCanvas.listSnapshots();

        expect(snapshots).toEqual([]);
      });
    });

    describe('restoreFromSnapshot', () => {
      it('should perform complete database restore', async () => {
        fs.readFile.mockResolvedValue(JSON.stringify(sampleSnapshot));
        mockSession.run.mockResolvedValue({ records: [] } as any);

        await cognitiveCanvas.restoreFromSnapshot('./test-snapshots/restore.json');

        // Should clear all data first
        expect(mockSession.run).toHaveBeenCalledWith('MATCH (n) DETACH DELETE n');
        
        // Should recreate schema constraints
        expect(mockSession.run).toHaveBeenCalledWith(
          'CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE'
        );

        // Should restore nodes and relationships
        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (n:Project'),
          expect.any(Object)
        );
      });

      it('should handle restore failure gracefully', async () => {
        fs.readFile.mockResolvedValue(JSON.stringify(sampleSnapshot));
        mockSession.run.mockRejectedValueOnce(new Error('Database error'));

        await expect(cognitiveCanvas.restoreFromSnapshot('./test-snapshots/fail.json'))
          .rejects.toThrow('Database error');
      });
    });

    describe('autoSaveSnapshot', () => {
      beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(global, 'setInterval');
        jest.spyOn(global, 'clearInterval');
      });

      afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
      });

      it('should enable automatic periodic snapshots', async () => {
        mockSession.run
          .mockResolvedValue({ records: [] } as any);

        await cognitiveCanvas.autoSaveSnapshot();

        expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 60000);

        // Manually trigger the interval function to test auto-save
        const intervalCallback = (global.setInterval as jest.Mock).mock.calls[0][0];
        await intervalCallback();

        expect(fs.writeFile).toHaveBeenCalled();
      }, 10000);

      it('should disable auto-save when called multiple times', async () => {
        await cognitiveCanvas.autoSaveSnapshot();
        await cognitiveCanvas.autoSaveSnapshot();

        // Should clear previous interval
        expect(global.clearInterval).toHaveBeenCalled();
      });

      it('should handle auto-save errors gracefully', async () => {
        // Mock the saveSnapshot method to throw an error
        const saveSnapshotSpy = jest.spyOn(cognitiveCanvas, 'saveSnapshot')
          .mockRejectedValue(new Error('Database connection lost'));
        
        // Mock console.error to capture the error log
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        await cognitiveCanvas.autoSaveSnapshot();

        // Manually trigger the interval function to test error handling
        const intervalCallback = (global.setInterval as jest.Mock).mock.calls[0][0];
        
        // This should not throw, but log the error
        await intervalCallback();

        // Should log the error but not crash
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Auto-save failed:',
          expect.any(Error)
        );
        
        // Restore mocks
        saveSnapshotSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      }, 10000);
    });

    describe('performance and large datasets', () => {
      it('should handle large datasets efficiently', async () => {
        const largeDataset = {
          ...sampleSnapshot,
          metadata: {
            totalNodes: 10000,
            totalRelationships: 50000,
            nodeTypes: { Project: 100, Task: 5000, Agent: 1000, Pheromone: 3900 }
          },
          nodes: Array.from({ length: 1000 }, (_, i) => ({
            id: i.toString(),
            labels: ['Task'],
            properties: { id: `task-${i}`, title: `Task ${i}` }
          })),
          relationships: Array.from({ length: 500 }, (_, i) => ({
            id: i.toString(),
            startNode: i.toString(),
            endNode: (i + 1).toString(),
            type: 'DEPENDS_ON',
            properties: {}
          }))
        };

        fs.readFile.mockResolvedValue(JSON.stringify(largeDataset));
        mockSession.run.mockResolvedValue({ records: [] } as any);

        const startTime = Date.now();
        await cognitiveCanvas.loadSnapshot('./test-snapshots/large.json');
        const duration = Date.now() - startTime;

        // Should complete within reasonable time
        expect(duration).toBeLessThan(5000); // 5 seconds
        // Should have been called multiple times (clear + batched node creation + relationships)
        expect(mockSession.run.mock.calls.length).toBeGreaterThan(100);
      });

      it('should batch large operations to prevent memory issues', async () => {
        const batchSize = 100;
        const totalNodes = 500;
        
        const largeSnapshot = {
          ...sampleSnapshot,
          nodes: Array.from({ length: totalNodes }, (_, i) => ({
            id: i.toString(),
            labels: ['Task'],
            properties: { id: `task-${i}` }
          }))
        };

        fs.readFile.mockResolvedValue(JSON.stringify(largeSnapshot));
        mockSession.run.mockResolvedValue({ records: [] } as any);

        await cognitiveCanvas.loadSnapshot('./test-snapshots/batch.json');

        // Should use batched operations for large datasets
        const createNodeCalls = (mockSession.run as jest.Mock).mock.calls
          .filter(call => call[0].includes('CREATE'));
        
        expect(createNodeCalls.length).toBeGreaterThan(1);
      });
    });
  });

  describe('Missing Methods - TDD Tests', () => {
    describe('createPrototypeNode', () => {
      it('should create a prototype node and return its ID', async () => {
        const prototypeData = {
          contractId: 'contract-123',
          pseudocode: 'function example() { return "hello"; }',
          flowDiagram: 'Start -> Process -> End',
          outputPath: '/tmp/prototype.js'
        };

        mockSession.run.mockResolvedValue({
          records: [{
            get: jest.fn().mockReturnValue({
              properties: { id: 'prototype-456' }
            })
          }]
        } as any);

        const result = await cognitiveCanvas.createPrototypeNode(prototypeData);

        expect(result).toBe('prototype-456');
        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (p:Prototype'),
          expect.objectContaining({
            contractId: 'contract-123',
            pseudocode: 'function example() { return "hello"; }',
            flowDiagram: 'Start -> Process -> End',
            outputPath: '/tmp/prototype.js'
          })
        );
      });

      it('should throw error if prototype creation fails', async () => {
        const prototypeData = {
          contractId: 'contract-123',
          pseudocode: 'function example() { return "hello"; }',
          flowDiagram: 'Start -> Process -> End',
          outputPath: '/tmp/prototype.js'
        };

        mockSession.run.mockResolvedValue({ records: [] } as any);

        await expect(cognitiveCanvas.createPrototypeNode(prototypeData))
          .rejects.toThrow('Failed to create prototype node');
      });
    });

    describe('linkPrototypeToContract', () => {
      it('should create a relationship between prototype and contract', async () => {
        mockSession.run.mockResolvedValue({ records: [] } as any);

        await cognitiveCanvas.linkPrototypeToContract('prototype-456', 'contract-123');

        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (p:Prototype {id: $prototypeId}), (c:Contract {id: $contractId}) CREATE (p)-[r:PROTOTYPES]->(c)'),
          { prototypeId: 'prototype-456', contractId: 'contract-123', linkedAt: expect.any(String) }
        );
      });
    });

    describe('getContextPheromones', () => {
      it('should return pheromones separated into guides and warnings', async () => {
        const mockPheromones = [
          { id: 'ph1', type: 'guide', strength: 0.8, context: 'typescript development' },
          { id: 'ph2', type: 'warn', strength: 0.6, context: 'javascript patterns' }
        ];

        mockSession.run.mockResolvedValue({
          records: mockPheromones.map(ph => ({
            get: jest.fn().mockReturnValue({ properties: ph })
          }))
        } as any);

        const result = await cognitiveCanvas.getContextPheromones(
          'architect',
          'typescript development',
          'high'
        );

        expect(result.guides).toEqual([mockPheromones[0]]);
        expect(result.warnings).toEqual([mockPheromones[1]]);
        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (ph:Pheromone)'),
          expect.objectContaining({
            agentType: 'architect',
            taskContext: 'typescript development',
            taskComplexity: 'high'
          })
        );
      });

      it('should return empty guides and warnings when no pheromones match', async () => {
        mockSession.run.mockResolvedValue({ records: [] } as any);

        const result = await cognitiveCanvas.getContextPheromones(
          'coder',
          'python development',
          'low'
        );

        expect(result.guides).toEqual([]);
        expect(result.warnings).toEqual([]);
      });
    });

    describe('updateTaskStatus', () => {
      it('should update task status and return updated task', async () => {
        const updatedTask = {
          id: 'task-123',
          title: 'Test Task',
          status: 'paused',
          updatedAt: expect.any(String)
        };

        mockSession.run.mockResolvedValue({
          records: [{
            get: jest.fn().mockReturnValue({ properties: updatedTask })
          }]
        } as any);

        const result = await cognitiveCanvas.updateTaskStatus('task-123', 'paused');

        expect(result).toEqual(updatedTask);
        expect(mockSession.run).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (t:Task {id: $id}) SET t.status = $status, t.updatedAt = $updatedAt RETURN t'),
          expect.objectContaining({
            id: 'task-123',
            status: 'paused',
            updatedAt: expect.any(String)
          })
        );
      });

      it('should throw error if task not found', async () => {
        mockSession.run.mockResolvedValue({ records: [] } as any);

        await expect(cognitiveCanvas.updateTaskStatus('nonexistent-task', 'completed'))
          .rejects.toThrow('Task with id nonexistent-task not found');
      });
    });
  });
});