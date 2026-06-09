# Not-Implemented Registry

> **Purpose**: Single authoritative list of all documented-but-not-yet-built pages,
> features, and functionality. When a feature is implemented, remove it from this
> list. Do NOT add speculative items — only features documented elsewhere in the
> codebase belong here.
>
> **Exempt**: Features marked `V2` or `V2.x` are out of scope and MUST NOT be
> removed unless explicitly authorized.

---

## Table of Contents
1. [NOT STARTED — No Code Exists](#1-not-started--no-code-exists)
2. [PARTIAL — Some Code Exists](#2-partial--some-code-exists)
3. [BUGS / NEEDS FIX](#3-bugs--needs-fix)

---

## 1. NOT STARTED — No Code Exists

### 1.1 Counter-List Arena System (M5.6)

Full challenge/rebuttal platform:

- **`POST /api/posts/:slug/counter`** — Create a rebuttal post linked to a parent
- **`GET /api/posts/:slug/counters`** — List all challenges for a post (sortable)
- **`GET /api/posts/compare/:original/:counter`** — Comparison/diff engine showing matched, moved, replaced, and new items
- **`POST /api/posts/compare/:original/:counter/vote`** — Community "Better List" vote
- **`/[slug]/challenge`** — Challenger editor page (6/10 lock constraint, item selection, drag-drop reorder, diff tracker)
- **`/[slug]?vs=[counter-slug]`** — Side-by-side dual-pane comparison view
- **`/[slug]/challenges`** — Challenges gallery directory
- Spark-to-index ratio quality gate (noindex low-quality counters)
- Authority Flip signal — banner when counter surpasses parent by 20% Spark
- SEO independence threshold logic for dynamic robot tagging

### 1.2 Admin Category Tree Frontend — Full UI (M10.7)

Backend endpoints exist (17+ endpoints). Frontend needs:

- Collapsible drag-drop tree view for parent/child hierarchy
- View toggle (Tree / Table / Flat List)
- Inline edit modal with auto-slug generation and duplicate detection
- Status workflow UI (draft / published / hidden)
- Scheduled activation/archival UI
- Category templates (preset icon + description + parent)
- Slug history tracking with redirects on rename
- Circular reference guard (prevent parent pointing to own child)
- Category analytics & health frontend panels (stats, growth, activity)
- Category bulk operations UI (merge, reparent, archive, feature)
- Category RSS feeds (`/c/:slug/feed`)

### 1.3 Post-Level Spark Engine (M5.6.1)

- `spark_score` field on Post model (currently missing)
- 60/40 split: comment weight (0.4) + counter-list weight (0.6)
- Trust multipliers: low-trust (0.0x), medium (1.5x), scholar (2.0x)
- Gamma gravity decay formula with Library Guard floor score

### 1.4 Dynamic Reputation Engine / $R$ (M5.6.2)

- Tiered quality matrix: S-rank (top 5%, 10.0x), A-rank (top 15%, 5.0x), B-rank (top 40%, 2.5x), C-rank (bottom 60%, 1.0x)
- Reputation formula: weighted sum of posts/comments per tier / total submissions
- Trust level thresholds via $R$: Scholar (R >= 7.5), Neutral (R=3.0-7.4), Entry/Troll (R < 3.0)
- Weekly/daily arena seeding

### 1.5 Auth & Stub Endpoints (Return 501)

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `GET /api/listings/*`
- `POST /api/listings/*`
- `PUT /api/listings/:id`
- `DELETE /api/listings/:id`
- `GET /api/reviews/*`
- `POST /api/reviews/*`
- `PUT /api/reviews/:id`
- `DELETE /api/reviews/:id`
- `GET /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

### 1.6 Identity Portability UX (M15 — Missing Pieces)

- "This is your only key. We do not store this." warning UI
- Optional JSON identity file download for seed phrase backup

### 1.7 Reputation Points System

- `reputation_points` field on User model (additive: approval +50, fire +5, counter-list +25, HoF +100, daily visit +3)
- `reputation_badges` field on User model
- Visibility gates (points hidden below trust 1.5)
- 7 unlock tiers requiring points + trust (subcategory submission at 500pts/0.5t, remove `a_` prefix at 2000pts/1.5t, queue priority at 3500pts/1.5t, authority badge at 7500pts/1.8t, auto-HoF at 15000pts/1.8t)
- `/leaderboard` page — top users by reputation (trust >= 1.5 only)

### 1.8 Admin UI Components (M10.14 — 7 Missing)

- `StatsChart` — line/bar chart component
- `CategoryTree` — drag-drop tree view component
- `UserBadge` — trust score badge component
- `SearchInput` — global admin search
- `DateRangePicker` — filter-by-date
- `ExportButton` — CSV/Excel export
- `ConfirmDialog` — destructive action confirmation

### 1.9 Moderation Phases 2-4

- **Phase 2**: AI Pre-Filtering — auto-reject obvious spam/gibberish
- **Phase 3**: Scholar Fast-Track — trust 1.8+ bypasses review queue (5% spot checks)
- **Phase 4**: Community Sovereignty — scholars vote to approve pending posts

### 1.10 Admin Influencer Dashboard — The Arena (M10.15)

- Battle Monitor — posts sorted by `counter_count`
- Duplicate Detection — background utility for alternate spellings
- Manual Trust Adjustment UI tied to reputation score ($R$)

---

## 2. PARTIAL — Some Code Exists

### 2.1 Counter-List Type Integration

- `counter_list` post type in enum ✅
- Unlimited rate limit for counter-lists ✅
- **MISSING**: Rebuttal endpoint, battle view, comparison engine, challenges gallery

### 2.2 Post Type Selector on Submit Page

- Full submit page with draft recovery, title check, dynamic items ✅
- **MISSING**: Only `top_list` is selectable — `this_vs_that`, `who_is_better`, `fact_drop`, `best_of`, `worst_of`, `hidden_gems` types not available in UI

### 2.3 SEO Indexing Guard (M5.5)

- Flat slug routing, JSON-LD, canonical tags ✅
- **MISSING**: Noindex logic for stale/thin posts (comment_count=0 AND view_count=0 AND age>48h, or content_length<100 AND age>24h)
- **MISSING**: Reserved routes guard check on `/[slug]` page

### 2.4 Double-Blind Moderation

- Documented requirement for trust score integrity ✅
- **MISSING**: Username and trust score still visible during review — must be stripped from review UI

### 2.5 User Profile Page (M11.E)

- Profile page with posts/comments tabs ✅
- Profile image upload ✅
- **MISSING**: "Edit Display Name" on own profile
- **MISSING**: "Secure My Authority" seed phrase section
- **MISSING**: Stats tab (rate limit status, remaining counts, reset timers)
- **MISSING**: Trust score badge (Scholar/Neutral/Troll) on profile header
- **MISSING**: Privacy rules — pending/rejected posts only visible to author

### 2.6 ArgumentBar Real Data

- Arguments page with Redis pre-computed scores ✅
- **MISSING**: Support/contradict percentages still hardcoded demo data — needs real fire reaction counts per side

### 2.7 Homepage Refactor — topItems

- DataCard, CommandSearch, DesktopTopBar, DynamicIsland all built ✅
- `GET /api/posts` response includes `topItems` and `totalItems` ✅

### 2.9 Article Fact-Check & Source Enforcement

- Article model, routes, reader page, submission page ✅
- **MISSING**: Source citations enforcement (required per spec)
- **MISSING**: Fact-check status auto-enforcement
- **MISSING**: Revision visibility with diffs

### 2.10 Username Customization

- Profile page edit field exists ✅
- **MISSING**: Currently limited to last 4 chars — should allow ANY suffix length after `a_`

### 2.11 Submit Page — Title Match Display

- Debounced title similarity check works ✅
- **MISSING**: Warning text says "similar list exists" but doesn't show WHICH matching titles and their categories

### 2.12 Category post_count Reconciliation

- Reconciler runs every 5 minutes ✅
- Real-time aggregation in `categories.ts` endpoint — counts always accurate ✅

### 2.13 Hall of Fame — Admin & Public (M10.8/M14)

- Post `featured` field ✅
- Admin feature toggle ✅
- **MISSING**: Admin management page completeness
- **MISSING**: Public endpoint (`GET /api/hall-of-fame`) and public page (`/hall-of-fame`)

### 2.14 Admin Settings — Rate Limits & Trust Scores (M10.11)

- Backend endpoints for config, user overrides, trust history ✅
- Rate limit analytics (user distribution per tier, effective limits) ✅
- Tier threshold impact preview (before saving changes) ✅
- Live effective-limits calculation table (editable preview) ✅
- Admin UI at `/admin/settings/rate-limits` ✅

---

## 3. BUGS / NEEDS FIX

*No open bugs currently. All previously documented issues have been resolved.*

---

## V2 Features (Exempt — Do Not Remove)

These features are explicitly out of scope for V1 and MUST remain in this list
unless explicit authorization to implement is given.

| Feature | Source |
|---------|--------|
| Design Themes (Futuristic, Retro/Myspace) | product_spec.md, ram.md |
| Email Notifications | product_spec.md |
| Post Changelog content revision diffs | ram.md V2.x |
| Disabled Features: registration, logins, OAuth, JWT for users, follow, connection, strike, report, communities, ephemeral threads, badges, multi-account, NextAuth, custom profiles | product_spec.md §14 |
