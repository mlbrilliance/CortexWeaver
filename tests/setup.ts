/**
 * Jest setup file for CortexWeaver tests
 * 
 * Configures global test environment and utilities
 */

// Import comprehensive test utilities
import './test-utils';

// Extend Jest timeout for integration tests
jest.setTimeout(300000); // 5 minutes

// Global test configuration
global.console = {
  ...console,
  // Reduce noise in test output while preserving important messages
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Environment variable defaults for testing
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
process.env.NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
process.env.NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';
process.env.CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || 'test-api-key';

// Enhanced error handling test configuration
process.env.CORTEX_ERROR_HANDLING_V3 = 'true';
process.env.CODESAVANT_ENABLED = 'true';

// Disable auto-save for tests to prevent database connection errors
process.env.COGNITIVE_CANVAS_AUTO_SAVE = 'false';
process.env.TMUX_MOCK_MODE = 'true';

// Global test utilities
declare global {
  var testUtils: {
    waitFor: (condition: () => boolean | Promise<boolean>, timeout?: number) => Promise<void>;
    retry: <T>(fn: () => Promise<T>, attempts?: number, delay?: number) => Promise<T>;
    cleanup: () => Promise<void>;
  };
}

// Test utility functions
(global as any).testUtils = {
  /**
   * Wait for a condition to become true
   */
  async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 30000
  ): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      const result = await condition();
      if (result) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  /**
   * Retry a function with exponential backoff
   */
  async retry<T>(
    fn: () => Promise<T>,
    attempts: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }
    
    throw lastError!;
  },

  /**
   * Global cleanup for test resources
   */
  async cleanup(): Promise<void> {
    // Cleanup any global test resources
    // This can be extended as needed
  }
};

// Mock timers to prevent auto-save issues
beforeAll(() => {
  // Mock setInterval and clearInterval for auto-save tests
  global.setInterval = jest.fn().mockImplementation((callback, interval) => {
    // Return a mock interval ID, but don't actually run the interval
    return 'mock-interval-id';
  });
  
  global.clearInterval = jest.fn().mockImplementation((intervalId) => {
    // Mock clear interval
  });
});

// Global test lifecycle hooks
beforeEach(() => {
  // Reset any global state before each test
  jest.clearAllMocks();
  
  // Reset console mocks but preserve error/warn logging for debugging
  if (global.console.log) {
    (global.console.log as jest.Mock).mockClear();
  }
  if (global.console.debug) {
    (global.console.debug as jest.Mock).mockClear();
  }
  if (global.console.info) {
    (global.console.info as jest.Mock).mockClear();
  }
});

afterEach(async () => {
  // Cleanup after each test
  await (global as any).testUtils.cleanup();
  
  // Clear any running timers
  jest.clearAllTimers();
});

// Handle uncaught exceptions in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Export test utilities for use in individual test files
export const testUtils = (global as any).testUtils;