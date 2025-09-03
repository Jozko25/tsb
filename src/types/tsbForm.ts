// Real TSB Form Structure (based on the screenshots)

export interface TSBFormData {
  // Svetelné miesto (lamp ID from form)
  svetelneMiesto?: string; // e.g., "F023/057"
  
  // Typ zariadenia (device type)
  typZariadenia: 'svetidlo' | 'viac_svetidiel' | 'cela_oblast' | 'stoziar';
  
  // Porucha (fault type)  
  porucha: 'nesviet' | 'blika' | 'poskodene' | 'ine';
  
  // Upresnenie (detailed description)
  upresnenie: string;
  
  // Email address
  email?: string;
  
  // No photo upload needed
  
  // Additional fields we might need for processing
  street?: string;
  locationDescription?: string;
}

export interface TSBReportSubmission {
  // This will match the actual network request structure
  // We'll fill this when you provide network tab data
  [key: string]: any;
}

export interface ProcessedTSBReport {
  // Our internal processing result
  originalFormData: TSBFormData;
  detectedLamp: {
    id: string;
    number: string;
    coords: [number, number];
    street: string;
    confidence: number;
  } | null;
  submissionData: TSBReportSubmission;
  success: boolean;
  error?: string;
}