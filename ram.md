# RAM — Runtime Action Manifest

## Completed
- **[M00.0] Dev ports changed** — Frontend `3000→3100`, Backend `8000→8100`
- **[Fix] PM2 7 compatibility** — JSON ecosystem config, Node entry points, pm2 install
- **[Fix] Hydration mismatch** — `useRef` counter for deterministic item IDs
- **[Fix] Enterprise seed script resilience** — 4-layer fix (normalized_title, post_count hook, route paths, service layer)
- **[Fix] NaN guards** — rate limit trust_score + activeBoost guards (3 locations)
- **[Fix] Missing check-title route** — placed before /:idOrSlug catch-all
- **[Fix] Title format validation** — 3-100 items, regex format check, beforeunload draft sync
- **[Security] Admin auth overhaul** — router-level whitelist, token_version revocation, brute force account-lock, error codes, fingerprint exemption
- **[Feature] Admin retry** — revision request without trust score penalty
- **[Architecture] Slug-based categories** — global check-title, reconciler, hierarchy-aware delete protection, dual-accept POST, 9 posts migrated
- **[M10.1-M10.5]** Admin auth, analytics, review queue, posts, comments management
- **[Feature] Cross-browser fingerprint matching** — Tier 0 machine-stable signals, middleware integration, lean fix
- **[Feature] ES search infrastructure** — 4 indices, public search/autocomplete, admin status/reindex/preview, auto-heal cron
- **[Feature] Notifications** — Toast system, bell badge, admin-to-author notifications
- **[M12 Search Architecture]** Enterprise upgrade — bulk indexing, facets, highlights, retries with dead letter queue, rate limiting, category/user indexing, Zod validation, did-you-mean suggestions, comment filtering, index writers wired into all route handlers
- **[UI] Admin sidebar, bell badge, statistics dashboard**
- **[Audit] Categories audit logging** — `logAudit` (AuditLog model) added to all 12 mutation handlers: duplicate, publish, hide, bulk/feature, bulk/archive, bulk/merge, bulk/reparent, import, create, update, archive, recalculate-post-counts
- **[Audit] Messages audit logging** — `logAudit` added to send message, retract message, create template, delete template handlers
- **[M15] Identity Portability** — Crypto wallet-style identity system: BIP39 12-word seed phrases, ed25519 challenge-response auth, multi-device linking (UserDevice model), 7 API endpoints, frontend SecureMyAuthority section + claim page + seed modal
- **[Images] Post images** — Three post formats (list_only, hero_list, full_list), hero banner + per-item images, multer upload endpoint, sharp resize (item thumb 400x280 + hero 1200x675 WebP), express.static serving, frontend format selector + image upload UI + three-format post display
- **[UI] Premium design system** — Dark/light mode with CSS custom properties (`var(--bg-primary)` through `var(--accent-gradient)`), orange-red → pink gradient accent, glassmorphism nav header, premium-card/btn/input component styles, theme toggle component, Geist + Geist Mono typography, smooth transitions, all 23+ pages rewritten with premium aesthetic
- **[UI] Premium design system — Profile & Post Detail pages** — Rewrote `a/[username]/page.tsx` (722 lines) and `[slug]/client.tsx` (943 lines) with CSS variable-based dark/light design system: `var(--bg-*)`, `var(--text-*)`, `var(--accent*)`, premium cards, tabs, hover states, Lucide icons replacing all hardcoded hex colors
- **[UI] Premium design system — Admin pages & components** — Rewrote 12 files with CSS variable-based dark/light design system:
  1. `admin/page.tsx` — Dashboard landing cards with hover states
  2. `admin/posts/pending/page.tsx` — Review queue with premium table/filter styling
  3. `admin/posts/pending/[id]/page.tsx` — Post review detail with gradient buttons
  4. `admin/categories/page.tsx` — Category management (tree/table/analytics/bulk tabs)
  5. `admin/comments/page.tsx` — Comment moderation with styled tables
  6. `admin/search/page.tsx` — Search cluster status + analytics tabs
  7. `admin/statistics/page.tsx` — Statistics dashboard (21 panels, all inline styles replaced)
  8. `admin/alerts/[id]/page.tsx` — Alert detail with status-aware theming
  9. `c/[[...slug]]/page.tsx` — Category feed from neo-brutalist to premium design
  10. `search/page.tsx` — Public search page with CSS variables
  11. `components/SecureMyAuthority.tsx` — Identity section with imported Icon
  12. `components/SeedDisplayModal.tsx` — Seed phrase modal with premium styling
