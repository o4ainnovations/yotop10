import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogAuditCalls: Array<Record<string, unknown>> = [];

const mockRedisSet = vi.fn();
const mockRedisGet = vi.fn();

vi.mock('./redis', () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
  },
}));

vi.mock('./auditWriter', () => ({
  logAudit: vi.fn().mockImplementation((params: Record<string, unknown>) => {
    mockLogAuditCalls.push(params);
  }),
}));

const mockFindOne = vi.fn();
const mockCreate = vi.fn();
const mockFindOneAndUpdate = vi.fn();

vi.mock('../models/SystemConfig', () => ({
  SystemConfig: {
    findOne: vi.fn().mockImplementation((...args: unknown[]) => ({ lean: () => mockFindOne(...args) })),
    create: vi.fn().mockImplementation((...args: unknown[]) => mockCreate(...args)),
    findOneAndUpdate: vi.fn().mockImplementation((...args: unknown[]) => ({ lean: () => mockFindOneAndUpdate(...args) })),
  },
}));

describe('DEFAULT_CONFIG', () => {
  it('has expected structure and defaults', async () => {
    const mod = await import('./systemConfig');
    const cfg = mod.DEFAULT_CONFIG;
    expect(cfg.key).toBe('global');
    expect(cfg.rate_limits.base_posts_per_hour).toBe(4);
    expect(cfg.rate_limits.base_comments_per_hour).toBe(20);
    expect(cfg.rate_limits.tiers.troll.multiplier).toBe(0.5);
    expect(cfg.rate_limits.tiers.troll.min_posts).toBe(2);
    expect(cfg.rate_limits.tiers.neutral.multiplier).toBe(1.0);
    expect(cfg.rate_limits.tiers.scholar.multiplier).toBe(2.0);
    expect(cfg.rate_limits.counter_lists_unlimited).toBe(true);
    expect(cfg.rate_limits.comment_edit_window_minutes).toBe(120);
    expect(cfg.trust_tiers.troll_max).toBe(0.49);
    expect(cfg.trust_tiers.scholar_min).toBe(1.8);
    expect(cfg.trust_tiers.hysteresis_enter).toBe(1.85);
    expect(cfg.trust_tiers.double_blind).toBe(true);
    expect(cfg.version).toBe(1);
  });
});

describe('getConfig', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockFindOne.mockReset();
    mockCreate.mockReset();
    mockFindOneAndUpdate.mockReset();
    mockRedisSet.mockReset();
    mockLogAuditCalls.length = 0;
  });

  it('returns default config when cache is at defaults', async () => {
    const mod = await import('./systemConfig');
    const config = mod.getConfig();
    expect(config.rate_limits.base_posts_per_hour).toBe(4);
    expect(config.rate_limits.base_comments_per_hour).toBe(20);
  });

  it('returns cached config after initConfig populates it', async () => {
    const mod = await import('./systemConfig');
    const doc = {
      ...mod.DEFAULT_CONFIG,
      rate_limits: {
        ...mod.DEFAULT_CONFIG.rate_limits,
        base_posts_per_hour: 8,
      },
    };
    mockFindOne.mockResolvedValue(doc);

    await mod.initConfig();
    const config = mod.getConfig();
    expect(config.rate_limits.base_posts_per_hour).toBe(8);
  });
});

