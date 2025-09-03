import { Request, Response, NextFunction } from 'express';
import { LampSearchRequest } from '../types';

export function validateLampSearchRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body as Partial<LampSearchRequest>;
  
  if (!body.street || typeof body.street !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Street is required and must be a non-empty string',
    });
    return;
  }
  
  const trimmedStreet = body.street.trim();
  if (trimmedStreet.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Street cannot be empty or contain only whitespace',
    });
    return;
  }
  
  if (body.lat !== undefined) {
    const lat = Number(body.lat);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      res.status(400).json({
        success: false,
        error: 'Latitude must be a valid number between -90 and 90',
      });
      return;
    }
  }
  
  if (body.lng !== undefined) {
    const lng = Number(body.lng);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      res.status(400).json({
        success: false,
        error: 'Longitude must be a valid number between -180 and 180',
      });
      return;
    }
  }
  
  if ((body.lat !== undefined && body.lng === undefined) ||
      (body.lat === undefined && body.lng !== undefined)) {
    res.status(400).json({
      success: false,
      error: 'Both latitude and longitude must be provided together',
    });
    return;
  }
  
  next();
}