- **[UI] Tailwind mobile-first rewrite** — Rewrote 3 core frontend pages with Tailwind CSS exclusively (zero inline styles, zero custom CSS):
  1. `submit/page.tsx` (901 lines) — Mobile-first form: full-width inputs, glass form cards, gradient submit button, styled selects, file uploads, dynamic border states for validation, all functionality preserved (draft save, title check, validation, image upload)
  2. `[slug]/client.tsx` (547 lines) — Post article: full-width typography, hero image, item cards with flex layout, glass comments section, threaded replies with capped indent, reaction buttons, all functionality preserved
  3. `a/[username]/page.tsx` (361 lines) — Profile: glass header card, trust level badges with conditional styles, tabs, post/comment cards, stats panel, edit display name form, all functionality preserved

- **[UI] Tailwind mobile-first — ALL admin pages & components** — Rewrote 15 files with Tailwind CSS exclusively (zero inline styles, zero custom CSS):
  1. `admin/page.tsx` — Dashboard landing with glass card grid, hover states
  2. `admin/posts/pending/page.tsx` — Review queue with mobile cards + desktop table, modal dialogs
  3. `admin/posts/pending/[id]/page.tsx` — Post review detail with gradient buttons, modals
  4. `admin/posts/page.tsx` — All posts with mobile cards + desktop table, stat badges
  5. `admin/comments/page.tsx` — Comment moderation, flag penalty modal, mobile cards + desktop table
  6. `admin/categories/page.tsx` — Tree/table/analytics/bulk tabs, responsive tree sidebar
  7. `admin/search/page.tsx` — Cluster status + analytics tabs, 3-column responsive grid
  8. `admin/statistics/page.tsx` — 21 collapsible panels, stat cards, responsive layout
  9. `admin/alerts/[id]/page.tsx` — Alert detail with severity-aware border styling
  10. `notifications/page.tsx` — Notification list with priority-based left border colors
  11. `notifications/[id]/page.tsx` — Notification detail with admin/regular message rendering
  12. `components/SecureMyAuthority.tsx` — Identity section, device management, unlink buttons
  13. `components/SeedDisplayModal.tsx` — Seed phrase modal with 3-col word grid, copy button
  14. `components/NotificationBell.tsx` — Bell dropdown with priority styling, dismiss buttons
  15. `components/ThemeToggle.tsx` — Sun/Moon Lucide icons replacing emojis
  Design system: `bg-zinc-950` base, `bg-white/5` cards, `border-white/10` borders, `from-orange-500 to-pink-500` accents, `rounded-xl` throughout, mobile cards collapsing to desktop tables, full-screen modals on mobile, `min-h-[44px]` touch targets

- **[UI] Tailwind feed + layout rewrite** — Rewrote 3 app files + created 4 new components with Tailwind CSS exclusively (zero inline styles, zero custom CSS):
  1. `app/FeedClient.tsx` — Sort pills (newest/viewed/comments), DataCard list, IntersectionObserver infinite scroll (400px rootMargin, no spinner), empty state with CTA
  2. `app/page.tsx` — SSR fetch posts + trending queries, CommandSearch + FeedClient rendering, no hero/marketing copy
  3. `app/layout.tsx` — Ghost header (backdrop-blur-xl, reduced padding), "Yo" + "Top10" gradient logo, removed old nav links + mobile bottom nav bar, search icon + ThemeToggle + NavUserAvatar + HeaderBells, FloatingDock at bottom (hidden on /admin)
  4. `components/DataCard.tsx` — Replaces PostCard: post type pill, category slug, title, intro, author/relativeTime/chart bar metrics, font-mono tabular-nums
  5. `components/CommandSearch.tsx` — Search input with Lucide Search icon, trending query chips
  6. `components/FloatingDock.tsx` — Fixed bottom dock: Feed/Categories/Search/Submit with active state
  7. `components/NavUserAvatar.tsx` — First-letter circle linked to profile
  Deleted: `PostCard.tsx`, `CategoryBar.tsx`

