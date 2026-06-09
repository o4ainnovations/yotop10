import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCreateClient = vi.fn();
const mockOn = vi.fn();
const mockEval = vi.fn();

vi.mock('../lib/secrets', () => ({
  SecretsManager: {
    getSecretWithFallback: vi.fn().mockResolvedValue(''),
  },
}));

vi.mock('redis', () => {
  return {
    createClient: vi.fn().mockImplementation((config: unknown) => {
      mockCreateClient(config);
      return {
        on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
          mockOn(event, handler);
        }),
        auth: vi.fn(),
        eval: vi.fn().mockImplementation((...args: unknown[]) => mockEval(...args)),
        connect: vi.fn(),
        quit: vi.fn(),
        isOpen: true,
        isReady: true,
      };
    }),
  };
});

describe('redis client', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateClient.mockClear();
    mockOn.mockClear();
    mockEval.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates client with custom REDIS_HOST and REDIS_PORT', async () => {
    vi.stubEnv('REDIS_HOST', 'my-redis-host');
    vi.stubEnv('REDIS_PORT', '6380');
    await import('../lib/redis');
    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: expect.objectContaining({ host: 'my-redis-host', port: 6380 }),
      })
    );
  });

  it('falls back to default host and port when env vars are not set', async () => {
    vi.stubEnv('REDIS_HOST', undefined);
    vi.stubEnv('REDIS_PORT', undefined);
    await import('../lib/redis');
    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: expect.objectContaining({ host: 'redis', port: 6379 }),
      })
    );
  });

  it('registers an error handler on the client', async () => {
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    await import('../lib/redis');
    expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('exports a redis singleton', async () => {
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    const mod = await import('../lib/redis');
    expect(mod.redis).toBeDefined();
    expect(typeof mod.redis).toBe('object');
  });

  it('returns the same instance on multiple imports', async () => {
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    const modA = await import('../lib/redis');
    const modB = await import('../lib/redis');
    expect(modA.redis).toBe(modB.redis);
  });
});

describe('atomicCheckRateLimit', () => {
  let atomicCheckRateLimit: (key: string, windowMs: number, maxRequests: number) => Promise<{ allowed: boolean; remaining: number }>;

  beforeEach(async () => {
    vi.resetModules();
    mockCreateClient.mockClear();
    mockOn.mockClear();
    mockEval.mockClear();
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    const mod = await import('../lib/redis');
    atomicCheckRateLimit = mod.atomicCheckRateLimit;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns allowed and remaining count when under limit', async () => {
    mockEval.mockResolvedValue([1, 4]);
    const result = await atomicCheckRateLimit('rate:test', 60_000, 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('returns blocked when at limit', async () => {
    mockEval.mockResolvedValue([0, 0]);
    const result = await atomicCheckRateLimit('rate:test', 60_000, 5);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('passes correct window arguments to the Lua script', async () => {
    mockEval.mockResolvedValue([1, 9]);
    const beforeCall = Date.now();
    await atomicCheckRateLimit('rate:login', 30_000, 10);
    const afterCall = Date.now();

    expect(mockEval).toHaveBeenCalledTimes(1);
    const [script, options] = mockEval.mock.calls[0];
    expect(script).toBeDefined();
    expect(options.keys).toEqual(['rate:login']);
    expect(options.arguments).toHaveLength(4);
    const windowStart = parseInt(options.arguments[0], 10);
    const maxRequests = parseInt(options.arguments[1], 10);
    const timestamp = parseInt(options.arguments[2], 10);
    const ttl = parseInt(options.arguments[3], 10);

    expect(maxRequests).toBe(10);
    expect(timestamp).toBeGreaterThanOrEqual(beforeCall);
    expect(timestamp).toBeLessThanOrEqual(afterCall);
    expect(windowStart).toBe(timestamp - 30_000);
    expect(ttl).toBe(30);
  });

  it('handles zero remaining when allowed at edge of limit', async () => {
    mockEval.mockResolvedValue([1, 0]);
    const result = await atomicCheckRateLimit('rate:test', 60_000, 1);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('returns remaining based on Redis response', async () => {
    mockEval.mockResolvedValue([1, 99]);
    const result = await atomicCheckRateLimit('rate:test', 60_000, 100);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it('throws on unexpected Redis response format (non-array)', async () => {
    mockEval.mockResolvedValue('unexpected');
    await expect(atomicCheckRateLimit('rate:test', 60_000, 5)).rejects.toThrow('Unexpected Redis response format');
  });

  it('throws on unexpected Redis response format (wrong length)', async () => {
    mockEval.mockResolvedValue([1]);
    await expect(atomicCheckRateLimit('rate:test', 60_000, 5)).rejects.toThrow('Unexpected Redis response format');
  });

  it('throws on unexpected Redis response format (non-number first element)', async () => {
    mockEval.mockResolvedValue(['yes', 3]);
    await expect(atomicCheckRateLimit('rate:test', 60_000, 5)).rejects.toThrow('Unexpected Redis response format');
  });
});
