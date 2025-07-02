import { Orchestrator } from '../src/orchestrator';
import { DebuggerAgent } from '../src/agents/debugger';
import { CognitiveCanvasNavigator } from '../src/agents/cognitive-canvas-navigator';

describe('Orchestrator Method Signature Tests', () => {
  const mockConfig = {
    neo4j: {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'password'
    },
    claude: {
      apiKey: 'test-api-key',
      budgetLimit: 100
    }
  };

  test('Orchestrator constructor should create agents properly', () => {
    // This test should fail initially due to constructor mismatch
    expect(() => {
      const orchestrator = new Orchestrator(mockConfig);
    }).not.toThrow();
  });

  test('DebuggerAgent should have analyzeFailure method with correct signature', async () => {
    const debuggerAgent = new DebuggerAgent();
    // Initialize with proper config
    await debuggerAgent.initialize({
      id: 'test-debugger',
      role: 'debugger',
      capabilities: ['error-analysis'],
      claudeConfig: {
        apiKey: 'test-key'
      },
      workspaceRoot: '/tmp',
      cognitiveCanvasConfig: {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password'
      }
    });

    // This should work with the failure ID parameter
    const result = await debuggerAgent.analyzeFailure('test-failure-id');
    expect(result).toBeDefined();
    expect(result.errorType).toBeDefined();
  });

  test('DebuggerAgent should have createWarnPheromone method with correct signature', async () => {
    const debuggerAgent = new DebuggerAgent();
    await debuggerAgent.initialize({
      id: 'test-debugger',
      role: 'debugger',
      capabilities: ['error-analysis'],
      claudeConfig: {
        apiKey: 'test-key'
      },
      workspaceRoot: '/tmp',
      cognitiveCanvasConfig: {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password'
      }
    });

    // This should work with the correct number of parameters
    await expect(debuggerAgent.createWarnPheromone('test-message', 'test-task')).resolves.not.toThrow();
  });

  test('CognitiveCanvasNavigator constructor and initialization work', async () => {
    // This test verifies that the navigator can be constructed and initialized properly
    // without requiring external API calls
    const navigator = new CognitiveCanvasNavigator();
    expect(navigator).toBeDefined();
    expect(navigator.getStatus()).toBe('uninitialized');
    
    // Should be able to initialize without throwing
    await expect(navigator.initialize({
      id: 'test-navigator',
      role: 'navigator',
      capabilities: ['graph-navigation'],
      claudeConfig: {
        apiKey: 'test-key'
      },
      workspaceRoot: '/tmp',
      cognitiveCanvasConfig: {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password'
      }
    })).resolves.not.toThrow();
    
    expect(navigator.getStatus()).toBe('initialized');
  });
});