- **[Test] Vitest test files for 4 backend libs** — Created comprehensive tests for `upload.ts` (16 tests: optimizeImage, processUpload, processProfileImage, deleteUploads with edge cases), `postCountReconciler.ts` (10 tests: reconciliation logic, cron start/stop, edge cases), `trustScoreWorker.ts` (11 tests: queue processing, retry logic, edge cases), `listTitleValidation.ts` (33 tests: validateListTitle with all error codes, needsListTitleValidation, edge cases). All 70 tests pass, zero new lint errors, zero new type errors.

- **[Test] Vitest test files for 5 more backend libs** — Created comprehensive tests for `env.ts` (14 tests: validateEnv defaults/errors/caching, getEnv), `elasticsearch.ts` (4 tests: singleton creation with custom/default URL), `fingerprintMatching.ts` (16 tests: Tier 0/1/2 matching, negative matching, age decay, storeFingerprintObservation), `modelRegistry.ts` (6 tests: register/re-register, multiple models, cached returns), `redis.ts` (13 tests: client singleton, atomicCheckRateLimit allowed/blocked/error formats). All 53 tests pass, zero lint errors on new files.

- **[Feature] Profile image support** — Two frontend components updated for profile images:
  1. `components/NavUserAvatar.tsx` — Shows `next/image` profile image if `user.profile_image_url` exists, falls back to first-letter circle. Links to `/a/{username}`.
  2. `app/a/[username]/page.tsx` — Profile header shows 80x80 avatar (image or first-letter gradient fallback). Own profile: hidden file input via clickable label, uploads to `POST /api/upload/profile`, updates user via `PATCH /api/users/me`, refreshes auth store. 200x200 WebP square images.
  3. Backend: Added `profile_image_url` to `GET /users/:username` response in `routes/users.ts`.
  4. Auth store: Added `profile_image_url` field to `AuthUser` interface in `stores/auth.ts`.

## Current
- **[Fix] Hydration errors — deterministic date/time rendering** — Replaced all `toLocaleDateString()`, `toLocaleTimeString()`, `toLocaleString()`, and custom `ageStr()` with `formatDate()`, `formatTime()`, `relativeTime()` from `@/lib/dates` across 9 files. Added `suppressHydrationWarning` to every date/time rendering element.

- **[UI] Desktop triple-pane + Dynamic Island + GlassSlab** — Rewrote homepage with desktop triple-pane layout (Left Wing category rail, Center Stage power trio/strip logic, Right Wing live pulse), Dynamic Island floating dock (search modal, scroll shrink, pathname active, hide on /admin), GlassSlab self-animating card component (IntersectionObserver, glass-slab/spatial-depth/card-deck-enter CSS classes), simplified FeedClient (infinite scroll only, no sort pills), CommandSearch converted to modal. All files: zero inline styles, Tailwind + custom CSS classes only, Lucide Icon component used throughout.

