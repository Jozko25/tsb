import OpenAI from 'openai';
import { GeocodingService } from './geocoding';
import { LampSearchService } from './lampSearch';
import { logger } from '../utils/logger';

export interface LampReport {
  id: string;
  timestamp: Date;
  street: string;
  description: string;
  issue: string;
  citizenLocation: string;
  detectedLamps: Array<{
    lampId: string;
    lampNumber: string;
    distance: number;
    confidence: number;
    coords: [number, number];
  }>;
  confidence: number;
  status: 'pending' | 'assigned' | 'completed';
}

export class ReportingService {
  private openai: OpenAI;
  private geocoding: GeocodingService;

  constructor(
    private lampSearch: LampSearchService
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.geocoding = new GeocodingService();
  }

  async processLampReport(input: {
    street: string;
    locationDescription: string;
    issueDescription: string;
  }): Promise<LampReport> {
    
    logger.info('Processing lamp report', input);

    // 1. Use AI to extract precise location info
    const locationAnalysis = await this.analyzeCitizenDescription(
      input.street,
      input.locationDescription
    );

    // 2. Find all lamps on the street
    const streetLamps = await this.lampSearch.searchLamps({
      street: input.street
    });

    // 3. Use AI + geocoding to pinpoint likely lamps
    const candidateLamps = await this.identifyLikelyLamps(
      locationAnalysis,
      streetLamps.lamps
    );

    // 4. Generate report
    const report: LampReport = {
      id: this.generateReportId(),
      timestamp: new Date(),
      street: input.street,
      description: input.locationDescription,
      issue: input.issueDescription,
      citizenLocation: locationAnalysis.interpretedLocation,
      detectedLamps: candidateLamps,
      confidence: this.calculateOverallConfidence(candidateLamps),
      status: 'pending'
    };

    logger.info('Generated lamp report', {
      reportId: report.id,
      street: report.street,
      candidateCount: candidateLamps.length,
      confidence: report.confidence
    });

    return report;
  }

