import { Session, Driver } from 'neo4j-driver';
import { ISessionPool, SessionPoolConfig, SessionMetrics, DEFAULT_SESSION_POOL_CONFIG } from './types.js';

export class SessionPool implements ISessionPool {
  private driver: Driver;
  private config: SessionPoolConfig;
  private availableSessions: Session[] = [];
  private activeSessions: Map<string, Session> = new Map();
  private sessionCreationTime: Map<string, Date> = new Map();
  private metrics: SessionMetrics;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(driver: Driver, config: Partial<SessionPoolConfig> = {}) {
    this.driver = driver;
    this.config = { ...DEFAULT_SESSION_POOL_CONFIG, ...config };
    
    this.metrics = {
      activeSessions: 0,
      pooledSessions: 0,
      totalSessionsCreated: 0,
      sessionAcquisitionTime: 0
    };

    this.startCleanupTask();
  }

  async acquire(): Promise<Session> {
    const startTime = Date.now();
    
    try {
      // Try to get session from pool first
      if (this.availableSessions.length > 0) {
        const session = this.availableSessions.pop()!;
        const sessionId = this.generateSessionId(session);
        this.activeSessions.set(sessionId, session);
        this.updateAcquisitionTime(Date.now() - startTime);
        return session;
      }

      // Check if we can create new session
      if (this.activeSessions.size >= this.config.maxPoolSize) {
        throw new Error(`Session pool exhausted. Maximum pool size (${this.config.maxPoolSize}) reached.`);
      }

      // Create new session
      const session = this.driver.session();
      const sessionId = this.generateSessionId(session);
      
      this.activeSessions.set(sessionId, session);
      this.sessionCreationTime.set(sessionId, new Date());
      this.metrics.totalSessionsCreated++;
      this.updateAcquisitionTime(Date.now() - startTime);
      
      return session;

    } catch (error) {
      throw new Error(`Failed to acquire session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async release(session: Session): Promise<void> {
    const sessionId = this.findSessionId(session);
    if (!sessionId) {
      // Session not tracked, just close it
      await this.safeCloseSession(session);
      return;
    }

    try {
      // Remove from active sessions
      this.activeSessions.delete(sessionId);
      this.sessionCreationTime.delete(sessionId);

      // Check if session is still healthy
      if (!this.isSessionHealthy(session)) {
        await this.safeCloseSession(session);
        return;
      }

      // Add back to pool if under minimum size
      if (this.availableSessions.length < this.config.minPoolSize) {
        this.availableSessions.push(session);
      } else {
        // Pool is full, close the session
        await this.safeCloseSession(session);
      }

    } catch (error) {
      // Always try to close session on error
      await this.safeCloseSession(session);
    }
  }

  getMetrics(): SessionMetrics {
    return {
      ...this.metrics,
      activeSessions: this.activeSessions.size,
      pooledSessions: this.availableSessions.length
    };
  }

  async close(): Promise<void> {
    // Stop cleanup task
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all active sessions
    const closePromises: Promise<void>[] = [];
    
    for (const session of this.activeSessions.values()) {
      closePromises.push(this.safeCloseSession(session));
    }

    // Close all pooled sessions
    for (const session of this.availableSessions) {
      closePromises.push(this.safeCloseSession(session));
    }

    await Promise.all(closePromises);

    // Clear all data structures
    this.activeSessions.clear();
    this.availableSessions.length = 0;
    this.sessionCreationTime.clear();
  }

  private generateSessionId(session: Session): string {
    // Generate unique ID for session tracking
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private findSessionId(session: Session): string | null {
    for (const [id, activeSession] of this.activeSessions.entries()) {
      if (activeSession === session) {
        return id;
      }
    }
    return null;
  }

  private isSessionHealthy(session: Session): boolean {
    try {
      // Check if session is still open
      // Neo4j driver doesn't expose session state directly,
      // so we assume it's healthy if it exists
      return true;
    } catch {
      return false;
    }
  }

  private async safeCloseSession(session: Session): Promise<void> {
    try {
      await session.close();
    } catch (error) {
      // Log error but don't throw - closing should be best effort
      console.warn('Failed to close session:', error);
    }
  }

  private updateAcquisitionTime(time: number): void {
    // Simple moving average for acquisition time
    this.metrics.sessionAcquisitionTime = 
      (this.metrics.sessionAcquisitionTime * 0.9) + (time * 0.1);
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, 60000); // Run every minute
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions: Session[] = [];

    // Check for expired sessions in active set
    for (const [sessionId, session] of this.activeSessions.entries()) {
      const creationTime = this.sessionCreationTime.get(sessionId);
      if (creationTime && 
          (now.getTime() - creationTime.getTime()) > this.config.maxLifetime) {
        expiredSessions.push(session);
        this.activeSessions.delete(sessionId);
        this.sessionCreationTime.delete(sessionId);
      }
    }

    // Clean up idle sessions in pool
    const idleThreshold = now.getTime() - this.config.idleTimeout;
    while (this.availableSessions.length > this.config.minPoolSize) {
      const session = this.availableSessions.pop();
      if (session) {
        expiredSessions.push(session);
      }
    }

    // Close expired sessions
    for (const session of expiredSessions) {
      await this.safeCloseSession(session);
    }
  }
}