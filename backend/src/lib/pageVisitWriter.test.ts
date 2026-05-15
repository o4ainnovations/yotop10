import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClientIp, logPageVisit } from './pageVisitWriter';
import { PageVisit } from '../models/PageVisit';

vi.mock('../models/PageVisit', () => ({
  PageVisit: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(PageVisit.create).mockResolvedValue({});
});

async function tick(ms = 10): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('pageVisitWriter', () => {
  describe('getClientIp', () => {
    it('returns req.ip when no x-forwarded-for header', () => {
      const req = {
        headers: {} as Record<string, string | undefined>,
        ip: '203.0.113.1',
        socket: {} as unknown,
      };
      expect(getClientIp(req as never)).toBe('203.0.113.1');
    });

    it('returns single IP from x-forwarded-for header', () => {
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.5' },
        ip: undefined,
        socket: {} as unknown,
      };
      expect(getClientIp(req as never)).toBe('203.0.113.5');
    });

    it('returns second-to-last IP from x-forwarded-for with multiple proxies', () => {
      const req = {
        headers: { 'x-forwarded-for': 'client, proxy1, proxy2' },
        ip: undefined,
        socket: {} as unknown,
      };
      expect(getClientIp(req as never)).toBe('proxy1');
    });

    it('returns first IP when x-forwarded-for has only one IP', () => {
      const req = {
        headers: { 'x-forwarded-for': ' 203.0.113.99 ' },
        ip: undefined,
        socket: {} as unknown,
      };
      expect(getClientIp(req as never)).toBe('203.0.113.99');
    });

    it('returns first IP when x-forwarded-for has two IPs', () => {
      const req = {
        headers: { 'x-forwarded-for': 'client, proxy' },
        ip: undefined,
        socket: {} as unknown,
      };
      expect(getClientIp(req as never)).toBe('client');
    });

    it('trims whitespace from x-forwarded-for entries', () => {
      const req = {
        headers: { 'x-forwarded-for': '  203.0.113.10  ,  10.0.0.1  ,  10.0.0.2  ' },
        ip: undefined,
        socket: {} as unknown,
      };
      expect(getClientIp(req as never)).toBe('10.0.0.1');
    });

    it('falls back to socket.remoteAddress when req.ip is undefined', () => {
      const req = {
        headers: {} as Record<string, string | undefined>,
        ip: undefined,
        socket: { remoteAddress: '192.168.1.100' },
      };
      expect(getClientIp(req as never)).toBe('192.168.1.100');
    });

    it('returns "unknown" when no IP source is available', () => {
      const req = {
        headers: {} as Record<string, string | undefined>,
        ip: undefined,
        socket: {} as Record<string, unknown>,
      };
      expect(getClientIp(req as never)).toBe('unknown');
    });

    it('prefers x-forwarded-for over req.ip', () => {
      const req = {
        headers: { 'x-forwarded-for': '1.2.3.4' },
        ip: '5.6.7.8',
        socket: {} as unknown,
      };
      expect(getClientIp(req as never)).toBe('1.2.3.4');
    });
  });

  describe('logPageVisit', () => {
    it('calls PageVisit.create with correct parameters', async () => {
      logPageVisit({
        path: '/dashboard',
        referer: 'https://example.com/home',
        user_agent: 'Mozilla/5.0',
        fingerprint: 'fp_123',
        ip: '203.0.113.42',
      });
      await tick();
      expect(PageVisit.create).toHaveBeenCalledWith({
        path: '/dashboard',
        referer: 'https://example.com/home',
        user_agent: 'Mozilla/5.0',
        fingerprint: 'fp_123',
        ip: '203.0.113.42',
        country: null,
      });
    });

    it('truncates referer to 500 characters', async () => {
      const longReferer = 'https://example.com/' + 'a'.repeat(600);
      logPageVisit({
        path: '/page',
        ip: '203.0.113.42',
        referer: longReferer,
      });
      await tick();
      const createCall = vi.mocked(PageVisit.create).mock.calls[0][0] as Record<string, unknown>;
      expect((createCall.referer as string).length).toBe(500);
    });

    it('truncates user_agent to 300 characters', async () => {
      const longUA = 'B'.repeat(500);
      logPageVisit({
        path: '/page',
        ip: '203.0.113.42',
        user_agent: longUA,
      });
      await tick();
      const createCall = vi.mocked(PageVisit.create).mock.calls[0][0] as Record<string, unknown>;
      expect((createCall.user_agent as string).length).toBe(300);
    });

    it('sets fingerprint to null when not provided', async () => {
      logPageVisit({
        path: '/home',
        ip: '203.0.113.42',
      });
      await tick();
      expect(PageVisit.create).toHaveBeenCalledWith(expect.objectContaining({
        fingerprint: null,
      }));
    });

    it('sets country to null for localhost IPs', async () => {
      const localhostIps = ['127.0.0.1', '::1', '192.168.1.1', '10.0.0.1', '172.16.0.1'];
      for (const ip of localhostIps) {
        vi.mocked(PageVisit.create).mockClear();
        logPageVisit({ path: '/test', ip });
        await tick();
        expect(PageVisit.create).toHaveBeenCalledWith(expect.objectContaining({
          ip,
          country: null,
        }));
      }
    });

    it('sets country to null for "unknown" IP', async () => {
      logPageVisit({ path: '/test', ip: 'unknown' });
      await tick();
      expect(PageVisit.create).toHaveBeenCalledWith(expect.objectContaining({
        country: null,
      }));
    });

    it('does not throw when PageVisit.create fails', async () => {
      vi.mocked(PageVisit.create).mockRejectedValue(new Error('DB write failed'));
      expect(() => {
        logPageVisit({
          path: '/page',
          ip: '203.0.113.42',
        });
      }).not.toThrow();
      await tick();
    });

    it('returns immediately without awaiting (fire and forget)', () => {
      const result = logPageVisit({
        path: '/page',
        ip: '203.0.113.42',
      });
      expect(result).toBeUndefined();
    });

    it('handles empty referer string', async () => {
      logPageVisit({
        path: '/page',
        ip: '203.0.113.42',
        referer: null,
        user_agent: undefined,
      });
      await tick();
      const createCall = vi.mocked(PageVisit.create).mock.calls[0][0] as Record<string, unknown>;
      expect(createCall.referer).toBe('');
      expect(createCall.user_agent).toBe('');
    });
  });
});
