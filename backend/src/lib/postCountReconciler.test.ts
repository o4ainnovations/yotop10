import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockAggregate = vi.fn();
const mockFind = vi.fn();
const mockLean = vi.fn();
const mockBulkFind = vi.fn();
const mockUpdateOne = vi.fn();
const mockBulkExecute = vi.fn();
const mockInitializeBulkOp = vi.fn();

vi.mock('../models/Post', () => ({
  Post: {
    aggregate: (...args: unknown[]) => mockAggregate(...args),
  },
}));

vi.mock('../models/Category', () => ({
  Category: {
    find: (...args: unknown[]) => {
      const result = mockFind(...args);
      return { lean: () => mockLean() || result };
    },
    collection: {
      initializeUnorderedBulkOp: () => mockInitializeBulkOp(),
    },
  },
}));

import { reconcilePostCounts, startPostCountCron, stopPostCountCron } from '../lib/postCountReconciler';

describe('postCountReconciler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockBulkFind.mockReturnValue({ updateOne: mockUpdateOne });
    mockInitializeBulkOp.mockReturnValue({
      find: mockBulkFind,
      execute: mockBulkExecute.mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    stopPostCountCron();
    vi.useRealTimers();
  });

  describe('reconcilePostCounts', () => {
    it('returns updated: 0 when all counts match', async () => {
      mockAggregate.mockResolvedValue([
        { _id: 'movies', count: 5 },
        { _id: 'games', count: 3 },
      ]);
      mockFind.mockReturnValue([
        { slug: 'movies', post_count: 5 },
        { slug: 'games', post_count: 3 },
      ]);
      mockLean.mockReturnValue([
        { slug: 'movies', post_count: 5 },
        { slug: 'games', post_count: 3 },
      ]);

      const result = await reconcilePostCounts();

      expect(result).toEqual({ updated: 0 });
      expect(mockBulkExecute).not.toHaveBeenCalled();
    });

    it('corrects mismatched counts and returns updated count', async () => {
      mockAggregate.mockResolvedValue([
        { _id: 'movies', count: 10 },
        { _id: 'games', count: 3 },
      ]);
      mockFind.mockReturnValue([
        { slug: 'movies', post_count: 5 },
        { slug: 'games', post_count: 3 },
      ]);
      mockLean.mockReturnValue([
        { slug: 'movies', post_count: 5 },
        { slug: 'games', post_count: 3 },
      ]);

      const result = await reconcilePostCounts();

      expect(result).toEqual({ updated: 1 });
      expect(mockBulkFind).toHaveBeenCalledWith({ slug: 'movies' });
      expect(mockUpdateOne).toHaveBeenCalledWith({ $set: { post_count: 10 } });
      expect(mockBulkExecute).toHaveBeenCalledTimes(1);
    });

    it('handles categories with no approved posts (sets count to 0)', async () => {
      mockAggregate.mockResolvedValue([
        { _id: 'movies', count: 5 },
      ]);
      mockFind.mockReturnValue([
        { slug: 'movies', post_count: 5 },
        { slug: 'music', post_count: 2 },
      ]);
      mockLean.mockReturnValue([
        { slug: 'movies', post_count: 5 },
        { slug: 'music', post_count: 2 },
      ]);

      const result = await reconcilePostCounts();

      expect(result).toEqual({ updated: 1 });
      expect(mockBulkFind).toHaveBeenCalledWith({ slug: 'music' });
      expect(mockUpdateOne).toHaveBeenCalledWith({ $set: { post_count: 0 } });
    });

    it('handles empty aggregate result (no approved posts at all)', async () => {
      mockAggregate.mockResolvedValue([]);
      mockFind.mockReturnValue([
        { slug: 'movies', post_count: 4 },
        { slug: 'music', post_count: 0 },
      ]);
      mockLean.mockReturnValue([
        { slug: 'movies', post_count: 4 },
        { slug: 'music', post_count: 0 },
      ]);

      const result = await reconcilePostCounts();

      expect(result).toEqual({ updated: 1 });
      expect(mockBulkFind).toHaveBeenCalledWith({ slug: 'movies' });
      expect(mockUpdateOne).toHaveBeenCalledWith({ $set: { post_count: 0 } });
    });

    it('handles empty categories list', async () => {
      mockAggregate.mockResolvedValue([
        { _id: 'movies', count: 5 },
      ]);
      mockFind.mockReturnValue([]);
      mockLean.mockReturnValue([]);

      const result = await reconcilePostCounts();

      expect(result).toEqual({ updated: 0 });
      expect(mockBulkExecute).not.toHaveBeenCalled();
    });

    it('corrects multiple mismatched categories at once', async () => {
      mockAggregate.mockResolvedValue([
        { _id: 'movies', count: 10 },
        { _id: 'games', count: 7 },
        { _id: 'music', count: 2 },
      ]);
      mockFind.mockReturnValue([
        { slug: 'movies', post_count: 5 },
        { slug: 'games', post_count: 7 },
        { slug: 'music', post_count: 0 },
        { slug: 'books', post_count: 3 },
      ]);
      mockLean.mockReturnValue([
        { slug: 'movies', post_count: 5 },
        { slug: 'games', post_count: 7 },
        { slug: 'music', post_count: 0 },
        { slug: 'books', post_count: 3 },
      ]);

      const result = await reconcilePostCounts();

      expect(result).toEqual({ updated: 3 });
      expect(mockBulkExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('startPostCountCron', () => {
    it('starts the cron and calls reconcilePostCounts immediately', async () => {
      mockAggregate.mockResolvedValue([]);
      mockFind.mockReturnValue([]);
      mockLean.mockReturnValue([]);

      startPostCountCron();

      await vi.advanceTimersByTimeAsync(0);

      expect(mockAggregate).toHaveBeenCalled();

      stopPostCountCron();
    });

    it('does not start a second cron if one is already running', () => {
      mockAggregate.mockResolvedValue([]);
      mockFind.mockReturnValue([]);
      mockLean.mockReturnValue([]);

      startPostCountCron();
      startPostCountCron();

      expect(mockAggregate).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopPostCountCron', () => {
    it('stops a running cron', () => {
      mockAggregate.mockResolvedValue([]);
      mockFind.mockReturnValue([]);
      mockLean.mockReturnValue([]);

      startPostCountCron();
      stopPostCountCron();

      const callCountBefore = mockAggregate.mock.calls.length;
      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(mockAggregate).toHaveBeenCalledTimes(callCountBefore);
    });

    it('is safe to call when no cron is running', () => {
      expect(() => stopPostCountCron()).not.toThrow();
    });
  });
});
