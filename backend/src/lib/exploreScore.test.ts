import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockRedisGet = vi.fn();
const mockRedisIncr = vi.fn();
const mockRedisExpire = vi.fn();

vi.mock('../lib/redis', () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    incr: (...args: unknown[]) => mockRedisIncr(...args),
    expire: (...args: unknown[]) => mockRedisExpire(...args),
  },
}));

import { computeExploreScore, trackExploreView, type ExploreSignals } from '../lib/exploreScore';

const ONE_HOUR = 3600000;
const NOW = Date.now();

function makeSignals(overrides: Partial<{
  published_at: Date;
  comment_count: number;
  view_count: number;
  bookmark_count: number;
  author_trust_score: number;
  category_slug: string;
  bumped_at: Date | null;
}> = {}): ExploreSignals {
  return {
    published_at: new Date(NOW - ONE_HOUR),
    comment_count: 0,
    view_count: 0,
    bookmark_count: 0,
    author_trust_score: 1.0,
    category_slug: 'general',
    bumped_at: null,
    ...overrides,
  };
}

describe('computeExploreScore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('high engagement post scores higher than low engagement', async () => {
    const highEngagement = await computeExploreScore('post1', makeSignals({
      comment_count: 5,
      view_count: 100,
      bookmark_count: 3,
    }), []);

    const lowEngagement = await computeExploreScore('post2', makeSignals({
      comment_count: 0,
      view_count: 1,
      bookmark_count: 0,
    }), []);

    expect(highEngagement.score).toBeGreaterThan(lowEngagement.score);
    expect(highEngagement.engagement_score).toBeGreaterThan(lowEngagement.engagement_score);
  });

  it('recent post scores higher than old post', async () => {
    const recent = await computeExploreScore('post1', makeSignals({
      published_at: new Date(NOW - 2 * ONE_HOUR),
      comment_count: 5,
      view_count: 50,
      bookmark_count: 2,
    }), []);

    const old = await computeExploreScore('post2', makeSignals({
      published_at: new Date(NOW - 72 * ONE_HOUR),
      comment_count: 5,
      view_count: 50,
      bookmark_count: 2,
    }), []);

    expect(recent.score).toBeGreaterThan(old.score);
    expect(recent.recency_score).toBeGreaterThan(old.recency_score);
    expect(recent.engagement_score).toBeGreaterThan(old.engagement_score);
  });

  it('scholar author scores higher than troll author', async () => {
    const scholar = await computeExploreScore('post1', makeSignals({
      author_trust_score: 1.9,
      comment_count: 2,
      view_count: 10,
    }), []);

    const troll = await computeExploreScore('post2', makeSignals({
      author_trust_score: 0.3,
      comment_count: 2,
      view_count: 10,
    }), []);

    expect(scholar.score).toBeGreaterThan(troll.score);
    expect(scholar.authority_score).toBe(2.0);
    expect(troll.authority_score).toBe(0.1);
  });

  it('posts in diverse categories score higher when user has viewed others', async () => {
    const baseSignals = makeSignals({ comment_count: 2, view_count: 10 });

    const viewed = await computeExploreScore('post1', {
      ...baseSignals,
      category_slug: 'tech',
    }, ['science', 'music', 'sports']);

    const same = await computeExploreScore('post2', {
      ...baseSignals,
      category_slug: 'tech',
    }, ['tech', 'science']);

    const parent = await computeExploreScore('post3', {
      ...baseSignals,
      category_slug: 'tech/web',
    }, ['tech', 'science']);

    expect(viewed.diversity_score).toBe(1.0);
    expect(same.diversity_score).toBe(0.3);
    expect(parent.diversity_score).toBe(0.6);
    expect(viewed.score).toBeGreaterThan(same.score);
  });

  it('bumped post scores higher than non-bumped', async () => {
    const bumped = await computeExploreScore('post1', makeSignals({
      published_at: new Date(NOW - 72 * ONE_HOUR),
      bumped_at: new Date(NOW - 2 * ONE_HOUR),
      comment_count: 2,
      view_count: 10,
    }), []);

    const notBumped = await computeExploreScore('post2', makeSignals({
      published_at: new Date(NOW - 72 * ONE_HOUR),
      bumped_at: null,
      comment_count: 2,
      view_count: 10,
    }), []);

    expect(bumped.score).toBeGreaterThan(notBumped.score);
    expect(bumped.recency_score).toBeGreaterThan(notBumped.recency_score);
  });

  it('handles zero engagement signals', async () => {
    const result = await computeExploreScore('post1', makeSignals({
      comment_count: 0,
      view_count: 0,
      bookmark_count: 0,
    }), []);

    expect(result.engagement_score).toBe(0);
    expect(result.score).toBeGreaterThan(0);
  });

  it('handles zero velocity views (no Redis key)', async () => {
    mockRedisGet.mockResolvedValue(null);

    const result = await computeExploreScore('post1', makeSignals({ comment_count: 1, view_count: 5 }), []);

    expect(result.velocity_score).toBe(0);
    expect(mockRedisGet).toHaveBeenCalledWith('explore:velocity:post1');
  });

  it('velocity score reflects Redis view count', async () => {
    mockRedisGet.mockResolvedValue('7');

    const result = await computeExploreScore('post1', makeSignals({ comment_count: 1, view_count: 5 }), []);

    expect(result.velocity_score).toBe(Math.log1p(7));
  });

  it('new post (less than 1 hour old) floors engagement at 1 hour', async () => {
    const fresh = await computeExploreScore('post1', makeSignals({
      published_at: new Date(NOW - 30 * 60000),
      comment_count: 3,
      view_count: 20,
      bookmark_count: 1,
    }), []);

    // engagement = (3*3 + 20*0.5 + 1*5) / max(1, 0.5) = 24 / 1 = 24
    expect(fresh.engagement_score).toBe(24);
  });

  it('recency_score decays correctly: 24h yields ~0.5', async () => {
    const result = await computeExploreScore('post1', makeSignals({
      published_at: new Date(NOW - 24 * ONE_HOUR),
      comment_count: 0,
      view_count: 0,
    }), []);

    expect(result.recency_score).toBe(0.5);
  });

  it('recency_score decays correctly: 48h yields 0.25', async () => {
    const result = await computeExploreScore('post1', makeSignals({
      published_at: new Date(NOW - 48 * ONE_HOUR),
      comment_count: 0,
      view_count: 0,
    }), []);

    expect(result.recency_score).toBe(0.25);
  });

  it('authority_score: scholar=2.0, neutral=1.0, troll=0.1', async () => {
    const scholar = await computeExploreScore('p1', makeSignals({ author_trust_score: 2.0, comment_count: 0 }), []);
    const neutral = await computeExploreScore('p2', makeSignals({ author_trust_score: 1.0, comment_count: 0 }), []);
    const low = await computeExploreScore('p3', makeSignals({ author_trust_score: 0.5, comment_count: 0 }), []);
    const troll = await computeExploreScore('p4', makeSignals({ author_trust_score: 0.0, comment_count: 0 }), []);

    expect(scholar.authority_score).toBe(2.0);
    expect(neutral.authority_score).toBe(1.0);
    expect(low.authority_score).toBe(0.5);
    expect(troll.authority_score).toBe(0.1);
  });

  it('diversity_score: exact match=0.3, parent match=0.6, no match=1.0, empty=1.0', async () => {
    const exact = await computeExploreScore('p1', makeSignals({ category_slug: 'science', comment_count: 0 }), ['science', 'tech']);
    const parent = await computeExploreScore('p2', makeSignals({ category_slug: 'science/biology', comment_count: 0 }), ['science', 'tech']);
    const none = await computeExploreScore('p3', makeSignals({ category_slug: 'music', comment_count: 0 }), ['science', 'tech']);
    const empty = await computeExploreScore('p4', makeSignals({ category_slug: 'science', comment_count: 0 }), []);

    expect(exact.diversity_score).toBe(0.3);
    expect(parent.diversity_score).toBe(0.6);
    expect(none.diversity_score).toBe(1.0);
    expect(empty.diversity_score).toBe(1.0);
  });

  it('engagement_score uses correct weighting: 3x comments + 0.5x views + 5x bookmarks', async () => {
    const result = await computeExploreScore('post1', makeSignals({
      published_at: new Date(NOW - 2 * ONE_HOUR),
      comment_count: 4,
      view_count: 10,
      bookmark_count: 2,
    }), []);

    // weighted = 4*3 + 10*0.5 + 2*5 = 12 + 5 + 10 = 27
    // hoursSince = 2
    // engagement_score = 27 / 2 = 13.5
    expect(result.engagement_score).toBe(13.5);
  });

  it('score is capped: min(engagement/20, 1) prevents runaway influence', async () => {
    const result = await computeExploreScore('post1', makeSignals({
      published_at: new Date(NOW - ONE_HOUR),
      comment_count: 100,
      view_count: 1000,
      bookmark_count: 50,
    }), []);

    // weighted = 300 + 500 + 250 = 1050, hoursSince = 1, engagement = 1050
    // engagement component = min(1050/20, 1) = 1
    // The 0.25 weight means engagement can't exceed 0.25 in final score
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.engagement_score).toBeGreaterThan(20);
  });
});

describe('trackExploreView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('increments Redis counter and sets 1-hour expiry', async () => {
    mockRedisIncr.mockResolvedValue(1);
    mockRedisExpire.mockResolvedValue(true);

    await trackExploreView('post123');

    expect(mockRedisIncr).toHaveBeenCalledWith('explore:velocity:post123');
    expect(mockRedisExpire).toHaveBeenCalledWith('explore:velocity:post123', 3600);
  });

  it('silently catches Redis errors without throwing', async () => {
    mockRedisIncr.mockRejectedValue(new Error('Redis connection refused'));

    await expect(trackExploreView('post123')).resolves.not.toThrow();
  });
});
