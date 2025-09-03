# TSB Street Lamp Search API

Production-ready Node.js REST service for searching public street lamps in Bratislava using the official ArcGIS FeatureServer dataset.

## Features

- **Field Discovery**: Automatic detection of street name and lamp identifier fields from ArcGIS metadata
- **Case/Diacritics Handling**: Supports Slovak diacritics and common variants (e.g., "Ružinovská" and "Ruzinovska")
- **Spatial Search**: Optional location-based filtering using coordinates and buffer zones
- **Robust Querying**: Retry logic with exponential backoff for ArcGIS requests
- **Caching**: In-memory caching for field discovery and query results
- **Rate Limiting**: Configurable rate limiting to prevent abuse
- **Security**: CORS, Helmet, and security headers configured

## Installation

```bash
npm install
cp .env.example .env
```

## Configuration

Environment variables (`.env` file):

```env
PORT=3000
ARCGIS_FEATURE_URL=https://tsb.bratislava.sk/gismap/rest/services/svetelne_miesta/sm_dataset_obcan/FeatureServer/0
BUFFER_METERS=150
HTTP_TIMEOUT_MS=10000
CACHE_TTL_S=300
RATE_LIMIT_RPM=60
```

## Running the Service

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build
npm start
```

## API Endpoints

### POST /api/lamps/search

Search for street lamps by street name with optional location filtering.

**Request Body:**
```json
{
  "street": "Ružinovská",
  "lat": 48.1482,
  "lng": 17.1067
}
```

- `street` (required): Street name to search for
- `lat` (optional): Latitude for spatial filtering
- `lng` (optional): Longitude for spatial filtering

**Response:**
```json
{
  "success": true,
  "query": {
    "street": "Ružinovská",
    "lat": 48.1482,
    "lng": 17.1067
  },
  "count": 4,
  "summary": "Found 4 lamps on Ružinovská",
  "lamps": [
    {
      "id": "12345",
      "lampNumber": "BA-123",
      "coords": [17.12345, 48.12345],
      "attributes": {
        "OBJECTID": 12345,
        "cislo_stlp": "BA-123",
        "ulica": "Ružinovská",
        "typ": "LED"
      }
    }
  ],
  "fieldDiscovery": {
    "streetFields": ["ulica", "nazov_ulice"],
    "lampIdFields": ["cislo_stlp", "lamp_id"]
  }
}
```

### GET /api/health

Health check endpoint returning service status and configuration.

**Response:**
```json
{
  "ok": true,
  "timestamp": "2024-01-20T10:30:00.000Z",
  "uptime": 3600,
  "cache": {
    "keys": 5,
    "hits": 20,
    "misses": 3
  },
  "config": {
    "arcgisUrl": "...",
    "bufferMeters": 150,
    "cacheTtl": 300,
    "rateLimit": 60
  }
}
```

## Examples

### Basic Street Search (with diacritics)
```bash
curl -X POST http://localhost:3000/api/lamps/search \
  -H "Content-Type: application/json" \
  -d '{"street": "Ružinovská"}'
```

### Street Search (without diacritics)
```bash
curl -X POST http://localhost:3000/api/lamps/search \
  -H "Content-Type: application/json" \
  -d '{"street": "Ruzinovska"}'
```

### Search with Location Filter
```bash
curl -X POST http://localhost:3000/api/lamps/search \
  -H "Content-Type: application/json" \
  -d '{"street": "Ružinovská", "lat": 48.15, "lng": 17.13}'
```

### Partial Street Name
```bash
curl -X POST http://localhost:3000/api/lamps/search \
  -H "Content-Type: application/json" \
  -d '{"street": "Mlynské"}'
```

## Field Discovery Strategy

The service automatically discovers field names from the ArcGIS layer metadata:

1. **Street Fields**: Detected by patterns like "ulica", "street", "nazov_ulice", "cesta", "name"
2. **Lamp ID Fields**: Detected by patterns like "lamp", "stlp", "cislo", "number", "svetlo"

The discovery runs at startup and is cached for 10 minutes. Fields are matched by both field name and alias.

## Query Strategy

### Attribute Query (Primary)
1. Builds case-insensitive WHERE clause using `UPPER(field) LIKE UPPER('%value%')`
2. Tries each discovered street field until matches are found
3. Falls back to combining fields with OR if individual queries fail
4. Automatically tries de-accented variant if no results with original

### Spatial Query (When coordinates provided)
1. Creates a buffer polygon around the provided point (default 150m)
2. Performs spatial intersection query
3. Combines with street attribute filter

## Example ArcGIS Query URLs

### Attribute Query
```
https://tsb.bratislava.sk/gismap/rest/services/svetelne_miesta/sm_dataset_obcan/FeatureServer/0/query?
  f=json&
  where=UPPER(ulica) LIKE UPPER('%Ružinovská%')&
  outFields=*&
  returnGeometry=true
```

### Spatial Query with Buffer
```
https://tsb.bratislava.sk/gismap/rest/services/svetelne_miesta/sm_dataset_obcan/FeatureServer/0/query?
  f=json&
  geometry={"rings":[[...]],"spatialReference":{"wkid":4326}}&
  geometryType=esriGeometryPolygon&
  spatialRel=esriSpatialRelIntersects&
  where=UPPER(ulica) LIKE UPPER('%Ružinovská%')&
  outFields=*&
  returnGeometry=true
```

## Error Handling

- **400 Bad Request**: Invalid input parameters
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server or ArcGIS query failure

All errors return JSON with structure:
```json
{
  "success": false,
  "error": "Error description"
}
```

## Performance Optimizations

- **Field Discovery Cache**: 10-minute TTL for metadata
- **Query Result Cache**: 5-minute TTL for street searches
- **Connection Pooling**: Reuses HTTP connections
- **Retry Logic**: 2 retries with exponential backoff
- **Pagination**: Handles large result sets automatically

## Security Features

- **Rate Limiting**: Configurable requests per minute
- **CORS**: Configured for cross-origin requests
- **Helmet**: Security headers enabled
- **Input Validation**: Strict parameter validation
- **SQL Injection Prevention**: Parameterized queries

## Logging

- **Info Level**: Request summaries and result counts
- **Debug Level**: Detailed query information (set `LOG_LEVEL=debug`)
- **Error Level**: Failures and exceptions

## Integration with ElevenLabs

This API is designed for integration with ElevenLabs voice workflows:

1. Voice input provides street name
2. API returns structured JSON suitable for voice response
3. Stable field names enable reliable parsing
4. Summary field provides human-readable response

## License

ISC