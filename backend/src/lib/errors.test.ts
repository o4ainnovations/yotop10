import { describe, it, expect } from 'vitest';
import { AppError, NotFoundError, ConflictError, AuthError, ValidationError, RateLimitError } from './errors';

describe('AppError', () => {
  it('creates error with default values', () => {
    const err = new AppError('Something went wrong');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Something went wrong');
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe('AppError');
  });

  it('creates error with custom code and status', () => {
    const err = new AppError('Custom', 'CUSTOM_CODE', 418);
    expect(err.code).toBe('CUSTOM_CODE');
    expect(err.statusCode).toBe(418);
  });
});

describe('NotFoundError', () => {
  it('creates error with entity name', () => {
    const err = new NotFoundError('Post');
    expect(err.message).toBe('Post not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('creates error with entity name and id', () => {
    const err = new NotFoundError('User', 'abc123');
    expect(err.message).toBe('User not found: abc123');
  });
});

describe('ConflictError', () => {
  it('creates conflict error', () => {
    const err = new ConflictError('Already exists');
    expect(err.message).toBe('Already exists');
    expect(err.code).toBe('CONFLICT');
    expect(err.statusCode).toBe(409);
  });
});

describe('AuthError', () => {
  it('creates auth error with default code', () => {
    const err = new AuthError('Not authorized');
    expect(err.message).toBe('Not authorized');
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.statusCode).toBe(401);
  });

  it('creates auth error with custom code', () => {
    const err = new AuthError('Token expired', 'TOKEN_EXPIRED');
    expect(err.code).toBe('TOKEN_EXPIRED');
  });
});

describe('ValidationError', () => {
  it('creates validation error', () => {
    const err = new ValidationError('Invalid input');
    expect(err.message).toBe('Invalid input');
    expect(err.code).toBe('VALIDATION');
    expect(err.statusCode).toBe(400);
  });
});

describe('RateLimitError', () => {
  it('creates rate limit error', () => {
    const err = new RateLimitError('Too many requests');
    expect(err.message).toBe('Too many requests');
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.statusCode).toBe(429);
  });
});
