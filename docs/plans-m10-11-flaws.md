# M10.11 Plan — Flaw & Inconsistency Review

## FLAW 1: Global Config Cold Start
**Problem**: Config stored in Redis. On server restart, Redis is empty. Rate limit engine falls back to hardcoded defaults. Admin's carefully tuned config is silently lost until they re-save it.

**Fix**: Add a `seedDefaultConfig()` call in server startup that writes hardcoded defaults to Redis IF no config key exists. Also store in a `PlatformConfig` MongoDB collection as persistent backup. On Redis miss, read from MongoDB.

---

## FLAW 2: M10.11 vs M10.6 Scope Overlap
**Problem**: The plan's "User Search" tab requires a user listing/search endpoint (`GET /api/admin/users?q=...`). This IS part of M10.6 (Users Management), which is NOT BUILT. The plan silently depends on an unbuilt feature.

**Fix**: Either:
- (A) Build the minimal user search endpoint as part of M10.11 — just `GET /api/admin/users?q=search&limit=20` returning `[{ user_id, username, trust_score, restricted_until, rate_limit_override }]`. Leave the full user management table (ban/whitelist/export) for M10.6.
- (B) Merge M10.6 into M10.11 and build both together. M10.6 is already small (just user listing + actions). Building a `/admin/users` page alongside `/admin/settings` avoids duplicating the user search component.

**Recommendation**: Merge M10.6 + M10.11 into one milestone. The user search component is needed by both. Building them separately creates a dependency that doesn't need to exist.

---

## FLAW 3: Trust Score Adjustment Without Lock
**Problem**: Admin sets `trust_score = 2.0` for a user. Next time that user's post is approved/rejected, the auto-recalculation engine overwrites the admin's manual value. The admin's change is silently reverted.

**Fix**: When an admin manually sets a trust score, automatically set `trust_locked = true`. The auto-recalculation engine already checks `trust_locked` and skips locked users (per trustScore.ts). Add a warning in the UI: "Setting a manual trust score locks it permanently. Auto-recalculation will be disabled for this user."

---

## FLAW 4: Tier Threshold Changes Are Retroactive
**Problem**: Admin changes scholar threshold from 1.8 to 1.5. Every user at 1.5 instantly becomes a scholar — their rate limits double, their `a_` prefix drops. No warning, no migration, no user notification. This could create chaos.

**Fix**: Show a "Impact Preview" in the UI before saving:
- "This change will affect X users"
- "Y users will become scholars"  
- "Z users will lose scholar status"
- "Commit changes" button after preview

Also: log the threshold change in AuditLog with the old and new values.

---

## FLAW 5: Audit Log Tab Duplicates M10.12
**Problem**: The plan has a "Tab 4: Audit Log" in `/admin/settings`. M10.12 already has `/admin/audit` with full filtering, pagination, CSV export. This creates two places to view the same data.

**Fix**: Replace Tab 4 with a link to `/admin/audit?action=trust_override,rate_limit_change` (filtered view). Don't rebuild audit log UI inside settings. Instead, show a "Recent Activity" card with the last 5 trust-related audit entries and a "View All" link.

---

## FLAW 6: Base Rate Change Ripple Effect
**Problem**: The plan lets admin change `base_posts_per_hour` from 4 to 10. This multiplies through ALL tiers. A scholar goes from 8 to 20 posts/hr. There's no preview of the effective limits per tier.

**Fix**: Add a live calculation table below the base limit slider:

```
Troll:   10 × 0.5 = 5 posts/hr (min 2)
Neutral: 10 × 1.0 = 10 posts/hr
Scholar: 10 × 2.0 = 20 posts/hr
```

Update in real-time as the slider moves.

---

## FLAW 7: Rate Limit Middleware Doesn't Read Redis Config
**Problem**: The plan assumes the rate limit middleware reads from Redis. But `lib/rateLimit.ts` currently uses hardcoded constants: `calculateEffectivePostLimit(trustScore)` returns 2/4/8 based on FIXED trust thresholds. Adding Redis reads to every rate-limited request adds latency, even if sub-ms.

**Fix**: Cache the config in memory on the Node process. Refresh from Redis every 60s (or on admin save). Memory read is 0ms. The cron pattern already used elsewhere (alertEngine, sparkScore) proves this works.

```typescript
let cachedConfig: RateLimitConfig = DEFAULT_CONFIG;

// Refresh every 60s
setInterval(async () => {
  const redisConfig = await redis.get('admin:rate_limits');
  if (redisConfig) cachedConfig = JSON.parse(redisConfig);
}, 60000);

// On admin save, refresh immediately
export function refreshConfig() { ... }
```

---

## FLAW 8: No Rate Limit Analytics
**Problem**: The admin can CHANGE rate limits but can't SEE the impact. Are users hitting the limit? Which tier is most restricted? No data = no informed decisions.

**Fix**: Add a small analytics section to the Global Rate Limits tab:
- "Users hitting post limit in last 24h: X"
- "Users hitting comment limit in last 24h: Y"
- "Average remaining posts per user: Z"

These can be fetched from existing Redis rate limit keys (just count keys matching `rate:*`). Lightweight, no new collection needed.

---

## INCONSISTENCY 1: `/api/admin/users/:user_id/restrict` Already Exists
The User model has `restricted_until`. The admin routes in `admin.ts` may already have a way to set this. If so, the plan shouldn't re-implement it — just link to the existing endpoint.

**Check**: Search `admin.ts` for `restricted_until` — if an endpoint already exists, remove the `/restrict` endpoint from this plan.

---

## INCONSISTENCY 2: TrustScoreLog vs `last_50_reviews`
The User model has `last_50_reviews` — a rolling buffer used by the trust engine. The `TrustScoreLog` model is a SEPARATE immutable audit trail. The plan for "trust history" should use TrustScoreLog (permanent), not last_50_reviews (rotating).

**Clarification needed**: The plan says "Trust score history graph (simple sparkline of last 20 changes)". This should pull from `TrustScoreLog`, not from User.last_50_reviews.

---

## UPDATED SCOPE (After Flaw Fixes)

| Endpoint | Keep? | Reason |
|---|---|---|
| `GET/POST /api/admin/rate-limits` | YES | Core feature — with memory caching |
| `GET/PATCH /api/admin/trust-tiers` | YES | With impact preview |
| `GET /api/admin/users?q=` | YES | Minimal — just for settings search. Full listing in M10.6. |
| `PATCH /api/admin/users/:id/rate-limits` | YES | Already supported by model |
| `PATCH /api/admin/users/:id/trust` | YES | With auto-lock |
| `GET /api/admin/users/:id/trust-history` | YES | From TrustScoreLog |
| `POST /api/admin/users/:id/restrict` | REMOVE | Check if already exists in admin.ts |
| Audit Log tab | REPLACE | Link to /admin/audit filtered |
