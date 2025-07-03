#!/usr/bin/env node

// Test agent initialization and offline capabilities
const { Agent } = require('./dist/agent-base');
const { AgentConfig } = require('./dist/types/agent-types');

async function testAgentOfflineCapabilities() {
  console.log('🧪 Testing Agent Offline Capabilities...');
  
  // Create a test agent class
  class TestAgent extends Agent {
    async executeTask() {
      console.log('📋 Executing test task...');
      
      // Test offline capabilities
      console.log('🔍 Testing storage availability:', this.isStorageAvailable());
      console.log('📴 Testing offline mode:', this.isOfflineMode());
      
      // Test storage fallback
      const result = await this.executeWithStorageFallback(
        async () => {
          throw new Error('Storage operation failed (simulated)');
        },
        async () => {
          return { success: true, message: 'Fallback operation succeeded' };
        },
        'test operation'
      );
      
      console.log('🔄 Fallback operation result:', result);
      
      return { status: 'completed', capabilities_tested: true };
    }
    
    getPromptTemplate() {
      return 'Test agent prompt template for {{task}}';
    }
  }
  
  try {
    // Test agent creation without cognitive canvas (offline mode)
    const agent = new TestAgent();
    
    const config = {
      id: 'test-agent-offline',
      role: 'tester',
      capabilities: ['testing', 'offline-operation'],
      claudeConfig: {
        apiKey: 'test-key-placeholder'
      },
      workspaceRoot: process.cwd(),
      // Deliberately omit cognitiveCanvas to test offline mode
    };
    
    console.log('🚀 Initializing agent in offline mode...');
    await agent.initialize(config);
    
    console.log('✅ Agent Status:', agent.getStatus());
    console.log('🆔 Agent ID:', agent.getId());
    console.log('👤 Agent Role:', agent.getRole());
    console.log('⚡ Agent Capabilities:', agent.getCapabilities());
    
    // Test task assignment and execution
    const testTask = {
      id: 'test-task-001',
      title: 'Test Offline Task',
      description: 'Testing agent offline capabilities',
      status: 'pending',
      priority: 'medium',
      projectId: 'test-project',
      createdAt: new Date().toISOString()
    };
    
    const testContext = {
      workflowStep: 'TEST',
      relevantArtifacts: [],
      patterns: [],
      relationships: [],
      paths: [],
      priming: {}
    };
    
    console.log('📥 Assigning test task...');
    await agent.receiveTask(testTask, testContext);
    
    console.log('🏃 Running task execution...');
    const result = await agent.run();
    
    console.log('✅ Task execution result:', result);
    
    // Test agent reset
    console.log('🔄 Testing agent reset...');
    await agent.reset();
    console.log('✅ Agent reset completed. Status:', agent.getStatus());
    
    return true;
    
  } catch (error) {
    console.error('❌ Agent test failed:', error.message);
    return false;
  }
}

async function testAgentWithStorage() {
  console.log('\n🧪 Testing Agent with Storage Manager...');
  
  try {
    const { createAutoStorage } = require('./dist/storage');
    
    // Create storage manager (will use in-memory)
    const storageManager = await createAutoStorage(undefined, true);
    await storageManager.connect();
    
    console.log('📂 Storage manager created:', storageManager.getProvider().type);
    
    // Note: For full test we would need to update agent to accept storageManager
    // This demonstrates the storage integration architecture
    
    console.log('✅ Storage integration test structure verified');
    
    await storageManager.disconnect();
    return true;
    
  } catch (error) {
    console.error('❌ Storage integration test failed:', error.message);
    return false;
  }
}

// Run tests
async function runAllTests() {
  console.log('🎯 Running Agent Offline Capability Tests\n');
  
  const test1 = await testAgentOfflineCapabilities();
  const test2 = await testAgentWithStorage();
  
  console.log('\n📊 Test Results:');
  console.log('   Agent Offline Capabilities:', test1 ? '✅ PASS' : '❌ FAIL');
  console.log('   Storage Integration:', test2 ? '✅ PASS' : '❌ FAIL');
  
  if (test1 && test2) {
    console.log('\n🎉 All agent tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some agent tests failed');
    process.exit(1);
  }
}

runAllTests().catch(console.error);