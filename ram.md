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
- **[UI] Admin sidebar, bell badge, statistics dashboard**

## Current
- **[M12 Search Architecture]** Enterprise upgrade of all 9 items complete:
  - **1. Bulk indexing** — `bulkWriter.ts` with `_bulk` API, 500-doc chunks, error tracking per batch
  - **2. Faceted aggregations** — category_slug + post_type counts in public search response
  - **3. Highlighting** — `<mark>` tags on title, intro, content fields in all search endpoints
  - **4. Writer retries** — 3-attempt exponential backoff (100ms→500ms→2.5s), dead letter queue (SearchDeadLetter model)
  - **5. Search rate limiting** — 30 req/60s per IP (search), 10 req/60s (autocomplete) via atomic Lua script
  - **6. Category/user indexing** — `indexCategory`, `indexUser`, `removeCategory`, `removeUser` writers
  - **7. Zod validation** — `schemas/search.ts` for all query params (q, page, sort, post_type, author, scope, index)
  - **8. "Did you mean?" suggestions** — ES phrase suggester on title field when results < 3
  - **9. Comment status filtering** — `must_not` hidden/deleted in public comment search
- **Index writers wired into ALL route handlers** — admin.ts (25 handlers), posts.ts (POST/DELETE comment), comments.ts (PATCH/DELETE comment)

## Next
- Frontend `/search` page (M12)
- Admin search panel (health badge, reindex button, test search)
- Per-post "is my post searchable?" button
- M10.6: Users management

## Files Changed (uncommitted)
- `backend/src/schemas/search.ts` — NEW: Zod schemas for all search params
- `backend/src/lib/searchRateLimit.ts` — NEW: per-IP rate limiter middleware
- `backend/src/models/SearchDeadLetter.ts` — NEW: dead letter queue model
- `backend/src/elasticsearch/lib/bulkWriter.ts` — NEW: _bulk API for reindex
- `backend/src/elasticsearch/lib/indexWriter.ts` — retry logic, dead letter, removeCategory/removeUser
- `backend/src/elasticsearch/lib/searchAutoHeal.ts` — bulk writer, $or fix, categories/users
- `backend/src/routes/search.ts` — facets, highlights, suggestions, validation, rate limiting, bulk reindex, DELETE index, mappings viewer
- `backend/src/routes/admin.ts` — wired indexPost/removePost/indexComment/removeComment into 25 handlers
- `backend/src/routes/posts.ts` — wired indexComment (POST comment), indexPost (POST post)
- `backend/src/routes/comments.ts` — wired indexComment (PATCH), removeComment (DELETE)
- `backend/src/server.ts` — search router + ES init + auto-heal start
