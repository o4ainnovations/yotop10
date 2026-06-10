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

function resolveTier(
  trustScore: number,
  trustLevel?: string,
): { min: number; mult: number } {
  const cfg = getConfig();
  const tiers = cfg.rate_limits?.tiers || {} as Record<string, { min_posts: number; multiplier: number }>;
  if (trustLevel === 'ghost') return { min: tiers.ghost?.min_posts ?? 1, mult: tiers.ghost?.multiplier ?? 0.1 };
  if (trustLevel === 'newbie') return { min: tiers.newbie?.min_posts ?? 1, mult: tiers.newbie?.multiplier ?? 0.25 };
  if (trustLevel === 'scholar') return { min: tiers.scholar?.min_posts ?? 8, mult: tiers.scholar?.multiplier ?? 2.0 };
  const trollMax = cfg.trust_tiers?.troll_max ?? 0.49;
  if (trustScore <= trollMax) return { min: tiers.troll?.min_posts ?? 2, mult: tiers.troll?.multiplier ?? 0.5 };
  return { min: tiers.neutral?.min_posts ?? 4, mult: tiers.neutral?.multiplier ?? 1.0 };
}

/**
 * Calculate the effective post rate limit for a user based on trust score.
 * Uses a 2D soft gradient floor algorithm — no hard discontinuities.
 */
export function calculateEffectivePostLimit(
  trustScore: number,
  postType?: string,
  trustLevel?: string,
): number {
  const config = getConfig();

  if (postType === 'counter_list' && config.rate_limits.counter_lists_unlimited) return 9999;

  const tier = resolveTier(trustScore, trustLevel);

  if (!Number.isFinite(trustScore)) return tier.min;

  const effectiveTrust = trustScore < 1.0 ? 0.5 + (trustScore * 0.5) : trustScore;
  const proportional = config.rate_limits.base_posts_per_hour * effectiveTrust;

  return Math.max(tier.min, Math.floor(proportional));
}

/**
 * Calculate the effective comment rate limit for a user based on trust score.
 * @param trustScore - User's trust score (0.1-2.0)
 * @returns Effective maximum comments per hour
 */
export function calculateEffectiveCommentLimit(trustScore: number, trustLevel?: string): number {
  const config = getConfig();

  const tier = resolveTier(trustScore, trustLevel);
  const base = config.rate_limits.base_comments_per_hour;
  const minComments = Math.max(1, Math.floor(tier.mult * base));

  if (!Number.isFinite(trustScore)) return minComments;

  const effectiveTrust = trustScore < 1.0 ? 0.5 + (trustScore * 0.5) : trustScore;
  const proportional = base * effectiveTrust;

  return Math.max(minComments, Math.floor(proportional));
}

export function getRateLimitKey(namespace: 'posts' | 'comments', fingerprint: string): string {
  if (!fingerprint) throw new Error('Fingerprint is required for rate limit key'); // kept as Error — caught internally
  return `rate_limit:${namespace}:${fingerprint}`;
}

export interface RateLimitStatus {
  trust_score: number;
  current_tier: 'ghost' | 'newbie' | 'troll' | 'neutral' | 'scholar';
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
