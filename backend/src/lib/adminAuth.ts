import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AdminUser } from '../models/AdminUser';
import { getEnv } from './env';

function getJwtSecret(): string {
  try {
    return getEnv().JWT_SECRET;
  } catch {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('FATAL: JWT_SECRET environment variable is required but not set.');
    return secret;
  }
}

const JWT_EXPIRY = '24h';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export interface AdminAuthRequest extends Request {
  admin?: {
    id: string;
    username: string;
    token_version: number;
  };
}

export const generateAdminToken = (adminId: string, username: string, tokenVersion: number): string => {
  return jwt.sign(
    { id: adminId, username, token_version: tokenVersion },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRY }
  );
};

export const adminAuthMiddleware = async (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.admin_token;

  if (!token) {
    return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      username: string;
      token_version: number;
    };

    const admin = await AdminUser.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Admin account not found' });
    }

    if (decoded.token_version !== admin.token_version) {
      return res.status(401).json({ code: 'TOKEN_EXPIRED', error: 'Session expired. Please login again.' });
    }

    req.admin = {
      id: (admin._id as { toString(): string }).toString(),
      username: admin.username,
      token_version: admin.token_version,
    };

    const REFRESH_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
    const expiresAt = (decoded.exp ?? 0) * 1000;
    if (Date.now() > expiresAt - REFRESH_THRESHOLD_MS) {
      const newToken = generateAdminToken(req.admin.id, req.admin.username, admin.token_version);
      res.cookie('admin_token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
      });
    }

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ code: 'TOKEN_EXPIRED', error: 'Session expired. Please login again.' });
    }
    return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Invalid authentication' });
  }
};

export const checkAccountLock = async (admin: { _id: unknown; locked_until: Date | null }): Promise<boolean> => {
  if (!admin.locked_until) return false;
  if (new Date() < admin.locked_until) return true;
  await AdminUser.findByIdAndUpdate(admin._id, {
    locked_until: null,
    failed_login_attempts: 0,
  });
  return false;
};

export const recordFailedLogin = async (admin: { _id: unknown; failed_login_attempts: number }): Promise<void> => {
  const newAttempts = admin.failed_login_attempts + 1;
  const update: Record<string, unknown> = { failed_login_attempts: newAttempts };

  if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
    update.locked_until = new Date(Date.now() + LOCK_DURATION_MS);
  }

  await AdminUser.findByIdAndUpdate(admin._id, update);
};

export const resetLoginAttempts = async (adminId: unknown): Promise<void> => {
  await AdminUser.findByIdAndUpdate(adminId, {
    failed_login_attempts: 0,
    locked_until: null,
  });
};

export const generateSetupToken = (): { token: string; expiresAt: Date } => {
  const token = crypto.randomBytes(8).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  return { token, expiresAt };
};
