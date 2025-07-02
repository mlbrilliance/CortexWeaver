import { TransactionManager } from './transaction-manager.js';
import { createTestSuite, TestDatabaseManager } from './test-utils.js';

const testSuite = createTestSuite('TransactionManager');

export async function runTransactionTests(): Promise<boolean> {
  let allTestsPassed = true;

  try {
    // Test 1: Basic Transaction Operations
    await testSuite.runTransactionTest(
      'Basic Read/Write Transactions',
      async (tm: TransactionManager) => {
        // Test write transaction
        const writeResult = await tm.executeInWriteTransaction(async (tx) => {
          const result = await tx.run(
            'CREATE (n:TestNode {id: $id, name: $name}) RETURN n',
            { id: 'test-1', name: 'Test Node 1' }
          );
          return result.records[0].get('n').properties;
        });

        if (!writeResult.data || writeResult.data.id !== 'test-1') {
          throw new Error('Write transaction failed');
        }

        // Test read transaction
        const readResult = await tm.executeInReadTransaction(async (tx) => {
          const result = await tx.run(
            'MATCH (n:TestNode {id: $id}) RETURN n',
            { id: 'test-1' }
          );
          return result.records[0].get('n').properties;
        });

        if (!readResult.data || readResult.data.name !== 'Test Node 1') {
          throw new Error('Read transaction failed');
        }

        return true;
      }
    );

    // Test 2: Batch Operations
    await testSuite.runTransactionTest(
      'Batch Operations',
      async (tm: TransactionManager) => {
        const operations = [
          {
            query: 'CREATE (n:BatchNode {id: $id, name: $name}) RETURN n',
            params: { id: 'batch-1', name: 'Batch Node 1' },
            operation: 'WRITE' as const
          },
          {
            query: 'CREATE (n:BatchNode {id: $id, name: $name}) RETURN n',
            params: { id: 'batch-2', name: 'Batch Node 2' },
            operation: 'WRITE' as const
          },
          {
            query: 'CREATE (n:BatchNode {id: $id, name: $name}) RETURN n',
            params: { id: 'batch-3', name: 'Batch Node 3' },
            operation: 'WRITE' as const
          }
        ];

        const batchResult = await tm.executeBatch(operations);
        
        if (!batchResult.data || batchResult.data.length !== 3) {
          throw new Error('Batch operation failed');
        }

        // Verify all nodes were created
        const verifyResult = await tm.executeInReadTransaction(async (tx) => {
          const result = await tx.run('MATCH (n:BatchNode) RETURN count(n) as count');
          return result.records[0].get('count').toNumber();
        });

        if (verifyResult.data !== 3) {
          throw new Error('Batch verification failed');
        }

        return true;
      }
    );

    // Test 3: Transaction Retry Logic
    await testSuite.runTransactionTest(
      'Transaction Retry Logic',
      async (tm: TransactionManager) => {
        let attemptCount = 0;

        // This should retry on transient errors
        const result = await tm.executeInWriteTransaction(async (tx) => {
          attemptCount++;
          
          // Simulate transient error on first attempt
          if (attemptCount === 1) {
            throw new Error('Deadlock detected'); // Should trigger retry
          }

          const result = await tx.run(
            'CREATE (n:RetryNode {id: $id, attempt: $attempt}) RETURN n',
            { id: 'retry-test', attempt: attemptCount }
          );
          return result.records[0].get('n').properties;
        });

        // Should have retried once
        if (attemptCount !== 2) {
          throw new Error(`Expected 2 attempts, got ${attemptCount}`);
        }

        if (!result.data || result.data.attempt !== 2) {
          throw new Error('Retry logic failed');
        }

        return true;
      }
    );

    // Test 4: Concurrent Transaction Handling
    await testSuite.runTransactionTest(
      'Concurrent Transactions',
      async (tm: TransactionManager) => {
        const concurrentOps = Array.from({ length: 5 }, (_, i) =>
          tm.executeInWriteTransaction(async (tx) => {
            const result = await tx.run(
              'CREATE (n:ConcurrentNode {id: $id, index: $index}) RETURN n',
              { id: `concurrent-${i}`, index: i }
            );
            return result.records[0].get('n').properties;
          })
        );

        const results = await Promise.all(concurrentOps);
        
        if (results.length !== 5) {
          throw new Error('Concurrent operations failed');
        }

        // Verify all nodes were created
        const verifyResult = await tm.executeInReadTransaction(async (tx) => {
          const result = await tx.run('MATCH (n:ConcurrentNode) RETURN count(n) as count');
          return result.records[0].get('count').toNumber();
        });

        if (verifyResult.data !== 5) {
          throw new Error('Concurrent verification failed');
        }

        return true;
      }
    );

    // Test 5: Error Handling
    await testSuite.runTransactionTest(
      'Error Handling',
      async (tm: TransactionManager) => {
        let errorThrown = false;

        try {
          await tm.executeInWriteTransaction(async (tx) => {
            // Create a constraint violation
            await tx.run('CREATE (n:ErrorNode {id: $id}) RETURN n', { id: 'error-test' });
            await tx.run('CREATE (n:ErrorNode {id: $id}) RETURN n', { id: 'error-test' }); // Duplicate
            return true;
          });
        } catch (error) {
          errorThrown = true;
        }

        if (!errorThrown) {
          throw new Error('Expected error was not thrown');
        }

        // Verify transaction was rolled back
        const verifyResult = await tm.executeInReadTransaction(async (tx) => {
          const result = await tx.run('MATCH (n:ErrorNode {id: $id}) RETURN count(n) as count', { id: 'error-test' });
          return result.records[0].get('count').toNumber();
        });

        if (verifyResult.data !== 0) {
          throw new Error('Transaction rollback failed');
        }

        return true;
      }
    );

    // Test 6: Metrics Collection
    await testSuite.runTransactionTest(
      'Metrics Collection',
      async (tm: TransactionManager) => {
        // Reset metrics
        tm.resetMetrics();

        // Perform some operations
        await tm.executeInWriteTransaction(async (tx) => {
          await tx.run('CREATE (n:MetricsNode {id: $id}) RETURN n', { id: 'metrics-1' });
          return true;
        });

        await tm.executeInReadTransaction(async (tx) => {
          await tx.run('MATCH (n:MetricsNode {id: $id}) RETURN n', { id: 'metrics-1' });
          return true;
        });

        const metrics = tm.getMetrics();
        
        if (metrics.totalTransactions < 2) {
          throw new Error('Metrics not being collected properly');
        }

        if (metrics.successfulTransactions < 2) {
          throw new Error('Success metrics not being tracked');
        }

        return true;
      }
    );

    console.log('🎉 All transaction tests passed!');

  } catch (error) {
    console.error('❌ Transaction tests failed:', error);
    allTestsPassed = false;
  }

  return allTestsPassed;
}

