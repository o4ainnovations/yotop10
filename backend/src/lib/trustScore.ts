import { Post } from '../models/Post';
import { User } from '../models/User';

/**
 * M11.C: Trust Score Calculation Engine
 * Calculates and updates user trust score based on post approval rate
 */
export const calculateTrustScore = async (userId: string): Promise<number> => {
  // Count posts with status breakdown
  const userPosts = await Post.aggregate([
    { $match: { author_id: userId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Process post counts
  const postCounts = userPosts.reduce((acc: any, item: any) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const postsApproved = postCounts.approved || 0;
  const postsRejected = postCounts.rejected || 0;
  const totalReviewed = postsApproved + postsRejected;

  // Base score is always 1.0 for new users
  let baseScore = 1.0;

  // Only adjust score after user has at least 5 reviewed posts
  if (totalReviewed >= 5) {
    const approvalRate = postsApproved / totalReviewed;

    if (approvalRate >= 0.85) {
      // Scholar: +0.1 per approved post, max 2.0
      baseScore = Math.min(baseScore + (0.1 * postsApproved), 2.0);
    } else if (approvalRate <= 0.3) {
      // Troll: -0.2 per rejected post, min 0.1
      baseScore = Math.max(baseScore - (0.2 * postsRejected), 0.1);
    }
  }

  // Clamp to valid range
  const trustScore = Math.max(0.1, Math.min(2.0, baseScore));

  // Update user document
  await User.findOneAndUpdate(
    { user_id: userId },
    { trust_score: trustScore }
  );

  return trustScore;
};

/**
 * Hook to be called after any post is approved or rejected
 */
export const updateUserTrustScore = async (userId: string) => {
  try {
    await calculateTrustScore(userId);
    console.log(`[TrustScore] Updated trust score for user ${userId}`);
  } catch (error) {
    console.error('[TrustScore] Failed to update trust score:', error);
  }
};
