import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { UserDevice } from '../models/UserDevice';
import crypto from 'crypto';
import { redis } from '../lib/redis';
import { findMatchingUser } from '../lib/fingerprintMatching';

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
const MAX_GRACE_REQUESTS = 10;

export const getClientIp = (req: { headers: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } }): string => {
  // req.ip is trusted when Express 'trust proxy' is enabled (set in server.ts)
  if (req.ip && req.ip !== '::1' && req.ip !== '127.0.0.1') return req.ip;
  // Fallback for direct connections or when trust proxy is disabled
  const xForwardedFor = req.headers['x-forwarded-for'] as string;
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
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
    try { const t0 = req.headers['x-tier0'] as string; if (t0) tier0 = JSON.parse(t0); } catch { /* bad header — ignore */ }

    try {
      let user = await User.findOne({ device_fingerprint: fingerprint });

      if (!user) {
        const deviceLink = await UserDevice.findOne({ device_fingerprint: fingerprint });
        if (deviceLink) {
          user = await User.findOne({ user_id: deviceLink.user_id });
        }
      }

      if (!user) {
        const userId = crypto.randomBytes(4).toString('hex');
        const username = `a_${userId.slice(-4)}`;

        let matchedUserId: string | null = null;
        if (Object.keys(tier0).length > 0) {
          matchedUserId = await findMatchingUser(tier0, {}, {});
        }

        if (matchedUserId) {
          // Cross-browser match — don't auto-link. Create a merge token instead.
          // The user must confirm the merge on the new device.
          const mergeToken = crypto.randomBytes(16).toString('hex');
          const mergeRequest = {
            from_fingerprint: fingerprint,
            to_user_id: matchedUserId,
            created_at: Date.now(),
            confirmed: false,
          };
          await redis.setEx(
            `fingerprint:merge:${mergeToken}`,
            900, // 15 minutes
            JSON.stringify(mergeRequest)
          );
          res.setHeader('x-merge-token', mergeToken);

          // Log the pending merge
          console.log(`[Fingerprint] Cross-browser merge pending for user ${matchedUserId}. Token: ${mergeToken.substring(0, 8)}...`);
        }

        // Create new user regardless of match (no auto-link)
        user = await User.create({ user_id: userId, username, device_fingerprint: fingerprint, trust_score: 1.0, is_admin: false });
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
      const userId = crypto.randomBytes(4).toString('hex');
      const username = `a_${userId.slice(-4)}`;

      // Pre-create the user record so subsequent requests find it
      try {
        await User.create({ user_id: userId, username, device_fingerprint: newFingerprint, trust_score: 1.0, is_admin: false });
      } catch (createErr) {
        console.error('[Fingerprint] Failed to pre-create user during grace period:', (createErr as Error).message);
      }

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
    console.error('[Fingerprint] Grace period Redis error, failing closed:', error);
    return res.status(503).json({ error: 'Identity service temporarily unavailable' });
  }
};
