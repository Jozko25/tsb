import { Request, Response, NextFunction } from 'express';

export function validateReportRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { street, locationDescription, issueDescription } = req.body;
  
  if (!street || typeof street !== 'string' || street.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: 'Názov ulice je povinný a musí byť neprázdny text',
    });
    return;
  }
  
  if (!locationDescription || typeof locationDescription !== 'string' || locationDescription.trim().length < 3) {
    res.status(400).json({
      success: false,
      error: 'Popis polohy je povinný a musí mať aspoň 3 znaky',
    });
    return;
  }
  
  if (!issueDescription || typeof issueDescription !== 'string' || issueDescription.trim().length < 3) {
    res.status(400).json({
      success: false,
      error: 'Popis problému je povinný a musí mať aspoň 3 znaky',
    });
    return;
  }

  
  next();
}