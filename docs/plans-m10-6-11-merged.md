# M10.6 + M10.11 — Users & Trust Administration — Enterprise Plan

## Rationale for Merging

M10.6 (Users Management) and M10.11 (Rate Limits & Trust Admin) are inseparable. Every user management action (ban, whitelist, rate override) requires trust/rate infrastructure. Every rate/trust setting needs a user to apply it to. The `/admin/users` page is the natural home for ALL of this. No fragmented UX. No duplicated user search. One page, one system, one source of truth.

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  /admin/users                                           │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │  [Search user...]  [Trust: All ▾]  [Status: All ▾] ││
│  │  [Global Rate Limits]  [Trust Tiers]                ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │  User Table                                         ││
│  │  ─────────                                         ││
│  │  Avatar  Username   Trust    Tier    Rate    Posts  ││
│  │  [A]     a_9Gh7     1.85    Sch    8/h     12     ││
│  │  [B]     a_Km3x     0.30    Troll  2/h     3      ││
│  │  ...                                                ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │  User Detail Panel                                  ││
│  │  ────────────────                                   ││
│  │  [Ban] [Shadow Ban] [Lock Trust] [Override Rate]   ││
│  │  [Trust History Sparkline]  [Audit Log]             ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Configuration stored in-memory + Redis + MongoDB

```
Admin saves config
      │
      ├── Redis (primary, sub-ms reads)
      ├── MongoDB configs collection (persistent backup)
      └── Node process memory (0ms reads, refreshed every 60s)
```

This 3-layer cache ensures:
- Sub-ms reads during rate limit checks (process memory)
- Instant propagation on admin save (Redis pub/sub could notify all instances)
- Survival across restarts (MongoDB)
- No single point of failure (any layer missing → fallback to next)

---

## 2. Backend

### 2.1 Global Config Store (`lib/systemConfig.ts`)

```typescript
interface SystemConfig {
  rate_limits: {
    base_posts_per_hour: number;
    base_comments_per_hour: number;
    tiers: {
      troll: { multiplier: number; min_posts: number };
      neutral: { multiplier: number; min_posts: number };
      scholar: { multiplier: number; min_posts: number };
    };
    counter_lists_unlimited: boolean;
    comment_edit_window_minutes: number;
  };
  trust_tiers: {
    troll_max: number;
    neutral_min: number;
    scholar_min: number;
    hysteresis_enter: number;
    hysteresis_lose: number;
    review_window: number;
    double_blind: boolean;
  };
  updated_at: Date;
  updated_by: string;
}

// Memory cache (0ms reads)
let memoryConfig: SystemConfig | null = null;

// Initialize on boot: MongoDB → memory
export async function initConfig(): Promise<void> { ... }

// Periodic refresh (every 60s)
export function startConfigRefresh(): void { ... }

// Get current config (used by rate limit engine — 0ms)
export function getConfig(): SystemConfig { ... }

// Update config (used by admin endpoint)
export async function updateConfig(changes: Partial<SystemConfig>, adminId: string): Promise<SystemConfig> {
  // 1. Write to MongoDB
  // 2. Write to Redis (with 24h TTL as safety net)
  // 3. Update memory cache immediately
  // 4. Log audit entry
  // 5. Return new config
}
```

### 2.2 Admin Endpoints (all in `routes/admin.ts`)

| # | Endpoint | Purpose |
|---|----------|---------|
| 1 | `GET /admin/users` | Paginated user listing with search, filter, sort |
| 2 | `GET /admin/users/:user_id` | Single user detail with stats |
| 3 | `PATCH /admin/users/:user_id/restrict` | Ban (set restricted_until) |
| 4 | `DELETE /admin/users/:user_id/restrict` | Unban (clear restricted_until) |
| 5 | `PATCH /admin/users/:user_id/rate-limits` | Per-user rate limit override |
| 6 | `PATCH /admin/users/:user_id/trust` | Manual trust score adjustment |
| 7 | `GET /admin/users/:user_id/trust-history` | Trust score change log |
| 8 | `GET /admin/config` | Get current system config |
| 9 | `PUT /admin/config` | Update system config |
| 10 | `GET /admin/config/impact` | Preview impact of proposed config change |

