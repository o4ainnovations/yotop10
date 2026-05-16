# Explore Algorithm — Multi-Factor Scoring

## The Problem

"TikTok and Twitter mixed" is not a specification. It requires defining which signals matter and how they combine.

## The Signals

| Signal | TikTok | Twitter | YoTop10 can use |
|---|---|---|---|
| Watch time / dwell | Primary signal | Not used | Page visit duration (already tracked via PageVisit) |
| Engagement rate | Likes, comments, shares | Retweets, replies, likes | Fires, comments, bookmarks per view |
| Recency | Moderate | High | `published_at` — already have |
| Creator authority | Follower count | Verified status | Trust score tier (scholar/neutral/troll) |
| Content freshness | Low (evergreen wins) | Very high | `bumped_at` — already have |
| Diversity | Enforced (no echo chambers) | Low (follow-graph based) | Category diversity multiplier |

## The Fix: Multi-Factor Scoring Function

```typescript
function exploreScore(post: Post, signals: Signals): number {
  const recency    = decay(post.published_at, halfLife: '24h');
  const engagement = (post.comment_count * 3 + post.view_count * 1 + post.bookmark_count * 5) / hoursSincePublished;
  const authority  = authorTrustMultiplier(post.author_trust_score);
  const diversity  = categoryDiversityMultiplier(user.recentlyViewedCategories);
  const velocity   = engagementVelocity(post.id, window: '1h'); // from Redis

  return (recency * 0.15) + (engagement * 0.25) + (authority * 0.20) + (velocity * 0.30) + (diversity * 0.10);
}
```

## Key Decisions

- Pure functions with 0 external API calls during computation — data is pre-aggregated
- Transparent, testable, debuggable
- The Explore page MUST have a different endpoint: `GET /api/explore` with its own scoring pipeline
- Do NOT overload `GET /api/posts` with algorithm parameters
