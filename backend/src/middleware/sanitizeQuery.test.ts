/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-restricted-syntax -- test file */
import { describe, it, expect, vi } from 'vitest';
import { sanitizeQueryParams } from './sanitizeQuery';
import type { Request, Response, NextFunction } from 'express';

function mockReqRes(query: Record<string, string>) {
  const req = { query } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('sanitizeQueryParams', () => {
  it('passes through clean query params', () => {
    const { req, res, next } = mockReqRes({ q: 'hello', page: '1' });
    sanitizeQueryParams(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks NoSQL $gt injection', () => {
    const { req, res, next } = mockReqRes({ q: '{$gt: ""}' });
    sanitizeQueryParams(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid query parameter' });
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks NoSQL $regex injection', () => {
    const { req, res, next } = mockReqRes({ search: '{$regex: ".*"}' });
    sanitizeQueryParams(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('blocks NoSQL $where injection', () => {
    const { req, res, next } = mockReqRes({ q: '{$where: "1==1"}' });
    sanitizeQueryParams(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('blocks unexpectedly long query params', () => {
    const { req, res, next } = mockReqRes({ q: 'a'.repeat(501) });
    sanitizeQueryParams(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Query parameter too long' });
  });

  it('allows params at exactly 500 chars', () => {
    const { req, res, next } = mockReqRes({ q: 'a'.repeat(500) });
    sanitizeQueryParams(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
