import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { validateEnv } from './lib/env';
import { redis } from './lib/redis';
import { es } from './lib/elasticsearch';
import { routes } from './routes';

dotenv.config();

validateEnv();

const app: Application = express();
const PORT = process.env.PORT || 8000;

app.use(helmet());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3100', 'http://127.0.0.1:3100'],
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import { fingerprintMiddleware } from './middleware/fingerprint';

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Analytics visit beacon (no fingerprint required)
import analyticsRouter from './routes/analytics';
app.use('/api/analytics', analyticsRouter);

const FINGERPRINT_EXEMPT = new Set(['/api/admin', '/api/analytics']);

for (const route of routes) {
  const middleware = FINGERPRINT_EXEMPT.has(route.path) ? [route.router] : [fingerprintMiddleware, route.router];
  app.use(route.path, ...middleware);
  console.log(`Mounted route: ${route.path}`);
}

console.log('\nAll routes mounted successfully\n');

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const connectDatabases = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yotop10';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  redis.on('error', (err: Error) => console.error('Redis client error:', err.message));
  await redis.connect();
  console.log('Connected to Redis');

  const maxRetries = 10;
  const retryDelay = 3000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await es.ping();
      console.log('Connected to Elasticsearch');
      break;
    } catch (_error) {
      if (attempt === maxRetries) {
        throw new Error(`Failed to connect to Elasticsearch after ${maxRetries} attempts`);
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
    startSparkScoreCron();
    startThresholdCron();

    const { startPostCountCron } = await import('./lib/postCountReconciler');
    startPostCountCron();

    const { startSnapshotCron } = await import('./lib/platformSnapshot');
    startSnapshotCron();

    const { startFlagCron } = await import('./lib/flagEngine');
    startFlagCron();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  const { stopSparkScoreCron } = await import('./routes/comments');
  stopSparkScoreCron();
  const { stopPostCountCron } = await import('./lib/postCountReconciler');
  stopPostCountCron();
  const { stopSnapshotCron } = await import('./lib/platformSnapshot');
  stopSnapshotCron();
  await redis.quit();
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  const { stopSparkScoreCron } = await import('./routes/comments');
  stopSparkScoreCron();
  const { stopPostCountCron } = await import('./lib/postCountReconciler');
  stopPostCountCron();
  const { stopSnapshotCron } = await import('./lib/platformSnapshot');
  stopSnapshotCron();
  await redis.quit();
  await mongoose.connection.close();
  process.exit(0);
});

export default app;