  private async analyzeCitizenDescription(
    street: string,
    description: string
  ): Promise<{
    interpretedLocation: string;
    addressComponents: string[];
    landmarks: string[];
    confidence: number;
  }> {
    
    if (!process.env.OPENAI_API_KEY) {
      return {
        interpretedLocation: description,
        addressComponents: [],
        landmarks: [],
        confidence: 0.3
      };
    }

    try {
      const prompt = `
Analyzuj popis polohy od občana pre nahlásenie pokazenej lampy:

Ulica: "${street}"
Popis: "${description}"

Extrahuj a štandardizuj:
1. Čísla domov (napr. "pri dome 45", "medzi 20 a 25")
2. Názvy križovatiek, ulíc (napr. "pri Hlavnej", "na rohu s Partizánskou")  
3. Významné body (obchody, školy, zastávky, parky)
4. Smer/stranu ulice (napr. "pravá strana", "smerom od centra")

Vráť JSON:
{
  "interpretedLocation": "štandardizovaný popis",
  "addressComponents": ["čísla domov"],
  "landmarks": ["križovatky a významné body"],
  "confidence": 0.8
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content || '{}';
      
      // Handle markdown-wrapped JSON responses from OpenAI
      const cleanedContent = content
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      
      const result = JSON.parse(cleanedContent);
      
      return {
        interpretedLocation: result.interpretedLocation || description,
        addressComponents: result.addressComponents || [],
        landmarks: result.landmarks || [],
        confidence: result.confidence || 0.5
      };

    } catch (error) {
      logger.error('AI location analysis failed', error);
      return {
        interpretedLocation: description,
        addressComponents: [],
        landmarks: [],
        confidence: 0.3
      };
    }
  }

  private async identifyLikelyLamps(
    locationAnalysis: any,
    streetLamps: any[]
  ): Promise<Array<{
    lampId: string;
    lampNumber: string;
    distance: number;
    confidence: number;
    coords: [number, number];
  }>> {
    
    const candidates: Array<{
      lampId: string;
      lampNumber: string;
      distance: number;
      confidence: number;
      coords: [number, number];
    }> = [];

    // Try geocoding with address components
    for (const addressComponent of locationAnalysis.addressComponents) {
      const fullAddress = `${locationAnalysis.interpretedLocation}, ${addressComponent}`;
      
      try {
        const nearbyLamps = await this.geocoding.findNearestLamps(
          fullAddress,
          streetLamps,
          50 // 50 meter radius
        );

        for (const nearby of nearbyLamps) {
          candidates.push({
            lampId: nearby.lamp.id,
            lampNumber: nearby.lamp.lampNumber || 'N/A',
            distance: nearby.distance,
            confidence: Math.max(0.1, Math.min(0.9, 1 - nearby.distance / 100)),
            coords: nearby.lamp.coords
          });
        }
      } catch (error) {
        logger.debug('Geocoding failed for address component', { addressComponent, error });
      }
    }

    // If no geocoding results, return lamps with lower confidence
    if (candidates.length === 0) {
      return streetLamps.slice(0, 5).map((lamp, index) => ({
        lampId: lamp.id,
        lampNumber: lamp.lampNumber || 'N/A',
        distance: 999, // Unknown distance
        confidence: Math.max(0.1, 0.4 - index * 0.05), // Decreasing confidence
        coords: lamp.coords
      }));
    }

    // Remove duplicates and sort by confidence
    const uniqueCandidates = candidates
      .filter((item, index, self) => 
        index === self.findIndex(i => i.lampId === item.lampId)
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3); // Top 3 candidates

    return uniqueCandidates;
  }

  private calculateOverallConfidence(candidates: any[]): number {
    if (candidates.length === 0) return 0.1;
    
    const avgConfidence = candidates.reduce((sum, c) => sum + c.confidence, 0) / candidates.length;
    const proximityBonus = candidates.length > 1 && candidates[0].distance < 25 ? 0.1 : 0;
    
    return Math.min(0.95, avgConfidence + proximityBonus);
  }

  private generateReportId(): string {
    return `TSB-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  }

  async generateWorkOrder(report: LampReport): Promise<{
    workOrderId: string;
    assignedLamps: string[];
    instructions: string;
    priority: 'low' | 'medium' | 'high';
  }> {
    
    const priority = this.determinePriority(report.issue);
    const topCandidate = report.detectedLamps[0];
    
    const instructions = `
NAHLÁSENIE PORUCHY OSVETLENIA

Číslo hlásenia: ${report.id}
Dátum: ${report.timestamp.toLocaleString('sk-SK')}
Ulica: ${report.street}
Popis polohy: ${report.description}
Problém: ${report.issue}

KANDIDÁTSKE LAMPY:
${report.detectedLamps.map(lamp => 
  `- Lampa ${lamp.lampNumber} (${lamp.lampId}) - ${Math.round(lamp.distance)}m, spoľahlivosť ${Math.round(lamp.confidence * 100)}%`
).join('\n')}

ODPORÚČANIE: Začať kontrolou lampy ${topCandidate?.lampNumber || 'prvej v zozname'}
GPS súradnice: ${topCandidate?.coords[0]}, ${topCandidate?.coords[1]}

Spoľahlivosť lokalizácie: ${Math.round(report.confidence * 100)}%
`.trim();

    return {
      workOrderId: `WO-${report.id}`,
      assignedLamps: report.detectedLamps.map(l => l.lampNumber),
      instructions,
      priority
    };
  }

  private determinePriority(issueDescription: string): 'low' | 'medium' | 'high' {
    const issue = issueDescription.toLowerCase();
    
    if (issue.includes('spadnutá') || issue.includes('nebezpečn') || issue.includes('poškoden')) {
      return 'high';
    }
    
    if (issue.includes('bliká') || issue.includes('slabo sviet')) {
      return 'medium';  
    }
    
    return 'low';
  }
}