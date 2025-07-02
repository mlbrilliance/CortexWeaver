import neo4j, { Driver, Session } from 'neo4j-driver';

// Mock Neo4j driver and fs modules for consistent testing
jest.mock('neo4j-driver');
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  readdir: jest.fn(),
  access: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
  mkdtemp: jest.fn(),
  rm: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  unlinkSync: jest.fn(),
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    readdir: jest.fn(),
    access: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn(),
    mkdtemp: jest.fn(),
    rm: jest.fn(),
  },
}));

jest.mock('../src/claude-client', () => ({
  ClaudeClient: jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn(),
    sendMessages: jest.fn(),
    streamMessage: jest.fn(),
  })),
  ClaudeModel: {
    SONNET: 'claude-3-sonnet-20240229',
    HAIKU: 'claude-3-haiku-20240307',
    OPUS: 'claude-3-opus-20240229',
  },
}));

jest.mock('../src/workspace', () => ({
  WorkspaceManager: jest.fn().mockImplementation(() => ({
    executeCommand: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    createFile: jest.fn(),
    listFiles: jest.fn(),
    exists: jest.fn().mockResolvedValue(true),
    getAbsolutePath: jest.fn(),
    getRootPath: jest.fn().mockReturnValue('/tmp/test-workspace'),
  })),
}));

jest.mock('../src/session', () => ({
  SessionManager: jest.fn().mockImplementation(() => ({
    createSession: jest.fn().mockResolvedValue({
      sessionId: 'test-session',
      taskId: 'test-task',
      status: 'running',
      createdAt: new Date()
    }),
    getSession: jest.fn().mockResolvedValue({
      sessionId: 'test-session',
      taskId: 'test-task',
      status: 'running',
      createdAt: new Date()
    }),
    updateSession: jest.fn().mockResolvedValue(true),
    deleteSession: jest.fn().mockResolvedValue(true),
    listSessions: jest.fn().mockReturnValue([]),
    runCommandInSession: jest.fn().mockResolvedValue({
      output: 'command executed',
      exitCode: 0,
      timestamp: new Date()
    }),
    attachToSession: jest.fn().mockResolvedValue('tmux attach-session -t test-session'),
    killSession: jest.fn().mockResolvedValue(true),
    getSessionStatus: jest.fn().mockResolvedValue('running')
  })),
}));

jest.mock('../src/mcp-client', () => ({
  MCPClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    executeCommand: jest.fn().mockResolvedValue({ 
      success: true, 
      result: 'mocked result',
      error: null 
    }),
    getCapabilities: jest.fn().mockResolvedValue(['read', 'write', 'execute']),
    isConnected: jest.fn().mockReturnValue(true)
  })),
}));