describe('initConfig', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockFindOne.mockReset();
    mockCreate.mockReset();
    mockFindOneAndUpdate.mockReset();
    mockRedisSet.mockReset();
    mockLogAuditCalls.length = 0;
  });

  it('loads from MongoDB when doc exists', async () => {
    const mod = await import('./systemConfig');
    const doc = {
      key: 'global',
      rate_limits: {
        base_posts_per_hour: 6,
        base_comments_per_hour: 30,
        tiers: {
          troll: { multiplier: 0.3, min_posts: 1 },
          neutral: { multiplier: 1.0, min_posts: 4 },
          scholar: { multiplier: 2.0, min_posts: 8 },
        },
        counter_lists_unlimited: false,
        comment_edit_window_minutes: 60,
      },
      trust_tiers: {
        troll_max: 0.4,
        neutral_min: 0.5,
        scholar_min: 1.8,
        hysteresis_enter: 1.9,
        hysteresis_lose: 1.7,
        review_window: 50,
        double_blind: false,
      },
      version: 3,
      updated_at: new Date(),
      updated_by: 'admin1',
    };
    mockFindOne.mockResolvedValue(doc);

    await mod.initConfig();

    expect(mockFindOne).toHaveBeenCalledWith({ key: 'global' });
    expect(mockCreate).not.toHaveBeenCalled();

    const config = mod.getConfig();
    expect(config.rate_limits.base_posts_per_hour).toBe(6);
    expect(config.rate_limits.base_comments_per_hour).toBe(30);
    expect(config.rate_limits.tiers.troll.multiplier).toBe(0.3);
    expect(config.rate_limits.tiers.troll.min_posts).toBe(1);
    expect(config.rate_limits.counter_lists_unlimited).toBe(false);
    expect(config.rate_limits.comment_edit_window_minutes).toBe(60);
    expect(config.trust_tiers.troll_max).toBe(0.4);
    expect(config.trust_tiers.double_blind).toBe(false);
    expect(config.version).toBe(3);
    expect(config.updated_by).toBe('admin1');
  });

  it('creates default doc when none exists in MongoDB', async () => {
    const mod = await import('./systemConfig');
    mockFindOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...mod.DEFAULT_CONFIG, version: 1 });

    await mod.initConfig();

    expect(mockCreate).toHaveBeenCalledWith(mod.DEFAULT_CONFIG);
    expect(mockFindOne).toHaveBeenCalledTimes(2);

    const config = mod.getConfig();
    expect(config.rate_limits.base_posts_per_hour).toBe(4);
  });

  it('falls back to defaults on MongoDB error', async () => {
    const mod = await import('./systemConfig');
    mockFindOne.mockRejectedValue(new Error('connection refused'));

    await mod.initConfig();

    const config = mod.getConfig();
    expect(config.rate_limits.base_posts_per_hour).toBe(4);
    expect(config.version).toBe(1);
  });
});

