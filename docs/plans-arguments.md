# Arguments Page + API — Implementation Plan

## Objective

A page that surfaces the most active debates on the platform — posts where people are actively arguing about specific items. Think Reddit's "Hot" sort crossed with Twitter's trending topics, applied to ranked lists.

---

## 1. Data Source

### What qualifies as an argument

| Post Type | Why it's an argument |
|---|---|
| `this_vs_that` | Head-to-head comparison. Users debate which side wins. |
| `counter_list` | Direct rebuttal of another list. The ultimate debate format. |

Both post types already exist in the Post model enum and work through the submit flow.

### What makes an argument "hot"

```
Comment velocity = comments_in_last_hour / total_comments_weighted
Freshness = 1 - (hours_since_last_comment / 168)      // 168 = 1 week
Spark = sum of item-anchored comment spark_scores       // quality of debate

Score = velocity * 0.5 + freshness * 0.3 + spark * 0.2
```

Not just comment count — a post with 100 old comments is stale. A post with 5 comments in the last hour is hot.

---

## 2. Backend

### 2.1 Pre-compute Cron (`lib/argumentCron.ts`)

Runs every 60 seconds. Pre-computes scores into a Redis sorted set.

```typescript
// Runs every 60s
async function computeArgumentScores() {
  const candidates = await Post.find({
    post_type: { $in: ['this_vs_that', 'counter_list'] },
    status: 'approved',
    deleted: { $ne: true },
    created_at: { $gte: new Date(Date.now() - 30 * 86400000) }  // last 30 days
  }).lean();

  for (const post of candidates) {
    const velocity = await getCommentVelocity(post._id);  // Redis: comments in last hour
    const freshness = computeFreshness(post.last_engaged_at || post.created_at);
    const spark = await getSparkSum(post._id);            // sum of item-anchored spark scores

    const score = velocity * 0.5 + freshness * 0.3 + spark * 0.2;
    await redis.zadd('arguments:hot', score, post.slug);
  }

  // Clean up posts older than 30 days
  await redis.zremrangebyscore('arguments:hot', '-inf', `${Date.now() - 30 * 86400000}`);
}
```

### 2.2 Comment Velocity Tracking

Reuse the existing comment submission flow in `routes/comments.ts`. On every new comment:

```typescript
// Track velocity for arguments page
const post = await Post.findById(comment.post_id);
if (post && ['this_vs_that', 'counter_list'].includes(post.post_type)) {
  const key = `arguments:velocity:${post._id}`;
  await redis.incr(key);
  await redis.expire(key, 3600);  // 1h window
}
```

### 2.3 API Endpoint: `GET /api/arguments`

```typescript
// routes/arguments.ts
router.get('/', async (req, res) => {
  const { category, time = 'all', page = '1', limit = '20' } = req.query;
  
  // Fetch slugs from Redis sorted set
  const slugs = await redis.zrevrange('arguments:hot', 0, 199);
  
  // Fetch full posts
  const posts = await Post.find({ slug: { $in: slugs }, status: 'approved' }).lean();
  
  // Time filter: last hour, today, this week, this month, all
  const filtered = filterByTime(posts, time);
  
  // Category filter
  const byCategory = category ? filtered.filter(p => p.category_slug === category) : filtered;
  
  // Attach top 3 item-anchored comments per post
  const enriched = await attachTopComments(byCategory);
  
  // Attach support/contradict bar data (from real fire reactions per side)
  const withBars = await attachArgumentBars(enriched);
  
  // Paginate
  const start = (page - 1) * limit;
  const paginated = withBars.slice(start, start + limit);
  
  res.json({ arguments: paginated, pagination: { page, limit, total: withBars.length } });
});
```

### 2.4 Response Shape

```json
{
  "arguments": [{
    "id": "...",
    "slug": "marvel-vs-dc-abc123",
    "title": "Marvel vs DC Universe",
    "post_type": "this_vs_that",
    "category_slug": "entertainment",
    "author_username": "a_9Gh7",
    "comment_count": 47,
    "argument_score": 0.87,
    "velocity": 12,
    "last_active": "2026-05-15T10:30:00Z",
    "top_comments": [
      { "rank": 2, "item_title": "Iron Man", "content": "No way Iron Man beats...", "author": "a_Km3x" }
    ],
    "support_pct": 62,
    "contradict_pct": 38
  }],
  "pagination": { "page": 1, "limit": 20, "total": 45 }
}
```

