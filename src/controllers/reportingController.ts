import { Request, Response, NextFunction } from 'express';
import { ReportingService } from '../services/reportingService';
import { LampSearchService } from '../services/lampSearch';
import { FieldDiscoveryService } from '../services/fieldDiscovery';
import { ArcGISQueryService } from '../services/arcgisQuery';
import { logger } from '../utils/logger';

interface ReportRequest {
  street: string;
  locationDescription: string;
  issueDescription: string;
}

interface ReportResponse {
  success: boolean;
  reportId: string;
  message: string;
  lampNumbers?: string[];
  workOrder?: {
    workOrderId: string;
    assignedLamps: string[];
    priority: string;
    estimatedResponse: string;
  };
}

export class ReportingController {
  private reportingService: ReportingService;

  constructor() {
    const fieldDiscovery = new FieldDiscoveryService();
    const arcgisQuery = new ArcGISQueryService();
    const lampSearch = new LampSearchService(fieldDiscovery, arcgisQuery);
    
    this.reportingService = new ReportingService(lampSearch);
  }

  async reportLampIssue(
    req: Request<{}, ReportResponse, ReportRequest>,
    res: Response<ReportResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { street, locationDescription, issueDescription } = req.body;
      
      // Process the report
      const report = await this.reportingService.processLampReport({
        street,
        locationDescription,
        issueDescription
      });

      // Generate work order
      const workOrder = await this.reportingService.generateWorkOrder(report);
      
      // Get lamp numbers for voice response
      const lampNumbers = report.detectedLamps
        .filter(lamp => lamp.lampNumber && lamp.lampNumber !== 'N/A')
        .map(lamp => lamp.lampNumber)
        .slice(0, 3); // Top 3 lamps with numbers
      
      const response: ReportResponse = {
        success: true,
        reportId: report.id,
        message: `Vaše nahlásenie bolo úspešne zaregistrované pod číslom ${report.id}. Technický tím bude informovaný.`,
        ...(lampNumbers.length > 0 && { lampNumbers }),
        workOrder: {
          workOrderId: workOrder.workOrderId,
          assignedLamps: workOrder.assignedLamps,
          priority: workOrder.priority,
          estimatedResponse: this.getEstimatedResponse(workOrder.priority)
        }
      };

      logger.info('Lamp issue reported', {
        reportId: report.id,
        street,
        priority: workOrder.priority,
        confidence: report.confidence,
        candidateCount: report.detectedLamps.length
      });

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  private getEstimatedResponse(priority: string): string {
    switch (priority) {
      case 'high': return '24 hodín';
      case 'medium': return '2-3 dni';
      case 'low': return '5-7 dní';
      default: return '3-5 dní';
    }
  }
}