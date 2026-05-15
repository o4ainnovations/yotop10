import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('validateEnv', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('validates with all required vars set', async () => {
    vi.stubEnv('JWT_SECRET', 'my-super-secret-key-thats-long-enough');
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/yotop10-test');
    const { validateEnv } = await import('../lib/env');
    const env = validateEnv();
    expect(env.JWT_SECRET).toBe('my-super-secret-key-thats-long-enough');
    expect(env.MONGODB_URI).toBe('mongodb://localhost:27017/yotop10-test');
  });

  it('applies default values for optional vars', async () => {
    vi.stubEnv('JWT_SECRET', 'my-super-secret-key-thats-long-enough');
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.MONGODB_URI;
    delete process.env.REDIS_URL;
    delete process.env.ELASTICSEARCH_URL;
    delete process.env.CORS_ORIGINS;
    const { validateEnv } = await import('../lib/env');
    const env = validateEnv();
    expect(env.PORT).toBe(8000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.MONGODB_URI).toBe('mongodb://localhost:27017/yotop10');
    expect(env.REDIS_URL).toBe('redis://localhost:6379');
    expect(env.ELASTICSEARCH_URL).toBe('http://localhost:9200');
    expect(env.CORS_ORIGINS).toBe('http://localhost:3000,http://localhost:3100');
  });

  it('uses custom PORT when set', async () => {
    vi.stubEnv('JWT_SECRET', 'my-super-secret-key-thats-long-enough');
    vi.stubEnv('PORT', '9000');
    const { validateEnv } = await import('../lib/env');
    const env = validateEnv();
    expect(env.PORT).toBe(9000);
  });

  it('uses custom NODE_ENV when set to valid value', async () => {
    vi.stubEnv('JWT_SECRET', 'my-super-secret-key-thats-long-enough');
    vi.stubEnv('NODE_ENV', 'production');
    const { validateEnv } = await import('../lib/env');
    const env = validateEnv();
    expect(env.NODE_ENV).toBe('production');
  });

  it('throws when JWT_SECRET is missing', async () => {
    const { validateEnv } = await import('../lib/env');
    expect(() => validateEnv()).toThrow('Environment validation failed');
  });

  it('throws when JWT_SECRET is too short', async () => {
    vi.stubEnv('JWT_SECRET', 'short');
    const { validateEnv } = await import('../lib/env');
    expect(() => validateEnv()).toThrow(/JWT_SECRET/);
  });

  it('throws on invalid MONGODB_URI format', async () => {
    vi.stubEnv('JWT_SECRET', 'my-super-secret-key-thats-long-enough');
    vi.stubEnv('MONGODB_URI', 'not-a-url');
    const { validateEnv } = await import('../lib/env');
    expect(() => validateEnv()).toThrow('Environment validation failed');
  });

  it('throws on invalid REDIS_URL format', async () => {
    vi.stubEnv('JWT_SECRET', 'my-super-secret-key-thats-long-enough');
    vi.stubEnv('REDIS_URL', 'not-a-url');
    const { validateEnv } = await import('../lib/env');
    expect(() => validateEnv()).toThrow('Environment validation failed');
  });

  it('throws on invalid ELASTICSEARCH_URL format', async () => {
    vi.stubEnv('JWT_SECRET', 'my-super-secret-key-thats-long-enough');
    vi.stubEnv('ELASTICSEARCH_URL', 'not-a-url');
    const { validateEnv } = await import('../lib/env');
    expect(() => validateEnv()).toThrow('Environment validation failed');
  });

  it('throws on invalid NODE_ENV value', async () => {
    vi.stubEnv('JWT_SECRET', 'my-super-secret-key-thats-long-enough');
    vi.stubEnv('NODE_ENV', 'staging');
    const { validateEnv } = await import('../lib/env');
    expect(() => validateEnv()).toThrow('Environment validation failed');
  });

  it('caches result on subsequent calls', async () => {
    vi.stubEnv('JWT_SECRET', 'first-secret-key-with-16chars');
    vi.stubEnv('PORT', '3000');
    const { validateEnv } = await import('../lib/env');
    const first = validateEnv();

    vi.stubEnv('JWT_SECRET', 'second-secret-key16chars');
    vi.stubEnv('PORT', '4000');
    const second = validateEnv();

    expect(second.JWT_SECRET).toBe('first-secret-key-with-16chars');
    expect(second.PORT).toBe(3000);
    expect(first).toBe(second);
  });

  it('parses CORS_ORIGINS when set', async () => {
    vi.stubEnv('JWT_SECRET', 'my-super-secret-key-thats-long-enough');
    vi.stubEnv('CORS_ORIGINS', 'https://example.com,https://app.example.com');
    const { validateEnv } = await import('../lib/env');
    const env = validateEnv();
    expect(env.CORS_ORIGINS).toBe('https://example.com,https://app.example.com');
  });
});

describe('getEnv', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns env after validation', async () => {
    vi.stubEnv('JWT_SECRET', 'my-super-secret-key-thats-long-enough');
    const { validateEnv, getEnv } = await import('../lib/env');
    validateEnv();
    const env = getEnv();
    expect(env.JWT_SECRET).toBe('my-super-secret-key-thats-long-enough');
  });

  it('throws if called before validateEnv', async () => {
    const { getEnv } = await import('../lib/env');
    expect(() => getEnv()).toThrow('Environment not validated');
  });
});
