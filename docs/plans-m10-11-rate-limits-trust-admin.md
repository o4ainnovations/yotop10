# M10.11 — Rate Limits & Trust Scores Admin — Implementation Plan

## Objective

An admin settings page (`/admin/settings`) where the admin can view and configure global rate limits, override individual user rate limits, and manage trust scores. The backend infrastructure already exists — only the admin UI and configuration endpoints are missing.

---

## 1. Current State (Already Built)

| Layer | What Exists |
|---|---|
| **Rate limit engine** | `lib/rateLimit.ts` — calculates effective post/comment limits based on trust tier. Reads `rate_limit_override` and `active_boost` from User model. |
| **Trust score engine** | `lib/trustScore.ts` — calculates trust based on last 50 review decisions. Clamped 0.1–2.0. |
| **Per-user overrides** | `rate_limit_override: { posts_per_hour?, comments_per_hour? }` on User model — admin-set custom limits. Already respected by rate limit engine. |
| **Active boosts** | `active_boost: { posts, comments, expires_at }` on User model — temporary ladder boosts. |
| **Trust score audit** | `TrustScoreLog` model — immutable log of all trust changes. |
| **Global config** | Hardcoded constants: base 4 posts/hr, 20 comments/hr. Trust multipliers (0.5x/1.0x/2.0x). Minimum 2 posts. |
| **User endpoint** | `GET /api/users/me/rate-limits` — returns current user's remaining counts, reset time, tier. |

## 2. What Needs Building

### 2.1 Backend

#### 2.1.1 Global Rate Limit Config (`POST/GET /api/admin/rate-limits`)

Global config stored in Redis with database backup. Why Redis? Rate limits are checked on every request — the config must be readable without a DB query.

```typescript
// GET /api/admin/rate-limits — current config
{
  base: { posts_per_hour: 4, comments_per_hour: 20 },
  tiers: {
    troll:    { multiplier: 0.5, min_posts: 2 },
    neutral:  { multiplier: 1.0, min_posts: 4 },
    scholar:  { multiplier: 2.0, min_posts: 8 }
  },
  counter_lists: { unlimited: true },
  comment_edit_window_minutes: 120
}

// POST /api/admin/rate-limits — update config
// Validated with Zod. Audited. Redis updated + DB backup.
```

#### 2.1.2 Trust Score Tier Configuration (`GET/PATCH /api/admin/trust-tiers`)

```typescript
// GET /api/admin/trust-tiers
{
  troll:    { range: [0.1, 0.49] },
  neutral:  { range: [0.5, 1.79] },
  scholar:  { range: [1.8, 2.0] },
  hysteresis: { enter_scholar: 1.85, lose_scholar: 1.70 },
  review_window: 50,  // last N reviews considered
  double_blind: true  // current double-blind state
}
```

#### 2.1.3 User Rate Limit Override (`PATCH /api/admin/users/:user_id`)

```typescript
// PATCH /api/admin/users/:user_id/rate-limits
{ posts_per_hour: 10, comments_per_hour: 50 }
// Or: { posts_per_hour: null, comments_per_hour: null }  // remove override
```

#### 2.1.4 User Trust Score Management (`PATCH /api/admin/users/:user_id/trust`)

```typescript
// PATCH /api/admin/users/:user_id/trust
{ trust_score: 1.5 }   // manual override
{ trust_locked: true }  // lock trust score (prevent auto-recalculation)
// Requires audit log: TrustScoreLog created for every manual change
```

#### 2.1.5 Trust Score History (`GET /api/admin/users/:user_id/trust-history`)

```typescript
// GET /api/admin/users/:user_id/trust-history?page=1&limit=20
// Returns TrustScoreLog entries for this user
```

### 2.2 Frontend: `/admin/settings`

Four tabs:

#### Tab 1: Global Rate Limits
- Slider/input for base posts_per_hour (1-50)
- Slider/input for base comments_per_hour (1-100)
- Trust tier multipliers table (read-only, formula explanation)
- Save button → POST /api/admin/rate-limits
- Success toast

#### Tab 2: Trust Tiers
- Scholar threshold slider (1.0-2.0, default 1.8)
- Troll threshold slider (0.1-1.0, default 0.5)
- Hysteresis values display
- Review window size display
- Save button

