import { TSBFormData, ProcessedTSBReport, TSBReportSubmission } from '../types/tsbForm';
import { LampSearchService } from './lampSearch';
import { BratislavaStreetsService } from './bratislavaStreets';
import { logger } from '../utils/logger';
import axios from 'axios';

export class TSBFormProcessor {
  constructor(
    private lampSearch: LampSearchService,
    private streetService: BratislavaStreetsService
  ) {}

  async processVoiceReport(input: {
    street: string;
    locationDescription: string;
    issueDescription: string;
  }): Promise<ProcessedTSBReport> {
    
    logger.info('Processing voice report for TSB form', input);

    try {
      // 1. Find the exact street name from Bratislava streets
      const streetMatches = await this.streetService.findBestMatch(input.street);
      const bestStreet = streetMatches[0]?.name || input.street;

      // 2. Find lamps on that street
      const searchResult = await this.lampSearch.searchLamps({
        street: bestStreet
      });

      // 3. Identify the specific lamp (if possible)
      const detectedLamp = this.identifySpecificLamp(searchResult.lamps, input.locationDescription);

      // 4. Convert to TSB form structure
      const formData = this.convertToTSBForm(input, detectedLamp);

      // 5. Prepare submission data (will be completed when you give network data)
      const submissionData = this.prepareTSBSubmission(formData, detectedLamp);

      return {
        originalFormData: formData,
        detectedLamp,
        submissionData,
        success: true
      };

    } catch (error) {
      logger.error('Failed to process voice report', error);
      
      return {
        originalFormData: this.convertToTSBForm(input, null),
        detectedLamp: null,
        submissionData: {},
        success: false,
        error: (error as Error).message
      };
    }
  }

  private identifySpecificLamp(lamps: any[], locationDescription: string): any {
    if (lamps.length === 0) return null;
    
    // If only one lamp, return it
    if (lamps.length === 1) {
      return {
        id: lamps[0].id,
        number: lamps[0].lampNumber || 'N/A',
        coords: lamps[0].coords,
        street: lamps[0].attributes.ulica || '',
        confidence: 0.9
      };
    }

    // For multiple lamps, try to identify by location description
    // This is where we'd use geocoding/AI to pinpoint exact lamp
    // For now, return the first lamp with lower confidence
    return {
      id: lamps[0].id,
      number: lamps[0].lampNumber || 'N/A', 
      coords: lamps[0].coords,
      street: lamps[0].attributes.ulica || '',
      confidence: 0.6
    };
  }

  private convertToTSBForm(input: any, detectedLamp: any): TSBFormData {
    // Map voice input to TSB form fields
    
    // Determine device type based on description
    let typZariadenia: TSBFormData['typZariadenia'] = 'svetidlo';
    const desc = input.issueDescription.toLowerCase();
    if (desc.includes('stĺp') || desc.includes('stožiar')) {
      typZariadenia = 'stoziar';
    } else if (desc.includes('viac') || desc.includes('všetk')) {
      typZariadenia = 'viac_svetidiel';
    } else if (desc.includes('oblasť') || desc.includes('celá')) {
      typZariadenia = 'cela_oblast';
    }

    // Determine fault type
    let porucha: TSBFormData['porucha'] = 'nesviet';
    if (desc.includes('blik')) {
      porucha = 'blika';
    } else if (desc.includes('poškoden') || desc.includes('zlom') || desc.includes('spadnut')) {
      porucha = 'poskodene';
    } else if (!desc.includes('nesviet')) {
      porucha = 'ine';
    }

    return {
      svetelneMiesto: detectedLamp?.number || undefined,
      typZariadenia,
      porucha,
      upresnenie: `${input.locationDescription} - ${input.issueDescription}`,
      street: input.street,
      locationDescription: input.locationDescription
    };
  }

  private prepareTSBSubmission(formData: TSBFormData, detectedLamp: any): TSBReportSubmission {
    // This will be filled when you provide the actual network request format
    // For now, prepare the basic structure
    return {
      // Placeholder - will be replaced with real TSB API format
      svetelneMiesto: formData.svetelneMiesto,
      typZariadenia: formData.typZariadenia,
      porucha: formData.porucha,
      upresnenie: formData.upresnenie,
      // Additional fields will be added based on network tab data
    };
  }

  async submitToTSB(reportData: ProcessedTSBReport): Promise<boolean> {
    // This method will submit to the actual TSB system
    // Implementation will be completed when you provide network request details
    
    logger.info('Preparing TSB submission', {
      lampId: reportData.detectedLamp?.id,
      formData: reportData.originalFormData
    });

    // TODO: Replace with actual TSB API call
    // const response = await axios.post('https://tsb.bratislava.sk/api/submit', reportData.submissionData);
    
    // For now, just log what would be submitted
    logger.info('Would submit to TSB:', reportData.submissionData);
    
    return true; // Placeholder
  }
}