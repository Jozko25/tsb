import morgan from 'morgan';
import { Request } from 'express';

export const httpLogger = morgan('combined');

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

const currentLogLevel = process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : LogLevel.INFO;

export const logger = {
  error: (message: string, error?: any) => {
    if (currentLogLevel >= LogLevel.ERROR) {
      console.error(`[ERROR] ${new Date().toISOString()} ${message}`, error || '');
    }
  },
  
  warn: (message: string, data?: any) => {
    if (currentLogLevel >= LogLevel.WARN) {
      console.warn(`[WARN] ${new Date().toISOString()} ${message}`, data || '');
    }
  },
  
  info: (message: string, data?: any) => {
    if (currentLogLevel >= LogLevel.INFO) {
      console.log(`[INFO] ${new Date().toISOString()} ${message}`, data || '');
    }
  },
  
  debug: (message: string, data?: any) => {
    if (currentLogLevel >= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${new Date().toISOString()} ${message}`, data || '');
    }
  },
  
  logRequest: (req: Request, streetCount?: number) => {
    const logData = {
      method: req.method,
      path: req.path,
      body: req.body,
      ip: req.ip,
      ...(streetCount !== undefined && { resultCount: streetCount })
    };
    logger.info('Request processed', logData);
  }
};