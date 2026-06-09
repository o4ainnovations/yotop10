import mongoose from 'mongoose';
import { SecretsManager } from '../secrets';

interface MongoConfig {
  maxPoolSize: number;
  minPoolSize: number;
  serverSelectionTimeoutMS: number;
  heartbeatFrequencyMS: number;
  retryWrites: boolean;
  retryReads: boolean;
  w: 'majority';
  readConcern: { level: 'majority' };
  writeConcern: { w: 'majority'; j: boolean };
  appName: string;
}

const DEFAULT_CONFIG: MongoConfig = {
  maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '50', 10),
  minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '5', 10),
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  retryReads: true,
  w: 'majority',
  readConcern: { level: 'majority' },
  writeConcern: { w: 'majority', j: false },
  appName: 'yotop10-backend',
};

let connectionPromise: Promise<typeof mongoose> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

async function resolveMongoUri(): Promise<string> {
  const username = await SecretsManager.getSecret('MONGO_USERNAME');
  const password = await SecretsManager.getSecret('MONGO_PASSWORD');

  const host = process.env.MONGO_HOST || 'mongodb';
  const port = process.env.MONGO_PORT || '27017';
  const database = process.env.MONGO_DATABASE || 'yotop10';

  const encodedUser = encodeURIComponent(username);
  const encodedPass = encodeURIComponent(password);

  return `mongodb://${encodedUser}:${encodedPass}@${host}:${port}/${database}?authSource=admin&retryWrites=true&w=majority`;
}

function createConnectionHandlers(): void {
  mongoose.connection.on('connected', () => {
    console.log('[MongoConnector] Connected');
    reconnectAttempts = 0;
  });

  mongoose.connection.on('error', (err) => {
    console.error('[MongoConnector] Connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoConnector] Disconnected. Scheduling reconnect...');
    scheduleReconnect();
  });
}

function scheduleReconnect(): void {
  if (connectionPromise) return;

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('[MongoConnector] Max reconnection attempts reached. Exiting.');
    process.exit(1);
  }

  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  reconnectAttempts++;

  console.log(`[MongoConnector] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

  setTimeout(() => {
    connectionPromise = null;
    connect().catch((err) => {
      console.error('[MongoConnector] Reconnection failed:', err.message);
    });
  }, delay);
}

export async function connect(): Promise<typeof mongoose> {
  if (connectionPromise) return connectionPromise;

  createConnectionHandlers();

  connectionPromise = (async () => {
    const uri = await resolveMongoUri();

    const maskedUri = uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`[MongoConnector] Connecting to ${maskedUri}`);

    try {
      await mongoose.connect(uri, {
        ...DEFAULT_CONFIG,
        serverSelectionTimeoutMS: 10000,
      });
      console.log('[MongoConnector] Connected successfully');
      return mongoose;
    } catch (err) {
      connectionPromise = null;
      const error = err as Error;
      console.error('[MongoConnector] Initial connection failed:', error.message);
      console.error('[MongoConnector] Ensure MongoDB is running and credentials are correct.');
      throw error;
    }
  })();

  return connectionPromise;
}

export async function healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const db = mongoose.connection.db;
    if (!db) return { ok: false, latencyMs: Date.now() - start };
    await db.admin().ping();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

export async function gracefulShutdown(): Promise<void> {
  console.log('[MongoConnector] Disconnecting...');
  try {
    await mongoose.connection.close();
    console.log('[MongoConnector] Disconnected');
  } catch (err) {
    console.error('[MongoConnector] Error during disconnect:', err);
  }
}
