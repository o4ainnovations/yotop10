import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindChain = vi.fn();
const mockCreate = vi.fn();

vi.mock('../models/FingerprintObservation', () => ({
  FingerprintObservation: {
    find: vi.fn().mockImplementation(() => ({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockFindChain()),
    })),
    create: vi.fn().mockImplementation((data: unknown) => mockCreate(data)),
  },
}));

describe('findMatchingUser', () => {
  let findMatchingUser: (t0: Record<string, unknown>, t1: Record<string, unknown>, t2: Record<string, unknown>) => Promise<string | null>;

  beforeEach(async () => {
    vi.resetModules();
    mockFindChain.mockReset();
    mockCreate.mockReset();
    const mod = await import('../lib/fingerprintMatching');
    findMatchingUser = mod.findMatchingUser;
  });

  const makeObservation = (userId: string, daysAgo: number, overrides: {
    tier0?: Record<string, unknown>;
    tier1?: Record<string, unknown>;
    tier2?: Record<string, unknown>;
  } = {}) => {
    const observed_at = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return {
      user_id: userId,
      fingerprint_hash: 'hash-' + userId,
      observed_at,
      tier0: overrides.tier0 ?? {},
      tier1: overrides.tier1 ?? {},
      tier2: overrides.tier2 ?? {},
    };
  };

  const fullTier0 = {
    screenResolution: '1920x1080',
    colorDepth: 24,
    hardwareConcurrency: 8,
    timezoneOffset: -300,
    platform: 'Win32',
    devicePixelRatio: 2,
    maxTouchPoints: 0,
  };

  const fullTier1 = {
    webglRenderer: 'ANGLE (NVIDIA GeForce RTX 3060)',
    webglVendor: 'Google Inc.',
    audioFingerprint: 124.456,
    cpuCoreCount: 8,
    maxHeapSize: 4294967296,
    canvasHash: 'abc123',
    webglExtensions: 'EXT_texture_filter_anisotropic',
  };

  const fullTier2 = {
    canvasPixelRatio: 2,
    touchSupport: false,
    webglShaderPrecision: 'highp',
    audioSampleRate: 48000,
    localStorageAvailable: true,
    indexedDBAvailable: true,
  };

  it('returns null when no observations exist', async () => {
    mockFindChain.mockResolvedValue([]);
    const result = await findMatchingUser(fullTier0, fullTier1, fullTier2);
    expect(result).toBeNull();
  });

  it('returns null when all observations are older than 90 days', async () => {
    mockFindChain.mockResolvedValue([
      makeObservation('user1', 100, { tier0: fullTier0, tier1: fullTier1, tier2: fullTier2 }),
    ]);
    const result = await findMatchingUser(fullTier0, fullTier1, fullTier2);
    expect(result).toBeNull();
  });

  it('matches via Tier 0 machine-stable signals (cross-browser)', async () => {
    mockFindChain.mockResolvedValue([
      makeObservation('user1', 3, { tier0: fullTier0, tier1: {}, tier2: {} }),
    ]);
    const result = await findMatchingUser(fullTier0, {}, {});
    expect(result).toBe('user1');
  });

  it('rejects Tier 0 match below 0.80 threshold', async () => {
    const fiveOfSeven = {
      screenResolution: '1920x1080',
      colorDepth: 24,
      hardwareConcurrency: 8,
      timezoneOffset: -300,
      platform: 'Win32',
      devicePixelRatio: 2,
      maxTouchPoints: 0,
    };
    const mismatchedTier0 = {
      screenResolution: '1024x768',
      colorDepth: 16,
      hardwareConcurrency: 8,
      timezoneOffset: -300,
      platform: 'Win32',
      devicePixelRatio: 2,
      maxTouchPoints: 0,
    };
    mockFindChain.mockResolvedValue([
      makeObservation('user1', 3, { tier0: mismatchedTier0, tier1: {}, tier2: {} }),
    ]);
    const result = await findMatchingUser(fiveOfSeven, {}, {});
    expect(result).toBeNull();
  });

  it('matches via negative matching (6 out of 7 Tier 0 signals)', async () => {
    const sixOfSeven = {
      screenResolution: '1920x1080',
      colorDepth: 24,
      hardwareConcurrency: 8,
      timezoneOffset: -300,
      platform: 'Win32',
      devicePixelRatio: 2,
      maxTouchPoints: 0,
    };
    const obsSixOfSeven = {
      screenResolution: '1920x1080',
      colorDepth: 24,
      hardwareConcurrency: 8,
      timezoneOffset: -300,
      platform: 'MacIntel',
      devicePixelRatio: 2,
      maxTouchPoints: 0,
    };
    mockFindChain.mockResolvedValue([
      makeObservation('user1', 3, { tier0: obsSixOfSeven, tier1: {}, tier2: {} }),
    ]);
    const result = await findMatchingUser(sixOfSeven, {}, {});
    expect(result).toBe('user1');
  });

  it('does not match via negative matching with only 5 of 7 Tier 0 signals', async () => {
    const fiveOfSeven = {
      screenResolution: '1920x1080',
      colorDepth: 24,
      hardwareConcurrency: 8,
      timezoneOffset: -300,
      platform: 'Win32',
      devicePixelRatio: 2,
      maxTouchPoints: 0,
    };
    const obsFiveOfSeven = {
      screenResolution: '1920x1080',
      colorDepth: 24,
      hardwareConcurrency: 8,
      timezoneOffset: -300,
      platform: 'MacIntel',
      devicePixelRatio: 1.5,
      maxTouchPoints: 0,
    };
    mockFindChain.mockResolvedValue([
      makeObservation('user1', 3, { tier0: obsFiveOfSeven, tier1: {}, tier2: {} }),
    ]);
    const result = await findMatchingUser(fiveOfSeven, {}, {});
    expect(result).toBeNull();
  });

  it('matches via combined Tier 0+1+2 score above 0.90', async () => {
    mockFindChain.mockResolvedValue([
      makeObservation('user1', 3, { tier0: fullTier0, tier1: fullTier1, tier2: fullTier2 }),
    ]);
    const result = await findMatchingUser(fullTier0, fullTier1, fullTier2);
    expect(result).toBe('user1');
  });

  it('rejects combined score below 0.90', async () => {
    const noMatchTier0 = {
      screenResolution: '800x600',
      colorDepth: 16,
      hardwareConcurrency: 1,
      timezoneOffset: 0,
      platform: 'Linux',
      devicePixelRatio: 1,
      maxTouchPoints: 10,
    };
    const noMatchTier1 = {
      webglRenderer: 'unknown',
      webglVendor: 'unknown',
      audioFingerprint: 0,
      cpuCoreCount: 1,
      maxHeapSize: 0,
      canvasHash: 'no',
      webglExtensions: '',
    };
    const noMatchTier2 = {
      canvasPixelRatio: 1,
      touchSupport: true,
      webglShaderPrecision: 'lowp',
      audioSampleRate: 22050,
      localStorageAvailable: false,
      indexedDBAvailable: false,
    };
    mockFindChain.mockResolvedValue([
      makeObservation('user1', 3, { tier0: noMatchTier0, tier1: noMatchTier1, tier2: noMatchTier2 }),
    ]);
    const result = await findMatchingUser(fullTier0, fullTier1, fullTier2);
    expect(result).toBeNull();
  });

  it('applies age decaying weight — observation under 7 days gets full weight', async () => {
    mockFindChain.mockResolvedValue([
      makeObservation('user1', 3, { tier0: fullTier0, tier1: {}, tier2: {} }),
    ]);
    const result = await findMatchingUser(fullTier0, {}, {});
    expect(result).toBe('user1');
  });

  it('applies age decaying weight — observation 7-30 days old has reduced weight causing null even with perfect match', async () => {
    mockFindChain.mockResolvedValue([
      makeObservation('user1', 14, { tier0: fullTier0, tier1: fullTier1, tier2: fullTier2 }),
    ]);
    const result = await findMatchingUser(fullTier0, fullTier1, fullTier2);
    expect(result).toBeNull();
  });

  it('applies age decaying weight — observation 30-90 days old has minimal weight causing null even with perfect match', async () => {
    mockFindChain.mockResolvedValue([
      makeObservation('user1', 45, { tier0: fullTier0, tier1: fullTier1, tier2: fullTier2 }),
    ]);
    const result = await findMatchingUser(fullTier0, fullTier1, fullTier2);
    expect(result).toBeNull();
  });

  it('rejects observation older than 90 days even with perfect signal match', async () => {
    mockFindChain.mockResolvedValue([
      makeObservation('user1', 91, { tier0: fullTier0, tier1: fullTier1, tier2: fullTier2 }),
    ]);
    const result = await findMatchingUser(fullTier0, fullTier1, fullTier2);
    expect(result).toBeNull();
  });

  it('returns the best match when multiple observations exist', async () => {
    const partialTier0 = {
      screenResolution: '1920x1080',
      colorDepth: 24,
      hardwareConcurrency: 8,
      timezoneOffset: -300,
      platform: 'Win32',
      devicePixelRatio: 2,
      maxTouchPoints: 0,
    };
    mockFindChain.mockResolvedValue([
      makeObservation('user_fresh', 2, { tier0: fullTier0, tier1: fullTier1, tier2: fullTier2 }),
      makeObservation('user_old', 60, { tier0: fullTier0, tier1: fullTier1, tier2: fullTier2 }),
      makeObservation('user_unrelated', 3, { tier0: partialTier0, tier1: {}, tier2: {} }),
    ]);
    const result = await findMatchingUser(fullTier0, fullTier1, fullTier2);
    expect(result).toBe('user_fresh');
  });

  it('handles empty signal objects gracefully', async () => {
    mockFindChain.mockResolvedValue([]);
    const result = await findMatchingUser({}, {}, {});
    expect(result).toBeNull();
  });

  it('handles partial signal overlap for Tier 1 and Tier 2', async () => {
    const partialTier1 = {
      webglRenderer: 'ANGLE (NVIDIA GeForce RTX 3060)',
      webglVendor: 'Google Inc.',
    };
    const partialTier2 = {
      canvasPixelRatio: 2,
    };
    mockFindChain.mockResolvedValue([
      makeObservation('user1', 2, { tier0: fullTier0, tier1: fullTier1, tier2: fullTier2 }),
    ]);
    const result = await findMatchingUser(fullTier0, partialTier1, partialTier2);
    expect(result).toBe('user1');
  });
});

describe('storeFingerprintObservation', () => {
  let storeFingerprintObservation: (
    userId: string, fingerprintHash: string,
    tier0: Record<string, unknown>, tier1: Record<string, unknown>, tier2: Record<string, unknown>
  ) => Promise<void>;

  beforeEach(async () => {
    vi.resetModules();
    mockFindChain.mockReset();
    mockCreate.mockReset();
    const mod = await import('../lib/fingerprintMatching');
    storeFingerprintObservation = mod.storeFingerprintObservation;
  });

  it('creates an observation record', async () => {
    mockCreate.mockResolvedValue({ _id: 'obs1' });
    await storeFingerprintObservation('user123', 'fingerprintHash', { platform: 'Win32' }, { webglRenderer: 'ANGLE' }, { touchSupport: false });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.user_id).toBe('user123');
    expect(callArg.fingerprint_hash).toBe('fingerprintHash');
    expect(callArg.tier0).toEqual({ platform: 'Win32' });
    expect(callArg.tier1).toEqual({ webglRenderer: 'ANGLE' });
    expect(callArg.tier2).toEqual({ touchSupport: false });
    expect(callArg.observed_at).toBeInstanceOf(Date);
  });
});
