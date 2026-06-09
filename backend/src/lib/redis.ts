import { createClient, RedisClientType } from 'redis';
import { SecretsManager } from './secrets';

const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_DB = parseInt(process.env.REDIS_DB || '0', 10);

let connected = false;

export const redis: RedisClientType = createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    reconnectStrategy: (retries) => {
      if (retries > 20) {
        console.error('[Redis] Max reconnection attempts reached');
        return new Error('Max reconnection attempts');
      }
      return Math.min(retries * 100, 5000);
    },
  },
  database: REDIS_DB,
});

redis.on('error', (err: Error) => {
  console.error('[Redis] Client error:', err.message);
});

redis.on('reconnecting', () => {
  console.warn('[Redis] Reconnecting...');
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
  connected = true;
});

redis.on('end', () => {
  console.log('[Redis] Connection closed');
  connected = false;
});

export async function connectRedis(): Promise<void> {
  if (connected) return;

  try {
    const password = await SecretsManager.getSecretWithFallback('REDIS_PASSWORD', '');
    await redis.connect();
    if (password) {
      await redis.auth({ password });
      console.log('[Redis] Authentication configured');
    }
  } catch (err) {
    const error = err as Error;
    console.error('[Redis] Connection failed:', error.message);
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (connected) {
    try {
      await redis.quit();
      console.log('[Redis] Disconnected');
    } catch (err) {
      console.error('[Redis] Error during disconnect:', err);
    }
  }
}

/**
 * Atomic rate limit check+increment using sorted-set sliding window.
 * Returns [allowed: 1|0, remaining: number]
 */
export const RATE_LIMIT_LUA = `
  redis.call('ZREMRANGEBYSCORE', KEYS[1], '0', ARGV[1])
  local count = redis.call('ZCARD', KEYS[1])
  local max = tonumber(ARGV[2])
  if count < max then
    redis.call('ZADD', KEYS[1], ARGV[3], ARGV[3])
    redis.call('EXPIRE', KEYS[1], ARGV[4])
    return {1, max - count - 1}
  else
    return {0, 0}
  end
`;

export const atomicCheckRateLimit = async (
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<{ allowed: boolean; remaining: number }> => {
  const now = Date.now();
  const windowStart = now - windowMs;

  const result = await redis.eval(RATE_LIMIT_LUA, {
    keys: [key],
    arguments: [
      windowStart.toString(),
      maxRequests.toString(),
      now.toString(),
      Math.ceil(windowMs / 1000).toString(),
    ],
  });

  const values = result as unknown as [number, number];
  if (!Array.isArray(values) || values.length !== 2 || typeof values[0] !== 'number') {
    throw new Error('Unexpected Redis response format');
  }

  return {
    allowed: values[0] === 1,
    remaining: values[1],
  };
};
