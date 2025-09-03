import { Request, Response, NextFunction } from 'express';
import { LampSearchRequest, LampSearchResponse } from '../types';
import { LampSearchService } from '../services/lampSearch';
import { CacheService } from '../services/cache';
import { logger } from '../utils/logger';

export class LampController {
  constructor(
    private lampSearchService: LampSearchService,
    private cacheService: CacheService
  ) {}

  async searchLamps(
    req: Request<{}, {}, LampSearchRequest>,
    res: Response<LampSearchResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { street, lat, lng } = req.body;
      
      const cacheKey = this.cacheService.generateKey(street, lat, lng);
      const cachedResult = this.cacheService.get<LampSearchResponse>(cacheKey);
      
      if (cachedResult) {
        logger.info('Returning cached result', { street, lat, lng });
        res.json(cachedResult);
        return;
      }
      
      const startTime = Date.now();
      const { lamps, fieldDiscovery, suggestedStreets } = await this.lampSearchService.searchLamps({
        street,
        lat,
        lng,
      });
      
      const response: LampSearchResponse = {
        success: true,
        query: { street, lat, lng },
        count: lamps.length,
        summary: lamps.length > 0 
          ? `Found ${lamps.length} lamp${lamps.length !== 1 ? 's' : ''} on ${street}`
          : suggestedStreets && suggestedStreets.length > 0 
            ? `No lamps found on "${street}". Try: ${suggestedStreets.slice(0, 2).join(', ')}`
            : `No lamps found on "${street}"`,
        lamps,
        fieldDiscovery: {
          streetFields: fieldDiscovery.streetFields,
          lampIdFields: fieldDiscovery.lampIdFields,
        },
        ...(suggestedStreets && suggestedStreets.length > 0 && { suggestedStreets }),
      };
      
      this.cacheService.set(cacheKey, response);
      
      const duration = Date.now() - startTime;
      logger.info('Search completed', {
        street,
        lat,
        lng,
        count: lamps.length,
        duration,
      });
      
      logger.logRequest(req, lamps.length);
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}