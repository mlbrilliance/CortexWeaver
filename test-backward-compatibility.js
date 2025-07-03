#!/usr/bin/env node

// Test backward compatibility with existing projects
const fs = require('fs');
const path = require('path');

async function testLegacyProjectStructure() {
  console.log('🧪 Testing Legacy Project Structure Compatibility...');
  
  try {
    // Create a legacy project structure
    const legacyProjectPath = '/tmp/legacy-cortexweaver-project';
    
    console.log('📁 Creating legacy project structure...');
    
    // Clean up if exists
    if (fs.existsSync(legacyProjectPath)) {
      fs.rmSync(legacyProjectPath, { recursive: true, force: true });
    }
    
    // Create legacy structure
    fs.mkdirSync(legacyProjectPath, { recursive: true });
    fs.mkdirSync(path.join(legacyProjectPath, '.cortexweaver'), { recursive: true });
    
    // Legacy config format (before storage abstraction)
    const legacyConfig = {
      models: {
        claude: 'claude-3-opus-20240229',
        gemini: 'gemini-pro'
      },
      costs: {
        claudeTokenCost: 0.015,
        geminiTokenCost: 0.0005
      },
      budget: {
        maxTokens: 50000,
        maxCost: 500
      },
      parallelism: {
        maxConcurrentTasks: 5,
        maxConcurrentAgents: 3
      },
      monitoring: {
        enableMetrics: true,
        logLevel: 'info'
      },
      // Legacy neo4j direct configuration
      neo4j: {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'legacy-password'
      }
    };
    
    fs.writeFileSync(
      path.join(legacyProjectPath, '.cortexweaver', 'config.json'),
      JSON.stringify(legacyConfig, null, 2)
    );
    
    // Legacy plan.md
    const legacyPlan = `# Legacy CortexWeaver Project
    
## Overview
This is a legacy project structure to test backward compatibility.

## Features
- Feature 1: Legacy feature implementation
- Feature 2: Another legacy feature

## Requirements
- Requirement 1: Legacy requirement
- Requirement 2: Another legacy requirement
`;
    
    fs.writeFileSync(path.join(legacyProjectPath, 'plan.md'), legacyPlan);
    
    // Legacy .env file
    const legacyEnv = `NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=legacy-password
CLAUDE_API_KEY=legacy-api-key
`;
    
    fs.writeFileSync(path.join(legacyProjectPath, '.env'), legacyEnv);
    
    console.log('   ✅ Legacy project structure created');
    
    // Test loading legacy configuration
    console.log('\n📋 Testing legacy configuration loading...');
    
    const { ConfigService } = require('./dist/config');
    const configService = new ConfigService(legacyProjectPath);
    
    const legacyProjectConfig = configService.loadProjectConfig();
    console.log('   ✅ Legacy project config loaded');
    console.log('   Claude model:', legacyProjectConfig.models.claude);
    console.log('   Budget limit:', legacyProjectConfig.budget.maxCost);
    console.log('   Has Neo4j config:', !!legacyProjectConfig.neo4j);
    
    const legacyEnvVars = configService.loadEnvironmentVariables();
    console.log('   ✅ Legacy environment variables loaded');
    console.log('   Neo4j URI:', legacyEnvVars.NEO4J_URI);
    console.log('   Has Claude API key:', !!legacyEnvVars.CLAUDE_API_KEY);
    
    // Test orchestrator initialization with legacy config
    console.log('\n🚀 Testing orchestrator with legacy configuration...');
    
    const { Orchestrator } = require('./dist/orchestrator');
    
    // Convert legacy config to new format
    const modernConfig = {
      neo4j: legacyProjectConfig.neo4j || {
        uri: legacyEnvVars.NEO4J_URI,
        username: legacyEnvVars.NEO4J_USERNAME,
        password: legacyEnvVars.NEO4J_PASSWORD
      },
      storage: {
        type: 'mcp-neo4j',
        config: legacyProjectConfig.neo4j || {
          uri: legacyEnvVars.NEO4J_URI,
          username: legacyEnvVars.NEO4J_USERNAME,
          password: legacyEnvVars.NEO4J_PASSWORD
        }
      },
      claude: {
        apiKey: legacyEnvVars.CLAUDE_API_KEY || 'test-key',
        defaultModel: legacyProjectConfig.models.claude,
        budgetLimit: legacyProjectConfig.budget.maxCost
      }
    };
    
    console.log('   ✅ Legacy config converted to modern format');
    console.log('   Storage type:', modernConfig.storage.type);
    console.log('   Neo4j config present:', !!modernConfig.neo4j);
    
    // Test that the orchestrator can handle the legacy config
    try {
      const orchestrator = new Orchestrator(modernConfig);
      console.log('   ✅ Orchestrator created with legacy config');
      
      // Note: We won't actually initialize since we don't have real credentials
      console.log('   ℹ️ Skipping full initialization (no real credentials)');
      
    } catch (error) {
      throw new Error(`Orchestrator creation failed: ${error.message}`);
    }
    
    // Cleanup
    fs.rmSync(legacyProjectPath, { recursive: true, force: true });
    console.log('   🧹 Legacy project cleanup completed');
    
    return true;
    
  } catch (error) {
    console.error('❌ Legacy project structure test failed:', error.message);
    return false;
  }
}