#### Tab 3: User Search
- Search input: find user by username or user_id
- User card: avatar, username, current trust score, current rate limits, restriction status
- Quick actions: override rate limits, set trust score, lock/unlock trust, restrict user, ban user
- Trust score history graph (simple sparkline of last 20 changes)
- Audit log of manual changes for this user

#### Tab 4: Audit Log
- Filterable table of all manual trust/rate limit changes
- Columns: admin, action, user, old_value, new_value, timestamp
- Export CSV

### 2.3 Component: `TrustSparkline`

A tiny inline sparkline showing trust score trend over time:

```typescript
// Props: { data: Array<{ score: number, date: string }> }
// Renders a small SVG polyline (not a chart library — pure SVG, 10 lines)
```

---

## 3. Backend Endpoints Summary

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/admin/rate-limits` | Get global rate limit config |
| `POST` | `/api/admin/rate-limits` | Update global rate limit config |
| `GET` | `/api/admin/trust-tiers` | Get trust tier thresholds |
| `PATCH` | `/api/admin/trust-tiers` | Update trust tier thresholds |
| `PATCH` | `/api/admin/users/:user_id/rate-limits` | Per-user rate limit override |
| `PATCH` | `/api/admin/users/:user_id/trust` | Manual trust score adjustment |
| `PATCH` | `/api/admin/users/:user_id/restrict` | Ban/restrict user |
| `GET` | `/api/admin/users/:user_id/trust-history` | Trust score change history |
| `GET` | `/api/admin/users` | List users (already partially exists in stats — need full listing) |

---

## 4. Files to Create/Modify

| File | Action | Effort |
|---|---|---|
| `backend/src/routes/admin.ts` | Add 8 endpoints to existing admin routes | L |
| `backend/src/lib/rateLimitConfig.ts` | Redis-cached global config with DB fallback | M |
| `backend/src/lib/rateLimitConfig.test.ts` | Tests for config read/write, Redis caching, DB fallback | M |
| `frontend/src/app/admin/settings/page.tsx` | Admin settings page with 4 tabs | L |
| `frontend/src/components/TrustSparkline.tsx` | SVG sparkline component | S |
| `frontend/src/components/TrustSparkline.test.tsx` | Tests | S |
| `frontend/src/lib/api/endpoints/admin.ts` | Add API client functions for new endpoints | M |
| `backend/src/routes/admin.ts` (tests) | Integration tests for new endpoints | M |
| `docs/milestones.md` | Mark M10.11 checkboxes [x] | S |
| `docs/build-status.md` | Move to FULLY BUILT | S |

---

## 5. Edge Cases

| Case | Handling |
|---|---|
| **Redis down during config read** | Fall back to DB backup. DB backup written on every config change. |
| **Redis down during rate limit check** | Rate limit lib uses hardcoded defaults if no Redis config available. Already implemented. |
| **Manual trust score set below 0.1 or above 2.0** | Zod validation rejects. Must be in [0.1, 2.0]. |
| **Setting trust_locked prevents recalculation** | Trust engine checks `trust_locked` before auto-updating. Already implemented. |
| **User not found for override** | 404 with user_id in error message. |
| **Changing rate limits while users are mid-session** | Existing requests complete with old limits. New requests use new config. |
| **Concurrent admin updates** | Last-write-wins for config. Audit log records both changes. Per-user overrides are atomic (findOneAndUpdate). |

---

## 6. Test Strategy

### Backend (15+ tests)
- `rateLimitConfig.test.ts`: Redis read/write, DB fallback, default values, validation
- Admin route tests: GET/POST rate-limits, GET/PATCH trust-tiers, PATCH user overrides, trust history pagination, invalid trust values rejected, unauthorized access returned 401

### Frontend (10+ tests)
- `TrustSparkline.test.tsx`: renders, handles empty data, handles single point, handles 20+ points
- `admin/settings` page tests: tabs render, form submission, error handling

---

## 7. Implementation Order

1. Backend: `rateLimitConfig.ts` + tests
2. Backend: Admin endpoints in `admin.ts` + tests
3. Frontend: API client updates
4. Frontend: `TrustSparkline` component + tests
5. Frontend: `/admin/settings` page with 4 tabs
6. Documentation updates
