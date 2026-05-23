# RAM.md — Random Access Memory: Current Task State

> **Last updated**: 2026-05-22
> **Working tree**: Clean — nothing to commit
> **Branch**: main → up to date with origin/main
> **Latest commit**: `08d9fa04 [M00.0] Clean up stale docs, dead env vars, and AI artifacts`

---

## Current Health

| Check | Status |
|-------|--------|
| Backend typecheck (`tsc --noEmit`) | ✅ 0 errors |
| Frontend typecheck (`tsc --noEmit`) | ✅ 0 errors |
| Backend lint | ✅ 0 errors, 0 warnings |
| Frontend lint | ✅ 0 errors, 0 warnings |
| Backend build (`tsc`) | ✅ 0 errors |
| Frontend build (`next build`) | ⏳ Times out after 120s (check manually) |
| Backend tests (vitest) | ✅ 38 files, 638 tests passed |

---

## What Has Been Done

### Recent commits (top of main):
1. **Clean up** stale docs, dead env vars, and AI artifacts
2. **Update** product_spec.md to reflect current state
3. **Disable** Next.js dev indicators
4. **Remove** Eruda + FloatingDock + hamburger; add User icon in top bar
5. **Add** loading skeletons (FeedSkeleton on 5 CSR pages, AdminTableSkeleton)
6. **Fix** ghost posts — filter deleted posts from public feed + post detail
7. **Fix** admin auth immunity — Next.js middleware.ts (Edge, cookie only, zero API calls)
8. **Admin SSR** — convert admin auth from client-side to server-side rendering
9. **Admin mobile responsiveness** — 12 admin pages mobile-audit, AdminSlideMenu
10. **Moderator System (M17)** — 31 permissions, 4 presets, 8 CRUD endpoints, 3-layer enforcement
11. **Post cards v2/v3** — UI polish (numbered circles, author byline, carousel)
12. **Various fixes** — theme flash, hydration, fonts, bottom nav, slide menu

### Milestones completed (all checked ✅):
M1 (Foundation), M2 (Schema), M3 (Submit), M4 (Feed), M5 (Post Detail), M6 (Categories), M7 (Comments), M9 (Admin Auth), M10 (Admin Dashboard), M11 (User System), M12 (Search), M13 (Arguments), M14 (Hall of Fame), M15 (Identity), M17 (Moderator System)

### ROM issues resolved ✅ (14 of 19):
Hardcoded JWT, orphaned setInterval, $regex injection, stub 200s, health check ordering, dynamic import on approval, module-level cron, 'unknown' fingerprint, Redis singleton, route barrel export, localStorage crashes, 425 infinite recursion, XSS in JSON-LD, Eruda safety guards

---

## What Remains Open

### Still open ROM issues (5 marked ⏳):
| # | Issue | Notes |
|---|-------|-------|
| 1.9 | MongoDB replica set for transactions | `withTransaction()` crashes on standalone |
| 1.10 | Orphaned comments on deletion | Grandchildren may be orphaned |
| 2.7 | TOCTOU rate limit race | Non-atomic zRemRange/zCard/zAdd |
| 2.8 | findOne→findOneAndUpdate race | Display name update in users.ts |
| 2.10 | Non-null assertion after findById | `!` in posts.ts:488 |

### Unfinished features:
- **M5.6** — Counter-List System (The Arena): challenge/rebuttal, comparison engine, SEO governance
- **M10.7** — Categories Management frontend: tree view, drag-drop, bulk ops, analytics
- **M10.14** — Admin UI components: StatsChart, CategoryTree, UserBadge, SearchInput, DateRangePicker, ExportButton, ConfirmDialog
- **V2.x** — Post changelog/revisions, email notifications, design themes
- **Deployment** — "Deployed and verified" unchecked
- **V1 MVP** — "Deployed and verified" unchecked

### Code quality items (from ROM):
- `any` escapes in fingerprint.ts, rate limit type mismatch, AudioContext leak, hash & hash no-op, magical category count formula

---

## Next Steps (Priority Suggestion)

1. **Lock in stability** — Fix 5 remaining ROM issues (crash/data integrity)
2. **Complete admin UI** — Categories tree view, remaining components
3. **Build the Arena** — M5.6 Counter-List System (major feature)
4. **Deploy & verify** — Production deployment
5. **Post-MVP** — V2 features, theming, notifications

---

## Recent Patches

### Enterprise Service Worker (2026-05-22)
- Added a production-ready service worker with the following features:
  - Versioned cache name per build (BUILD_ID injected); runtime cache separation
  - Network-first strategy for fingerprinted static assets (/_next/static, .js, .css)
  - Stale-while-revalidate for navigation pages to reduce TTFB while keeping assets fresh
  - Cache-first for images with trimming to limit storage
  - Offline fallback page (/offline.html) precached
  - Messaging protocol for SKIP_WAITING and NEW_VERSION_AVAILABLE notifications
  - Client registration UI updated to prompt users and trigger update via skipWaiting

Files changed:
- frontend/public/sw.js (new enterprise SW)
- frontend/public/offline.html (added)
- frontend/src/app/sw-register.ts (enhanced SW registration)
- frontend/src/components/SWRegister.tsx (UI prompt for updates)

Status: implemented in working tree. Recommend deploying and validating with a test cohort; additional step: inject BUILD_ID at build time for guaranteed cache-busting across deploys.

### Build-time SW manifest generation (2026-05-23)
- Added postbuild invocation to generate the SW manifest and optionally inject the BUILD_ID into frontend/public/sw.js at build time.
- Updated scripts/generate-sw-manifest.js to accept a `--inject-sw` flag; when enabled the script will replace the BUILD_ID declaration in `frontend/public/sw.js` so the service worker uses a deterministic, build-specific cache name.

Files changed for this patch:
- scripts/generate-sw-manifest.js
- frontend/package.json (added postbuild script)

Status: implemented in working tree. CI: add `pnpm build` step for frontend which will run the postbuild script; verify `frontend/public/sw-manifest.json` and `frontend/public/__build_info.json` are included in artifacts.
