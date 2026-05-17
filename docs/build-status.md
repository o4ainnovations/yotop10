# YoTop10 — Build Status (Re-Evaluated)

> Updated after architecture review + feature additions. 2026-05-17.

---

## FULLY BUILT (50 items)

| # | Feature | Milestone |
|---|---------|-----------|
| 1 | Project foundation (Next.js 15, Express, MongoDB, Redis, ES, Docker, CI/CD) | M1 |
| 2 | Database schema — all 10+ collections | M2 |
| 3 | Post submission (validation, rate limit, fingerprint, draft recovery, WCAG) | M3 |
| 4 | Title similarity check (Damerau-Levenshtein, year detection, format validation) | M3.1 |
| 5 | Public feed (API + SSR homepage + infinite scroll) | M4 |
| 6 | Post detail (items, comments, reactions, changelog link) | M5 |
| 7 | SEO slug routing (`/[slug]`, `/post/[id]` removed, canonical) | M5.5 |
| 8 | Route Guard (RESERVED_ROUTES Set, 6 tests, [slug] protection) | M5.5 |
| 9 | Categories system (310 entries, nested slugs, hierarchy) | M6 |
| 10 | Category management — backend (CRUD, bulk, analytics, export, 17+ endpoints) | M10.7 |
| 11 | Comment system (nested 10 levels, item-anchored, 2hr edit window, rate limit) | M7 |
| 12 | Fire reactions (toggle on comments, spark recalculation, ladder boost) | M8 |
| 13 | Admin authentication (JWT, brute force, token versioning, setup token, account lock) | M9 |
| 14 | Notification system (Toast, bell badge, admin-to-user, mark-read) | M9.1 |
| 15 | Admin dashboard + 26 stats endpoints + 21-panel statistics UI | M10.1-2 |
| 16 | Review queue (approve/reject/retry, bulk ops, collision detection) | M10.3 |
| 17 | Double-Blind Moderation (author identity hidden during review) | M11.C.1 |
| 18 | Posts management (CRUD, feature, lock, bump, bulk, export) | M10.4 |
| 19 | Advanced post operations (duplicate, item CRUD, revisions, quality check, compare, activity) | Ghost |
| 20 | Comments management (CRUD, flag, hide, highlight, bulk) | M10.5 |
| 21 | Advanced comment operations (penalty, dismiss-flag, unhide, unhighlight, stats, export) | Ghost |
| 22 | Outbound messaging (AdminMessage, templates, individual+broadcast, 7 endpoints, frontend) | M10.9b |
| 23 | Alert system (12 metrics, threshold CRUD, breach/resolution, cooldown) | M10.9 |
| 24 | Search backend (4 ES indices, facets, highlights, did-you-mean, admin) | M12 |
| 25 | Search frontend (autocomplete, filters, tabs, pagination, URL sharing) | M12 |
| 26 | Search analytics system (4 models, hourly cron, click beacon, 9 analytics endpoints) | Ghost |
| 27 | Audit logs (90-day TTL, CSV export, filtering, Redis-cached stats) | M10.12 |
| 28 | User system (GET/PATCH /me, trust tiers, rate limits endpoint) | M11.A-D |
| 29 | User profile page (3 tabs, posts/comments/stats, edit name, trust display) | M11.E |
| 30 | Identity portability (7 endpoints, BIP39, ed25519, multi-device, claim page) | M15 |
| 31 | SecureMyAuthority + SeedDisplayModal + DeviceManager | M15 UX |
| 32 | Post changelog (version history, side-by-side comparison, edit tracking) | V2.2 |
| 33 | Profile image upload (200x200 WebP, first-letter fallback, NavUserAvatar) | Ghost |
| 34 | Image upload system (multer, sharp WebP, 3 variants, express.static) | Ghost |
| 35 | Design system (glassmorphism CSS, spatial shadows, neon borders, wiki badges) | Ghost |
| 36 | Font system (Geist Sans, Geist Mono, Anton, Monoton) | Ghost |
| 37 | Dark/light toggle (ThemeToggle, localStorage persistence) | V2.1 |
| 38 | Mobile-first responsive (DynamicIsland, DesktopTopBar, breakpoints) | Ghost |
| 39 | 12 premium UI components (GlassSlab, DataCard, CommandSearch, etc.) | Ghost |
| 40 | Trust & identity infrastructure (TrustScoreLog, UsernameHistory, etc.) | Ghost |
| 41 | Ladder system (temporary boosts for low-trust users) | Ghost |
| 42 | Fingerprint cross-browser matching (Tier 0/1/2 signals, 90-day TTL) | Ghost |
| 43 | Ghost frontend pages (`/username-history`, `/notifications`, `/notifications/[id]`) | Ghost |
| 44 | 29 test files, 475 tests, zero failures | Ghost |
| 45 | Hydration immune system (lib/dates.ts, suppressHydrationWarning, modelRegistry) | Ghost |
| 46 | 8 architecture decision documents (docs/architecture-*.md) | Ghost |
| 47 | Bookmark/save system (SavedPost model, bookmarkService, Redis cache, 4 endpoints, BookmarkButton, /saved page) | Bookmarks |
| 48 | Article content type (Article model, endpoints, submit form, view tracking) | M3.X |
| 49 | Article frontend (`/articles` feed, `/articles/[slug]` detail, `/submit-article` form) | M3.X |
| 50 | Explore system (`/explore` page, multi-factor scoring API, 17 scoring tests) | M12.Explore |

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

