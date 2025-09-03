import axios from 'axios';
import { config } from '../config/config';
import { ArcGISField, ArcGISLayerInfo, FieldDiscovery } from '../types';
import { logger } from '../utils/logger';

export class FieldDiscoveryService {
  private cachedDiscovery: FieldDiscovery | null = null;
  private readonly streetFieldPatterns = [
    'ulica', 'street', 'nazov_ulice', 'nazov', 'cesta', 'name'
  ];
  private readonly lampIdFieldPatterns = [
    'lamp', 'stlp', 'stĺp', 'cislo', 'number', 'id', 'svetlo', 'svetelne'
  ];

  async discoverFields(forceRefresh: boolean = false): Promise<FieldDiscovery> {
    const now = Date.now();
    
    if (!forceRefresh && 
        this.cachedDiscovery && 
        (now - this.cachedDiscovery.timestamp) < config.cache.fieldDiscoveryTtlSeconds * 1000) {
      logger.debug('Using cached field discovery');
      return this.cachedDiscovery;
    }

    logger.info('Discovering ArcGIS fields from layer metadata');
    
    try {
      const response = await axios.get<ArcGISLayerInfo>(
        `${config.arcgis.featureUrl}?f=json`,
        {
          timeout: config.arcgis.httpTimeoutMs,
        }
      );

      const fields = response.data.fields || [];
      
      const streetFields = this.identifyStreetFields(fields);
      const lampIdFields = this.identifyLampIdFields(fields);

      this.cachedDiscovery = {
        streetFields,
        lampIdFields,
        allFields: fields,
        timestamp: now,
      };

      logger.info('Field discovery completed', {
        streetFields,
        lampIdFields,
        totalFields: fields.length,
      });

      return this.cachedDiscovery;
    } catch (error) {
      logger.error('Field discovery failed', error);
      
      if (this.cachedDiscovery) {
        logger.warn('Using stale cached field discovery due to error');
        return this.cachedDiscovery;
      }
      
      return {
        streetFields: ['ulica', 'nazov_ulice', 'street_name'],
        lampIdFields: ['cislo_stlp', 'lamp_id', 'objectid'],
        allFields: [],
        timestamp: now,
      };
    }
  }

  private identifyStreetFields(fields: ArcGISField[]): string[] {
    const streetFields: string[] = [];
    
    for (const field of fields) {
      const fieldNameLower = field.name.toLowerCase();
      const aliasLower = (field.alias || '').toLowerCase();
      
      for (const pattern of this.streetFieldPatterns) {
        if (fieldNameLower.includes(pattern) || aliasLower.includes(pattern)) {
          if (field.type === 'esriFieldTypeString') {
            streetFields.push(field.name);
            break;
          }
        }
      }
    }
    
    return streetFields.length > 0 ? streetFields : ['ulica'];
  }

  private identifyLampIdFields(fields: ArcGISField[]): string[] {
    const lampIdFields: string[] = [];
    
    for (const field of fields) {
      const fieldNameLower = field.name.toLowerCase();
      const aliasLower = (field.alias || '').toLowerCase();
      
      if (fieldNameLower === 'objectid' || fieldNameLower === 'oid') {
        continue;
      }
      
      for (const pattern of this.lampIdFieldPatterns) {
        if (fieldNameLower.includes(pattern) || aliasLower.includes(pattern)) {
          lampIdFields.push(field.name);
          break;
        }
      }
    }
    
    if (lampIdFields.length === 0) {
      lampIdFields.push('OBJECTID');
    }
    
    return lampIdFields;
  }
}