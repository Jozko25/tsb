import axios from 'axios';
import { logger } from '../utils/logger';

export interface GeocodingResult {
  lat: number;
  lng: number;
  address: string;
  confidence: number;
}

export class GeocodingService {
  
  async geocodeAddress(address: string): Promise<GeocodingResult | null> {
    // Try multiple geocoding services for better coverage of Slovak addresses
    
    // Option 1: Nominatim (OpenStreetMap) - free but rate limited
    const nominatimResult = await this.tryNominatim(address);
    if (nominatimResult) return nominatimResult;
    
    // Option 2: Google Geocoding API (if API key available)
    if (process.env.GOOGLE_MAPS_API_KEY) {
      const googleResult = await this.tryGoogle(address);
      if (googleResult) return googleResult;
    }
    
    return null;
  }

  private async tryNominatim(address: string): Promise<GeocodingResult | null> {
    try {
      // Format address for Slovak context
      const formattedAddress = `${address}, Bratislava, Slovakia`;
      
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: formattedAddress,
          format: 'json',
          limit: 1,
          countrycodes: 'sk',
          'accept-language': 'sk,en'
        },
        headers: {
          'User-Agent': 'TSB-Lamp-Search/1.0'
        },
        timeout: 5000
      });

      const results = response.data;
      if (results && results.length > 0) {
        const result = results[0];
        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          address: result.display_name,
          confidence: parseFloat(result.importance) || 0.5
        };
      }
    } catch (error) {
      logger.debug('Nominatim geocoding failed', { address, error: (error as Error).message });
    }
    
    return null;
  }

  private async tryGoogle(address: string): Promise<GeocodingResult | null> {
    try {
      const formattedAddress = `${address}, Bratislava, Slovakia`;
      
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: formattedAddress,
          key: process.env.GOOGLE_MAPS_API_KEY,
          region: 'sk',
          language: 'sk'
        },
        timeout: 5000
      });

      const results = response.data.results;
      if (results && results.length > 0) {
        const result = results[0];
        const location = result.geometry.location;
        
        return {
          lat: location.lat,
          lng: location.lng,
          address: result.formatted_address,
          confidence: this.calculateGoogleConfidence(result)
        };
      }
    } catch (error) {
      logger.debug('Google geocoding failed', { address, error: (error as Error).message });
    }
    
    return null;
  }

  private calculateGoogleConfidence(result: any): number {
    // Higher confidence for more precise location types
    const locationType = result.geometry.location_type;
    switch (locationType) {
      case 'ROOFTOP': return 0.9;
      case 'RANGE_INTERPOLATED': return 0.8;
      case 'GEOMETRIC_CENTER': return 0.6;
      case 'APPROXIMATE': return 0.4;
      default: return 0.5;
    }
  }

  async findNearestLamps(
    address: string, 
    streetLamps: Array<{id: string, coords: [number, number], attributes: any}>,
    maxDistance: number = 100
  ): Promise<Array<{lamp: any, distance: number}>> {
    
    const location = await this.geocodeAddress(address);
    if (!location) {
      logger.warn('Could not geocode address', { address });
      return [];
    }

    logger.info('Geocoded address', { 
      address, 
      location: { lat: location.lat, lng: location.lng },
      confidence: location.confidence 
    });

    // Calculate distances to all lamps
    const lampsWithDistance = streetLamps.map(lamp => {
      const distance = this.calculateDistance(
        location.lat, location.lng,
        lamp.coords[1], lamp.coords[0]  // Note: coords are [lng, lat]
      );
      
      return { lamp, distance };
    }).filter(item => item.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance);

    return lampsWithDistance.slice(0, 10); // Return top 10 closest
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // Return distance in meters
  }
}