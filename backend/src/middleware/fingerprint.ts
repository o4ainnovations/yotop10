import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import crypto from 'crypto';
import { redis } from '../lib/redis';
import { findMatchingUser, storeFingerprintObservation } from '../lib/fingerprintMatching';

declare module 'express' {
  interface Request {
    user?: {
      user_id: string;
      username: string;
      custom_display_name?: string | null;
      device_fingerprint: string;
      trust_score: number;
      trust_locked: boolean;
      rate_limit_override?: {
        posts_per_hour?: number | null;
        comments_per_hour?: number | null;
      };
      is_admin: boolean;
      restricted_until: Date | null;
      created_at?: Date;
    };
    fingerprint?: string;
  }
}

const GRACE_PERIOD_MS = 3500;
const MAX_GRACE_REQUESTS = 3;

export const getClientIp = (req: Request): string => {
  const xForwardedFor = req.headers['x-forwarded-for'] as string;
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    if (ips.length >= 2) return ips[ips.length - 2];
    return ips[0];
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

const generateFingerprint = (): string => crypto.randomBytes(16).toString('hex');

export const fingerprintMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
  const existingCookie = req.cookies?.device_fingerprint;

  if (existingCookie || deviceFingerprint) {
    const fingerprint = existingCookie || deviceFingerprint;
    req.fingerprint = fingerprint;

    // Parse Tier 0 signals from header for cross-browser matching
    let tier0: Record<string, string | number | boolean> = {};
    try { const t0 = req.headers['x-tier0'] as string; if (t0) tier0 = JSON.parse(t0); } catch {}

    try {
      let user = await User.findOne({ device_fingerprint: fingerprint });

      if (!user) {
        const userId = crypto.randomBytes(4).toString('hex');
        const username = `a_${userId.slice(-4)}`;

        let matchedUserId: string | null = null;
        if (Object.keys(tier0).length > 0) {
          matchedUserId = await findMatchingUser(tier0, {}, {});
        }

        if (matchedUserId) {
          user = await User.findOneAndUpdate(
            { user_id: matchedUserId },
            { $set: { device_fingerprint: fingerprint } },
            { new: true }
          );
        }

        if (!user) {
          user = await User.create({ user_id: userId, username, device_fingerprint: fingerprint, trust_score: 1.0, is_admin: false });
        }
      }

      req.user = {
        user_id: user.user_id,
        username: user.username,
        custom_display_name: user.custom_display_name,
        device_fingerprint: user.device_fingerprint,
        trust_score: user.trust_score,
        trust_locked: user.trust_locked,
        rate_limit_override: user.rate_limit_override,
        is_admin: user.is_admin,
        restricted_until: user.restricted_until || null,
        created_at: user.created_at,
      };

      if (!existingCookie && deviceFingerprint) {
        res.cookie('device_fingerprint', deviceFingerprint, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 365 * 24 * 60 * 60 * 1000,
        });
      }

      return next();
    } catch (error) {
      console.error('[Fingerprint] Middleware error:', error);
      return res.status(500).json({ error: 'Failed to process user identity' });
    }
  }

  const clientIp = getClientIp(req);
  const graceKey = `grace:${clientIp}`;

  try {
    const currentCount = await redis.incr(graceKey);

    if (currentCount === 1) {
      await redis.expire(graceKey, Math.ceil(GRACE_PERIOD_MS / 1000));
    }

    if (currentCount <= MAX_GRACE_REQUESTS) {
      const newFingerprint = generateFingerprint();
      res.cookie('device_fingerprint', newFingerprint, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 365 * 24 * 60 * 60 * 1000,
      });
      req.fingerprint = newFingerprint;
      return next();
    }

    return res.status(425).json({
      error: 'Fingerprint not initialized. Please retry.',
      retry_after: 1,
    });
  } catch (error) {
    console.error('[Grace Period] Error:', error);
    const newFingerprint = generateFingerprint();
    req.fingerprint = newFingerprint;
    return next();
  }
};
