import { EventEmitter } from 'events';
import { 
  StorageManager as IStorageManager,
  StorageProvider, 
  StorageConfig,
  StorageConnectionEvent,
  StorageEventListener,
  QueryResult,
  TransactionFunction,
  ConnectionError,
  MigrationError,
  MCPNeo4jConfig,
  InMemoryConfig
} from './types.js';
import { MCPNeo4jProvider } from './providers/mcp-neo4j.js';
import { InMemoryProvider } from './providers/in-memory.js';

/**
 * Storage manager handles the lifecycle of storage providers
 * and provides a unified interface for storage operations
 */
export class StorageManager extends EventEmitter implements IStorageManager {
  private provider: StorageProvider | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  get currentProvider(): StorageProvider | null {
    return this.provider;
  }

  get isConnected(): boolean {
    return this.provider?.isConnected ?? false;
  }

  async setProvider(provider: StorageProvider): Promise<void> {
    // Disconnect current provider if exists
    if (this.provider) {
      await this.disconnect();
    }

    this.provider = provider;
    this.setupProviderEventHandling();
  }

  getProvider(): StorageProvider | null {
    return this.provider;
  }

  async switchProvider(config: StorageConfig): Promise<void> {
    const oldProvider = this.provider;
    const newProvider = this.createProvider(config);

    try {
      // Connect new provider
      await newProvider.connect();

      // Migrate data if both providers support it
      if (oldProvider && oldProvider.exportData && newProvider.importData) {
        console.log('🔄 Migrating data between providers...');
        await this.migrateData(oldProvider, newProvider);
      }

      // Switch to new provider
      if (oldProvider) {
        await oldProvider.disconnect();
      }

      await this.setProvider(newProvider);
      await this.connect();

      this.emitEvent({
        type: 'connected',
        provider: newProvider.type,
        timestamp: new Date(),
        metadata: { switched: true, oldProvider: oldProvider?.type }
      });

      console.log(`✅ Switched storage provider to ${newProvider.type}`);
    } catch (error) {
      // Rollback on failure
      if (oldProvider && !oldProvider.isConnected) {
        try {
          await oldProvider.connect();
          await this.setProvider(oldProvider);
        } catch (rollbackError) {
          console.error('Failed to rollback provider switch:', rollbackError);
        }
      }

      throw new ConnectionError(
        `Failed to switch storage provider: ${(error as Error).message}`,
        config.type,
        error as Error
      );
    }
  }

  async connect(): Promise<void> {
    if (!this.provider) {
      throw new ConnectionError('No storage provider configured', 'none');
    }

    try {
      this.emitEvent({
        type: 'connecting',
        provider: this.provider.type,
        timestamp: new Date()
      });

      await this.provider.connect();
      this.reconnectAttempts = 0;

      this.emitEvent({
        type: 'connected',
        provider: this.provider.type,
        timestamp: new Date()
      });

      console.log(`✅ Connected to ${this.provider.type} storage`);
    } catch (error) {
      this.emitEvent({
        type: 'error',
        provider: this.provider.type,
        timestamp: new Date(),
        error: error as Error
      });

      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.provider) {
      try {
        await this.provider.disconnect();
        
        this.emitEvent({
          type: 'disconnected',
          provider: this.provider.type,
          timestamp: new Date()
        });

        console.log(`✅ Disconnected from ${this.provider.type} storage`);
      } catch (error) {
        console.error('Error during disconnect:', error);
      }
    }
  }

  async initializeSchema(): Promise<void> {
    if (!this.provider) {
      throw new ConnectionError('No storage provider configured', 'none');
    }

    if (!this.provider.isConnected) {
      throw new ConnectionError('Storage provider not connected', this.provider.type);
    }

    if (typeof (this.provider as any).initializeSchema === 'function') {
      await (this.provider as any).initializeSchema();
    } else {
      console.log('📝 Schema initialization not supported by current storage provider');
    }
  }

  async reconnect(): Promise<void> {
    if (!this.provider) {
      throw new ConnectionError('No storage provider configured', 'none');
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new ConnectionError(
        `Max reconnection attempts (${this.maxReconnectAttempts}) exceeded`,
        this.provider.type
      );
    }

    this.reconnectAttempts++;

    this.emitEvent({
      type: 'reconnecting',
      provider: this.provider.type,
      timestamp: new Date(),
      metadata: { attempt: this.reconnectAttempts, maxAttempts: this.maxReconnectAttempts }
    });

    try {
      await this.provider.disconnect();
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
      await this.provider.connect();
      
      this.reconnectAttempts = 0;
      console.log(`✅ Reconnected to ${this.provider.type} storage`);
    } catch (error) {
      console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      
      // Schedule next reconnection attempt
      this.reconnectTimer = setTimeout(() => {
        this.reconnect().catch(err => {
          console.error('Automatic reconnection failed:', err);
        });
      }, this.reconnectDelay * this.reconnectAttempts);

      throw error;
    }
  }

