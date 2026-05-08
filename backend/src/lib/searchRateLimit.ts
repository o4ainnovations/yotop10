import { RequestHandler } from 'express';
import { atomicCheckRateLimit } from './redis';
import { getClientIp } from '../middleware/fingerprint';

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  keyPrefix: string;
}

const SEARCH_CONFIG: RateLimitConfig = {
  maxRequests: 30,
  windowSeconds: 60,
  keyPrefix: 'search_rate:',
};

const AUTOCOMPLETE_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowSeconds: 60,
  keyPrefix: 'autocomplete_rate:',
};

function createRateLimitMiddleware(config: RateLimitConfig): RequestHandler {
  return async (req, res, next) => {
    const ip = getClientIp(req);
    const key = `${config.keyPrefix}${ip}`;
    const windowMs = config.windowSeconds * 1000;

    try {
      const { allowed, remaining } = await atomicCheckRateLimit(key, windowMs, config.maxRequests);

      res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + windowMs) / 1000).toString());

      if (!allowed) {
        res.setHeader('Retry-After', config.windowSeconds.toString());
        res.status(429).json({
          code: 'RATE_LIMITED',
          error: `Too many requests. Try again in ${config.windowSeconds} seconds.`,
        });
        return;
      }

      next();
    } catch (err) {
      next();
    }
  };
}

export const searchRateLimit = createRateLimitMiddleware(SEARCH_CONFIG);
export const autocompleteRateLimit = createRateLimitMiddleware(AUTOCOMPLETE_CONFIG);