### 2.3 User Listing Query (`GET /admin/users`)

```typescript
// Query params: page, limit, q (search), trust_tier, status, sort, sort_dir
// Returns:
{
  users: [{
    user_id, username, custom_display_name,
    trust_score, trust_locked, trust_tier,
    restricted_until, rate_limit_override,
    post_count, comment_count, posts_approved, posts_rejected,
    created_at, last_active_at, profile_image_url
  }],
  pagination: { page, limit, total, totalPages },
  filters: {
    trust_tiers: { troll: 12, neutral: 340, scholar: 8 },
    statuses: { active: 350, restricted: 10 }
  }
}
```

### 2.4 Trust Score Adjustment (`PATCH /admin/users/:user_id/trust`)

```typescript
// Body: { trust_score: 1.5 }   // manual override
// Body: { trust_locked: true }  // lock/unlock
// Body: { trust_score: 1.5, trust_locked: true }  // both

// Rules:
// 1. Score must be in [0.1, 2.0]
// 2. Manual override sets trust_locked = true (prevent auto-recalc)
// 3. Log TrustScoreLog entry with admin_id, old_value, new_value, reason
// 4. Audit log entry
// 5. If trust_locked is explicitly set to false, allow auto-recalc again
```

### 2.5 Config Impact Preview (`GET /admin/config/impact`)

Returns counts of users that would be affected by a proposed config change BEFORE the admin commits it:

```typescript
// Query: ?base_posts_per_hour=8&scholar_min=1.5
// Returns:
{
  users_affected: 356,
  tier_changes: { to_scholar: 24, from_scholar: 3 },
  rate_changes: { increased: 350, decreased: 6 },
  sample_users: [{ user_id: '...', old_rate: 4, new_rate: 8 }, ...]
}
```

### 2.6 Restrict/Ban (`PATCH /admin/users/:user_id/restrict`)

```typescript
// Body: { restricted_until: "2026-06-15T00:00:00Z" }  // temporary ban
// Body: { restricted_until: null }                        // unban
// Body: { restricted_until: "2099-01-01T00:00:00Z" }    // permanent ban

// The middleware already checks restricted_until on every request
// for POST /api/posts and POST /api/posts/:id/comments.
// No middleware change needed.
```

---

## 3. Frontend: `/admin/users`

### 3.1 Layout

```
┌──────────────────────────────────────────────────────────┐
│  Users                                     [Global Config]│
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  🔍 [Search by username or ID...]                        │
│                                                          │
│  Trust: [All ▾]  Status: [All ▾]  Sort: [Newest ▾]     │
│                                                          │
│  ┌──────────────────────────────────────────────────────┐│
│  │ User              │ Trust    │ Posts │ Rate │ Actions ││
│  │ ────────────────  │ ──────── │ ───── │ ──── │ ─────── ││
│  │ [A] a_9Gh7        │ 1.85 Sch│ 12    │ 8/h  │ [... ▾]││
│  │ 12 posts · 47 cmt │ ↗ trend  │ 3 pen │      │        ││
│  │ ────────────────  │ ──────── │ ───── │ ──── │ ─────── ││
│  │ [T] a_Km3x        │ 0.30 Tro│ 3     │ 2/h  │ [... ▾]││
│  │ ⚠ restricted      │ ↘ locked │ 0 pen │      │        ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ← Prev   Page 1 of 18   Next →                         │
└──────────────────────────────────────────────────────────┘
```

### 3.2 User Row

Each row shows:
- Avatar (profile image or first-letter fallback)
- Username + custom display name
- Trust score + tier badge (color-coded: green scholar, gray neutral, red troll)
- Trust trend sparkline (last 10 TrustScoreLog entries as mini SVG)
- Post count (total) + pending count
- Comment count
- Effective rate limit
- Restriction status (⚠ if restricted)
- Trust lock status (🔒 if locked)
- Actions dropdown: View Profile, Edit Trust, Override Rate Limits, Restrict/Ban, View History

