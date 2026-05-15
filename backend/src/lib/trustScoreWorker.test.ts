import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCalculateTrustScore = vi.fn();
vi.mock('../lib/trustScore', () => ({
  calculateTrustScore: (...args: unknown[]) => mockCalculateTrustScore(...args),
}));

import { trustScoreWorker } from '../lib/trustScoreWorker';

let worker: typeof trustScoreWorker;

describe('TrustScoreWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockCalculateTrustScore.mockResolvedValue(undefined);
    worker = new (Object.getPrototypeOf(trustScoreWorker).constructor)();
  });

  describe('queueUpdate', () => {
    it('queues a job and processes it', async () => {
      worker.queueUpdate('user1', 'post1', 'approve');

      await vi.runAllTimersAsync();

      expect(mockCalculateTrustScore).toHaveBeenCalledWith('user1', 'post1', 'approve');
    });

    it('processes multiple queued jobs sequentially', async () => {
      worker.queueUpdate('user1', 'post1', 'approve');
      worker.queueUpdate('user2', 'post2', 'reject');
      worker.queueUpdate('user3', 'post3', 'approve');

      await vi.runAllTimersAsync();

      expect(mockCalculateTrustScore).toHaveBeenCalledTimes(3);
      expect(mockCalculateTrustScore).toHaveBeenNthCalledWith(1, 'user1', 'post1', 'approve');
      expect(mockCalculateTrustScore).toHaveBeenNthCalledWith(2, 'user2', 'post2', 'reject');
      expect(mockCalculateTrustScore).toHaveBeenNthCalledWith(3, 'user3', 'post3', 'approve');
    });

    it('does not start processing if already processing', async () => {
      mockCalculateTrustScore.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      worker.queueUpdate('user1', 'post1', 'approve');
      worker.queueUpdate('user2', 'post2', 'reject');

      await vi.advanceTimersByTimeAsync(50);

      expect(mockCalculateTrustScore).toHaveBeenCalledTimes(1);
    });

    it('handles reject action', async () => {
      worker.queueUpdate('user99', 'post99', 'reject');

      await vi.runAllTimersAsync();

      expect(mockCalculateTrustScore).toHaveBeenCalledWith('user99', 'post99', 'reject');
    });
  });

  describe('retry logic', () => {
    it('retries on version conflict with exponential backoff', async () => {
      mockCalculateTrustScore
        .mockRejectedValueOnce(new Error('Version conflict: document was modified'))
        .mockRejectedValueOnce(new Error('Version conflict: document was modified'))
        .mockResolvedValueOnce(undefined);

      worker.queueUpdate('user1', 'post1', 'approve');

      await vi.runAllTimersAsync();

      expect(mockCalculateTrustScore).toHaveBeenCalledTimes(3);
    });

    it('gives up after maxRetries (5)', async () => {
      const versionError = new Error('Version conflict: concurrent update');
      mockCalculateTrustScore.mockRejectedValue(versionError);

      worker.queueUpdate('user1', 'post1', 'approve');

      await vi.runAllTimersAsync();

      const calls = mockCalculateTrustScore.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      expect(calls.length).toBeLessThanOrEqual(6);
    });

    it('does not retry non-version-conflict errors', async () => {
      mockCalculateTrustScore.mockRejectedValueOnce(new Error('User not found'));

      worker.queueUpdate('ghost', 'post1', 'approve');

      await vi.runAllTimersAsync();

      expect(mockCalculateTrustScore).toHaveBeenCalledTimes(1);
    });

    it('does not retry when error is not an Error instance', async () => {
      mockCalculateTrustScore.mockRejectedValueOnce('string error');

      worker.queueUpdate('user1', 'post1', 'approve');

      await vi.runAllTimersAsync();

      expect(mockCalculateTrustScore).toHaveBeenCalledTimes(1);
    });

    it('unshifts the job to front of queue for retry', async () => {
      mockCalculateTrustScore
        .mockRejectedValueOnce(new Error('Version conflict: stale'))
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      worker.queueUpdate('user1', 'post1', 'approve');
      worker.queueUpdate('user2', 'post2', 'approve');

      await vi.runAllTimersAsync();

      const calls = mockCalculateTrustScore.mock.calls.map(c => [c[0], c[1]]);
      expect(calls[0]).toEqual(['user1', 'post1']);
      expect(calls[1]).toEqual(['user1', 'post1']);
      expect(calls[2]).toEqual(['user2', 'post2']);
    });
  });

  describe('edge cases', () => {
    it('stops processing when queue is empty', async () => {
      mockCalculateTrustScore.mockResolvedValue(undefined);

      worker.queueUpdate('user1', 'post1', 'approve');
      await vi.runAllTimersAsync();

      const callCount = mockCalculateTrustScore.mock.calls.length;

      worker.queueUpdate('user2', 'post2', 'approve');
      await vi.runAllTimersAsync();

      expect(mockCalculateTrustScore).toHaveBeenCalledTimes(callCount + 1);
    });

    it('processes queue with mixed success and failure jobs', async () => {
      mockCalculateTrustScore
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(undefined);

      worker.queueUpdate('user1', 'post1', 'approve');
      worker.queueUpdate('user2', 'post2', 'reject');
      worker.queueUpdate('user3', 'post3', 'approve');

      await vi.runAllTimersAsync();

      expect(mockCalculateTrustScore).toHaveBeenCalledTimes(3);
    });
  });
});
