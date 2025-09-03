import { Router } from 'express';
import { LampController } from '../controllers/lampController';
import { HealthController } from '../controllers/healthController';
import { ReportingController } from '../controllers/reportingController';
import { validateLampSearchRequest } from '../middleware/validation';
import { validateReportRequest } from '../middleware/reportValidation';
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
  const reportingController = new ReportingController();
  
  // Search endpoints (for information)
  router.post(
    '/lamps/search',
    validateLampSearchRequest,
    lampController.searchLamps.bind(lampController)
  );
  
  // Reporting endpoints (for citizens)
  router.post(
    '/lamps/report',
    validateReportRequest,
    reportingController.reportLampIssue.bind(reportingController)
  );
  
  router.get(
    '/health',
    healthController.checkHealth.bind(healthController)
  );
  
  return router;
}