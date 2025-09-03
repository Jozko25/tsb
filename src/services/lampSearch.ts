import { ArcGISFeature, FieldDiscovery, Lamp, LampSearchRequest } from '../types';
import { FieldDiscoveryService } from './fieldDiscovery';
import { ArcGISQueryService } from './arcgisQuery';
import { StreetMatcherService } from './streetMatcher';
import { removeDiacritics, normalizeStreet } from '../utils/diacritics';
import { createBufferPolygon, transformCoordinates } from '../utils/geometry';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class LampSearchService {
  private streetMatcher: StreetMatcherService;

  constructor(
    private fieldDiscovery: FieldDiscoveryService,
    private arcgisQuery: ArcGISQueryService
  ) {
    this.streetMatcher = new StreetMatcherService(arcgisQuery);
  }

  async searchLamps(request: LampSearchRequest): Promise<{
    lamps: Lamp[];
    fieldDiscovery: FieldDiscovery;
    suggestedStreets?: string[];
  }> {
    const fields = await this.fieldDiscovery.discoverFields();
    const normalizedStreet = normalizeStreet(request.street);
    
    let features: ArcGISFeature[] = [];
    let suggestedStreets: string[] = [];
    
    if (request.lat !== undefined && request.lng !== undefined) {
      features = await this.searchWithSpatialFilter(
        normalizedStreet,
        request.lat,
        request.lng,
        fields
      );
    }
    
    if (features.length === 0) {
      features = await this.searchByStreetAttribute(normalizedStreet, fields);
    }
    
    // If no results found, use AI to suggest better street names
    if (features.length === 0) {
      logger.info('No lamps found, trying AI street matching', { street: normalizedStreet });
      suggestedStreets = await this.streetMatcher.findBestStreetMatch(normalizedStreet);
      
      // Try the AI suggestions
      for (const suggestion of suggestedStreets.slice(0, 2)) {
        const suggestionFeatures = await this.searchByStreetAttribute(suggestion, fields);
        if (suggestionFeatures.length > 0) {
          features = suggestionFeatures;
          logger.info('Found lamps using AI suggestion', { 
            original: normalizedStreet, 
            suggestion, 
            count: features.length 
          });
          break;
        }
      }
    }
    
    const lamps = this.transformFeaturesToLamps(features, fields);
    
    return {
      lamps,
      fieldDiscovery: fields,
      ...(suggestedStreets.length > 0 && { suggestedStreets }),
    };
  }

  private async searchWithSpatialFilter(
    street: string,
    lat: number,
    lng: number,
    fields: FieldDiscovery
  ): Promise<ArcGISFeature[]> {
    const buffer = createBufferPolygon(lat, lng, config.search.bufferMeters);
    const geometry = {
      rings: [buffer],
      spatialReference: { wkid: 4326 }
    };
    
    const whereClause = this.buildStreetWhereClause(street, fields.streetFields);
    
    try {
      const features = await this.arcgisQuery.queryAll(
        (offset) => this.arcgisQuery.queryBySpatialAndAttributes(geometry, whereClause, offset)
      );
      
      logger.info(`Spatial search found ${features.length} features`, {
        street,
        lat,
        lng,
        bufferMeters: config.search.bufferMeters
      });
      
      return features;
    } catch (error) {
      logger.error('Spatial search failed', error);
      return [];
    }
  }

  private async searchByStreetAttribute(
    street: string,
    fields: FieldDiscovery
  ): Promise<ArcGISFeature[]> {
    let features: ArcGISFeature[] = [];
    
    features = await this.tryStreetVariants(street, fields.streetFields);
    
    if (features.length === 0) {
      const deAccented = removeDiacritics(street);
      if (deAccented !== street) {
        logger.debug('Trying de-accented variant', { original: street, deAccented });
        features = await this.tryStreetVariants(deAccented, fields.streetFields);
      }
    }
    
    return features;
  }

  private async tryStreetVariants(
    street: string,
    streetFields: string[]
  ): Promise<ArcGISFeature[]> {
    for (const field of streetFields) {
      const whereClause = `UPPER(${field}) LIKE UPPER('%${street}%')`;
      
      try {
        const features = await this.arcgisQuery.queryAll(
          (offset) => this.arcgisQuery.queryByAttributes(whereClause, offset)
        );
        
        if (features.length > 0) {
          logger.info(`Found ${features.length} features using field ${field}`, {
            street,
            whereClause
          });
          return features;
        }
      } catch (error) {
        logger.debug(`Query failed for field ${field}`, error);
      }
    }
    
    if (streetFields.length > 1) {
      const combinedWhere = streetFields
        .map(field => `UPPER(${field}) LIKE UPPER('%${street}%')`)
        .join(' OR ');
      
      try {
        const features = await this.arcgisQuery.queryAll(
          (offset) => this.arcgisQuery.queryByAttributes(combinedWhere, offset)
        );
        
        if (features.length > 0) {
          logger.info(`Found ${features.length} features using combined fields`, {
            street,
            fields: streetFields
          });
          return features;
        }
      } catch (error) {
        logger.debug('Combined field query failed', error);
      }
    }
    
    return [];
  }

  private buildStreetWhereClause(street: string, streetFields: string[]): string {
    if (streetFields.length === 1) {
      return `UPPER(${streetFields[0]}) LIKE UPPER('%${street}%')`;
    }
    
    return streetFields
      .map(field => `UPPER(${field}) LIKE UPPER('%${street}%')`)
      .join(' OR ');
  }

  private transformFeaturesToLamps(
    features: ArcGISFeature[],
    fields: FieldDiscovery
  ): Lamp[] {
    return features.map(feature => {
      const coords = transformCoordinates(feature.geometry);
      
      if (!coords) {
        logger.warn('Feature missing valid geometry', { 
          attributes: feature.attributes 
        });
        return null;
      }
      
      const lampNumber = this.extractLampNumber(feature.attributes, fields.lampIdFields);
      const id = feature.attributes.OBJECTID || 
                 feature.attributes.objectid || 
                 feature.attributes.OID || 
                 String(Math.random());
      
      return {
        id: String(id),
        lampNumber,
        coords,
        attributes: feature.attributes,
      };
    }).filter((lamp): lamp is Lamp => lamp !== null);
  }

  private extractLampNumber(
    attributes: Record<string, any>,
    lampIdFields: string[]
  ): string | null {
    for (const field of lampIdFields) {
      const value = attributes[field];
      if (value !== null && value !== undefined && value !== '') {
        return String(value);
      }
      
      const lowerField = field.toLowerCase();
      const upperField = field.toUpperCase();
      
      if (attributes[lowerField] !== undefined && attributes[lowerField] !== null) {
        return String(attributes[lowerField]);
      }
      
      if (attributes[upperField] !== undefined && attributes[upperField] !== null) {
        return String(attributes[upperField]);
      }
    }
    
    return null;
  }
}