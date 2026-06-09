/* eslint-disable no-restricted-syntax, no-restricted-imports, @typescript-eslint/no-explicit-any -- server route mounting + Express middleware chains */
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { validateEnv } from './lib/env';
import { SecretsManager } from './lib/secrets';
import { sanitizeQueryParams } from './middleware/sanitizeQuery';
import { connectRedis, disconnectRedis } from './lib/redis';
import { es } from './lib/elasticsearch';
import { routes } from './routes';
import path from 'path';

dotenv.config();

validateEnv();

// Initialize required secrets — crashes at startup if any are missing
SecretsManager.initialize(['JWT_SECRET']).catch((err) => {
  console.error('[Server] FATAL: Secrets initialization failed:', err.message);
  process.exit(1);
});

// MongoDB credentials: try Docker secrets first, then env vars
SecretsManager.getSecretWithFallback('MONGO_USERNAME', 'yotop10_admin');
SecretsManager.getSecretWithFallback('MONGO_PASSWORD', '').catch((err) => {
  console.error('[Server] FATAL: Secrets initialization failed:', err.message);
  process.exit(1);
});

const app: Application = express();
const PORT = process.env.PORT || 8000;

// Trust nginx proxy headers for correct client IP, protocol, and host
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

app.use(sanitizeQueryParams as express.RequestHandler);

/* Helmet security headers */
app.use(helmet());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3100', 'http://127.0.0.1:3100'],
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

import { fingerprintMiddleware } from './middleware/fingerprint';
import fingerprintMergeRouter from './routes/fingerprintMerge';

import { healthRegistry } from './lib/healthCheck';
import { cronRegistry } from './lib/cronRegistry';

app.use('/api/fingerprint', fingerprintMergeRouter);

app.get('/api/health', async (_req, res) => {
  try {
    const report = await healthRegistry.generateReport();
    res.json({
      status: report.status === 'ok' ? 'ok' : report.status,
      timestamp: report.timestamp,
      uptime: report.uptime,
      memory: report.memory,
      components: report.components,
    });
  } catch {
    res.status(503).json({ status: 'error', timestamp: new Date().toISOString() });
  }
});

import searchRouter from './routes/search';
app.use('/api/search', searchRouter);

// Analytics visit beacon (no fingerprint required)
import analyticsRouter from './routes/analytics';
app.use('/api/analytics', analyticsRouter);

const FINGERPRINT_EXEMPT = new Set(['/api/admin', '/api/analytics']);

for (const route of routes) {
  const middleware = FINGERPRINT_EXEMPT.has(route.path) ? [route.router] : [fingerprintMiddleware, route.router];
  (app.use as any)(route.path, ...middleware);
  console.log(`Mounted route: ${route.path}`);
}

console.log('\nAll routes mounted successfully\n');

app.use((err: Error, _req: any, res: any, _next: any) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const connectDatabases = async () => {
  const mongoConnector = await import('./lib/database/mongoConnector');
  await mongoConnector.connect();

  await connectRedis();

  const maxRetries = 10;
  const retryDelay = 3000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await es.ping();
      console.log('Connected to Elasticsearch');
      const { ensureIndices } = await import('./elasticsearch/lib/indexer');
      await ensureIndices();
      break;
    } catch (_error) {
      if (attempt === maxRetries) {
        console.error(`[Server] Failed to connect to Elasticsearch after ${maxRetries} attempts`);
        throw new Error(`ES connection failed after ${maxRetries} attempts`);
      }
      console.log(`Elasticsearch connection attempt ${attempt}/${maxRetries} failed, retrying in ${retryDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
};

const startServer = async () => {
  try {
    await connectDatabases();

    const { startSparkScoreCron, startThresholdCron } = await import('./routes/comments');
    const { startPostCountCron } = await import('./lib/postCountReconciler');
    const { startSnapshotCron } = await import('./lib/platformSnapshot');
    const { startFlagCron } = await import('./lib/flagEngine');
    const { startAutoHeal } = await import('./elasticsearch/lib/searchAutoHeal');
    const { startAlertEngine } = await import('./lib/alertEngine');
    const { startSearchAnalyticsCron } = await import('./lib/searchAnalyticsCron');
    const { startArgumentCron } = await import('./lib/argumentCron');
    const { initConfig, startConfigCron } = await import('./lib/systemConfig');
    const { seedPresets } = await import('./lib/seedPresets');

    const asyncWrap = (fn: () => void) => async () => { fn(); };

    cronRegistry.register({
      name: 'spark-score',
      interval: 20 * 60 * 1000,
      handler: asyncWrap(startSparkScoreCron),
    });

    cronRegistry.register({
      name: 'spark-threshold',
      interval: 6 * 60 * 60 * 1000,
      handler: asyncWrap(startThresholdCron),
    });

    cronRegistry.register({
      name: 'post-count-reconciler',
      interval: 5 * 60 * 1000,
      handler: asyncWrap(startPostCountCron),
    });

    cronRegistry.register({
      name: 'platform-snapshot',
      interval: 60 * 60 * 1000,
      handler: asyncWrap(startSnapshotCron),
    });

    cronRegistry.register({
      name: 'flag-engine',
      interval: 60 * 1000,
      handler: asyncWrap(startFlagCron),
    });

    cronRegistry.register({
      name: 'search-auto-heal',
      interval: 5 * 60 * 1000,
      handler: asyncWrap(startAutoHeal),
    });

    cronRegistry.register({
      name: 'alert-engine',
      interval: 60 * 1000,
      handler: asyncWrap(startAlertEngine),
      fatal: true,
    });

    cronRegistry.register({
      name: 'search-analytics',
      interval: 60 * 60 * 1000,
      handler: asyncWrap(startSearchAnalyticsCron),
    });

    cronRegistry.register({
      name: 'argument-cron',
      interval: 60 * 60 * 1000,
      handler: asyncWrap(startArgumentCron),
    });

    cronRegistry.register({
      name: 'config-refresh',
      interval: 60 * 1000,
      handler: asyncWrap(startConfigCron),
    });

    await initConfig();
    await seedPresets();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

async function shutdown(signal: string): Promise<void> {
  console.log(`[Server] ${signal} received. Draining connections...`);
  try {
    await cronRegistry.gracefulShutdown();
    const { gracefulShutdown } = await import('./lib/database/mongoConnector');
    await gracefulShutdown();
    await disconnectRedis();
  } catch (err) {
    console.error('[Server] Shutdown error:', err);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
