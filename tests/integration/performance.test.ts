/**
 * Performance Integration Tests for Agent Orchestration
 * 
 * Tests system performance under various conditions:
 * - Initialization performance benchmarks
 * - Agent spawning and coordination performance
 * - Database operation performance
 * - Memory usage and resource efficiency
 * - Concurrent operation handling
 * - Scalability testing
 * - Load testing scenarios
 * - Performance regression detection
 */

import { Orchestrator, OrchestratorConfig } from '../../src/orchestrator';
import { CognitiveCanvas } from '../../src/cognitive-canvas';
import { WorkspaceManager } from '../../src/workspace';
import { SessionManager } from '../../src/session';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Performance Integration Tests', () => {
  let testProjectPath: string;
  let orchestrator: Orchestrator;
  let canvas: CognitiveCanvas;
  
  const testConfig: OrchestratorConfig = {
    neo4j: {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password'
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY || 'test-api-key',
      budgetLimit: 100
    }
  };

  const performanceTestPlan = `# Performance Test Project

## Overview

A project designed to test system performance, scalability, and resource efficiency under various operational conditions.

## Features

### Feature 1: Lightweight Task
- **Priority**: High
- **Description**: Simple task with minimal resource requirements
- **Dependencies**: []
- **Agent**: SpecWriter
- **Acceptance Criteria**:
  - [ ] Completes quickly with minimal resource usage

### Feature 2: Medium Complexity Task
- **Priority**: High
- **Description**: Moderately complex task with average resource requirements
- **Dependencies**: [Feature 1]
- **Agent**: Formalizer
- **Acceptance Criteria**:
  - [ ] Completes within reasonable time bounds

### Feature 3: Resource Intensive Task
- **Priority**: Medium
- **Description**: Complex task requiring significant processing
- **Dependencies**: [Feature 2]
- **Agent**: Architect
- **Acceptance Criteria**:
  - [ ] Completes without overwhelming system resources

### Feature 4: Parallel Processing Task A
- **Priority**: Low
- **Description**: First of multiple parallel tasks
- **Dependencies**: []
- **Agent**: Coder
- **Acceptance Criteria**:
  - [ ] Executes efficiently in parallel

### Feature 5: Parallel Processing Task B
- **Priority**: Low
- **Description**: Second of multiple parallel tasks
- **Dependencies**: []
- **Agent**: Tester
- **Acceptance Criteria**:
  - [ ] Executes efficiently in parallel

## Architecture Decisions

### Technology Stack
- **Framework**: Performance-optimized stack
- **Database**: High-performance database configuration

### Quality Standards
- **Response Time**: < 200ms for basic operations
- **Memory Usage**: < 500MB baseline
- **Concurrency**: Support 10+ parallel operations
`;

  // Performance metrics collection
  interface PerformanceMetrics {
    startTime: number;
    endTime: number;
    duration: number;
    memoryStart: NodeJS.MemoryUsage;
    memoryEnd: NodeJS.MemoryUsage;
    memoryDelta: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
  }

  const collectMetrics = async (operation: () => Promise<any>): Promise<PerformanceMetrics> => {
    const startTime = Date.now();
    const memoryStart = process.memoryUsage();
    
    await operation();
    
    const endTime = Date.now();
    const memoryEnd = process.memoryUsage();
    
    return {
      startTime,
      endTime,
      duration: endTime - startTime,
      memoryStart,
      memoryEnd,
      memoryDelta: {
        heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
        heapTotal: memoryEnd.heapTotal - memoryStart.heapTotal,
        external: memoryEnd.external - memoryStart.external,
        rss: memoryEnd.rss - memoryStart.rss
      }
    };
  };

  beforeAll(async () => {
    // Create temporary test project directory
    testProjectPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cortex-perf-test-'));
    
    // Write the test plan file
    await fs.promises.writeFile(
      path.join(testProjectPath, 'plan.md'),
      performanceTestPlan
    );

    // Initialize Cognitive Canvas
    canvas = new CognitiveCanvas(testConfig.neo4j);
    
    try {
      await canvas.initializeSchema();
      // Clear any existing test data
      const session = (canvas as any).driver.session();
      await session.run('MATCH (n) WHERE n.projectId STARTS WITH "perf-test-" DETACH DELETE n');
      await session.close();
    } catch (error) {
      console.warn('Could not clean test database:', error);
    }
  });

  afterAll(async () => {
    // Cleanup
    try {
      if (orchestrator) {
        await orchestrator.shutdown();
      }
      await canvas.close();
      await fs.promises.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  beforeEach(() => {
    orchestrator = new Orchestrator(testConfig);
  });

  afterEach(async () => {
    if (orchestrator && orchestrator.isRunning()) {
      await orchestrator.shutdown();
    }
  });

  describe('Initialization Performance', () => {
    it('should initialize projects within performance thresholds', async () => {
      const metrics = await collectMetrics(async () => {
        await orchestrator.initialize(testProjectPath);
      });

      // Performance thresholds
      expect(metrics.duration).toBeLessThan(10000); // Should initialize within 10 seconds
      expect(metrics.memoryDelta.heapUsed).toBeLessThan(50 * 1024 * 1024); // Less than 50MB heap increase
      expect(orchestrator.getStatus()).toBe('initialized');

      console.log(`Initialization Performance:
        Duration: ${metrics.duration}ms
        Memory Delta: ${Math.round(metrics.memoryDelta.heapUsed / 1024 / 1024)}MB heap
        RSS Delta: ${Math.round(metrics.memoryDelta.rss / 1024 / 1024)}MB`);
    });

    it('should handle large plan files efficiently', async () => {
      // Create a large plan file with many features
      const largePlan = generateLargePlan(50); // 50 features
      await fs.promises.writeFile(
        path.join(testProjectPath, 'plan.md'),
        largePlan
      );

      const metrics = await collectMetrics(async () => {
        await orchestrator.initialize(testProjectPath);
      });

      // Should still initialize efficiently with large plans
      expect(metrics.duration).toBeLessThan(20000); // 20 seconds for large plan
      expect(metrics.memoryDelta.heapUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB

      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      expect(tasks).toHaveLength(50); // All features should be created

      console.log(`Large Plan Performance:
        Duration: ${metrics.duration}ms
        Tasks Created: ${tasks.length}
        Memory Delta: ${Math.round(metrics.memoryDelta.heapUsed / 1024 / 1024)}MB`);
    });

    it('should demonstrate consistent initialization performance', async () => {
      const iterations = 5;
      const durations: number[] = [];
      const memoryDeltas: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const testOrchestrator = new Orchestrator(testConfig);
        
        const metrics = await collectMetrics(async () => {
          await testOrchestrator.initialize(testProjectPath);
        });

        durations.push(metrics.duration);
        memoryDeltas.push(metrics.memoryDelta.heapUsed);

        await testOrchestrator.shutdown();
      }

      // Calculate statistics
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      const stdDevDuration = Math.sqrt(
        durations.reduce((sq, n) => sq + Math.pow(n - avgDuration, 2), 0) / durations.length
      );

      // Performance consistency checks
      expect(stdDevDuration).toBeLessThan(avgDuration * 0.3); // Standard deviation < 30% of average
      expect(maxDuration - minDuration).toBeLessThan(avgDuration); // Range < average

      console.log(`Initialization Consistency:
        Average: ${avgDuration.toFixed(2)}ms
        Min: ${minDuration}ms, Max: ${maxDuration}ms
        Std Dev: ${stdDevDuration.toFixed(2)}ms
        Coefficient of Variation: ${((stdDevDuration / avgDuration) * 100).toFixed(2)}%`);
    });
  });

  describe('Database Operation Performance', () => {
    beforeEach(async () => {
      await orchestrator.initialize(testProjectPath);
    });

    it('should perform database operations within latency thresholds', async () => {
      const projectId = (orchestrator as any).projectId;

      // Test task creation performance
      const taskCreationMetrics = await collectMetrics(async () => {
        await canvas.createTask({
          id: 'perf-test-task',
          title: 'Performance Test Task',
          description: 'Task for performance testing',
          status: 'pending',
          priority: 'High',
          projectId: projectId,
          createdAt: new Date().toISOString()
        });
      });

      // Test task retrieval performance
      const taskRetrievalMetrics = await collectMetrics(async () => {
        await canvas.getTasksByProject(projectId);
      });

      // Test contract creation performance
      const contractCreationMetrics = await collectMetrics(async () => {
        await canvas.createContract({
          id: 'perf-test-contract',
          name: 'Performance Test Contract',
          type: 'openapi',
          version: '1.0.0',
          specification: {
            openapi: '3.0.0',
            info: { title: 'Performance Test API', version: '1.0.0' },
            paths: {}
          },
          projectId: projectId,
          createdAt: new Date().toISOString()
        });
      });

      // Performance assertions
      expect(taskCreationMetrics.duration).toBeLessThan(1000); // < 1 second
      expect(taskRetrievalMetrics.duration).toBeLessThan(500); // < 0.5 seconds
      expect(contractCreationMetrics.duration).toBeLessThan(1000); // < 1 second

      console.log(`Database Operation Performance:
        Task Creation: ${taskCreationMetrics.duration}ms
        Task Retrieval: ${taskRetrievalMetrics.duration}ms
        Contract Creation: ${contractCreationMetrics.duration}ms`);
    });

    it('should handle batch operations efficiently', async () => {
      const projectId = (orchestrator as any).projectId;
      const batchSize = 20;

      // Test batch task creation
      const batchTaskCreationMetrics = await collectMetrics(async () => {
        const taskPromises = Array.from({ length: batchSize }, (_, i) =>
          canvas.createTask({
            id: `batch-task-${i}`,
            title: `Batch Task ${i}`,
            description: `Batch task number ${i}`,
            status: 'pending',
            priority: 'Medium',
            projectId: projectId,
            createdAt: new Date().toISOString()
          })
        );
        await Promise.all(taskPromises);
      });

      // Test batch retrieval
      const batchRetrievalMetrics = await collectMetrics(async () => {
        await canvas.getTasksByProject(projectId);
      });

      // Performance assertions for batch operations
      expect(batchTaskCreationMetrics.duration).toBeLessThan(10000); // < 10 seconds for 20 tasks
      expect(batchRetrievalMetrics.duration).toBeLessThan(2000); // < 2 seconds for retrieval

      const averageTaskCreationTime = batchTaskCreationMetrics.duration / batchSize;
      expect(averageTaskCreationTime).toBeLessThan(500); // < 0.5 seconds per task on average

      console.log(`Batch Operation Performance:
        Batch Creation (${batchSize} tasks): ${batchTaskCreationMetrics.duration}ms
        Average per task: ${averageTaskCreationTime.toFixed(2)}ms
        Batch Retrieval: ${batchRetrievalMetrics.duration}ms`);
    });

    it('should scale database queries efficiently', async () => {
      const projectId = (orchestrator as any).projectId;

      // Create datasets of increasing size
      const sizes = [10, 50, 100];
      const queryTimes: { size: number; time: number }[] = [];

      for (const size of sizes) {
        // Create test data
        const tasks = Array.from({ length: size }, (_, i) => ({
          id: `scale-task-${size}-${i}`,
          title: `Scale Task ${i}`,
          description: `Scale test task ${i} for size ${size}`,
          status: 'pending',
          priority: 'Low',
          projectId: projectId,
          createdAt: new Date().toISOString()
        }));

        // Create all tasks
        await Promise.all(tasks.map(task => canvas.createTask(task)));

        // Measure query performance
        const queryMetrics = await collectMetrics(async () => {
          await canvas.getTasksByProject(projectId);
        });

        queryTimes.push({ size, time: queryMetrics.duration });

        console.log(`Query performance for ${size} tasks: ${queryMetrics.duration}ms`);
      }

      // Verify query scaling is reasonable (should be sub-linear)
      const firstQuery = queryTimes[0];
      const lastQuery = queryTimes[queryTimes.length - 1];
      const sizeRatio = lastQuery.size / firstQuery.size;
      const timeRatio = lastQuery.time / firstQuery.time;

      // Time increase should be less than size increase (sub-linear scaling)
      expect(timeRatio).toBeLessThan(sizeRatio * 1.5); // Allow some overhead

      console.log(`Query Scaling Analysis:
        Size Ratio: ${sizeRatio}x
        Time Ratio: ${timeRatio.toFixed(2)}x
        Scaling Efficiency: ${((sizeRatio / timeRatio) * 100).toFixed(1)}%`);
    });
  });

  describe('Agent Spawning and Coordination Performance', () => {
    beforeEach(async () => {
      await orchestrator.initialize(testProjectPath);
    });

    it('should spawn agents within performance thresholds', async () => {
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      const testTask = tasks[0];

      // Mock workspace and session managers for performance testing
      const mockWorkspace = {
        createWorktree: jest.fn().mockImplementation(async (taskId) => {
          await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
          return {
            id: taskId,
            path: `/tmp/worktree-${taskId}`,
            branch: `feature/${taskId}`,
            baseBranch: 'main'
          };
        }),
        removeWorktree: jest.fn().mockResolvedValue(true)
      };

      const mockSessionManager = {
        createSession: jest.fn().mockImplementation(async (taskId) => {
          await new Promise(resolve => setTimeout(resolve, 50)); // Simulate work
          return {
            sessionId: `cortex-${taskId}-${Date.now()}`,
            taskId: taskId,
            status: 'running',
            createdAt: new Date()
          };
        }),
        startAgentInSession: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 200)); // Simulate agent startup
        })
      };

      (orchestrator as any).workspace = mockWorkspace;
      (orchestrator as any).sessionManager = mockSessionManager;

      const spawnMetrics = await collectMetrics(async () => {
        await orchestrator.spawnAgent(testTask, 'SpecWriter');
      });

      // Performance thresholds for agent spawning
      expect(spawnMetrics.duration).toBeLessThan(2000); // < 2 seconds
      expect(spawnMetrics.memoryDelta.heapUsed).toBeLessThan(10 * 1024 * 1024); // < 10MB

      console.log(`Agent Spawn Performance:
        Duration: ${spawnMetrics.duration}ms
        Memory Delta: ${Math.round(spawnMetrics.memoryDelta.heapUsed / 1024 / 1024)}MB`);
    });

    it('should handle concurrent agent spawning efficiently', async () => {
      const projectId = (orchestrator as any).projectId;
      const concurrentCount = 5;

      // Create multiple tasks for concurrent spawning
      const concurrentTasks = await Promise.all(
        Array.from({ length: concurrentCount }, (_, i) =>
          canvas.createTask({
            id: `concurrent-task-${i}`,
            title: `Concurrent Task ${i}`,
            description: `Task for concurrent spawning test ${i}`,
            status: 'pending',
            priority: 'Medium',
            projectId: projectId,
            createdAt: new Date().toISOString()
          })
        )
      );

      // Mock components for concurrent testing
      const mockWorkspace = {
        createWorktree: jest.fn().mockImplementation(async (taskId) => {
          await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
          return {
            id: taskId,
            path: `/tmp/worktree-${taskId}`,
            branch: `feature/${taskId}`,
            baseBranch: 'main'
          };
        }),
        removeWorktree: jest.fn().mockResolvedValue(true)
      };

      const mockSessionManager = {
        createSession: jest.fn().mockImplementation(async (taskId) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return {
            sessionId: `cortex-${taskId}-${Date.now()}`,
            taskId: taskId,
            status: 'running',
            createdAt: new Date()
          };
        }),
        startAgentInSession: jest.fn().mockResolvedValue()
      };

      (orchestrator as any).workspace = mockWorkspace;
      (orchestrator as any).sessionManager = mockSessionManager;

      // Map tasks to features
      for (const task of concurrentTasks) {
        (orchestrator as any).taskFeatureMap.set(task.id, {
          name: task.title,
          priority: task.priority,
          description: task.description,
          dependencies: [],
          agent: 'SpecWriter',
          acceptanceCriteria: [],
          microtasks: []
        });
      }

      // Test concurrent spawning performance
      const concurrentMetrics = await collectMetrics(async () => {
        await Promise.all(
          concurrentTasks.map(task => orchestrator.spawnAgent(task, 'SpecWriter'))
        );
      });

      // Performance assertions for concurrent operations
      expect(concurrentMetrics.duration).toBeLessThan(3000); // < 3 seconds for 5 concurrent
      expect(concurrentMetrics.memoryDelta.heapUsed).toBeLessThan(50 * 1024 * 1024); // < 50MB

      const averageSpawnTime = concurrentMetrics.duration / concurrentCount;
      expect(averageSpawnTime).toBeLessThan(1000); // < 1 second average per agent

      console.log(`Concurrent Agent Spawn Performance:
        Total Duration: ${concurrentMetrics.duration}ms
        Average per Agent: ${averageSpawnTime.toFixed(2)}ms
        Concurrent Agents: ${concurrentCount}
        Memory Delta: ${Math.round(concurrentMetrics.memoryDelta.heapUsed / 1024 / 1024)}MB`);
    });

    it('should monitor task processing performance', async () => {
      const projectId = (orchestrator as any).projectId;

      // Mock canvas with performance tracking
      let monitoringCallCount = 0;
      const mockCanvas = {
        getTasksByProject: jest.fn().mockImplementation(async () => {
          monitoringCallCount++;
          await new Promise(resolve => setTimeout(resolve, 50)); // Simulate query time
          return [];
        }),
        close: jest.fn().mockResolvedValue(undefined)
      };

      (orchestrator as any).canvas = mockCanvas;

      // Test monitoring performance
      const monitoringMetrics = await collectMetrics(async () => {
        await orchestrator.monitorTasks();
      });

      // Performance assertions for monitoring
      expect(monitoringMetrics.duration).toBeLessThan(1000); // < 1 second per monitoring cycle
      expect(monitoringCallCount).toBeGreaterThan(0);

      console.log(`Task Monitoring Performance:
        Duration: ${monitoringMetrics.duration}ms
        Monitoring Calls: ${monitoringCallCount}
        Average per Call: ${(monitoringMetrics.duration / monitoringCallCount).toFixed(2)}ms`);
    });
  });

  describe('Memory Usage and Resource Efficiency', () => {
    beforeEach(async () => {
      await orchestrator.initialize(testProjectPath);
    });

    it('should maintain stable memory usage during normal operations', async () => {
      const projectId = (orchestrator as any).projectId;
      const initialMemory = process.memoryUsage();

      // Perform multiple operations
      const operations = [
        () => canvas.createTask({
          id: 'memory-test-task-1',
          title: 'Memory Test Task 1',
          description: 'First memory test task',
          status: 'pending',
          priority: 'Medium',
          projectId: projectId,
          createdAt: new Date().toISOString()
        }),
        () => canvas.getTasksByProject(projectId),
        () => canvas.createContract({
          id: 'memory-test-contract',
          name: 'Memory Test Contract',
          type: 'json-schema',
          version: '1.0.0',
          specification: { type: 'object', properties: {} },
          projectId: projectId,
          createdAt: new Date().toISOString()
        }),
        () => canvas.getContractsByProject(projectId)
      ];

      const memorySnapshots: NodeJS.MemoryUsage[] = [initialMemory];

      for (const operation of operations) {
        await operation();
        memorySnapshots.push(process.memoryUsage());
      }

      // Calculate memory growth
      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const maxHeapUsed = Math.max(...memorySnapshots.map(m => m.heapUsed));

      // Memory efficiency assertions
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024); // < 20MB total growth
      expect(maxHeapUsed).toBeLessThan(200 * 1024 * 1024); // < 200MB peak usage

      console.log(`Memory Efficiency:
        Initial Heap: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB
        Final Heap: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB
        Growth: ${Math.round(memoryGrowth / 1024 / 1024)}MB
        Peak Heap: ${Math.round(maxHeapUsed / 1024 / 1024)}MB`);
    });

    it('should handle memory pressure gracefully', async () => {
      const projectId = (orchestrator as any).projectId;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage();

      // Create memory pressure with large dataset
      const largeDataTasks = Array.from({ length: 100 }, (_, i) => ({
        id: `memory-pressure-task-${i}`,
        title: `Memory Pressure Task ${i}`,
        description: `Large description for memory pressure testing task ${i}. `.repeat(100), // Large description
        status: 'pending',
        priority: 'Low',
        projectId: projectId,
        createdAt: new Date().toISOString()
      }));

      const memoryPressureMetrics = await collectMetrics(async () => {
        // Create tasks in batches to simulate memory pressure
        const batchSize = 10;
        for (let i = 0; i < largeDataTasks.length; i += batchSize) {
          const batch = largeDataTasks.slice(i, i + batchSize);
          await Promise.all(batch.map(task => canvas.createTask(task)));
          
          // Allow some processing time
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      });

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Should handle memory pressure without excessive growth
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // < 100MB increase
      expect(memoryPressureMetrics.duration).toBeLessThan(30000); // < 30 seconds

      console.log(`Memory Pressure Test:
        Duration: ${memoryPressureMetrics.duration}ms
        Memory Increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB
        Tasks Created: ${largeDataTasks.length}`);
    });

    it('should detect memory leaks in long-running operations', async () => {
      const projectId = (orchestrator as any).projectId;
      
      // Force initial garbage collection
      if (global.gc) {
        global.gc();
      }

      const iterations = 20;
      const memorySnapshots: number[] = [];

      for (let i = 0; i < iterations; i++) {
        // Perform operation that could potentially leak
        await canvas.createTask({
          id: `leak-test-task-${i}`,
          title: `Leak Test Task ${i}`,
          description: 'Task for memory leak detection',
          status: 'pending',
          priority: 'Low',
          projectId: projectId,
          createdAt: new Date().toISOString()
        });

        await canvas.getTasksByProject(projectId);

        // Force garbage collection and measure
        if (global.gc) {
          global.gc();
        }

        memorySnapshots.push(process.memoryUsage().heapUsed);
      }

      // Analyze memory growth pattern
      const firstSnapshot = memorySnapshots[0];
      const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
      const totalGrowth = lastSnapshot - firstSnapshot;
      const averageGrowthPerIteration = totalGrowth / iterations;

      // Calculate linear regression to detect trends
      const n = memorySnapshots.length;
      const x = Array.from({ length: n }, (_, i) => i);
      const y = memorySnapshots;
      
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
      const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

      // Memory leak detection thresholds
      expect(averageGrowthPerIteration).toBeLessThan(1024 * 1024); // < 1MB per iteration
      expect(slope).toBeLessThan(500 * 1024); // < 500KB trend growth

      console.log(`Memory Leak Detection:
        Total Growth: ${Math.round(totalGrowth / 1024 / 1024)}MB
        Average per Iteration: ${Math.round(averageGrowthPerIteration / 1024)}KB
        Growth Trend (slope): ${Math.round(slope / 1024)}KB/iteration
        Iterations: ${iterations}`);
    });
  });

  describe('Scalability Testing', () => {
    it('should handle increasing project complexity efficiently', async () => {
      const complexities = [
        { features: 5, contracts: 2, name: 'Small' },
        { features: 20, contracts: 8, name: 'Medium' },
        { features: 50, contracts: 20, name: 'Large' }
      ];

      const scalabilityResults: Array<{
        complexity: string;
        features: number;
        contracts: number;
        initTime: number;
        memoryUsage: number;
      }> = [];

      for (const complexity of complexities) {
        // Generate test plan with specified complexity
        const complexPlan = generateComplexPlan(complexity.features, complexity.contracts);
        await fs.promises.writeFile(
          path.join(testProjectPath, 'plan.md'),
          complexPlan
        );

        const testOrchestrator = new Orchestrator(testConfig);

        const metrics = await collectMetrics(async () => {
          await testOrchestrator.initialize(testProjectPath);
        });

        scalabilityResults.push({
          complexity: complexity.name,
          features: complexity.features,
          contracts: complexity.contracts,
          initTime: metrics.duration,
          memoryUsage: metrics.memoryDelta.heapUsed
        });

        await testOrchestrator.shutdown();

        console.log(`${complexity.name} Project (${complexity.features} features):
          Init Time: ${metrics.duration}ms
          Memory: ${Math.round(metrics.memoryDelta.heapUsed / 1024 / 1024)}MB`);
      }

      // Verify scalability characteristics
      const small = scalabilityResults[0];
      const large = scalabilityResults[2];
      
      const featureRatio = large.features / small.features;
      const timeRatio = large.initTime / small.initTime;
      const memoryRatio = large.memoryUsage / small.memoryUsage;

      // Should scale reasonably (not worse than quadratic)
      expect(timeRatio).toBeLessThan(Math.pow(featureRatio, 2));
      expect(memoryRatio).toBeLessThan(Math.pow(featureRatio, 1.5));

      console.log(`Scalability Analysis:
        Feature Ratio: ${featureRatio}x
        Time Ratio: ${timeRatio.toFixed(2)}x
        Memory Ratio: ${memoryRatio.toFixed(2)}x
        Time Efficiency: ${((featureRatio / timeRatio) * 100).toFixed(1)}%
        Memory Efficiency: ${((featureRatio / memoryRatio) * 100).toFixed(1)}%`);
    });

    it('should maintain performance under concurrent project initialization', async () => {
      const concurrentProjects = 3;
      const concurrentOrchestrators: Orchestrator[] = [];
      const projectPaths: string[] = [];

      try {
        // Create multiple test projects
        for (let i = 0; i < concurrentProjects; i++) {
          const projectPath = await fs.promises.mkdtemp(
            path.join(os.tmpdir(), `cortex-concurrent-${i}-`)
          );
          projectPaths.push(projectPath);
          
          await fs.promises.writeFile(
            path.join(projectPath, 'plan.md'),
            performanceTestPlan.replace('Performance Test Project', `Concurrent Project ${i}`)
          );
          
          concurrentOrchestrators.push(new Orchestrator(testConfig));
        }

        // Test concurrent initialization
        const concurrentMetrics = await collectMetrics(async () => {
          await Promise.all(
            concurrentOrchestrators.map((orch, i) => orch.initialize(projectPaths[i]))
          );
        });

        // Performance assertions for concurrent initialization
        expect(concurrentMetrics.duration).toBeLessThan(20000); // < 20 seconds for 3 concurrent
        expect(concurrentMetrics.memoryDelta.heapUsed).toBeLessThan(150 * 1024 * 1024); // < 150MB

        // Verify all projects initialized successfully
        concurrentOrchestrators.forEach((orch, i) => {
          expect(orch.getStatus()).toBe('initialized');
        });

        console.log(`Concurrent Initialization Performance:
          Projects: ${concurrentProjects}
          Total Duration: ${concurrentMetrics.duration}ms
          Average per Project: ${(concurrentMetrics.duration / concurrentProjects).toFixed(2)}ms
          Memory Delta: ${Math.round(concurrentMetrics.memoryDelta.heapUsed / 1024 / 1024)}MB`);

      } finally {
        // Cleanup
        await Promise.all(concurrentOrchestrators.map(orch => orch.shutdown()));
        await Promise.all(projectPaths.map(path => 
          fs.promises.rm(path, { recursive: true, force: true })
        ));
      }
    });
  });

  describe('Load Testing Scenarios', () => {
    beforeEach(async () => {
      await orchestrator.initialize(testProjectPath);
    });

    it('should handle high-frequency database operations', async () => {
      const projectId = (orchestrator as any).projectId;
      const operationsPerSecond = 50;
      const durationSeconds = 10;
      const totalOperations = operationsPerSecond * durationSeconds;

      let operationCount = 0;
      const startTime = Date.now();
      const operations: Promise<any>[] = [];

      // Generate high-frequency operations
      const interval = setInterval(() => {
        if (operationCount < totalOperations) {
          const operation = canvas.createTask({
            id: `load-test-task-${operationCount}`,
            title: `Load Test Task ${operationCount}`,
            description: 'High-frequency load test task',
            status: 'pending',
            priority: 'Low',
            projectId: projectId,
            createdAt: new Date().toISOString()
          });
          
          operations.push(operation);
          operationCount++;
        } else {
          clearInterval(interval);
        }
      }, 1000 / operationsPerSecond);

      // Wait for all operations to complete
      await new Promise(resolve => setTimeout(resolve, (durationSeconds + 2) * 1000));
      const results = await Promise.allSettled(operations);

      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      const successRate = (successful / totalOperations) * 100;
      const actualOpsPerSecond = successful / (actualDuration / 1000);

      // Performance assertions
      expect(successRate).toBeGreaterThan(90); // > 90% success rate
      expect(actualOpsPerSecond).toBeGreaterThan(operationsPerSecond * 0.8); // > 80% of target rate

      console.log(`High-Frequency Load Test:
        Target Operations: ${totalOperations}
        Successful: ${successful}
        Failed: ${failed}
        Success Rate: ${successRate.toFixed(2)}%
        Target Rate: ${operationsPerSecond} ops/sec
        Actual Rate: ${actualOpsPerSecond.toFixed(2)} ops/sec
        Duration: ${actualDuration}ms`);
    });

    it('should maintain responsiveness under sustained load', async () => {
      const projectId = (orchestrator as any).projectId;
      const backgroundLoadPromise = generateBackgroundLoad(projectId, 30000); // 30 seconds of load

      // Measure responsiveness during load
      const responsivenessSamples: number[] = [];
      const samplingInterval = 2000; // Every 2 seconds
      const samplingDuration = 30000; // 30 seconds total

      const startTime = Date.now();
      while (Date.now() - startTime < samplingDuration) {
        const sampleStartTime = Date.now();
        
        try {
          await canvas.getTasksByProject(projectId);
          const responseTime = Date.now() - sampleStartTime;
          responsivenessSamples.push(responseTime);
        } catch (error) {
          // Track failures but don't fail the test
          responsivenessSamples.push(10000); // Penalty for failure
        }

        await new Promise(resolve => setTimeout(resolve, samplingInterval));
      }

      await backgroundLoadPromise; // Wait for background load to complete

      // Analyze responsiveness
      const avgResponseTime = responsivenessSamples.reduce((a, b) => a + b, 0) / responsivenessSamples.length;
      const maxResponseTime = Math.max(...responsivenessSamples);
      const p95ResponseTime = responsivenessSamples.sort((a, b) => a - b)[Math.floor(responsivenessSamples.length * 0.95)];

      // Responsiveness assertions
      expect(avgResponseTime).toBeLessThan(2000); // < 2 seconds average
      expect(maxResponseTime).toBeLessThan(5000); // < 5 seconds max
      expect(p95ResponseTime).toBeLessThan(3000); // < 3 seconds 95th percentile

      console.log(`Responsiveness Under Load:
        Samples: ${responsivenessSamples.length}
        Average Response: ${avgResponseTime.toFixed(2)}ms
        Max Response: ${maxResponseTime}ms
        95th Percentile: ${p95ResponseTime}ms
        Load Duration: 30 seconds`);
    });
  });

  // Helper function to generate large plan
  function generateLargePlan(featureCount: number): string {
    let plan = `# Large Performance Test Project

## Overview

A large project with ${featureCount} features for performance testing.

## Features

`;

    for (let i = 1; i <= featureCount; i++) {
      const agents = ['SpecWriter', 'Formalizer', 'Architect', 'Coder', 'Tester'];
      const agent = agents[i % agents.length];
      const priority = ['High', 'Medium', 'Low'][i % 3];
      
      plan += `### Feature ${i}: Feature ${i} Title
- **Priority**: ${priority}
- **Description**: Description for feature ${i} with moderate complexity
- **Dependencies**: ${i > 1 ? `[Feature ${i - 1}]` : '[]'}
- **Agent**: ${agent}
- **Acceptance Criteria**:
  - [ ] Criterion 1 for feature ${i}
  - [ ] Criterion 2 for feature ${i}

`;
    }

    plan += `
## Architecture Decisions

### Technology Stack
- **Framework**: High-performance framework
- **Database**: Scalable database solution

### Quality Standards
- **Performance**: Optimized for large scale
- **Scalability**: Handles ${featureCount} features efficiently
`;

    return plan;
  }

  // Helper function to generate complex plan
  function generateComplexPlan(featureCount: number, contractCount: number): string {
    let plan = generateLargePlan(featureCount);
    
    // Add complexity through detailed features
    plan += `\n## Additional Complexity\n\n`;
    plan += `This project includes ${contractCount} major contracts and complex dependencies.\n`;
    
    return plan;
  }

  // Helper function to generate background load
  async function generateBackgroundLoad(projectId: string, durationMs: number): Promise<void> {
    const startTime = Date.now();
    let operationCount = 0;

    while (Date.now() - startTime < durationMs) {
      try {
        // Mix of different operations to simulate real load
        const operations = [
          canvas.createTask({
            id: `bg-task-${operationCount}`,
            title: `Background Task ${operationCount}`,
            description: 'Background load test task',
            status: 'pending',
            priority: 'Low',
            projectId: projectId,
            createdAt: new Date().toISOString()
          }),
          canvas.getTasksByProject(projectId),
          canvas.createContract({
            id: `bg-contract-${operationCount}`,
            name: `Background Contract ${operationCount}`,
            type: 'json-schema',
            version: '1.0.0',
            specification: { type: 'object' },
            projectId: projectId,
            createdAt: new Date().toISOString()
          })
        ];

        await Promise.all(operations);
        operationCount++;
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Continue on errors during background load
      }
    }
  }
});