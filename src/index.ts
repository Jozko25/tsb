import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config/config';
import { createApiRouter } from './routes/api';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { httpLogger, logger } from './utils/logger';
import { FieldDiscoveryService } from './services/fieldDiscovery';

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());

app.use(express.json({
  limit: '10mb',
  strict: true,
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
}));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

app.use(httpLogger);

app.use('/api', createApiRouter());

app.get('/', (_req, res) => {
  res.json({
    service: 'TSB Street Lamp Search API',
    version: '1.0.0',
    endpoints: {
      search: 'POST /api/lamps/search',
      health: 'GET /api/health',
    },
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    const fieldDiscovery = new FieldDiscoveryService();
    await fieldDiscovery.discoverFields(true);
    logger.info('Initial field discovery completed');
    
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info('Configuration:', {
        arcgisUrl: config.arcgis.featureUrl,
        bufferMeters: config.search.bufferMeters,
        cacheTtl: config.cache.ttlSeconds,
        rateLimit: config.rateLimit.max,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;