# YoTop10 — Build Status (Re-Evaluated)

> Updated after architecture review + feature additions. 2026-05-15.

---

## FULLY BUILT (47 items)

| # | Feature | Milestone |
|---|---------|-----------|
| 1 | Project foundation (Next.js 15, Express, MongoDB, Redis, ES, Docker, CI/CD) | M1 |
| 2 | Database schema — all 10+ collections | M2 |
| 3 | Post submission (validation, rate limit, fingerprint, draft recovery, WCAG) | M3 |
| 4 | Title similarity check (Damerau-Levenshtein, year detection, format validation) | M3.1 |
| 5 | Public feed (API + SSR homepage + infinite scroll) | M4 |
| 6 | Post detail (items, comments, reactions, changelog link) | M5 |
| 7 | SEO slug routing (`/[slug]`, `/post/[id]` removed, canonical) | M5.5 |
| 8 | Categories system (310 entries, nested slugs, hierarchy) | M6 |
| 9 | Category management — backend (CRUD, bulk, analytics, export, 17+ endpoints) | M10.7 |
| 10 | Comment system (nested 10 levels, item-anchored, 2hr edit window, rate limit) | M7 |
| 11 | Fire reactions (toggle on comments, spark recalculation, ladder boost) | M8 |
| 12 | Admin authentication (JWT, brute force, token versioning, setup token, account lock) | M9 |
| 13 | Notification system (Toast, bell badge, admin-to-user, mark-read) | M9.1 |
| 14 | Admin dashboard + 26 stats endpoints + 21-panel statistics UI | M10.1-2 |
| 15 | Review queue (approve/reject/retry, bulk ops, collision detection) | M10.3 |
| 16 | Posts management (CRUD, feature, lock, bump, bulk, export) | M10.4 |
| 17 | Advanced post operations (duplicate, item CRUD, revisions, quality check, compare, activity) | Ghost |
| 18 | Comments management (CRUD, flag, hide, highlight, bulk) | M10.5 |
| 19 | Advanced comment operations (penalty, dismiss-flag, unhide, unhighlight, stats, export) | Ghost |
| 20 | Outbound messaging (AdminMessage, templates, individual+broadcast, 7 endpoints, frontend) | M10.9b |
| 21 | Alert system (12 metrics, threshold CRUD, breach/resolution, cooldown) | M10.9 |
| 22 | Search backend (4 ES indices, facets, highlights, did-you-mean, admin) | M12 |
| 23 | Search frontend (autocomplete, filters, tabs, pagination, URL sharing) | M12 |
| 24 | Search analytics system (4 models, hourly cron, click beacon, 9 analytics endpoints) | Ghost |
| 25 | Audit logs (90-day TTL, CSV export, filtering, Redis-cached stats) | M10.12 |
| 26 | User system (GET/PATCH /me, trust tiers, rate limits endpoint) | M11.A-D |
| 27 | User profile page (3 tabs, posts/comments/stats, edit name, trust display) | M11.E |
| 28 | Identity portability (7 endpoints, BIP39, ed25519, multi-device, claim page) | M15 |
| 29 | SecureMyAuthority + SeedDisplayModal + DeviceManager | M15 UX |
| 30 | Post changelog (version history, side-by-side comparison, edit tracking) | V2.2 |
| 31 | Profile image upload (200×200 WebP, first-letter fallback, NavUserAvatar) | Ghost |
| 32 | Image upload system (multer, sharp WebP, 3 variants, express.static) | Ghost |
| 33 | Design system (glassmorphism CSS, spatial shadows, neon borders, wiki badges) | Ghost |
| 34 | Font system (Geist Sans, Geist Mono, Anton, Monoton) | Ghost |
| 35 | Dark/light toggle (ThemeToggle, localStorage persistence) | V2.1 |
| 36 | Mobile-first responsive (DynamicIsland, DesktopTopBar, breakpoints) | Ghost |
| 37 | 12 premium UI components (GlassSlab, DataCard, CommandSearch, etc.) | Ghost |
| 38 | Trust & identity infrastructure (TrustScoreLog, UsernameHistory, etc.) | Ghost |
| 39 | Ladder system (temporary boosts for low-trust users) | Ghost |
| 40 | Fingerprint cross-browser matching (Tier 0/1/2 signals, 90-day TTL) | Ghost |
| 41 | Ghost frontend pages (`/username-history`, `/notifications`, `/notifications/[id]`) | Ghost |
| 42 | 29 test files, 475 tests, zero failures | Ghost |
| 43 | Hydration immune system (lib/dates.ts, suppressHydrationWarning, modelRegistry) | Ghost |
| 44 | 8 architecture decision documents (docs/architecture-*.md) | Ghost |
| 45 | Bookmark/save system (SavedPost model, bookmarkService, Redis cache, 4 endpoints) | M16.3 |
| 46 | BookmarkButton component (optimistic toggle, Lucide icon) | M16.3 |
| 47 | Saved posts page (`/saved`) | M16 |

---

## PARTIALLY BUILT (7 items)

