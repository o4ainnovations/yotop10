import { User } from '../models/User';

/**
 * The Ladder System - Temporary Boost System
 * Only active for users with trust < 1.2
 */

const BOOST_COOLDOWN_HOURS = 12;
const BOOST_DURATION_MINUTES = 90;

export enum BoostType {
  COMMENT_THREE_FIRES = 'comment_three_fires',
  COMMENT_TWO_REPLIES = 'comment_two_replies',
  COUNTER_LIST_SUBMITTED = 'counter_list_submitted',
  POST_APPROVED = 'post_approved',
}

const BOOST_VALUES: Record<BoostType, { posts: number; comments: number }> = {
  [BoostType.COMMENT_THREE_FIRES]: { posts: 1, comments: 5 },
  [BoostType.COMMENT_TWO_REPLIES]: { posts: 1, comments: 5 },
  [BoostType.COUNTER_LIST_SUBMITTED]: { posts: 2, comments: 10 },
  [BoostType.POST_APPROVED]: { posts: 3, comments: 15 },
};

export async function grantBoost(userId: string, boostType: BoostType): Promise<boolean> {
  const user = await User.findOne({ user_id: userId });
  if (!user) return false;

  // System is completely disabled for users >= 1.2 trust
  if (user.trust_score >= 1.2) return false;

  const now = new Date();

  // Check cooldown
  if (user.last_boost_granted_at) {
    const cooldownEnd = new Date(user.last_boost_granted_at.getTime() + BOOST_COOLDOWN_HOURS * 60 * 60 * 1000);
    if (now < cooldownEnd) return false;
  }

  const boost = BOOST_VALUES[boostType];
  const expiresAt = new Date(now.getTime() + BOOST_DURATION_MINUTES * 60 * 1000);

  await User.findOneAndUpdate(
    { user_id: userId },
    {
      active_boost: {
        posts: boost.posts,
        comments: boost.comments,
        expires_at: expiresAt,
      },
      last_boost_granted_at: now,
    }
  );

  return true;
}

export async function getActiveBoost(userId: string): Promise<{ posts: number; comments: number } | null> {
  const user = await User.findOne({ user_id: userId });
  if (!user) return null;

  // System disabled for users >= 1.2 trust
  if (user.trust_score >= 1.2) return null;

  if (!user.active_boost) return null;

  const now = new Date();
  if (now > user.active_boost.expires_at) {
    // Clear expired boost
    await User.findOneAndUpdate(
      { user_id: userId },
      { $unset: { active_boost: 1 } }
    );
    return null;
  }

  return user.active_boost;
}
