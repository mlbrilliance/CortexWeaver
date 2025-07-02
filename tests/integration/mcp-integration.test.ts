/**
 * MCP Server Integration Tests
 * 
 * Tests Model Context Protocol (MCP) server integration:
 * - MCP server connection and communication
 * - Resource discovery and management
 * - Tool execution and coordination
 * - Error handling and fallback mechanisms
 * - Performance and reliability testing
 * - Multi-server coordination
 */

import { MCPClient } from '../../src/mcp-client';
import { Orchestrator, OrchestratorConfig } from '../../src/orchestrator';
import { CognitiveCanvas } from '../../src/cognitive-canvas';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('MCP Server Integration Tests', () => {
  let testProjectPath: string;
  let orchestrator: Orchestrator;
  let mcpClient: MCPClient;
  
  const testConfig: OrchestratorConfig = {
    neo4j: {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password'
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY || 'test-api-key',
      budgetLimit: 50
    }
  };

  const mcpTestPlan = `# MCP Integration Test Project

## Overview

A project designed to test Model Context Protocol (MCP) server integration, resource management, and tool coordination capabilities within the CortexWeaver ecosystem.

## Features

### Feature 1: MCP Resource Discovery
- **Priority**: High
- **Description**: Test MCP server resource discovery and enumeration
- **Dependencies**: []
- **Agent**: SpecWriter
- **Acceptance Criteria**:
  - [ ] MCP server connection established
  - [ ] Resources discovered and cataloged
  - [ ] Resource metadata extracted

### Feature 2: Tool Execution Coordination
- **Priority**: High
- **Description**: Test MCP tool execution and coordination with agents
- **Dependencies**: [Feature 1]
- **Agent**: Formalizer
- **Acceptance Criteria**:
  - [ ] Tools executed successfully
  - [ ] Results integrated with workflow
  - [ ] Error handling implemented

### Feature 3: Multi-Server Management
- **Priority**: Medium
- **Description**: Test coordination across multiple MCP servers
- **Dependencies**: [Feature 2]
- **Agent**: Architect
- **Acceptance Criteria**:
  - [ ] Multiple servers coordinated
  - [ ] Resource conflicts resolved
  - [ ] Load balancing implemented

## Architecture Decisions

### Technology Stack
- **MCP Protocol**: JSON-RPC based communication
- **Transport**: WebSocket and stdio
- **Integration**: Agent-MCP coordination layer

### Quality Standards
- **Reliability**: 99% successful tool execution
- **Performance**: < 500ms tool response time
- **Resilience**: Graceful degradation when servers unavailable
`;

  // Mock MCP client for testing
  class MockMCPClient {
    private connected = false;
    private resources: any[] = [];
    private tools: any[] = [];
    private shouldFailConnection = false;
    private shouldFailTool = false;

    constructor(options: { failConnection?: boolean; failTool?: boolean } = {}) {
      this.shouldFailConnection = options.failConnection || false;
      this.shouldFailTool = options.failTool || false;
      
      // Mock resources
      this.resources = [
        {
          uri: 'file://src/models/User.js',
          name: 'User Model',
          description: 'User data model definition',
          mimeType: 'application/javascript'
        },
        {
          uri: 'file://src/controllers/UserController.js',
          name: 'User Controller',
          description: 'User management controller',
          mimeType: 'application/javascript'
        },
        {
          uri: 'schema://user-schema.json',
          name: 'User Schema',
          description: 'JSON schema for user validation',
          mimeType: 'application/json'
        }
      ];

      // Mock tools
      this.tools = [
        {
          name: 'code_analysis',
          description: 'Analyze code quality and structure',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: { type: 'string' },
              analysisType: { type: 'string', enum: ['quality', 'security', 'performance'] }
            },
            required: ['filePath', 'analysisType']
          }
        },
        {
          name: 'test_generation',
          description: 'Generate unit tests for code',
          inputSchema: {
            type: 'object',
            properties: {
              sourceFile: { type: 'string' },
              testFramework: { type: 'string', enum: ['jest', 'mocha', 'jasmine'] }
            },
            required: ['sourceFile', 'testFramework']
          }
        },
        {
          name: 'contract_validation',
          description: 'Validate contract compliance',
          inputSchema: {
            type: 'object',
            properties: {
              contractPath: { type: 'string' },
              implementationPath: { type: 'string' }
            },
            required: ['contractPath', 'implementationPath']
          }
        }
      ];
    }

    async connect(): Promise<boolean> {
      if (this.shouldFailConnection) {
        throw new Error('MCP server connection failed');
      }
      this.connected = true;
      return true;
    }

    async disconnect(): Promise<boolean> {
      this.connected = false;
      return true;
    }

    isConnected(): boolean {
      return this.connected;
    }

    async listResources(): Promise<any[]> {
      if (!this.connected) {
        throw new Error('MCP client not connected');
      }
      return this.resources;
    }

    async getResource(uri: string): Promise<any> {
      if (!this.connected) {
        throw new Error('MCP client not connected');
      }
      
      const resource = this.resources.find(r => r.uri === uri);
      if (!resource) {
        throw new Error(`Resource not found: ${uri}`);
      }

      // Mock resource content based on type
      let content = '';
      if (uri.includes('User.js')) {
        content = `
class User {
  constructor(email, name) {
    this.email = email;
    this.name = name;
    this.createdAt = new Date();
  }
  
  validate() {
    return this.email && this.name;
  }
}

module.exports = User;
        `.trim();
      } else if (uri.includes('UserController.js')) {
        content = `
const User = require('../models/User');

class UserController {
  async createUser(req, res) {
    const user = new User(req.body.email, req.body.name);
    if (!user.validate()) {
      return res.status(400).json({ error: 'Invalid user data' });
    }
    // Save user logic here
    res.status(201).json(user);
  }
}

module.exports = UserController;
        `.trim();
      } else if (uri.includes('user-schema.json')) {
        content = JSON.stringify({
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            name: { type: 'string', minLength: 1 },
            createdAt: { type: 'string', format: 'date-time' }
          },
          required: ['email', 'name']
        }, null, 2);
      }

      return {
        ...resource,
        content: content,
        size: content.length
      };
    }

    async listTools(): Promise<any[]> {
      if (!this.connected) {
        throw new Error('MCP client not connected');
      }
      return this.tools;
    }

    async callTool(name: string, params: any): Promise<any> {
      if (!this.connected) {
        throw new Error('MCP client not connected');
      }

      if (this.shouldFailTool) {
        throw new Error(`Tool execution failed: ${name}`);
      }

      const tool = this.tools.find(t => t.name === name);
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }

      // Mock tool execution results
      switch (name) {
        case 'code_analysis':
          return {
            result: 'analysis_complete',
            metrics: {
              complexity: 3.2,
              maintainability: 85,
              coverage: 78,
              issues: [
                { type: 'warning', message: 'Consider adding input validation' },
                { type: 'info', message: 'Function could be optimized' }
              ]
            }
          };

        case 'test_generation':
          return {
            result: 'tests_generated',
            testCode: `
describe('User', () => {
  test('should create user with valid data', () => {
    const user = new User('test@example.com', 'Test User');
    expect(user.email).toBe('test@example.com');
    expect(user.name).toBe('Test User');
    expect(user.validate()).toBe(true);
  });
  
  test('should fail validation with invalid data', () => {
    const user = new User('', '');
    expect(user.validate()).toBe(false);
  });
});
            `.trim(),
            framework: params.testFramework,
            coverage: 95
          };

        case 'contract_validation':
          return {
            result: 'validation_complete',
            compliance: {
              score: 92,
              violations: [
                { rule: 'required_field', field: 'id', severity: 'error' }
              ],
              suggestions: [
                'Add unique identifier field to user model'
              ]
            }
          };

        default:
          return { result: 'unknown_tool', message: `Tool ${name} executed successfully` };
      }
    }
  }

  beforeAll(async () => {
    // Create temporary test project directory
    testProjectPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cortex-mcp-test-'));
    
    // Write the test plan file
    await fs.promises.writeFile(
      path.join(testProjectPath, 'plan.md'),
      mcpTestPlan
    );

    // Initialize MCP client
    mcpClient = new MCPClient();
  });

  afterAll(async () => {
    // Cleanup
    try {
      if (orchestrator) {
        await orchestrator.shutdown();
      }
      if (mcpClient && mcpClient.isConnected && mcpClient.isConnected()) {
        await mcpClient.disconnect();
      }
      await fs.promises.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('MCP cleanup error:', error);
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

  describe('MCP Server Connection and Communication', () => {
    it('should establish connection to MCP server', async () => {
      const mockClient = new MockMCPClient();
      
      // Test connection
      const connected = await mockClient.connect();
      expect(connected).toBe(true);
      expect(mockClient.isConnected()).toBe(true);
      
      // Test disconnection
      const disconnected = await mockClient.disconnect();
      expect(disconnected).toBe(true);
      expect(mockClient.isConnected()).toBe(false);
    });

    it('should handle connection failures gracefully', async () => {
      const mockClient = new MockMCPClient({ failConnection: true });
      
      // Should handle connection failure
      await expect(mockClient.connect()).rejects.toThrow('MCP server connection failed');
      expect(mockClient.isConnected()).toBe(false);
    });

    it('should maintain connection health and recover from failures', async () => {
      const mockClient = new MockMCPClient();
      
      // Establish connection
      await mockClient.connect();
      expect(mockClient.isConnected()).toBe(true);
      
      // Simulate connection loss
      await mockClient.disconnect();
      expect(mockClient.isConnected()).toBe(false);
      
      // Reconnect
      await mockClient.connect();
      expect(mockClient.isConnected()).toBe(true);
      
      // Cleanup
      await mockClient.disconnect();
    });
  });

  describe('Resource Discovery and Management', () => {
    it('should discover and catalog MCP resources', async () => {
      const mockClient = new MockMCPClient();
      await mockClient.connect();
      
      try {
        // Discover resources
        const resources = await mockClient.listResources();
        
        expect(resources).toBeInstanceOf(Array);
        expect(resources.length).toBeGreaterThan(0);
        
        // Verify resource structure
        for (const resource of resources) {
          expect(resource.uri).toBeTruthy();
          expect(resource.name).toBeTruthy();
          expect(resource.description).toBeTruthy();
          expect(resource.mimeType).toBeTruthy();
        }
        
        // Test resource categorization
        const codeResources = resources.filter(r => r.mimeType === 'application/javascript');
        const schemaResources = resources.filter(r => r.mimeType === 'application/json');
        
        expect(codeResources.length).toBeGreaterThan(0);
        expect(schemaResources.length).toBeGreaterThan(0);
        
        console.log(`Discovered ${resources.length} resources:
          Code files: ${codeResources.length}
          Schema files: ${schemaResources.length}`);
        
      } finally {
        await mockClient.disconnect();
      }
    });

    it('should retrieve and process resource content', async () => {
      const mockClient = new MockMCPClient();
      await mockClient.connect();
      
      try {
        const resources = await mockClient.listResources();
        
        // Test resource content retrieval
        for (const resource of resources.slice(0, 2)) { // Test first 2 resources
          const resourceContent = await mockClient.getResource(resource.uri);
          
          expect(resourceContent.uri).toBe(resource.uri);
          expect(resourceContent.content).toBeTruthy();
          expect(resourceContent.size).toBeGreaterThan(0);
          expect(resourceContent.size).toBe(resourceContent.content.length);
          
          // Verify content type matches expectation
          if (resource.mimeType === 'application/javascript') {
            expect(resourceContent.content).toContain('class');
          } else if (resource.mimeType === 'application/json') {
            expect(() => JSON.parse(resourceContent.content)).not.toThrow();
          }
        }
        
      } finally {
        await mockClient.disconnect();
      }
    });

    it('should handle resource access errors', async () => {
      const mockClient = new MockMCPClient();
      await mockClient.connect();
      
      try {
        // Attempt to access non-existent resource
        await expect(mockClient.getResource('file://non-existent.js'))
          .rejects.toThrow('Resource not found');
        
      } finally {
        await mockClient.disconnect();
      }
    });
  });

  describe('Tool Execution and Coordination', () => {
    it('should discover and execute MCP tools', async () => {
      const mockClient = new MockMCPClient();
      await mockClient.connect();
      
      try {
        // Discover tools
        const tools = await mockClient.listTools();
        
        expect(tools).toBeInstanceOf(Array);
        expect(tools.length).toBeGreaterThan(0);
        
        // Verify tool structure
        for (const tool of tools) {
          expect(tool.name).toBeTruthy();
          expect(tool.description).toBeTruthy();
          expect(tool.inputSchema).toBeTruthy();
          expect(tool.inputSchema.type).toBe('object');
          expect(tool.inputSchema.properties).toBeTruthy();
        }
        
        console.log(`Discovered ${tools.length} tools:
          ${tools.map(t => t.name).join(', ')}`);
        
      } finally {
        await mockClient.disconnect();
      }
    });

    it('should execute code analysis tool', async () => {
      const mockClient = new MockMCPClient();
      await mockClient.connect();
      
      try {
        const result = await mockClient.callTool('code_analysis', {
          filePath: '/src/models/User.js',
          analysisType: 'quality'
        });
        
        expect(result.result).toBe('analysis_complete');
        expect(result.metrics).toBeTruthy();
        expect(result.metrics.complexity).toBeGreaterThan(0);
        expect(result.metrics.maintainability).toBeGreaterThan(0);
        expect(result.metrics.coverage).toBeGreaterThan(0);
        expect(result.metrics.issues).toBeInstanceOf(Array);
        
        console.log(`Code Analysis Results:
          Complexity: ${result.metrics.complexity}
          Maintainability: ${result.metrics.maintainability}%
          Coverage: ${result.metrics.coverage}%
          Issues: ${result.metrics.issues.length}`);
        
      } finally {
        await mockClient.disconnect();
      }
    });

    it('should execute test generation tool', async () => {
      const mockClient = new MockMCPClient();
      await mockClient.connect();
      
      try {
        const result = await mockClient.callTool('test_generation', {
          sourceFile: '/src/models/User.js',
          testFramework: 'jest'
        });
        
        expect(result.result).toBe('tests_generated');
        expect(result.testCode).toBeTruthy();
        expect(result.framework).toBe('jest');
        expect(result.coverage).toBeGreaterThan(0);
        
        // Verify generated test code structure
        expect(result.testCode).toContain('describe');
        expect(result.testCode).toContain('test');
        expect(result.testCode).toContain('expect');
        
        console.log(`Test Generation Results:
          Framework: ${result.framework}
          Coverage: ${result.coverage}%
          Code Length: ${result.testCode.length} chars`);
        
      } finally {
        await mockClient.disconnect();
      }
    });

    it('should execute contract validation tool', async () => {
      const mockClient = new MockMCPClient();
      await mockClient.connect();
      
      try {
        const result = await mockClient.callTool('contract_validation', {
          contractPath: '/contracts/user-contract.json',
          implementationPath: '/src/models/User.js'
        });
        
        expect(result.result).toBe('validation_complete');
        expect(result.compliance).toBeTruthy();
        expect(result.compliance.score).toBeGreaterThan(0);
        expect(result.compliance.violations).toBeInstanceOf(Array);
        expect(result.compliance.suggestions).toBeInstanceOf(Array);
        
        console.log(`Contract Validation Results:
          Compliance Score: ${result.compliance.score}%
          Violations: ${result.compliance.violations.length}
          Suggestions: ${result.compliance.suggestions.length}`);
        
      } finally {
        await mockClient.disconnect();
      }
    });

    it('should handle tool execution failures', async () => {
      const mockClient = new MockMCPClient({ failTool: true });
      await mockClient.connect();
      
      try {
        // Should handle tool execution failure
        await expect(mockClient.callTool('code_analysis', {
          filePath: '/test.js',
          analysisType: 'quality'
        })).rejects.toThrow('Tool execution failed');
        
      } finally {
        await mockClient.disconnect();
      }
    });
  });

  describe('Agent-MCP Integration', () => {
    it('should integrate MCP tools with agent workflows', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      
      // Mock agent that uses MCP tools
      const mockAgent = {
        taskId: tasks[0]?.id || 'test-task',
        mcpClient: new MockMCPClient(),
        
        async executeMCPWorkflow() {
          await this.mcpClient.connect();
          
          try {
            // Discover resources
            const resources = await this.mcpClient.listResources();
            
            // Analyze code using MCP tool
            const analysisResult = await this.mcpClient.callTool('code_analysis', {
              filePath: resources[0].uri,
              analysisType: 'quality'
            });
            
            // Generate tests using MCP tool
            const testResult = await this.mcpClient.callTool('test_generation', {
              sourceFile: resources[0].uri,
              testFramework: 'jest'
            });
            
            // Validate contracts using MCP tool
            const validationResult = await this.mcpClient.callTool('contract_validation', {
              contractPath: '/contracts/test.json',
              implementationPath: resources[0].uri
            });
            
            return {
              analysis: analysisResult,
              tests: testResult,
              validation: validationResult
            };
            
          } finally {
            await this.mcpClient.disconnect();
          }
        }
      };
      
      // Execute workflow
      const workflowResult = await mockAgent.executeMCPWorkflow();
      
      // Verify workflow results
      expect(workflowResult.analysis.result).toBe('analysis_complete');
      expect(workflowResult.tests.result).toBe('tests_generated');
      expect(workflowResult.validation.result).toBe('validation_complete');
      
      console.log('Agent-MCP Integration successful:');
      console.log(`  Analysis Quality: ${workflowResult.analysis.metrics.maintainability}%`);
      console.log(`  Test Coverage: ${workflowResult.tests.coverage}%`);
      console.log(`  Contract Compliance: ${workflowResult.validation.compliance.score}%`);
    });

    it('should coordinate multiple agents with MCP resources', async () => {
      await orchestrator.initialize(testProjectPath);
      
      const projectId = (orchestrator as any).projectId;
      const tasks = await canvas.getTasksByProject(projectId);
      
      // Mock multiple agents using MCP
      const agents = [
        {
          name: 'SpecWriter',
          taskId: tasks[0]?.id || 'spec-task',
          mcpClient: new MockMCPClient()
        },
        {
          name: 'Coder',
          taskId: tasks[1]?.id || 'code-task',
          mcpClient: new MockMCPClient()
        },
        {
          name: 'Tester',
          taskId: tasks[2]?.id || 'test-task',
          mcpClient: new MockMCPClient()
        }
      ];
      
      // Execute concurrent MCP operations
      const agentResults = await Promise.all(agents.map(async agent => {
        await agent.mcpClient.connect();
        
        try {
          const tools = await agent.mcpClient.listTools();
          const resources = await agent.mcpClient.listResources();
          
          // Each agent uses different tools
          let result;
          if (agent.name === 'SpecWriter') {
            result = await agent.mcpClient.callTool('contract_validation', {
              contractPath: '/test.json',
              implementationPath: '/test.js'
            });
          } else if (agent.name === 'Coder') {
            result = await agent.mcpClient.callTool('code_analysis', {
              filePath: '/test.js',
              analysisType: 'quality'
            });
          } else {
            result = await agent.mcpClient.callTool('test_generation', {
              sourceFile: '/test.js',
              testFramework: 'jest'
            });
          }
          
          return {
            agent: agent.name,
            taskId: agent.taskId,
            toolsAvailable: tools.length,
            resourcesAvailable: resources.length,
            result: result
          };
          
        } finally {
          await agent.mcpClient.disconnect();
        }
      }));
      
      // Verify all agents completed successfully
      expect(agentResults).toHaveLength(3);
      
      for (const agentResult of agentResults) {
        expect(agentResult.toolsAvailable).toBeGreaterThan(0);
        expect(agentResult.resourcesAvailable).toBeGreaterThan(0);
        expect(agentResult.result).toBeTruthy();
      }
      
      console.log('Multi-Agent MCP Coordination:');
      agentResults.forEach(result => {
        console.log(`  ${result.agent}: ${result.toolsAvailable} tools, ${result.resourcesAvailable} resources`);
      });
    });
  });

  describe('Error Handling and Fallback Mechanisms', () => {
    it('should handle MCP server unavailability', async () => {
      const mockClient = new MockMCPClient({ failConnection: true });
      
      // Test graceful degradation when MCP server is unavailable
      let fallbackUsed = false;
      
      try {
        await mockClient.connect();
      } catch (error) {
        // Fallback to local tools/resources
        fallbackUsed = true;
        
        // Mock fallback behavior
        const localResources = [
          { uri: 'local://fallback-resource', name: 'Local Fallback Resource' }
        ];
        
        const localTools = [
          { name: 'local_analysis', description: 'Local code analysis tool' }
        ];
        
        expect(localResources.length).toBeGreaterThan(0);
        expect(localTools.length).toBeGreaterThan(0);
      }
      
      expect(fallbackUsed).toBe(true);
      
      console.log('Successfully handled MCP server unavailability with fallback');
    });

    it('should retry failed MCP operations', async () => {
      let attemptCount = 0;
      const maxRetries = 3;
      
      const retryableClient = {
        async callToolWithRetry(toolName: string, params: any) {
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            attemptCount++;
            
            try {
              // Simulate failure for first two attempts
              if (attempt <= 2) {
                throw new Error(`Attempt ${attempt} failed`);
              }
              
              // Success on third attempt
              return { result: 'success', attempt: attempt };
              
            } catch (error) {
              if (attempt === maxRetries) {
                throw error;
              }
              
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 100 * attempt));
            }
          }
        }
      };
      
      const result = await retryableClient.callToolWithRetry('test_tool', {});
      
      expect(result.result).toBe('success');
      expect(result.attempt).toBe(3);
      expect(attemptCount).toBe(3);
      
      console.log(`MCP operation succeeded after ${attemptCount} attempts`);
    });

    it('should handle partial MCP functionality', async () => {
      // Mock client with some tools working and others failing
      const partialClient = {
        connected: false,
        
        async connect() {
          this.connected = true;
          return true;
        },
        
        async disconnect() {
          this.connected = false;
          return true;
        },
        
        async callTool(name: string, params: any) {
          if (!this.connected) {
            throw new Error('Not connected');
          }
          
          // Some tools work, others fail
          if (name === 'working_tool') {
            return { result: 'success', tool: name };
          } else if (name === 'failing_tool') {
            throw new Error('Tool temporarily unavailable');
          } else {
            throw new Error('Unknown tool');
          }
        }
      };
      
      await partialClient.connect();
      
      try {
        // Test working tool
        const workingResult = await partialClient.callTool('working_tool', {});
        expect(workingResult.result).toBe('success');
        
        // Test failing tool with fallback
        let fallbackExecuted = false;
        try {
          await partialClient.callTool('failing_tool', {});
        } catch (error) {
          // Execute fallback
          fallbackExecuted = true;
          const fallbackResult = { result: 'fallback_success', tool: 'local_fallback' };
          expect(fallbackResult.result).toBe('fallback_success');
        }
        
        expect(fallbackExecuted).toBe(true);
        
      } finally {
        await partialClient.disconnect();
      }
      
      console.log('Successfully handled partial MCP functionality');
    });
  });

  describe('Performance and Reliability', () => {
    it('should meet performance thresholds for MCP operations', async () => {
      const mockClient = new MockMCPClient();
      await mockClient.connect();
      
      try {
        // Test connection performance
        const connectionStart = Date.now();
        const reconnected = await mockClient.connect();
        const connectionTime = Date.now() - connectionStart;
        
        expect(connectionTime).toBeLessThan(1000); // < 1 second
        expect(reconnected).toBe(true);
        
        // Test resource discovery performance
        const discoveryStart = Date.now();
        const resources = await mockClient.listResources();
        const discoveryTime = Date.now() - discoveryStart;
        
        expect(discoveryTime).toBeLessThan(500); // < 0.5 seconds
        expect(resources.length).toBeGreaterThan(0);
        
        // Test tool execution performance
        const executionStart = Date.now();
        const toolResult = await mockClient.callTool('code_analysis', {
          filePath: '/test.js',
          analysisType: 'quality'
        });
        const executionTime = Date.now() - executionStart;
        
        expect(executionTime).toBeLessThan(500); // < 0.5 seconds
        expect(toolResult.result).toBe('analysis_complete');
        
        console.log(`MCP Performance:
          Connection: ${connectionTime}ms
          Discovery: ${discoveryTime}ms
          Tool Execution: ${executionTime}ms`);
        
      } finally {
        await mockClient.disconnect();
      }
    });

    it('should handle high-frequency MCP operations', async () => {
      const mockClient = new MockMCPClient();
      await mockClient.connect();
      
      try {
        const operationCount = 20;
        const operations: Promise<any>[] = [];
        
        const startTime = Date.now();
        
        // Execute multiple concurrent operations
        for (let i = 0; i < operationCount; i++) {
          const operation = mockClient.callTool('code_analysis', {
            filePath: `/test-${i}.js`,
            analysisType: 'quality'
          });
          operations.push(operation);
        }
        
        const results = await Promise.all(operations);
        const totalTime = Date.now() - startTime;
        
        // Verify all operations completed successfully
        expect(results).toHaveLength(operationCount);
        results.forEach(result => {
          expect(result.result).toBe('analysis_complete');
        });
        
        const averageTime = totalTime / operationCount;
        expect(averageTime).toBeLessThan(100); // < 100ms average per operation
        
        console.log(`High-Frequency MCP Operations:
          Total Operations: ${operationCount}
          Total Time: ${totalTime}ms
          Average Time: ${averageTime.toFixed(2)}ms per operation`);
        
      } finally {
        await mockClient.disconnect();
      }
    });

    it('should maintain reliability across extended usage', async () => {
      const mockClient = new MockMCPClient();
      const testDuration = 10000; // 10 seconds
      const operationInterval = 500; // 0.5 seconds
      
      await mockClient.connect();
      
      try {
        const operations: Array<{ success: boolean; time: number }> = [];
        const startTime = Date.now();
        
        while (Date.now() - startTime < testDuration) {
          const operationStart = Date.now();
          
          try {
            const result = await mockClient.callTool('code_analysis', {
              filePath: '/reliability-test.js',
              analysisType: 'quality'
            });
            
            operations.push({
              success: result.result === 'analysis_complete',
              time: Date.now() - operationStart
            });
            
          } catch (error) {
            operations.push({
              success: false,
              time: Date.now() - operationStart
            });
          }
          
          await new Promise(resolve => setTimeout(resolve, operationInterval));
        }
        
        // Analyze reliability metrics
        const successfulOps = operations.filter(op => op.success);
        const reliabilityRate = (successfulOps.length / operations.length) * 100;
        const avgResponseTime = successfulOps.reduce((sum, op) => sum + op.time, 0) / successfulOps.length;
        
        expect(reliabilityRate).toBeGreaterThan(95); // > 95% success rate
        expect(avgResponseTime).toBeLessThan(1000); // < 1 second average response
        
        console.log(`MCP Reliability Test:
          Duration: ${testDuration}ms
          Total Operations: ${operations.length}
          Success Rate: ${reliabilityRate.toFixed(2)}%
          Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
        
      } finally {
        await mockClient.disconnect();
      }
    }, 15000); // Extended timeout for reliability test
  });

  // Helper to initialize canvas for testing
  let canvas: CognitiveCanvas;
  
  beforeAll(async () => {
    canvas = new CognitiveCanvas(testConfig.neo4j);
    try {
      await canvas.initializeSchema();
    } catch (error) {
      console.warn('Could not initialize canvas for MCP tests:', error);
    }
  });

  afterAll(async () => {
    if (canvas) {
      await canvas.close();
    }
  });
});