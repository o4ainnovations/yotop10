import { User } from '../models/User';
import { TrustScoreLog } from '../models/TrustScoreLog';
import { getConfig } from './systemConfig';
import { ConflictError } from './errors';

const NEWBIE_PROMOTION_HOURS = 48;
const GHOST_DEMOTION_DAYS = 7;

/**
 * Check and promote/demote user based on age and activity.
 * Called from calculateTrustScore and user fetch.
 */
export async function checkAndPromoteUser(userId: string): Promise<void> {
  const user = await User.findOne({ user_id: userId });
  if (!user) return;

  const ageHours = (Date.now() - new Date(user.created_at).getTime()) / 3600000;
  const approvedCount = user.last_50_reviews.filter(r => r.status === 'approved').length;

  // ghost → newbie: if they have at least 1 approved post
  if (user.trust_level === 'ghost' && approvedCount > 0) {
    await User.findOneAndUpdate(
      { user_id: userId, trust_version: user.trust_version },
      { trust_level: 'newbie', trust_version: user.trust_version + 1 },
    );
    return;
  }

  // newbie → neutral: after 48h OR first approved post
  if (user.trust_level === 'newbie' && (ageHours >= NEWBIE_PROMOTION_HOURS || approvedCount > 0)) {
    await User.findOneAndUpdate(
      { user_id: userId, trust_version: user.trust_version },
      { trust_level: 'neutral', trust_version: user.trust_version + 1 },
    );
    return;
  }

  // neutral/newbie → ghost: older than 7 days and no approved posts
  const isDormant = (user.trust_level === 'newbie' || user.trust_level === 'neutral')
    && ageHours >= GHOST_DEMOTION_DAYS * 24
    && approvedCount === 0;

  if (isDormant) {
    await User.findOneAndUpdate(
      { user_id: userId, trust_version: user.trust_version },
      { trust_level: 'ghost', trust_version: user.trust_version + 1 },
    );
  }
}

export const calculateTrustScore = async (userId: string, postId: string, action: 'approve' | 'reject'): Promise<number> => {
  const MAX_REVIEWS = 50;
  const BASE_TRUST = 1.0;
  const MIN_TRUST = 0.1;
  const MAX_TRUST = 2.0;
  const PUNISHMENT_MULTIPLIER = 2.5;
  const CONFIDENCE_CONSTANT = 5;

  const user = await User.findOne({ user_id: userId });
  if (!user) return BASE_TRUST;

  const currentVersion = user.trust_version;
  const oldScore = user.trust_score;

  user.last_50_reviews.push({
    status: action === 'approve' ? 'approved' : 'rejected',
    timestamp: new Date(),
  });

  if (user.last_50_reviews.length > MAX_REVIEWS) {
    user.last_50_reviews.shift();
  }

  const approved = user.last_50_reviews.filter(r => r.status === 'approved').length;
  const rejected = user.last_50_reviews.filter(r => r.status === 'rejected').length;
  const totalReviewed = approved + rejected;

  const pos = Math.log1p(approved * 0.05);
  const neg = Math.log1p(rejected * 0.05 * PUNISHMENT_MULTIPLIER);
  const rawScore = BASE_TRUST + pos - neg;

  const rawWeighted = ((CONFIDENCE_CONSTANT * BASE_TRUST) + (rawScore * totalReviewed)) / (CONFIDENCE_CONSTANT + totalReviewed);

  const baseDelta = rawWeighted - oldScore;

  let multiplier: number;
  let delta: number;

  if (oldScore < 1.0) {
    multiplier = action === 'approve' ? 2.0 : 0.5;
    delta = baseDelta * multiplier;
  } else if (oldScore >= 1.0 && oldScore < 1.5) {
    multiplier = 1.0;
    delta = baseDelta;
  } else {
    multiplier = action === 'approve' ? 0.5 : 2.0;
    delta = baseDelta * multiplier;
  }

  const adjustedScore = oldScore + delta;
  const finalScore = Math.max(MIN_TRUST, Math.min(MAX_TRUST, adjustedScore));

  const config = getConfig();
  const { hysteresis_enter, hysteresis_lose, troll_max } = config.trust_tiers;
  const previousLevel = user.trust_level || 'newbie';

  // Determine new level — newbie/ghost promotion is handled by checkAndPromoteUser
  let newLevel: 'newbie' | 'ghost' | 'troll' | 'neutral' | 'scholar';
  if (previousLevel === 'scholar' && finalScore <= hysteresis_lose) {
    newLevel = 'neutral';
  } else if (finalScore >= hysteresis_enter) {
    newLevel = 'scholar';
  } else if (finalScore <= troll_max) {
    newLevel = 'troll';
  } else if (previousLevel === 'newbie' || previousLevel === 'ghost') {
    newLevel = previousLevel;
  } else {
    newLevel = 'neutral';
  }

  const newVersion = currentVersion + 1;

  const updateResult = await User.findOneAndUpdate(
    { user_id: userId, trust_version: currentVersion },
    {
      trust_score: finalScore,
      trust_version: newVersion,
      trust_level: newLevel,
      last_50_reviews: user.last_50_reviews,
    },
    { new: true },
  );

  if (!updateResult) {
    throw new ConflictError('Trust score was updated by another process. Retry the action.');
  }

  await TrustScoreLog.create({
    user_id: userId,
    post_id: postId,
    action,
    delta,
    old_score: oldScore,
    new_score: finalScore,
    version: newVersion,
    multiplier,
    base_delta: baseDelta,
  });

  // Run promotion check after trust score update
  await checkAndPromoteUser(userId);

  return finalScore;
};
