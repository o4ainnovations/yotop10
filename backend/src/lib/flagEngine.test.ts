import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runFlagDetection, startFlagCron, stopFlagCron } from '../lib/flagEngine';

type MockDoc = Record<string, unknown>;

vi.mock('../models/Comment', () => ({
  Comment: {
    find: vi.fn(),
    aggregate: vi.fn(),
    updateMany: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock('../models/User', () => ({
  User: {
    find: vi.fn(),
  },
}));

import { Comment } from '../models/Comment';
import { User } from '../models/User';

function mockCommentFind(comments: Array<Record<string, unknown>>) {
  const mockQuery: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(comments),
  };
  vi.mocked(Comment.find).mockReturnValue(mockQuery as unknown as MockDoc);
}

function mockAggregate(results: unknown[][]) {
  let callIndex = 0;
  vi.mocked(Comment.aggregate).mockImplementation(async () => {
    const result = results[callIndex] ?? [];
    callIndex++;
    return result;
  });
}

function mockUserFind(users: Array<Record<string, unknown>>) {
  const mockQuery: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(users),
  };
  vi.mocked(User.find).mockReturnValue(mockQuery as unknown as MockDoc);
}

describe('flagEngine', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('runFlagDetection', () => {
    it('handles empty comment set without errors', async () => {
      mockCommentFind([]);
      mockAggregate([[], [], []]);
      mockUserFind([]);

      await expect(runFlagDetection()).resolves.not.toThrow();
    });

    it('does not flag single comments as spam repetition', async () => {
      mockCommentFind([
        { author_id: 'u1', content: 'hello world', _id: 'c1', post_id: 'p1' },
      ]);
      mockAggregate([[], [], []]);
      mockUserFind([]);

      await runFlagDetection();

      const spamCalls = vi.mocked(Comment.updateMany).mock.calls.filter(
        (call: unknown[]) => (call[1] as MockDoc)?.$set && (call[1] as MockDoc).$set.flag_type === 'spam_repetition'
      );
      expect(spamCalls.length).toBe(0);
    });

    it('flags duplicate comments as spam_repetition', async () => {
      mockCommentFind([
        { author_id: 'u1', content: 'great post!', _id: 'c1', post_id: 'p1' },
        { author_id: 'u1', content: 'Great post!', _id: 'c2', post_id: 'p2' },
        { author_id: 'u1', content: 'Great post', _id: 'c3', post_id: 'p3' },
      ]);
      mockAggregate([[], [], []]);
      mockUserFind([]);

      await runFlagDetection();

      const spamCalls = vi.mocked(Comment.updateMany).mock.calls.filter(
        (call: unknown[]) => (call[1] as MockDoc)?.$set && (call[1] as MockDoc).$set.flag_type === 'spam_repetition'
      );
      expect(spamCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag unrelated comments from different users', async () => {
      mockCommentFind([
        { author_id: 'u1', content: 'nice', _id: 'c1', post_id: 'p1' },
        { author_id: 'u2', content: 'nice', _id: 'c2', post_id: 'p2' },
      ]);
      mockAggregate([[], [], []]);
      mockUserFind([]);

      await runFlagDetection();

      const spamCalls = vi.mocked(Comment.updateMany).mock.calls.filter(
        (call: unknown[]) => (call[1] as MockDoc)?.$set && (call[1] as MockDoc).$set.flag_type === 'spam_repetition'
      );
      expect(spamCalls.length).toBe(0);
    });

    it('handles link-first comment detection', async () => {
      mockCommentFind([]);
      mockAggregate([
        [
          {
            _id: { author_id: 'u1', first: { _id: 'c100', content: 'https://example.com check this out' } },
            first: { _id: 'c100', content: 'https://example.com check this out' },
          },
        ],
        [],
        [],
      ]);
      mockUserFind([]);

      vi.mocked(Comment.findByIdAndUpdate).mockResolvedValue({} as unknown as MockDoc);

      await runFlagDetection();

      expect(Comment.findByIdAndUpdate).toHaveBeenCalledWith(
        'c100',
        expect.objectContaining({
          $set: expect.objectContaining({ flag_type: 'spam_link_first' }),
        }),
      );
    });

    it('does not flag link-first when pipeline returns empty', async () => {
      mockCommentFind([]);
      mockAggregate([[], [], []]);
      mockUserFind([]);

      await runFlagDetection();

      expect(Comment.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('handles brigade_referrer detection', async () => {
      mockCommentFind([]);
      mockAggregate([
        [],
        [
          {
            _id: { post_id: 'p1', referer: 'https://external.com' },
            commenters: ['c1', 'c2', 'c3', 'c4', 'c5'],
            count: 5,
          },
        ],
        [],
      ]);
      mockUserFind([]);

      await runFlagDetection();

      expect(Comment.updateMany).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          $set: expect.objectContaining({ flag_type: 'brigade_referrer' }),
        }),
      );
    });

    it('handles brigade_fresh detection with high fresh user ratio', async () => {
      const freshUserIds = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];
      mockCommentFind([]);
      mockAggregate([
        [],
        [],
        [
          {
            _id: 'p1',
            commenters: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'old1', 'old2'],
            total: 10,
            ids: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'],
          },
        ],
      ]);
      mockUserFind(freshUserIds.map((id) => ({ user_id: id })));

      await runFlagDetection();

      expect(Comment.updateMany).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          $set: expect.objectContaining({ flag_type: 'brigade_fresh' }),
        }),
      );
    });

    it('does not flag brigade_fresh with low fresh user ratio', async () => {
      const freshUserIds = ['f1', 'f2'];
      mockCommentFind([]);
      mockAggregate([
        [],
        [],
        [
          {
            _id: 'p1',
            commenters: ['f1', 'f2', 'old1', 'old2', 'old3', 'old4', 'old5', 'old6'],
            total: 8,
            ids: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'],
          },
        ],
      ]);
      mockUserFind(freshUserIds.map((id) => ({ user_id: id })));

      await runFlagDetection();

      const brigadeFreshCalls = vi.mocked(Comment.updateMany).mock.calls.filter(
        (call: unknown[]) => (call[1] as MockDoc)?.$set && (call[1] as MockDoc).$set.flag_type === 'brigade_fresh'
      );
      expect(brigadeFreshCalls.length).toBe(0);
    });

    it('handles errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        /* suppress error output */
      });
      vi.mocked(Comment.find).mockImplementation(() => {
        throw new Error('DB connection lost');
      });

      await expect(runFlagDetection()).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('startFlagCron', () => {
    afterEach(() => {
      stopFlagCron();
    });

    it('starts interval and runs immediately', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      startFlagCron();

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
      setIntervalSpy.mockRestore();
    });

    it('does not start a second cron if already running', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      startFlagCron();
      startFlagCron();

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      setIntervalSpy.mockRestore();
    });
  });

  describe('stopFlagCron', () => {
    it('stops the running cron', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      startFlagCron();
      stopFlagCron();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('handles stopping when no cron is running', () => {
      expect(() => stopFlagCron()).not.toThrow();
    });
  });
});
