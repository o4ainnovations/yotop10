import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const MockClient = vi.fn();

vi.mock('@elastic/elasticsearch', () => ({
  Client: vi.fn().mockImplementation((config: unknown) => {
    MockClient(config);
    return {
      ping: vi.fn(),
      search: vi.fn(),
      index: vi.fn(),
    };
  }),
}));

describe('elasticsearch client', () => {
  beforeEach(() => {
    vi.resetModules();
    MockClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates client with custom ES_HOST and ES_PORT', async () => {
    vi.stubEnv('ES_HOST', 'elastic.example.com');
    vi.stubEnv('ES_PORT', '9200');
    vi.stubEnv('ES_PASSWORD', undefined);
    await import('../lib/elasticsearch');
    expect(MockClient).toHaveBeenCalledTimes(1);
    expect(MockClient).toHaveBeenCalledWith(expect.objectContaining({ node: 'http://elastic.example.com:9200' }));
  });

  it('falls back to default host and port when env vars are not set', async () => {
    vi.stubEnv('ES_HOST', undefined);
    vi.stubEnv('ES_PORT', undefined);
    vi.stubEnv('ES_PASSWORD', undefined);
    await import('../lib/elasticsearch');
    expect(MockClient).toHaveBeenCalledTimes(1);
    expect(MockClient).toHaveBeenCalledWith(expect.objectContaining({ node: 'http://elasticsearch:9200' }));
  });

  it('exports a singleton es instance', async () => {
    vi.stubEnv('ELASTICSEARCH_URL', 'http://localhost:9200');
    const mod = await import('../lib/elasticsearch');
    expect(mod.es).toBeDefined();
    expect(typeof mod.es).toBe('object');
  });

  it('reuses the same instance on multiple imports within same module context', async () => {
    vi.stubEnv('ELASTICSEARCH_URL', 'http://localhost:9200');
    const modA = await import('../lib/elasticsearch');
    const modB = await import('../lib/elasticsearch');
    expect(modA.es).toBe(modB.es);
  });
});
