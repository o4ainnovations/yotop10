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

## Current
- _(none — all committed)_

## Next
- Frontend `/search` page (M12)
- Admin search panel (health badge, reindex button, test search)
- Per-post "is my post searchable?" button
- M10.6: Users management
- M10.11: Rate limits & trust scores admin UI
- M10.8: Hall of Fame management