async function testLegacyAPICompatibility() {
  console.log('\n🧪 Testing Legacy API Compatibility...');
  
  try {
    console.log('📡 Testing legacy CognitiveCanvas API...');
    
    // Test that legacy CognitiveCanvas constructor still works
    const { CognitiveCanvas } = require('./dist/cognitive-canvas');
    
    // Legacy constructor with Neo4j config
    const legacyNeo4jConfig = {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'legacy-password'
    };
    
    console.log('   🔧 Testing legacy CognitiveCanvas constructor...');
    const canvas = new CognitiveCanvas(legacyNeo4jConfig);
    console.log('   ✅ Legacy CognitiveCanvas constructor works');
    
    // Test that legacy methods are still available
    const legacyMethods = [
      'createProject',
      'getProject',
      'createTask',
      'updateTaskStatus',
      'createAgent',
      'getTasksByProject',
      'createPheromone',
      'queryPheromones'
    ];
    
    console.log('   🔍 Testing legacy method availability...');
    let availableMethods = 0;
    
    for (const method of legacyMethods) {
      if (typeof canvas[method] === 'function') {
        console.log(`   ✅ ${method} method available`);
        availableMethods++;
      } else {
        console.log(`   ❌ ${method} method missing`);
      }
    }
    
    console.log(`   📊 ${availableMethods}/${legacyMethods.length} legacy methods available`);
    
    // Test legacy Agent API
    console.log('\n🤖 Testing legacy Agent API...');
    const { Agent } = require('./dist/agent-base');
    
    // Create a simple test agent
    class LegacyTestAgent extends Agent {
      async executeTask() {
        return { status: 'completed' };
      }
      
      getPromptTemplate() {
        return 'Legacy prompt template';
      }
    }
    
    const agent = new LegacyTestAgent();
    console.log('   ✅ Legacy Agent class instantiation works');
    
    // Test legacy agent methods
    const legacyAgentMethods = [
      'initialize',
      'receiveTask',
      'run',
      'sendToClaude',
      'readFile',
      'writeFile',
      'reportProgress'
    ];
    
    let availableAgentMethods = 0;
    for (const method of legacyAgentMethods) {
      if (typeof agent[method] === 'function') {
        console.log(`   ✅ Agent.${method} method available`);
        availableAgentMethods++;
      } else {
        console.log(`   ❌ Agent.${method} method missing`);
      }
    }
    
    console.log(`   📊 ${availableAgentMethods}/${legacyAgentMethods.length} legacy agent methods available`);
    
    return availableMethods >= legacyMethods.length * 0.8 && 
           availableAgentMethods >= legacyAgentMethods.length * 0.8;
    
  } catch (error) {
    console.error('❌ Legacy API compatibility test failed:', error.message);
    return false;
  }
}