| # | Feature | Done | Missing | Milestone | Blockers |
|---|---------|------|---------|-----------|----------|
| 1 | Admin Categories page | Backend fully built. Page exists. | Drag-drop tree, status UI, templates | M10.7 | None |
| 2 | Admin Notifications page | Backend fully built. Page exists. | User-facing message endpoint verification | M10.9b | None |
| 3 | Admin Search page | Backend fully built. Page exists. | — | M10.10 | None |
| 4 | Hall of Fame | Featured fields + toggle exist. | Public page, admin page, curation UI | M10.8 + M14 | Blocked by M10.8 |
| 5 | Counter-List System | Type exists, rate exempt. | Arena spec (parent linking, VS view, etc.) | M5.6.3-7 | Blocked by Post model fields |
| 6 | Comment Spark Score | Fully built for comments. | Post-level spark scoring | M5.6.1 | Blocked by Post.spark_score |
| 7 | Submit page | Full form with all features. | Post type selector — hardcoded to top_list | M3 | None |

---

## NOT BUILT — 0% Implementation (20 items)

### Core Platform Gaps
| # | Feature | Milestone |
|---|---------|-----------|
| 1 | Users Management (admin listing, ban, whitelist, shadow-ban) | M10.6 |
| 2 | Rate Limits & Trust Scores Admin (settings page) | M10.11 |
| 3 | Double-Blind Moderation (hide trust during review) | M11.C.1 |
| 4 | SEO Indexing Guard (noindex logic) | M5.5 |
| 5 | Route Guard (RESERVED_ROUTES protection) | M5.5 |

### New MVP Features (Architecture Review)
| # | Feature | Milestone | Architecture Doc |
|---|---------|-----------|-----------------|
| 6 | Article content type (separate model, not Post subtype) | M3.X | [01](architecture-01-article-model.md) |
| 7 | Article submission form (body, sources, cover) | M3.X | [01](architecture-01-article-model.md) |
| 8 | Article detail page (`/articles/:slug`) | M3.X | [07](architecture-07-article-identity.md) |
| 9 | Explore page (`/explore`) — algorithmic multi-factor scoring | M16 | [03](architecture-03-explore-algorithm.md) |
| 10 | Explore API (`GET /api/explore`) | M16 | [03](architecture-03-explore-algorithm.md) |
| 11 | Articles feed page (`/articles`) | M16 | [06](architecture-06-postfeed-component.md) |
| 12 | Arguments page (`/arguments`) — hot debates | M13 (now MVP) | [04](architecture-04-arguments-precompute.md) |
| 13 | Arguments API (`GET /api/arguments`) — pre-computed Redis | M13 (now MVP) | [04](architecture-04-arguments-precompute.md) |
| 14 | Share system (OG tags, UTM, copy link, analytics) | M16 | [05](architecture-05-share-system.md) |
| 15 | PostFeed reusable component | M16 | [06](architecture-06-postfeed-component.md) |

### Arena / Counter-List (unchanged)
| # | Feature | Milestone |
|---|---------|-----------|
| 16 | Counter-List Arena (challenger editor, VS view, challenges gallery) | M5.6 |
| 17 | Post-Level Spark Engine (60/40, trust multipliers) | M5.6.1 |
| 18 | Dynamic Reputation Engine ($R$) | M5.6.2 |

### Phase 2 / V2
| # | Feature | Milestone |
|---|---------|-----------|
| 21 | Futuristic + Retro themes | V2.1 |
| 22 | PWA & Offline | V2.5 |

---

## BLOCKER CHAINS

### Chain 1: Arena (12 features blocked)
```
Post model missing 6 fields (parent_id, spark_score, version_id, etc.)
    └── BLOCKS: M5.6.1 through M5.6.8 (entire Arena)
```
**Fix**: Add 6 Post fields → unblocks 12 features.

### Chain 2: Hall of Fame (2 features)
```
M10.8 (admin HoF) not built → Blocks M14 (public HoF)
```

### Chain 3: PostFeed Component (4 features)
```
PostFeed component not extracted → Each feed page must be built from scratch
```
**Fix**: Build PostFeed once → use in /explore, /articles, /saved, /arguments.

### No Blockers (Can Build Anytime)
- M10.6 Users Management
- M10.11 Rate Limits Admin  
- M3.X Article content type
- M16 Explore
- M16 Articles feed
- M13 Arguments
- M16 Share system
- M5.5 SEO Guard + Route Guard
- M11.C.1 Double-Blind Moderation

---

## SUMMARY

| Status | Count |
|---|---|
| **FULLY BUILT** | 47 |
| **PARTIALLY BUILT** | 7 |
| **NOT BUILT — existing gaps** | 5 |
| **NOT BUILT — new MVP features** | 10 |
| **NOT BUILT — Arena / Phase 2** | 5 |
| **TOTAL NOT BUILT** | **20** |
| **Blocked by other features** | 14 |
| **No blockers (can start now)** | 11 |
| **Architecture decision docs** | 8 |