- **[UI] Desktop triple-pane rewrite — Left Wing Navigator + Center Stage Workstation** — Rewrote page.tsx: Left Wing Navigator (w-1/5, category tree with border-l-2 vertical lines, orange hover accent, site stats with TOTAL FACT-MINES + ACTIVE ARGUMENTS at bottom), Center Stage Workstation (Power Trio #1-#3: glass-slab + spatial-depth cards with wiki-badge serial, hero image w-56 h-36, font-display title, ArgumentBar 50/50; Expandable Strips #4+: 40px compact with CSS max-height hover expand to 150px revealing intro + ArgumentBar). Mobile card deck unchanged. SSR: getSiteData() + getCategories(). generateSerial() helper for ENT-9472-B style badges. All Tailwind + custom CSS classes only, zero inline styles, Lucide Icon for all icons, suppressHydrationWarning on dates.

- **[UI] Mobile styling polish — GlassSlab + DataCard + FeedClient** — Rewrote 3 core feed components + patched page.tsx:
  1. `components/GlassSlab.tsx` (170 lines) — Removed internal `<Link>` (avoids double-nesting), added expand/collapse chevron toggle (Show N more / Show less, `role="button"` with `preventDefault`+`stopPropagation` for valid `<a>` nesting, `min-h-[44px]` touch target), responsive padding (`px-4 py-4` mobile, `lg:px-6 lg:py-5` compact / `lg:px-6 lg:py-6` featured), `tabular-nums` on metrics, `suppressHydrationWarning` on date spans, `w-full` for full-width mobile cards
  2. `components/DataCard.tsx` (17 lines) — Thin `<Link>` > `<GlassSlab>` wrapper (no double nesting), passes all post props
  3. `app/FeedClient.tsx` (160 lines) — Sort pills (Latest / Most Viewed / Discussed, small `font-mono text-[11px]` pills, orange accent on active), empty state with CTA when `posts.length === 0`, Link > GlassSlab per card, IntersectionObserver infinite scroll (400px rootMargin, no spinner, no Load More button), sort change resets feed and refetches page 1
  4. `app/page.tsx` (patched) — Added `<Link>` wrappers around GlassSlab in mobile card deck (needed after GlassSlab dropped internal Link)

- **[UI] Three Article pages** — Created 3 complete frontend article pages with Tailwind CSS only:
  1. `articles/page.tsx` — Medium-style feed with article cards (cover image, reading time badge, category badge, fact-check badge, stats row, Load More pagination, empty state)
  2. `articles/[slug]/page.tsx` — Article reader (author avatar initial, cover image, paragraph-rendered body, sources list, related posts horizontal scroll, fact-check badge with conditional ShieldCheck/TriangleAlert/Info icons, stats bar)
  3. `submit-article/page.tsx` — Submission form (title, category selector, body textarea, cover image URL, dynamic source fields with add/remove, auto-calculated reading time preview, validation, success confirmation card, submit-another button)

- **[Security] RESERVED_ROUTES guard** — Shared reserved route set preventing user-created content from clobbering system routes. `frontend/src/lib/reservedRoutes.ts` (20 reserved slugs), `frontend/src/app/[slug]/page.tsx` (notFound for reserved slugs in both generateMetadata + PostDetailPage), `backend/src/routes/posts.ts` (RESERVED_SLUGS check returns 404 before DB query in GET /:idOrSlug), `frontend/src/lib/reservedRoutes.test.ts` (10 tests). 10/10 tests pass, 0 lint errors, 0 type errors.

- **[UI] Tailwind explore page** — Created algorithmic Explore feed at `app/explore/page.tsx` with 4 files:
   - `lib/api/types.ts` — Added `ExplorePost` + `ExploreResponse` interfaces
   - `lib/api/endpoints/explore.ts` — `exploreApi.getExplore(page, limit)` client
   - `lib/api.ts` — Spread `exploreApi` into API object
   - `app/explore/page.tsx` — Full client-side page: font-display header, post_type tabs (All/Top Lists/VS Battles/Articles) with orange underline, 2-col responsive grid, glass-slab cards with score badge (font-mono text-orange-400), category slug badge, title (line-clamp-2), top 3 items preview, author/relativeTime row, Eye/MessageCircle stats, IntersectionObserver infinite scroll (400px rootMargin), empty state, spinner loading. Zero inline styles, all Tailwind.

## Next
- Frontend `/search` page (M12)
- Admin search panel (health badge, reindex button, test search)
- Per-post "is my post searchable?" button
- M10.6: Users management
- M10.11: Rate limits & trust scores admin UI
- M10.8: Hall of Fame management
