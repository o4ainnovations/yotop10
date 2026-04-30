# Bug Tracker

> Last updated: 2026-04-30 after Phases 1-6 implementation.

## Open

| # | Area | Description | Priority |
|---|------|-------------|----------|
| — | — | **No known bugs at this time** | — |

## Recently Fixed (Phases 1-6)

| Phase | Fix |
|-------|-----|
| P1 | Hardcoded JWT secret fallback — removed, crashes on missing |
| P1 | Stored XSS via JSON-LD — escaped `</` sequences |
| P1 | App dead in private browsing — localStorage wrapped in try/catch |
| P1 | 425 infinite recursion — capped at 3 retries |
| P1 | Eruda devtools in production — gated behind NODE_ENV |
| P1 | MongoDB `$regex` injection — removed unescaped user input |
| P1 | Stub endpoints returning 200 OK — replaced with 501 |
| P2 | Redis per-request connect/disconnect — singleton client |
| P2 | MongoDB `withTransaction()` requires replica set — atomic version-field update |
| P2 | Cron jobs on module import — moved to server.ts lifecycle |
| P2 | Dead `setInterval` in fingerprint middleware — removed |
| P3 | Orphaned posts on item creation failure — rollback via try/catch |
| P3 | Orphaned grandchild comments on delete — recursive collection |
| P3 | TOCTOU rate limit race — atomic Lua script |
| P3 | Display name race condition — atomic `findOneAndUpdate` with filter |
| P3 | Destructive plural normalization — fixed regex with lookbehind |
| P3 | Random ETag defeats caching — content-based hash |
| P3 | Shared 'unknown' fingerprint in reactions — returns 401 |
| P4 | `response.json()` crash on invalid JSON — safe parse |
| P4 | Double fetch on post mount — removed duplicate |
| P4 | Raw `fetch()` bypassing API wrapper — replaced with `apiFetch` |
| P4 | Scroll-to-error before React re-render — moved to `useEffect` |
| P4 | Debounce closure leak — replaced with `useRef` |
| P4 | `setTimeout` on unmounted component — cleanup ref |
| P4 | Stale async responses — mounted ref guards |
| P4 | `<a>` full page navigation — replaced with `<Link>` |
| P4 | Unvalidated `params.id` — guard before use |
| P5 | Monolithic API client — split into domain modules |
| P5 | Duplicated SparkScore logic — extracted to pure functions |
| P5 | `require()` route loading — static imports with metadata |
| P5 | Missing `any` escapes — eliminated all instances |
| P6 | Missing env validation — Zod schema at startup |
| P6 | No `tsc --noEmit` in CI — added typecheck pipeline |
| P6 | No test infrastructure — vitest configs + 20 tests written |
| P7 | Stale tech stack in docs — updated to actual stack |
| P7 | Comment depth spec mismatch — unified at 10 |
| P7 | `@fingerprintjs/fingerprintjs` phantom dep — removed |
| P7 | Empty stub files at root — deleted |
