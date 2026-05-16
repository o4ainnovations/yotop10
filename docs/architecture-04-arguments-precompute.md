# Arguments Page — Pre-Computed Scores

## The Problem

"Highlights This vs That and Counter List" requires an endpoint that aggregates these. The current codebase has no such endpoint. Computing on every request is wasteful — arguments change slowly.

## The Fix: Pre-Compute + Redis

```typescript
// Cron: runs every 60s
const score = computeArgumentScore(post);
redis.zadd('arguments:hot', score, post.slug);

// API: reads from Redis, 1ms
const slugs = await redis.zrevrange('arguments:hot', 0, 49);
```

## The Endpoint

```
GET /api/arguments?category=&time=today|week|month|all
```

This endpoint must:
1. Query posts where `post_type IN ('this_vs_that', 'counter_list')`
2. Sort by comment velocity (not comment count — a post with 100 comments from last month is stale)
3. Include the top 3 most-active item-anchored comments per post
4. Include ArgumentBar support/contradict data (currently hardcoded demo data — needs real source)
