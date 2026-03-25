import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
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
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes (to be implemented)
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import listingsRoutes from './routes/listings';
import categoriesRoutes from './routes/categories';
import searchRoutes from './routes/search';
import reviewsRoutes from './routes/reviews';

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/reviews', reviewsRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Database connections
const connectDatabases = async () => {
  try {
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

    // Elasticsearch connection
    const esClient = new ElasticsearchClient({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    });
    await esClient.ping();
    console.log('✅ Connected to Elasticsearch');
  } catch (error) {
    console.error('❌ Database connection error:', error);
  }
};

// Start server
const startServer = async () => {
  await connectDatabases();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

startServer();

export default app;
