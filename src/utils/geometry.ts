export function createBufferPolygon(
  lat: number,
  lng: number,
  bufferMeters: number,
  numPoints: number = 32
): number[][] {
  const earthRadius = 6371000;
  const latRad = lat * Math.PI / 180;
  // const lngRad = lng * Math.PI / 180;
  
  const latOffset = (bufferMeters / earthRadius) * (180 / Math.PI);
  const lngOffset = (bufferMeters / (earthRadius * Math.cos(latRad))) * (180 / Math.PI);
  
  const polygon: number[][] = [];
  
  for (let i = 0; i <= numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    const pointLat = lat + latOffset * Math.sin(angle);
    const pointLng = lng + lngOffset * Math.cos(angle);
    polygon.push([pointLng, pointLat]);
  }
  
  return polygon;
}

export function transformCoordinates(
  geometry: any,
  _sourceSrid?: number
): [number, number] | null {
  if (!geometry) return null;
  
  if (geometry.x !== undefined && geometry.y !== undefined) {
    return [geometry.x, geometry.y];
  }
  
  if (geometry.rings && geometry.rings.length > 0) {
    const ring = geometry.rings[0];
    if (ring.length > 0) {
      const sumX = ring.reduce((sum: number, point: number[]) => sum + point[0], 0);
      const sumY = ring.reduce((sum: number, point: number[]) => sum + point[1], 0);
      return [sumX / ring.length, sumY / ring.length];
    }
  }
  
  return null;
}