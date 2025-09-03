import axios from 'axios';
import { logger } from '../utils/logger';

export interface BratislavaStreet {
  name: string;
  normalized: string;
}

export class BratislavaStreetsService {
  private streetsCache: BratislavaStreet[] = [];
  private cacheTimestamp: number = 0;
  private cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

  async getAllStreets(): Promise<BratislavaStreet[]> {
    const now = Date.now();
    
    if (this.streetsCache.length > 0 && (now - this.cacheTimestamp) < this.cacheTTL) {
      logger.debug('Using cached Bratislava streets', { count: this.streetsCache.length });
      return this.streetsCache;
    }

    try {
      logger.info('Fetching Bratislava streets from Overpass API');
      
      const overpassQuery = `
        [out:csv(name;false)];
        area[name="Bratislava"][boundary=administrative]->.a;
        (way(area.a)[highway][name];relation(area.a)[highway][name];);
        out tags;
      `;

      const response = await axios.post('https://overpass-api.de/api/interpreter', overpassQuery, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15000,
      });

      const streetNames = response.data
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line && line !== 'name')
        .map((name: string) => ({
          name: name,
          normalized: this.normalizeStreetName(name)
        }))
        .filter((street: BratislavaStreet, index: number, arr: BratislavaStreet[]) => 
          // Remove duplicates by normalized name
          arr.findIndex(s => s.normalized === street.normalized) === index
        )
        .sort((a: BratislavaStreet, b: BratislavaStreet) => a.name.localeCompare(b.name, 'sk'));

      this.streetsCache = streetNames;
      this.cacheTimestamp = now;

      logger.info('Cached Bratislava streets', { 
        count: streetNames.length,
        sample: streetNames.slice(0, 5).map((s: BratislavaStreet) => s.name)
      });

      return streetNames;

    } catch (error) {
      logger.error('Failed to fetch Bratislava streets', error);
      
      // Return cached data if available, even if expired
      if (this.streetsCache.length > 0) {
        logger.warn('Using expired street cache due to API failure');
        return this.streetsCache;
      }

      // Fallback to common Bratislava streets
      return this.getFallbackStreets();
    }
  }

  private normalizeStreetName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[áä]/g, 'a')
      .replace(/[čć]/g, 'c')
      .replace(/[ďđ]/g, 'd')
      .replace(/[éěë]/g, 'e')
      .replace(/[í]/g, 'i')
      .replace(/[ľĺ]/g, 'l')
      .replace(/[ňń]/g, 'n')
      .replace(/[óôö]/g, 'o')
      .replace(/[ŕř]/g, 'r')
      .replace(/[šś]/g, 's')
      .replace(/[ť]/g, 't')
      .replace(/[úůü]/g, 'u')
      .replace(/[ýÿ]/g, 'y')
      .replace(/[žź]/g, 'z');
  }

  async findBestMatch(userInput: string): Promise<BratislavaStreet[]> {
    const allStreets = await this.getAllStreets();
    const normalizedInput = this.normalizeStreetName(userInput);
    
    // Exact match first
    const exactMatch = allStreets.find(street => 
      street.normalized === normalizedInput
    );
    
    if (exactMatch) {
      return [exactMatch];
    }

    // Partial matches
    const partialMatches = allStreets
      .filter(street => 
        street.normalized.includes(normalizedInput) || 
        normalizedInput.includes(street.normalized)
      )
      .slice(0, 5);

    if (partialMatches.length > 0) {
      return partialMatches;
    }

    // Fuzzy matches (for typos)
    const fuzzyMatches = allStreets
      .filter(street => {
        const distance = this.levenshteinDistance(street.normalized, normalizedInput);
        return distance <= Math.max(2, Math.floor(normalizedInput.length * 0.3));
      })
      .slice(0, 3);

    return fuzzyMatches;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private getFallbackStreets(): BratislavaStreet[] {
    const commonStreets = [
      'Ružinovská', 'Lamačská cesta', 'Studenohorská', 'Hlavná',
      'Bratislavská', 'Račianska', 'Záhradnícka', 'Miletičova',
      'Partizánska cesta', 'Bajkalská', 'Tomášikova', 'Karadžičova'
    ];

    return commonStreets.map(name => ({
      name,
      normalized: this.normalizeStreetName(name)
    }));
  }
}