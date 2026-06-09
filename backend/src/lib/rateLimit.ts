/**
 * 2D Rate Limiting with Soft Gradient Floor
 * 
 * Two independent constraints:
 * 1. Soft gradient mapping for trust < 1.0
 * 2. Hard minimum guarantee that never goes below the troll tier min_posts
 * 
 * No silent bans, no hard discontinuities, preserves full incentive gradient.
 * Base limits read from enterprise config store (memory-cached, 0ms overhead).
 */

import { getConfig } from './systemConfig';

/**
 * Calculate the effective post rate limit for a user based on trust score.
 * Uses a 2D soft gradient floor algorithm — no hard discontinuities.
 * Counter lists always return 9999 when unlimited is enabled in config.
 * @param trustScore - User's trust score (0.1-2.0)
 * @param postType - Optional post type (counter_list returns unlimited)
 * @returns Effective maximum posts per hour
 */
export function calculateEffectivePostLimit(trustScore: number, postType?: string): number {
  const config = getConfig();

  if (postType === 'counter_list') {
    if (config.rate_limits.counter_lists_unlimited) {
      return 9999;
    }
  }

  const minPosts = config.rate_limits.tiers.troll.min_posts;

  if (!Number.isFinite(trustScore)) return minPosts;

  const effectiveTrust = trustScore < 1.0
    ? 0.5 + (trustScore * 0.5)
    : trustScore;

  const proportional = config.rate_limits.base_posts_per_hour * effectiveTrust;

  return Math.max(minPosts, Math.floor(proportional));
}

/**
 * Calculate the effective comment rate limit for a user based on trust score.
 * @param trustScore - User's trust score (0.1-2.0)
 * @returns Effective maximum comments per hour
 */
export function calculateEffectiveCommentLimit(trustScore: number): number {
  const config = getConfig();

  const minComments = Math.floor(config.rate_limits.tiers.troll.multiplier * config.rate_limits.base_comments_per_hour);

  if (!Number.isFinite(trustScore)) return minComments;

  const effectiveTrust = trustScore < 1.0
    ? 0.5 + (trustScore * 0.5)
    : trustScore;

  const proportional = config.rate_limits.base_comments_per_hour * effectiveTrust;

  return Math.max(minComments, Math.floor(proportional));
}

export function getRateLimitKey(namespace: 'posts' | 'comments', fingerprint: string): string {
  if (!fingerprint) throw new Error('Fingerprint is required for rate limit key'); // kept as Error — caught internally
  return `rate_limit:${namespace}:${fingerprint}`;
}

export interface RateLimitStatus {
  trust_score: number;
  current_tier: 'troll' | 'neutral' | 'scholar';
  server_time?: number;
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