  on(event: string, listener: StorageEventListener): this {
    super.on(event, listener);
    return this;
  }

  off(event: string, listener: StorageEventListener): this {
    super.off(event, listener);
    return this;
  }

  async migrateData(fromProvider: StorageProvider, toProvider: StorageProvider): Promise<void> {
    if (!fromProvider.exportData || !toProvider.importData) {
      throw new MigrationError(
        'One or both providers do not support data migration',
        `${fromProvider.type} -> ${toProvider.type}`
      );
    }

    try {
      console.log(`🔄 Exporting data from ${fromProvider.type}...`);
      const data = await fromProvider.exportData();
      
      console.log(`🔄 Importing data to ${toProvider.type}...`);
      await toProvider.importData(data);
      
      console.log(`✅ Successfully migrated ${data.nodes.length} nodes and ${data.relationships.length} relationships`);
    } catch (error) {
      throw new MigrationError(
        `Data migration failed: ${(error as Error).message}`,
        `${fromProvider.type} -> ${toProvider.type}`,
        error as Error
      );
    }
  }

  // Proxy methods that delegate to current provider
  async executeQuery<T>(query: string, params?: Record<string, any>): Promise<QueryResult<T>> {
    this.ensureProvider();
    return this.provider!.executeQuery<T>(query, params);
  }

  async executeInTransaction<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>> {
    this.ensureProvider();
    return this.provider!.executeInTransaction<T>(operation);
  }

  async executeInReadTransaction<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>> {
    this.ensureProvider();
    return this.provider!.executeInReadTransaction<T>(operation);
  }

  async executeInWriteTransaction<T>(operation: TransactionFunction<T>): Promise<QueryResult<T>> {
    this.ensureProvider();
    return this.provider!.executeInWriteTransaction<T>(operation);
  }

  // Provider factory
  private createProvider(config: StorageConfig): StorageProvider {
    switch (config.type) {
      case 'mcp-neo4j':
        if (!config.config) {
          throw new Error('MCPNeo4jConfig required for mcp-neo4j provider');
        }
        return new MCPNeo4jProvider(config.config as MCPNeo4jConfig);
      
      case 'in-memory':
        return new InMemoryProvider(config.config as InMemoryConfig);
      
      case 'mock':
        // Could implement a mock provider for testing
        throw new Error('Mock provider not yet implemented');
      
      default:
        throw new Error(`Unsupported storage provider type: ${config.type}`);
    }
  }

  private setupProviderEventHandling(): void {
    if (!this.provider) return;

    // Monitor provider health and auto-reconnect on failures
    const healthCheckInterval = setInterval(async () => {
      if (this.provider && this.provider.isConnected) {
        try {
          const healthy = await this.provider.healthCheck();
          if (!healthy) {
            console.warn('Storage provider health check failed, attempting reconnection...');
            await this.reconnect();
          }
        } catch (error) {
          console.warn('Storage provider health check error:', error);
          // Don't auto-reconnect on health check errors to avoid spam
        }
      }
    }, 30000); // Check every 30 seconds

    // Clean up interval when provider changes
    this.once('provider-changed', () => {
      clearInterval(healthCheckInterval);
    });
  }

  private emitEvent(event: StorageConnectionEvent): void {
    this.emit('storage-event', event);
    this.emit(event.type, event);
  }

  private ensureProvider(): void {
    if (!this.provider) {
      throw new ConnectionError('No storage provider configured', 'none');
    }
    if (!this.provider.isConnected) {
      throw new ConnectionError('Storage provider not connected', this.provider.type);
    }
  }

  // Utility methods for common operations
  async initializeSchemaIfSupported(): Promise<void> {
    if (this.provider?.initializeSchema) {
      await this.provider.initializeSchema();
    }
  }

  async getProviderMetrics() {
    return this.provider?.getMetrics?.() || null;
  }

  async exportCurrentData() {
    if (!this.provider?.exportData) {
      throw new Error('Current provider does not support data export');
    }
    return this.provider.exportData();
  }

  async importDataToCurrent(data: any) {
    if (!this.provider?.importData) {
      throw new Error('Current provider does not support data import');
    }
    return this.provider.importData(data);
  }
}