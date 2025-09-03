import axios, { AxiosError } from 'axios';
import { config } from '../config/config';
import { ArcGISQueryResponse, ArcGISFeature } from '../types';
import { logger } from '../utils/logger';

export class ArcGISQueryService {
  private async executeWithRetry<T>(
    url: string,
    params: any,
    retries: number = config.arcgis.maxRetries
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = config.arcgis.retryDelayMs * Math.pow(2, attempt - 1);
          logger.debug(`Retry attempt ${attempt} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const response = await axios.get<T>(url, {
          params,
          timeout: config.arcgis.httpTimeoutMs,
        });
        
        return response.data;
      } catch (error) {
        lastError = error as Error;
        
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          
          if (axiosError.response?.status === 400) {
            logger.error('Bad request to ArcGIS', {
              url,
              params,
              response: axiosError.response?.data
            });
            throw error;
          }
          
          if (attempt === retries) {
            logger.error(`Failed after ${retries + 1} attempts`, {
              url,
              params,
              error: axiosError.message
            });
          }
        }
      }
    }
    
    throw lastError || new Error('Query failed after retries');
  }

  async queryByAttributes(
    whereClause: string,
    offset: number = 0
  ): Promise<ArcGISQueryResponse> {
    const url = `${config.arcgis.featureUrl}/query`;
    
    const params = {
      f: 'json',
      where: whereClause,
      outFields: '*',
      returnGeometry: true,
      resultOffset: offset,
      resultRecordCount: config.search.maxRecordCount,
    };
    
    logger.debug('ArcGIS attribute query', { 
      url,
      where: whereClause,
      offset 
    });
    
    return await this.executeWithRetry<ArcGISQueryResponse>(url, params);
  }

  async queryBySpatialAndAttributes(
    geometry: any,
    whereClause?: string,
    offset: number = 0
  ): Promise<ArcGISQueryResponse> {
    const url = `${config.arcgis.featureUrl}/query`;
    
    const params: any = {
      f: 'json',
      geometry: JSON.stringify(geometry),
      geometryType: 'esriGeometryPolygon',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: true,
      resultOffset: offset,
      resultRecordCount: config.search.maxRecordCount,
    };
    
    if (whereClause) {
      params.where = whereClause;
    }
    
    logger.debug('ArcGIS spatial query', {
      url,
      hasGeometry: !!geometry,
      where: whereClause,
      offset
    });
    
    return await this.executeWithRetry<ArcGISQueryResponse>(url, params);
  }

  async queryAll(
    queryFunction: (offset: number) => Promise<ArcGISQueryResponse>
  ): Promise<ArcGISFeature[]> {
    const allFeatures: ArcGISFeature[] = [];
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const response = await queryFunction(offset);
      
      if (response.features && response.features.length > 0) {
        allFeatures.push(...response.features);
        
        if (response.exceededTransferLimit || 
            response.features.length === config.search.maxRecordCount) {
          offset += response.features.length;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
      
      if (allFeatures.length > 5000) {
        logger.warn('Query returned more than 5000 features, stopping pagination');
        break;
      }
    }
    
    return allFeatures;
  }
}