### 3.3 Actions Dropdown — Per-User Modals

**Edit Trust Modal:**
- Current trust score display
- Slider: 0.1 – 2.0 (snaps to 0.05 increments)
- Live tier preview: "This will make them a Scholar"
- Trust lock checkbox: "Lock trust score (prevent auto-recalculation)"
- Reason text field (optional, stored in TrustScoreLog)
- Warning: "Manual trust adjustments are permanent and audited."
- Save / Cancel

**Override Rate Limits Modal:**
- Current effective limits display
- "Use tier defaults" toggle
- Posts per hour input (disabled if toggle on)
- Comments per hour input (disabled if toggle on)
- "Clear override" button (removes rate_limit_override)
- Save / Cancel

**Restrict/Ban Modal:**
- Current restriction status
- Temporary ban: date picker for `restricted_until`
- Permanent ban: "Restrict indefinitely" toggle
- Unban: "Remove restriction" button
- Save / Cancel

**Trust History Panel (inline expand):**
- Table of last 20 TrustScoreLog entries
- Columns: date, admin, old_value, new_value, reason
- Pagination if >20

### 3.4 Global Config Modal

Opened from the "Global Config" button in the header.

Two tabs:

**Tab 1: Rate Limits**
- Base posts per hour slider (1-50, default 4)
- Base comments per hour slider (1-100, default 20)
- Live tier calculation table:
  ```
  Troll:    4 × 0.5 = 2/h  (min 2)
  Neutral:  4 × 1.0 = 4/h
  Scholar:  4 × 2.0 = 8/h
  ```
- Counter lists unlimited toggle
- Comment edit window (minutes) input
- **Impact Preview** button: shows how many users are affected
- Save button

**Tab 2: Trust Tiers**
- Scholar threshold slider (1.0-2.0, default 1.8)
- Troll threshold slider (0.1-1.0, default 0.5)
- Hysteresis values (computed: enter = threshold + 0.05, lose = threshold - 0.10)
- Review window size (10-100, default 50)
- Double-blind toggle
- **Impact Preview**: "24 users would become scholars, 3 would lose scholar status"
- Save button

---

## 4. Component: `TrustSparkline`

Pure SVG, zero dependencies. ~35 lines.

```tsx
// Props: { data: number[], width?: number, height?: number }
// Maps data points to a smooth SVG polyline
// Color: green if trend is up, red if down, gray if flat
// No axes, no labels — pure sparkline
```

---

## 5. Component: `ImpactPreview`

Shown before saving config changes:

```
┌─────────────────────────────────────────────┐
│  ⚠ This change will affect 356 users        │
│                                             │
│  Tier changes:                              │
│    24 users → Scholar                       │
│    3 users → Neutral (lost Scholar)         │
│                                             │
│  Rate changes:                              │
│    350 users get increased limits           │
│    6 users get decreased limits             │
│                                             │
│  [Cancel]  [Commit Changes]                 │
└─────────────────────────────────────────────┘
```

Data from `GET /admin/config/impact?base_posts_per_hour=8&scholar_min=1.5`.

---

## 6. Files

