/**
 * Advanced Caching and Memory Management for Cognitive Canvas Navigator
 */

import { NavigationResult, CacheEntry, QueryPlan } from './types';

export class CacheManager {
  private cache = new Map<string, CacheEntry>();
  private readonly maxCacheSize = 200;
  private readonly defaultTTL = 300000;
  private cacheHits = 0;
  private cacheMisses = 0;

  getAdvancedCachedResult(key: string): NavigationResult | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.cacheMisses++;
      return null;
    }
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.cacheMisses++;
      return null;
    }
    
    entry.accessCount++;
    entry.timestamp = Date.now();
    this.cacheHits++;
    
    return entry.result;
  }

  storeIntelligentCache(key: string, result: NavigationResult, cost: number): void {
    if (this.cache.size >= this.maxCacheSize) {
      this.performIntelligentEviction();
    }
    
    const ttl = Math.min(this.defaultTTL, cost * 1000 + 60000);
    
    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      cost
    };
    
    this.cache.set(key, entry);
  }

  private performIntelligentEviction(): void {
    const entries = Array.from(this.cache.entries());
    const scored = entries.map(([key, entry]) => ({
      key,
      score: this.calculateEvictionScore(entry)
    }));
    
    scored.sort((a, b) => a.score - b.score);
    const toRemove = Math.floor(this.maxCacheSize * 0.25);
    
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(scored[i].key);
    }
  }

  private calculateEvictionScore(entry: CacheEntry): number {
    const age = Date.now() - entry.timestamp;
    const frequency = entry.accessCount;
    const cost = entry.cost;
    
    return (age / 1000) - (frequency * 10) - (cost * 5);
  }

  getCacheMetrics() {
    const totalQueries = this.cacheHits + this.cacheMisses;
    return {
      cacheHitRatio: totalQueries > 0 ? this.cacheHits / totalQueries : 0,
      cacheSize: this.cache.size,
      memoryUsage: this.cache.size * 1024
    };
  }

  generateOptimizedCacheKey(query: any): string {
    const queryHash = Buffer.from(query.query).toString('base64').slice(0, 10);
    const contextHash = query.context ? 
      Buffer.from(JSON.stringify(query.context)).toString('base64').slice(0, 8) : '';
    return `${query.type}:${queryHash}:${contextHash}`;
  }
}