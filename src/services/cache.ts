import NodeCache from 'node-cache';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class CacheService {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: config.cache.ttlSeconds,
      checkperiod: 60,
      useClones: false,
    });
  }

  generateKey(street: string, lat?: number, lng?: number): string {
    const normalizedStreet = street.toLowerCase().trim();
    
    if (lat !== undefined && lng !== undefined) {
      const roundedLat = Math.round(lat * 10000) / 10000;
      const roundedLng = Math.round(lng * 10000) / 10000;
      return `search:${normalizedStreet}:${roundedLat}:${roundedLng}`;
    }
    
    return `search:${normalizedStreet}`;
  }

  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);
    
    if (value !== undefined) {
      logger.debug('Cache hit', { key });
    } else {
      logger.debug('Cache miss', { key });
    }
    
    return value;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    const success = this.cache.set(key, value, ttl || config.cache.ttlSeconds);
    
    if (success) {
      logger.debug('Cache set', { key, ttl: ttl || config.cache.ttlSeconds });
    } else {
      logger.warn('Failed to set cache', { key });
    }
  }

  delete(key: string): void {
    this.cache.del(key);
    logger.debug('Cache deleted', { key });
  }

  flush(): void {
    this.cache.flushAll();
    logger.info('Cache flushed');
  }

  getStats() {
    return {
      keys: this.cache.keys().length,
      hits: this.cache.getStats().hits,
      misses: this.cache.getStats().misses,
      keySize: this.cache.getStats().ksize,
      valueSize: this.cache.getStats().vsize,
    };
  }
}