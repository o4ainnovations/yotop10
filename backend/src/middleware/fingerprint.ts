import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import crypto from 'crypto';
import { createClient } from 'redis';

// Extend Express Request type
declare module 'express' {
  interface Request {
    user?: {
      user_id: string;
      username: string;
      device_fingerprint: string;
      trust_score: number;
      trust_locked: boolean;
      rate_limit_override?: {
        posts_per_hour?: number | null;
        comments_per_hour?: number | null;
      };
      is_admin: boolean;
    };
    fingerprint?: string;
  }
}

// Grace period configuration - per plans.md specification
const GRACE_PERIOD_MS = 3500;
const MAX_GRACE_REQUESTS = 3;
const GRACE_CLEANUP_INTERVAL = 60000;

const getRedisClient = async () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = createClient({ url: redisUrl });
  await client.connect();
  return client;
};

// Get real client IP correctly through CDNs / proxies
const getClientIp = (req: Request): string => {
  const xForwardedFor = req.headers['x-forwarded-for'] as string;
  if (xForwardedFor) {
    // Industry standard: use second last IP
    // Correctly handles Cloudflare, Fastly, Akamai, all major CDNs
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    if (ips.length >= 2) {
      return ips[ips.length - 2];
    }
    return ips[0];
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

// Generate cryptographically secure fingerprint
const generateFingerprint = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

// Automatic cleanup of expired grace period entries
setInterval(async () => {
  try {
    const redis = await getRedisClient();
    // Redis automatically cleans up expired keys with TTL
    await redis.disconnect();
  } catch (e) {
    // Silently fail - cleanup is best effort
  }
}, GRACE_CLEANUP_INTERVAL);

export const fingerprintMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
  const existingCookie = req.cookies?.device_fingerprint;
  
  // ✅ ALL ENDPOINTS ARE PUBLIC - NEVER REJECT ANY REQUEST
  // This middleware only attaches user context when fingerprint is available
  // It will never block, reject, or return an error for ANY request

  // If existing fingerprint exists - normal flow
  if (existingCookie || deviceFingerprint) {
    const fingerprint = existingCookie || deviceFingerprint;
    req.fingerprint = fingerprint;
    
    try {
      // Find existing user by fingerprint
      let user = await User.findOne({ device_fingerprint: fingerprint });
      
      // Create new user if not exists
      if (!user) {
        // Generate user ID (8 random hex chars)
        const userId = crypto.randomBytes(4).toString('hex');
        
        // Generate a_XXXX username (last 4 chars of user ID)
        const username = `a_${userId.slice(-4)}`;
        
        user = await User.create({
          user_id: userId,
          username,
          device_fingerprint: fingerprint,
          trust_score: 1.0,
          is_admin: false,
        });
        
        console.log(`[Fingerprint] Created new user: ${username} for fingerprint ${fingerprint.slice(0, 8)}...`);
      }
      
      // Attach user to request context
      req.user = {
        user_id: user.user_id,
        username: user.username,
        device_fingerprint: user.device_fingerprint,
        trust_score: (user as any).trust_score,
        trust_locked: (user as any).trust_locked,
        rate_limit_override: (user as any).rate_limit_override,
        is_admin: user.is_admin,
      };
      
      // Ensure cookie is set if it came from header
      if (!existingCookie && deviceFingerprint) {
        res.cookie('device_fingerprint', deviceFingerprint, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        });
      }
      
      return next();
    } catch (error) {
      console.error('[Fingerprint] Middleware error:', error);
      return res.status(500).json({ error: 'Failed to process user identity' });
    }
  }

  // No fingerprint found - enter grace period
  const clientIp = getClientIp(req);
  const now = Date.now();
  const graceKey = `grace:${clientIp}`;

  try {
    const redis = await getRedisClient();
    
    // Atomic check and increment
    const currentCount = await redis.incr(graceKey);
    
    // Set TTL on first request
    if (currentCount === 1) {
      await redis.expire(graceKey, Math.ceil(GRACE_PERIOD_MS / 1000));
    }
    
    await redis.disconnect();

    // Check if within grace period limits
    if (currentCount <= MAX_GRACE_REQUESTS) {
      // Generate fingerprint now for this visitor
      const newFingerprint = generateFingerprint();
      
      // Set cookie on response
      res.cookie('device_fingerprint', newFingerprint, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      });
      
      // Attach fingerprint to request
      req.fingerprint = newFingerprint;
      
      console.log(`[GRACE] Allowed request ${currentCount}/3 for IP ${clientIp}`);
      
      // Continue processing request normally
      return next();
    }

    // Grace period exceeded - return 425 Too Early
    console.log(`[GRACE] Exceeded for IP ${clientIp} - request ${currentCount}`);
    return res.status(425).json({
      error: 'Fingerprint not initialized. Please retry.',
      retry_after: 1,
    });

  } catch (error) {
    console.error('[Grace Period] Error:', error);
    // Fail open - allow request on Redis failure
    const newFingerprint = generateFingerprint();
    req.fingerprint = newFingerprint;
    return next();
  }
};