describe('updateConfig', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockFindOne.mockReset();
    mockCreate.mockReset();
    mockFindOneAndUpdate.mockReset();
    mockRedisSet.mockReset();
    mockLogAuditCalls.length = 0;
  });

  it('updates rate_limits and returns new config', async () => {
    const mod = await import('./systemConfig');
    const newDoc = {
      ...mod.DEFAULT_CONFIG,
      rate_limits: {
        ...mod.DEFAULT_CONFIG.rate_limits,
        base_posts_per_hour: 10,
      },
      version: 2,
      updated_at: new Date(),
      updated_by: 'admin-test',
    };
    mockFindOneAndUpdate.mockResolvedValue(newDoc);

    const result = await mod.updateConfig(
      { rate_limits: { base_posts_per_hour: 10 } },
      'admin-test',
    );

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { key: 'global' },
      expect.objectContaining({
        $set: expect.objectContaining({
          'rate_limits.base_posts_per_hour': 10,
        }),
      }),
      { new: true },
    );

    expect(result.rate_limits.base_posts_per_hour).toBe(10);
    expect(result.version).toBe(2);
  });

  it('updates trust_tiers and returns new config', async () => {
    const mod = await import('./systemConfig');
    const newDoc = {
      ...mod.DEFAULT_CONFIG,
      trust_tiers: {
        ...mod.DEFAULT_CONFIG.trust_tiers,
        scholar_min: 2.0,
      },
      version: 2,
      updated_at: new Date(),
      updated_by: 'admin-test',
    };
    mockFindOneAndUpdate.mockResolvedValue(newDoc);

    const result = await mod.updateConfig(
      { trust_tiers: { scholar_min: 2.0 } },
      'admin-test',
    );

    expect(result.trust_tiers.scholar_min).toBe(2.0);
  });

  it('updates memory cache immediately', async () => {
    const mod = await import('./systemConfig');
    mockFindOneAndUpdate.mockResolvedValue({
      ...mod.DEFAULT_CONFIG,
      rate_limits: {
        ...mod.DEFAULT_CONFIG.rate_limits,
        base_posts_per_hour: 7,
      },
      version: 2,
      updated_at: new Date(),
      updated_by: 'admin-test',
    });

    await mod.updateConfig(
      { rate_limits: { base_posts_per_hour: 7 } },
      'admin-test',
    );

    const cached = mod.getConfig();
    expect(cached.rate_limits.base_posts_per_hour).toBe(7);
  });

  it('writes to Redis cache after update', async () => {
    const mod = await import('./systemConfig');
    mockFindOneAndUpdate.mockResolvedValue({
      ...mod.DEFAULT_CONFIG,
      rate_limits: {
        ...mod.DEFAULT_CONFIG.rate_limits,
        base_posts_per_hour: 5,
      },
      version: 2,
      updated_at: new Date(),
      updated_by: 'admin-test',
    });

    await mod.updateConfig(
      { rate_limits: { base_posts_per_hour: 5 } },
      'admin-test',
    );

    expect(mockRedisSet).toHaveBeenCalled();
    const [key, value] = mockRedisSet.mock.calls[0];
    expect(key).toBe('system:config');
    const parsed = JSON.parse(value);
    expect(parsed.rate_limits.base_posts_per_hour).toBe(5);
  });

  it('logs audit on update', async () => {
    const mod = await import('./systemConfig');
    mockFindOneAndUpdate.mockResolvedValue({
      ...mod.DEFAULT_CONFIG,
      version: 2,
      updated_at: new Date(),
      updated_by: 'admin-audit',
    });

    await mod.updateConfig(
      { rate_limits: { base_posts_per_hour: 3 } },
      'admin-audit',
    );

    expect(mockLogAuditCalls.length).toBeGreaterThanOrEqual(1);
    const auditCall = mockLogAuditCalls[0];
    expect(auditCall.admin_id).toBe('admin-audit');
    expect(auditCall.action).toBe('config_update');
  });

  it('throws when document not found', async () => {
    const mod = await import('./systemConfig');
    mockFindOneAndUpdate.mockResolvedValue(null);

    await expect(
      mod.updateConfig({ rate_limits: { base_posts_per_hour: 1 } }, 'admin'),
    ).rejects.toThrow('SystemConfig document not found');
  });

  it('handles Redis failure gracefully', async () => {
    const mod = await import('./systemConfig');
    mockFindOneAndUpdate.mockResolvedValue({
      ...mod.DEFAULT_CONFIG,
      rate_limits: {
        ...mod.DEFAULT_CONFIG.rate_limits,
        base_posts_per_hour: 6,
      },
      version: 2,
      updated_at: new Date(),
      updated_by: 'admin-test',
    });
    mockRedisSet.mockRejectedValue(new Error('Redis down'));

    const result = await mod.updateConfig(
      { rate_limits: { base_posts_per_hour: 6 } },
      'admin-test',
    );

    expect(result).toBeDefined();
    expect(result.rate_limits.base_posts_per_hour).toBe(6);
  });

  it('updates tier-specific values', async () => {
    const mod = await import('./systemConfig');
    mockFindOneAndUpdate.mockResolvedValue({
      ...mod.DEFAULT_CONFIG,
      rate_limits: {
        ...mod.DEFAULT_CONFIG.rate_limits,
        tiers: {
          troll: { multiplier: 0.1, min_posts: 1 },
          neutral: { multiplier: 1.5, min_posts: 4 },
          scholar: { multiplier: 3.0, min_posts: 8 },
        },
      },
      version: 2,
      updated_at: new Date(),
      updated_by: 'admin-test',
    });

    const result = await mod.updateConfig(
      {
        rate_limits: {
          tiers: {
            troll: { multiplier: 0.1, min_posts: 1 },
            neutral: { multiplier: 1.5 },
            scholar: { multiplier: 3.0 },
          },
        },
      },
      'admin-test',
    );

    expect(result.rate_limits.tiers.troll.multiplier).toBe(0.1);
    expect(result.rate_limits.tiers.troll.min_posts).toBe(1);
    expect(result.rate_limits.tiers.neutral.multiplier).toBe(1.5);
    expect(result.rate_limits.tiers.scholar.multiplier).toBe(3.0);
  });

  it('returns current config when no changes provided', async () => {
    const mod = await import('./systemConfig');
    const result = await mod.updateConfig({}, 'admin-test');
    expect(result).toBe(mod.getConfig());
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('refreshConfig', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockFindOne.mockReset();
    mockCreate.mockReset();
    mockFindOneAndUpdate.mockReset();
    mockRedisSet.mockReset();
    mockLogAuditCalls.length = 0;
  });

  it('refreshes memory cache from MongoDB', async () => {
    const mod = await import('./systemConfig');
    mockFindOne.mockResolvedValue({
      key: 'global',
      rate_limits: {
        ...mod.DEFAULT_CONFIG.rate_limits,
        base_posts_per_hour: 12,
      },
      trust_tiers: mod.DEFAULT_CONFIG.trust_tiers,
      version: 5,
      updated_at: new Date(),
      updated_by: 'cron',
    });

    await mod.refreshConfig();

    const config = mod.getConfig();
    expect(config.rate_limits.base_posts_per_hour).toBe(12);
    expect(config.version).toBe(5);
  });

  it('updates Redis cache during refresh', async () => {
    const mod = await import('./systemConfig');
    mockFindOne.mockResolvedValue({
      ...mod.DEFAULT_CONFIG,
      version: 4,
      updated_at: new Date(),
      updated_by: 'cron',
    });

    await mod.refreshConfig();

    expect(mockRedisSet).toHaveBeenCalled();
    expect(mockRedisSet.mock.calls[0][0]).toBe('system:config');
  });

  it('handles MongoDB error gracefully during refresh', async () => {
    const mod = await import('./systemConfig');
    mockFindOne.mockRejectedValue(new Error('MongoDB down'));

    await mod.refreshConfig();

    const config = mod.getConfig();
    expect(config.rate_limits.base_posts_per_hour).toBe(4);
  });

  it('handles Redis error gracefully during refresh', async () => {
    const mod = await import('./systemConfig');
    mockFindOne.mockResolvedValue({
      ...mod.DEFAULT_CONFIG,
      version: 3,
      updated_at: new Date(),
      updated_by: 'cron',
    });
    mockRedisSet.mockRejectedValue(new Error('Redis down'));

    await mod.refreshConfig();

    const config = mod.getConfig();
    expect(config.version).toBe(3);
  });

  it('does not update cache when MongoDB returns null', async () => {
    const mod = await import('./systemConfig');
    mockFindOne.mockResolvedValue(null);

    await mod.refreshConfig();

    const config = mod.getConfig();
    expect(config.version).toBe(1);
  });
});

