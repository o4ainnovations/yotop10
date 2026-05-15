import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logUserEvent } from './userEventWriter';
import { UserEvent } from '../models/UserEvent';

vi.mock('../models/UserEvent', () => ({
  UserEvent: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(UserEvent.create).mockResolvedValue({});
});

async function tick(ms = 10): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('userEventWriter', () => {
  describe('logUserEvent', () => {
    it('calls UserEvent.create with correct parameters', async () => {
      logUserEvent({
        user_id: 'user123',
        fingerprint: 'fp_abc123',
        event: 'post_created',
        metadata: { post_id: 'post456' },
      });
      await tick();
      expect(UserEvent.create).toHaveBeenCalledWith({
        user_id: 'user123',
        fingerprint: 'fp_abc123',
        event: 'post_created',
        metadata: { post_id: 'post456' },
      });
    });

    it('uses empty metadata object when not provided', async () => {
      logUserEvent({
        user_id: 'user123',
        fingerprint: 'fp_abc123',
        event: 'login',
      });
      await tick();
      expect(UserEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        metadata: {},
      }));
    });

    it('handles various event types', async () => {
      const events = ['post_created', 'comment_added', 'vote_cast', 'report_submitted', 'profile_updated'];
      for (const event of events) {
        vi.mocked(UserEvent.create).mockClear();
        logUserEvent({
          user_id: 'user123',
          fingerprint: 'fp_abc123',
          event,
        });
        await tick();
        expect(UserEvent.create).toHaveBeenCalledWith(expect.objectContaining({ event }));
      }
    });

    it('does not throw when UserEvent.create fails', async () => {
      vi.mocked(UserEvent.create).mockRejectedValue(new Error('DB write failed'));
      expect(() => {
        logUserEvent({
          user_id: 'user123',
          fingerprint: 'fp_abc123',
          event: 'post_created',
        });
      }).not.toThrow();
      await tick();
    });

    it('returns immediately without awaiting (fire and forget)', () => {
      const result = logUserEvent({
        user_id: 'user123',
        fingerprint: 'fp_abc123',
        event: 'post_created',
      });
      expect(result).toBeUndefined();
    });

    it('passes complex metadata objects correctly', async () => {
      const complexMetadata = {
        nested: { key: 'value', count: 42 },
        array: [1, 2, 3],
        timestamp: '2025-06-15T12:00:00Z',
      };
      logUserEvent({
        user_id: 'user456',
        fingerprint: 'fp_def456',
        event: 'action_logged',
        metadata: complexMetadata,
      });
      await tick();
      expect(UserEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        metadata: complexMetadata,
      }));
    });
  });
});
