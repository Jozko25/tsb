export interface LampSearchRequest {
  street: string;
  lat?: number;
  lng?: number;
}

export interface Lamp {
  id: string;
  lampNumber: string | null;
  coords: [number, number];
  attributes: Record<string, any>;
}

export interface LampSearchResponse {
  success: boolean;
  query: {
    street: string;
    lat?: number;
    lng?: number;
  };
  count: number;
  summary: string;
  lamps: Lamp[];
  fieldDiscovery: {
    streetFields: string[];
    lampIdFields: string[];
  };
  suggestedStreets?: string[];
}

export interface ArcGISField {
  name: string;
  type: string;
  alias?: string;
  domain?: any;
  defaultValue?: any;
  length?: number;
  nullable?: boolean;
  editable?: boolean;
}

export interface ArcGISLayerInfo {
  fields: ArcGISField[];
  spatialReference?: {
    wkid: number;
    latestWkid?: number;
  };
  maxRecordCount?: number;
}

export interface ArcGISFeature {
  attributes: Record<string, any>;
  geometry?: {
    x?: number;
    y?: number;
    rings?: number[][][];
    paths?: number[][][];
  };
}

export interface ArcGISQueryResponse {
  features: ArcGISFeature[];
  exceededTransferLimit?: boolean;
  fields?: ArcGISField[];
  spatialReference?: {
    wkid: number;
    latestWkid?: number;
  };
}

export interface FieldDiscovery {
  streetFields: string[];
  lampIdFields: string[];
  allFields: ArcGISField[];
  timestamp: number;
}