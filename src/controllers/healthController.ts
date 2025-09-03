import { Request, Response } from 'express';
import { CacheService } from '../services/cache';
import { config } from '../config/config';

export class HealthController {
  constructor(private cacheService: CacheService) {}

  async checkHealth(_req: Request, res: Response): Promise<void> {
    const health = {
      ok: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      cache: this.cacheService.getStats(),
      config: {
        arcgisUrl: config.arcgis.featureUrl,
        bufferMeters: config.search.bufferMeters,
        cacheTtl: config.cache.ttlSeconds,
        rateLimit: config.rateLimit.max,
      },
    };
    
    res.json(health);
  }
}