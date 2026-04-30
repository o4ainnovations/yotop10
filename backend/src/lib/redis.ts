import { createClient, RedisClientType } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis: RedisClientType = createClient({ url: redisUrl });

redis.on('error', (err: Error) => {
  console.error('Redis client error:', err.message);
});

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
