import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  arcgis: {
    featureUrl: process.env.ARCGIS_FEATURE_URL || 
      'https://tsb.bratislava.sk/gismap/rest/services/svetelne_miesta/sm_dataset_obcan/FeatureServer/0',
    httpTimeoutMs: parseInt(process.env.HTTP_TIMEOUT_MS || '10000', 10),
    maxRetries: 2,
    retryDelayMs: 1000,
  },
  search: {
    bufferMeters: parseInt(process.env.BUFFER_METERS || '150', 10),
    maxRecordCount: 1000,
  },
  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_S || '300', 10),
    fieldDiscoveryTtlSeconds: 600,
  },
  rateLimit: {
    windowMs: 60000,
    max: parseInt(process.env.RATE_LIMIT_RPM || '60', 10),
  },
};