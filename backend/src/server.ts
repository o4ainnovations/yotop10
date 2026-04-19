import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(helmet());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3100', 'http://127.0.0.1:3100'],
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fingerprint middleware - runs on all API routes
import { fingerprintMiddleware } from './middleware/fingerprint';
app.use('/api', fingerprintMiddleware);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/*****************************************************************************
 * IF YOU ARE HERE AT 3AM DEBUGGING A ROUTE THAT WONT LOAD:
 *
 * ADD YOUR NEW ROUTE TO THE ROUTE_ORDER ARRAY BELOW.
 *
 * THIS IS THE ONLY PLACE YOU EVER NEED TO DO THIS.
 *
 * IF YOU DO NOT ADD IT HERE IT WILL NOT BE MOUNTED.
 *
 ****************************************************************************/

import fs from 'fs';
import path from 'path';
import { adminAuthMiddleware } from './lib/adminAuth';

// EXPLICIT MOUNT ORDER. NEW ROUTES ARE ADDED HERE.
// This is the ONLY manual step ever required.
const ROUTE_ORDER = [
  'auth',
  'categories',
  'comments',
  'listings',
  'posts',
  'reactions',
  'reviews',
  'search',
  'users',
  'admin', // Admin always mounted last
];

const VALID_ROUTE_FILENAME = /^[a-z_]+\.ts$/;

// Validate all declared routes exist on filesystem (works for both .ts and .js)
const routesDir = path.join(__dirname, 'routes');
for (const routeName of ROUTE_ORDER) {
  if (!fs.existsSync(path.join(routesDir, `${routeName}.ts`)) && !fs.existsSync(path.join(routesDir, `${routeName}.js`))) {
    throw new Error(`Route declared but not found: ${routeName}`);
  }
}

// Validate no extra routes exist in filesystem that are not mounted
const files = fs.readdirSync(routesDir);
for (const file of files) {
  if (!VALID_ROUTE_FILENAME.test(file)) continue;
  const routeName = path.basename(file, '.ts');
  if (!ROUTE_ORDER.includes(routeName)) {
    throw new Error(`Route file exists but not declared: ${file}`);
  }
}

// Mount routes in explicit order
for (const routeName of ROUTE_ORDER) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const router = require(`./routes/${routeName}`).default;
  
  if (routeName === 'admin') {
    app.use(`/api/${routeName}`, adminAuthMiddleware, router);
  } else {
    app.use(`/api/${routeName}`, router);
  }
  
  console.log(`✅ Mounted route: /api/${routeName}`);
}

console.log('\n🚀 All routes mounted successfully\n');

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Database connections
const connectDatabases = async () => {
  // MongoDB connection
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yotop10';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  // Redis connection
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redisClient = createClient({ url: redisUrl });
  redisClient.on('error', (err) => console.error('❌ Redis Client Error:', err));
  await redisClient.connect();
  console.log('✅ Connected to Redis');

  // Elasticsearch connection with retry logic
  const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
  const esClient = new ElasticsearchClient({ node: esUrl });
  const maxRetries = 10;
  const retryDelay = 3000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await esClient.ping();
      console.log('✅ Connected to Elasticsearch');
      break;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`Failed to connect to Elasticsearch after ${maxRetries} attempts`);
      }
      console.log(`⚠️ Elasticsearch connection attempt ${attempt}/${maxRetries} failed, retrying in ${retryDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
};

// Start server
const startServer = async () => {
  try {
    await connectDatabases();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
