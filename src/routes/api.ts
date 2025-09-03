import { Router } from 'express';
import { LampController } from '../controllers/lampController';
import { HealthController } from '../controllers/healthController';
import { validateLampSearchRequest } from '../middleware/validation';
import { LampSearchService } from '../services/lampSearch';
import { FieldDiscoveryService } from '../services/fieldDiscovery';
import { ArcGISQueryService } from '../services/arcgisQuery';
import { CacheService } from '../services/cache';

export function createApiRouter(): Router {
  const router = Router();
  
  const fieldDiscoveryService = new FieldDiscoveryService();
  const arcgisQueryService = new ArcGISQueryService();
  const lampSearchService = new LampSearchService(
    fieldDiscoveryService,
    arcgisQueryService
  );
  const cacheService = new CacheService();
  
  const lampController = new LampController(lampSearchService, cacheService);
  const healthController = new HealthController(cacheService);
  
  router.post(
    '/lamps/search',
    validateLampSearchRequest,
    lampController.searchLamps.bind(lampController)
  );
  
  router.get(
    '/health',
    healthController.checkHealth.bind(healthController)
  );
  
  return router;
}