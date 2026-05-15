import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { grantBoost, getActiveBoost, BoostType } from '../lib/ladderSystem';

type MockDoc = Record<string, unknown>;

vi.mock('../models/User', () => ({
  User: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

import { User } from '../models/User';

interface MockUserFields {
  user_id?: string;
  trust_score?: number;
  active_boost?: { posts: number; comments: number; expires_at: Date };
  last_boost_granted_at?: Date;
}

function makeUser(overrides: MockUserFields = {}) {
  return {
    user_id: overrides.user_id ?? 'user1',
    trust_score: overrides.trust_score ?? 1.0,
    active_boost: overrides.active_boost ?? undefined,
    last_boost_granted_at: overrides.last_boost_granted_at ?? undefined,
  };
}

describe('ladderSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('grantBoost', () => {
    it('returns false when user not found', async () => {
      vi.mocked(User.findOne).mockResolvedValue(null);

      const result = await grantBoost('nonexistent', BoostType.POST_APPROVED);
      expect(result).toBe(false);
    });

    it('returns false when trust score >= 1.2', async () => {
      const user = makeUser({ trust_score: 1.2 });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);

      const result = await grantBoost('user1', BoostType.COMMENT_THREE_FIRES);
      expect(result).toBe(false);
    });

    it('returns false when trust score > 1.2', async () => {
      const user = makeUser({ trust_score: 2.0 });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);

      const result = await grantBoost('user1', BoostType.COMMENT_TWO_REPLIES);
      expect(result).toBe(false);
    });

    it('grants boost when trust score < 1.2', async () => {
      const user = makeUser({ trust_score: 1.0 });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);

      const result = await grantBoost('user1', BoostType.COMMENT_THREE_FIRES);
      expect(result).toBe(true);
    });

    it('returns false during cooldown period', async () => {
      const recentBoost = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const user = makeUser({
        trust_score: 1.0,
        last_boost_granted_at: recentBoost,
      });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);

      const result = await grantBoost('user1', BoostType.COMMENT_THREE_FIRES);
      expect(result).toBe(false);
    });

    it('grants boost after cooldown expires', async () => {
      const oldBoost = new Date(Date.now() - 13 * 60 * 60 * 1000);
      const user = makeUser({
        trust_score: 0.8,
        last_boost_granted_at: oldBoost,
      });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);

      const result = await grantBoost('user1', BoostType.POST_APPROVED);
      expect(result).toBe(true);
    });

    it('sets correct boost values for COMMENT_THREE_FIRES', async () => {
      const user = makeUser({ trust_score: 1.0 });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);

      await grantBoost('user1', BoostType.COMMENT_THREE_FIRES);

      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { user_id: 'user1' },
        expect.objectContaining({
          active_boost: expect.objectContaining({ posts: 1, comments: 5 }),
        }),
      );
    });

    it('sets correct boost values for COUNTER_LIST_SUBMITTED', async () => {
      const user = makeUser({ trust_score: 0.5 });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);

      await grantBoost('user1', BoostType.COUNTER_LIST_SUBMITTED);

      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { user_id: 'user1' },
        expect.objectContaining({
          active_boost: expect.objectContaining({ posts: 2, comments: 10 }),
        }),
      );
    });

    it('sets correct boost values for POST_APPROVED', async () => {
      const user = makeUser({ trust_score: 0.3 });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);

      await grantBoost('user1', BoostType.POST_APPROVED);

      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { user_id: 'user1' },
        expect.objectContaining({
          active_boost: expect.objectContaining({ posts: 3, comments: 15 }),
        }),
      );
    });

    it('sets expiry 90 minutes from now', async () => {
      const user = makeUser({ trust_score: 1.0 });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);

      await grantBoost('user1', BoostType.COMMENT_TWO_REPLIES);

      const expectedExpiry = new Date(Date.now() + 90 * 60 * 1000);
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { user_id: 'user1' },
        expect.objectContaining({
          active_boost: expect.objectContaining({
            expires_at: expectedExpiry,
          }),
        }),
      );
    });

    it('sets last_boost_granted_at to current time', async () => {
      const now = new Date('2025-06-15T12:00:00Z');
      const user = makeUser({ trust_score: 1.0 });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);

      await grantBoost('user1', BoostType.COMMENT_THREE_FIRES);

      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { user_id: 'user1' },
        expect.objectContaining({
          last_boost_granted_at: now,
        }),
      );
    });
  });

  describe('getActiveBoost', () => {
    it('returns null when user not found', async () => {
      vi.mocked(User.findOne).mockResolvedValue(null);

      const result = await getActiveBoost('nonexistent');
      expect(result).toBeNull();
    });

    it('returns null when trust score >= 1.2', async () => {
      const user = makeUser({ trust_score: 1.2 });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);

      const result = await getActiveBoost('user1');
      expect(result).toBeNull();
    });

    it('returns null when no active boost', async () => {
      const user = makeUser({ trust_score: 0.8, active_boost: undefined });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);

      const result = await getActiveBoost('user1');
      expect(result).toBeNull();
    });

    it('returns active boost when valid', async () => {
      const futureExpiry = new Date(Date.now() + 30 * 60 * 1000);
      const user = makeUser({
        trust_score: 1.0,
        active_boost: { posts: 2, comments: 10, expires_at: futureExpiry },
      });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);

      const result = await getActiveBoost('user1');
      expect(result).toEqual({ posts: 2, comments: 10, expires_at: futureExpiry });
    });

    it('returns null and clears expired boost', async () => {
      const pastExpiry = new Date(Date.now() - 10 * 60 * 1000);
      const user = makeUser({
        trust_score: 1.0,
        active_boost: { posts: 3, comments: 15, expires_at: pastExpiry },
      });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);

      const result = await getActiveBoost('user1');
      expect(result).toBeNull();
      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        { user_id: 'user1' },
        { $unset: { active_boost: 1 } },
      );
    });
  });
});
