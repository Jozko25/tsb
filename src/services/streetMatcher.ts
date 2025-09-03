import OpenAI from 'openai';
import { ArcGISQueryService } from './arcgisQuery';
import { logger } from '../utils/logger';
import { removeDiacritics, normalizeStreet } from '../utils/diacritics';

export class StreetMatcherService {
  private openai: OpenAI;
  private streetCache: Map<string, string[]> = new Map();
  private cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private arcgisQuery: ArcGISQueryService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async findBestStreetMatch(userInput: string): Promise<string[]> {
    const normalizedInput = normalizeStreet(userInput);
    
    // Try exact matches first
    const exactMatches = await this.tryExactMatches(normalizedInput);
    if (exactMatches.length > 0) {
      logger.info('Found exact street matches', { input: userInput, matches: exactMatches });
      return exactMatches;
    }

    // Get sample of existing streets for fuzzy matching
    const existingStreets = await this.getSampleStreetNames();
    if (existingStreets.length === 0) {
      logger.warn('No existing streets found for fuzzy matching');
      return [normalizedInput]; // fallback to original
    }

    // Use OpenAI for intelligent matching
    const aiMatches = await this.getAIStreetMatches(normalizedInput, existingStreets);
    
    logger.info('AI street matching completed', { 
      input: userInput, 
      suggestions: aiMatches 
    });
    
    return aiMatches.length > 0 ? aiMatches : [normalizedInput];
  }

  private async tryExactMatches(street: string): Promise<string[]> {
    const variations = [
      street,
      removeDiacritics(street),
      street + ' ulica',
      street.replace(' ulica', ''),
      street.replace(/^ulica /i, ''),
    ];

    for (const variation of variations) {
      try {
        const response = await this.arcgisQuery.queryByAttributes(
          `UPPER(ulica) LIKE UPPER('%${variation}%')`,
          0
        );
        
        if (response.features && response.features.length > 0) {
          return [variation];
        }
      } catch (error) {
        logger.debug(`Failed to query variation: ${variation}`, error);
      }
    }

    return [];
  }

  private async getSampleStreetNames(): Promise<string[]> {
    const cacheKey = 'sample_streets';
    const cached = this.streetCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cacheKey)) {
      return cached;
    }

    try {
      // Get a sample of streets from the database
      const response = await this.arcgisQuery.queryByAttributes('1=1', 0);
      
      if (response.features) {
        const streets = response.features
          .map(feature => feature.attributes.ulica)
          .filter(street => street && typeof street === 'string')
          .filter((street, index, arr) => arr.indexOf(street) === index) // unique
          .slice(0, 200); // limit to 200 for AI context

        this.streetCache.set(cacheKey, streets);
        logger.info(`Cached ${streets.length} street names for matching`);
        
        return streets;
      }
    } catch (error) {
      logger.error('Failed to get sample street names', error);
    }

    return [];
  }

  private async getAIStreetMatches(userInput: string, existingStreets: string[]): Promise<string[]> {
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OpenAI API key not configured, skipping AI matching');
      return [];
    }

    try {
      const prompt = `
User is looking for street: "${userInput}"

Available streets in database:
${existingStreets.slice(0, 100).join('\n')}

Find the 3 most likely matches for the user's input. Consider:
- Slovak language variations and diacritics
- Common misspellings
- Partial names (e.g. "Studeno Horská" might be "Studenohorská")
- Different word orders

Return only the exact street names from the database, one per line, max 3 results.
If no good matches, return empty.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      });

      const suggestions = response.choices[0]?.message?.content
        ?.split('\n')
        .map(line => line.trim())
        .filter(line => line && existingStreets.includes(line))
        .slice(0, 3) || [];

      return suggestions;

    } catch (error) {
      logger.error('OpenAI street matching failed', error);
      return [];
    }
  }

  private isCacheValid(key: string): boolean {
    const cacheTime = this.streetCache.get(`${key}_timestamp`);
    if (!cacheTime) return false;
    return (Date.now() - parseInt(cacheTime[0])) < this.cacheExpiry;
  }
}