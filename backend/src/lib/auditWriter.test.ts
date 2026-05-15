import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAudit, getAuditStats } from './auditWriter';
import { AuditLog } from '../models/AuditLog';
import { redis } from './redis';

vi.mock('../models/AuditLog', () => ({
  AuditLog: {
    create: vi.fn().mockResolvedValue({}),
    countDocuments: vi.fn().mockResolvedValue(0),
    findOne: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(null) }),
  },
}));

vi.mock('./redis', () => ({
  redis: {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(redis.incr).mockResolvedValue(1);
  vi.mocked(redis.expire).mockResolvedValue('OK');
  vi.mocked(redis.del).mockResolvedValue(1);
  vi.mocked(redis.get).mockResolvedValue(null);
  vi.mocked(redis.set).mockResolvedValue('OK');
  vi.mocked(AuditLog.create).mockResolvedValue({});
  // Reset the chainable mock for findOne
  const sortMock = vi.fn().mockReturnThis();
  const selectMock = vi.fn().mockReturnThis();
  const leanMock = vi.fn().mockResolvedValue(null);
  vi.mocked(AuditLog.findOne).mockReturnValue({ sort: sortMock, select: selectMock, lean: leanMock } as never);
});

async function tick(ms = 10): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('auditWriter', () => {
  describe('logAudit', () => {
    it('calls AuditLog.create with correct parameters', async () => {
      logAudit({
        admin_id: 'admin123',
        action: 'login_success',
        ip: '192.168.1.1',
        metadata: { browser: 'Chrome' },
        user_agent: 'Mozilla/5.0',
      });
      await tick();
      expect(AuditLog.create).toHaveBeenCalledWith({
        admin_id: 'admin123',
        action: 'login_success',
        ip: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        metadata: { browser: 'Chrome' },
      });
    });

    it('truncates user_agent to 200 characters', async () => {
      const longUA = 'A'.repeat(500);
      logAudit({
        admin_id: null,
        action: 'page_view',
        ip: '10.0.0.1',
        user_agent: longUA,
      });
      await tick();
      const createCall = vi.mocked(AuditLog.create).mock.calls[0][0] as Record<string, unknown>;
      expect((createCall.user_agent as string).length).toBe(200);
    });

    it('uses empty metadata when not provided', async () => {
      logAudit({
        admin_id: null,
        action: 'logout',
        ip: '10.0.0.1',
      });
      await tick();
      expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        metadata: {},
      }));
    });

    it('throttles when IP exceeds THROTTLE_MAX (300) requests per window', async () => {
      vi.mocked(redis.incr).mockResolvedValue(301);
      logAudit({
        admin_id: 'admin123',
        action: 'login_failed',
        ip: '10.0.0.1',
      });
      await tick();
      expect(AuditLog.create).not.toHaveBeenCalled();
    });

    it('allows requests at exactly THROTTLE_MAX (300)', async () => {
      vi.mocked(redis.incr).mockResolvedValue(300);
      logAudit({
        admin_id: 'admin123',
        action: 'login_success',
        ip: '192.168.1.1',
      });
      await tick();
      expect(AuditLog.create).toHaveBeenCalled();
    });

    it('sets throttle key expiry on first request (incr returns 1)', async () => {
      vi.mocked(redis.incr).mockResolvedValue(1);
      logAudit({
        admin_id: 'admin123',
        action: 'login_success',
        ip: '192.168.1.1',
      });
      await tick();
      expect(redis.expire).toHaveBeenCalledWith('audit_throttle:192.168.1.1', 60);
    });

    it('does not set throttle expiry on subsequent requests', async () => {
      vi.mocked(redis.incr).mockResolvedValue(42);
      logAudit({
        admin_id: 'admin123',
        action: 'login_success',
        ip: '192.168.1.1',
      });
      await tick();
      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('invalidates stats cache after writing an audit entry', async () => {
      logAudit({
        admin_id: 'admin123',
        action: 'login_success',
        ip: '10.0.0.1',
      });
      await tick();
      expect(redis.del).toHaveBeenCalledWith('admin:audit:stats');
    });

    it('does not throw when Redis incr fails', async () => {
      vi.mocked(redis.incr).mockRejectedValue(new Error('Redis connection refused'));
      expect(() => {
        logAudit({
          admin_id: 'admin123',
          action: 'login_success',
          ip: '10.0.0.1',
        });
      }).not.toThrow();
    });

    it('does not throw when AuditLog.create fails', async () => {
      vi.mocked(AuditLog.create).mockRejectedValue(new Error('DB write failed'));
      logAudit({
        admin_id: 'admin123',
        action: 'login_success',
        ip: '10.0.0.1',
      });
      await tick();
      // Error is caught and logged — no throw should propagate
    });

    it('handles empty user_agent string', async () => {
      logAudit({
        admin_id: 'admin123',
        action: 'login_success',
        ip: '10.0.0.1',
        user_agent: undefined,
      });
      await tick();
      const createCall = vi.mocked(AuditLog.create).mock.calls[0][0] as Record<string, unknown>;
      expect(createCall.user_agent).toBe('');
    });

    it('returns immediately without awaiting (fire and forget)', () => {
      const result = logAudit({
        admin_id: 'admin123',
        action: 'login_success',
        ip: '10.0.0.1',
      });
      expect(result).toBeUndefined();
    });
  });

  describe('getAuditStats', () => {
    it('returns live-computed stats when cache is empty', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(AuditLog.countDocuments).mockResolvedValueOnce(5).mockResolvedValueOnce(3).mockResolvedValueOnce(100);
      const mockLastLoginLean = vi.fn().mockResolvedValue({ created_at: new Date('2025-06-15T10:00:00Z'), metadata: {} });
      const mockLastLoginSelect = vi.fn().mockReturnValue({ lean: mockLastLoginLean });
      const mockLastLoginSort = vi.fn().mockReturnValue({ select: mockLastLoginSelect });
      vi.mocked(AuditLog.findOne).mockReturnValueOnce({ sort: mockLastLoginSort, select: mockLastLoginSelect, lean: mockLastLoginLean } as never);

      const mockLastFailedLean = vi.fn().mockResolvedValue({ created_at: new Date('2025-06-15T09:00:00Z'), metadata: { reason: 'bad_password' } });
      const mockLastFailedSelect = vi.fn().mockReturnValue({ lean: mockLastFailedLean });
      const mockLastFailedSort = vi.fn().mockReturnValue({ select: mockLastFailedSelect });
      vi.mocked(AuditLog.findOne).mockReturnValueOnce({ sort: mockLastFailedSort, select: mockLastFailedSelect, lean: mockLastFailedLean } as never);

      const stats = await getAuditStats();

      expect(stats).toEqual({
        failed_logins_24h: 5,
        successful_logins_24h: 3,
        last_login: new Date('2025-06-15T10:00:00Z'),
        last_failed: new Date('2025-06-15T09:00:00Z'),
        total_rows: 100,
        retention_days: 90,
      });
      expect(redis.set).toHaveBeenCalledWith('admin:audit:stats', expect.any(String), { EX: 30 });
    });

    it('returns cached stats when available', async () => {
      const cached = {
        failed_logins_24h: 12,
        successful_logins_24h: 8,
        last_login: '2025-06-15T10:00:00.000Z',
        last_failed: null,
        total_rows: 200,
        retention_days: 90,
      };
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cached));

      const stats = await getAuditStats();
      expect(stats).toEqual(cached);
      expect(AuditLog.countDocuments).not.toHaveBeenCalled();
    });

    it('falls back to live computation when Redis get fails', async () => {
      vi.mocked(redis.get).mockRejectedValue(new Error('Redis down'));
      vi.mocked(AuditLog.countDocuments).mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(50);
      const mockLean = vi.fn().mockResolvedValue(null);
      const mockSelect = vi.fn().mockReturnValue({ lean: mockLean });
      const mockSort = vi.fn().mockReturnValue({ select: mockSelect });
      vi.mocked(AuditLog.findOne).mockReturnValue({ sort: mockSort, select: mockSelect, lean: mockLean } as never);

      const stats = await getAuditStats();
      expect(stats.total_rows).toBe(50);
      expect(stats.failed_logins_24h).toBe(0);
    });

    it('handles null last login/failed gracefully', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(AuditLog.countDocuments).mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(10);

      const mockLean = vi.fn().mockResolvedValue(null);
      const mockSelect = vi.fn().mockReturnValue({ lean: mockLean });
      const mockSort = vi.fn().mockReturnValue({ select: mockSelect });
      vi.mocked(AuditLog.findOne).mockReturnValue({ sort: mockSort, select: mockSelect, lean: mockLean } as never);

      const stats = await getAuditStats();
      expect(stats.last_login).toBeNull();
      expect(stats.last_failed).toBeNull();
    });

    it('continues even when cache write fails', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(redis.set).mockRejectedValue(new Error('Redis write error'));
      vi.mocked(AuditLog.countDocuments).mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(30);

      const mockLean = vi.fn().mockResolvedValue({ created_at: new Date() });
      const mockSelect = vi.fn().mockReturnValue({ lean: mockLean });
      const mockSort = vi.fn().mockReturnValue({ select: mockSelect });
      vi.mocked(AuditLog.findOne).mockReturnValue({ sort: mockSort, select: mockSelect, lean: mockLean } as never);

      const stats = await getAuditStats();
      expect(stats.total_rows).toBe(30);
    });

    it('queries the correct 24h time window for login counts', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(AuditLog.countDocuments).mockResolvedValue(0);

      const mockLean = vi.fn().mockResolvedValue(null);
      const mockSelect = vi.fn().mockReturnValue({ lean: mockLean });
      const mockSort = vi.fn().mockReturnValue({ select: mockSelect });
      vi.mocked(AuditLog.findOne).mockReturnValue({ sort: mockSort, select: mockSelect, lean: mockLean } as never);

      await getAuditStats();

      expect(AuditLog.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'login_failed', created_at: expect.objectContaining({ $gte: expect.any(Date) }) })
      );
      expect(AuditLog.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'login_success', created_at: expect.objectContaining({ $gte: expect.any(Date) }) })
      );
    });
  });
});
