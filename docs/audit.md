# Full Production Audit — YoTop10

> **Date**: 2026-06-07
> **Scope**: 12 backend files, 12 frontend files, 13 infra/config files
> **Total findings**: 24 CRITICAL, 50 HIGH, 81 MEDIUM, 28 LOW

---

## CRITICAL FINDINGS

### Infrastructure (8)

| # | File | Issue |
|---|------|-------|
| C1 | `.env:1` | **JWT_SECRET committed in plaintext** — Anyone with repo access can forge admin JWT tokens |
| C2 | `Dockerfile.frontend:10` | `ENV NEXT_PUBLIC_API_URL=http://localhost:8100/api` bakes wrong URL into client JS bundle at build time; runtime compose value is ignored |
| C3 | `docker-compose.yml:56-61` | Backend health check uses `wget` but `node:20-alpine` does not include it — container NEVER becomes healthy, frontend NEVER starts |
| C4 | `docker-compose.yml:48` | **MongoDB has no auth** — no `MONGO_INITDB_ROOT_USERNAME`/`PASSWORD`, anyone on the network can read/write all data |
| C5 | `docker-compose.yml:98` | **Redis has no `requirepass`** — anyone on the network can run arbitrary Redis commands |
| C6 | `docker-compose.yml:117` | **Elasticsearch security disabled** — `xpack.security.enabled=false`, no auth, no TLS |
| C7 | `nginx.conf.template:2` | **Nginx listens on port 80 only** — no TLS/HTTPS, all traffic in cleartext including JWT cookies |
| C8 | `nginx.conf.template:14` | Missing `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` headers — breaks rate limiting, audit logging, secure cookies |

### Backend (15)

| # | File:line | Issue |
|---|-----------|-------|
| C9 | `server.ts:96-123` | **7 cron jobs started on startup, only 5 stopped on shutdown** — `startFlagCron`, `startAutoHeal`, `startAlertEngine`, `startSearchAnalyticsCron`, `startSnapshotCron` leak on SIGTERM/SIGINT |
| C10 | `posts.ts:515-528` | **Loads ALL approved posts from 5 years** into memory for title similarity check on every submission. Unbounded — will OOM as post count grows |
| C11 | `admin.ts:1500-1503` | **Two unbounded `.distinct()` queries** — loads all fingerprints + all author IDs into memory for lurker calculation |
| C12 | `admin.ts:2627` | **`User.find({}).select('trust_score').lean()`** — loads ALL users into memory. With millions of users, this OOMs the process |
| C13 | `admin.ts:1206` | **`redis.keys('alert:*')`** — blocks Redis event loop for the duration. Must use `SCAN` |
| C14 | `admin.ts:694` | **`$or` assignment overwrites existing `$or`** — silently removes `deleted` filter from query, exposing deleted posts |
| C15 | `admin.ts:732-761` | **Delete-then-reinsert of list items** — `deleteMany` then `insertMany` with no transaction. If the insert fails, all items are permanently lost |
| C16 | `comments.ts:69-72` | **Cron loads ALL comments from 72h** into memory every 20 minutes. Unbounded — will OOM as comment count grows |
| C17 | `comments.ts:122-125` | **Cron loads ALL comments from 30 days** into memory every 6 hours. Same unbounded issue |
| C18 | `fingerprint.ts:76-81` | **User account takeover** — `findOneAndUpdate` with `$set: { device_fingerprint }` overwrites an existing user's device link if `findMatchingUser` returns a false match |
| C19 | `fingerprint.ts:143-148` | **Redis error degrades to anonymous session** — on Redis failure, bypasses fingerprint creation entirely, generating a random session with no user record |
| C20 | `admin.ts:282,624,694,1024,1027` | **NoSQL injection via `$regex`** — user-supplied query params interpolated directly into MongoDB regex patterns (5 instances) |
| C21 | `admin.ts:546-560,580-592,927-936` | **Sequential DB operations in loops** — bulk approve/reject/status-change processes IDs one-by-one with `await` on each |
| C22 | `systemConfig.ts:82-84` | **`getConfig()` returns mutable reference** — any caller can mutate the shared config object, affecting all other callers |
| C23 | `rateLimit.ts:15-16` | **`getConfig()` returns mutable reference** — same issue as C22, rate limits can be mutated at runtime |