### 2.5 Register

- `routes/arguments.ts` — new route file
- `routes/index.ts` — add `{ path: '/api/arguments', router: argumentsRouter }`
- `server.ts` — start `argumentCron` on boot
- `routes/comments.ts` — add velocity tracking on comment creation

---

## 3. Frontend: `/arguments` Page

### 3.1 Layout

```
┌──────────────────────────────────────────────────────┐
│  ARGUMENTS                                           │
│  The hottest debates happening right now             │
│                                                      │
│  [Today ▾]  [All Categories ▾]                      │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │  Marvel vs DC Universe                          ││
│  │  THIS VS THAT · entertainment · 47 comments     ││
│  │                                                 ││
│  │  "No way Iron Man beats Batman in a straight   ││
│  │   fight. The suit tech alone..." — a_Km3x      ││
│  │  On item #2: Iron Man                          ││
│  │                                                 ││
│  │  ████████████████████░░░░░░░░░░  62% support    ││
│  │  12 replies this hour · 2 hours ago             ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │  Top 10 Sci-Fi Movies Are Overrated             ││
│  │  COUNTER LIST · rebuts "Top 10 Sci-Fi Movies"   ││
│  │  27 comments · 38% support                      ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

### 3.2 Components

| Component | What it does |
|---|---|
| `ArgumentCard` | Glass card with title, type badge, item-anchored comment preview, ArgumentBar, velocity indicator |
| `ArgumentBar` | Already exists — needs real data piped in instead of demo data |
| `TimeFilter` | Dropdown: Today, This Week, This Month, All Time |
| `CategoryFilter` | Dropdown from categories API |

### 3.3 States

| State | What shows |
|---|---|
| **Loading** | SSR — no spinner. Page renders with data. |
| **Empty** | "No active debates right now. Start one by submitting a This vs That or countering an existing list." Gradient CTA to /submit |
| **Error** | "Could not load arguments. Try again." Retry button |
| **Populated** | Glass cards in vertical feed, infinite scroll |

---

## 4. ArgumentBar — Real Data

Currently uses hardcoded demo data. Needs real source:

```typescript
// Compute support vs contradict from item-anchored comments
// "Support": comments with positive fire reactions (> median)
// "Contradict": comments with negative/controversial indicators
function computeArgumentBar(postId: string): { support: number, contradict: number } {
  const comments = await Comment.find({ post_id: postId, list_item_id: { $ne: null } });
  const support = comments.filter(c => c.fire_count >= 3).length;
  const contradict = comments.filter(c => c.fire_count < 3).length;
  const total = support + contradict || 1;
  return { support: Math.round((support/total)*100), contradict: Math.round((contradict/total)*100) };
}
```

Cached in Redis per post, refreshed on new comment/reaction.

---

## 5. Files to Create/Modify

| File | Action | Effort |
|---|---|---|
| `backend/src/lib/argumentCron.ts` | Create — scoring cron | M |
| `backend/src/routes/arguments.ts` | Create — API endpoint | M |
| `backend/src/routes/index.ts` | Modify — register route | S |
| `backend/src/server.ts` | Modify — start cron | S |
| `backend/src/routes/comments.ts` | Modify — velocity tracking | S |
| `frontend/src/app/arguments/page.tsx` | Create — page | L |
| `frontend/src/components/ArgumentCard.tsx` | Create — card | M |
| `frontend/src/components/ArgumentBar.tsx` | Modify — real data | M |
| `backend/src/lib/argumentCron.test.ts` | Create — tests | M |
| `frontend/src/lib/api/endpoints/arguments.ts` | Create — API client | S |

## 6. Implementation Order

1. Backend: argumentCron + velocity tracking
2. Backend: API endpoint + register
3. Frontend: API client + types
4. Frontend: ArgumentCard component
5. Frontend: /arguments page
6. Tests for all
7. Update milestones.md

---

## 7. Edge Cases

- No this_vs_that or counter_list posts exist → empty state
- All arguments are old (>30 days) → Redis zset is empty → empty state
- Redis is down → fall back to database query sorted by created_at
- Comment velocity tracked but no item-anchored comments → show "No specific items debated yet"
- Counter list references a deleted original post → handle gracefully, show "Original post removed"
