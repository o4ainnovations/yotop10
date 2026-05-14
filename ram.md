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

## Current
- _(none — all committed)_

## Next
- Frontend `/search` page (M12)
- Admin search panel (health badge, reindex button, test search)
- Per-post "is my post searchable?" button
- M10.6: Users management
- M10.11: Rate limits & trust scores admin UI
- M10.8: Hall of Fame management
