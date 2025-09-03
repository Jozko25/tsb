import { Request, Response, NextFunction } from 'express';
import { TSBFormProcessor } from '../services/tsbFormProcessor';
import { BratislavaStreetsService } from '../services/bratislavaStreets';
import { LampSearchService } from '../services/lampSearch';
import { FieldDiscoveryService } from '../services/fieldDiscovery';
import { ArcGISQueryService } from '../services/arcgisQuery';
import { logger } from '../utils/logger';

interface TSBTestRequest {
  street: string;
  locationDescription: string;
  issueDescription: string;
}

interface TSBTestResponse {
  success: boolean;
  voiceInput: TSBTestRequest;
  streetMatching: {
    inputStreet: string;
    matchedStreets: Array<{name: string; normalized: string}>;
    selectedStreet: string;
  };
  lampSearch: {
    foundLamps: number;
    selectedLamp?: {
      id: string;
      number: string;
      coords: [number, number];
      confidence: number;
    };
  };
  tsbFormData: {
    svetelneMiesto?: string;
    typZariadenia: string;
    porucha: string;
    upresnenie: string;
    email?: string;
  };
  submissionPreview: any;
}

export class TSBTestController {
  private tsbProcessor: TSBFormProcessor;

  constructor() {
    const fieldDiscovery = new FieldDiscoveryService();
    const arcgisQuery = new ArcGISQueryService();
    const lampSearch = new LampSearchService(fieldDiscovery, arcgisQuery);
    const streetService = new BratislavaStreetsService();
    
    this.tsbProcessor = new TSBFormProcessor(lampSearch, streetService);
  }

  async testTSBProcessing(
    req: Request<{}, TSBTestResponse, TSBTestRequest>,
    res: Response<TSBTestResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { street, locationDescription, issueDescription } = req.body;
      
      logger.info('Testing TSB form processing', { street, locationDescription, issueDescription });

      // Process the voice input
      const processed = await this.tsbProcessor.processVoiceReport({
        street,
        locationDescription,
        issueDescription
      });

      // Get additional debugging info
      const streetService = new BratislavaStreetsService();
      const streetMatches = await streetService.findBestMatch(street);

      const response: TSBTestResponse = {
        success: processed.success,
        voiceInput: {
          street,
          locationDescription,
          issueDescription
        },
        streetMatching: {
          inputStreet: street,
          matchedStreets: streetMatches.slice(0, 5),
          selectedStreet: streetMatches[0]?.name || street
        },
        lampSearch: {
          foundLamps: processed.detectedLamp ? 1 : 0, // Will be enhanced
          ...(processed.detectedLamp && {
            selectedLamp: {
              id: processed.detectedLamp.id,
              number: processed.detectedLamp.number,
              coords: processed.detectedLamp.coords,
              confidence: processed.detectedLamp.confidence
            }
          })
        },
        tsbFormData: {
          svetelneMiesto: processed.originalFormData.svetelneMiesto,
          typZariadenia: processed.originalFormData.typZariadenia,
          porucha: processed.originalFormData.porucha,
          upresnenie: processed.originalFormData.upresnenie,
          email: processed.originalFormData.email
        },
        submissionPreview: processed.submissionData
      };

      logger.info('TSB processing test completed', {
        success: processed.success,
        streetMatch: streetMatches[0]?.name,
        lampDetected: !!processed.detectedLamp,
        formType: processed.originalFormData.typZariadenia,
        faultType: processed.originalFormData.porucha
      });

      res.json(response);
    } catch (error) {
      logger.error('TSB test processing failed', error);
      next(error);
    }
  }
}