| File | Action | Effort |
|---|---|---|
| `backend/src/lib/systemConfig.ts` | Create — 3-layer config store | M |
| `backend/src/lib/systemConfig.test.ts` | Create — 12+ tests | M |
| `backend/src/routes/admin.ts` | Add 10 endpoints | L |
| `backend/src/models/SystemConfig.ts` | Create — MongoDB config doc | S |
| `frontend/src/app/admin/users/page.tsx` | Create — main page | L |
| `frontend/src/components/TrustSparkline.tsx` | Create — SVG sparkline | S |
| `frontend/src/components/ImpactPreview.tsx` | Create — config impact | S |
| `frontend/src/components/UserRow.tsx` | Create — table row | M |
| `frontend/src/components/EditTrustModal.tsx` | Create — modal | M |
| `frontend/src/components/OverrideRateModal.tsx` | Create — modal | M |
| `frontend/src/components/RestrictUserModal.tsx` | Create — modal | M |
| `frontend/src/components/GlobalConfigModal.tsx` | Create — modal | L |
| `frontend/src/lib/api/endpoints/admin.ts` | Update — add new endpoints | M |
| `backend/src/routes/admin.test.ts` | Additional test cases | M |
| `frontend/tests/` | Component tests | M |
| `docs/milestones.md` | Mark M10.6 + M10.11 [x] | S |
| `docs/build-status.md` | Update counts | S |

---

## 7. Production Safeguards

| Concern | Safeguard |
|---|---|
| **Config corruption** | MongoDB stores last 10 config versions. Admin can rollback. |
| **Concurrent admin edits** | Optimistic concurrency via `updated_at`. Second save gets 409 with "Config was modified by [admin] at [time]. Refresh and retry." |
| **Mass ban prevention** | Pagination (50/page). No "select all" for ban. Must act per-user or per-visible-page. |
| **Rate limit DoS via config** | Base posts/hour capped at 50. Base comments/hour capped at 200. Enforced in Zod schema. |
| **Trust score injection** | Scores validated: must be number, [0.1, 2.0], no NaN, no Infinity. Zod strict mode. |
| **Audit trail** | Every config change, trust adjustment, rate override, and ban is logged via `logAudit()` with admin_id, IP, old/new values. |
| **Double-blind integrity** | Config cannot disable double-blind while posts are pending review. Check before save. |

---

## 8. Edge Cases

| Case | Handling |
|---|---|
| **Redis down during config save** | Config saved to MongoDB. Memory cache updated. Redis written on next success. |
| **MongoDB down during config save** | 500 error. Config NOT saved. No partial state. |
| **Memory cache stale** | 60s refresh. Admin save forces immediate refresh. |
| **User deleted while viewing** | 404 on action. Row removed from table. Toast notification. |
| **Setting trust_locked=true then setting trust score** | Trust stays locked. Score updated. Audit logged. |
| **Banning an already banned user** | Extend restricted_until. Log with previous and new dates. |
| **First-time server start with no config** | Seed defaults from code constants. Write to MongoDB + memory. |
| **Multiple server instances (horizontal scaling)** | Config saved to MongoDB is the source of truth. Memory caches refresh independently. No cross-instance sync needed for config (60s staleness is acceptable). |

---

## 9. Test Strategy

### Backend (20+ tests)
- `systemConfig.test.ts`: init from MongoDB, refresh from MongoDB, memory cache hit, Redis write, fallback to defaults when MongoDB empty, concurrent save conflict detection
- Admin endpoint tests: user listing (search, filter by trust tier, filter by status, pagination), restrict/unrestrict, rate limit override, trust adjustment (valid range, locked behavior, audit log), trust history pagination, config CRUD, config impact preview, unauthorized access returns 401

### Frontend (15+ tests)
- `TrustSparkline.test.tsx`: renders, empty data, single point, 20+ points, upward trend (green), downward trend (red), flat trend (gray)
- `ImpactPreview.test.tsx`: renders with data, handles zero affected, cancel and commit buttons
- `UserRow.test.tsx`: renders scholar/neutral/troll tiers, shows restriction status, shows trust lock

---

## 10. Implementation Order

1. Backend: `systemConfig.ts` + MongoDB config seeding + tests
2. Backend: 10 admin endpoints + tests
3. Frontend: API client updates
4. Frontend: `TrustSparkline` + `ImpactPreview` components + tests
5. Frontend: `UserRow` + modal components (EditTrust, OverrideRate, RestrictUser)
6. Frontend: `/admin/users` page with table + search + filters
7. Frontend: `GlobalConfigModal` with two tabs + impact preview
8. Documentation updates
