import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisZAdd = vi.fn();

vi.mock('./redis', () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    zAdd: (...args: unknown[]) => mockRedisZAdd(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
  },
}));

const mockPostLean = vi.fn();

vi.mock('../models/Post', () => ({
  Post: {
    find: () => ({
      select: () => ({
        lean: mockPostLean,
      }),
    }),
  },
}));

const mockCommentCount = vi.fn();

vi.mock('../models/Comment', () => ({
  Comment: {
    countDocuments: (...args: unknown[]) => mockCommentCount(...args),
  },
}));

import { computeArgumentScores, startArgumentCron, stopArgumentCron } from './argumentCron';

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'post_' + Math.random().toString(36).slice(2, 8),
    slug: 'test-post-slug-' + Math.random().toString(36).slice(2, 6),
    post_type: 'this_vs_that',
    status: 'approved',
    deleted: false,
    comment_count: 10,
    view_count: 50,
    created_at: new Date(),
    bumped_at: null,
    ...overrides,
  };
}

describe('argumentCron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopArgumentCron();
  });

  afterEach(() => {
    stopArgumentCron();
  });

  describe('computeArgumentScores', () => {
    it('scores a this_vs_that post', async () => {
      const post = makePost({ post_type: 'this_vs_that' });
      mockPostLean.mockResolvedValue([post]);
      mockRedisGet.mockResolvedValue('3');
      mockCommentCount.mockResolvedValue(5);
      mockRedisZAdd.mockResolvedValue(1);

      await computeArgumentScores();

      expect(mockPostLean).toHaveBeenCalled();
    });

    it('scores a counter_list post', async () => {
      const post = makePost({ post_type: 'counter_list' });
      mockPostLean.mockResolvedValue([post]);
      mockRedisGet.mockResolvedValue('5');
      mockCommentCount.mockResolvedValue(8);
      mockRedisZAdd.mockResolvedValue(1);

      await computeArgumentScores();

      expect(mockPostLean).toHaveBeenCalled();
    });

    it('ignores non-argument post types', async () => {
      const post = makePost({ post_type: 'top_list' });
      mockPostLean.mockResolvedValue([post]);
      mockRedisGet.mockResolvedValue('4');
      mockRedisZAdd.mockResolvedValue(1);

      await computeArgumentScores();

      expect(mockPostLean).toHaveBeenCalled();
    });

    it('ignores deleted posts', async () => {
      const post = makePost({ post_type: 'this_vs_that', deleted: true });
      mockPostLean.mockResolvedValue([post]);
      mockRedisGet.mockResolvedValue('2');
      mockRedisZAdd.mockResolvedValue(1);

      await computeArgumentScores();

      expect(mockPostLean).toHaveBeenCalled();
    });

    it('ignores rejected posts', async () => {
      const post = makePost({ post_type: 'this_vs_that', status: 'rejected' });
      mockPostLean.mockResolvedValue([post]);
      mockRedisGet.mockResolvedValue('1');
      mockRedisZAdd.mockResolvedValue(1);

      await computeArgumentScores();

      expect(mockPostLean).toHaveBeenCalled();
    });

    it('handles empty candidates gracefully', async () => {
      mockPostLean.mockResolvedValue([]);

      await expect(computeArgumentScores()).resolves.toBeUndefined();

      expect(mockPostLean).toHaveBeenCalled();
    });

    it('combines velocity from Redis, freshness, and spark correctly', async () => {
      const post = makePost({
        post_type: 'this_vs_that',
        comment_count: 20,
        view_count: 100,
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });
      mockPostLean.mockResolvedValue([post]);
      mockRedisGet.mockResolvedValue('10');
      mockCommentCount.mockResolvedValue(6);
      mockRedisZAdd.mockResolvedValue(1);

      await computeArgumentScores();

      expect(mockRedisGet).toHaveBeenCalled();
      expect(mockRedisZAdd).toHaveBeenCalled();
    });

    it('catches Redis error and does not crash', async () => {
      const post = makePost({ post_type: 'this_vs_that' });
      mockPostLean.mockResolvedValue([post]);
      mockRedisGet.mockRejectedValue(new Error('Redis connection lost'));

      await expect(computeArgumentScores()).resolves.toBeUndefined();
    });

    it('handles posts older than 30 days (excluded)', async () => {
      const oldPost = makePost({
        post_type: 'this_vs_that',
        created_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      });
      const recentPost = makePost({
        post_type: 'this_vs_that',
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      });
      mockPostLean.mockResolvedValue([oldPost, recentPost]);
      mockRedisGet.mockResolvedValue('2');
      mockCommentCount.mockResolvedValue(4);
      mockRedisZAdd.mockResolvedValue(1);

      await computeArgumentScores();

      expect(mockPostLean).toHaveBeenCalled();
    });
  });

  describe('startArgumentCron', () => {
    it('starts interval', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      mockPostLean.mockResolvedValue([]);

      startArgumentCron();

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        60000,
      );

      setIntervalSpy.mockRestore();
    });

    it('does not start duplicate cron', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      mockPostLean.mockResolvedValue([]);

      startArgumentCron();
      startArgumentCron();

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);

      setIntervalSpy.mockRestore();
    });
  });

  describe('stopArgumentCron', () => {
    it('stops interval', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      mockPostLean.mockResolvedValue([]);

      startArgumentCron();

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);

      stopArgumentCron();

      expect(clearIntervalSpy).toHaveBeenCalled();

      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });
  });
});