export async function runCoreOperationsTests(): Promise<boolean> {
  const testDb = new TestDatabaseManager();
  let allTestsPassed = true;

  try {
    const tm = await testDb.setup();
    const testData = await testDb.createTestData();

    console.log('🧪 Running Core Operations Integration Tests...');

    // Test project operations
    const projectResult = await tm.executeInReadTransaction(async (tx) => {
      const result = await tx.run('MATCH (p:Project {id: $id}) RETURN p', { id: testData.projectId });
      return result.records[0]?.get('p')?.properties;
    });

    if (!projectResult.data || projectResult.data.name !== 'Test Project') {
      throw new Error('Project creation test failed');
    }

    // Test task operations
    const taskResult = await tm.executeInReadTransaction(async (tx) => {
      const result = await tx.run('MATCH (t:Task {projectId: $projectId}) RETURN count(t) as count', { projectId: testData.projectId });
      return result.records[0].get('count').toNumber();
    });

    if (taskResult.data !== 3) {
      throw new Error('Task creation test failed');
    }

    // Test agent operations
    const agentResult = await tm.executeInReadTransaction(async (tx) => {
      const result = await tx.run('MATCH (a:Agent) RETURN count(a) as count');
      return result.records[0].get('count').toNumber();
    });

    if (agentResult.data !== 2) {
      throw new Error('Agent creation test failed');
    }

    // Test contract operations
    const contractResult = await tm.executeInReadTransaction(async (tx) => {
      const result = await tx.run('MATCH (c:Contract {projectId: $projectId}) RETURN count(c) as count', { projectId: testData.projectId });
      return result.records[0].get('count').toNumber();
    });

    if (contractResult.data !== 2) {
      throw new Error('Contract creation test failed');
    }

    console.log('✅ Core Operations Integration Tests passed!');

  } catch (error) {
    console.error('❌ Core Operations Integration Tests failed:', error);
    allTestsPassed = false;
  } finally {
    await testDb.cleanup();
  }

  return allTestsPassed;
}

export async function runAllTests(): Promise<boolean> {
  console.log('🚀 Starting CortexWeaver Transaction System Tests...\n');

  const transactionTestsResult = await runTransactionTests();
  const coreOpsTestsResult = await runCoreOperationsTests();

  const allTestsPassed = transactionTestsResult && coreOpsTestsResult;

  if (allTestsPassed) {
    console.log('\n🎉 ALL TESTS PASSED! Transaction system is working correctly.');
  } else {
    console.log('\n❌ Some tests failed. Please check the logs above.');
  }

  return allTestsPassed;
}