### Frontend (1)

| # | File:line | Issue |
|---|-----------|-------|
| C24 | `search/client.tsx:170,174,188,370,374,408` | **Stored XSS via `dangerouslySetInnerHTML`** — search result highlights rendered with no sanitization; elasticsearch highlight fragments could contain malicious HTML |

---

## HIGH FINDINGS (50)

### Infrastructure (14)

| File:line | Issue |
|-----------|-------|
| `docker-compose.yml:64-68` | Backend depends on DBs with `service_started` instead of `service_healthy` — startup race |
| `docker-compose.dev.yml:8-9` | Dev compose uses same host ports as production — can't run concurrently |
| `docker-compose.dev.yml:16` | Hardcoded dev JWT secret committed |
| `Dockerfile.backend:3` | No `.dockerignore` — entire repo sent to Docker on every build |
| `Dockerfile.frontend:3` | No `.dockerignore` — same issue |
| `nginx.conf.template` | No security headers (`X-Frame-Options`, `HSTS`, `CSP`, etc.) |
| `nginx.conf.template` | No rate limiting at proxy level |
| `nginx.conf.template` | Missing `X-Real-IP`/`X-Forwarded-For` proxy headers |
| `Dockerfile.frontend:10` | `ENV NEXT_PUBLIC_API_URL` hardcoded at build time — overrides runtime env |
| `frontend/package.json:36` | `eslint-config-next` pinned to 15.1.0 while `next` is 15.5.x — drift risk |
| `frontend/package.json:10` | Forces legacy ESLint config format while using ESLint 9 |
| `frontend/package.json:35` | Frontend ESLint 9 vs backend ESLint 8 — incompatible major versions |
| `next.config.ts:16-18` | ESLint disabled during build — lint errors ship to production |
| `next.config.ts:13-15` | TypeScript strict mode but `next-env.d.ts` doesn't exist — fresh builds fail |
| `rebuild.sh:23` | References `.env.example` which doesn't exist |
| `rebuild.sh:31` | `git pull origin main` without checking working tree — corrupts on conflict |
| `rebuild.sh:58-60` | Deploy considered successful even when services unreachable (`warn` not `fail`) |
| `backend/package.json:18` | `test:routes` script uses `jest` but `jest` is not a dependency |
| `backend/package.json:35,48` | `@types/sharp` v0.32.0 for sharp v0.34.x — type mismatch |
| `backend/package.json:37` | Zod v4 (very new, breaking changes from v3) |

### Backend (24)

| File:line | Issue |
|-----------|-------|
| `server.ts:58-61` | Error handler leaks stack traces in production |
| `server.ts:64` | Hardcoded MongoDB URI fallback — should crash on missing env var |
| `server.ts:139-170` | `process.exit(0)` called before async cleanup completes |
| `posts.ts:161-168` | `most_commented` and `most_viewed` sorts have no DB index — in-memory sort on large datasets |
| `posts.ts:171-175` | Loads ALL categories from DB on every GET /api/posts |
| `posts.ts:709+` | Entire route handlers typed as `any` — zero type safety |
| `posts.ts:827-828` | Redis errors silently swallowed |
| `posts.ts:490-492` | Non-null assertion `!` on `req.user` after partial guard |
| `comments.ts:203` | 2h edit window hardcoded instead of reading from system config |
| `comments.ts:38+256` | Missing index on `parent_comment_id` — used in recursive queries |
| `comments.ts:75-89` | Sequential individual DB updates in cron — N+1 |
| `users.ts:53` | Triple unsafe cast for trust level access |
| `users.ts:172-183` | 5-branch `$or` query with no compound index — collection scan |
| `users.ts:208-211` | No `.limit()` on user posts query — unbounded |
| `users.ts:358-364` | Trust score thresholds hardcoded instead of reading config |
| `users.ts:461-470` | Empty catch blocks silently swallow DB errors |
| `admin.ts:308-324` | O(n²) title similarity check on every pending list load |
| `admin.ts:1277` | Missing ES error handling in delete operation |
| `admin.ts:1491` | Synchronous `require()` at route execution time |
| `trustScore.ts:25-33` | In-memory mutates user object before version check |
| `trustScore.ts:55-67` | Trust score thresholds hardcoded (1.0, 1.5, multipliers 2.0/0.5) |
| `fingerprint.ts:67-68` | Only 4.3B possible user IDs (8 hex chars) |
| `fingerprint.ts:127-136` | Grace period generates cookie but never creates User — phantom sessions |

