# PostFeed Reusable Component

## The Problem

Explore, Articles, and Saved are three pages that all display lists of posts. Building three separate page components creates duplication.

## The Fix

```
Explore  ─┐
Articles ─┼──> PostFeed (reusable)
Saved    ─┘      ├── SortPills
                  ├── DataCard[]
                  └── InfiniteScroll
```

The only thing that changes between them is the API endpoint and the empty state text. The feed layout, card rendering, infinite scroll, and sort controls are identical.

## Implementation

```typescript
<PostFeed 
  endpoint="/api/explore" 
  emptyMessage="No trending posts yet."
/>
```

Three pages become 30 lines each.
