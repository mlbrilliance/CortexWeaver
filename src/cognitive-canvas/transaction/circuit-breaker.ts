import { CircuitBreakerState, CircuitBreakerConfig, DEFAULT_CIRCUIT_BREAKER_CONFIG } from './types.js';

export class CircuitBreaker {
  private state: CircuitBreakerState;
  private config: CircuitBreakerConfig;
  private successCount: number = 0;
  private requestCount: number = 0;
  private lastResetTime: Date = new Date();

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.state = {
      state: 'CLOSED',
      failureCount: 0
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - operation not allowed');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    this.requestCount++;

    if (this.state.state === 'HALF_OPEN') {
      // Reset to closed after successful operation in half-open state
      this.reset();
    } else if (this.state.state === 'CLOSED') {
      // Reset failure count on success
      this.state.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.state.failureCount++;
    this.requestCount++;
    this.state.lastFailureTime = new Date();

    if (this.state.state === 'HALF_OPEN') {
      // Go back to open state on failure during half-open
      this.state.state = 'OPEN';
      this.state.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    } else if (this.shouldTrip()) {
      this.trip();
    }
  }

  private shouldTrip(): boolean {
    // Check if we have enough requests to make a decision
    if (this.requestCount < this.config.minimumThroughput) {
      return false;
    }

    // Check if failure rate exceeds threshold
    const failureRate = this.state.failureCount / this.requestCount;
    return this.state.failureCount >= this.config.failureThreshold || failureRate > 0.5;
  }

  private shouldAttemptReset(): boolean {
    if (!this.state.nextAttemptTime) {
      return false;
    }
    return Date.now() >= this.state.nextAttemptTime.getTime();
  }

  private trip(): void {
    this.state.state = 'OPEN';
    this.state.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
  }

  private reset(): void {
    this.state = {
      state: 'CLOSED',
      failureCount: 0
    };
    this.successCount = 0;
    this.requestCount = 0;
    this.lastResetTime = new Date();
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  getMetrics() {
    const now = new Date();
    const timeSinceReset = now.getTime() - this.lastResetTime.getTime();
    
    return {
      state: this.state.state,
      failureCount: this.state.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      failureRate: this.requestCount > 0 ? this.state.failureCount / this.requestCount : 0,
      timeSinceReset,
      nextAttemptTime: this.state.nextAttemptTime
    };
  }

  // Manual controls for testing and emergency situations
  forceOpen(): void {
    this.state.state = 'OPEN';
    this.state.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
  }

  forceClose(): void {
    this.reset();
  }

  forceHalfOpen(): void {
    this.state.state = 'HALF_OPEN';
  }
}