### Frontend (12)

| File:line | Issue |
|-----------|-------|
| `layout.tsx:81,82,96` | 3 components not wrapped in `<Suspense>` |
| `[slug]/client.tsx:84` | Dead code: `loading` state never changes |
| `[slug]/client.tsx:14+152` | RESERVED_ROUTES inline list is stale (9 vs 18 entries) |
| `[slug]/client.tsx:125-126` | Wrong error message in catch block |
| `[slug]/client.tsx:152` | Server/client mismatch on reserved route guard |
| `[slug]/client.tsx:340-346` | Dead code block (unreachable) |
| `submit/client.tsx:805` | Image upload silently swallows all errors |
| `submit/client.tsx:710` | Upload error stored in `titleSimilarity` field |
| `a/[username]/client.tsx:133-140` | Network errors conflated (upload vs PATCH) |
| `search/client.tsx:55-81` | Search bypasses `apiFetch` entirely — no fingerprint, no 425 retry |
| `search/client.tsx:169-195` | Autocomplete not keyboard accessible |
| `stores/admin.ts:89-91` | Logout leaves store in stale state on API error |

---

## SCALING BOTTLENECKS (Must-Fix Before Growth)

| Severity | Issue | Impact at Scale |
|----------|-------|-----------------|
| CRITICAL | `posts.ts:515-528` — loads 5 years of posts for title check | OOM at 50K+ posts |
| CRITICAL | `comments.ts:69-72` — loads 72h of comments every 20min | OOM at 100K+ comments |
| CRITICAL | `comments.ts:122-125` — loads 30d of comments every 6h | OOM at 500K+ comments |
| CRITICAL | `admin.ts:1500-1503` — distinct queries on fingerprints + authors | OOM at 1M+ users |
| CRITICAL | `admin.ts:2627` — loads ALL users | OOM at 100K+ users |
| CRITICAL | `admin.ts:1206` — `redis.keys('alert:*')` | Blocks Redis at 10K+ keys |
| HIGH | `posts.ts:171-175` — loads ALL categories on every request | Slows at 1K+ categories |
| HIGH | `admin.ts:308-324` — O(n²) title similarity on pending list | Unusable at 500+ pending |
| HIGH | `admin.ts:546-560` — sequential `for` loop for bulk ops | 50 requests = 5s+ latency |
| HIGH | `users.ts:208-211` — no `.limit()` on user posts query | Slow at 1K+ posts/user |
| HIGH | `fingerprint.ts:127-136` — phantom User creates per grace hit | DB bloat from automated scanners |

---

## CONSISTENCY ISSUES

| Issue | Files | Fix |
|-------|-------|-----|
| **3 API patterns** | `search/client.tsx`, `a/[username]/client.tsx` use raw `fetch`; most use `API.*`; some use `apiFetch` directly | Unify to `API.*` everywhere |
| **RESERVED_ROUTES in 3 places** | `lib/reservedRoutes.ts`, `[slug]/client.tsx`, `[slug]/history/client.tsx` | Delete inline copies, import from lib |
| **ESLint versions** | Backend ESLint 8, Frontend ESLint 9 | Standardize on one version |
| **TypeScript versions** | Backend TS 5.3.x, Frontend TS 5.x (unpinned) | Sync version ranges |
| **pnpm versions** | Dockerfile uses `pnpm@9` (floating), `package.json` says `9.15.9` | Pin to exact version |
| **User/group naming** | Frontend container: `nextjs:nodejs`, Backend: `nodejs:nodejs` | Standardize |
| **Runtime vs Build-time config** | `NEXT_PUBLIC_API_URL` set in 3 places with different values | Single source of truth |
