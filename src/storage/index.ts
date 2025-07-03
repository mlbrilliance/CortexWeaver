// Storage abstraction layer for CortexWeaver
// Provides pluggable storage backends with unified interface

export * from './types.js';
export { StorageManager } from './manager.js';
export { MCPNeo4jProvider } from './providers/mcp-neo4j.js';
export { InMemoryProvider } from './providers/in-memory.js';

// Convenience factory functions
import { StorageManager } from './manager.js';
import { MCPNeo4jProvider } from './providers/mcp-neo4j.js';
import { InMemoryProvider } from './providers/in-memory.js';
import { StorageConfig, MCPNeo4jConfig, InMemoryConfig } from './types.js';

/**
 * Create a storage manager with the specified provider
 */
export async function createStorageManager(config: StorageConfig): Promise<StorageManager> {
  const manager = new StorageManager();
  
  let provider;
  switch (config.type) {
    case 'mcp-neo4j':
      provider = new MCPNeo4jProvider(config.config as MCPNeo4jConfig);
      break;
    case 'in-memory':
      provider = new InMemoryProvider(config.config as InMemoryConfig);
      break;
    default:
      throw new Error(`Unsupported storage type: ${config.type}`);
  }

  await manager.setProvider(provider);
  return manager;
}

/**
 * Create an in-memory storage manager for offline development
 */
export async function createInMemoryStorage(config: InMemoryConfig = {}): Promise<StorageManager> {
  return createStorageManager({
    type: 'in-memory',
    config
  });
}

/**
 * Create an MCP-based Neo4j storage manager
 */
export async function createMCPNeo4jStorage(config: MCPNeo4jConfig): Promise<StorageManager> {
  return createStorageManager({
    type: 'mcp-neo4j',
    config
  });
}

/**
 * Auto-detect best available storage provider
 * Priority: MCP Neo4j -> In-Memory
 */
export async function createAutoStorage(
  mcpConfig?: MCPNeo4jConfig,
  fallbackToMemory = true
): Promise<StorageManager> {
  // Try MCP Neo4j first if config provided
  if (mcpConfig) {
    try {
      const manager = await createMCPNeo4jStorage(mcpConfig);
      await manager.connect();
      console.log('✅ Using MCP Neo4j storage');
      return manager;
    } catch (error) {
      console.warn('Failed to connect to MCP Neo4j, trying fallback:', (error as Error).message);
    }
  }

  // Fallback to in-memory storage
  if (fallbackToMemory) {
    const manager = await createInMemoryStorage({
      enablePersistence: true,
      persistencePath: './cortexweaver-offline.json'
    });
    await manager.connect();
    console.log('✅ Using in-memory storage (offline mode)');
    return manager;
  }

  throw new Error('No storage provider available');
}