jest.mock('child_process', () => ({
  exec: jest.fn().mockImplementation((cmd, callback) => {
    // Mock tmux commands
    if (cmd.includes('tmux')) {
      if (cmd.includes('new-session')) {
        callback(null, { stdout: 'session created', stderr: '' });
      } else if (cmd.includes('list-sessions')) {
        callback(null, { stdout: 'test-session: 1 windows', stderr: '' });
      } else if (cmd.includes('send-keys')) {
        callback(null, { stdout: '', stderr: '' });
      } else {
        callback(null, { stdout: 'tmux command executed', stderr: '' });
      }
    } else {
      callback(null, { stdout: 'command executed', stderr: '' });
    }
  }),
  spawn: jest.fn().mockImplementation(() => ({
    stdout: { on: jest.fn(), pipe: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((event, callback) => {
      if (event === 'close') callback(0);
    }),
    kill: jest.fn()
  }))
}));

// Import the mocked fs modules
const fs = require('fs/promises');
const fsSync = require('fs');
const fsWithPromises = require('fs');

export function setupMocks() {
  beforeEach(() => {
    // Setup Neo4j mocks
    const mockSession = {
      run: jest.fn(),
      close: jest.fn(),
    } as any;

    const mockDriver = {
      session: jest.fn().mockReturnValue(mockSession),
      close: jest.fn(),
    } as any;

    // Reset all fs mocks
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
    fs.readFile.mockResolvedValue('{}');
    fs.readdir.mockResolvedValue([]);
    fs.access.mockResolvedValue(undefined);
    fs.stat.mockResolvedValue({ isDirectory: () => false, isFile: () => true, size: 100 });
    fs.unlink.mockResolvedValue(undefined);
    fs.mkdtemp.mockResolvedValue('/tmp/test-12345');
    fs.rm.mockResolvedValue(undefined);

    // Reset fs.promises mocks
    fsWithPromises.promises.mkdir.mockResolvedValue(undefined);
    fsWithPromises.promises.writeFile.mockResolvedValue(undefined);
    fsWithPromises.promises.readFile.mockResolvedValue('{}');
    fsWithPromises.promises.readdir.mockResolvedValue([]);
    fsWithPromises.promises.access.mockResolvedValue(undefined);
    fsWithPromises.promises.stat.mockResolvedValue({ isDirectory: () => false, isFile: () => true, size: 100 });
    fsWithPromises.promises.unlink.mockResolvedValue(undefined);
    fsWithPromises.promises.mkdtemp.mockResolvedValue('/tmp/test-12345');
    fsWithPromises.promises.rm.mockResolvedValue(undefined);

    // Reset fs sync mocks
    fsSync.existsSync.mockReturnValue(true);
    fsSync.mkdirSync.mockReturnValue(undefined);
    fsSync.writeFileSync.mockReturnValue(undefined);
    fsSync.readFileSync.mockReturnValue('{}');
    fsSync.readdirSync.mockReturnValue([]);
    fsSync.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true, size: 100 });
    fsSync.unlinkSync.mockReturnValue(undefined);

    (neo4j.driver as jest.Mock).mockReturnValue(mockDriver);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
}

export function createMockAgentConfig(agentId: string, role: string, capabilities: string[]) {
  return {
    id: agentId,
    role,
    capabilities,
    claudeConfig: {
      apiKey: 'test-api-key',
      defaultModel: 'claude-3-sonnet-20240229' as any,
      maxTokens: 4096,
      temperature: 0.7
    },
    workspaceRoot: '/tmp/test-workspace',
    cognitiveCanvasConfig: {
      uri: 'neo4j://localhost:7687',
      username: 'neo4j',
      password: 'test-password'
    }
  };
}

export function createMockTask(id: string, title: string, description: string) {
  return {
    id,
    title,
    description,
    status: 'pending',
    priority: 'high',
    projectId: 'test-project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assignedTo: id,
    dependencies: [],
    metadata: {}
  } as any;
}

export function createMockContext(overrides: any = {}) {
  return {
    projectInfo: {
      name: 'TestProject',
      language: 'typescript'
    },
    files: ['src/test.ts'],
    testFramework: 'jest',
    ...overrides
  };
}

export function suppressConsoleWarnings() {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore();
    (console.error as jest.Mock).mockRestore();
  });
}

// Neo4j Mock Utilities
export function createMockNeo4jDriver() {
  const mockSession = {
    run: jest.fn().mockResolvedValue({ records: [] }),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockDriver = {
    session: jest.fn().mockReturnValue(mockSession),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return { mockDriver, mockSession };
}

export function createMockNeo4jRecord(data: any) {
  return {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'properties' || typeof data.properties !== 'undefined') {
        return { properties: data };
      }
      return data[key] || data;
    }),
  };
}

// Database Mock Utilities
export function setupDatabaseMocks() {
  const { mockDriver, mockSession } = createMockNeo4jDriver();
  
  beforeEach(() => {
    (neo4j.driver as jest.Mock).mockReturnValue(mockDriver);
    mockSession.run.mockResolvedValue({ records: [] });
  });

  return { mockDriver, mockSession };
}

// Tmux Mock Utilities
export function createMockTmuxSession(sessionId: string, taskId: string) {
  return {
    sessionId,
    taskId,
    status: 'running' as const,
    createdAt: new Date(),
    windows: [{ name: 'main', active: true }]
  };
}

// MCP Client Mock Utilities
export function createMockMCPClient() {
  return {
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    executeCommand: jest.fn().mockResolvedValue({
      success: true,
      result: 'mocked result',
      error: null
    }),
    getCapabilities: jest.fn().mockResolvedValue(['read', 'write', 'execute']),
    isConnected: jest.fn().mockReturnValue(true),
    listResources: jest.fn().mockResolvedValue([]),
    readResource: jest.fn().mockResolvedValue({ content: 'mocked content' }),
    writeResource: jest.fn().mockResolvedValue(true)
  };
}