## NOT BUILT — 0% Implementation (14 items)

### No Blockers — Ready to Build (10 items)

| # | Feature | Milestone |
|---|---------|-----------|
| 1 | Users Management (admin listing, ban, whitelist, shadow-ban) | M10.6 |
| 2 | Rate Limits & Trust Scores Admin (settings page, tier adjustment, per-user override UI) | M10.11 |
| 3 | SEO Indexing Guard (noindex for low-spark + short-description posts) | M5.5 |
| 4 | Arguments page (`/arguments`) + API (`GET /api/arguments` — pre-computed Redis) | M13 |
| 5 | Share system (OG tags, UTM, copy link, analytics) | M5.Share |
| 6 | PostFeed reusable component (shared feed rendering across pages) | M4.Feed |
| 7 | Admin Hall of Fame management (curation, reorder, auto-candidate suggestions) | M10.8 |
| 8 | Futuristic theme | V2.1 |
| 9 | Retro theme | V2.1 |
| 10 | PWA & Offline (service worker, manifest, offline cache) | V2.5 |

### Blocked by Dependencies (4 items)

| # | Feature | Milestone | Blocked By |
|---|---------|-----------|------------|
| 11 | Counter-List Arena (challenger editor, VS view, challenges gallery) | M5.6 | Post model fields (parent_id, spark_score) |
| 12 | Post-Level Spark Engine (60/40, trust multipliers) | M5.6.1 | Post model fields |
| 13 | Dynamic Reputation Engine ($R$) | M5.6.2 | Post model fields |
| 14 | Public Hall of Fame page (`/hall-of-fame`) | M14 | M10.8 (admin HoF management) |

---

## BLOCKER CHAINS

### Chain 1: Post Model → Arena (12 features blocked)
```
Post model missing 6 fields (parent_id, spark_score, version_id, etc.)
    └── BLOCKS: M5.6.1 through M5.6.8 (entire Arena)
```
**Fix**: Add 6 Post fields → unblocks 12 features.

### Chain 2: M10.8 → Public Hall of Fame (1 feature)
```
M10.8 (admin HoF management) not built → Blocks M14 (public /hall-of-fame page)
```

### Chain 3: PostFeed Component (4 features)
```
PostFeed component not extracted → Each feed page must be built from scratch
```
**Fix**: Build PostFeed once → use in /explore, /articles, /saved, /arguments.

---

## SUMMARY

| Status | Count |
|---|---|
| **FULLY BUILT** | 50 |
| **PARTIALLY BUILT** | 7 |
| **NOT BUILT — no blockers** | 10 |
| **NOT BUILT — blocked** | 4 |
| **TOTAL NOT BUILT** | **14** |
| **Architecture decision docs** | 8 |
