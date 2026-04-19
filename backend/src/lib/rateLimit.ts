/**
 * 2D Rate Limiting with Soft Gradient Floor
 * 
 * Two independent constraints:
 * 1. Soft gradient mapping for trust < 1.0
 * 2. Hard minimum guarantee that never goes below 2 posts/hour
 * 
 * No silent bans, no hard discontinuities, preserves full incentive gradient.
 */

export const BASE_POSTS_PER_HOUR = 4;
export const BASE_COMMENTS_PER_HOUR = 20;
export const MINIMUM_POSTS_PER_HOUR = 2;
export const MINIMUM_COMMENTS_PER_HOUR = 10;

export function calculateEffectivePostLimit(trustScore: number, postType?: string): number {
  // Counter lists are ALWAYS UNLIMITED for all users
  if (postType === 'counter_list') {
    return 9999; // Effectively unlimited
  }

  // Soft gradient mapping for low trust users
  const effectiveTrust = trustScore < 1.0 
    ? 0.5 + (trustScore * 0.5)
    : trustScore;

  const proportional = BASE_POSTS_PER_HOUR * effectiveTrust;
  
  // 2nd dimension: hard floor guarantee
  return Math.max(MINIMUM_POSTS_PER_HOUR, Math.floor(proportional));
}

export function calculateEffectiveCommentLimit(trustScore: number): number {
  const effectiveTrust = trustScore < 1.0 
    ? 0.5 + (trustScore * 0.5)
    : trustScore;

  const proportional = BASE_COMMENTS_PER_HOUR * effectiveTrust;
  
  return Math.max(MINIMUM_COMMENTS_PER_HOUR, Math.floor(proportional));
}

export interface RateLimitStatus {
  trust_score: number;
  current_tier: 'troll' | 'neutral' | 'scholar';
  limits: {
    posts: {
      total: number;
      remaining: number;
      reset_in_seconds: number;
    };
    comments: {
      total: number;
      remaining: number;
      reset_in_seconds: number;
    };
    counter_lists: {
      total: string;
      remaining: string;
      reset_in_seconds: null;
    };
  };
}
