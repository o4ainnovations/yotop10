import { describe, it, expect, vi } from 'vitest';

vi.mock('./systemConfig', () => ({
  getConfig: vi.fn(() => ({
    rate_limits: {
      base_posts_per_hour: 4,
      base_comments_per_hour: 20,
      tiers: {
        ghost: { multiplier: 0.1, min_posts: 1 },
        newbie: { multiplier: 0.25, min_posts: 1 },
        troll: { multiplier: 0.5, min_posts: 2 },
        neutral: { multiplier: 1.0, min_posts: 4 },
        scholar: { multiplier: 2.0, min_posts: 8 },
      },
      counter_lists_unlimited: true,
    },
    trust_tiers: {
      troll_max: 0.49,
    },
  })),
}));

import { calculateEffectivePostLimit, calculateEffectiveCommentLimit } from '../lib/rateLimit';

describe('RateLimit calculations', () => {
  describe('calculateEffectivePostLimit', () => {
    it('guarantees minimum 2 posts for trolls', () => {
      expect(calculateEffectivePostLimit(0.1)).toBe(2);
      expect(calculateEffectivePostLimit(0.01)).toBe(2);
    });

    it('returns base limit for neutral users', () => {
      expect(calculateEffectivePostLimit(1.0)).toBe(4);
    });

    it('scales up for scholars', () => {
      expect(calculateEffectivePostLimit(2.0)).toBe(8);
    });

    it('counter lists are unlimited', () => {
      expect(calculateEffectivePostLimit(0.1, 'counter_list')).toBe(9999);
      expect(calculateEffectivePostLimit(2.0, 'counter_list')).toBe(9999);
    });

    it('soft gradient for trust between 0.1 and 1.0', () => {
      const min = calculateEffectivePostLimit(0.1);
      const mid = calculateEffectivePostLimit(0.5);
      const max = calculateEffectivePostLimit(0.9);
      expect(min).toBeLessThanOrEqual(mid);
      expect(mid).toBeLessThanOrEqual(max);
    });
  });

  describe('calculateEffectiveCommentLimit', () => {
    it('guarantees minimum 10 comments for trolls', () => {
      expect(calculateEffectiveCommentLimit(0.001)).toBe(10);
    });

    it('returns base limit for neutral users', () => {
      expect(calculateEffectiveCommentLimit(1.0)).toBe(20);
    });

    it('scales up for scholars', () => {
      expect(calculateEffectiveCommentLimit(2.0)).toBe(40);
    });
  });
});