// File System Mock Utilities
export function setupFileSystemMocks() {
  beforeEach(() => {
    // Mock fs/promises
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
    fs.readFile.mockResolvedValue('{}');
    fs.readdir.mockResolvedValue([]);
    fs.access.mockResolvedValue(undefined);
    fs.stat.mockResolvedValue({ 
      isDirectory: () => false, 
      isFile: () => true, 
      size: 100,
      mtime: new Date()
    });
    fs.unlink.mockResolvedValue(undefined);
    fs.mkdtemp.mockResolvedValue('/tmp/test-12345');
    fs.rm.mockResolvedValue(undefined);

    // Mock fs.promises
    fsWithPromises.promises.mkdir.mockResolvedValue(undefined);
    fsWithPromises.promises.writeFile.mockResolvedValue(undefined);
    fsWithPromises.promises.readFile.mockResolvedValue('{}');
    fsWithPromises.promises.readdir.mockResolvedValue([]);
    fsWithPromises.promises.access.mockResolvedValue(undefined);
    fsWithPromises.promises.stat.mockResolvedValue({ 
      isDirectory: () => false, 
      isFile: () => true, 
      size: 100,
      mtime: new Date()
    });
    fsWithPromises.promises.unlink.mockResolvedValue(undefined);
    fsWithPromises.promises.mkdtemp.mockResolvedValue('/tmp/test-12345');
    fsWithPromises.promises.rm.mockResolvedValue(undefined);

    // Mock fs sync
    fsSync.existsSync.mockReturnValue(true);
    fsSync.mkdirSync.mockReturnValue(undefined);
    fsSync.writeFileSync.mockReturnValue(undefined);
    fsSync.readFileSync.mockReturnValue('{}');
    fsSync.readdirSync.mockReturnValue([]);
    fsSync.statSync.mockReturnValue({
      isDirectory: () => false,
      isFile: () => true,
      size: 100,
      mtime: new Date()
    });
    fsSync.unlinkSync.mockReturnValue(undefined);
  });
}

// Agent Mock Utilities
export function createMockAgent(agentType: string, capabilities: string[] = []) {
  return {
    id: `${agentType}-agent`,
    role: agentType,
    capabilities: capabilities.length > 0 ? capabilities : [`${agentType}_capability`],
    status: 'active',
    executeTask: jest.fn().mockResolvedValue({
      success: true,
      result: `${agentType} task completed`,
      artifacts: []
    }),
    generateCode: jest.fn().mockResolvedValue('// Generated code'),
    analyzeCode: jest.fn().mockResolvedValue({ analysis: 'Code analysis complete' }),
    runTests: jest.fn().mockResolvedValue({ passed: true, results: [] })
  };
}

// Orchestrator Mock Utilities
export function createMockOrchestrator() {
  return {
    assignTask: jest.fn().mockResolvedValue(true),
    monitorProgress: jest.fn().mockResolvedValue({ status: 'in_progress' }),
    handleError: jest.fn().mockResolvedValue({ recovered: true }),
    getProjectStatus: jest.fn().mockResolvedValue({ status: 'active' }),
    primeContext: jest.fn().mockResolvedValue({ context: 'primed' })
  };
}

// Test Data Factories
export function createMockPheromone(type: 'guide' | 'warn' = 'guide') {
  return {
    id: `${type}-pheromone-${Date.now()}`,
    type: `${type}_pheromone`,
    strength: type === 'guide' ? 0.8 : 0.6,
    context: `${type} context`,
    pattern: {
      taskOutcome: type === 'guide' ? 'success' : 'failure',
      promptPattern: 'test pattern',
      codePattern: 'test code',
      agentType: 'coder',
      complexity: 'medium',
      duration: 1000,
      errorTypes: type === 'warn' ? ['timeout'] : []
    },
    metadata: { test: true },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    decayRate: type === 'guide' ? 0.05 : 0.15
  };
}

export function createMockContract() {
  return {
    id: 'test-contract',
    name: 'Test API Contract',
    type: 'openapi' as const,
    version: '1.0.0',
    specification: {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/test': {
          get: { summary: 'Test endpoint' }
        }
      }
    },
    description: 'Test API contract',
    projectId: 'test-project',
    createdAt: new Date().toISOString()
  };
}

// Error Handling Mock Utilities
export function createMockErrorRecovery() {
  return {
    handleError: jest.fn().mockResolvedValue({
      recovered: true,
      strategy: 'retry',
      attempts: 1
    }),
    createErrorContext: jest.fn().mockReturnValue({
      errorType: 'test-error',
      context: { test: true }
    }),
    getRecoveryStrategies: jest.fn().mockReturnValue(['retry', 'fallback'])
  };
}

// Test Environment Setup
export function setupTestEnvironment() {
  setupDatabaseMocks();
  setupFileSystemMocks();
  suppressConsoleWarnings();
  
  beforeEach(() => {
    // Reset all environment variables
    process.env.NODE_ENV = 'test';
    process.env.CLAUDE_API_KEY = 'test-api-key';
    process.env.NEO4J_URI = 'bolt://localhost:7687';
    process.env.NEO4J_USERNAME = 'neo4j';
    process.env.NEO4J_PASSWORD = 'test-password';
  });
}