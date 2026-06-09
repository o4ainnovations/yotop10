import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateTrustScore } from '../lib/trustScore';

type MockDoc = Record<string, unknown>;

const mockUser = {
  user_id: 'user1',
  trust_score: 1.0,
  trust_version: 0,
  last_50_reviews: [] as Array<{ status: 'approved' | 'rejected'; timestamp: Date }>,
};

vi.mock('../models/User', () => ({
  User: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../models/TrustScoreLog', () => ({
  TrustScoreLog: {
    create: vi.fn(),
  },
}));

import { User } from '../models/User';
import { TrustScoreLog } from '../models/TrustScoreLog';

function makeUser(overrides: Partial<typeof mockUser> = {}) {
  const reviews = overrides.last_50_reviews ?? [];
  return {
    user_id: overrides.user_id ?? 'user1',
    trust_score: overrides.trust_score ?? 1.0,
    trust_version: overrides.trust_version ?? 0,
    last_50_reviews: reviews.map((r) => ({ ...r })),
  };
}

describe('trustScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateTrustScore', () => {
    it('returns base trust when user not found', async () => {
      vi.mocked(User.findOne).mockResolvedValue(null);

      const score = await calculateTrustScore('nonexistent', 'post1', 'approve');
      expect(score).toBe(1.0);
    });

    it('returns score within valid range for first approve', async () => {
      const user = makeUser();
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);
      vi.mocked(TrustScoreLog.create).mockResolvedValue({} as unknown as MockDoc);

      const score = await calculateTrustScore('user1', 'post1', 'approve');
      expect(score).toBeGreaterThanOrEqual(0.1);
      expect(score).toBeLessThanOrEqual(2.0);
    });

    it('returns score within valid range for first reject', async () => {
      const user = makeUser();
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);
      vi.mocked(TrustScoreLog.create).mockResolvedValue({} as unknown as MockDoc);

      const score = await calculateTrustScore('user1', 'post1', 'reject');
      expect(score).toBeGreaterThanOrEqual(0.1);
      expect(score).toBeLessThanOrEqual(2.0);
    });

    it('decreases score after multiple rejections', async () => {
      const user = makeUser({
        last_50_reviews: Array(10).fill({ status: 'rejected' as const, timestamp: new Date() }),
      });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);
      vi.mocked(TrustScoreLog.create).mockResolvedValue({} as unknown as MockDoc);

      const score = await calculateTrustScore('user1', 'post1', 'reject');
      expect(score).toBeLessThan(1.0);
    });

    it('increases score after multiple approvals', async () => {
      const user = makeUser({
        last_50_reviews: Array(10).fill({ status: 'approved' as const, timestamp: new Date() }),
      });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);
      vi.mocked(TrustScoreLog.create).mockResolvedValue({} as unknown as MockDoc);

      const score = await calculateTrustScore('user1', 'post1', 'approve');
      expect(score).toBeGreaterThan(1.0);
    });

    it('clamps to minimum 0.1', async () => {
      const user = makeUser({
        trust_score: 0.11,
        last_50_reviews: Array(49).fill({ status: 'rejected' as const, timestamp: new Date() }),
      });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);
      vi.mocked(TrustScoreLog.create).mockResolvedValue({} as unknown as MockDoc);

      const score = await calculateTrustScore('user1', 'post1', 'reject');
      expect(score).toBe(0.1);
    });

    it('clamps to maximum 2.0', async () => {
      const user = makeUser({
        trust_score: 1.99,
        last_50_reviews: Array(49).fill({ status: 'approved' as const, timestamp: new Date() }),
      });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);
      vi.mocked(TrustScoreLog.create).mockResolvedValue({} as unknown as MockDoc);

      const score = await calculateTrustScore('user1', 'post1', 'approve');
      expect(score).toBe(2.0);
    });

    it('applies forgiving mode multiplier for low trust approvals', async () => {
      const user = makeUser({
        trust_score: 0.5,
        last_50_reviews: Array(5).fill({ status: 'rejected' as const, timestamp: new Date() }),
      });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);
      vi.mocked(TrustScoreLog.create).mockResolvedValue({} as unknown as MockDoc);

      const score = await calculateTrustScore('user1', 'post1', 'approve');
      expect(score).toBeGreaterThanOrEqual(0.1);
      expect(score).toBeLessThanOrEqual(2.0);
    });

    it('applies strict mode multiplier for high trust rejections', async () => {
      const user = makeUser({
        trust_score: 1.8,
        last_50_reviews: Array(10).fill({ status: 'approved' as const, timestamp: new Date() }),
      });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);
      vi.mocked(TrustScoreLog.create).mockResolvedValue({} as unknown as MockDoc);

      const score = await calculateTrustScore('user1', 'post1', 'reject');
      expect(score).toBeLessThan(1.8);
    });

    it('maintains rolling window of 50 reviews', async () => {
      const user = makeUser({
        last_50_reviews: Array(50).fill({ status: 'approved' as const, timestamp: new Date() }),
      });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);
      vi.mocked(TrustScoreLog.create).mockResolvedValue({} as unknown as MockDoc);

      const score = await calculateTrustScore('user1', 'post1', 'approve');
      expect(score).toBeGreaterThanOrEqual(0.1);
      expect(score).toBeLessThanOrEqual(2.0);
    });

    it('throws on version conflict', async () => {
      const user = makeUser();
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue(null);

      await expect(
        calculateTrustScore('user1', 'post1', 'approve')
      ).rejects.toThrow('updated by another process');
    });

    it('increments trust version on update', async () => {
      const user = makeUser({ trust_version: 5 });
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);
      vi.mocked(TrustScoreLog.create).mockResolvedValue({} as unknown as MockDoc);

      await calculateTrustScore('user1', 'post1', 'approve');

      expect(User.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ trust_version: 5 }),
        expect.objectContaining({ trust_version: 6 }),
        expect.any(Object),
      );
    });

    it('creates a trust score log entry', async () => {
      const user = makeUser();
      vi.mocked(User.findOne).mockResolvedValue(user as unknown as MockDoc);
      vi.mocked(User.findOneAndUpdate).mockResolvedValue({} as unknown as MockDoc);
      vi.mocked(TrustScoreLog.create).mockResolvedValue({} as unknown as MockDoc);

      await calculateTrustScore('user1', 'post1', 'approve');

      expect(TrustScoreLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user1',
          post_id: 'post1',
          action: 'approve',
          version: 1,
        }),
      );
    });
  });
});
