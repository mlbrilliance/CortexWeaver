#!/usr/bin/env node

// Test performance and integration
const fs = require('fs');
const path = require('path');

async function testStartupPerformance() {
  console.log('🧪 Testing Startup Performance...');
  
  try {
    console.log('⚡ Measuring component initialization times...');
    
    const measurements = {};
    
    // Test storage initialization performance
    console.log('   📂 Testing storage initialization...');
    const storageStartTime = Date.now();
    
    const { createAutoStorage } = require('./dist/storage');
    const storage = await createAutoStorage(undefined, true);
    await storage.connect();
    
    measurements.storageInit = Date.now() - storageStartTime;
    console.log(`   ✅ Storage initialized in ${measurements.storageInit}ms`);
    
    // Test agent initialization performance
    console.log('   🤖 Testing agent initialization...');
    const agentStartTime = Date.now();
    
    const { Agent } = require('./dist/agent-base');
    
    class PerfTestAgent extends Agent {
      async executeTask() {
        return { status: 'completed' };
      }
      getPromptTemplate() {
        return 'Performance test template';
      }
    }
    
    const agent = new PerfTestAgent();
    await agent.initialize({
      id: 'perf-test-agent',
      role: 'performance-tester',
      capabilities: ['performance-testing'],
      claudeConfig: { apiKey: 'test-key' },
      workspaceRoot: process.cwd()
    });
    
    measurements.agentInit = Date.now() - agentStartTime;
    console.log(`   ✅ Agent initialized in ${measurements.agentInit}ms`);
    
    // Test CLI initialization performance
    console.log('   📱 Testing CLI initialization...');
    const cliStartTime = Date.now();
    
    const { CLI } = require('./dist/cli');
    const cli = new CLI();
    
    measurements.cliInit = Date.now() - cliStartTime;
    console.log(`   ✅ CLI initialized in ${measurements.cliInit}ms`);
    
    // Test orchestrator creation performance
    console.log('   🎯 Testing orchestrator creation...');
    const orchestratorStartTime = Date.now();
    
    const { Orchestrator } = require('./dist/orchestrator');
    const orchestrator = new Orchestrator({
      claude: {
        apiKey: 'test-api-key',
        defaultModel: 'claude-3-sonnet',
        budgetLimit: 100
      },
      storage: {
        type: 'in-memory',
        config: {}
      }
    });
    
    measurements.orchestratorCreate = Date.now() - orchestratorStartTime;
    console.log(`   ✅ Orchestrator created in ${measurements.orchestratorCreate}ms`);
    
    // Performance analysis
    console.log('\n📊 Performance Analysis:');
    const totalStartupTime = Object.values(measurements).reduce((a, b) => a + b, 0);
    console.log(`   🔥 Total startup time: ${totalStartupTime}ms`);
    console.log(`   📂 Storage: ${measurements.storageInit}ms (${(measurements.storageInit/totalStartupTime*100).toFixed(1)}%)`);
    console.log(`   🤖 Agent: ${measurements.agentInit}ms (${(measurements.agentInit/totalStartupTime*100).toFixed(1)}%)`);
    console.log(`   📱 CLI: ${measurements.cliInit}ms (${(measurements.cliInit/totalStartupTime*100).toFixed(1)}%)`);
    console.log(`   🎯 Orchestrator: ${measurements.orchestratorCreate}ms (${(measurements.orchestratorCreate/totalStartupTime*100).toFixed(1)}%)`);
    
    // Performance benchmarks (reasonable targets)
    const benchmarks = {
      storageInit: 500,    // 500ms for storage
      agentInit: 200,      // 200ms for agent
      cliInit: 100,        // 100ms for CLI
      orchestratorCreate: 300  // 300ms for orchestrator
    };
    
    let performanceScore = 0;
    let totalChecks = 0;
    
    for (const [component, time] of Object.entries(measurements)) {
      totalChecks++;
      if (time <= benchmarks[component]) {
        performanceScore++;
        console.log(`   ✅ ${component} meets performance target (${time}ms ≤ ${benchmarks[component]}ms)`);
      } else {
        console.log(`   ⚠️ ${component} exceeds target (${time}ms > ${benchmarks[component]}ms)`);
      }
    }
    
    console.log(`   📊 Performance score: ${performanceScore}/${totalChecks} (${(performanceScore/totalChecks*100).toFixed(1)}%)`);
    
    // Cleanup
    await storage.disconnect();
    
    return performanceScore >= totalChecks * 0.75;
    
  } catch (error) {
    console.error('❌ Startup performance test failed:', error.message);
    return false;
  }
}