describe('config cron', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockFindOne.mockReset();
    mockCreate.mockReset();
    mockFindOneAndUpdate.mockReset();
    mockRedisSet.mockReset();
    mockLogAuditCalls.length = 0;
  });

  it('startConfigCron starts interval that calls refreshConfig', async () => {
    vi.useFakeTimers();
    const mod = await import('./systemConfig');
    mockFindOne.mockResolvedValue({
      ...mod.DEFAULT_CONFIG,
      rate_limits: {
        ...mod.DEFAULT_CONFIG.rate_limits,
        base_posts_per_hour: 9,
      },
      version: 2,
      updated_at: new Date(),
      updated_by: 'cron',
    });

    mod.startConfigCron();
    expect(mockFindOne).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60000);
    expect(mockFindOne).toHaveBeenCalledWith({ key: 'global' });

    const config = mod.getConfig();
    expect(config.rate_limits.base_posts_per_hour).toBe(9);

    mod.stopConfigCron();
    vi.useRealTimers();
  });

  it('stopConfigCron stops the interval', async () => {
    vi.useFakeTimers();
    const mod = await import('./systemConfig');
    mockFindOne.mockResolvedValue({
      ...mod.DEFAULT_CONFIG,
      version: 3,
      updated_at: new Date(),
      updated_by: 'cron',
    });

    mod.startConfigCron();
    await vi.advanceTimersByTimeAsync(60000);
    expect(mockFindOne).toHaveBeenCalledTimes(1);

    mod.stopConfigCron();
    await vi.advanceTimersByTimeAsync(60000 * 5);
    expect(mockFindOne).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('duplicate start does not create multiple intervals', async () => {
    vi.useFakeTimers();
    const mod = await import('./systemConfig');
    mockFindOne.mockResolvedValue({
      ...mod.DEFAULT_CONFIG,
      version: 1,
      updated_at: new Date(),
      updated_by: 'cron',
    });

    mod.startConfigCron();
    mod.startConfigCron();
    await vi.advanceTimersByTimeAsync(60000);
    expect(mockFindOne).toHaveBeenCalledTimes(1);

    mod.stopConfigCron();
    vi.useRealTimers();
  });
});

describe('getConfigVersions', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockFindOne.mockReset();
    mockCreate.mockReset();
    mockFindOneAndUpdate.mockReset();
    mockRedisSet.mockReset();
    mockLogAuditCalls.length = 0;
  });

  it('returns current config in array', async () => {
    const mod = await import('./systemConfig');
    mockFindOne.mockResolvedValue({
      ...mod.DEFAULT_CONFIG,
      version: 5,
      updated_at: new Date(),
      updated_by: 'test',
    });
    await mod.initConfig();

    const versions = mod.getConfigVersions();
    expect(Array.isArray(versions)).toBe(true);
    expect(versions.length).toBe(1);
    expect(versions[0].version).toBe(5);
  });
});
