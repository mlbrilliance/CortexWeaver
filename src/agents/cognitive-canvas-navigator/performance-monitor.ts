/**
 * Performance Monitoring and Analytics for Cognitive Canvas Navigator
 */

import { PerformanceMetrics } from './types';

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    averageQueryTime: 0, 
    cacheHitRatio: 0, 
    queryCount: 0, 
    totalExecutionTime: 0,
    slowQueries: [], 
    memoryUsage: 0, 
    optimizationCount: 0
  };
  private queryTimes: number[] = [];
  private monitoringInterval?: NodeJS.Timeout;

  startPerformanceMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.updatePerformanceMetrics();
      this.cleanupOldMetrics();
    }, 30000);
  }

  stopPerformanceMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  updateMetrics(queryTime: number, cacheHit: boolean): void {
    this.queryTimes.push(queryTime);
    this.metrics.queryCount++;
    this.metrics.totalExecutionTime += queryTime;
    
    if (queryTime > 1000) {
      this.metrics.slowQueries.push({ query: `query-${this.metrics.queryCount}`, time: queryTime });
      this.metrics.slowQueries = this.metrics.slowQueries.slice(-10);
    }
  }

  updatePerformanceMetrics(): void {
    this.metrics.averageQueryTime = this.queryTimes.length > 0 ? 
      this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length : 0;
  }

  updateMemoryUsage(cacheSize: number): void {
    this.metrics.memoryUsage = cacheSize * 1024;
  }

  updateCacheHitRatio(ratio: number): void {
    this.metrics.cacheHitRatio = ratio;
  }

  updateOptimizationCount(count: number): void {
    this.metrics.optimizationCount = count;
  }

  getPerformanceMetrics(): PerformanceMetrics {
    this.updatePerformanceMetrics();
    return { ...this.metrics };
  }

  private cleanupOldMetrics(): void {
    if (this.queryTimes.length > 1000) {
      this.queryTimes = this.queryTimes.slice(-1000);
    }
  }
}