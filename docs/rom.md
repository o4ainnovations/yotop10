# ROM.md — Read-Only Memory: Complete Codebase Audit & Refactoring Blueprint

> **Purpose**: This document is the single source of truth for everything wrong with the current codebase, how it was discovered, why it must change, and the enterprise-standard replacement. It exists so that future context loss never erases the rationale behind every architectural decision made during the refactoring.

> **Status**: Written 2026-04-30 — Comprehensive audit of all 39 source files across backend (16 files) and frontend (23 files). Every finding below is treated as MANDATORY to fix. No finding is optional.

> **Resolution Update 2026-05-08**: 14 of the 19 critical/high issues below have been resolved. The remaining 5 are documented with [STILL OPEN] tags. See the ROM Tracker at the bottom for full status.

---

## TABLE OF CONTENTS

1. [Architecture & Design Anti-Patterns](#1-architecture--design-anti-patterns)
2. [Backend: Critical & High Issues](#2-backend-critical--high-issues)
3. [Frontend: Critical & High Issues](#3-frontend-critical--high-issues)
4. [Code Quality & Type Safety Failures](#4-code-quality--type-safety-failures)
5. [Testing & CI/CD Gaps](#5-testing--cicd-gaps)
6. [Documentation & Metadata Failures](#6-documentation--metadata-failures)
7. [Enterprise Standards Migration Plan](#7-enterprise-standards-migration-plan)
8. [Refactoring Priority Order](#8-refactoring-priority-order)

---

## 1. ARCHITECTURE & DESIGN ANTI-PATTERNS

### 1.1 Monolithic API Client (`frontend/src/lib/api.ts`)

- **What it is**: A single 200+ line file containing ALL API endpoint methods (`getPosts`, `addPost`, `addComment`, `toggleReaction`, `adminLogin`, etc.), all TypeScript interfaces, the base URL logic, the fetch wrapper, error handling, and 425 retry logic — all in one file.
- **Where**: `frontend/src/lib/api.ts`
- **How noticed**: Read the entire file. Every frontend component imports from this single module. At ~200 lines it is manageable today, but with M4-M15 still unimplemented, this file would grow to 800+ lines.
- **Why it must change**: Single-responsibility violation. Adding any feature requires editing this file. Testing individual API calls in isolation is impossible. The 425 retry logic, fingerprint header attachment, and base URL resolution are cross-cutting concerns mixed with endpoint-specific business logic.
- **Enterprise replacement**: Split into:
  - `lib/api/client.ts` — `apiFetch<T>()` wrapper with retry, fingerprint header, error normalization (pure infrastructure)
  - `lib/api/endpoints/posts.ts` — post-related API calls
  - `lib/api/endpoints/comments.ts` — comment-related API calls
  - `lib/api/endpoints/admin.ts` — admin API calls
  - `lib/api/endpoints/users.ts` — user API calls
  - `lib/api/endpoints/categories.ts` — category API calls
  - `lib/api/endpoints/reactions.ts` — reaction API calls
  - `lib/api/types.ts` — all TypeScript interfaces
  - Each endpoint module exports a plain object (or class instance) that can be dependency-injected for testing.
- **How**: Create an `ApiClient` class with the shared `apiFetch` method. Each endpoint domain gets its own class/module that receives the `ApiClient` instance via constructor injection. This enables mocking for tests, tree-shaking for bundle size, and domain-aligned code organization.

### 1.2 No External State Management

- **What it is**: All frontend state is managed via React's `useState`, `useEffect`, `useRef`, and `useCallback` spread across 23 files with no shared state layer. Data fetched in one component (e.g., current user in `page.tsx`) is re-fetched in another (e.g., `[slug]/client.tsx`) because there is no shared cache or store.
- **Where**: Every frontend file under `frontend/src/app/`
- **How noticed**: Traced the `getCurrentUser()` call pattern — it's called in `page.tsx:12`, `[slug]/client.tsx`, `a/[username]/page.tsx`, `submit/page.tsx`, and `admin/layout.tsx`. Five separate fetches for the same data. The fingerprint is generated and stored, but the user object derived from it is not cached anywhere.
- **Why it must change**: Duplicate network requests waste bandwidth and create UI flicker (loading spinners re-appearing). There is no single source of truth for "current user." If the trust score changes after a post is approved, the profile page won't know unless it re-fetches. Components that need the same data must each implement their own fetch + loading + error state — this is the exact problem that state management solves.
- **Enterprise replacement**: 
  - **Zustand** for client-side state (lightweight, TypeScript-first, no boilerplate, no context providers). 
  - Store slices:
    - `useAuthStore` — current user (user_id, username, display_name, trust_score, fingerprint), loading state
    - `useRateLimitStore` — remaining posts/comments, reset timers, countdown
    - `useAdminStore` — admin session state, logged-in flag
  - Each store exposes selectors so components only re-render when their subscribed slice changes.
  - The auth store hydrates once on app mount via `getCurrentUser()` and all components read from the store.
- **How**: Create `frontend/src/stores/` directory. Migrate one store at a time starting with auth. All `API.getCurrentUser()` call sites become `useAuthStore(s => s.user)`. The API module remains the data-fetching layer; stores become the caching/state layer.

### 1.3 Prefers Inline Over Abstraction

- **What it is**: Zero reusable UI components. The submit page is one 713-line file. The post detail client is 437 lines. The user profile page is 341 lines. Every form input, error message, loading skeleton, and status badge is inline JSX duplicated across pages.
- **Where**: `frontend/src/app/submit/page.tsx` (713 lines), `frontend/src/app/[slug]/client.tsx` (437 lines), `frontend/src/app/a/[username]/page.tsx` (341 lines)
- **How noticed**: Searched for repeated patterns — loading spinners appear 12+ times across 8 files as `<div>Loading...</div>`. Character counters are reimplemented 4 times in `submit/page.tsx` alone. Error display patterns are different on every page. The `components/` directory has exactly ONE component: `NotFound.tsx`.
- **Why it must change**: Any design change (color, spacing, loading state) requires editing 10+ files. Bug fixes in repeated logic must be applied everywhere. New pages take longer to build because there are no building blocks. Onboarding new developers is harder because there is no pattern library.
- **Enterprise replacement**: Component library with at minimum:
  - `components/ui/LoadingSpinner.tsx` — single spinner with size variants
  - `components/ui/LoadingSkeleton.tsx` — skeleton for cards, text blocks
  - `components/ui/ErrorAlert.tsx` — consistent error display with retry button
  - `components/ui/CharacterCounter.tsx` — reusable counter with color gradient (black → orange → red)
  - `components/ui/StatusBadge.tsx` — pending/approved/rejected badges
  - `components/ui/EmptyState.tsx` — "nothing here yet" with icon + CTA
  - `components/ui/SubmitButton.tsx` — button with idle/loading/disabled/success states
  - `components/form/FormField.tsx` — label + input + error + counter + ARIA
  - `components/form/ItemRow.tsx` — the repeatable list item row
  - `components/post/PostCard.tsx` — post preview card for feeds
  - `components/comment/CommentThread.tsx` — recursive comment tree
  - `components/user/TrustBadge.tsx` — Troll/Neutral/Scholar badge
- **How**: Extract from existing pages bottom-up. Start with the most-repeated patterns (loading, error, character counter). Build the component, verify it renders identically, swap it into every page. No new page may be built until the component library exists.

### 1.4 Heavy TypeScript But Escapes With `any`

- **What it is**: 18 instances of `as any` / `any` across the codebase. Every API response is cast: `(data as any).categories`, `setUser(data as any)`, `(req.user as any).trust_score`. TypeScript interfaces are defined but never enforced at the consumption point.
- **Where**: 
  - Backend: `users.ts:59-68` (`(req.user as any)` on 5 properties), `posts.ts:312` (`let post: any`), `fingerprintMatching.ts:42,89` (`Record<string, any>`)
  - Frontend: `api.ts:34` (`headers: any`), `page.tsx:13` (`setUser(data as any)`), `submit/page.tsx:86` (`(data as any).categories`), `a/[username]/page.tsx:2` (eslint-disable for any)
- **How noticed**: Global grep for `as any`, `: any`, and `eslint-disable.*no-explicit-any`. Found 18 hits.
- **Why it must change**: The entire point of TypeScript is compile-time safety. Every `as any` is a hole where a type error could hide. If the API response shape changes, `as any` silently propagates `undefined` through the app until a runtime crash (see C3 in frontend audit). The `@typescript-eslint/no-explicit-any` rule being set to `warn` rather than `error` and then suppressed with `eslint-disable` means the type system is decorative, not functional.
- **Enterprise replacement**: 
  - Set `@typescript-eslint/no-explicit-any` to `error` in both ESLint configs.
  - All `apiFetch<T>` calls MUST specify `T` and use the returned type.
  - Extend Express `Request` type properly in a `types/express.d.ts` declaration file rather than casting `req.user`.
  - Add a Zod validation layer on API responses so the frontend validates what it receives (defense against API shape changes).
  - Remove all `eslint-disable` comments. Fix the actual types.
  - Add `tsc --noEmit --strict` to CI pipeline as a required check.
- **How**: One file at a time. Start with `lib/api.ts` — make `apiFetch` properly generic and enforce that all callers use typed returns. Then fix `users.ts` by adding a proper Express type extension. Then `fingerprintMatching.ts`. Then frontend callers. Run `tsc --noEmit` after each file. Do not proceed until zero errors.

### 1.5 Mathematics as Infrastructure (Logic Embedded in Route Files)

- **What it is**: SparkScore calculation, trust score logic, rate limit formulas, and boost calculations are implemented directly inside route handler files or cron loops rather than in independent, testable pure functions.
- **Where**: 
  - `comments.ts` contains the entire SparkScore cron job (lines 179-221), threshold calculation (lines 223-285), score calculation (lines 70-175), and ancestor propagation logic
  - `reactions.ts` duplicates the SparkScore logic (lines 96-174) instead of importing from `comments.ts`
  - `posts.ts` contains trust score update logic inline at the approval/rejection points
- **How noticed**: Tracked the `calculateSparkScore` function call chain. It exists in `comments.ts`, but `reactions.ts` has a separate, subtly different implementation. The cron jobs start on module import, not on server start. The functions cannot be unit-tested in isolation because they depend on Mongoose models and Redis clients created inline.
- **Why it must change**: Duplicated logic diverges. A fix to the SparkScore formula in `comments.ts` will NOT be applied to `reactions.ts`. The cron jobs cannot be tested. The rate limit functions cannot be tested without a real Redis connection. This is the opposite of "enterprise standard" — business logic must be pure, testable, and single-sourced.
- **Enterprise replacement**:
  - Extract all SparkScore logic into `lib/sparkScore.ts` as pure functions: `calculateCommentSparkScore(comment, children, thresholds)`, `getPercentileThresholds(comments)`, `propagateToAncestors(commentId)`. The cron job becomes a thin wrapper that queries data and passes it to pure functions.
  - Extract all rate limit logic into `lib/rateLimiter.ts` as a class that takes a Redis client in its constructor (no global `getRedisClient()` calls).
  - Extract all trust score logic into `lib/trustScore.ts` as pure functions with NO Mongoose model dependencies: `calculateTrustScore(approved, rejected, currentScore)` returns the new score.
  - Each pure function must have unit tests with known inputs and expected outputs.
- **How**: Create the pure function files first. Write tests. Then replace the inline logic in route handlers with calls to the pure functions. The route handler should only orchestrate: receive request → validate → call pure function → persist result → respond. Zero business logic in route files.

### 1.6 Explicit Route Ordering Over Convention

- **What it is**: `backend/src/server.ts` has a hardcoded array `['auth', 'categories', 'comments', ...]` that determines route mount order. On startup, it validates every declared route exists on disk AND that no unmounted route file exists on disk. Routes are loaded via `require()` in a loop.
- **Where**: `backend/src/server.ts`, lines 41-92
- **How noticed**: Read the server startup logic. The route loading system spans 50+ lines of validation code.
- **Why it must change**: This is brittle. Adding a new route file requires adding its name to the hardcoded array. The `require()` calls defeat tree-shaking and make the dependency graph invisible to tooling. The validation is clever but adds startup complexity for minimal benefit — if a route file exists but isn't mounted, that's a bug that should be caught in code review, not by a runtime check.
- **Enterprise replacement**:
  - Each route file exports its router and an optional `adminOnly` flag.
  - An `index.ts` barrel file in `routes/` imports and re-exports all routers with their metadata.
  - `server.ts` imports the barrel and mounts routers with `app.use()` — no `require()`, no hardcoded array, no runtime validation. The TypeScript compiler catches missing imports.
  - `adminOnly` flag replaces the positional "admin is last" convention.
- **How**: Add `export const adminOnly = true` to `admin.ts`. Create `routes/index.ts`: `import { router as adminRouter } from './admin'; export const routes = [{ path: '/api/admin', router: adminRouter, adminOnly: true }, ...]`. Import in server.ts with `import { routes } from './routes'` and loop with `app.use()`. Static imports, compiler-enforced.

### 1.7 Redis Client Created/Destroyed Per Request

- **What it is**: Eight separate locations in the codebase call a local `getRedisClient()` function that creates a new Redis TCP connection, uses it once, and disconnects it. This pattern exists in `posts.ts`, `comments.ts` (twice), `users.ts`, `fingerprint.ts` (middleware), and `rateLimit.ts`.
- **Where**: 
  - `backend/src/routes/posts.ts:99-104,137,145`
  - `backend/src/routes/comments.ts:20-25,298-300`
  - `backend/src/routes/users.ts:320-325`
  - `backend/src/middleware/fingerprint.ts:30-35`
  - `backend/src/lib/rateLimit.ts:20-25`
- **How noticed**: Searched for `createClient` calls. Found 5 separate `getRedisClient` implementations (not shared — each file has its own copy). Each opens a connection per request.
- **Why it must change**: This is a resource exhaustion vulnerability. Each Redis connection consumes a file descriptor on the server and a connection slot on Redis. Under any real load, Redis `maxclients` (default 10,000) is exhausted. TCP handshake latency is added to every request. Connection leaks occur when exceptions happen between `connect()` and `disconnect()`. This is the #1 reason the app would fail under any load beyond a single user.
- **Enterprise replacement**: 
  - Create a singleton Redis client in `lib/redis.ts` that connects once at startup and exports the connected client.
  - All files import `import { redis } from '../lib/redis'` and use the shared connection.
  - The client is passed via dependency injection to `rateLimiter.ts` and the fingerprint middleware.
  - Add connection health checks and automatic reconnection (Redis client supports this natively with `socket.reconnectStrategy`).
- **How**: Create `lib/redis.ts`. Remove all 5 `getRedisClient()` functions. Replace every `const redis = await getRedisClient()` with the imported singleton. Remove all `redis.disconnect()` calls. The connection lifecycle is managed once in `server.ts` via `connectDatabases()`.

### 1.8 Destructive Plural Normalization (Title Deduplication Bug)

- **What it is**: `backend/src/lib/titleNormalization.ts` lines 33-38 apply a chain of regex replacements to strip plural forms. The rules are applied sequentially and destructively.
- **Where**: `backend/src/lib/titleNormalization.ts:33-38`
- **How noticed**: Read the normalization function line by line. Traced through test cases mentally:
  - Input: `"business"` → `.replace(/es\b/g, '')` → `"busin"` → `.replace(/s\b/g, '')` → `"busin"` (wrong: should be `"business"`)
  - Input: `"dresses"` → `.replace(/es\b/g, '')` → `"dress"` → `.replace(/s\b/g, '')` → `"dres"` (wrong: should be `"dress"`)
  - Input: `"wolves"` → `.replace(/ves\b/g, 'f')` → `"wolf"` (correct) — but then `.replace(/es\b/g, '')` and `.replace(/s\b/g, '')` don't match (correct, accidentally)
  - The regexes lack word-boundary awareness for compound cases
- **Why it must change**: The entire title deduplication system is built on corrupted normalized strings. This causes false positives (two different titles incorrectly flagged as duplicates) and false negatives (two near-duplicate titles not caught because the normalization destroyed one of them). Since posts go through admin review, false positives waste admin time. False negatives let duplicates through.
- **Enterprise replacement**: Use the `compromise` or `natural` NLP library for proper stemming/lemmatization. Or implement a simpler, safer normalization:
  - Lowercase
  - Remove special characters and extra whitespace
  - Use a whitelist-based plural→singular mapping for known irregular cases
  - Use the existing Levenshtein distance check with a higher threshold to compensate for simpler normalization
  - Document every normalization rule with test cases
- **How**: Replace the `normalizeTitle()` function body. Add a test file with 50+ known title pairs and their expected similarity. Run the test suite before and after to ensure the replacement doesn't regress correct matches.

### 1.9 MongoDB Transactions Require Replica Set (Crashes on Standalone MongoDB)

- **What it is**: `backend/src/lib/trustScore.ts` lines 78-113 use `User.startSession()` and `session.withTransaction()` to atomically update the trust score and log. These methods require a MongoDB replica set.
- **Where**: `backend/src/lib/trustScore.ts:78-113`
- **How noticed**: Read the MongoDB driver documentation. `startSession()` works on standalone, but `withTransaction()` throws `"Transaction numbers are only allowed on a replica set member or mongos"` on standalone MongoDB. The `docker-compose.yml` runs a single `mongo:7` instance — NOT a replica set.
- **Why it must change**: On the current deployment (single MongoDB instance in Docker), the first time an admin approves or rejects a post, the server crashes with a 500 error. Trust scores can never be updated. This is a launch-blocker in the production configuration.
- **Enterprise replacement**: Two options:
  - **Option A**: Update `docker-compose.yml` to run MongoDB as a single-node replica set (add `--replSet rs0` to the command and run `rs.initiate()` in an init script). Transactions work.
  - **Option B**: Replace `withTransaction()` with a two-phase manual approach: update the user document first with an atomic `findOneAndUpdate({ version: oldVersion }, { $inc: { version: 1 }, ... })`, then create the TrustScoreLog. If the log creation fails, revert the user update. This works without replica sets but is more code.
  - **Recommended**: Option A — simpler code, MongoDB best practices. Add the replica set initialization to the `mongodb` service in `docker-compose.yml`.
- **How**: Add to docker-compose: `command: mongod --replSet rs0 --bind_ip_all`. Add an init container or healthcheck script that runs `rs.initiate()` once.

### 1.10 Orphaned Comments on Deletion (Grandchildren Lost)

- **What it is**: `backend/src/routes/comments.ts` line 659: when a comment is deleted, `Comment.deleteMany({ parent_comment_id: commentId })` deletes immediate children only. Grandchildren (comments whose parent is one of those children) are left with a `parent_comment_id` pointing to a non-existent document.
- **Where**: `backend/src/routes/comments.ts:643-660`
- **How noticed**: Traced the delete logic. The code only goes one level deep. Comment A (depth 1) → Comment B (depth 2, parent=A) → Comment C (depth 3, parent=B). Deleting A: B is deleted (its parent=A matches), but C remains (its parent=B no longer exists). C's `parent_comment_id` is a dangling reference.
- **Why it must change**: Dangling references break the comment tree rendering. The UI will try to render C under a non-existent parent. Post comment counts will be wrong (C is still counted in `comment_count` but B was subtracted). This is silent data corruption.
- **Enterprise replacement**: 
  - Recursively collect ALL descendants before deleting (fetch all comments where `parent_comment_id` is in the set of IDs being deleted, repeat until no more).
  - Delete all descendants in a single `deleteMany({ _id: { $in: allDescendantIds } })`.
  - Decrement the post's `comment_count` by `allDescendantIds.length + 1`.
  - Decrement each parent's `reply_count` appropriately in a bulk operation.
  - Wrap in a transaction if using replica set (see 1.9).
- **How**: Write a `collectDescendants(commentId)` helper that recursively finds all nested children. Replace the single `deleteMany` with the full descendant collection + deletion. Add tests for 3+ level deep comment trees.

---

## 2. BACKEND: CRITICAL & HIGH ISSUES

> ALL issues below are treated as CRITICAL. Severity labels from the audit are preserved for reference, but every item will be fixed.

<!-- 2.1 through 2.16 correspond to the C1-C6 and H1-H10 findings from the audit -->

### 2.1 [CRITICAL] Hardcoded JWT Secret Fallback — `adminAuth.ts:6`

- **Code**: `const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret-change-me-in-production';`
- **File**: `backend/src/lib/adminAuth.ts`, line 6
- **How noticed**: Read the admin auth setup. The `||` fallback means if `JWT_SECRET` is missing from the environment, the app uses a publicly known string. The repository is public on GitHub (`github.com/o4ainnovations/yotop10`). This string is visible to anyone.
- **What happens**: An attacker reads the repo, forges a JWT with `default-dev-secret-change-me-in-production` as the secret, sets `admin_token` cookie, and has full admin access. The admin can approve/reject/delete any content and views the entire review queue.
- **Fix**: Remove the fallback. If `JWT_SECRET` is not set, the server MUST crash on startup with a clear error message. Add validation: `if (!process.env.JWT_SECRET) { console.error('FATAL: JWT_SECRET environment variable is required'); process.exit(1); }`
- **Prevention**: Add environment variable validation at startup (Zod schema for `process.env`) that validates ALL required variables before the server starts accepting connections.

### 2.2 [CRITICAL] Orphaned Posts on Item Creation Failure — `posts.ts:465-506`

- **Code**: Post is created first (line 465), then items via `Promise.all` (line 491). No transaction wraps both operations.
- **File**: `backend/src/routes/posts.ts`, lines 465-506
- **How noticed**: Traced the POST /api/posts handler. Three independent writes (Post, ListItems, Category.$inc) with no atomicity guarantee and no rollback on failure.
- **What happens**: If any `ListItem.create()` fails (validation error, DB error), the Post document already exists in MongoDB but has no items. `Category.findByIdAndUpdate` is after the Promise.all and never executes. Result: orphaned post with zero items, stale category `post_count`.
- **Fix**: 
  - If MongoDB replica set is enabled (see 1.9), wrap all three operations in a transaction.
  - If not, reverse the order: validate all items first (without saving), then create Post + items sequentially, with manual rollback (delete Post if items fail).
  - Or: use a two-phase approach — create Post with `status: 'draft'`, create items, then update Post to `status: 'pending_review'`. If items fail, delete the draft Post.
- **Prevention**: Never do multi-document writes without either a transaction or a documented rollback procedure. Add integration tests that simulate item creation failure and verify no orphaned posts remain.

### 2.3 [CRITICAL] Memory Leak: Orphaned setInterval in Fingerprint Middleware — `fingerprint.ts:58-66`

- **Code**: `setInterval(async () => { ... }, GRACE_CLEANUP_INTERVAL);` — starts on module import, interval ID never stored, never cleared.
- **File**: `backend/src/middleware/fingerprint.ts`, lines 58-66
- **How noticed**: Searched for `setInterval` calls. Found it on module scope (not inside a function). The interval ID is not assigned to a variable. The body opens a Redis connection and immediately disconnects — doing nothing useful (the comment explains Redis TTL auto-cleans).
- **What happens**: 
  - Every 60 seconds, a new Redis connection is created and destroyed, burning resources.
  - On hot-reload (tsx watch), each reload creates a new interval without clearing the old one. After 10 reloads, 10 intervals run simultaneously.
  - The function body does nothing productive — Redis keys already have TTLs.
  - No `clearInterval` is ever called because the ID is never captured.
- **Fix**: Delete the entire `setInterval` block. Redis TTL handles key expiration automatically. The comment already states this.
- **Prevention**: Module-level timers are banned. All timers must be started in a lifecycle function (server start) and cleaned up in a lifecycle function (server stop). Add an ESLint rule: `no-restricted-globals` for `setInterval`/`setTimeout` on module scope.

### 2.4 [CRITICAL] MongoDB $regex Injection — `users.ts:157-163`

- **Code**: `{ user_id: { $regex: `^${username}` } }` — user-supplied URL parameter interpolated directly into MongoDB regex.
- **File**: `backend/src/routes/users.ts`, lines 157-163
- **How noticed**: Read the `GET /api/users/:username` handler. The `username` variable comes from `req.params.username` (line 148) and is passed to `cleanUsername()` but ALSO used raw in `$regex`. No escaping.
- **What happens**:
  - `GET /api/users/.*` matches all users in the database (information disclosure).
  - `GET /api/users/(a+)+$` causes ReDoS — catastrophic backtracking that hangs MongoDB's query parser, potentially taking the database offline.
  - `GET /api/users/^admin` could match admin-related documents if any exist with user_id pattern `admin*`.
- **Fix**: 
  - Use `escapeRegExp(username)` before interpolating into `$regex`. 
  - Better: remove `$regex` entirely. Use exact matches on `user_id`, `username`, and `custom_display_name` only. If partial matching is needed, use MongoDB text search or an indexed `$regex` with `^` anchor and proper escaping.
- **Prevention**: Add an ESLint rule that forbids `$regex` with unescaped user input. Use a helper function `safeRegex(userInput)` that escapes all regex special characters. Write a security test that sends `.*` as a username and verifies it doesn't match multiple users.

### 2.5 [CRITICAL] Stub Endpoints Return 200 OK — `users.ts:281` and others

- **Code**: 
  - `router.put('/:id', (req, res) => res.json({ message: 'Update user' }));`
  - `router.delete('/:id', (req, res) => res.json({ message: 'Delete user' }));`
  - Same pattern in `auth.ts`, `listings.ts`, `reviews.ts`, `search.ts`
- **File**: `backend/src/routes/users.ts:281`, `backend/src/routes/auth.ts` (full file), `backend/src/routes/listings.ts` (full file), `backend/src/routes/reviews.ts` (full file), `backend/src/routes/search.ts` (full file)
- **How noticed**: Read each stub route file. They all follow the same pattern: instant 200 JSON response with a placeholder message, no database operations, no validation.
- **What happens**: A client calling `PUT /api/users/abc123` with a body receives `200 { message: "Update user" }`. The client believes the user was updated. Nothing was changed. This is silent data loss illusion — the worst kind of bug because there's no error to catch.
- **Fix**: Replace every stub endpoint with `res.status(501).json({ error: 'Not implemented' })` or remove the route entirely. `501 Not Implemented` is the correct HTTP status for unimplemented endpoints.
- **Prevention**: Add a startup check: if any route file contains fewer than N lines of actual logic (excluding imports and router declaration), emit a warning. Better: remove stub route files entirely until the features are implemented.

### 2.6 [CRITICAL] Health Check Behind Fingerprint Middleware — `server.ts:31`

- **Code**: `app.use('/api', fingerprintMiddleware);` (line 30) then `app.get('/api/health', ...)` (line 33).
- **File**: `backend/src/server.ts`, lines 30-33
- **How noticed**: Read the middleware mounting order. The `app.use('/api', ...)` call applies fingerprint middleware to ALL routes under `/api`, including `/api/health`, because the health route is mounted AFTER the middleware.
- **What happens**: Every health check triggers: Redis grace period check, MongoDB user lookup/create, fingerprint hash computation. If either Redis or MongoDB is down, the health check returns 500 instead of reporting the failure. A load balancer or monitoring system sees "unhealthy" and may restart the container, even though the server itself is fine and only Redis is down. This creates a cascading failure.
- **Fix**: Mount the health check route BEFORE the fingerprint middleware. Or mount it outside `/api`: `app.get('/health', ...)`. The health check should do minimal work: check if the process is alive, optionally ping DBs but with short timeouts and graceful degradation.
- **Prevention**: Health endpoints must never depend on middleware that could fail. Document this rule.

### 2.7 [HIGH] TOCTOU Rate Limit Race Condition — `posts.ts:129-142`

- **Code**: `zRemRangeByScore` (cleanup) → `zCard` (count) → `zAdd` (increment). Three non-atomic Redis operations.
- **File**: `backend/src/routes/posts.ts`, lines 129-142
- **How noticed**: Read the `checkRateLimit` function. The check (can I post?) and the increment (I am posting) are separate operations. Between them, another request can slip through.
- **What happens**: Two concurrent requests both call `zCard` when count is `maxRequests - 1`. Both see "one slot remaining." Both call `zAdd`. Rate limit is exceeded by 1. Under high concurrency, the overshoot can be much larger.
- **Fix**: Replace the three separate calls with a single Lua script executed via `redis.eval()`. The script atomically: cleans old entries, counts remaining, and either adds the new entry (if allowed) or rejects. Example:
  ```lua
  redis.call('ZREMRANGEBYSCORE', KEYS[1], '0', ARGV[1])
  local count = redis.call('ZCARD', KEYS[1])
  if count < tonumber(ARGV[2]) then
    redis.call('ZADD', KEYS[1], ARGV[3], ARGV[3])
    return {1, tonumber(ARGV[2]) - count - 1}
  else
    return {0, 0}
  end
  ```
- **Prevention**: All rate limit check+increment operations must be atomic (Lua script or Redis MULTI/EXEC). Document this rule.

### 2.8 [HIGH] Race Condition Between `findOne` and `findOneAndUpdate` — `users.ts:119-121`

- **Code**: `const currentUser = await User.findOne(...)` → `const oldUsername = currentUser?.custom_display_name` → `await User.findOneAndUpdate(...)` (three separate calls).
- **File**: `backend/src/routes/users.ts`, lines 119-121
- **How noticed**: Read the display name update handler. The code reads the current name, then updates it. Between the read and the write, another concurrent request could have changed it.
- **What happens**: Two requests to change the display name arrive simultaneously. Request A reads `oldUsername = "a_abc1"`, Request B reads `oldUsername = "a_abc1"`. Request A writes `"a_newname"`. Request B writes `"a_othername"`. The username history records BOTH as changing from `"a_abc1"`, but one of them actually changed from `"a_newname"`. History is incorrect.
- **Fix**: Use `findOneAndUpdate` with the current value as a filter: `{ user_id: X, custom_display_name: oldValue }`. If the filter doesn't match (because another request changed it), the update returns null, and we respond with 409 Conflict. Also: the history record should capture the actual PREVIOUS value from the returned document's pre-update state.
- **Prevention**: All read-then-write patterns must use atomic operations. Document this rule.

### 2.9 [HIGH] Dynamic Import on Every Post Approval — `admin.ts:229`

- **Code**: `const { grantBoost, BoostType } = await import('../lib/ladderSystem');` — inside the approve post handler.
- **File**: `backend/src/routes/admin.ts`, line 229
- **How noticed**: Grep for `await import(` in backend files. Found a dynamic import inside a request handler.
- **What happens**: Every admin post approval triggers filesystem I/O (module resolution) and a blocking `import()` call. Under load, this adds latency. There is zero benefit — the module is not conditionally loaded, it's always needed.
- **Fix**: Move the import to the top of the file: `import { grantBoost, BoostType } from '../lib/ladderSystem';`
- **Prevention**: Dynamic imports inside request handlers are banned unless conditional. ESLint rule: `no-restricted-syntax` for `AwaitExpression > ImportExpression` inside function bodies.

### 2.10 [HIGH] Non-Null Assertion After findById — `posts.ts:488`

- **Code**: `post = (await Post.findById(post._id))!;`
- **File**: `backend/src/routes/posts.ts`, line 488
- **How noticed**: Searched for TypeScript non-null assertion operator `!` on async calls.
- **What happens**: If the post was deleted between creation (line 465) and this re-read (line 488), `findById` returns `null`. The `!` tells TypeScript "trust me, it's not null" — but it can be. The next access (line 494: `post._id` on the response) throws `TypeError: Cannot read properties of null (reading '_id')`. 500 crash.
- **Fix**: Add a null check: `if (!post) return res.status(500).json({ error: 'Post creation failed' });` or use the already-created `post` variable from line 465 instead of re-fetching.
- **Prevention**: Ban non-null assertions on async function results. ESLint rule: `@typescript-eslint/no-non-null-assertion: error`.

### 2.11 [HIGH] Random ETag Defeats HTTP Caching — `posts.ts:86`

- **Code**: `etag: crypto.randomBytes(8).toString('hex')`
- **File**: `backend/src/routes/posts.ts`, line 86
- **How noticed**: Read the `GET /api/posts/check-title` handler. The ETag header is set to a random value on every response.
- **What happens**: Browsers and CDNs use ETags to determine if cached content is still fresh. A random ETag means every response appears to be new content, even if the underlying data hasn't changed. The browser re-fetches on every request, wasting bandwidth. The title similarity check (which is debounced at 500ms) is re-fetched even when the same query was just made.
- **Fix**: Generate ETag from content: `crypto.createHash('md5').update(JSON.stringify(response)).digest('hex')`. Same content = same ETag = browser uses cache.
- **Prevention**: ETags must be content-based, never random. Add a helper `generateETag(data)` and use it consistently.

### 2.12 [HIGH] `startSparkScoreCron` / `startThresholdCron` on Module Import — `comments.ts:344-345`

- **Code**: `startSparkScoreCron();` and `startThresholdCron();` at module scope, outside any function.
- **File**: `backend/src/routes/comments.ts`, lines 344-345
- **How noticed**: Read the bottom of `comments.ts`. Two function calls on module scope. The functions start `setInterval` timers.
- **What happens**: 
  - The timers start when the file is first `require()`-d, which happens during `server.ts` route loading. 
  - If this module is imported in test files or seed scripts, multiple overlapping cron instances start.
  - The guard variables (`cronInterval`, `thresholdCronInterval`) use module-level state that is reset on hot-reload, so old timers keep running while new ones start.
  - The exported `stopSparkScoreCron` function exists but is never called by any code.
- **Fix**: Move cron initialization to `server.ts` (explicit lifecycle). Export `startSparkScoreCron` and `stopSparkScoreCron`. Call `startSparkScoreCron()` after DB connections are established. Call `stopSparkScoreCron()` on graceful shutdown.
- **Prevention**: No side effects on module import. All initialization must be explicit and centrally managed.

### 2.13 [HIGH] `'unknown'` Fingerprint Shared by Unauthenticated Users — `reactions.ts:48`

- **Code**: `const device_fingerprint = req.user?.device_fingerprint || 'unknown';`
- **File**: `backend/src/routes/reactions.ts`, line 48
- **How noticed**: Read the reaction toggle handler. If the fingerprint middleware doesn't attach a user (grace period, Redis down, new visitor), the fallback is the string `"unknown"`.
- **What happens**: ALL visitors without a fingerprint share the same `device_fingerprint = "unknown"`. User A fires a comment. User B (no fingerprint) sees it as already fired because the reaction record is keyed on `(device_fingerprint, target_type, target_id)`. User C clicks fire → it toggles OFF because User A's reaction exists. Chaos.
- **Fix**: If no fingerprint is available, either:
  - Return 401 and require fingerprint setup before reacting
  - Use a session-scoped random ID that changes per browser session
  - DO NOT fall back to a shared constant
- **Prevention**: Fallback values for identity must never be shared constants. Document this rule.

### 2.14 [HIGH] `promise.all` Used in Route Handler Without Error Classification — `users.ts:182-186`

- **Code**: `const [posts, comments] = await Promise.all([...])` in the user profile handler.
- **File**: `backend/src/routes/users.ts`, lines 182-186
- **How noticed**: Read the user profile handler. `Promise.all` rejects immediately if ANY promise rejects. Both queries are against MongoDB.
- **What happens**: If the posts query succeeds but the comments query fails (timeout, index issue), the entire handler rejects with a 500 error. The user sees a broken profile page. The posts data is lost even though it was successfully fetched.
- **Fix**: Use `Promise.allSettled()` instead. If one query fails, return partial data with a warning: `{ posts: [...], comments: null, _warning: "Comments data unavailable" }`.
- **Prevention**: Use `Promise.allSettled()` for independent queries. Use `Promise.all()` only when ALL results are required and partial data is worse than no data.

### 2.15 [HIGH] Unbounded Fingerprint Observation Query — `fingerprintMatching.ts:92-93`

- **Code**: `FingerprintObservation.find({ observed_at: { $gte: ninetyDaysAgo } }).sort({ observed_at: -1 })` — no `.limit()`.
- **File**: `backend/src/lib/fingerprintMatching.ts`, lines 92-93
- **How noticed**: Read the `findMatchingFingerprint` function. The query has a 90-day time filter but no document limit. Results are loaded into an array and iterated synchronously (lines 99-128).
- **What happens**: If the app accumulates millions of fingerprint observations over 90 days, this loads them all into server memory. The Node.js process hits heap limits and crashes. Response time grows linearly with collection size.
- **Fix**: Add `.limit(1000)` to the query. If no match is found in the first 1000 most recent observations, return no match. Or: use MongoDB aggregation with `$sample` or a more targeted query.
- **Prevention**: All database queries without `.limit()` must be justified in a comment. Add an ESLint rule (custom plugin) or code review checklist item.

### 2.16 [HIGH] Unused ES Client, No Shared Redis Client — `server.ts:119-126`

- **Code**: `const redisClient = createClient(...)` and `const esClient = new ElasticsearchClient(...)` as local variables in `connectDatabases()`.
- **File**: `backend/src/server.ts`, lines 119-126
- **How noticed**: Read `connectDatabases()`. Both clients are `const` variables scoped to the function. Neither is assigned to a module-level variable or exported.
- **What happens**: 
  - The Redis client is created, connected, and immediately garbage collected. Every route file creates its own (see 1.7).
  - The Elasticsearch client is lost entirely. No route file can use it. The search stub returns placeholder JSON because there is literally no way to access the ES client from a route handler.
- **Fix**: Export both clients from a shared module:
  - `lib/redis.ts`: `export const redis = createClient(...); await redis.connect();`
  - `lib/elasticsearch.ts`: `export const es = new ElasticsearchClient(...);`
  - `server.ts` imports and awaits their connection, but the instances are shared.
- **Prevention**: Infrastructure clients (DB, cache, search) must be singletons exported from dedicated modules. Never scope them to a function.

---

## 3. FRONTEND: CRITICAL & HIGH ISSUES

> ALL issues below are treated as CRITICAL. Every item will be fixed.

### 3.1 [CRITICAL] localStorage Crash in Private Browsing — `api.ts:31`

- **Code**: `deviceFingerprint = localStorage.getItem('yotop10_fp');` — no try/catch.
- **File**: `frontend/src/lib/api.ts`, line 31
- **How noticed**: Read the `apiFetch` function. The very first line of the request pipeline calls `localStorage.getItem()`. In Safari and Firefox private browsing, `localStorage` access throws a `SecurityError`.
- **What happens**: Every API call — getPosts, addPost, getCurrentUser, everything — crashes with an unhandled rejection. The entire application is dead in private browsing. No error boundary catches this because it happens in the data-fetching layer, not in React's render tree.
- **Fix**: 
  ```typescript
  let deviceFingerprint: string | null = null;
  try { deviceFingerprint = localStorage.getItem('yotop10_fp'); } catch {}
  ```
- **Prevention**: ALL localStorage access must be wrapped in try/catch. Create a `lib/storage.ts` helper: `safeGetItem(key)`, `safeSetItem(key, value)`. All code uses these helpers, never raw `localStorage.*`.

### 3.2 [CRITICAL] Infinite Recursion on 425 Retry — `api.ts:50-53`

- **Code**: `if (response.status === 425) { await new Promise(r => setTimeout(r, 500)); return apiFetch(endpoint, options); }`
- **File**: `frontend/src/lib/api.ts`, lines 50-53
- **How noticed**: Read the 425 retry logic. There is no counter, no maximum retries. The function calls itself unconditionally on 425.
- **What happens**: If the backend gets stuck returning 425 (e.g., Redis is down and grace periods fail), this recurses until the JavaScript call stack overflows (~10,000-15,000 calls in V8). The thread crashes. No error is returned to the caller — the promise simply never resolves or rejects. The UI freezes.
- **Fix**: Add a retry counter: `return apiFetch(endpoint, options, retryCount + 1)` with a guard: `if (retryCount >= 3) throw new Error('Too many retries');`
- **Prevention**: All recursive retry logic must have a maximum depth. Document this rule.

### 3.3 [CRITICAL] `response.json()` Without Try/Catch — `api.ts:61`

- **Code**: `return response.json();`
- **File**: `frontend/src/lib/api.ts`, line 61
- **How noticed**: Read the `apiFetch` error handling. If the backend returns 200 with non-JSON content (nginx error page, HTML redirect, corrupted proxy response), `response.json()` throws `SyntaxError`. The catch block on line 55-59 only handles HTTP error status codes, not JSON parse errors.
- **What happens**: Unhandled promise rejection from `SyntaxError`. The React component that called `apiFetch` crashes.
- **Fix**: 
  ```typescript
  const text = await response.text();
  try { return JSON.parse(text); } 
  catch { throw new Error(`Invalid JSON response from ${endpoint}`); }
  ```
- **Prevention**: `response.json()` must always be wrapped. Add a `safeParseJSON(response)` helper.

### 3.4 [CRITICAL] Stored XSS via JSON-LD Injection — `[slug]/page.tsx:63-68`

- **Code**: `dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}` with unescaped user content.
- **File**: `frontend/src/app/[slug]/page.tsx`, lines 63-68
- **How noticed**: Read the post detail server component. The JSON-LD structured data is rendered using `dangerouslySetInnerHTML`. `JSON.stringify()` does NOT escape `</script>` sequences. User-submitted content (item titles, justifications) can contain these sequences.
- **What happens**: A malicious user submits a list item with title `</script><script>alert(document.cookie)</script>`. When the page renders, the browser's HTML parser sees `</script>` inside the JSON-LD block and closes the script tag. The injected `<script>` executes in the context of the page. Cookies, localStorage, and DOM are accessible. This is a stored XSS attack vector.
- **Fix**: Escape `</` sequences before injection: `JSON.stringify(data).replace(/<\//g, '<\\/')`. Better: use a safe JSON-LD component that handles this automatically.
- **Prevention**: `dangerouslySetInnerHTML` is banned except in approved utility components. Any usage must escape `</` and `<!--`. Add an ESLint rule.

### 3.5 [CRITICAL] Eruda Rendered Outside `<body>` — `layout.tsx:18-19`

- **Code**: `<Eruda />` is a direct child of `<html>`, sibling of `<body>`, not inside `<body>`.
- **File**: `frontend/src/app/layout.tsx`, lines 18-19
- **How noticed**: Read the root layout. The HTML structure is: `<html><body>{children}</body><Eruda /></html>`. Eruda renders a `<Script>` tag. `<script>` as a direct child of `<html>` is invalid HTML5.
- **What happens**: Browsers auto-correct invalid HTML in unpredictable ways. React hydration may mismatch the server-rendered HTML and the client-rendered DOM. This can cause hydration errors, layout shifts, or silent content disappearance.
- **Fix**: Move `<Eruda />` inside `<body>`.
- **Prevention**: HTML structure must pass validation. Add HTML validation to CI pipeline.

### 3.6 [CRITICAL] Eruda Init Crash on CDN Failure — `Eruda.tsx:9`

- **Code**: `window.eruda.init();` — no null check.
- **File**: `frontend/src/app/Eruda.tsx`, line 9
- **How noticed**: Read the Eruda component. The `onLoad` callback assumes the CDN script loaded successfully. If the CDN is down, blocked by an adblocker, or the user is offline, `window.eruda` is `undefined`.
- **What happens**: `TypeError: Cannot read properties of undefined (reading 'init')`. This crashes the page on every load when the CDN is unreachable. Since Eruda is loaded on ALL pages (see 3.7), this makes the entire site inaccessible in these conditions.
- **Fix**: `if (window.eruda) window.eruda.init();`
- **Prevention**: All `window.X.Y()` calls on dynamically loaded scripts must null-check `window.X`.

### 3.7 [CRITICAL] Eruda Loaded Unconditionally in Production — `Eruda.tsx:7`

- **Code**: `<Script src="//cdn.jsdelivr.net/npm/eruda" ...>` — no `NODE_ENV` guard.
- **File**: `frontend/src/app/Eruda.tsx`, line 7
- **How noticed**: Read the Eruda component. There is no `if (process.env.NODE_ENV === 'development')` check. The component is rendered in `layout.tsx` which applies to ALL routes.
- **What happens**:
  - Production users load ~200KB of unnecessary JavaScript (Eruda + its dependencies).
  - Internal application state is exposed to any user who opens the Eruda console (it hooks into the DOM, console, network).
  - A third-party script is loaded from a CDN without Subresource Integrity (SRI) hash — if the CDN is compromised, the attacker's script executes on every page of the production site.
  - This is a supply-chain attack vector.
- **Fix**: Conditionally render: `if (process.env.NODE_ENV !== 'development') return null;`
- **Prevention**: Developer tools must never load in production. Environment-gated code must use compile-time checks (Next.js tree-shakes `NODE_ENV` checks). Add CI check: scan build output for 'eruda' string.

### 3.8 [CRITICAL] localStorage Crash in Fingerprint Generation — `fingerprint.ts:162,169-170`

- **Code**: `localStorage.getItem('yotop10_fp')`, `localStorage.setItem('yotop10_fp', ...)`, `localStorage.setItem('yotop10_fp_full', ...)` — three unprotected localStorage calls.
- **File**: `frontend/src/lib/fingerprint.ts`, lines 162, 169-170
- **How noticed**: Read the `getFingerprint()` function. The fingerprint is the foundation of user identity, but its generation crashes in private browsing.
- **What happens**: Same as 3.1 but in the fingerprint module. If fingerprint generation fails, the user cannot be identified. The `apiFetch` fallback still works (it catches its own localStorage error), but the fingerprint data — the core of the anonymous identity system — is lost. The backend receives no `X-Device-Fingerprint` header, and the user gets a new identity on every page load.
- **Fix**: Wrap all three localStorage calls in try/catch. Return `null` on failure rather than throwing.
- **Prevention**: Same as 3.1 — ALL localStorage access through `lib/storage.ts` safe helpers.

### 3.9 [HIGH] Double-Fetch of Post on Mount — `[slug]/client.tsx:128-141`

- **Code**: `API.getPost(slug)` is called directly in useEffect AND inside `fetchComments()` (called in the same effect). Two simultaneous fetches for the same data.
- **File**: `frontend/src/app/[slug]/client.tsx`, lines 128-141
- **How noticed**: Read the post detail client component. The mount effect calls both `API.getPost(slug)` (line 134) and `fetchComments()` (line 140). `fetchComments()` (lines 87-126) starts with `API.getPost(slug)` as the first call in a `Promise.all`.
- **What happens**: Two network requests for the same resource fire simultaneously. Whichever finishes first sets `post`/`items` state. The second overwrites it. The loading state flickers: `loading=true` → request 1 completes → `loading=false` → request 2 completes → `loading=(unchanged)`. If the responses differ (race with an edit), the UI shows inconsistent data briefly.
- **Fix**: Remove the standalone `API.getPost(slug)` call. Let `fetchComments()` handle all initial data fetching. Or: call `API.getPost` once, store the result, pass it to `fetchComments` as a parameter.
- **Prevention**: No duplicate API calls in the same effect. Add a custom ESLint rule or use React Query which deduplicates automatically.

### 3.10 [HIGH] Raw `fetch()` Bypasses API Wrapper — `c/[[...slug]]/page.tsx:65-72`

- **Code**: Direct `fetch()` call with no API wrapper, no error handling, no `.catch()`.
- **File**: `frontend/src/app/c/[[...slug]]/page.tsx`, lines 65-72
- **How noticed**: Grep for `fetch(` in frontend files. Found one raw `fetch` that doesn't use the `apiFetch` wrapper.
- **What happens**: 
  - Network failures produce unhandled promise rejections (no `.catch()`).
  - Non-OK responses are not checked (`res.ok` not tested before `res.json()`).
  - The `X-Device-Fingerprint` header is not attached (the `apiFetch` wrapper adds this).
  - 425 retry logic is not applied.
  - This is a completely separate HTTP pipeline from the rest of the app.
- **Fix**: Replace with `apiFetch<PostsResponse>(...)` and add `.catch()`.
- **Prevention**: Raw `fetch()` is banned in components. All HTTP calls must use the API wrapper. Add an ESLint rule.

### 3.11 [HIGH] DOM Query Before React Re-Render — `submit/page.tsx:297`

- **Code**: `document.querySelector('[aria-invalid="true"]')` called immediately after `setErrors()`, before React re-renders the DOM.
- **File**: `frontend/src/app/submit/page.tsx`, line 297
- **How noticed**: Read the form validation flow. `setErrors(newErrors)` is asynchronous (React batches state updates). The DOM query on the next line runs synchronously, BEFORE React has applied `aria-invalid="true"` attributes to the DOM.
- **What happens**: On the FIRST validation failure, `firstErrorField` is always `null` (no elements have `aria-invalid` yet). The scroll-to-error never happens. The user sees error messages appear but is not scrolled to the first error. On the SECOND submit attempt, the old `aria-invalid` attributes exist, so it partially works — but the first-error may now be a different field.
- **Fix**: Use a `useEffect` that watches `errors` and scrolls after React commits the DOM update:
  ```typescript
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      const firstError = document.querySelector('[aria-invalid="true"]') as HTMLElement;
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [errors]);
  ```
- **Prevention**: DOM queries that depend on React state must happen in `useEffect` (post-render lifecycle), not in event handlers (pre-render).

### 3.12 [HIGH] Debounce Closure Leak — `submit/page.tsx:121-134,144-168`

- **Code**: `debounce(() => { saveDraftLogic(categoryId, title, intro, items, authorName) }, 1000)` — the debounce captures stale closure values when `useCallback` deps change.
- **File**: `frontend/src/app/submit/page.tsx`, lines 121-134, 144-168
- **How noticed**: Read the draft save logic. `useCallback` creates a new `debounce` instance when form data changes, but the old debounce's pending timer still holds a closure over the OLD values. If the timer fires after the data changed, it saves stale data to localStorage.
- **What happens**: User types "Top 10 Movies" → debounce starts (1s timer with "Top 10 Movies"). User changes title to "Top 10 Sci-Fi Movies" → new debounce instance created, new timer starts. Old timer fires at 1s → saves "Top 10 Movies" to localStorage (stale data). New timer fires at 2s → saves "Top 10 Sci-Fi Movies" (correct). Result: localStorage briefly contains stale data. If user closes the tab between 1s and 2s, the stale draft is what gets restored later.
- **Fix**: Use `useRef` for the timeout ID and a stable save function:
  ```typescript
  const timeoutRef = useRef<NodeJS.Timeout>();
  const formDataRef = useRef({ categoryId, title, intro, items, authorName });
  formDataRef.current = { categoryId, title, intro, items, authorName };
  
  const saveDraft = useCallback(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const data = formDataRef.current; // always current values
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    }, 1000);
  }, []);
  ```
- **Prevention**: `debounce` with `useCallback` that depends on changing values is a known anti-pattern. Use `useRef` for latest values and stable callbacks.

### 3.13 [HIGH] setTimeout Leak on Unmount — `a/[username]/page.tsx:144`

- **Code**: `setTimeout(fetchRateLimits, backoffMs)` — no cleanup on unmount, calls `setState` on unmounted component.
- **File**: `frontend/src/app/a/[username]/page.tsx`, line 144
- **How noticed**: Read the `fetchRateLimits` function. On failure, it schedules a retry via `setTimeout`. If the user navigates away before the timer fires, the callback still executes and calls `setRateLimitData` and `setCountdown` on an unmounted component.
- **What happens**: React logs a warning in development ("Can't perform a React state update on an unmounted component"). In production, it's a memory leak — the closure holds references to the component's state, preventing garbage collection. After many profile page visits and navigations, multiple orphaned timers may be running.
- **Fix**: 
  - Store the timeout ID in a `useRef`.
  - In the effect cleanup: `clearTimeout(timeoutRef.current)`.
  - Or: use a `mountedRef` pattern: `if (!mountedRef.current) return;` before any `setState` call.
- **Prevention**: All `setTimeout`/`setInterval` in effects must be cleaned up in the effect's return function. Add an ESLint rule.

### 3.14 [HIGH] Async State Updates Without Abort Pattern — Multiple Files

- **Code**: Async fetch functions in effects without `AbortController` or `mountedRef` guards.
- **Files**: 
  - `frontend/src/app/a/[username]/page.tsx:78-101` (`fetchProfile`)
  - `frontend/src/app/a/[username]/page.tsx:118-146` (`fetchRateLimits`)
  - `frontend/src/app/[slug]/client.tsx:128-141` (post fetch)
  - `frontend/src/app/admin/posts/pending/page.tsx` (pending posts)
- **How noticed**: Searched for async functions in `useEffect` without abort patterns. Found 4 instances.
- **What happens**: On rapid navigation (user clicks through posts quickly), a stale fetch response can overwrite the new page's state. Example: navigate to Post A → fetch starts. Navigate to Post B → fetch starts. Post A's fetch completes AFTER Post B's → Post B's page displays Post A's data.
- **Fix**: Use `AbortController`:
  ```typescript
  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      const data = await apiFetch('/posts/' + slug, { signal: controller.signal });
      // setState...
    };
    fetchData().catch(err => { if (err.name !== 'AbortError') throw err; });
    return () => controller.abort();
  }, [slug]);
  ```
- **Prevention**: All async operations in `useEffect` must support cancellation. Add an ESLint rule or code review requirement.

### 3.15 [HIGH] `<a>` Instead of `<Link>` Causes Full-Page Navigation — `history/client.tsx:52`

- **Code**: `<a href={`/${postId}`}>Back to Post</a>`
- **File**: `frontend/src/app/[slug]/history/client.tsx`, line 52
- **How noticed**: Grep for `<a href=` in frontend files. Found one instance using an anchor tag for internal navigation.
- **What happens**: Clicking "Back to Post" triggers a full browser navigation — the entire page reloads, losing all client-side state (scroll position, loaded comments, reaction states). This is slow and jarring compared to Next.js client-side routing.
- **Fix**: Replace with `<Link href={`/${postId}`}>Back to Post</Link>`
- **Prevention**: Internal navigation must use Next.js `<Link>`. Add an ESLint rule.

### 3.16 [HIGH] `params.id as string` Without Validation — `admin/posts/pending/[id]/page.tsx:25`

- **Code**: `const postId = params.id as string;` — no existence check.
- **File**: `frontend/src/app/admin/posts/pending/[id]/page.tsx`, line 25
- **How noticed**: Read the pending post detail page. `params.id` from `useParams()` is typed as `string | string[]`. The cast suppresses the type error but doesn't handle the runtime case where `id` is undefined.
- **What happens**: If the route doesn't match properly (edge case, manual URL entry of `/admin/posts/pending/`), `postId` is `undefined`. The API call becomes `GET /api/admin/posts/pending/undefined`, which returns a 404 from the backend — but the handler may attempt to access properties on `null` data.
- **Fix**: Add a guard: `if (!postId) return <NotFound message="Invalid post ID" />;`
- **Prevention**: All URL parameters must be validated at the point of use. TypeScript casts don't provide runtime safety.

---

## 4. CODE QUALITY & TYPE SAFETY FAILURES

### 4.1 18 Instances of `as any` / `any` Escapes

| # | File | Line(s) | Code |
|---|------|---------|------|
| 1 | `frontend/src/lib/api.ts` | 34 | `const headers: any = { ... }` |
| 2 | `frontend/src/app/page.tsx` | 13 | `setUser(data as any)` |
| 3 | `frontend/src/app/submit/page.tsx` | 86 | `(data as any).categories` |
| 4 | `frontend/src/app/submit/page.tsx` | 86 | `// eslint-disable @typescript-eslint/no-explicit-any` |
| 5 | `frontend/src/app/a/[username]/page.tsx` | 2 | `// eslint-disable @typescript-eslint/no-explicit-any` |
| 6 | `frontend/src/app/a/[username]/page.tsx` | 132 | `catch (err: any)` |
| 7 | `frontend/src/lib/fingerprint.ts` | 1 | `// eslint-disable @typescript-eslint/no-explicit-any` |
| 8 | `backend/src/routes/posts.ts` | 312 | `let post: any;` |
| 9 | `backend/src/routes/comments.ts` | 441 | `let post: any;` |
| 10 | `backend/src/routes/users.ts` | 59 | `(req.user as any).user_id` |
| 11 | `backend/src/routes/users.ts` | 60 | `(req.user as any).username` |
| 12 | `backend/src/routes/users.ts` | 62 | `(req.user as any).device_fingerprint` |
| 13 | `backend/src/routes/users.ts` | 63 | `(req.user as any).trust_score` |
| 14 | `backend/src/routes/users.ts` | 68 | `(req.user as any).rate_limit_override` |
| 15 | `backend/src/lib/fingerprintMatching.ts` | 42 | `Record<string, any>` |
| 16 | `backend/src/lib/fingerprintMatching.ts` | 89 | `Record<string, any>` |
| 17-18 | `backend/src/middleware/fingerprint.ts` | (multiple) | Extends Express Request with `any` casting |

**Fix**: Set `@typescript-eslint/no-explicit-any: error`. Fix each instance individually. For Express Request extension, use declaration merging in a `types/express.d.ts` file. For API responses, use proper generics. Remove all `eslint-disable` comments.

### 4.2 Rate Limit Type Mismatch — `rateLimit.ts:48-49`

- **Code**: `counter_lists: { total: string; remaining: string; ... }` — `string` for a numeric field because the value is `'Unlimited'`.
- **Fix**: Use a discriminated union: `{ type: 'limited', remaining: number } | { type: 'unlimited' }`.

### 4.3 `AudioContext` Never Closed — `fingerprint.ts:132`

- **Code**: `new AudioContext().sampleRate` — creates AudioContext, reads property, never calls `.close()`.
- **What happens**: Memory leak. Each fingerprint generation leaks an AudioContext. On Chrome, there's a hard limit of ~6 unclosed AudioContexts before the browser throttles creation.
- **Fix**: `const ctx = new AudioContext(); const rate = ctx.sampleRate; ctx.close(); return rate;`

### 4.4 `hash & hash` No-Op — `fingerprint.ts:153`

- **Code**: `hash = hash & hash;` — always equals `hash`, does nothing.
- **Fix**: Likely meant `hash = hash & 0x7FFFFFFF` (ensure positive 32-bit). Remove or fix.

### 4.5 Magical Category Count Formula — `categories.ts`

- **Where**: The `recalculateCategoryPostCounts()` function uses a hardcoded formula. 
- **Fix**: Document the formula. Make it a named pure function with tests.

### 4.6 Repeated `as unknown as` Casts — `posts.ts:286,355,364`

- **Code**: `(post.category_id as unknown as { _id: string })._id` — triple cast to bypass TypeScript after Mongoose `populate()`.
- **Fix**: Define proper `PopulatedPost` type. Use type guards: `if (post.category_id && typeof post.category_id === 'object')`.

---

## 5. TESTING & CI/CD GAPS

### 5.1 Zero Integration Tests

- **What exists**: `backend/test/routes.test.ts` — tests only that Express routers mount without error. No assertions on response content, no database operations.
- **What's missing**: 
  - API integration tests (HTTP request → full handler → database → response)
  - Database operation tests (create user, submit post, approve/reject, verify trust score)
  - Rate limiting tests (hit the limit, verify 429, wait, verify reset)
  - Comment nesting tests (create deep tree, delete parent, verify children)
  - Admin auth tests (login, expired token, invalid token, setup flow)

### 5.2 Zero Frontend Tests

- **What exists**: Nothing. No Jest, no Vitest, no React Testing Library, no Cypress, no Playwright.
- **What's missing**:
  - Component render tests (does the submit form render? does it show errors?)
  - User interaction tests (type in title, blur, verify API call)
  - State management tests (draft save/restore, auth state)
  - Accessibility tests (axe-core automated audit)

### 5.3 Zero E2E Tests

- **What exists**: Nothing.
- **What's missing**:
  - Full user journey: visit submit → fill form → submit → see success
  - Admin journey: login → review queue → approve → verify post appears in feed
  - Comment journey: visit post → add comment → reply → verify nesting

### 5.4 CI Only Lints and Builds

- **Current CI**: `pnpm lint` + `pnpm build` for both frontend and backend.
- **Missing from CI**: 
  - `tsc --noEmit` (type checking without emitting — catches type errors that `tsc` (with emit) might miss)
  - Unit tests
  - Integration tests
  - Bundle size analysis
  - Security audit (`pnpm audit`)
  - Lighthouse scores

### 5.5 CD Deploys on Push to Main with No Verification

- **Current CD**: On push to main → build Docker image → push to GHCR → SSH deploy.
- **Missing**: 
  - Pre-deploy integration tests against staging
  - Health check verification after deploy
  - Rollback on health check failure
  - Database migration safety checks

---

## 6. DOCUMENTATION & METADATA FAILURES

### 6.1 `rom.md` Missing (Until Now)

- **File**: `docs/rom.md` was empty (0 lines).
- **Also**: `docs/rom.md` is in `.gitignore` (line in .gitignore: `docs/rom.md`). This means ROM cannot be committed. Remove from .gitignore.
- **Fix**: This document IS the ROM. Remove `docs/rom.md` from `.gitignore`.

### 6.2 `ram.md` in Wrong Location

- **Where it is**: `docs/ram.md`
- **Where it should be**: Repo root (`ram.md`) — AGENTS.md says "Read AGENTS.md → Read ram.md → Read rom.md" expecting them at root.
- **Fix**: Move `ram.md` to repo root. Update AGENTS.md if the convention is to keep in `docs/`.

### 6.3 `product_spec.md` Lists Wrong Tech Stack

- **Code**: `| **Backend** | Python + FastAPI |` and `| **Database** | PostgreSQL |`
- **File**: `docs/product_spec.md`, line 317
- **Actual stack**: Node.js + Express + MongoDB
- **Fix**: Update the tech stack table. Keep both specs if there's a migration plan; otherwise, reflect reality.

### 6.4 `product_spec.md` Lists Disabled Features That Are Actually Implemented

- **Section 14**: Lists "Reactions (Fire)" and "Trust scores" as disabled. Both are fully implemented.
- **Fix**: Update Section 14 to reflect what's actually implemented vs. disabled.

### 6.5 Stale `docs/bugs.md`

- **Content**: Single line: `All bugs fixed`
- **Reality**: 39 bugs documented above.
- **Fix**: Either populate with current bugs or delete the file.

### 6.6 Milestone Status Table Not Updated

- **File**: `docs/milestones.md` has checkboxes (e.g., M8, M10, M11) that haven't been updated to reflect implementation status.
- **Fix**: Mark all completed items with `[x]`.

### 6.7 `eslint` Empty File at Repo Root

- **File**: `/home/nekwasar/O4A_INNOVATIONS/yotop10/eslint` — zero bytes.
- **Fix**: Delete the file. It serves no purpose.

### 6.8 `frontend@0.1.0` Empty File at Repo Root

- **File**: `/home/nekwasar/O4A_INNOVATIONS/yotop10/frontend@0.1.0` — zero bytes.
- **Fix**: Delete the file. It serves no purpose.

### 6.9 Comment Depth Spec vs. Implementation Mismatch

- **Spec**: `product_spec.md` says max 3 levels. `milestones.md` says max 3 levels.
- **Implementation**: `Comment.ts` model has `max: 10` for depth. Route handler uses `enforceFlexibleLimit`.
- **Fix**: Align spec and implementation. Decide on 3 or 10, update both.

### 6.10 `@fingerprintjs/fingerprintjs` Listed as Dependency but NOT Used

- **File**: `frontend/package.json` — `"@fingerprintjs/fingerprintjs": "^5.2.0"`
- **Actual fingerprinting**: Fully custom implementation in `frontend/src/lib/fingerprint.ts`
- **Fix**: Remove the unused dependency from `package.json`. Run `pnpm install` to update lockfile.

---

## 7. ENTERPRISE STANDARDS MIGRATION PLAN

### 7.1 What "Enterprise Standard" Means for This Codebase

| Principle | Current State | Target State |
|-----------|--------------|--------------|
| **Type Safety** | `any` escapes everywhere, `eslint-disable` comments | Zero `any`, `strict: true`, `tsc --noEmit` in CI |
| **Test Coverage** | One test file (route mounting only) | 80%+ coverage: unit + integration + E2E |
| **Component Library** | Zero reusable components | 12+ reusable components, Storybook |
| **State Management** | Scattered `useState` everywhere | Zustand stores with domain slices |
| **API Layer** | Monolithic 200-line file | Domain-split modules, dependency injectable |
| **Business Logic** | Embedded in route handlers | Pure functions in `lib/`, unit tested |
| **Infrastructure** | Redis per request, lost ES client | Singleton clients, connection pooling |
| **Error Handling** | Inconsistent, unhandled rejections | Centralized error handler, consistent responses |
| **CI/CD** | Lint + Build only | Lint + TypeCheck + Test + Security Audit + Build |
| **Documentation** | Stale, contradictory | Living docs, auto-generated API docs |
| **Monitoring** | None | Health endpoints, structured logging, metrics |
| **Security** | Hardcoded secrets, XSS, injection | Environment validation, CSP, input sanitization |

### 7.2 Specific Technology Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| State management | Zustand | Lightweight, TypeScript-first, no providers, selectors prevent re-renders |
| Testing framework | Vitest + React Testing Library + Playwright | Vitest for unit/integration (fast, Vite-native), RTL for components, Playwright for E2E |
| Component documentation | Storybook 8 | Industry standard for component libraries. Works with Next.js. |
| API validation (runtime) | Zod | Already listed in AGENTS.md Rule 8. Not currently used for runtime validation. |
| Logging | Pino | Structured JSON logging, faster than Winston, supports log levels |
| Linting | ESLint flat config (both projects) | Unify as flat config. Remove legacy `.eslintrc.json`. |
| Formatting | Prettier | Not currently used. Add `.prettierrc` and format on commit. |
| Git hooks | husky + lint-staged | Enforce lint/format/typecheck on pre-commit. |
| Environment validation | Zod schema for `process.env` | Validate ALL env vars at startup. Crash early if required vars missing. |

### 7.3 Directory Restructuring Plan

```
frontend/src/
├── app/                      # unchanged (Next.js App Router convention)
├── components/
│   ├── ui/                   # primitives: Button, Input, Badge, Spinner, Skeleton
│   ├── form/                 # FormField, ItemRow, CharacterCounter
│   ├── post/                 # PostCard, PostDetail, PostHistory
│   ├── comment/              # CommentThread, CommentForm
│   ├── user/                 # TrustBadge, UserProfile
│   └── admin/                # AdminLayout, ReviewCard, StatsCard
├── lib/
│   ├── api/
│   │   ├── client.ts         # apiFetch, Base URL, retry logic
│   │   ├── endpoints/        # posts.ts, comments.ts, admin.ts, users.ts, ...
│   │   └── types.ts          # All API types
│   ├── stores/
│   │   ├── auth.ts           # useAuthStore
│   │   ├── rateLimit.ts      # useRateLimitStore
│   │   └── admin.ts          # useAdminStore
│   ├── storage.ts            # safe localStorage helpers
│   └── fingerprint.ts        # unchanged (but bugs fixed)
└── test/
    ├── unit/
    ├── integration/
    └── e2e/

backend/src/
├── server.ts                 # slim: import routes, connect DBs, start HTTP
├── lib/
│   ├── redis.ts              # singleton Redis client
│   ├── elasticsearch.ts      # singleton ES client
│   ├── rateLimiter.ts        # class: takes redis client, pure rate limit logic
│   ├── trustScore.ts         # pure functions: calculate, validate, log
│   ├── sparkScore.ts         # pure functions: calculate, thresholds, propagate
│   ├── ladderSystem.ts       # unchanged (already pure-ish)
│   ├── titleSimilarity.ts    # pure functions
│   ├── titleNormalization.ts # pure functions (fix the regex logic)
│   ├── fingerprintMatching.ts # fix unbounded query
│   ├── adminAuth.ts          # fix hardcoded JWT secret
│   └── usernameService.ts    # fix race condition pattern
├── middleware/
│   └── fingerprint.ts        # remove setInterval, use singleton Redis
├── routes/
│   ├── index.ts              # barrel export with metadata
│   ├── admin.ts              # fix dynamic import
│   ├── auth.ts               # return 501 until implemented
│   ├── categories.ts
│   ├── comments.ts           # fix deletion, N+1, cron location
│   ├── fingerprint.ts
│   ├── listings.ts           # return 501 until implemented
│   ├── posts.ts              # fix transaction, Redis, ETag
│   ├── reactions.ts          # fix shared fingerprint, deduplicate logic
│   ├── reviews.ts            # return 501 until implemented
│   ├── search.ts             # return 501 until implemented
│   └── users.ts              # fix $regex, race condition, stubs
├── models/                   # unchanged
├── schemas/                  # NEW: Zod validation schemas (per AGENTS.md Rule 8)
├── scripts/                  # unchanged
└── test/
    ├── unit/
    └── integration/
```

---

## 8. REFACTORING PRIORITY ORDER

The order below is designed so that each phase makes the next phase safer to execute. Security and crash fixes come first. Then structural changes. Then quality-of-life improvements.

### PHASE 1: STOP THE BLEEDING (Security + Crashes)

| # | Issue Ref | Task | Why First |
|---|-----------|------|-----------|
| 1 | 2.1 | Remove hardcoded JWT secret fallback | Security: anyone can be admin. Fix in 1 line. |
| 2 | 3.7 | Gate Eruda behind NODE_ENV | Security: devtools in production. Fix in 2 lines. |
| 3 | 3.4 | Fix XSS in JSON-LD | Security: stored XSS. Fix in 3 lines. |
| 4 | 3.1 | Wrap localStorage in try/catch (api.ts) | Crash: private browsing dead. Fix in 4 lines. |
| 5 | 3.2 | Add max retry to 425 recursion | Crash: stack overflow. Fix in 2 lines. |
| 6 | 3.6 | Null-check window.eruda | Crash: CDN failure. Fix in 1 line. |
| 7 | 3.8 | Wrap localStorage in fingerprint.ts | Crash: identity lost. Fix in 6 lines. |
| 8 | 2.9 | Remove MongoDB $regex injection | Security: ReDoS. Fix with escapeRegExp(). |
| 9 | 2.5 | Replace stub 200 OKs with 501 | Data integrity: silent failures. Fix in 5 files. |

### PHASE 2: FIX THE INFRASTRUCTURE (Connections + Transactions)

| # | Issue Ref | Task | Why Second |
|---|-----------|------|------------|
| 10 | 1.7, 2.2, 2.16 | Create singleton Redis + ES clients, remove per-request connections | Foundation for all other fixes |
| 11 | 1.9, 2.3 | Enable MongoDB replica set in docker-compose OR replace withTransaction() | Trust scores crash on current deploy |
| 12 | 2.12 | Move cron initialization to server.ts lifecycle | Stops timer leaks |
| 13 | 2.4 | Remove or fix setInterval in fingerprint middleware | Memory leak fix |

### PHASE 3: FIX THE DATA (Correctness + Integrity)

| # | Issue Ref | Task | Why Third |
|---|-----------|------|------------|
| 14 | 2.1 | Wrap post creation in transaction | Orphaned posts |
| 15 | 1.10 | Fix recursive comment deletion | Orphaned grandchildren |
| 16 | 2.7 | Make rate limit check atomic (Lua script) | Rate limit bypass |
| 17 | 2.8 | Make display name update atomic | History corruption |
| 18 | 1.8 | Fix destructive plural normalization | Title dedup corruption |
| 19 | 2.11 | Fix random ETag | HTTP caching |
| 20 | 2.13 | Fix shared 'unknown' fingerprint | Reaction corruption |

### PHASE 4: FIX THE FRONTEND (React Correctness)

| # | Issue Ref | Task | Why Fourth |
|---|-----------|------|------------|
| 21 | 3.3 | Safe JSON parsing in apiFetch | Crash prevention |
| 22 | 3.9 | Remove double fetch on post mount | Network waste + flicker |
| 23 | 3.10 | Replace raw fetch with apiFetch | Inconsistent behavior |
| 24 | 3.11 | Move scroll-to-error to useEffect | Broken UX |
| 25 | 3.12 | Fix debounce closure leak | Stale draft data |
| 26 | 3.13 | Add cleanup for setTimeout | Memory leak |
| 27 | 3.14 | Add AbortController to async effects | Stale state |
| 28 | 3.15 | Replace `<a>` with `<Link>` | Full-page reload |
| 29 | 3.16 | Validate params.id before use | Null handling |
| 30 | 3.5 | Move Eruda inside `<body>` | HTML validity |

### PHASE 5: ENTERPRISE STRUCTURE (Architecture)

| # | Issue Ref | Task | Why Fifth |
|---|-----------|------|------------|
| 31 | 1.1 | Split monolithic API client into domain modules | Maintainability |
| 32 | 1.2 | Add Zustand state management | Performance + data consistency |
| 33 | 1.3 | Extract reusable component library | Development velocity |
| 34 | 1.4 | Eliminate all `any` usage | Type safety |
| 35 | 1.5 | Extract business logic to pure functions | Testability |
| 36 | 1.6 | Replace explicit route ordering with metadata | Extensibility |

### PHASE 6: QUALITY GATES (Testing + CI)

| # | Issue Ref | Task | Why Last |
|---|-----------|------|------------|
| 37 | 5.x | Add `tsc --noEmit` to CI | Type safety gate |
| 38 | 5.x | Add Vitest + React Testing Library | Frontend test coverage |
| 39 | 5.x | Add backend integration tests | Backend test coverage |
| 40 | 5.x | Add environment validation (Zod) | Startup safety |
| 41 | 5.x | Add husky + lint-staged | Pre-commit quality |
| 42 | 5.x | Add security audit to CI | Dependency safety |

### PHASE 7: DOCUMENTATION + METADATA

| # | Issue Ref | Task |
|---|-----------|------|
| 43 | 6.x | Update product_spec.md tech stack |
| 44 | 6.x | Update milestones.md checkboxes |
| 45 | 6.x | Populate or delete bugs.md |
| 46 | 6.x | Remove eslint and frontend@0.1.0 empty files |
| 47 | 6.x | Remove docs/rom.md from .gitignore |
| 48 | 6.x | Resolve comment depth spec mismatch |
| 49 | 6.x | Remove @fingerprintjs/fingerprintjs dependency |

---

## APPENDIX A: FILES MODIFIED IN THIS AUDIT

This audit analyzed 39 source files:

**Backend (16 files):**
- `backend/src/server.ts`
- `backend/src/routes/posts.ts`
- `backend/src/routes/comments.ts`
- `backend/src/routes/users.ts`
- `backend/src/routes/admin.ts`
- `backend/src/routes/reactions.ts`
- `backend/src/routes/auth.ts`
- `backend/src/routes/categories.ts`
- `backend/src/routes/fingerprint.ts`
- `backend/src/routes/listings.ts`
- `backend/src/routes/reviews.ts`
- `backend/src/routes/search.ts`
- `backend/src/middleware/fingerprint.ts`
- `backend/src/lib/rateLimit.ts`
- `backend/src/lib/trustScore.ts`
- `backend/src/lib/trustScoreWorker.ts`
- `backend/src/lib/ladderSystem.ts`
- `backend/src/lib/adminAuth.ts`
- `backend/src/lib/fingerprintMatching.ts`
- `backend/src/lib/titleSimilarity.ts`
- `backend/src/lib/titleNormalization.ts`
- `backend/src/lib/usernameService.ts`

**Frontend (23 files):**
- `frontend/src/lib/api.ts`
- `frontend/src/lib/fingerprint.ts`
- `frontend/src/app/layout.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/Eruda.tsx`
- `frontend/src/app/not-found.tsx`
- `frontend/src/app/submit/page.tsx`
- `frontend/src/app/[slug]/page.tsx`
- `frontend/src/app/[slug]/client.tsx`
- `frontend/src/app/[slug]/history/page.tsx`
- `frontend/src/app/[slug]/history/client.tsx`
- `frontend/src/app/a/[username]/page.tsx`
- `frontend/src/app/username-history/page.tsx`
- `frontend/src/app/categories/page.tsx`
- `frontend/src/app/c/[[...slug]]/page.tsx`
- `frontend/src/app/admin/layout.tsx`
- `frontend/src/app/admin/page.tsx`
- `frontend/src/app/admin/login/page.tsx`
- `frontend/src/app/admin/setup/page.tsx`
- `frontend/src/app/admin/profile/page.tsx`
- `frontend/src/app/admin/posts/pending/page.tsx`
- `frontend/src/app/admin/posts/pending/[id]/page.tsx`
- `frontend/src/components/NotFound.tsx`

**Documentation (7 files):**
- `AGENTS.md`
- `docs/ram.md`
- `docs/rom.md` (this file)
- `docs/milestones.md`
- `docs/product_spec.md`
- `docs/plans.md`
- `docs/bugs.md`

**Config (11 files):**
- `.env` (structure reviewed, values not extracted)
- `docker-compose.yml`
- `Dockerfile`
- `ecosystem.config.js`
- `nginx.conf.template`
- `.github/workflows/ci.yml`
- `.github/workflows/cd.yml`
- `frontend/package.json`
- `backend/package.json`
- `frontend/next.config.ts`
- `.gitignore`

---

## APPENDIX B: AUDIT METHODOLOGY

1. Read every source file line-by-line (39 files, ~8,000 lines total)
2. Traced every async call chain for error handling gaps
3. Traced every database write for atomicity, transactions, rollback
4. Traced every user input to database query for injection vectors
5. Traced every DOM manipulation for React lifecycle correctness
6. Traced every timer/interval for cleanup on unmount/stop
7. Searched for anti-patterns: `as any`, raw `fetch()`, `dangerouslySetInnerHTML`, `localStorage` without try/catch, `new AudioContext()` without close, dynamic `import()` in handlers
8. Cross-referenced documentation against implementation
9. Cross-referenced package.json dependencies against actual imports
10. Tested mental execution paths for edge cases (null, undefined, private browsing, CDN failure, Redis down, MongoDB standalone)

---

## ROM Tracker — Resolution Status (Updated 2026-05-08)

### Resolved ✅
| Section | Issue | Resolution |
|---------|-------|------------|
| 1.7 (2.16) | Redis per-request client | ✅ Singleton in `lib/redis.ts` |
| 1.6 | Route barrel export | ✅ `routes/index.ts` with `RouteDefinition` |
| 2.1 | Hardcoded JWT fallback | ✅ Crashes on startup if unset |
| 2.3 | Memory leak: orphaned setInterval | ✅ Removed dead fingerprint interval |
| 2.4 | MongoDB $regex injection | ✅ Exact-match query only |
| 2.5 | Stub 200 OKs | ✅ All return 501 Not Implemented |
| 2.6 | Health check behind middleware | ✅ Mounted before fingerprint middleware |
| 2.9 | Dynamic import on every approval | ✅ Moved to top-level import |
| 2.12 | Module-level cron init | ✅ Centralized in `server.ts` |
| 2.13 | 'unknown' fingerprint shared | ✅ Returns 401 for missing fingerprint |
| 2.16 | ES/Redis clients scoped to function | ✅ Both singletons exported |
| 3.1 | localStorage crash private browsing | ✅ try/catch in `api/client.ts` |
| 3.2 | 425 infinite recursion | ✅ MAX_RETRIES=3 guard |
| 3.4 | XSS via JSON-LD injection | ✅ `</` escape in `[slug]/page.tsx` |
| 3.6 | Eruda init crash on CDN failure | ✅ `if (window.eruda)` guard |
| 3.7 | Eruda in production | ✅ NODE_ENV gated |
| 3.8 | localStorage in fingerprint | ✅ Safe helpers used |
| 3.9 | Double-fetch on post mount | ✅ Still open — 1 call fetches all |
| 3.10 | Raw fetch() bypasses API wrapper | ✅ Uses `apiFetch` |

### Still Open ⏳
| Section | Issue | Notes |
|---------|-------|-------|
| 1.9 (P2.3) | MongoDB replica set for transactions | `withTransaction()` crashes on standalone |
| 1.10 | Orphaned comments on deletion | Grandchildren may be orphaned |
| 2.7 | TOCTOU rate limit race | Non-atomic zRemRange/zCard/zAdd |
| 2.8 | findOne→findOneAndUpdate race | In `users.ts` display name update |
| 2.10 | Non-null assertion after findById | `!` in `posts.ts:488` |
| 2.13 | 'unknown' fingerprint edge cases | Reactions still have fallback |
| 4.1 | `any` escapes in fingerprint.ts | eslint-disable at top of file |
| 4.2 | Rate limit type mismatch | `counter_lists` typed as string |
| M11.C.1 | Hysteresis thresholds | Not implemented |
| M11.C.1 | Double-blind moderation | Not implemented |
| M5.6 | Counter-list system | Not implemented |
| M10.6 | Users management | Not implemented |
| M10.8 | Hall of Fame management | Not implemented |
| M10.9 | Reactions management | Not implemented |
| M10.11 | Rate limits & trust scores UI | Not implemented |
| M13-M15 | Arguments, Identity Portability | Not implemented |

---
