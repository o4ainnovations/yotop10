import { User } from '../models/User';
import { TrustScoreLog } from '../models/TrustScoreLog';

/**
 * M11.C: Trust Score Calculation Engine V2
 * With rolling window, logarithmic scaling, and hysteresis thresholds
 */
export const calculateTrustScore = async (userId: string, postId: string, action: 'approve' | 'reject'): Promise<number> => {
  const MAX_REVIEWS = 50;
  const BASE_TRUST = 1.0;
  const MIN_TRUST = 0.1;
  const MAX_TRUST = 2.0;
  const PUNISHMENT_MULTIPLIER = 2.5;
  const CONFIDENCE_CONSTANT = 5;

  // Get current user state with version
  const user = await User.findOne({ user_id: userId });
  if (!user) return BASE_TRUST;

  const currentVersion = user.trust_version;
  const oldScore = user.trust_score;

  // Update rolling window - O(1) operation
  user.last_50_reviews.push({
    status: action === 'approve' ? 'approved' : 'rejected',
    timestamp: new Date(),
  });

  // Maintain exactly MAX_REVIEWS entries
  if (user.last_50_reviews.length > MAX_REVIEWS) {
    user.last_50_reviews.shift();
  }

  // Calculate score from rolling window only
  const approved = user.last_50_reviews.filter(r => r.status === 'approved').length;
  const rejected = user.last_50_reviews.filter(r => r.status === 'rejected').length;
  const totalReviewed = approved + rejected;

  // Logarithmic scaling with asymmetric penalty
  const pos = Math.log1p(approved * 0.05);
  const neg = Math.log1p(rejected * 0.05 * PUNISHMENT_MULTIPLIER);
  const rawScore = BASE_TRUST + pos - neg;

  // Bayesian smoothing for cold start
  const weightedScore = ((CONFIDENCE_CONSTANT * BASE_TRUST) + (rawScore * totalReviewed)) / (CONFIDENCE_CONSTANT + totalReviewed);

  // Clamp to valid range
  const newScore = Math.max(MIN_TRUST, Math.min(MAX_TRUST, weightedScore));

  // Increment version for optimistic locking
  const newVersion = currentVersion + 1;

  // Calculate delta for audit log
  const delta = newScore - oldScore;

  // Start transaction - atomic update
  const session = await User.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Update user with optimistic concurrency control
      const updateResult = await User.findOneAndUpdate(
        { 
          user_id: userId, 
          trust_version: currentVersion 
        },
        {
          trust_score: newScore,
          trust_version: newVersion,
          last_50_reviews: user.last_50_reviews,
        },
        { session, new: true }
      );

      if (!updateResult) {
        throw new Error('Version conflict: Trust score updated by another process');
      }

      // Write immutable audit log entry
      await TrustScoreLog.create([{
        user_id: userId,
        post_id: postId,
        action,
        delta,
        old_score: oldScore,
        new_score: newScore,
        version: newVersion,
      }], { session });
    });
  } finally {
    await session.endSession();
  }

  return newScore;
};


