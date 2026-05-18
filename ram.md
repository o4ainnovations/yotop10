# RAM — Runtime Action Manifest

## Completed
- **[M10.8] Hall of Fame backend** — Complete backend Hall of Fame system:
  1. `GET /api/admin/hall-of-fame` — List curated entries with populated post data, sorted by sort_order asc/featured_at desc
  2. `POST /api/admin/hall-of-fame` — Add post to HoF (validates approved, prevents duplicates, sets featured flags)
  3. `PATCH /api/admin/hall-of-fame/:id` — Edit editorial note
  4. `DELETE /api/admin/hall-of-fame/:id` — Remove from HoF, unset post.featured
  5. `PATCH /api/admin/hall-of-fame/reorder` — Bulk sort_order update
  6. `GET /api/admin/hall-of-fame/candidates` — Auto-suggestions (comment_count >= 10 OR view_count >= 500, last 90 days)
  7. `GET /api/hall-of-fame` — Public endpoint, no auth, sorted by sort_order asc
  - Files: `routes/admin.ts`, `routes/hallOfFame.ts`, `routes/index.ts`, `schemas/admin.ts`, `models/HallOfFame.ts` (already existed)
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

- **[Feature] PWA & Offline Support** — Full progressive web app with service worker, web manifest, install prompt, and offline caching:
  1. `public/manifest.json` — PWA manifest (standalone, portrait-primary, #05050f theme, 192x192 + 512x512 icons)
  2. `public/sw.js` — Service worker: cache-first for static assets, network-first for API calls, cache name `yotop10-v1`, precaches /, /categories, /search, /submit, /explore, install (skipWaiting), activate (clean old caches), fetch (API→networkFirst, everything else→cacheFirst)
  3. `src/app/sw-register.ts` — Client-side SW registration utility with SSR/navigator guards
  4. `src/components/SWRegister.tsx` — Client component calling registerSW() in useEffect
  5. `src/components/PWAInstallPrompt.tsx` — beforeinstallprompt listener, gradient Install button, dismiss button, mobile-only positioning
  6. `public/generate-icons.sh` — Imagemagick script to generate 192x192 + 512x512 PNG icons
  7. `src/app/layout.tsx` — Updated metadata (manifest, themeColor, appleWebApp), imported SWRegister + PWAInstallPrompt
  8. `src/app/sw-register.test.ts` — 5 tests: function exists, doesn't throw, registers load listener, no-op when no serviceWorker, no-op in SSR

- **[Feature] Hall of Fame system (M10.8 + M14)** — Complete admin + public infrastructure:
  1. `backend/src/routes/hallOfFame.ts` — Public `GET /api/hall-of-fame`: featured posts sorted by sort_order, filters deleted/unapproved posts, null-safe post references
  2. `backend/src/routes/admin.ts:2643-2831` — 6 admin endpoints: GET/POST/DELETE/PATCH hall-of-fame, candidates, reorder, editorial note
  3. `backend/src/routes/hallOfFame.test.ts` — 40 integration tests: public endpoint (empty, deleted filter, unapproved filter, null post, DB error), admin endpoints (add/sort/duplicate/status/reorder/editorial-note/candidates/delete/unauthorized/edge-cases), 10 documented flaws
  4. `frontend/src/components/HallOfFameCard.tsx` — Reusable card with 3 variants: `public` (compact with FEATURED badge, link, stats), `admin` (sort_order badge, edit/remove buttons), `featured` (large with hero image, amber badge, editorial note)
  5. `frontend/src/app/hall-of-fame/page.test.tsx` — 29 component tests: public (title, badge, category, note, author, counts, null post, null note, zero counts, missing slug), admin (sort badge, buttons, conditional buttons, note, missing author, relative time, empty title), featured (badge, hero image, no hero, title link, author, missing display name, null note), edge cases
  6. `backend/src/routes/index.ts` — Registered `/api/hall-of-fame` route

## Current
- **[Feature] Share system** — Complete share infrastructure:
  1. `backend/src/models/Post.ts` — Added `share_count` field to Post model
  2. `backend/src/routes/posts.ts` — Added `POST /:idOrSlug/share` endpoint (increments share_count + trackExploreView), added `share_count` to GET `/:idOrSlug` response
  3. `frontend/src/lib/api/endpoints/share.ts` — API client for share tracking
  4. `frontend/src/lib/api.ts` — Spread shareApi into API object
  5. `frontend/src/components/ShareButton.tsx` — Copy link button with UTM tracking, toast feedback, Lucide Share2 icon, 44px touch target, fire-and-forget analytics
  6. `frontend/src/components/ShareButton.test.tsx` — 8 tests (render, UTM generation, clipboard copy, toast, API call, error handling, pending state)
  7. `frontend/src/components/DataCard.tsx` — Added ShareButton alongside BookmarkButton in actions slot
  8. `frontend/src/app/[slug]/client.tsx` — Added ShareButton to post header metadata row
  9. `frontend/src/app/[slug]/page.tsx` — Full OG metadata (title, description, type: article, images), Twitter Card (summary_large_image), robots: index/follow, canonical URL

- **[M13] Arguments system** — Complete backend + frontend:
  1. `backend/src/lib/argumentCron.ts` — 60s cron: scores into `arguments:hot` zset (zAdd) + `arguments:scored` cache (set). Formula: velocity×0.5 + freshness×0.3 + spark×0.2. 30-day window. this_vs_that + counter_list only.
  2. `backend/src/lib/argumentCron.test.ts` — 12 tests: this_vs_that/counter_list scoring, ignores non-argument/deleted/rejected, empty candidates, velocity+freshness+spark formula, Redis error resilience, 30-day age exclusion, start/stop/duplicate cron
  3. `backend/src/routes/arguments.ts` — `GET /api/arguments`: paginated, time filter (today/week/month/all), category filter, Redis zRange hot-sorted with DB fallback, top 3 item-anchored comments (fire_count desc), support/contradict percentages, velocity from Redis mGet
  4. `backend/src/routes/posts.ts` — Added velocity tracking after comment creation: `arguments:velocity:{postId}` incremented + 3600s TTL for this_vs_that/counter_list posts
  5. `backend/src/server.ts` — startArgumentCron() on boot, stopArgumentCron() on SIGTERM/SIGINT
  6. `backend/src/routes/index.ts` — Registered `/api/arguments` route
  7. `frontend/src/components/ArgumentBar.tsx` — Accepts `supportPct`/`contradictPct` (not raw counts), animated `transition-all duration-700 ease-out`, "No arguments yet" for zero state, `className` prop
  8. `frontend/src/components/ArgumentCard.test.tsx` — 7 tests: render, category badge, post type label, ArgumentBar percentages, author, post link
  9. `docs/build-status.md` — Arguments moved from NOT BUILT to FULLY BUILT (51 built, 13 not built)
  10. `docs/milestones.md` — M13 all 4 checkboxes flipped to [x]

## Next
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

- **[Feature] Frontend bookmark system** — 8 files:
  1. `components/BookmarkButton.tsx` — Toggle button with optimistic updates, toast feedback, Lucide Bookmark icon (filled/orange active, outline/zinc-500 inactive), `min-w-[44px] min-h-[44px]` touch target
  2. `components/DataCard.tsx` — Passes `BookmarkButton` as `actions` slot to `GlassSlab`
  3. `components/GlassSlab.tsx` — Added optional `actions` prop rendered in footer metrics row
  4. `app/[slug]/client.tsx` — Added `BookmarkButton` to post header metadata row
  5. `app/saved/page.tsx` — Twitter-style Bookmarks page: header with @username subtitle, empty state (Bookmark icon + prose), compact glass cards (author avatar + @username + relativeTime saved_at, title link, item preview/article excerpt, category badge, view/comment counts, active BookmarkButton), IntersectionObserver infinite scroll
  6. `lib/api/endpoints/bookmarks.ts` — API client: save/unsave/getSaved/checkBookmark
  7. `lib/api/types.ts` — Added `BookmarkResponse`, `SavedPost`, `SavedPostsResponse` types
  8. `lib/api.ts` — Spread `bookmarksApi` into API object
  9. `components/BookmarkButton.test.tsx` — 8 tests, all passing

- **[Test] Bookmark system unit tests** — 2 files:
  1. `lib/bookmarkService.ts` — Core bookmark logic: saveBookmark (creates SavedPost + increments Post.bookmark_count + Redis set), removeBookmark (deletes SavedPost + decrements + Redis removal), getSavedPosts (paginated, sorted by saved_at desc), checkBookmark (Redis sIsMember with MongoDB fallback)
  2. `lib/bookmarkService.test.ts` — 16 tests: save/duplicate/increment, remove/decrement/not-found, getSavedPosts pagination/sort/empty, checkBookmark Redis hit/miss/fallback/error/edge cases
  3. `models/SavedPost.ts` — user_id + post_id compound unique index, (user_id, saved_at) compound index

- **[Feature] SEO Indexing Guard** — 6 files:
  1. `backend/src/lib/seoGuard.ts` — Pure `shouldNoIndex()` function: noindex if status !== 'approved', or stale (0 comments + 0 views + >48h), or thin content (<100 chars + >24h)
  2. `backend/src/lib/seoGuard.test.ts` — 12 tests: approved/engaged, pending, rejected, stale, stale-at-boundary, thin, thin-within-window, normal, zero-length, old-engaged, boundary cases
  3. `backend/src/models/Post.ts` — Added `meta_robots: string | null` field (admin override)
  4. `backend/src/routes/posts.ts` — GET /:idOrSlug returns computed `robots` field; imports seoGuard; respects `meta_robots` admin override
  5. `frontend/src/app/[slug]/page.tsx` — Dynamic robots in generateMetadata: noindex for stale/thin/unpublished, else index/follow
  6. `frontend/src/app/articles/[slug]/page.tsx` — Server page + ArticleDetailClient client component; dynamic robots in generateMetadata (thin <200 chars body + >24h, zero engagement, unpublished)

## Next
- Frontend `/search` page (M12)
- Admin search panel (health badge, reindex button, test search)
- Per-post "is my post searchable?" button

## Current
- **[Feature] M10.6 + M10.11 — 10 Admin endpoints for Users & Config management** — Backend complete:
   1. `GET /api/admin/users` — Paginated user listing with search, trust/status filters, post/comment aggregation, filter counts
   2. `GET /api/admin/users/:user_id` — Single user detail with post_count, comment_count, posts_approved, posts_rejected
   3. `PATCH /api/admin/users/:user_id/restrict` — Ban/unban user with restricted_until
   4. `PATCH /api/admin/users/:user_id/rate-limits` — Per-user rate limit override
   5. `PATCH /api/admin/users/:user_id/trust` — Manual trust adjustment with TrustScoreLog entry + audit
   6. `GET /api/admin/users/:user_id/trust-history` — Paginated trust change log
   7. `GET /api/admin/config` — Get current system config
   8. `PUT /api/admin/config` — Update config with audit logging
   9. `GET /api/admin/config/impact` — Preview config change impact on users
   10. `GET /api/admin/config/versions` — Config version history
- Files: `routes/admin.ts`, `models/TrustScoreLog.ts`, `schemas/admin.ts`, `lib/systemConfig.ts`, `models/index.ts`

- **[Feature] M10.8 Hall of Fame — Frontend pages** — 6 files:
  1. `types.ts` — Added `HallOfFameEntry` + `HallOfFameCandidate` interfaces
  2. `api/endpoints/admin.ts` — Added 6 admin API functions: getHallOfFame, addToHallOfFame, removeFromHallOfFame, reorderHallOfFame, updateEditorialNote, getHallOfFameCandidates
  3. `api.ts` — Wired Hall of Fame admin functions + `getPublicHallOfFame()` export
  4. `app/admin/hall-of-fame/page.tsx` — Admin curation page: Featured/Candidates toggle, reorder with up/down buttons, inline editorial note editing, remove with confirmation, candidate feature button, empty states
  5. `app/hall-of-fame/page.tsx` — Public page: Wikipedia-style layout, 1-3 featured hero cards with cover image + editorial quote + Featured badge, 2-3 column grid for remaining, glassmorphism hover, empty state
  6. `app/admin/layout.tsx` — Added "Hall of Fame" nav item in admin sidebar
