import { describe, it, expect } from 'vitest';
import { computeSparkScore, computeParentSparkScore, getPercentileValue } from '../lib/sparkScore';
import { SparkThreshold } from '../models/SparkThreshold';

function makeThresholds(overrides: Partial<InstanceType<typeof SparkThreshold>> = {}) {
  return new SparkThreshold({
    percentile_99: overrides.percentile_99 ?? 50,
    percentile_95: overrides.percentile_95 ?? 30,
    percentile_85: overrides.percentile_85 ?? 15,
    percentile_70: overrides.percentile_70 ?? 8,
    calculated_at: overrides.calculated_at ?? new Date(),
  });
}

describe('SparkScore', () => {
  describe('getPercentileValue', () => {
    it('returns 0 for empty array', () => {
      expect(getPercentileValue([], 50)).toBe(0);
    });

    it('calculates median from sorted values', () => {
      const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(getPercentileValue(sorted, 50)).toBe(5);
    });

    it('calculates 99th percentile', () => {
      const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(getPercentileValue(sorted, 99)).toBe(99);
    });
  });

  describe('computeSparkScore', () => {
    const thresholds = makeThresholds();
    const now = new Date();

    it('returns positive score for new comment', () => {
      const score = computeSparkScore(
        { fireCount: 0, replyCount: 0, createdAt: now },
        thresholds,
      );
      expect(score).toBeGreaterThan(0);
    });

    it('increases with fires', () => {
      const withoutFire = computeSparkScore(
        { fireCount: 0, replyCount: 0, createdAt: now },
        thresholds,
      );
      const withFire = computeSparkScore(
        { fireCount: 5, replyCount: 0, createdAt: now },
        thresholds,
      );
      expect(withFire).toBeGreaterThan(withoutFire);
    });

    it('increases with replies', () => {
      const withoutReply = computeSparkScore(
        { fireCount: 0, replyCount: 0, createdAt: now },
        thresholds,
      );
      const withReply = computeSparkScore(
        { fireCount: 0, replyCount: 3, createdAt: now },
        thresholds,
      );
      expect(withReply).toBeGreaterThan(withoutReply);
    });

    it('decays with age', () => {
      const recent = computeSparkScore(
        { fireCount: 0, replyCount: 0, createdAt: now },
        thresholds,
      );
      const old = computeSparkScore(
        { fireCount: 0, replyCount: 0, createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000) },
        thresholds,
      );
      expect(recent).toBeGreaterThan(old);
    });

    it('never goes below 0', () => {
      const score = computeSparkScore(
        { fireCount: 0, replyCount: 0, createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
        thresholds,
      );
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('computeParentSparkScore', () => {
    const thresholds = makeThresholds();
    const now = new Date();

    it('includes child contributions', () => {
      const withoutChildren = computeParentSparkScore(
        { fireCount: 0, replyCount: 0, createdAt: now, childFires: 0, childReplies: 0 },
        thresholds,
      );
      const withChildren = computeParentSparkScore(
        { fireCount: 0, replyCount: 0, createdAt: now, childFires: 5, childReplies: 3 },
        thresholds,
      );
      expect(withChildren).toBeGreaterThan(withoutChildren);
    });

    it('child replies weighted more than child fires', () => {
      const withFires = computeParentSparkScore(
        { fireCount: 0, replyCount: 0, createdAt: now, childFires: 10, childReplies: 0 },
        thresholds,
      );
      const withReplies = computeParentSparkScore(
        { fireCount: 0, replyCount: 0, createdAt: now, childFires: 0, childReplies: 10 },
        thresholds,
      );
      expect(withReplies).toBeGreaterThan(withFires);
    });
  });
});
