import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateAdminToken, checkAccountLock, recordFailedLogin, resetLoginAttempts, generateSetupToken, adminAuthMiddleware } from './adminAuth';
import { AdminUser } from '../models/AdminUser';

const MOCK_SECRET = 'test-secret-that-is-at-least-16-characters-long';

vi.mock('../models/AdminUser', () => ({
  AdminUser: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn().mockResolvedValue(null),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = MOCK_SECRET;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('adminAuth', () => {
  describe('generateAdminToken', () => {
    it('returns a string JWT token', () => {
      const token = generateAdminToken('admin123', 'testadmin', 1);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('contains the expected payload claims', () => {
      const token = generateAdminToken('admin123', 'testadmin', 5);
      const payload = jwt.verify(token, MOCK_SECRET) as { id: string; username: string; token_version: number };
      expect(payload.id).toBe('admin123');
      expect(payload.username).toBe('testadmin');
      expect(payload.token_version).toBe(5);
    });

    it('includes an exp claim with 24h expiry', () => {
      const token = generateAdminToken('admin123', 'testadmin', 1);
      const payload = jwt.verify(token, MOCK_SECRET) as { exp: number; iat: number };
      const expectedExp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
      expect(payload.exp).toBeGreaterThanOrEqual(expectedExp - 5);
      expect(payload.exp).toBeLessThanOrEqual(expectedExp + 5);
    });

    it('produces different tokens for different token versions', () => {
      const token1 = generateAdminToken('admin123', 'testadmin', 1);
      const token2 = generateAdminToken('admin123', 'testadmin', 2);
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateSetupToken', () => {
    it('returns a 16-character hex token', () => {
      const { token } = generateSetupToken();
      expect(token).toHaveLength(16);
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });

    it('returns an expiresAt date approximately 15 minutes in the future', () => {
      const before = Date.now();
      const { expiresAt } = generateSetupToken();
      const after = Date.now();
      const diff = expiresAt.getTime() - before;
      expect(diff).toBeGreaterThan(14 * 60 * 1000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 15 * 60 * 1000);
    });

    it('generates unique tokens each call', () => {
      const { token: a } = generateSetupToken();
      const { token: b } = generateSetupToken();
      expect(a).not.toBe(b);
    });
  });

  describe('checkAccountLock', () => {
    it('returns false when locked_until is null', async () => {
      const admin = { _id: 'admin123', locked_until: null };
      const result = await checkAccountLock(admin);
      expect(result).toBe(false);
      expect(AdminUser.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('returns true when locked_until is in the future', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      const admin = { _id: 'admin123', locked_until: futureDate };
      const result = await checkAccountLock(admin);
      expect(result).toBe(true);
      expect(AdminUser.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('unlocks account and returns false when lock has expired', async () => {
      const pastDate = new Date(Date.now() - 10 * 60 * 1000);
      const admin = { _id: 'admin123', locked_until: pastDate };
      const result = await checkAccountLock(admin);
      expect(result).toBe(false);
      expect(AdminUser.findByIdAndUpdate).toHaveBeenCalledWith(admin._id, {
        locked_until: null,
        failed_login_attempts: 0,
      });
    });

    it('unlocks account at exact lock expiration time', async () => {
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
      const admin = { _id: 'admin456', locked_until: new Date('2025-06-15T12:00:00Z') };
      const result = await checkAccountLock(admin);
      expect(result).toBe(false);
      expect(AdminUser.findByIdAndUpdate).toHaveBeenCalledWith(admin._id, {
        locked_until: null,
        failed_login_attempts: 0,
      });
    });
  });

  describe('recordFailedLogin', () => {
    it('increments failed_login_attempts by 1', async () => {
      const admin = { _id: 'admin123', failed_login_attempts: 2 };
      await recordFailedLogin(admin);
      expect(AdminUser.findByIdAndUpdate).toHaveBeenCalledWith(admin._id, {
        failed_login_attempts: 3,
      });
    });

    it('does not lock account below MAX_LOGIN_ATTEMPTS', async () => {
      const admin = { _id: 'admin123', failed_login_attempts: 3 };
      await recordFailedLogin(admin);
      const callArgs = vi.mocked(AdminUser.findByIdAndUpdate).mock.calls[0] as [unknown, Record<string, unknown>];
      expect(callArgs[1]).toEqual({ failed_login_attempts: 4 });
      expect(callArgs[1]).not.toHaveProperty('locked_until');
    });

    it('locks account when failed_login_attempts reaches MAX_LOGIN_ATTEMPTS (5)', async () => {
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
      const admin = { _id: 'admin123', failed_login_attempts: 4 };
      await recordFailedLogin(admin);
      const callArgs = vi.mocked(AdminUser.findByIdAndUpdate).mock.calls[0] as [unknown, Record<string, unknown>];
      expect(callArgs[1].failed_login_attempts).toBe(5);
      expect(callArgs[1]).toHaveProperty('locked_until');
      const lockedUntil = callArgs[1].locked_until as Date;
      expect(lockedUntil.getTime()).toBe(Date.now() + 15 * 60 * 1000);
    });

    it('locks account when failed_login_attempts exceeds MAX_LOGIN_ATTEMPTS', async () => {
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
      const admin = { _id: 'admin123', failed_login_attempts: 10 };
      await recordFailedLogin(admin);
      const callArgs = vi.mocked(AdminUser.findByIdAndUpdate).mock.calls[0] as [unknown, Record<string, unknown>];
      expect(callArgs[1].failed_login_attempts).toBe(11);
      expect(callArgs[1]).toHaveProperty('locked_until');
    });
  });

  describe('resetLoginAttempts', () => {
    it('resets failed_login_attempts to 0 and clears lock', async () => {
      await resetLoginAttempts('admin123');
      expect(AdminUser.findByIdAndUpdate).toHaveBeenCalledWith('admin123', {
        failed_login_attempts: 0,
        locked_until: null,
      });
    });

    it('works with ObjectId-like admin id', async () => {
      const objectId = { toString: () => '507f1f77bcf86cd799439011' };
      await resetLoginAttempts(objectId);
      expect(AdminUser.findByIdAndUpdate).toHaveBeenCalledWith(objectId, {
        failed_login_attempts: 0,
        locked_until: null,
      });
    });
  });

  describe('adminAuthMiddleware', () => {
    function mockReqRes(cookies?: Record<string, string>) {
      const req = { cookies: cookies ?? {}, admin: undefined as unknown };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        cookie: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();
      return { req, res, next };
    }

    it('returns 401 when no admin_token cookie is present', async () => {
      const { req, res, next } = mockReqRes({});
      await adminAuthMiddleware(req as never, res as never, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ code: 'UNAUTHORIZED', error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 for an invalid token', async () => {
      const { req, res, next } = mockReqRes({ admin_token: 'invalid.jwt.token' });
      await adminAuthMiddleware(req as never, res as never, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ code: 'UNAUTHORIZED', error: 'Invalid authentication' });
    });

    it('returns 401 when admin account is not found', async () => {
      vi.mocked(AdminUser.findById).mockResolvedValue(null);
      const token = generateAdminToken('nonexistent', 'ghost', 1);
      const { req, res, next } = mockReqRes({ admin_token: token });
      await adminAuthMiddleware(req as never, res as never, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ code: 'UNAUTHORIZED', error: 'Admin account not found' });
    });

    it('returns TOKEN_EXPIRED when token_version mismatches', async () => {
      vi.mocked(AdminUser.findById).mockResolvedValue({
        _id: 'admin123',
        username: 'testadmin',
        token_version: 2,
      });
      const token = generateAdminToken('admin123', 'testadmin', 1);
      const { req, res, next } = mockReqRes({ admin_token: token });
      await adminAuthMiddleware(req as never, res as never, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ code: 'TOKEN_EXPIRED', error: 'Session expired. Please login again.' });
    });

    it('calls next() and sets req.admin on successful authentication', async () => {
      vi.mocked(AdminUser.findById).mockResolvedValue({
        _id: 'admin123',
        username: 'testadmin',
        token_version: 1,
      });
      const token = generateAdminToken('admin123', 'testadmin', 1);
      const { req, res, next } = mockReqRes({ admin_token: token });
      await adminAuthMiddleware(req as never, res as never, next);
      expect(next).toHaveBeenCalled();
      expect(req.admin).toEqual({
        id: 'admin123',
        username: 'testadmin',
        token_version: 1,
      });
    });

    it('refreshes token when within 1 hour of expiry', async () => {
      vi.mocked(AdminUser.findById).mockResolvedValue({
        _id: 'admin123',
        username: 'testadmin',
        token_version: 1,
      });
      const nearExpiryToken = jwt.sign(
        { id: 'admin123', username: 'testadmin', token_version: 1 },
        MOCK_SECRET,
        { expiresIn: '30m' }
      );
      const { req, res, next } = mockReqRes({ admin_token: nearExpiryToken });
      await adminAuthMiddleware(req as never, res as never, next);
      expect(res.cookie).toHaveBeenCalledWith('admin_token', expect.any(String), expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
      }));
      expect(next).toHaveBeenCalled();
    });

    it('does not refresh token when far from expiry', async () => {
      vi.mocked(AdminUser.findById).mockResolvedValue({
        _id: 'admin123',
        username: 'testadmin',
        token_version: 1,
      });
      const farExpiryToken = jwt.sign(
        { id: 'admin123', username: 'testadmin', token_version: 1 },
        MOCK_SECRET,
        { expiresIn: '23h' }
      );
      const { req, res, next } = mockReqRes({ admin_token: farExpiryToken });
      await adminAuthMiddleware(req as never, res as never, next);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('handles expired token with TOKEN_EXPIRED response', async () => {
      const expiredToken = jwt.sign(
        { id: 'admin123', username: 'testadmin', token_version: 1 },
        MOCK_SECRET,
        { expiresIn: -60 }
      );
      const { req, res, next } = mockReqRes({ admin_token: expiredToken });
      await adminAuthMiddleware(req as never, res as never, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ code: 'TOKEN_EXPIRED', error: 'Session expired. Please login again.' });
    });
  });
});
