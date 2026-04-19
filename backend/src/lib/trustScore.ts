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
  const rawWeighted = ((CONFIDENCE_CONSTANT * BASE_TRUST) + (rawScore * totalReviewed)) / (CONFIDENCE_CONSTANT + totalReviewed);

  // Calculate base delta from raw calculation
  const baseDelta = rawWeighted - oldScore;
  
  // Apply asymmetric weighting based on current trust score
  let multiplier: number;
  let delta: number;
  
  if (oldScore < 1.0) {
    // Forgiving mode: approvals count double, rejections count half
    multiplier = action === 'approve' ? 2.0 : 0.5;
    delta = baseDelta * multiplier;
  } else if (oldScore >= 1.0 && oldScore < 1.5) {
    // Neutral mode: equal weight
    multiplier = 1.0;
    delta = baseDelta;
  } else {
    // Strict mode: approvals count half, rejections count double
    multiplier = action === 'approve' ? 0.5 : 2.0;
    delta = baseDelta * multiplier;
  }
  
  // Calculate final score with weighted delta
  const adjustedScore = oldScore + delta;
  
  // Clamp to valid range
  const finalScore = Math.max(MIN_TRUST, Math.min(MAX_TRUST, adjustedScore));

  // Increment version for optimistic locking
  const newVersion = currentVersion + 1;

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
          trust_score: finalScore,
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
        new_score: finalScore,
        version: newVersion,
        multiplier,
        base_delta: baseDelta,
      }], { session });
    });
  } finally {
    await session.endSession();
  }

  return finalScore;
};


