import { describe, it, expect, vi } from 'vitest';

vi.mock('./systemConfig', () => ({
  getConfig: vi.fn(() => ({
    rate_limits: {
      base_posts_per_hour: 4,
      base_comments_per_hour: 20,
      tiers: {
        troll: { multiplier: 0.5, min_posts: 2 },
        neutral: { multiplier: 1.0, min_posts: 4 },
        scholar: { multiplier: 2.0, min_posts: 8 },
      },
      counter_lists_unlimited: true,
    },
  })),
}));

import { calculateEffectivePostLimit, calculateEffectiveCommentLimit, getRateLimitKey } from '../lib/rateLimit';

describe('RateLimit — NaN guard', () => {
  describe('calculateEffectivePostLimit', () => {
    it('returns minimum when trustScore is NaN', () => {
      expect(calculateEffectivePostLimit(NaN)).toBe(2);
    });

    it('returns minimum when trustScore is Infinity', () => {
      expect(calculateEffectivePostLimit(Infinity)).toBe(2);
    });

    it('returns minimum when trustScore is -Infinity', () => {
      expect(calculateEffectivePostLimit(-Infinity)).toBe(2);
    });

    it('returns expected value for normal trust', () => {
      expect(calculateEffectivePostLimit(1.0)).toBe(4);
    });

    it('returns unlimited for counter lists even with NaN trust', () => {
      expect(calculateEffectivePostLimit(NaN, 'counter_list')).toBe(9999);
    });
  });

  describe('calculateEffectiveCommentLimit', () => {
    it('returns minimum when trustScore is NaN', () => {
      expect(calculateEffectiveCommentLimit(NaN)).toBe(10);
    });
  });

  describe('getRateLimitKey', () => {
    it('generates consistent keys', () => {
      expect(getRateLimitKey('posts', 'fp123')).toBe('rate_limit:posts:fp123');
      expect(getRateLimitKey('comments', 'abc')).toBe('rate_limit:comments:abc');
    });

    it('throws on empty fingerprint', () => {
      expect(() => getRateLimitKey('posts', '')).toThrow('Fingerprint is required');
    });
  });
});
