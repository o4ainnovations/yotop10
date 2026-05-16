# Bookmarks — Separate Collection

## The Problem

`saved_by: string[]` on Post model. Works for 1,000 users. Breaks at 100,000.

MongoDB documents have a 16MB limit. A popular post with 50,000 saves would store 50,000 user_ids in an array — ~1.5MB per post. Array operations on large arrays are slow.

## The Fix

A separate `SavedPost` model with composite index:

```typescript
SavedPost {
  user_id: string      // indexed
  post_id: ObjectId    // indexed
  saved_at: Date
}
// Compound index: { user_id: 1, saved_at: -1 }
```

This scales to millions of saves with O(log n) lookup. One extra query per page load, not one giant array traversal.

## Additional Optimization

Add Redis caching for "is this post saved by this user?" lookups. A `Set` per user in Redis (`saved:posts:{userId}`) gives O(1) checks. Write-through to MongoDB for persistence.