async function testMemoryUsage() {
  console.log('\n🧪 Testing Memory Usage...');
  
  try {
    console.log('💾 Measuring memory consumption...');
    
    const initialMemory = process.memoryUsage();
    console.log('   📊 Initial memory usage:');
    console.log(`      RSS: ${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`      Heap Used: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`      Heap Total: ${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    
    // Load components and measure memory impact
    console.log('\n   🔧 Loading CortexWeaver components...');
    
    const { createAutoStorage } = require('./dist/storage');
    const { Orchestrator } = require('./dist/orchestrator');
    const { CLI } = require('./dist/cli');
    const { Agent } = require('./dist/agent-base');
    
    // Create multiple instances to test memory scaling
    const components = [];
    
    for (let i = 0; i < 5; i++) {
      const storage = await createAutoStorage(undefined, true);
      await storage.connect();
      components.push(storage);
    }
    
    const loadedMemory = process.memoryUsage();
    
    console.log('   📊 Memory after loading components:');
    console.log(`      RSS: ${(loadedMemory.rss / 1024 / 1024).toFixed(2)} MB (+${((loadedMemory.rss - initialMemory.rss) / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`      Heap Used: ${(loadedMemory.heapUsed / 1024 / 1024).toFixed(2)} MB (+${((loadedMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB)`);
    
    // Memory efficiency analysis
    const memoryIncrease = loadedMemory.heapUsed - initialMemory.heapUsed;
    const memoryPerComponent = memoryIncrease / components.length;
    
    console.log(`   📊 Memory analysis:`);
    console.log(`      Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
    console.log(`      Memory per component: ${(memoryPerComponent / 1024 / 1024).toFixed(2)} MB`);
    
    // Memory benchmarks
    const memoryBenchmarks = {
      maxInitialHeap: 50,  // 50MB initial heap
      maxPerComponent: 10,  // 10MB per component
      maxTotalIncrease: 100 // 100MB total increase
    };
    
    let memoryScore = 0;
    let memoryChecks = 0;
    
    memoryChecks++;
    if (initialMemory.heapUsed / 1024 / 1024 <= memoryBenchmarks.maxInitialHeap) {
      memoryScore++;
      console.log(`   ✅ Initial heap usage acceptable`);
    } else {
      console.log(`   ⚠️ Initial heap usage high`);
    }
    
    memoryChecks++;
    if (memoryPerComponent / 1024 / 1024 <= memoryBenchmarks.maxPerComponent) {
      memoryScore++;
      console.log(`   ✅ Per-component memory usage acceptable`);
    } else {
      console.log(`   ⚠️ Per-component memory usage high`);
    }
    
    memoryChecks++;
    if (memoryIncrease / 1024 / 1024 <= memoryBenchmarks.maxTotalIncrease) {
      memoryScore++;
      console.log(`   ✅ Total memory increase acceptable`);
    } else {
      console.log(`   ⚠️ Total memory increase high`);
    }
    
    console.log(`   📊 Memory efficiency score: ${memoryScore}/${memoryChecks}`);
    
    // Cleanup
    for (const storage of components) {
      await storage.disconnect();
    }
    
    // Test memory cleanup
    global.gc && global.gc();
    const cleanupMemory = process.memoryUsage();
    console.log(`   🧹 Memory after cleanup: ${(cleanupMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    
    return memoryScore >= memoryChecks * 0.66;
    
  } catch (error) {
    console.error('❌ Memory usage test failed:', error.message);
    return false;
  }
}

async function testConcurrentOperations() {
  console.log('\n🧪 Testing Concurrent Operations...');
  
  try {
    console.log('⚡ Testing parallel component operations...');
    
    const { createAutoStorage } = require('./dist/storage');
    
    // Test concurrent storage operations
    console.log('   📂 Testing concurrent storage operations...');
    const concurrentStorageStart = Date.now();
    
    const storagePromises = Array.from({ length: 3 }, async (_, i) => {
      const storage = await createAutoStorage(undefined, true);
      await storage.connect();
      
      // Simulate some operations
      try {
        await storage.executeQuery(`CREATE (n:TestNode${i} {id: ${i}})`, {});
      } catch (error) {
        // Expected in basic provider
      }
      
      await storage.disconnect();
      return `storage-${i}`;
    });
    
    const storageResults = await Promise.all(storagePromises);
    const concurrentStorageTime = Date.now() - concurrentStorageStart;
    
    console.log(`   ✅ ${storageResults.length} concurrent storage operations completed in ${concurrentStorageTime}ms`);
    
    // Test concurrent agent operations
    console.log('   🤖 Testing concurrent agent operations...');
    const concurrentAgentStart = Date.now();
    
    const { Agent } = require('./dist/agent-base');
    
    class ConcurrentTestAgent extends Agent {
      async executeTask() {
        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 50));
        return { status: 'completed', agentId: this.getId() };
      }
      getPromptTemplate() {
        return 'Concurrent test template';
      }
    }
    
    const agentPromises = Array.from({ length: 3 }, async (_, i) => {
      const agent = new ConcurrentTestAgent();
      await agent.initialize({
        id: `concurrent-agent-${i}`,
        role: 'concurrent-tester',
        capabilities: ['concurrent-testing'],
        claudeConfig: { apiKey: 'test-key' },
        workspaceRoot: process.cwd()
      });
      
      const task = {
        id: `concurrent-task-${i}`,
        title: `Concurrent Task ${i}`,
        description: 'Testing concurrent execution',
        status: 'pending',
        priority: 'medium',
        projectId: 'concurrent-test-project',
        createdAt: new Date().toISOString()
      };
      
      const context = {
        workflowStep: 'CONCURRENT_TEST',
        relevantArtifacts: [],
        patterns: [],
        relationships: [],
        paths: [],
        priming: {}
      };
      
      await agent.receiveTask(task, context);
      const result = await agent.run();
      return result;
    });
    
    const agentResults = await Promise.all(agentPromises);
    const concurrentAgentTime = Date.now() - concurrentAgentStart;
    
    console.log(`   ✅ ${agentResults.length} concurrent agent operations completed in ${concurrentAgentTime}ms`);
    
    // Analyze concurrency performance
    console.log('\n   📊 Concurrency Analysis:');
    console.log(`      Storage operations: ${concurrentStorageTime}ms for ${storageResults.length} operations`);
    console.log(`      Agent operations: ${concurrentAgentTime}ms for ${agentResults.length} operations`);
    console.log(`      Successful operations: ${agentResults.filter(r => r.success).length}/${agentResults.length}`);
    
    // Performance targets
    const maxConcurrentTime = 2000; // 2 seconds for concurrent operations
    const minSuccessRate = 0.8; // 80% success rate
    
    const successRate = agentResults.filter(r => r.success).length / agentResults.length;
    const performanceAcceptable = concurrentAgentTime <= maxConcurrentTime && 
                                 concurrentStorageTime <= maxConcurrentTime;
    const reliabilityAcceptable = successRate >= minSuccessRate;
    
    console.log(`   📊 Performance acceptable: ${performanceAcceptable ? '✅' : '❌'}`);
    console.log(`   📊 Reliability acceptable: ${reliabilityAcceptable ? '✅' : '❌'} (${(successRate * 100).toFixed(1)}%)`);
    
    return performanceAcceptable && reliabilityAcceptable;
    
  } catch (error) {
    console.error('❌ Concurrent operations test failed:', error.message);
    return false;
  }
}

async function testEndToEndIntegration() {
  console.log('\n🧪 Testing End-to-End Integration...');
  
  try {
    console.log('🔄 Testing complete workflow integration...');
    
    // Create a temporary test project
    const testProjectPath = '/tmp/integration-test-project';
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
    fs.mkdirSync(testProjectPath, { recursive: true });
    
    // Step 1: Project initialization
    console.log('   1️⃣ Testing project initialization...');
    const initStart = Date.now();
    
    const { CLI } = require('./dist/cli');
    const cli = new CLI();
    
    await cli.init(testProjectPath);
    const initTime = Date.now() - initStart;
    console.log(`   ✅ Project initialized in ${initTime}ms`);
    
    // Verify project structure
    const requiredFiles = [
      '.cortexweaver/config.json',
      'plan.md',
      '.env.example',
      'docker-compose.yml'
    ];
    
    let structureValid = true;
    for (const file of requiredFiles) {
      const filePath = path.join(testProjectPath, file);
      if (!fs.existsSync(filePath)) {
        console.log(`   ❌ Missing required file: ${file}`);
        structureValid = false;
      }
    }
    
    if (structureValid) {
      console.log('   ✅ Project structure valid');
    }
    
    // Step 2: Configuration loading
    console.log('   2️⃣ Testing configuration loading...');
    const configStart = Date.now();
    
    const { ConfigService } = require('./dist/config');
    const configService = new ConfigService(testProjectPath);
    
    const projectConfig = configService.loadProjectConfig();
    const configTime = Date.now() - configStart;
    console.log(`   ✅ Configuration loaded in ${configTime}ms`);
    
    // Step 3: Storage initialization
    console.log('   3️⃣ Testing storage initialization...');
    const storageStart = Date.now();
    
    const { createAutoStorage } = require('./dist/storage');
    const storage = await createAutoStorage(undefined, true);
    await storage.connect();
    const storageTime = Date.now() - storageStart;
    console.log(`   ✅ Storage initialized in ${storageTime}ms`);
    
    // Step 4: Orchestrator setup
    console.log('   4️⃣ Testing orchestrator setup...');
    const orchestratorStart = Date.now();
    
    const { Orchestrator } = require('./dist/orchestrator');
    const orchestrator = new Orchestrator({
      claude: {
        apiKey: 'test-api-key',
        defaultModel: projectConfig.models.claude,
        budgetLimit: projectConfig.budget.maxCost
      },
      storage: {
        type: 'in-memory',
        config: {}
      }
    });
    const orchestratorTime = Date.now() - orchestratorStart;
    console.log(`   ✅ Orchestrator set up in ${orchestratorTime}ms`);
    
    // Step 5: Status check
    console.log('   5️⃣ Testing status check...');
    const statusStart = Date.now();
    
    const status = await cli.status(testProjectPath);
    const statusTime = Date.now() - statusStart;
    console.log(`   ✅ Status checked in ${statusTime}ms`);
    
    // Integration analysis
    console.log('\n   📊 Integration Analysis:');
    const totalIntegrationTime = initTime + configTime + storageTime + orchestratorTime + statusTime;
    console.log(`      Total integration time: ${totalIntegrationTime}ms`);
    console.log(`      Project init: ${initTime}ms (${(initTime/totalIntegrationTime*100).toFixed(1)}%)`);
    console.log(`      Config load: ${configTime}ms (${(configTime/totalIntegrationTime*100).toFixed(1)}%)`);
    console.log(`      Storage init: ${storageTime}ms (${(storageTime/totalIntegrationTime*100).toFixed(1)}%)`);
    console.log(`      Orchestrator: ${orchestratorTime}ms (${(orchestratorTime/totalIntegrationTime*100).toFixed(1)}%)`);
    console.log(`      Status check: ${statusTime}ms (${(statusTime/totalIntegrationTime*100).toFixed(1)}%)`);
    
    // Integration benchmarks
    const integrationBenchmarks = {
      maxTotalTime: 5000,    // 5 seconds total
      maxInitTime: 2000,     // 2 seconds for init
      maxStatusTime: 1000    // 1 second for status
    };
    
    let integrationScore = 0;
    let integrationChecks = 0;
    
    integrationChecks++;
    if (totalIntegrationTime <= integrationBenchmarks.maxTotalTime) {
      integrationScore++;
      console.log(`   ✅ Total integration time acceptable`);
    } else {
      console.log(`   ⚠️ Total integration time high`);
    }
    
    integrationChecks++;
    if (initTime <= integrationBenchmarks.maxInitTime) {
      integrationScore++;
      console.log(`   ✅ Initialization time acceptable`);
    } else {
      console.log(`   ⚠️ Initialization time high`);
    }
    
    integrationChecks++;
    if (statusTime <= integrationBenchmarks.maxStatusTime) {
      integrationScore++;
      console.log(`   ✅ Status check time acceptable`);
    } else {
      console.log(`   ⚠️ Status check time high`);
    }
    
    integrationChecks++;
    if (structureValid) {
      integrationScore++;
      console.log(`   ✅ Project structure valid`);
    }
    
    console.log(`   📊 Integration score: ${integrationScore}/${integrationChecks}`);
    
    // Cleanup
    await storage.disconnect();
    fs.rmSync(testProjectPath, { recursive: true, force: true });
    
    return integrationScore >= integrationChecks * 0.75;
    
  } catch (error) {
    console.error('❌ End-to-end integration test failed:', error.message);
    return false;
  }
}

async function testResourceEfficiency() {
  console.log('\n🧪 Testing Resource Efficiency...');
  
  try {
    console.log('♻️ Testing resource cleanup and efficiency...');
    
    const { createAutoStorage } = require('./dist/storage');
    
    // Test resource cleanup
    console.log('   🧹 Testing resource cleanup...');
    
    const resources = [];
    
    // Create multiple resources
    for (let i = 0; i < 5; i++) {
      const storage = await createAutoStorage(undefined, true);
      await storage.connect();
      resources.push(storage);
    }
    
    console.log(`   📊 Created ${resources.length} storage resources`);
    
    // Test cleanup
    const cleanupStart = Date.now();
    for (const storage of resources) {
      await storage.disconnect();
    }
    const cleanupTime = Date.now() - cleanupStart;
    
    console.log(`   ✅ Cleaned up ${resources.length} resources in ${cleanupTime}ms`);
    
    // Test file handle efficiency
    console.log('   📁 Testing file handle efficiency...');
    
    const beforeHandles = process.getActiveResourcesInfo ? process.getActiveResourcesInfo().length : 0;
    
    // Create and destroy multiple CLI instances
    for (let i = 0; i < 10; i++) {
      const { CLI } = require('./dist/cli');
      const cli = new CLI();
      // Simulate usage
      cli.validateProject(process.cwd());
    }
    
    const afterHandles = process.getActiveResourcesInfo ? process.getActiveResourcesInfo().length : 0;
    const handleLeak = afterHandles - beforeHandles;
    
    console.log(`   📊 File handles before: ${beforeHandles}, after: ${afterHandles}, diff: ${handleLeak}`);
    
    // Resource efficiency analysis
    const efficiencyTargets = {
      maxCleanupTime: 1000,  // 1 second cleanup
      maxHandleLeak: 5       // Max 5 leaked handles
    };
    
    let efficiencyScore = 0;
    let efficiencyChecks = 0;
    
    efficiencyChecks++;
    if (cleanupTime <= efficiencyTargets.maxCleanupTime) {
      efficiencyScore++;
      console.log(`   ✅ Cleanup time efficient`);
    } else {
      console.log(`   ⚠️ Cleanup time slow`);
    }
    
    efficiencyChecks++;
    if (Math.abs(handleLeak) <= efficiencyTargets.maxHandleLeak) {
      efficiencyScore++;
      console.log(`   ✅ File handle usage efficient`);
    } else {
      console.log(`   ⚠️ Potential file handle leak detected`);
    }
    
    console.log(`   📊 Resource efficiency score: ${efficiencyScore}/${efficiencyChecks}`);
    
    return efficiencyScore >= efficiencyChecks * 0.75;
    
  } catch (error) {
    console.error('❌ Resource efficiency test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🎯 Running Performance and Integration Tests\n');
  
  const test1 = await testStartupPerformance();
  const test2 = await testMemoryUsage();
  const test3 = await testConcurrentOperations();
  const test4 = await testEndToEndIntegration();
  const test5 = await testResourceEfficiency();
  
  console.log('\n📊 Test Results:');
  console.log('   Startup Performance:', test1 ? '✅ PASS' : '❌ FAIL');
  console.log('   Memory Usage:', test2 ? '✅ PASS' : '❌ FAIL');
  console.log('   Concurrent Operations:', test3 ? '✅ PASS' : '❌ FAIL');
  console.log('   End-to-End Integration:', test4 ? '✅ PASS' : '❌ FAIL');
  console.log('   Resource Efficiency:', test5 ? '✅ PASS' : '❌ FAIL');
  
  const passedTests = [test1, test2, test3, test4, test5].filter(Boolean).length;
  
  if (passedTests >= 4) {
    console.log('\n🎉 Performance and integration tests passed!');
    console.log('⚡ System demonstrates excellent performance and integration!');
    process.exit(0);
  } else {
    console.log(`\n⚠️ ${5 - passedTests} performance/integration tests failed`);
    process.exit(1);
  }
}

runAllTests().catch(console.error);