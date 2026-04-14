import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import crypto from 'crypto';

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
  }
}

export const fingerprintMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
  
  // ✅ ALL ENDPOINTS ARE PUBLIC - NEVER REJECT ANY REQUEST
  // This middleware only attaches user context when fingerprint is available
  // It will never block, reject, or return an error for ANY request
  
  console.log(`[FINGERPRINT] ${req.method} ${req.path} - Fingerprint: ${deviceFingerprint ? 'PRESENT' : 'NOT PRESENT'}`);
  
  if (!deviceFingerprint) {
    console.log(`[FINGERPRINT] ${req.method} ${req.path} - Continuing anonymously`);
    return next();
  }

  try {
    // Find existing user by fingerprint
    let user = await User.findOne({ device_fingerprint: deviceFingerprint });
    
    // Create new user if not exists
    if (!user) {
      // Generate user ID (8 random hex chars)
      const userId = crypto.randomBytes(4).toString('hex');
      
      // Generate a_XXXX username (last 4 chars of user ID)
      const username = `a_${userId.slice(-4)}`;
      
      user = await User.create({
        user_id: userId,
        username,
        device_fingerprint: deviceFingerprint,
        trust_score: 1.0,
        is_admin: false,
      });
      
      console.log(`[Fingerprint] Created new user: ${username} for fingerprint ${deviceFingerprint.slice(0, 8)}...`);
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
    
    next();
  } catch (error) {
    console.error('[Fingerprint] Middleware error:', error);
    res.status(500).json({ error: 'Failed to process user identity' });
  }
};
