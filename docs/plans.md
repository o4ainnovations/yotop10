# Implementation Plan: Rate Limit Trust Score Fix
**Date**: 2026-04-19
**Target**: Production deployment 2026-04-19
**Approach**: 2D Rate Limiting with Soft Gradient Floor

---

## Problem Statement
Current implementation allows users with trust score < 0.25 to get 0 posts/hour, effectively permanently and silently banned. This violates documented behavior and creates poor user experience.

---

## Selected Approach
Combination of **soft gradient floor** + **hard minimum guarantee** (2D rate limiting) to produce exactly this behavior:

| Raw Trust | Effective Trust | Rate Limit |
|-----------|-----------------|------------|
| 0.1       | 0.55            | 2 posts/hr |
| 0.3       | 0.65            | 2 posts/hr |
| 0.5       | 0.75            | 3 posts/hr |
| 0.7       | 0.85            | 3 posts/hr |
| 0.9       | 0.95            | 3 posts/hr |
| 1.0       | 1.0             | 4 posts/hr |
| 2.0       | 2.0             | 8 posts/hr |

---

## Implementation Steps

### Phase 1: Core Library Creation (30 mins)
1. **Create new file**: `backend/src/lib/rateLimit.ts`
2. Implement `calculateEffectivePostLimit()` function
3. Implement `calculateEffectiveCommentLimit()` function
4. Implement `getCurrentRateLimitStatus()` function for profile
5. Export all constants and functions
6. Add unit tests

### Phase 2: Integration (15 mins)
1. Update `posts.ts:63` to use the new function
2. Update `comments.ts:302` to use the new function
3. **Add exception**: Counter-list post type has NO rate limit
4. Verify admin overrides are applied **after** this calculation
5. Update rate limit error messages to show actual limit

### Phase 3: Profile Stats Endpoint (20 mins)
1. Add GET `/api/users/me/rate-limits` endpoint
2. Returns real-time remaining counts for all actions
3. Calculates remaining posts, comments, reactions
4. Returns reset timestamps and current trust score

### Phase 4: Frontend Profile Stats Tab (25 mins)
1. Add "Stats" tab to user profile page
2. Real-time auto-updating counters:
   - Posts remaining this hour
   - Comments remaining this hour
   - Reactions remaining this hour
3. Shows current trust score and tier
4. Shows reset countdown timer

### Phase 5: Validation & Testing (20 mins)
1. Manual test all trust score tiers
2. Verify admin overrides still work correctly
3. Verify edge cases (trust 0.0, trust 0.249, trust 0.251)
4. Verify counter lists are 100% unlimited
5. Verify profile stats update correctly after each action
6. Run full test suite

### Phase 6: Deployment (10 mins)
1. Deploy to staging
2. Monitor rate limit metrics for 1 hour
3. Deploy to production
4. Add monitoring alert for users hitting rate limit floor

---

## Exact Code Changes

### 1. backend/src/lib/rateLimit.ts
```typescript
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
export const BASE_COMMENTS_PER_HOUR = 50;
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
  return Math.max(MINIMUM_POSTS_PER_HOUR, Math.round(proportional));
}

export function calculateEffectiveCommentLimit(trustScore: number): number {
  const effectiveTrust = trustScore < 1.0 
    ? 0.5 + (trustScore * 0.5)
    : trustScore;

  const proportional = BASE_COMMENTS_PER_HOUR * effectiveTrust;
  
  return Math.max(MINIMUM_COMMENTS_PER_HOUR, Math.round(proportional));
}
```

### 2. backend/src/routes/posts.ts
```typescript
import { calculateEffectivePostLimit } from '../lib/rateLimit';

const checkRateLimit = async (fingerprint: string, trustScore: number = 1.0): Promise<{ allowed: boolean; remaining: number; resetTime: number }> => {
  // ... existing setup ...
  
  const maxRequests = calculateEffectivePostLimit(trustScore);
  
  // ... rest of existing logic ...
}
```

### 3. backend/src/routes/comments.ts
```typescript
import { calculateEffectiveCommentLimit } from '../lib/rateLimit';

const checkCommentRateLimit = async (fingerprint: string, trustScore: number = 1.0): Promise<{ allowed: boolean; remaining: number; resetTime: number }> => {
  // ... existing setup ...
  
  const limit = calculateEffectiveCommentLimit(trustScore);
  
  // ... rest of existing logic ...
}
```

### 4. Error Message Fix
Update posts.ts:365 error message to:
```typescript
error: `Rate limit exceeded. You can submit ${maxRequests} posts per hour.`,
```

---

## Acceptance Criteria
✅ No user ever gets 0 posts/hour for any trust score > 0
✅ Users at trust 0.1 get exactly 2 posts/hour
✅ Users at trust 0.5 get exactly 3 posts/hour
✅ Users at trust 1.0 get exactly 4 posts/hour
✅ Users at trust 2.0 get exactly 8 posts/hour
✅ Admin rate limit overrides work exactly as before
✅ All existing tests pass
✅ Rate limit error messages show correct limit

---

## Rollback Plan
If any issues are detected after deployment:
1. Revert commit
2. No data migration required
3. All behavior returns to previous state immediately

---

## User Profile Stats Feature
### Endpoint Response Format
`GET /api/users/me/rate-limits`
```json
{
  "trust_score": 0.72,
  "current_tier": "Neutral",
  "limits": {
    "posts": {
      "total": 3,
      "remaining": 2,
      "reset_in_seconds": 2145
    },
    "comments": {
      "total": 36,
      "remaining": 31,
      "reset_in_seconds": 2145
    },
    "counter_lists": {
      "total": "Unlimited",
      "remaining": "Unlimited",
      "reset_in_seconds": null
    }
  }
}
```

### Frontend Display
Profile page tabs:
1. Posts
2. Comments
3. ⭐ **Stats** (new)

Stats tab shows:
- Current trust score with progress bar to next tier
- Live countdown timers for rate limit resets
- Real-time remaining counts that update automatically after each action
- Clear explanation of what each tier means

---

## Unlimited Counter Lists Confirmation
✅ **ALL USERS CAN SUBMIT UNLIMITED COUNTER LISTS**
- No rate limit applies to counter_list post type
- Works for every trust tier: Troll, Neutral, Scholar
- No exceptions, no overrides
- This is an explicit platform design decision

---

## Post Deployment Monitoring
- Monitor count of users hitting minimum rate limit
- Monitor support tickets for rate limit complaints
- Check trust score distribution changes after 7 days
- Verify no increase in spam volume
- Monitor counter list submission rate
- Track profile stats page usage

---

## Long Term Improvements (Post 2.0)
1. Add per-endpoint configurable limits
2. Add trust score tier indicator in UI
3. Add transparent rate limit status in user profile
4. Add gradual warning system as users approach limits
