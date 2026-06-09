import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Request, RequestHandler } from 'express';
import { AdminUser } from '../models/AdminUser';
import { SecretsManager } from './secrets';

let jwtSecretPromise: Promise<string> | null = null;

async function getJwtSecret(): Promise<string> {
  if (!jwtSecretPromise) {
    jwtSecretPromise = SecretsManager.getSecret('JWT_SECRET');
  }
  return jwtSecretPromise;
}

const SUPER_ADMIN_EXPIRY = '24h';
const MOD_EXPIRY = '4h';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export interface AdminAuthRequest extends Request {
  admin?: {
    id: string;
    username: string;
    role: 'super_admin' | 'mod';
    permissions: string[];
    permissions_version: number;
    token_version: number;
  };
}

export const generateAdminToken = async (
  adminId: string,
  username: string,
  tokenVersion: number,
  role: 'super_admin' | 'mod',
  permissions: string[],
  permissionsVersion: number
): Promise<string> => {
  const expiresIn = role === 'super_admin' ? SUPER_ADMIN_EXPIRY : MOD_EXPIRY;
  const secret = await getJwtSecret();
  return jwt.sign(
    {
      id: adminId,
      username,
      role,
      permissions,
      permissions_version: permissionsVersion,
      token_version: tokenVersion,
    },
    secret,
    { expiresIn }
  );
};

export const adminAuthMiddleware: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.admin_token;

  if (!token) {
    return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Authentication required' });
  }

  try {
    const secret = await getJwtSecret();
    const decoded = jwt.verify(token, secret) as {
      id: string;
      username: string;
      role: 'super_admin' | 'mod';
      permissions: string[];
      permissions_version: number;
      token_version: number;
      exp?: number;
    };

    const admin = await AdminUser.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Admin account not found' });
    }

    if (admin.is_active === false) {
      return res.status(401).json({ code: 'ACCOUNT_DISABLED', error: 'Account has been disabled' });
    }

    if (decoded.token_version !== admin.token_version) {
      return res.status(401).json({ code: 'TOKEN_EXPIRED', error: 'Session expired. Please login again.' });
    }

    // Check if permissions have changed since token was issued
    const adminRole = admin.role || 'mod';
    const needsRefresh =
      decoded.permissions_version !== (admin.permissions_version || 1) ||
      (decoded.exp && Date.now() > (decoded.exp * 1000) - (adminRole === 'super_admin' ? 60 * 60 * 1000 : 30 * 60 * 1000));

    if (needsRefresh) {
      const newToken = await generateAdminToken(
        (admin._id as { toString(): string }).toString(),
        admin.username,
        admin.token_version,
        admin.role || 'mod',
        admin.permissions || [],
        admin.permissions_version || 1
      );
      const maxAgeMs = (adminRole === 'super_admin' ? 24 : 4) * 60 * 60 * 1000;
      res.cookie('admin_token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: maxAgeMs,
      });
    }

    req.admin = {
      id: (admin._id as { toString(): string }).toString(),
      username: admin.username,
      role: admin.role || 'mod',
      permissions: admin.permissions || [],
      permissions_version: admin.permissions_version || 1,
      token_version: admin.token_version,
    };

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

// Migration: upgrade existing admin users that lack the new fields
export async function runAdminMigration(): Promise<void> {
  const result = await AdminUser.updateMany(
    { role: { $exists: false } },
    {
      role: 'super_admin',
      permissions: [],
      permissions_version: 1,
      is_active: true,
      created_by: 'system',
    }
  );
  if (result.modifiedCount > 0) {
    console.log('[Mod System] Migrated ' + result.modifiedCount + ' existing admin(s) to super_admin role');
  }
}
