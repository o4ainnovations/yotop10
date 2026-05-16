import { redis } from './redis';

export interface ExploreSignals {
  published_at: Date;
  comment_count: number;
  view_count: number;
  bookmark_count: number;
  author_trust_score: number;
  category_slug: string;
  bumped_at: Date | null;
}

export interface ExploreScore {
  post_id: string;
  score: number;
  recency_score: number;
  engagement_score: number;
  authority_score: number;
  velocity_score: number;
  diversity_score: number;
}

function decayHours(date: Date, halfLifeHours: number): number {
  const hoursSince = (Date.now() - date.getTime()) / 3600000;
  if (hoursSince <= 0) return 1;
  return Math.pow(0.5, hoursSince / halfLifeHours);
}

function recencyScore(published_at: Date, bumped_at: Date | null): number {
  const effective = bumped_at && bumped_at > published_at ? bumped_at : published_at;
  return decayHours(effective, 24);
}

function engagementScore(signals: ExploreSignals): number {
  const hoursSince = Math.max(1, (Date.now() - signals.published_at.getTime()) / 3600000);
  const weighted = (signals.comment_count * 3) + (signals.view_count * 0.5) + (signals.bookmark_count * 5);
  return weighted / hoursSince;
}

function authorityScore(trust_score: number): number {
  if (trust_score >= 1.8) return 2.0;
  if (trust_score >= 1.0) return 1.0;
  if (trust_score >= 0.5) return 0.5;
  return 0.1;
}

async function velocityScore(postId: string): Promise<number> {
  try {
    const key = `explore:velocity:${postId}`;
    const count = await redis.get(key);
    const views = parseInt(count || '0', 10);
    return Math.log1p(views);
  } catch {
    return 0;
  }
}

function diversityScore(categorySlug: string, recentlyViewed: string[]): number {
  if (!recentlyViewed || recentlyViewed.length === 0) return 1.0;
  if (recentlyViewed.includes(categorySlug)) return 0.3;
  const parentMatch = recentlyViewed.some((r) => categorySlug.startsWith(r.split('/')[0]));
  if (parentMatch) return 0.6;
  return 1.0;
}

export async function computeExploreScore(
  postId: string,
  signals: ExploreSignals,
  recentlyViewed: string[],
): Promise<ExploreScore> {
  const recency = recencyScore(signals.published_at, signals.bumped_at);
  const engagement = engagementScore(signals);
  const authority = authorityScore(signals.author_trust_score);
  const velocity = await velocityScore(postId);
  const diversity = diversityScore(signals.category_slug, recentlyViewed);

  const score =
    recency * 0.15 +
    Math.min(engagement / 20, 1) * 0.25 +
    authority * 0.20 +
    velocity * 0.30 +
    diversity * 0.10;

  return { post_id: postId, score: parseFloat(score.toFixed(4)), recency_score: recency, engagement_score: engagement, authority_score: authority, velocity_score: velocity, diversity_score: diversity };
}

export async function trackExploreView(postId: string): Promise<void> {
  try {
    const key = `explore:velocity:${postId}`;
    await redis.incr(key);
    await redis.expire(key, 3600);
  } catch { /* non-critical */ }
}