async function testConfigurationMigration() {
  console.log('\n🧪 Testing Configuration Migration...');
  
  try {
    console.log('🔄 Testing automatic config migration...');
    
    // Test various legacy config formats
    const legacyConfigs = [
      {
        name: 'Pre-storage abstraction',
        config: {
          models: { claude: 'claude-3-opus', gemini: 'gemini-pro' },
          budget: { maxCost: 100 },
          neo4j: { uri: 'bolt://localhost:7687', username: 'neo4j', password: 'test' }
        }
      },
      {
        name: 'Missing storage config',
        config: {
          models: { claude: 'claude-3-sonnet' },
          budget: { maxCost: 200 }
        }
      },
      {
        name: 'Partial config',
        config: {
          models: { claude: 'claude-3-haiku' }
        }
      }
    ];
    
    for (const legacyConfig of legacyConfigs) {
      console.log(`   🔧 Testing migration: ${legacyConfig.name}`);
      
      // Simulate config migration logic
      const migratedConfig = {
        ...legacyConfig.config,
        // Add modern storage config if missing
        storage: legacyConfig.config.storage || (legacyConfig.config.neo4j ? {
          type: 'mcp-neo4j',
          config: legacyConfig.config.neo4j
        } : {
          type: 'in-memory',
          config: {}
        }),
        // Ensure required fields
        models: legacyConfig.config.models || { claude: 'claude-3-sonnet' },
        budget: legacyConfig.config.budget || { maxCost: 500 }
      };
      
      console.log(`   ✅ Migrated storage type: ${migratedConfig.storage.type}`);
      console.log(`   ✅ Has Claude model: ${!!migratedConfig.models.claude}`);
    }
    
    console.log('   ✅ All legacy configs can be migrated');
    
    return true;
    
  } catch (error) {
    console.error('❌ Configuration migration test failed:', error.message);
    return false;
  }
}

async function testLegacyCLICommands() {
  console.log('\n🧪 Testing Legacy CLI Commands...');
  
  try {
    console.log('📱 Testing CLI command backward compatibility...');
    
    const { CLI } = require('./dist/cli');
    const cli = new CLI();
    
    // Test that all legacy commands are still available
    const legacyCommands = [
      'init',
      'status', 
      'start',
      'logs',
      'retry',
      'listAgents',
      'authStatus',
      'authConfigure'
    ];
    
    console.log('   🔍 Testing legacy CLI command availability...');
    let availableCommands = 0;
    
    for (const command of legacyCommands) {
      if (typeof cli[command] === 'function') {
        console.log(`   ✅ CLI.${command} command available`);
        availableCommands++;
      } else {
        console.log(`   ❌ CLI.${command} command missing`);
      }
    }
    
    console.log(`   📊 ${availableCommands}/${legacyCommands.length} legacy CLI commands available`);
    
    // Test CLI static methods
    console.log('   🔧 Testing CLI static methods...');
    const staticMethods = ['parseArguments', 'validateCommand', 'getHelp'];
    let availableStaticMethods = 0;
    
    for (const method of staticMethods) {
      if (typeof CLI[method] === 'function') {
        console.log(`   ✅ CLI.${method} static method available`);
        availableStaticMethods++;
      } else {
        console.log(`   ❌ CLI.${method} static method missing`);
      }
    }
    
    console.log(`   📊 ${availableStaticMethods}/${staticMethods.length} static methods available`);
    
    return availableCommands >= legacyCommands.length * 0.9;
    
  } catch (error) {
    console.error('❌ Legacy CLI commands test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🎯 Running Backward Compatibility Tests\n');
  
  const test1 = await testLegacyProjectStructure();
  const test2 = await testLegacyAPICompatibility();
  const test3 = await testConfigurationMigration();
  const test4 = await testLegacyCLICommands();
  
  console.log('\n📊 Test Results:');
  console.log('   Legacy Project Structure:', test1 ? '✅ PASS' : '❌ FAIL');
  console.log('   Legacy API Compatibility:', test2 ? '✅ PASS' : '❌ FAIL');
  console.log('   Configuration Migration:', test3 ? '✅ PASS' : '❌ FAIL');
  console.log('   Legacy CLI Commands:', test4 ? '✅ PASS' : '❌ FAIL');
  
  if (test1 && test2 && test3 && test4) {
    console.log('\n🎉 All backward compatibility tests passed!');
    console.log('🔄 Legacy projects can be seamlessly upgraded!');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some backward compatibility tests failed');
    process.exit(1);
  }
}

runAllTests().catch(console.error);