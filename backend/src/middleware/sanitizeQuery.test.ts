import { describe, it, expect, vi } from 'vitest';
import { sanitizeQueryParams } from './sanitizeQuery';

function mockReqRes(query: Record<string, string>) {
  const req = { query };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('sanitizeQueryParams', () => {
  it('passes through clean query params', () => {
    const { req, res, next } = mockReqRes({ q: 'hello', page: '1' });
    sanitizeQueryParams(req as any, res as any, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks NoSQL $gt injection', () => {
    const { req, res, next } = mockReqRes({ q: '{$gt: ""}' });
    sanitizeQueryParams(req as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid query parameter' });
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks NoSQL $regex injection', () => {
    const { req, res, next } = mockReqRes({ search: '{$regex: ".*"}' });
    sanitizeQueryParams(req as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('blocks NoSQL $where injection', () => {
    const { req, res, next } = mockReqRes({ q: '{$where: "1==1"}' });
    sanitizeQueryParams(req as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('blocks unexpectedly long query params', () => {
    const { req, res, next } = mockReqRes({ q: 'a'.repeat(501) });
    sanitizeQueryParams(req as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Query parameter too long' });
  });

  it('allows params at exactly 500 chars', () => {
    const { req, res, next } = mockReqRes({ q: 'a'.repeat(500) });
    sanitizeQueryParams(req as any, res as any, next);
    expect(next).toHaveBeenCalled();
  });
});
