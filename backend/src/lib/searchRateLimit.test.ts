import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mock functions ─────────────────────────────────────────────────
const { mockAtomicCheckRateLimit, mockGetClientIp } = vi.hoisted(() => ({
  mockAtomicCheckRateLimit: vi.fn(),
  mockGetClientIp: vi.fn(),
}));

// ── Mock dependencies ──────────────────────────────────────────────────────
vi.mock('./redis', () => ({
  atomicCheckRateLimit: mockAtomicCheckRateLimit,
}));

vi.mock('../middleware/fingerprint', () => ({
  getClientIp: mockGetClientIp,
}));

import { searchRateLimit, autocompleteRateLimit } from './searchRateLimit';
import type { Request } from 'express';

// ── Helpers ────────────────────────────────────────────────────────────────

function mockReq(overrides: Partial<Request> = {}): Request {
  return { ...overrides } as Request;
}

function mockRes() {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    _headers: headers,
    setHeader: vi.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
      return res;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
    getHeader: vi.fn((name: string) => headers[name.toLowerCase()]),
  };
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetClientIp.mockReturnValue('10.0.0.1');
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('searchRateLimit middleware', () => {
  it('calls next() when rate limit is not exceeded', async () => {
    mockAtomicCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 29 });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await searchRateLimit(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('sets rate limit headers on all requests', async () => {
    mockAtomicCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 25 });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await searchRateLimit(req, res, next);

    expect(res._headers['x-ratelimit-limit']).toBe('30');
    expect(res._headers['x-ratelimit-remaining']).toBe('25');
    expect(res._headers['x-ratelimit-reset']).toBeDefined();
    expect(typeof res._headers['x-ratelimit-reset']).toBe('string');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockAtomicCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await searchRateLimit(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
  });

  it('returns correct error body on rate limit', async () => {
    mockAtomicCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await searchRateLimit(req, res, next);

    expect(res.body).toEqual({
      code: 'RATE_LIMITED',
      error: 'Too many requests. Try again in 60 seconds.',
    });
  });

  it('sets Retry-After header on 429 response', async () => {
    mockAtomicCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await searchRateLimit(req, res, next);

    expect(res._headers['retry-after']).toBe('60');
  });

  it('passes correct window and max to atomicCheckRateLimit', async () => {
    mockAtomicCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 29 });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await searchRateLimit(req, res, next);

    const callArgs = mockAtomicCheckRateLimit.mock.calls[0] as [string, number, number];
    expect(callArgs[0]).toBe('search_rate:10.0.0.1');
    expect(callArgs[1]).toBe(60000); // 60 seconds * 1000
    expect(callArgs[2]).toBe(30);
  });

  it('catches errors from atomicCheckRateLimit and calls next()', async () => {
    mockAtomicCheckRateLimit.mockRejectedValue(new Error('Redis down'));
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await searchRateLimit(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('sets X-RateLimit-Limit based on config maxRequests', async () => {
    mockAtomicCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 29 });
    const req = mockReq();
    const res = mockRes();

    await searchRateLimit(req, res, vi.fn());
    expect(res._headers['x-ratelimit-limit']).toBe('30');
  });

  it('decrements remaining counter on each request', async () => {
    mockAtomicCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 15 });
    const req = mockReq();
    const res = mockRes();

    await searchRateLimit(req, res, vi.fn());
    expect(res._headers['x-ratelimit-remaining']).toBe('15');
  });

  it('X-RateLimit-Reset is a valid future Unix timestamp', async () => {
    mockAtomicCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 29 });
    const req = mockReq();
    const res = mockRes();

    await searchRateLimit(req, res, vi.fn());

    const reset = parseInt(res._headers['x-ratelimit-reset'], 10);
    const now = Math.ceil(Date.now() / 1000);
    expect(reset).toBeGreaterThanOrEqual(now);
    expect(reset).toBeLessThanOrEqual(now + 120);
  });
});

describe('autocompleteRateLimit middleware', () => {
  it('uses autocomplete config (10 requests / 60s)', async () => {
    mockAtomicCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await autocompleteRateLimit(req, res, next);

    expect(res._headers['x-ratelimit-limit']).toBe('10');

    const callArgs = mockAtomicCheckRateLimit.mock.calls[0] as [string, number, number];
    expect(callArgs[0]).toBe('autocomplete_rate:10.0.0.1');
    expect(callArgs[2]).toBe(10);
  });

  it('returns 429 with correct retry window for autocomplete', async () => {
    mockAtomicCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await autocompleteRateLimit(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({
      code: 'RATE_LIMITED',
      error: 'Too many requests. Try again in 60 seconds.',
    });
  });
});

describe('rate limit middleware — edge cases', () => {
  it('uses client IP from getClientIp', async () => {
    mockGetClientIp.mockReturnValue('192.168.1.100');
    mockAtomicCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 29 });

    const req = mockReq();
    const res = mockRes();

    await searchRateLimit(req, res, vi.fn());

    const callArgs = mockAtomicCheckRateLimit.mock.calls[0] as [string, number, number];
    expect(callArgs[0]).toBe('search_rate:192.168.1.100');
  });

  it('remaining can be 0 but still allowed (boundary)', async () => {
    mockAtomicCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 0 });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await searchRateLimit(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res._headers['x-ratelimit-remaining']).toBe('0');
  });

  it('handles remaining count of exactly maxRequests', async () => {
    mockAtomicCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 30 });
    const req = mockReq();
    const res = mockRes();

    await searchRateLimit(req, res, vi.fn());
    expect(res._headers['x-ratelimit-remaining']).toBe('30');
  });

  it('both middlewares are Express RequestHandler functions', () => {
    expect(typeof searchRateLimit).toBe('function');
    expect(typeof autocompleteRateLimit).toBe('function');
    expect(searchRateLimit.length).toBe(3);
    expect(autocompleteRateLimit.length).toBe(3);
  });
});
