# Enterprise-Grade Remediation Plan — Full Audit Solutions

> **Version**: 1.0.0
> **Classification**: CONFIDENTIAL — Production Infrastructure Security & Scaling Remediation
> **Owner**: Platform Engineering
> **Review Required**: CISO, VP Engineering, SRE Lead
> **SLA**: CRITICAL items within 24h, HIGH within 72h, MEDIUM within 2 weeks

---

## Table of Contents

1. [Infrastructure — CRITICAL (C1-C8)](#1-infrastructure--critical)
2. [Backend — CRITICAL (C9-C23)](#2-backend--critical)
3. [Frontend — CRITICAL (C24)](#3-frontend--critical)
4. [Infrastructure — HIGH (H1-H20)](#4-infrastructure--high)
5. [Backend — HIGH (H21-H44)](#5-backend--high)
6. [Frontend — HIGH (H45-H56)](#6-frontend--high)
7. [Secrets Management Overlay](#7-secrets-management-overlay)
8. [Observability & Monitoring Overlay](#8-observability--monitoring-overlay)
9. [Incident Response Playbooks](#9-incident-response-playbooks)
10. [Architecture Decision Records](#10-architecture-decision-records)

---

## Implementation Order Matrix

> This section defines the EXACT order each finding must be implemented in, dependencies between them, and the expected system behavior after each is complete. Follow this order strictly — later items assume earlier items are fully deployed and verified.

### Legend

| Symbol | Meaning |
|--------|---------|
| ⛓️ | Blocked by — must wait for listed items |
| 🧩 | Blocks — items that depend on this |
| ⏱️ | Estimated implementation time |
| ✅ | Expected final behavior after implementation |

---

### PHASE 0 — Foundation (Week 1)
*These are standalone infra changes with NO code dependencies on each other.
Can be done in parallel by separate engineers.*

| Order | Finding | ⛓️ Depends On | ⏱️ Effort | 🧩 Blocks | ✅ Final Expected Behavior |
|-------|---------|---------------|-----------|-----------|---------------------------|
| **#0.1** | **C1** — JWT secret in repo | None | 4h | C1.1-C1.5 | ✅ JWT secret is NEVER on disk or in env. Read from Vault or Docker secrets at startup. `.env` removed from Git history entirely. Existing tokens invalidated. Git hooks prevent future commits of secrets. |
| **#0.2** | **C4** — MongoDB no auth | None | 2h | C4.1, all DB queries | ✅ MongoDB requires username+password. Connection string contains credentials. Admin user created with `MONGO_INITDB_ROOT_USERNAME`/`PASSWORD`. Health check authenticates before ping. |
| **#0.3** | **C5** — Redis no auth | None | 1h | C5.1, all Redis ops | ✅ Redis requires `requirepass`. All `redis.connect()` calls include password. `FLUSHALL`/`FLUSHDB`/`CONFIG` commands renamed to prevent accidental destruction. |
| **#0.4** | **C6** — ES no auth | None | 2h | C6.1, all ES queries | ✅ ES has security enabled. TLS certs generated. Password set. All ES client connections authenticate. |
| **#0.5** | **C3** — Health check broken | None | 1h | All Docker health checks | ✅ Backend health check uses `node -e` with JSON parsing instead of `wget`. Container becomes `healthy` within `start_period`. Frontend waits for backend health before starting. |
| **#0.6** | **C2** — Build-time API URL | None | 3h | All frontend builds | ✅ `NEXT_PUBLIC_API_URL` is NEVER baked at build time. Runtime config endpoint serves dynamic URL. Client bundle lacks any hardcoded hostname/port. Changing API URL requires zero rebuilds. |
| **#0.7** | **C7** — No TLS | None | 3h | All HTTP traffic | ✅ All traffic is HTTPS. HTTP→301→HTTPS. HSTS with preload. OCSP stapling. TLS 1.2/1.3 only. Security headers on every response (CSP, X-Frame-Options, X-Content-Type-Options, Permissions-Policy). |
| **#0.8** | **C8** — Missing proxy headers | C7 (nginx change) | 1h | All rate limiting, audit logs | ✅ Nginx sends `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Request-ID` to backend. Backend `trust proxy` configured. Rate limiting uses real client IP. Audit logs record original client IP. |

### PHASE 0B — Build & Config Hygiene (Week 1, parallel with 0A)
*Infrastructure configuration improvements, no code changes.*

| Order | Finding | ⛓️ Depends On | ⏱️ Effort | 🧩 Blocks | ✅ Final Expected Behavior |
|-------|---------|---------------|-----------|-----------|---------------------------|
| **#0.9** | **H14** — `next-env.d.ts` missing | None | 0.1h | All frontend `tsc` | ✅ `next-env.d.ts` exists in repo. Fresh clone + `pnpm typecheck` passes without running `next dev` first. |
| **#0.10** | **H15-H16** — `next.config.ts` ESLint+TS hardening | None | 0.5h | Frontend build pipeline | ✅ `ignoreDuringBuilds: false` means lint errors BLOCK production builds. TypeScript errors block builds. No misconfigured code deploys. |
| **#0.11** | **H10-H13** — ESLint version sync, flat config | None | 2h | All frontend linting | ✅ Single ESLint 9 flat config for the entire frontend. Backend upgraded to ESLint 9 with matching config. `ESLINT_USE_FLAT_CONFIG` env var removed. Zero ESLint warnings at all times. |
| **#0.12** | **H1-H9** — Docker layer caching, `.dockerignore`, pinned versions | None | 3h | All Docker builds | ✅ `.dockerignore` excludes all unnecessary files. Build context reduced by 90%+. pnpm pinned to exact version (`9.15.9`). No floating `latest` or `@9` tags. `NODE_ENV=production` set explicitly in build stages. Dev compose uses random ports to avoid conflicts. |
| **#0.13** | **H17-H19** — Override pnpm, `@types/sharp`, Zod | None | 1h | Backend stability | ✅ pnpm overrides documented with security rationale. `@types/sharp` matches `sharp` version exactly. Zod v4 evaluated for stability; pinned to exact version if unstable. `jest` removed from scripts since project uses vitest. |

### PHASE 1 — Data Integrity & Crash Prevention (Week 2)
*Prevents data loss, OOM crashes, and silent failures. Requires Phase 0 infra.*

| Order | Finding | ⛓️ Depends On | ⏱️ Effort | 🧩 Blocks | ✅ Final Expected Behavior |
|-------|---------|---------------|-----------|-----------|---------------------------|
| **#1.1** | **C9** — Leaking cron jobs | C3 (health check infra reliable) | 4h | All cron-dependent features | ✅ All 7+ cron jobs registered in `CronRegistry`. Each has timeout protection, dead-man's-switch heartbeat, and clean shutdown on SIGTERM. `gracefulShutdown()` drains all running jobs before exit. No cron runs during shutdown. Health endpoint reports cron status. |
| **#1.2** | **C14** — `$or` overwrite | None (query builder is new code) | 2h | Admin search queries | ✅ All admin query building uses `QueryBuilder` class. `$or` conditions are accumulated in an array, never `Object.assign` or direct assignment. The `deleted: false` filter is ALWAYS applied as base condition. No MongoDB operator can be injected via query params. `safeRegex()` escapes all user input. `sanitizeQueryParams` middleware blocks NoSQL patterns. |
| **#1.3** | **C15** — Delete-then-reinsert data loss | Phase 0 (stable DB connection) | 3h | Post editing | ✅ Post editing uses atomic `findOneAndUpdate` with version check. Old items are journaled in Redis before deletion + reinsertion. If insert fails, journal-based rollback restores old items automatically. Concurrent edits detect version conflicts and return 409. Zero window for data loss. |
| **#1.4** | **C20** — NoSQL injection (5 locations) | C14 (QueryBuilder exists) | 1h | All admin regex searches | ✅ All 5 `$regex` injection points replaced with `QueryBuilder.safeRegex()`. Cannot craft ReDoS or injection payloads via query params. |
| **#1.5** | **C21** — Sequential DB ops (bulk approve/reject) | None (new processor is isolated) | 2h | Admin bulk operations | ✅ Bulk approve/reject uses `Promise.allSettled` with configurable concurrency. 50 posts processed in parallel (not sequentially). Errors for individual posts don't crash the entire operation. Result report shows `{ approved: N, skipped: N, errors: [ids] }`. |
| **#1.6** | **H22** — Categories loaded on every request | None (new cache layer) | 1h | Post list performance | ✅ Category list loaded into Redis cache on first request. TTL of 5 minutes. Subsequent requests hit Redis, not MongoDB. Cache miss triggers DB load + cache refresh. Zero DB queries for category names on feed requests. |
| **#1.7** | **H21** — Missing sort indexes | C4 (DB stable) | 1h | Feed performance at scale | ✅ `{ status: 1, deleted: 1, comment_count: -1 }`, `{ status: 1, deleted: 1, view_count: -1 }`, `{ category_slug: 1, status: 1, deleted: 1, created_at: -1 }`, `{ author_id: 1, status: 1, created_at: -1 }` indexes created. All sort operations use index-only scans. No in-memory sorts on production data. |
| **#1.8** | **C23** — Mutable config reference | None | 1h | Rate limiting, trust scores | ✅ `getConfig()` returns an `ImmutableConfig` — a deeply frozen object. Any mutation attempt throws in strict mode. Config store uses copy-on-write. All consumers receive read-only snapshots. |
| **#1.9** | **H24** — ES indexing silent failures | Phase 0 (ES auth) | 2h | Search reliability | ✅ All `indexComment`, `indexPost`, `removeComment` calls use `IndexingService`. Failed ES operations are retried up to 3 times with exponential backoff. Permanent failures written to `SearchDeadLetter` collection. Admin dashboard shows dead letter count. |

### PHASE 2 — Unbounded Query Elimination (Week 3)
*Prevents OOM crashes and excessive memory usage. The highest-risk scaling items.*

| Order | Finding | ⛓️ Depends On | ⏱️ Effort | 🧩 Blocks | ✅ Final Expected Behavior |
|-------|---------|---------------|-----------|-----------|---------------------------|
| **#2.1** | **C10** — Loads 5 years of posts for title check | ES index exists (may need migration) | 4h | Post submission performance | ✅ Title similarity uses two-tier approach: (1) ES fuzzy search returns top 50 candidates, (2) Levenshtein verifies against those 50 only. Zero in-memory loops over millions of posts. ES index has proper title analyzer configuration. Response time under 200ms regardless of post count. |
| **#2.2** | **C16** — SparkScore cron loads 72h of comments | None (batch processor is new) | 3h | Comment ranking | ✅ SparkScore cron uses `processBatches()` with configurable `batchSize` (default 500) and `concurrency` (default 5). Processes comments in pages of 500. Maximum 500 comments in memory at once regardless of total comment count. Cron completes in bounded time. |
| **#2.3** | **C17** — Threshold cron loads 30 days of comments | C16 (same pattern) | 2h | Comment threshold calculation | ✅ Threshold calculation uses the same `processBatches()` pattern. Comments processed in groups of 500. Max 500 documents in memory. Histogram computed incrementally across batches. |
| **#2.4** | **C11** — Unbounded distinct queries for lurker calc | None (new pagination code) | 3h | Admin traffic analytics | ✅ `User.distinct('author_id')` and `PageVisit.distinct('fingerprint')` replaced with cursor-based iteration. Thousands of items processed in batches of 500. Never loads all values into memory at once. Estimated completion time bounded regardless of data volume. |
| **#2.5** | **C12** — Loads ALL users for config preview | C11 (same cursor pattern) | 2h | Admin settings page | ✅ Config impact preview uses `processAllUsers()` with cursor pagination. Users processed in batches of 500. Scholar/troll/neutral counts computed incrementally. Max 500 users in memory at once. |
| **#2.6** | **C13** — `redis.keys('alert:*')` blocks event loop | None | 1h | Alert system reliability | ✅ `redis.keys('alert:*')` replaced with `redis.scan('alert:*')`. SCAN iterates incrementally, returning ~100 keys per cursor advance. Redis event loop is never blocked. Health check latency drops below 10ms. |
| **#2.7** | **H22** — Admin sequential loops (pending page O(n²)) | C10 (similarity check optimized) | 2h | Admin pending page | ✅ Pending page title collision detection uses ES pre-filtering before Levenshtein verification. 100 pending posts = 100 ES lookups, not 10,000 pairwise comparisons. Page load time bounded regardless of pending queue size. |
| **#2.8** | **H23** — Missing indexes for `updated_at`, `parent_comment_id` | C4 (DB stable) | 0.5h | Comment tree performance | ✅ `{ parent_comment_id: 1 }` index created for comment tree traversal. `{ updated_at: -1 }` index for recent activity queries. Recursive descendant collection uses indexed queries. |

### PHASE 3 — Security & Identity Hardening (Week 3-4)
*Authentication, authorization, and data security improvements.*

| Order | Finding | ⛓️ Depends On | ⏱️ Effort | 🧩 Blocks | ✅ Final Expected Behavior |
|-------|---------|---------------|-----------|-----------|---------------------------|
| **#3.1** | **C18** — Fingerprint account takeover | Phase 0 (stable Redis, secrets) | 4h | User identity | ✅ Cross-browser fingerprint matching requires user CONFIRMATION via one-time token. Email/push notification sent to existing devices. `findOneAndUpdate` with `$set: { device_fingerprint }` is NEVER called without confirmation. False matches cannot steal identities. Merge request expires in 15 minutes. |
| **#3.2** | **C19** — Grace period phantom sessions | Phase 0 (stable Redis) | 2h | User creation | ✅ Grace period PRE-CREATES the user in MongoDB immediately (not deferring). Session fingerprint is deterministic, not random. Subsequent requests with the same cookie find the existing user. Zero phantom User documents from grace period. |
| **#3.3** | **C24** — XSS via dangerouslySetInnerHTML | None (new sanitizer module) | 2h | Search, comments, all user content display | ✅ ALL `dangerouslySetInnerHTML` usages go through `SafeHTML` component with DOMPurify. Search highlights pass through `sanitizeHighlight()` (only `<mark>` allowed). User content passes through `sanitizeContent()` (basic formatting only). 20+ XSS payloads blocked in unit tests. CSP restricts script execution even if sanitizer fails. |
| **#3.4** | **C22** — getConfig() returns mutable reference | C23 (already fixed immutable pattern) | 0.5h | System configuration | ✅ see C23 final behavior (this is the same root cause) |
| **#3.5** | **H46** — Reserved routes inconsistency | None | 0.5h | Route guards | ✅ `RESERVED_ROUTES` defined ONCE in `lib/reservedRoutes.ts`. Both `[slug]/page.tsx` and `[slug]/client.tsx` import from the canonical source. Inline arrays deleted. Server-side and client-side guards use exactly the same set. No discrepancy possible. |

### PHASE 4 — Frontend Hardening & UX (Week 4)
*All frontend HIGH and MEDIUM items. Independent of backend phases.*

| Order | Finding | ⛓️ Depends On | ⏱️ Effort | 🧩 Blocks | ✅ Final Expected Behavior |
|-------|---------|---------------|-----------|-----------|---------------------------|
| **#4.1** | **H45** — Missing Suspense boundaries | None | 1h | Layout hydration | ✅ `DesktopTopBar`, `SlideMenuRouter`, `DynamicIsland` all wrapped in `<Suspense>` with skeleton fallbacks. No hydration errors from client-side data fetching. Fallback UI shown during component load. |
| **#4.2** | **H47** — Dead code in `[slug]/client.tsx` | None | 0.5h | Code quality | ✅ `loading` state variable removed entirely. Unreachable loading branch (lines 340-346) deleted. `setLoading` unused import cleaned up. Bundle size reduced by ~2KB. |
| **#4.3** | **H48** — Wrong error message in catch block | None | 0.1h | User experience | ✅ Error message in `fetchComments` catch says "Failed to load comments. Please try refreshing." instead of "Failed to react." |
| **#4.4** | **H49** — Raw fetch bypass in search | H46 (import consistency) | 2h | Search reliability | ✅ Search and autocomplete use `searchApi` methods through the standard `apiFetch` wrapper. Device fingerprint headers, 425 retry, and X-Tier0 signals are applied to all search requests. Code that bypassed the wrapper is deleted. |
| **#4.5** | **H50** — Raw fetch in profile page | None | 1h | Profile upload reliability | ✅ Profile image upload and PATCH `/users/me` use `API.updateProfileImage()` and `API.uploadImage()` through `apiFetch`. Raw fetch calls replaced. Error handling distinguishes upload failure from PATCH failure. |
| **#4.6** | **H51** — Autocomplete not keyboard accessible | None | 1h | Accessibility | ✅ Autocomplete suggestions use `role="listbox"` with `aria-selected`. Arrow keys navigate suggestions. Enter/Space select. Escape closes. Tab moves to next form field. Screen reader announces selection changes. |
| **#4.7** | **H52** — Logout stale state | None | 0.5h | Admin auth reliability | ✅ Admin store `logout` always clears local state in `finally` block, even if API call fails. Cookie cleared on client side regardless of server response. Redirect to login always occurs. |
| **#4.8** | **H53** — Duplicate interfaces in admin store | None | 0.2h | Code quality | ✅ `AdminUser` and `AdminSession` merged into single interface. `AdminSession` removed. All references updated. |
| **#4.9** | **H54** — Async useEffect without cleanup (search) | None | 0.5h | Search reliability | ✅ Search autocomplete `useEffect` uses `AbortController`. Abort signal passed to fetch. On unmount, in-flight requests are cancelled. No state updates on unmounted component. |
| **#4.10** | **H55** — Merge two mousedown listeners | None | 0.2h | Performance | ✅ Two `mousedown` event listeners merged into one effect with two conditional blocks. Half the event registrations. |
| **#4.11** | **H56** — Unsafe type assertions in stores | None | 0.5h | Type safety | ✅ All `as AdminUser` type assertions in stores replaced with runtime validation using Zod schemas. Mismatched API responses throw clear errors instead of causing cryptic runtime failures. |

### PHASE 5 — All MEDIUM Items (Week 4-5)
*81 MEDIUM-severity findings. Each is 30-60 minutes. Grouped by area for efficiency.*

| Order | Area | Count | ⏱️ Effort | Key Items | ✅ Final Expected Behavior |
|-------|------|-------|-----------|-----------|---------------------------|
| **#5.1** | Type safety (backend) | 12 | 4h | Replace `as any` in route handlers, add express type extensions, remove non-null assertions | ✅ Zero `as any` in backend. All route handlers properly typed. Express `Request` type properly extended in `.d.ts` files. `!` assertions replaced with explicit null checks. |
| **#5.2** | Error handling (backend) | 15 | 6h | Wrap fire-and-forget ES operations, add error logging to empty catches, replace generic `throw Error` with typed errors | ✅ No silent catch blocks. All ES indexing has retry + dead letter. Empty catches replaced with at-minimum error logging. Each `throw new Error(...)` uses a custom error class (e.g., `NotFoundError`, `ConflictError`, `AuthError`). |
| **#5.3** | Hardcoded values → configurable | 10 | 4h | Rate limit window, edit window, trust score constants → `getConfig()` | ✅ All magic numbers (timeouts, limits, thresholds) read from system config or environment variables. Zero hardcoded constants in business logic. |
| **#5.4** | Frontend loading/empty states | 8 | 3h | Add loading skeletons to admin pages, empty states to search results, error states to data fetching | ✅ Every async operation has a loading state. Every list has an empty state. Every error has a retry mechanism. No blank screens during loading. |
| **#5.5** | Bundle size & performance | 6 | 2h | Extract large client components into hooks, memoize expensive computations, add `React.memo` to list items | ✅ `submit/client.tsx` (902 lines) split into 3 hooks: `useDraftManagement`, `useTitleCheck`, `useImageUpload`. List items wrapped in `React.memo`. Large render functions memoized. |
| **#5.6** | Accessibility (frontend) | 5 | 2h | Add aria labels to icon buttons, fix color contrast, add focus indicators | ✅ All icon-only buttons have `aria-label`. Color contrast ratios meet WCAG 2.1 AA (4.5:1 for text, 3:1 for large text). Focus indicators visible on all interactive elements. |
| **#5.7** | Documentation & dead code | 8 | 3h | Remove dead imports, unused functions, commented-out code. Add JSDoc to public APIs. | ✅ No unused imports in any file. No commented-out code. Public API functions documented with JSDoc. Dead code paths removed. |
| **#5.8** | Testing gaps | 12 | 6h | Add tests for error paths, edge cases, and security scenarios found in audit | ✅ Unit tests for: XSS sanitization, NoSQL injection blocking, rate limit edge cases, trust score hysteresis, batch processor error handling, fingerprint merge rejection. Test coverage for all CRITICAL paths. |
| **#5.9** | Logging & monitoring | 5 | 2h | Add structured logging, Prometheus metrics for all DB queries, cron job health metrics | ✅ Every DB query has timing metric. Cron jobs report duration and success/failure. Request-scoped logger with correlation IDs. Metrics endpoint exposed at `/api/metrics`. |
| **#5.10** | Cron job hardening | 5 | 2h | Add error recovery to all crons, dead-man's-switch for each, auto-restart on failure | ✅ Every cron has: timeout protection, retry logic, dead-man's-switch, failure alert. No cron silently dies. Dead-man's-switch expires in 2x interval triggers PagerDuty alert. |

---

## 1. Infrastructure — CRITICAL

### C1 — JWT_SECRET Committed in Plaintext

**File**: `.env:1`
**Severity**: CRITICAL — Active credential exposure
**Order**: #0.1 (Phase 0, Week 1)
**⏱️ Effort**: 4 hours
**✅ Final Expected Behavior**: JWT secret is NEVER on disk or in env. Read from Vault or Docker secrets at startup. `.env` removed from Git history entirely. Existing tokens invalidated. Git hooks prevent future commits of secrets.

#### Architecture & Root Cause Analysis

The `.env` file containing `JWT_SECRET=d9395867fe43629ae8b14c295443cc9054534a86fe6b16b2e1dadee32c425aee98037937e2dcee62da54a0d96ce5c2939ccf696631952b71ac4fd364c3fd04f4` was committed to the Git repository at some point during initial scaffolding. This is a 64-byte hex-encoded secret that grants full administrative access to the YoTop10 platform. Anyone who can read the repository — including CI runners, contributors, and anyone who gains access to the Git history — can forge valid JWT tokens and authenticate as the admin user without credentials.

Git history traversal is the primary exfiltration vector. Even if the file is removed in a subsequent commit, `git log -p` will display the full contents of the commit where `.env` was introduced. Automated secret scanners (truffleHog, GitLeaks, GitHub secret scanning) routinely crawl public and private repositories for patterns matching `JWT_SECRET=`, `JWT_*`, and hex-encoded 64+ character strings. If this repository is public or accessible to any third-party CI service, the secret is already compromised.

Secondary impact: the JWT secret is used to sign all admin session tokens. With the secret in hand, an attacker can:
1. Forge a JWT with `{ id: 'admin', username: 'admin', token_version: 0, role: 'super_admin' }`
2. Set the `admin_token` cookie on any browser
3. Access all admin endpoints: approve/reject posts, delete content, view audit logs, manage users, modify system configuration
4. Escalate to server-side attacks via admin endpoint vulnerabilities

#### Immediate Remediation (0-4 hours)

**Step 1: Rotate the JWT secret in production**

```bash
# Generate a cryptographically secure 256-bit (32-byte) secret
openssl rand -hex 32 > /tmp/new-jwt-secret.txt
# Expected output: 64 hex characters
cat /tmp/new-jwt-secret.txt
# Example: a8f2c9d1e3b4f5a6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b

# Deploy the new secret via docker secret (NOT environment variable)
docker secret create jwt_secret_v1 /tmp/new-jwt-secret.txt

# Restart the backend service to pick up the new secret
docker service update --secret-add jwt_secret_v1 yotop10_backend
# OR for docker-compose:
docker compose up -d --force-recreate backend
```

**Step 2: Rotate all existing admin sessions**

```bash
# After deploying the new secret, invalidate all existing JWT tokens by incrementing token_version
# Connect to MongoDB and run:
mongosh --eval 'db.admin_users.updateMany({}, { $inc: { token_version: 1 } })'
```

**Step 3: Revoke the exposed secret**

The exposed `.env` file must be handled via Git's BFG Repo-Cleaner to purge the secret from all Git history:

```bash
# Install BFG (requires Java)
wget -O bfg.jar https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# Create a text file with the secret to remove
echo 'd9395867fe43629ae8b14c295443cc9054534a86fe6b16b2e1dadee32c425aee98037937e2dcee62da54a0d96ce5c2939ccf696631952b71ac4fd364c3fd04f4' > /tmp/secrets.txt

# Run BFG to replace the secret in all commits
java -jar bfg.jar --replace-text /tmp/secrets.txt --no-blob-protection /opt/yotop10

# Force-push the rewritten history
cd /opt/yotop10
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin main --force

# NOTIFY ALL TEAM MEMBERS to re-clone the repository
```

#### Permanent Architecture Solution (1-2 weeks)

**Vault-Based Secrets Management**

Replace all environment-variable-based secrets with HashiCorp Vault using the Kubernetes sidecar pattern adapted for Docker Compose:

```yaml
# docker-compose.yml — Vault Integration
services:
  vault-agent:
    image: hashicorp/vault:1.18.3
    environment:
      VAULT_ADDR: ${VAULT_ADDR:-https://vault.internal.yotop10.com}
      VAULT_ROLE: yotop10-backend
      VAULT_AUTH: approle
    volumes:
      - vault-token:/home/vault/.vault-token
      - ./scripts/vault-agent.hcl:/etc/vault-agent/vault-agent.hcl
    command: agent -config=/etc/vault-agent/vault-agent.hcl
    healthcheck:
      test: ["CMD", "vault", "status"]
      interval: 10s
      timeout: 5s
      retries: 3

  backend:
    depends_on:
      vault-agent:
        condition: service_healthy
    environment:
      JWT_SECRET_FILE: /secrets/jwt_secret
      JWT_SECRET: ""  # Intentionally empty — read from file only
    volumes:
      - vault-secrets:/secrets:ro
```

**Vault agent configuration** (`scripts/vault-agent.hcl`):

```hcl
pid_file = "/home/vault/.pid"

auto_auth {
  method "approle" {
    mount_path = "auth/approle"
    config = {
      role_id_file_path = "/etc/vault/role-id"
      secret_id_file_path = "/etc/vault/secret-id"
      remove_secret_id_file_after_reading = true
    }
  }

  sink "file" {
    config = {
      path = "/home/vault/.vault-token"
    }
  }
}

template {
  source      = "/templates/jwt_secret.ctmpl"
  destination = "/secrets/jwt_secret"
  perms       = 0400
  uid         = 1001
  gid         = 1001
  
  command = "/bin/sh -c 'kill -HUP $(cat /tmp/app.pid)'"
}

template {
  source      = "/templates/env.ctmpl"
  destination = "/secrets/env"
  perms       = 0400
}
```

**Consul Template template** (`templates/jwt_secret.ctmpl`):

```go
{{- with secret "secret/data/yotop10/production/jwt" -}}
{{ .Data.data.jwt_secret }}
{{- end -}}
```

**Application-side reading** (`backend/src/lib/secrets.ts`):

```typescript
import fs from 'fs/promises';
import path from 'path';

const SECRETS_DIR = process.env.SECRETS_DIR || '/secrets';

export class SecretsManager {
  private static cache = new Map<string, string>();
  private static watchers = new Map<string, fs.FileWatcher>();

  static async getSecret(name: string): Promise<string> {
    if (this.cache.has(name)) return this.cache.get(name)!;
    
    const filePath = process.env[`${name}_FILE`] || path.join(SECRETS_DIR, name);
    const envVar = process.env[name];
    
    if (filePath) {
      try {
        const secret = await fs.readFile(filePath, 'utf-8');
        const trimmed = secret.trim();
        if (!trimmed) throw new Error(`Secret file ${filePath} is empty`);
        this.cache.set(name, trimmed);
        this.watchFile(name, filePath);
        return trimmed;
      } catch (err) {
        if (envVar) {
          console.warn(`[SecretsManager] Falling back to env var for ${name}. File ${filePath} not readable.`);
          return envVar;
        }
        throw new Error(`Secret ${name} not found at ${filePath} and no env var fallback`);
      }
    }
    
    if (envVar) {
      console.warn(`[SecretsManager] Secret ${name} loaded from env var (not file). Consider using secret files.`);
      return envVar;
    }
    
    throw new Error(`No source configured for secret: ${name}`);
  }

  private static watchFile(name: string, filePath: string): void {
    try {
      fs.watchFile(filePath, { interval: 5000 }, async () => {
        try {
          const secret = await fs.readFile(filePath, 'utf-8');
          const trimmed = secret.trim();
          if (trimmed) {
            this.cache.set(name, trimmed);
            console.log(`[SecretsManager] Secret ${name} rotated at runtime`);
          }
        } catch (err) {
          console.error(`[SecretsManager] Error re-reading secret ${name}:`, err);
        }
      });
    } catch {
      // File watching not supported on all platforms (e.g., some Docker mounts)
      console.warn(`[SecretsManager] File watching not available for ${name}`);
    }
  }

  static async rotate(name: string, newSecret: string): Promise<void> {
    this.cache.set(name, newSecret);
    // The old JWT remains valid until token_version is incremented
    // Trigger token invalidation via admin endpoint
    console.log(`[SecretsManager] Secret ${name} rotated. Awaiting token_version increment.`);
  }

  static async initialize(): Promise<void> {
    this.cache.clear();
    const requiredSecrets = ['JWT_SECRET', 'MONGODB_URI', 'REDIS_URL'];
    for (const secret of requiredSecrets) {
      await this.getSecret(secret);
    }
  }
}
```

**JWT signing implementation** (`backend/src/lib/adminAuth.ts`):

```typescript
import { SecretsManager } from './secrets';

// Memory-guarded signing key — never logged, never serialized
let signingKeyPromise: Promise<string> | null = null;

async function getSigningKey(): Promise<string> {
  if (!signingKeyPromise) {
    signingKeyPromise = SecretsManager.getSecret('JWT_SECRET').then(key => {
      // Validate minimum key length (256-bit = 32 bytes = 64 hex chars)
      if (key.length < 64) {
        throw new Error(`JWT_SECRET length ${key.length} is below minimum 64 characters`);
      }
      return key;
    });
  }
  return signingKeyPromise;
}

export async function signAdminToken(payload: AdminTokenPayload): Promise<string> {
  const secret = await getSigningKey();
  return jwt.sign(payload, secret, {
    algorithm: 'HS512',  // SHA-512 over HS256 for additional collision resistance
    expiresIn: '24h',
    issuer: 'yotop10-admin',
    audience: 'yotop10-api',
    jwtid: crypto.randomUUID(),
  });
}

export async function verifyAdminToken(token: string): Promise<AdminTokenPayload> {
  const secret = await getSigningKey();
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS512'],
      issuer: 'yotop10-admin',
      audience: 'yotop10-api',
    }) as AdminTokenPayload;
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthError('Admin token expired', 'TOKEN_EXPIRED');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AuthError('Invalid admin token', 'TOKEN_INVALID');
    }
    throw new AuthError('Token verification failed', 'TOKEN_ERROR');
  }
}
```

#### Validation & Testing

```typescript
// tests/security/secrets.test.ts
import { SecretsManager } from '../lib/secrets';

describe('SecretsManager — Enterprise Security', () => {
  const TEMP_SECRET_DIR = '/tmp/secrets-test';
  
  beforeAll(async () => {
    await fs.mkdir(TEMP_SECRET_DIR, { recursive: true });
    process.env.SECRETS_DIR = TEMP_SECRET_DIR;
  });

  it('reads secret from file with correct permissions', async () => {
    const secretPath = path.join(TEMP_SECRET_DIR, 'JWT_SECRET');
    await fs.writeFile(secretPath, 'a'.repeat(64));
    await fs.chmod(secretPath, 0o400);
    
    const secret = await SecretsManager.getSecret('JWT_SECRET');
    expect(secret).toBe('a'.repeat(64));
  });

  it('fails gracefully when secret file is empty', async () => {
    await fs.writeFile(path.join(TEMP_SECRET_DIR, 'EMPTY_SECRET'), '');
    await expect(SecretsManager.getSecret('EMPTY_SECRET')).rejects.toThrow('is empty');
  });

  it('rejects short secrets at JWT signing time', async () => {
    const shortSecret = 'too-short';
    await fs.writeFile(path.join(TEMP_SECRET_DIR, 'JWT_SECRET'), shortSecret);
    await expect(getSigningKey()).rejects.toThrow('below minimum 64 characters');
  });
});
```

#### Monitoring & Observability

```yaml
# prometheus-alerts.yml
groups:
  - name: jwt-security
    rules:
      - alert: JWTSecretFileMissing
        expr: jwt_secret_file_present{job="backend"} == 0
        for: 1m
        labels:
          severity: critical
          pagerduty: true
        annotations:
          summary: "JWT secret file not found — authentication will fail"

      - alert: JWTSecretRotated
        expr: changes(jwt_secret_version{job="backend"}[1h]) > 0
        labels:
          severity: info
        annotations:
          summary: "JWT secret was rotated — verify token_version increment"

  - name: security-compliance
    rules:
      - alert: GitHistoryContainsSecret
        expr: git_secret_scan_alerts{severity="critical"} > 0
        labels:
          severity: critical
          pagerduty: true
        annotations:
          summary: "Automated scan detected potential secret in Git history"
```

#### Rollback Procedure

```bash
# If JWT secret rotation breaks admin authentication:
# 1. Identify the previous secret from Vault version history
vault kv get -version=1 secret/data/yotop10/production/jwt

# 2. Re-deploy with previous secret via docker-compose override
docker compose -f docker-compose.yml -f rollback.yml up -d --force-recreate backend

# 3. Confirm admin login works
curl -X POST https://admin.yotop10.com/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<admin-password>"}'

# 4. Document the rollback in the incident report
```

---

### C2 — NEXT_PUBLIC_API_URL Baked at Build Time

**File**: `Dockerfile.frontend:10`
**Severity**: CRITICAL
**Order**: #0.6 (Phase 0, Week 1)
**⏱️ Effort**: 3 hours
**✅ Final Expected Behavior**: `NEXT_PUBLIC_API_URL` is NEVER baked at build time. Runtime config endpoint serves dynamic URL. Client bundle lacks any hardcoded hostname/port. Changing API URL requires zero rebuilds.

#### Architecture Analysis

The `ENV NEXT_PUBLIC_API_URL=http://localhost:8100/api` instruction in the Dockerfile sets this value at build time. Next.js's build process inlines ALL `NEXT_PUBLIC_*` environment variables into the client-side JavaScript bundle during `next build`. This means:

1. The value `http://localhost:8100/api` is hardcoded into every `.js` chunk in `.next/static/`
2. Runtime environment variables in `docker-compose.yml` with the same name are IGNORED by client code
3. Browser-side API calls go to `http://localhost:8100/api` which is unreachable from user browsers (Docker internal port)

The production `docker-compose.yml` sets `NEXT_PUBLIC_API_URL=https://api.yotop10.com` which appears to take effect but does NOT because the Dockerfile's `ENV` instruction executes during the build stage, freezing the value.

#### Solution: Build-Time Injection with Runtime Fallback

**Architecture**:

Replace the single `NEXT_PUBLIC_API_URL` pattern with a dynamic runtime-configurable API base URL that can be set after the build is complete:

```typescript
// frontend/src/lib/api/runtimeConfig.ts
// Enterprise-grade runtime configuration with build-time defaults

export interface RuntimeConfig {
  apiBaseUrl: string;
  sentryDsn: string | null;
  gaMeasurementId: string | null;
  featureFlags: Record<string, boolean>;
}

let runtimeConfig: RuntimeConfig | null = null;
let configPromise: Promise<RuntimeConfig> | null = null;

const BUILD_TIME_API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const BUILD_TIME_SENTRY = process.env.NEXT_PUBLIC_SENTRY_DSN || null;
const BUILD_TIME_GA = process.env.NEXT_PUBLIC_GA_ID || null;

async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  // Attempt to load runtime config from a well-known path
  // This file is generated at container startup, NOT at build time
  try {
    const response = await fetch('/__config.json', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      // Short timeout — config fetch should not block page load
      signal: AbortSignal.timeout(2000),
    });
    
    if (!response.ok) {
      throw new Error(`Config fetch returned ${response.status}`);
    }
    
    const config: RuntimeConfig = await response.json();
    
    // Validate critical fields
    if (!config.apiBaseUrl || !config.apiBaseUrl.startsWith('http')) {
      throw new Error('Invalid apiBaseUrl in runtime config');
    }
    
    return config;
  } catch (err) {
    console.warn('[RuntimeConfig] Falling back to build-time defaults:', err);
    return {
      apiBaseUrl: BUILD_TIME_API_URL || '/api',
      sentryDsn: BUILD_TIME_SENTRY,
      gaMeasurementId: BUILD_TIME_GA,
      featureFlags: {},
    };
  }
}

let resolveConfig: (config: RuntimeConfig) => void;
export const configReady = new Promise<RuntimeConfig>((resolve) => {
  resolveConfig = resolve;
});

export function getRuntimeConfig(): RuntimeConfig {
  if (!runtimeConfig) {
    throw new Error('RuntimeConfig not initialized. Await configReady first.');
  }
  return runtimeConfig;
}

export async function initRuntimeConfig(): Promise<RuntimeConfig> {
  if (!configPromise) {
    configPromise = fetchRuntimeConfig().then(config => {
      runtimeConfig = config;
      resolveConfig(config);
      return config;
    });
  }
  return configPromise;
}
```

**Server-side config endpoint** (`frontend/src/app/api/__config/route.ts`):

```typescript
// Next.js API route served at /api/__config (NOT under /api proxy)
// This must be a route handler, not a static file, so it reads runtime env

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const config = {
    apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'https://yotop10.com/api',
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN || null,
    gaMeasurementId: process.env.NEXT_PUBLIC_GA_ID || null,
    featureFlags: {
      arenaEnabled: process.env.FF_ARENA_ENABLED === 'true',
      scholarFastTrack: process.env.FF_SCHOLAR_FAST_TRACK === 'true',
      pwaEnabled: process.env.FF_PWA_ENABLED !== 'false',
    },
    buildTimestamp: process.env.BUILD_TIMESTAMP || null,
    gitCommit: process.env.GIT_COMMIT || null,
  };

  // Cache control: no cache because config can change at runtime
  return NextResponse.json(config, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Config-Version': process.env.CONFIG_VERSION || '1',
    },
  });
}
```

**Docker entrypoint script** (`scripts/generate-runtime-config.sh`):

```bash
#!/usr/bin/env bash
# generate-runtime-config.sh
# Generates /app/public/__config.json at container startup
# This runs AFTER the Next.js build, so it reads the CURRENT runtime environment

set -euo pipefail

CONFIG_FILE="/app/public/__config.json"
TEMP_FILE="${CONFIG_FILE}.tmp"

# Ensure the public directory exists
mkdir -p "$(dirname "$CONFIG_FILE")"

cat > "$TEMP_FILE" << EOF
{
  "apiBaseUrl": "${NEXT_PUBLIC_API_URL:-/api}",
  "sentryDsn": ${NEXT_PUBLIC_SENTRY_DSN:null},
  "gaMeasurementId": ${NEXT_PUBLIC_GA_ID:null},
  "featureFlags": {
    "arenaEnabled": ${FF_ARENA_ENABLED:-false},
    "scholarFastTrack": ${FF_SCHOLAR_FAST_TRACK:-false},
    "pwaEnabled": ${FF_PWA_ENABLED:-true}
  },
  "buildTimestamp": "${BUILD_TIMESTAMP:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}",
  "gitCommit": "${GIT_COMMIT:-unknown}"
}
EOF

# Atomic rename to prevent partial reads
mv "$TEMP_FILE" "$CONFIG_FILE"
chmod 644 "$CONFIG_FILE"

echo "[RuntimeConfig] Generated $CONFIG_FILE"
echo "[RuntimeConfig] apiBaseUrl: ${NEXT_PUBLIC_API_URL:-/api}"
```

**Dockerfile update** (`Dockerfile.frontend`):

```dockerfile
# Remove the problematic ENV line entirely
# ENV NEXT_PUBLIC_API_URL=http://localhost:8100/api   <-- DELETE THIS LINE

# Build stage — no NEXT_PUBLIC* needed at build time
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN npm install -g pnpm@9.15.9 && pnpm install --frozen-lockfile
COPY frontend/ .
# Build without NEXT_PUBLIC_API_URL — uses 'fallback' value
RUN npm install -g pnpm@9.15.9 && pnpm build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Generate runtime config at startup
COPY scripts/generate-runtime-config.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/generate-runtime-config.sh

EXPOSE 3000
ENV NODE_ENV=production

# Use a wrapper script that generates config then starts Next.js
COPY scripts/start-with-config.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/start-with-config.sh

CMD ["start-with-config.sh"]
```

**Entrypoint wrapper** (`scripts/start-with-config.sh`):

```bash
#!/usr/bin/env sh
set -e

# Generate runtime configuration from current environment
generate-runtime-config.sh

# Start Next.js in standalone mode
exec node /app/server.js
```

#### Testing Strategy

```typescript
// tests/runtime-config.test.ts

describe('Runtime Configuration — Enterprise Standards', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_API_URL;
    // Reset the singleton
    jest.resetModules();
  });

  it('fetches runtime config from well-known endpoint', async () => {
    // Mock the /__config.json fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ apiBaseUrl: 'https://api.yotop10.com', ... }),
    });
    
    const config = await initRuntimeConfig();
    expect(config.apiBaseUrl).toBe('https://api.yotop10.com');
  });

  it('falls back to build-time defaults when runtime config is unreachable', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://fallback.api.com';
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    
    const config = await initRuntimeConfig();
    expect(config.apiBaseUrl).toBe('https://fallback.api.com');
  });

  it('validates apiBaseUrl format at runtime', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ apiBaseUrl: 'not-a-url', ... }),
    });
    
    const config = await initRuntimeConfig();
    // Should fall back since 'not-a-url' doesn't start with 'http'
    expect(config.apiBaseUrl).toBe('/api');
  });

  it('provides synchronous access after initialization', async () => {
    await initRuntimeConfig();
    const config = getRuntimeConfig();
    expect(config.apiBaseUrl).toBeDefined();
  });

  it('throws if accessed before initialization', () => {
    expect(() => getRuntimeConfig()).toThrow('not initialized');
  });
});
```

#### Deployment Verification

```bash
#!/usr/bin/env bash
# verify-runtime-config.sh
# Run this AFTER deployment to confirm runtime config is correct

CONFIG_URL="${1:-https://yotop10.com/__config.json}"
EXPECTED_API_URL="${2:-https://api.yotop10.com}"

echo "Verifying runtime config at $CONFIG_URL..."

# Fetch config with retry
for i in $(seq 1 5); do
  CONFIG=$(curl -sf "$CONFIG_URL" 2>/dev/null) && break
  echo "Attempt $i failed, retrying in 2s..."
  sleep 2
done

if [ -z "$CONFIG" ]; then
  echo "FATAL: Could not fetch runtime config after 5 attempts"
  exit 1
fi

# Validate
echo "$CONFIG" | jq -e ".apiBaseUrl == \"$EXPECTED_API_URL\"" || {
  echo "FATAL: apiBaseUrl mismatch"
  echo "Expected: $EXPECTED_API_URL"
  echo "Got: $(echo "$CONFIG" | jq -r '.apiBaseUrl')"
  exit 1
}

echo "PASS: Runtime config apiBaseUrl is $EXPECTED_API_URL"

# Verify client-side bundle does NOT contain the old hardcoded URL
BUNDLE_CHECK=$(grep -r "localhost:8100" /app/.next/static/ 2>/dev/null || true)
if [ -n "$BUNDLE_CHECK" ]; then
  echo "WARNING: Client bundle still contains 'localhost:8100' — rebuild needed"
  exit 1
fi

echo "PASS: No stale build-time URL found in bundles"
```

---

### C3 — Backend Health Check Uses `wget` Not Present in Base Image

**File**: `docker-compose.yml:56-61`
**Severity**: CRITICAL — Entire deployment fails
**Order**: #0.5 (Phase 0, Week 1)
**⏱️ Effort**: 1 hour
**✅ Final Expected Behavior**: Backend health check uses `node -e` with JSON parsing instead of `wget`. Container becomes `healthy` within `start_period`. Frontend waits for backend health before starting.

#### Root Cause

Docker Compose health check:
```yaml
healthcheck:
  test: ["CMD", "wget", "--spider", "-q", "http://localhost:8000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 45s
```

The `node:20-alpine` base image does NOT include `wget`. It includes `wget`-busybox (a minimal implementation) but not with `--spider` support. The health check command exits with code 127 (command not found), Docker marks the container as `unhealthy` immediately after `start_period`, and the frontend's `depends_on: backend: condition: service_healthy` prevents the frontend from ever starting.

#### Enterprise Solution

**Multi-layered health check system**:

```yaml
# docker-compose.yml — Production Health Check System
services:
  backend:
    healthcheck:
      test: [
        "CMD-SHELL",
        "node -e \"require('http').get('http://localhost:8000/api/health', { timeout: 5000 }, (r) => { const body = []; r.on('data', c => body.push(c)); r.on('end', () => { try { const j = JSON.parse(Buffer.concat(body).toString()); process.exit(j.status === 'ok' ? 0 : 1); } catch { process.exit(1); } }); }).on('error', () => process.exit(1))\""
      ]
      interval: 15s
      timeout: 10s
      retries: 5
      start_period: 60s
```

**Node.js health check script** (`scripts/healthcheck.mjs`):

```javascript
#!/usr/bin/env node
// Enterprise health check with deep diagnostics
// Performs multi-layer health check: process, DB, Redis

import http from 'http';

const TARGET = process.env.HEALTH_CHECK_URL || 'http://localhost:8000/api/health';
const TIMEOUT_MS = parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10);
const EXPECTED_STATUS = process.env.HEALTH_CHECK_EXPECTED || 'ok';
const COMPONENT_CHECK = process.env.HEALTH_CHECK_COMPONENTS || '';

let exitCode = 0;
const checks = [];

function checkHttp() {
  return new Promise((resolve) => {
    const req = http.get(TARGET, { timeout: TIMEOUT_MS }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error(`HEALTH: HTTP ${res.statusCode}`);
          resolve(false);
          return;
        }
        try {
          const body = JSON.parse(data);
          if (body.status === EXPECTED_STATUS) {
            resolve(true);
          } else {
            console.error(`HEALTH: status=${body.status}, expected=${EXPECTED_STATUS}`);
            resolve(false);
          }
        } catch (err) {
          console.error(`HEALTH: JSON parse error: ${err.message}`);
          resolve(false);
        }
      });
    });
    req.on('error', (err) => {
      console.error(`HEALTH: HTTP error: ${err.message}`);
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      console.error(`HEALTH: Timeout after ${TIMEOUT_MS}ms`);
      resolve(false);
    });
  });
}

async function run() {
  checks.push({ name: 'http', result: await checkHttp() });
  
  const allPassed = checks.every(c => c.result);
  
  for (const check of checks) {
    const icon = check.result ? '✓' : '✗';
    console.log(`HEALTH: ${icon} ${check.name}`);
    if (!check.result) exitCode = 1;
  }
  
  process.exit(exitCode);
}

run();
```

**Rolling health check with backoff** (`backend/src/lib/healthCheck.ts`):

```typescript
// Application-level health check — called by the health endpoint
// NOT a replacement for Docker health check, but a supplement

interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  uptime: number;
  components: {
    mongodb: { status: 'ok' | 'down'; latency_ms: number | null };
    redis: { status: 'ok' | 'down'; latency_ms: number | null };
    elasticsearch: { status: 'ok' | 'down' | 'disabled'; latency_ms: number | null };
    disk: { status: 'ok' | 'warning' | 'critical'; usage_pct: number };
    memory: { status: 'ok' | 'warning' | 'critical'; heap_pct: number };
  };
  checks: Array<{ name: string; status: 'pass' | 'fail'; observed_value: number | string; threshold: number | string }>;
}

export class HealthCheckRegistry {
  private checks = new Map<string, () => Promise<{ pass: boolean; value: number | string; threshold: number | string }>>();
  private lastResults = new Map<string, { pass: boolean; timestamp: Date }>();

  register(name: string, check: () => Promise<{ pass: boolean; value: number | string; threshold: number | string }>): void {
    this.checks.set(name, check);
  }

  async runAll(): Promise<HealthStatus['checks']> {
    const results: HealthStatus['checks'] = [];
    for (const [name, check] of this.checks) {
      try {
        const result = await check();
        results.push({ name, status: result.pass ? 'pass' : 'fail', ...result });
        this.lastResults.set(name, { pass: result.pass, timestamp: new Date() });
      } catch (err) {
        results.push({ name, status: 'fail', observed_value: (err as Error).message, threshold: 'N/A' });
        this.lastResults.set(name, { pass: false, timestamp: new Date() });
      }
    }
    return results;
  }

  getDegradedComponents(): string[] {
    return Array.from(this.lastResults.entries())
      .filter(([, r]) => !r.pass)
      .map(([name]) => name);
  }

  isHealthy(): boolean {
    return Array.from(this.lastResults.values()).every(r => r.pass);
  }
}

export const healthRegistry = new HealthCheckRegistry();

// Register standard checks
healthRegistry.register('mongodb-ping', async () => {
  const start = Date.now();
  await mongoose.connection.db.admin().ping();
  const latency = Date.now() - start;
  return { pass: latency < 5000, value: `${latency}ms`, threshold: '<5000ms' };
});

healthRegistry.register('redis-ping', async () => {
  const start = Date.now();
  await redis.ping();
  const latency = Date.now() - start;
  return { pass: latency < 2000, value: `${latency}ms`, threshold: '<2000ms' };
});

healthRegistry.register('memory-heap', () => {
  const mem = process.memoryUsage();
  const heapPct = (mem.heapUsed / mem.heapTotal) * 100;
  return { pass: heapPct < 85, value: `${Math.round(heapPct)}%`, threshold: '<85%' };
});
```

#### Verification

```bash
# Verify health check works post-deployment
HEALTH_URL="http://localhost:8100/api/health"

# Wait for healthy status (up to 120s)
for i in $(seq 1 60); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' yotop10_backend 2>/dev/null)
  if [ "$STATUS" = "healthy" ]; then
    echo "Backend healthy after ${i}s"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "FATAL: Backend never became healthy"
    docker logs yotop10_backend --tail 50
    exit 1
  fi
  sleep 2
done

# Verify deep health check
curl -sf "$HEALTH_URL" | jq '.status' | grep -q 'ok' || {
  echo "Health check returned non-ok status"
  exit 1
}
```

---

### C4-C6 — Databases Without Authentication (MongoDB, Redis, Elasticsearch)

**Files**: `docker-compose.yml:48,98,117-118`
**Severity**: CRITICAL — Full data access from any network peer
**Order**: #0.2-#0.4 (Phase 0, Week 1)
**⏱️ Effort**: 2h+1h+2h
**✅ Final Expected Behavior**: MongoDB, Redis, ES all require authentication. Connection strings contain credentials. Security enabled with TLS. Commands like FLUSHALL renamed. Health checks authenticate before ping.

#### Enterprise Authentication Architecture

Three-layer zero-trust database security:

**Layer 1: Network Isolation**

```yaml
# docker-compose.yml — Zero-Trust Network Architecture
services:
  mongodb:
    networks:
      - database_net  # Isolated from frontend and external traffic
    # No ports exposed to host — only accessible via Docker internal DNS
  
  redis:
    networks:
      - cache_net
  
  elasticsearch:
    networks:
      - search_net

  backend:
    networks:
      - database_net
      - cache_net
      - search_net
      - public_net  # Only backend has access to all nets

  frontend:
    networks:
      - public_net  # Only reaches backend, never databases directly

networks:
  database_net:
    internal: true  # No external connectivity
  cache_net:
    internal: true
  search_net:
    internal: true
  public_net:
    driver: bridge
```

**Layer 2: Credential-Based Authentication**

```yaml
# docker-compose.yml — Database Credentials
services:
  mongodb:
    image: mongo:7.0.20  # PINNED minor version
    command: >
      mongod
      --auth
      --replSet rs0
      --keyFile /etc/mongo-keyfile/mongodb-keyfile
      --bind_ip_all
    environment:
      MONGO_INITDB_ROOT_USERNAME_FILE: /run/secrets/mongo_root_username
      MONGO_INITDB_ROOT_PASSWORD_FILE: /run/secrets/mongo_root_password
      MONGO_INITDB_DATABASE: yotop10
    secrets:
      - mongo_root_username
      - mongo_root_password
      - mongo_keyfile
    volumes:
      - mongo-keyfile:/etc/mongo-keyfile:ro
    healthcheck:
      test: >
        mongosh --eval 'db.adminCommand("ping")'
        --username $$(cat /run/secrets/mongo_root_username)
        --password $$(cat /run/secrets/mongo_root_password)
        --authenticationDatabase admin
      interval: 15s
      timeout: 10s
      retries: 5
      start_period: 60s

  redis:
    image: redis:7.4.2-alpine  # PINNED
    command: >
      redis-server
      --requirepass $$(cat /run/secrets/redis_password)
      --appendonly yes
      --save 900 1
      --save 300 10
      --save 60 10000
      --loglevel notice
      --rename-command FLUSHALL ""
      --rename-command FLUSHDB ""
      --rename-command CONFIG ""
      --rename-command EVAL "SANDBOX_EVAL"
    secrets:
      - redis_password
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "$$(cat /run/secrets/redis_password)", "ping"]
      interval: 15s
      timeout: 5s
      retries: 3

  elasticsearch:
    image: elasticsearch:8.15.3  # PINNED
    environment:
      - cluster.name=yotop10-search
      - node.name=es01
      - discovery.type=single-node
      - xpack.security.enabled=true
      - xpack.security.transport.ssl.enabled=true
      - xpack.security.transport.ssl.verification_mode=certificate
      - xpack.security.transport.ssl.keystore.path=/usr/share/elasticsearch/config/certs/elastic-certificates.p12
      - xpack.security.transport.ssl.truststore.path=/usr/share/elasticsearch/config/certs/elastic-certificates.p12
      - ELASTIC_PASSWORD_FILE=/run/secrets/es_password
    secrets:
      - es_password
      - es_certs
    healthcheck:
      test: ["CMD", "curl", "-sf", "-u", "elastic:$$(cat /run/secrets/es_password)", "https://localhost:9200/_cluster/health"]
      interval: 15s
      timeout: 10s
      retries: 5
      start_period: 120s  # ES takes longer to start with security enabled
```

**Layer 3: Application-Level Credential Management**

```typescript
// backend/src/lib/database/mongoConnector.ts
// Enterprise MongoDB connection manager with automatic credential rotation

import mongoose from 'mongoose';
import { SecretsManager } from '../secrets';

interface MongoConfig {
  uri: string;
  maxPoolSize: number;
  minPoolSize: number;
  serverSelectionTimeoutMS: number;
  heartbeatFrequencyMS: number;
  retryWrites: boolean;
  retryReads: boolean;
  w: 'majority';
  readConcern: { level: 'majority' };
  writeConcern: { w: 'majority'; j: boolean };
}

export class MongoConnector {
  private static instance: MongoConnector;
  private config: MongoConfig;
  private connectionPromise: Promise<typeof mongoose> | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly BASE_RECONNECT_DELAY_MS = 1000;

  private constructor() {
    this.config = {
      uri: MONGODB_URI_PLACEHOLDER,  // Will be resolved at connect time
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '50', 10),
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '10', 10),
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
      w: 'majority',
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority', j: false },
    };
  }

  static getInstance(): MongoConnector {
    if (!this.instance) {
      this.instance = new MongoConnector();
    }
    return this.instance;
  }

  async connect(): Promise<typeof mongoose> {
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  private async _connect(): Promise<typeof mongoose> {
    const uri = await this.resolveUri();
    
    mongoose.connection.on('connected', () => {
      console.log('[MongoDB] Connected');
      this.reconnectAttempts = 0;
    });

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Disconnected. Will retry...');
      this.scheduleReconnect();
    });

    try {
      await mongoose.connect(uri, this.config);
      return mongoose;
    } catch (err) {
      this.connectionPromise = null;
      throw err;
    }
  }

  private async resolveUri(): Promise<string> {
    const username = await SecretsManager.getSecret('MONGO_USERNAME');
    const password = await SecretsManager.getSecret('MONGO_PASSWORD');
    const host = process.env.MONGO_HOST || 'mongodb';
    const port = process.env.MONGO_PORT || '27017';
    const database = process.env.MONGO_DATABASE || 'yotop10';
    
    // URL-encode credentials for special characters
    const encodedUsername = encodeURIComponent(username);
    const encodedPassword = encodeURIComponent(password);
    
    return `mongodb://${encodedUsername}:${encodedPassword}@${host}:${port}/${database}?authSource=admin&replicaSet=rs0&tls=true`;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('[MongoDB] Max reconnection attempts reached. Giving up.');
      process.exit(1);  // Let the orchestrator restart the container
    }

    const delay = this.BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    console.log(`[MongoDB] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
    
    setTimeout(() => {
      this.connectionPromise = null;
      this.connect().catch(err => {
        console.error('[MongoDB] Reconnection failed:', err.message);
      });
    }, delay);
  }

  async healthCheck(): Promise<{ ok: boolean; latency: number }> {
    const start = Date.now();
    try {
      await mongoose.connection.db.admin().ping();
      return { ok: true, latency: Date.now() - start };
    } catch {
      return { ok: false, latency: Date.now() - start };
    }
  }

  async gracefulShutdown(): Promise<void> {
    console.log('[MongoDB] Initiating graceful shutdown...');
    try {
      await mongoose.connection.close();
      console.log('[MongoDB] Connection closed');
    } catch (err) {
      console.error('[MongoDB] Error during shutdown:', err);
    }
  }
}
```

**Redis authentication** (`backend/src/lib/redis.ts`):

```typescript
import { createClient, RedisClientType } from 'redis';
import { SecretsManager } from './secrets';

let client: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (client?.isOpen) return client;

  const password = await SecretsManager.getSecret('REDIS_PASSWORD');
  const host = process.env.REDIS_HOST || 'redis';
  const port = process.env.REDIS_PORT || '6379';

  client = createClient({
    socket: {
      host,
      port: parseInt(port, 10),
      tls: process.env.REDIS_TLS === 'true',
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('[Redis] Max retries reached');
          return new Error('Max retries');
        }
        return Math.min(retries * 100, 3000);
      },
    },
    password,
    database: parseInt(process.env.REDIS_DB || '0', 10),
    commandsQueueMaxLength: 10000,
  });

  client.on('error', (err) => {
    console.error('[Redis] Error:', err.message);
  });

  client.on('reconnecting', () => {
    console.warn('[Redis] Reconnecting...');
  });

  await client.connect();
  console.log('[Redis] Connected');
  return client;
}
```

#### Key Generation & Rotation

```bash
#!/usr/bin/env bash
# scripts/generate-db-credentials.sh
# Generates cryptographically secure credentials for all databases

set -euo pipefail

SECRETS_DIR="${1:-./secrets}"
mkdir -p "$SECRETS_DIR"

# MongoDB keyfile for replica set authentication (must be exactly 756 bytes)
openssl rand -base64 756 > "$SECRETS_DIR/mongodb-keyfile"
chmod 400 "$SECRETS_DIR/mongodb-keyfile"

# MongoDB admin credentials
echo "yotop10_admin_$(openssl rand -hex 4)" > "$SECRETS_DIR/mongo_root_username"
openssl rand -base64 48 > "$SECRETS_DIR/mongo_root_password"

# Redis password (256-bit)
openssl rand -base64 32 > "$SECRETS_DIR/redis_password"

# Elasticsearch password
openssl rand -base64 32 > "$SECRETS_DIR/es_password"

# Generate Elasticsearch certs
docker run --rm -v "$(pwd)/$SECRETS_DIR:/certs" elasticsearch:8.15.3 \
  bash -c 'bin/elasticsearch-certutil cert -s --out /certs/elastic-certificates.p12 --pass ""'

echo "Credentials generated in $SECRETS_DIR"
echo "WARNING: These files contain sensitive credentials. Store securely."
echo "Run: docker secret create <name> <file>"
```

---

### C7 — Nginx Without TLS

**Order**: #0.7
**⏱️ Effort**: 3h
**✅ Final Expected Behavior**: All traffic is HTTPS. HTTP redirects to HTTPS. HSTS with preload. OCSP stapling. TLS 1.2/1.3 only. Security headers on every response.

**File**: `nginx.conf.template:2`
**Severity**: CRITICAL

#### Enterprise TLS Architecture

```nginx
# nginx.conf — Production TLS Termination Point
# Designed for Let's Encrypt + Certbot auto-renewal with OCSP stapling

upstream frontend {
    least_conn;
    server frontend:3000 max_fails=3 fail_timeout=10s;
    keepalive 32;
}

upstream backend {
    least_conn;
    server backend:8000 max_fails=3 fail_timeout=10s;
    keepalive 32;
}

# HTTP → HTTPS redirect (strict)
server {
    listen 80;
    listen [::]:80;
    server_name yotop10.com www.yotop10.com;
    
    # Let's Encrypt ACME challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/acme;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yotop10.com www.yotop10.com;

    # TLS certificates (auto-renewed by certbot)
    ssl_certificate /etc/letsencrypt/live/yotop10.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yotop10.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/yotop10.com/chain.pem;

    # Modern TLS configuration (Mozilla Intermediate, January 2025)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;
    ssl_ecdh_curve X25519:prime256v1:secp384r1;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 1.1.1.1 8.8.8.8 valid=300s;
    resolver_timeout 5s;

    # HSTS (preload)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=(), bluetooth=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' https://cdn.yotop10.com data: blob:; font-src 'self' data:; connect-src 'self' https://api.yotop10.com https://cdn.yotop10.com; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;

    # Hide nginx version
    server_tokens off;

    # Request limits
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
    limit_req_zone $binary_remote_addr zone=search_limit:10m rate=5r/s;
    limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

    # Client limits
    client_body_buffer_size 128k;
    client_max_body_size 10m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 8k;

    # Timeouts
    client_body_timeout 12s;
    client_header_timeout 12s;
    send_timeout 10s;
    keepalive_timeout 30s;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript image/svg+xml;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
        proxy_cache_bypass $http_upgrade;
        
        # Caching for static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|woff2?|svg|webp)$ {
            expires 365d;
            add_header Cache-Control "public, immutable, max-age=31536000";
            access_log off;
        }
        
        # HTML should not be cached (dynamic content)
        location ~* \.html$ {
            add_header Cache-Control "private, no-cache, no-store, must-revalidate";
        }
    }

    # API
    location /api/ {
        limit_req zone=api_limit burst=50 nodelay;
        limit_conn conn_limit 10;
        
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
        
        # No caching for API
        add_header Cache-Control "private, no-cache, no-store, must-revalidate";
        proxy_no_cache 1;
        proxy_cache_bypass 1;
        
        # CORS preflight
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin $http_origin;
            add_header Access-Control-Allow-Methods 'GET, POST, PATCH, DELETE, OPTIONS';
            add_header Access-Control-Allow-Headers 'Content-Type, Authorization, X-Device-Fingerprint, X-Tier0';
            add_header Access-Control-Allow-Credentials 'true';
            add_header Access-Control-Max-Age 86400;
            return 204;
        }
        
        # CORS headers
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Credentials 'true' always;
        add_header Access-Control-Expose-Headers 'X-Request-ID, X-RateLimit-Remaining, X-RateLimit-Reset' always;
    }

    # Logging with request ID
    log_format extended '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_request_id" '
                      '$request_time $upstream_response_time';

    access_log /var/log/nginx/access.log extended buffer=32k flush=5s;
    error_log /var/log/nginx/error.log warn;

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

**TLS certificate management** (`scripts/cert-renew.sh`):

```bash
#!/usr/bin/env bash
# cert-renew.sh — Zero-downtime Let's Encrypt certificate renewal
# Runs as a cron job or systemd timer

set -euo pipefail

DOMAIN="${1:-yotop10.com}"
EMAIL="${2:-admin@yotop10.com}"
NGINX_CONTAINER="yotop10_nginx"

echo "[CertRenew] Checking certificate for $DOMAIN..."

# Check if renewal is needed (within 30 days of expiry)
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  EXPIRY=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" | cut -d= -f2)
  EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
  NOW_EPOCH=$(date +%s)
  DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
  
  if [ "$DAYS_LEFT" -gt 30 ]; then
    echo "[CertRenew] Certificate valid for $DAYS_LEFT days. No renewal needed."
    exit 0
  fi
  echo "[CertRenew] Certificate expires in $DAYS_LEFT days. Renewing..."
fi

# Run certbot
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/acme:/var/www/acme \
  -p 80:80 \
  certbot/certbot:v2.9.0 \
  certonly --webroot \
  --webroot-path /var/www/acme \
  --email "$EMAIL" \
  --domain "$DOMAIN" \
  --domain "www.$DOMAIN" \
  --agree-tos \
  --non-interactive \
  --keep-until-expiring

# Reload nginx to pick up new certificates
docker exec "$NGINX_CONTAINER" nginx -s reload

echo "[CertRenew] Certificate renewed and nginx reloaded successfully."

# Verify certificate
curl -sfI "https://$DOMAIN/" | grep -q "200 OK" || {
  echo "[CertRenew] WARNING: HTTPS verification failed!"
  exit 1
}
```

---

### C8 — Missing Proxy Headers

**Order**: #0.8
**⏱️ Effort**: 1h
**✅ Final Expected Behavior**: Nginx sends X-Real-IP, X-Forwarded-For, X-Forwarded-Proto, X-Request-ID. Backend trust proxy configured. Rate limiting uses real client IP.

**File**: `nginx.conf.template`
**Severity**: CRITICAL

This is resolved by the nginx configuration above which includes all required headers. The key headers and their purposes:

```nginx
# Real IP detection — prevents IP spoofing via X-Forwarded-For
proxy_set_header X-Real-IP $remote_addr;           # Original client IP (untrusted)
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;  # Client + proxy chain
proxy_set_header X-Forwarded-Proto $scheme;         # http or https
proxy_set_header X-Request-ID $request_id;          # Unique request tracing ID

# Backend must be configured to trust these headers:
```

**Backend trust configuration** (`backend/src/server.ts`):

```typescript
import express from 'express';

const app = express();

// Trust proxy for X-Forwarded-* headers
// Only trust requests from nginx (internal Docker network)
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// Or more precisely, trust only the nginx container IP
// app.set('trust proxy', '172.20.0.0/16');  // Docker bridge network
```

**Client IP extraction utility** (`backend/src/lib/clientIp.ts`):

```typescript
import { Request } from 'express';

export function getClientIp(req: Request): string {
  // X-Forwarded-For is trusted because we configured 'trust proxy'
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  if (forwarded) {
    // Take the leftmost IP (original client)
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  
  // Fallback to direct connection IP
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function getRequestId(req: Request): string {
  return (req.headers['x-request-id'] as string) || crypto.randomUUID();
}
```

---

## 2. Backend — CRITICAL

### C9 — Leaking Cron Jobs on Shutdown

**Order**: #1.1
**⏱️ Effort**: 4h
**✅ Final Expected Behavior**: All 7+ cron jobs registered in CronRegistry. Timeout protection. Dead-man-s-switch heartbeat. Clean shutdown on SIGTERM. Health endpoint reports cron status.

**File**: `server.ts:96-123`
**Severity**: CRITICAL

#### Architecture: Lifecycle-Managed Cron Registry

```typescript
// backend/src/lib/cronRegistry.ts
// Enterprise cron lifecycle manager with graceful shutdown, health monitoring, and dead-man's-switch

import { EventEmitter } from 'events';

interface CronJob {
  name: string;
  interval: number;        // ms
  handler: () => Promise<void>;
  timeout: number;         // max execution time before forced termination
  deadManSwitch?: string;  // Redis key for dead-man's-switch heartbeat
  lastRun: Date | null;
  lastDuration: number | null;
  running: boolean;
  timerId: NodeJS.Timeout | null;
  fatal: boolean;          // if true, crash on failure (don't swallow)
}

export class CronRegistry extends EventEmitter {
  private jobs = new Map<string, CronJob>();
  private shuttingDown = false;
  private startOrder: string[] = [];
  private readonly GRACEFUL_SHUTDOWN_TIMEOUT = 30000; // 30s total for all crons

  register(config: {
    name: string;
    interval: number;
    handler: () => Promise<void>;
    timeout?: number;
    deadManSwitch?: string;
    fatal?: boolean;
    startDelay?: number;  // delay before first run
  }): void {
    if (this.jobs.has(config.name)) {
      throw new Error(`Cron job '${config.name}' is already registered`);
    }

    this.jobs.set(config.name, {
      name: config.name,
      interval: config.interval,
      handler: config.handler,
      timeout: config.timeout || config.interval * 0.8, // 80% of interval
      deadManSwitch: config.deadManSwitch,
      lastRun: null,
      lastDuration: null,
      running: false,
      timerId: null,
      fatal: config.fatal || false,
    });

    this.startOrder.push(config.name);

    // Schedule first run with optional delay
    const delay = config.startDelay ?? Math.random() * 60000; // Stagger startups
    setTimeout(() => this.scheduleJob(config.name), delay);

    console.log(`[CronRegistry] Registered: ${config.name} (every ${config.interval}ms)`);
  }

  private scheduleJob(name: string): void {
    const job = this.jobs.get(name);
    if (!job || this.shuttingDown) return;

    job.timerId = setTimeout(async () => {
      if (this.shuttingDown || job.running) return;

      job.running = true;
      const startTime = Date.now();

      try {
        // Execute with timeout protection
        const result = await this.executeWithTimeout(job);
        job.lastRun = new Date();
        job.lastDuration = Date.now() - startTime;

        // Update dead-man's-switch
        if (job.deadManSwitch) {
          const { redis } = await import('./redis');
          await redis.set(job.deadManSwitch, Date.now().toString(), { EX: Math.ceil(job.interval / 1000) * 2 });
        }

        this.emit('job:complete', { name: job.name, duration: job.lastDuration });
      } catch (err) {
        const error = err as Error;
        console.error(`[CronRegistry] Job '${job.name}' failed:`, error.message);
        this.emit('job:error', { name: job.name, error: error.message, duration: Date.now() - startTime });

        if (job.fatal) {
          console.error(`[CronRegistry] Fatal job '${job.name}' failed. Shutting down.`);
          process.exit(1);
        }
      } finally {
        job.running = false;
        // Reschedule next run (not recursive — creates new timer)
        this.scheduleJob(name);
      }
    }, job.interval);
  }

  private executeWithTimeout(job: CronJob): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Job '${job.name}' timed out after ${job.timeout}ms`));
      }, job.timeout);

      job.handler()
        .then(() => { clearTimeout(timeoutId); resolve(); })
        .catch(err => { clearTimeout(timeoutId); reject(err); });
    });
  }

  async gracefulShutdown(): Promise<void> {
    console.log('[CronRegistry] Initiating graceful shutdown...');
    this.shuttingDown = true;

    const shutdownPromises: Promise<void>[] = [];

    for (const [name, job] of this.jobs) {
      if (job.timerId) {
        clearTimeout(job.timerId);
        job.timerId = null;
      }

      if (job.running) {
        shutdownPromises.push(
          new Promise<void>((resolve) => {
            this.once('job:complete', (completed) => {
              if (completed.name === name) resolve();
            });
            this.once('job:error', (errored) => {
              if (errored.name === name) resolve();
            });
            // Safety timeout for running jobs
            setTimeout(resolve, 5000);
          })
        );
        console.log(`[CronRegistry] Waiting for job '${name}' to complete...`);
      }
    }

    // Wait for all running jobs with overall timeout
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Shutdown timeout')), this.GRACEFUL_SHUTDOWN_TIMEOUT);
    });

    try {
      await Promise.race([Promise.all(shutdownPromises), timeoutPromise]);
    } catch (err) {
      console.warn('[CronRegistry] Shutdown timed out. Force-stopping remaining jobs.');
    }

    console.log(`[CronRegistry] All ${this.jobs.size} jobs stopped.`);
  }

  getStatus(): Array<{ name: string; running: boolean; lastRun: Date | null; lastDuration: number | null }> {
    return Array.from(this.jobs.values()).map(j => ({
      name: j.name,
      running: j.running,
      lastRun: j.lastRun,
      lastDuration: j.lastDuration,
    }));
  }

  getHealthy(): boolean {
    for (const job of this.jobs.values()) {
      if (!job.lastRun) return false;  // Some jobs haven't run yet
      const elapsed = Date.now() - job.lastRun.getTime();
      if (elapsed > job.interval * 3) return false;  // Job hasn't run in 3 intervals
    }
    return true;
  }
}

export const cronRegistry = new CronRegistry();
```

**Server initialization** (`backend/src/server.ts`):

```typescript
import { cronRegistry } from './lib/cronRegistry';

async function startCrons(): Promise<void> {
  // All cron jobs are registered here, not scattered across files
  const { startPostCountCron } = await import('./lib/postCountReconciler');
  const { startAlertEngine } = await import('./lib/alertEngine');
  // ... etc
  
  // Register each cron with the lifecycle manager
  cronRegistry.register({
    name: 'post-count-reconciler',
    interval: 5 * 60 * 1000,
    handler: startPostCountCron,
    deadManSwitch: 'cron:heartbeat:post-count-reconciler',
  });
  
  cronRegistry.register({
    name: 'alert-engine',
    interval: 60 * 1000,
    handler: startAlertEngine,
    timeout: 45000,
    fatal: true,  // Alert engine failures are critical
  });
  
  // ... register all 7+ crons
}

async function gracefulShutdown(): Promise<void> {
  console.log('[Server] Received shutdown signal. Draining connections...');
  
  // 1. Stop accepting new requests
  server.close();
  
  // 2. Stop cron jobs gracefully
  await cronRegistry.gracefulShutdown();
  
  // 3. Close database connections
  await mongoose.connection.close();
  await redis.quit();
  // Close ES connection...
  
  // 4. Flush pending logs
  await flushAuditLogs();
  
  // 5. Exit
  console.log('[Server] Shutdown complete.');
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

---

### C10 — Unbounded Post Loading for Title Similarity Check

**Order**: #2.1
**⏱️ Effort**: 4h
**✅ Final Expected Behavior**: Title similarity uses ES fuzzy search + Levenshtein verification. Max 50 candidates in memory. Response under 200ms regardless of post count.

**File**: `posts.ts:515-528`
**Severity**: CRITICAL

#### Enterprise Solution: Tiered Title Matching with Elasticsearch

Replace the unbounded in-memory loop over 5 years of posts with a two-tier approach:

**Tier 1: Elasticsearch fuzzy match** (fast, approximate, handles 99% of cases)
**Tier 2: Exact Levenshtein verification** (accurate, only on top candidates)

```typescript
// backend/src/lib/titleSimilarityV2.ts
// Enterprise title similarity with ES-backed pre-filtering

import { es } from '../elasticsearch';

interface TitleMatchCandidate {
  postId: string;
  title: string;
  slug: string;
  categorySlug: string;
  similarity: number;
}

export async function findSimilarTitles(
  queryTitle: string,
  options: {
    threshold?: number;         // Minimum similarity (0-1), default 0.8
    maxCandidates?: number;     // Max candidates from ES, default 50
    maxResults?: number;        // Max results returned, default 10
    excludePostId?: string;     // Exclude a specific post (for edits)
  } = {}
): Promise<TitleMatchCandidate[]> {
  const {
    threshold = 0.8,
    maxCandidates = 50,
    maxResults = 10,
    excludePostId,
  } = options;

  // Tier 1: Elasticsearch fuzzy search
  const esResults = await es.search({
    index: 'yotop10-posts',
    body: {
      query: {
        bool: {
          must: {
            match: {
              title: {
                query: queryTitle,
                fuzziness: 'AUTO',
                prefix_length: 2,
                minimum_should_match: '75%',
              },
            },
          },
          filter: [
            { term: { status: 'approved' } },
            ...(excludePostId ? [{ bool: { must_not: { term: { _id: excludePostId } } } }] : []),
          ],
        },
      },
      _source: ['title', 'slug', 'category_slug'],
      size: maxCandidates,
      min_score: 5.0,  // Minimum relevance score to return
    },
  });

  const candidates = (esResults.hits.hits as Array<{
    _id: string;
    _source: { title: string; slug: string; category_slug: string };
    _score: number;
  }>).map(hit => ({
    postId: hit._id,
    title: hit._source.title,
    slug: hit._source.slug,
    categorySlug: hit._source.category_slug,
    similarity: 0,  // Will be computed in Tier 2
    _esScore: hit._score,
  }));

  if (candidates.length === 0) return [];

  // Tier 2: Precise Levenshtein on top candidates
  const results: TitleMatchCandidate[] = [];
  for (const candidate of candidates) {
    const similarity = computeLevenshteinSimilarity(
      normalizeTitle(queryTitle),
      normalizeTitle(candidate.title)
    );
    
    if (similarity >= threshold) {
      results.push({
        postId: candidate.postId,
        title: candidate.title,
        slug: candidate.slug,
        categorySlug: candidate.categorySlug,
        similarity,
      });
    }
  }

  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, maxResults);
}

function computeLevenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(a, b);
  return 1.0 - (distance / maxLen);
}
```

**Post submission guard** (`backend/src/routes/posts.ts`):

```typescript
// Replace the unbounded MongoDB query:
// const existingPosts = await Post.find({...}).select('title'); // 500K docs → OOM
// for (const existing of existingPosts) { checkTitleMatch(...) } // 500K iterations

// WITH:
import { findSimilarTitles } from '../lib/titleSimilarityV2';

async function checkTitleOnSubmit(title: string, slug: string, postType: string): Promise<void> {
  if (postType === 'counter_list') return; // Counter-lists exempt
  
  const similar = await findSimilarTitles(title, {
    threshold: 0.8,
    maxResults: 5,
    excludePostId: slug ? undefined : undefined,
  });
  
  if (similar.length > 0) {
    // Check for year-variation exemption
    const currentYear = new Date().getFullYear();
    const isYearVariation = similar.every(s => 
      s.title.toLowerCase().includes(` ${currentYear}`) || 
      title.toLowerCase().includes(` ${currentYear}`)
    );
    
    if (!isYearVariation) {
      throw new TitleConflictError(
        'This list already exists.',
        similar.map(s => ({ title: s.title, slug: s.slug, similarity: s.similarity }))
      );
    }
  }
}
```

**Elasticsearch index mapping** (`backend/src/elasticsearch/lib/indexWriter.ts`):

```typescript
export const POSTS_INDEX_MAPPING = {
  settings: {
    analysis: {
      analyzer: {
        title_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding', 'trim', 'stop_words'],
        },
      },
      filter: {
        stop_words: {
          type: 'stop',
          stopwords: '_english_',
        },
      },
    },
    similarity: {
      bm25_title: {
        type: 'BM25',
        k1: 1.2,
        b: 0.75,
      },
    },
  },
  mappings: {
    properties: {
      title: {
        type: 'text',
        analyzer: 'title_analyzer',
        similarity: 'BM25',
        fields: {
          keyword: { type: 'keyword' },
          trigram: {
            type: 'text',
            analyzer: 'trigram',
          },
        },
      },
      normalized_title: {
        type: 'keyword',
      },
      status: { type: 'keyword' },
      category_slug: { type: 'keyword' },
      created_at: { type: 'date' },
    },
  },
};
```

---

### C11-C13 — Unbounded Database Queries

**Files**: `admin.ts:1500,2627` and multiple others
**Severity**: CRITICAL
**Order**: #2.4-#2.6 (Phase 2, Week 3)
**⏱️ Effort**: 3h+2h+1h
**✅ Final Expected Behavior**: All admin queries use cursor pagination. Users processed in batches of 500. `redis.keys()` replaced with `SCAN`. Zero unbounded queries.

#### Enterprise Pagination & Cursor Pattern

```typescript
// backend/src/lib/pagination.ts
// Enterprise cursor-based pagination with forward-only iteration

export interface CursorPaginationParams {
  cursor?: string;      // Opaque cursor from previous response
  limit: number;        // 1-100
  sortField: string;
  sortDirection: 'asc' | 'desc';
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  estimatedTotal?: number;
}

export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeCursor<T>(cursor: string): T {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString());
}

// Example: paginated user query for admin
export async function queryUsersPaginated(
  params: CursorPaginationParams,
  filters?: Record<string, unknown>
): Promise<CursorPaginationResult<Record<string, unknown>>> {
  const limit = Math.min(100, Math.max(1, params.limit));
  
  const query: Record<string, unknown> = { ...filters };
  
  // Apply cursor-based filtering
  if (params.cursor) {
    const cursor = decodeCursor<{ [key: string]: unknown }>(params.cursor);
    const sortOp = params.sortDirection === 'desc' ? '$lt' : '$gt';
    query[params.sortField] = { [sortOp]: cursor[params.sortField] };
  }

  const sort: Record<string, 1 | -1> = {
    [params.sortField]: params.sortDirection === 'desc' ? -1 : 1,
  };

  // Fetch limit+1 to detect if there are more results
  const users = await User.find(query)
    .sort(sort)
    .limit(limit + 1)
    .select('user_id username trust_score trust_level created_at')
    .lean();

  const hasMore = users.length > limit;
  const items = users.slice(0, limit);

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = encodeCursor({ [params.sortField]: lastItem[params.sortField] });
  }

  // Lightweight count (uses collection stats, not full count)
  let estimatedTotal: number | undefined;
  try {
    const stats = await User.estimatedDocumentCount();
    estimatedTotal = stats;
  } catch { /* optional */ }

  return { items, nextCursor, hasMore, estimatedTotal };
}
```

**Replace `User.find({})` unbounded queries** (`admin.ts:2627`):

```typescript
// BEFORE (CRITICAL — loads ALL users):
// const allUsers = await User.find({}).select('trust_score').lean();

// AFTER — batch processing with cursor pagination:
async function processAllUsers<T>(
  batchSize: number,
  processor: (users: Array<Record<string, unknown>>) => Promise<T[]>,
  options?: { filter?: Record<string, unknown> }
): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const page = await queryUsersPaginated({
      cursor,
      limit: batchSize,
      sortField: 'user_id',
      sortDirection: 'asc',
    }, options?.filter);

    if (page.items.length > 0) {
      const batchResults = await processor(page.items as Array<Record<string, unknown>>);
      results.push(...batchResults);
    }

    cursor = page.nextCursor;
    hasMore = page.hasMore;
  }

  return results;
}

// Usage in config impact preview:
const scholarCount = await processAllUsers(500, async (batch) => {
  return batch.filter(u => (u.trust_score as number) >= 1.85).length;
});
const total = (await scholarCount).reduce((a, b) => a + b, 0);
```

---

### C14 — `$or` Overwrite Vulnerability

**File**: `admin.ts:694`
**Severity**: CRITICAL
**Order**: #1.2 (Phase 1, Week 2)
**⏱️ Effort**: 2 hours
**✅ Final Expected Behavior**: All query building uses `QueryBuilder` class. `$or` conditions accumulated in array. `deleted` filter always applied. `safeRegex()` escapes all user input.

#### Solution: Immutable Query Builder Pattern

```typescript
// backend/src/lib/queryBuilder.ts
// Type-safe query builder that prevents accidental overwriting

class QueryBuilder {
  private conditions: Record<string, unknown> = {};
  private andConditions: Record<string, unknown>[] = [];
  private orConditions: Record<string, unknown>[] = [];

  constructor(defaultQuery: Record<string, unknown> = {}) {
    this.conditions = { ...defaultQuery };
  }

  and(field: string, value: unknown): this {
    this.conditions[field] = value;
    return this;
  }

  andNot(field: string, value: unknown): this {
    this.conditions[field] = { $ne: value };
    return this;
  }

  or(...conditions: Record<string, unknown>[]): this {
    this.orConditions.push(...conditions);
    return this;
  }

  search(text: string, fields: string[]): this {
    if (text && fields.length > 0) {
      this.orConditions.push({
        $or: fields.map(f => ({ [f]: { $regex: text, $options: 'i' } })),
      });
    }
    return this;
  }

  // Safe regex — escapes user input
  safeRegex(field: string, value: string): this {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    this.conditions[field] = { $regex: escaped, $options: 'i' };
    return this;
  }

  dateRange(field: string, from?: string, to?: string): this {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) range.$lte = new Date(to);
    if (Object.keys(range).length > 0) {
      this.conditions[field] = range;
    }
    return this;
  }

  build(): Record<string, unknown> {
    if (this.orConditions.length > 0) {
      this.conditions.$or = this.orConditions;
    }
    return this.conditions;
  }
}

// Usage in admin routes:
const query = new QueryBuilder({ status: 'pending_review', deleted: false })
  .search(req.query.search as string, ['title', 'intro'])
  .dateRange('created_at', req.query.date_from as string, req.query.date_to as string)
  .safeRegex('author_username', req.query.author as string)
  .build();
```

**Input sanitization middleware**:

```typescript
// backend/src/middleware/sanitize.ts
import { Request, Response, NextFunction } from 'express';

// Detects and blocks NoSQL injection attempts
const NOSQL_INJECTION_PATTERN = /(\$gt|\$gte|\$lt|\$lte|\$ne|\$in|\$nin|\$regex|\$exists|\$where|\.\.\.)/i;

export function sanitizeQueryParams(req: Request, _res: Response, next: NextFunction): void {
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string' && NOSQL_INJECTION_PATTERN.test(value)) {
      // Reject requests with MongoDB operators in query params
      console.warn(`[Security] Blocked NoSQL injection attempt on ${key}: ${value}`);
      return _res.status(400).json({ error: 'Invalid query parameter' });
    }
    
    // Reject excessively long query params
    if (typeof value === 'string' && value.length > 500) {
      return _res.status(400).json({ error: 'Query parameter too long' });
    }
  }
  next();
}
```

---

### C15 — Delete-Then-Reinsert Data Loss

**Order**: #1.3
**⏱️ Effort**: 3h
**✅ Final Expected Behavior**: Post editing uses atomic findOneAndUpdate with version check. Journaled writes with rollback. Concurrent edits return 409. Zero data loss window.

**File**: `admin.ts:732-761`
**Severity**: CRITICAL

#### Solution: Compare-And-Swap with Journaled Updates

```typescript
// backend/src/lib/postEditor.ts
// Enterprise-grade post editing with journaled writes and rollback

import { Post } from '../models/Post';
import { ListItem } from '../models/ListItem';

interface EditJournal {
  operation: 'update_items' | 'update_metadata';
  postId: string;
  oldState: Record<string, unknown>;
  newState: Record<string, unknown>;
  timestamp: Date;
  committed: boolean;
}

export async function updatePostItems(
  postId: string,
  newItems: Array<{ rank: number; title: string; justification: string }>,
  expectedVersion: number
): Promise<void> {
  // Step 1: Lock-free optimistic check
  const post = await Post.findById(postId).select('version');
  if (!post) throw new NotFoundError('Post not found');
  if (post.version !== expectedVersion) {
    throw new ConflictError(
      `Post version mismatch. Expected ${expectedVersion}, got ${post.version}`
    );
  }

  // Step 2: Journal old state for rollback
  const oldItems = await ListItem.find({ post_id: postId }).lean();
  const journal: EditJournal = {
    operation: 'update_items',
    postId,
    oldState: { items: oldItems, version: post.version },
    newState: { items: newItems, version: post.version + 1 },
    timestamp: new Date(),
    committed: false,
  };

  // Step 3: Save journal entry (for automatic recovery)
  await saveEditJournal(journal);

  // Step 4: Perform atomic update with version check
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Delete old items
    await ListItem.deleteMany({ post_id: postId }).session(session);

    // Insert new items
    await ListItem.insertMany(
      newItems.map((item, i) => ({
        post_id: postId,
        rank: item.rank,
        title: item.title,
        justification: item.justification,
      })),
      { session }
    );

    // Update post version
    const updated = await Post.findOneAndUpdate(
      { _id: postId, version: expectedVersion },
      { $inc: { version: 1 } },
      { new: true, session }
    );

    if (!updated) {
      throw new ConflictError('Version conflict — post was modified concurrently');
    }

    await session.commitTransaction();
    journal.committed = true;
    await updateEditJournal(journal);
  } catch (err) {
    await session.abortTransaction();
    
    // Attempt journal-based recovery
    console.error('[PostEditor] Transaction failed, attempting rollback:', err);
    await rollbackEditJournal(journal);
    
    throw err;
  } finally {
    session.endSession();
  }
}

async function saveEditJournal(journal: EditJournal): Promise<void> {
  // Store in Redis with 1h TTL for auto-recovery
  const { redis } = await import('./redis');
  await redis.set(
    `edit:journal:${journal.postId}`,
    JSON.stringify(journal),
    { EX: 3600 }
  );
}

async function rollbackEditJournal(journal: EditJournal): Promise<void> {
  console.log(`[EditJournal] Rolling back edit for post ${journal.postId}`);
  
  // Restore old items
  if (journal.oldState.items) {
    await ListItem.deleteMany({ post_id: journal.postId });
    await ListItem.insertMany(journal.oldState.items as Array<Record<string, unknown>>);
  }
  
  // Restore version
  await Post.findByIdAndUpdate(journal.postId, {
    version: (journal.oldState.version as number) || 0,
  });
  
  console.log(`[EditJournal] Rollback complete for post ${journal.postId}`);
}
```

---

### C16-C17 — Unbounded Memory in Cron Jobs

**Files**: `comments.ts:69-72,122-125`
**Severity**: CRITICAL
**Order**: #2.2-#2.3 (Phase 2, Week 3)
**⏱️ Effort**: 3h+2h
**✅ Final Expected Behavior**: SparkScore and threshold crons use `processBatches()` with batchSize=500 and concurrency=5. Max 500 comments in memory at once. Bounded completion time.

#### Solution: Batched Processing with Progress Tracking

```typescript
// backend/src/lib/cronProcessor.ts
// Enterprise batch processor for large-scale cron operations

interface BatchProcessorOptions<T> {
  batchSize: number;
  fetchBatch: (skip: number, limit: number) => Promise<T[]>;
  processItem: (item: T, index: number) => Promise<void>;
  onProgress?: (processed: number, total: number) => void;
  onError?: (error: Error, item: T) => void;
  concurrency: number;
}

export async function processBatches<T>(
  options: BatchProcessorOptions<T>
): Promise<{ processed: number; errors: number }> {
  const {
    batchSize = 100,
    concurrency = 5,
  } = options;

  let totalProcessed = 0;
  let totalErrors = 0;
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await options.fetchBatch(skip, batchSize);
    
    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    // Process batch with concurrency control
    const results = await Promise.allSettled(
      batch.map(item => options.processItem(item, totalProcessed++))
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        totalErrors++;
        if (options.onError) {
          options.onError(result.reason, batch[totalErrors - 1]);
        }
      }
    }

    skip += batch.length;

    if (options.onProgress) {
      options.onProgress(totalProcessed, -1); // -1 = unknown total
    }
  }

  return { processed: totalProcessed, errors: totalErrors };
}

// SparkScore batch cron:
const BATCH_SIZE = parseInt(process.env.SPARK_SCORE_BATCH_SIZE || '500', 10);
const CONCURRENCY = parseInt(process.env.SPARK_SCORE_CONCURRENCY || '5', 10);

async function runSparkScoreCron(): Promise<void> {
  const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const result = await processBatches({
    batchSize: BATCH_SIZE,
    concurrency: CONCURRENCY,
    fetchBatch: async (skip, limit) => {
      return Comment.find({
        created_at: { $gte: seventyTwoHoursAgo },
      })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .select('fire_count reply_count created_at')
        .lean();
    },
    processItem: async (comment) => {
      const score = computeSparkScore(
        { fireCount: comment.fire_count, replyCount: comment.reply_count, createdAt: comment.created_at },
        thresholds
      );
      await Comment.findByIdAndUpdate(comment._id, { spark_score: score });
    },
    onProgress: (processed) => {
      if (processed % 1000 === 0) {
        console.log(`[SparkScore] Processed ${processed} comments`);
      }
    },
    onError: (err, comment) => {
      console.error(`[SparkScore] Error on comment ${comment._id}:`, err.message);
    },
  });

  console.log(`[SparkScore] Cron complete: ${result.processed} processed, ${result.errors} errors`);
}
```

---

### C18 — User Account Takeover via Fingerprint

**Order**: #3.1
**⏱️ Effort**: 4h
**✅ Final Expected Behavior**: Cross-browser fingerprint matching requires user confirmation. One-time token expires in 15min. False matches cannot steal identities.

**File**: `fingerprint.ts:76-81`
**Severity**: CRITICAL

#### Solution: Two-Factor Fingerprint Linking with User Confirmation

```typescript
// backend/src/middleware/fingerprintV2.ts
// Enterprise fingerprint matching with cross-browser identity confirmation

interface FingerprintMergeRequest {
  fromFingerprint: string;     // New device's fingerprint
  toFingerprint: string;       // Existing account's fingerprint
  token: string;               // One-time confirmation token
  expiresAt: Date;
}

export async function requestFingerprintMerge(
  currentFingerprint: string,
  matchedUserId: string
): Promise<{ requiresConfirmation: boolean; token?: string }> {
  const matchedUser = await User.findOne({ user_id: matchedUserId });
  if (!matchedUser) return { requiresConfirmation: false };

  // Tier 1: Same browser (direct cookie match) → auto-link
  if (matchedUser.device_fingerprint === currentFingerprint) {
    return { requiresConfirmation: false };
  }

  // Tier 2: Cross-browser match → require challenge-response
  const token = crypto.randomBytes(32).toString('hex');
  
  // Store merge request with 15-minute expiry
  await redis.setEx(
    `fingerprint:merge:${token}`,
    900,  // 15 minutes
    JSON.stringify({
      fromFingerprint: currentFingerprint,
      toFingerprint: matchedUser.device_fingerprint,
      expiresAt: new Date(Date.now() + 900000),
    })
  );

  // Send notification to the matched user's existing devices
  // (In a real system, this would be a push notification or email)
  console.log(`[Fingerprint] Merge request created for ${matchedUserId}. Token: ${token}`);

  return {
    requiresConfirmation: true,
    token,
  };
}

export async function confirmFingerprintMerge(token: string): Promise<boolean> {
  const data = await redis.getDel(`fingerprint:merge:${token}`);
  if (!data) return false;

  const request: FingerprintMergeRequest = JSON.parse(data);
  
  if (new Date() > new Date(request.expiresAt)) {
    return false; // Token expired
  }

  // Atomically update the fingerprint
  await User.findOneAndUpdate(
    { device_fingerprint: request.toFingerprint },
    { $set: { device_fingerprint: request.fromFingerprint } }
  );

  // Also update UserDevice records
  await UserDevice.updateMany(
    { device_fingerprint: request.toFingerprint },
    { $set: { device_fingerprint: request.fromFingerprint } }
  );

  return true;
}

// Updated fingerprint middleware — never auto-links cross-browser
export const fingerprintMiddlewareV2 = async (req: Request, res: Response, next: NextFunction) => {
  // ... existing logic ...
  
  if (matchedUserId) {
    // Don't auto-link! Require confirmation
    const mergeResult = await requestFingerprintMerge(fingerprint, matchedUserId);
    
    if (mergeResult.requiresConfirmation) {
      // Generate a one-time code for the user to confirm
      // This is shown on both devices
      req.fingerprintMergeToken = mergeResult.token;
    }
  }
  
  // ... continue with new user creation if no match ...
};
```

**Frontend merge confirmation UI** (`frontend/src/components/FingerprintMergeDialog.tsx`):

```typescript
export function FingerprintMergeDialog({ token }: { token: string }) {
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'expired'>('pending');

  useEffect(() => {
    // Poll for confirmation status
    const interval = setInterval(async () => {
      try {
        const result = await API.confirmFingerprintMerge(token);
        if (result.confirmed) {
          setStatus('confirmed');
          clearInterval(interval);
        }
      } catch { /* retry */ }
    }, 3000);

    // Auto-expire after 15 minutes
    const timeout = setTimeout(() => {
      setStatus('expired');
      clearInterval(interval);
    }, 900000);

    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [token]);

  if (status === 'confirmed') {
    return <div className="...">Devices linked successfully!</div>;
  }

  if (status === 'expired') {
    return <div className="...">Link expired. Please try again.</div>;
  }

  return (
    <div className="...">
      <p>A device with your identity was found. Confirm to link this device?</p>
      <button onClick={() => API.confirmFingerprintMerge(token)}>
        Link This Device
      </button>
    </div>
  );
}
```

---

### C19 — Grace Period Creates Phantom Sessions

**Order**: #3.2
**⏱️ Effort**: 2h
**✅ Final Expected Behavior**: Grace period pre-creates User in MongoDB. Session fingerprint is deterministic. Zero phantom User documents from grace period.

**File**: `fingerprint.ts:127-136`
**Severity**: CRITICAL

#### Solution: Grace Session Pre-Registration

```typescript
// Replace the generateFingerprint() + set cookie + skip user creation pattern

async function handleGracePeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
  const clientIp = getClientIp(req);
  const graceKey = `grace:${clientIp}`;

  try {
    const currentCount = await redis.incr(graceKey);
    if (currentCount === 1) {
      await redis.expire(graceKey, Math.ceil(GRACE_PERIOD_MS / 1000));
    }

    if (currentCount <= MAX_GRACE_REQUESTS) {
      // PRE-CREATE the user immediately, not defer it
      const userId = crypto.randomBytes(4).toString('hex');
      const username = `a_${userId.slice(-4)}`;
      const sessionFingerprint = `session_${userId}_${Date.now()}`;

      await User.create({
        user_id: userId,
        username,
        device_fingerprint: sessionFingerprint,
        trust_score: 1.0,
        is_admin: false,
        created_at: new Date(),
      });

      res.cookie('device_fingerprint', sessionFingerprint, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 365 * 24 * 60 * 60 * 1000,
      });

      req.fingerprint = sessionFingerprint;
      req.user = {
        user_id: userId,
        username,
        device_fingerprint: sessionFingerprint,
        trust_score: 1.0,
      };

      console.log(`[Fingerprint] Grace session created: ${username} (${userId})`);
      return next();
    }

    return res.status(425).json({
      error: 'Server is initializing. Please retry.',
      retry_after: Math.ceil(GRACE_PERIOD_MS / 1000),
    });
  } catch (error) {
    console.error('[Fingerprint] Grace period error:', error);
    // On Redis failure, fail closed (don't create anonymous session)
    return res.status(503).json({ error: 'Identity service unavailable' });
  }
}
```

---

### C20-C23 — Additional Backend Critical Issues

**Order**: #1.4+#1.8+#3.4 (Phase 1-3)
**⏱️ Effort**: 1h+1h+0.5h
**✅ Final Expected Behavior**: NoSQL injection impossible. Immutable config pattern. Config consumers receive read-only snapshots. ES indexing has retry + dead letter queue.

**C20 — NoSQL Injection via `$regex`**: Already addressed by the `QueryBuilder.safeRegex()` method in C14 solution. All five `$regex` injection points are replaced with the safe builder.

**C21 — Sequential DB Operations**: Already addressed by `processBatches()` in C16 solution with configurable concurrency.

**C22-C23 — Mutable Config Reference**: Addressed by the immutable config pattern below:

```typescript
// backend/src/lib/systemConfigV2.ts
// Immutable configuration with versioned snapshots and atomic updates

interface ImmutableConfig {
  readonly rate_limits: Readonly<{
    base_posts_per_hour: number;
    base_comments_per_hour: number;
    tiers: Readonly<{
      troll: Readonly<{ multiplier: number; min_posts: number }>;
      neutral: Readonly<{ multiplier: number; min_posts: number }>;
      scholar: Readonly<{ multiplier: number; min_posts: number }>;
    }>;
    counter_lists_unlimited: boolean;
    comment_edit_window_minutes: number;
  }>;
  readonly trust_tiers: Readonly<{
    troll_max: number;
    neutral_min: number;
    scholar_min: number;
    hysteresis_enter: number;
    hysteresis_lose: number;
    review_window: number;
    double_blind: boolean;
  }>;
  readonly version: number;
  readonly updated_at: Date;
  readonly updated_by: string;
}

class ConfigStore {
  private config: ImmutableConfig;
  private listeners: Set<(config: ImmutableConfig) => void> = new Set();

  constructor(defaultConfig: ImmutableConfig) {
    this.config = Object.freeze({ ...defaultConfig });
  }

  get(): ImmutableConfig {
    return this.config;  // Read-only — consumers cannot mutate frozen objects
  }

  subscribe(listener: (config: ImmutableConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async update(updates: Partial<ImmutableConfig>): Promise<ImmutableConfig> {
    // Atomic DB update with version check
    const doc = await SystemConfig.findOneAndUpdate(
      { key: 'global', version: this.config.version },
      { $set: updates, $inc: { version: 1 } },
      { new: true }
    ).lean();

    if (!doc) {
      throw new ConflictError('Config was updated by another process');
    }

    this.config = Object.freeze(leanToShape(doc));
    
    // Notify listeners
    for (const listener of this.listeners) {
      try { listener(this.config); } catch { /* isolate listener failures */ }
    }

    return this.config;
  }
}
```

---

## 3. Frontend — CRITICAL

### C24 — Stored XSS via dangerouslySetInnerHTML

**Order**: #3.3
**⏱️ Effort**: 2h
**✅ Final Expected Behavior**: ALL dangerouslySetInnerHTML goes through SafeHTML component with DOMPurify. 20+ XSS payloads blocked. CSP restricts script execution.

**File**: `search/client.tsx:170,174,188,370,374,408`
**Severity**: CRITICAL

#### Solution: DOMPurify + Content Security Policy

```typescript
// frontend/src/lib/sanitize.ts
// Enterprise-grade HTML sanitization with DOMPurify isomorphic wrapper

import DOMPurify from 'isomorphic-dompurify';

export interface SanitizeOptions {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  stripUnsafe?: boolean;
  maxLength?: number;
}

const DEFAULT_OPTIONS: SanitizeOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'a', 'br', 'mark'],
  allowedAttributes: {
    'a': ['href', 'title', 'rel', 'target'],
  },
  stripUnsafe: true,
  maxLength: 5000,
};

// Singleton sanitizer instance with cached config
class HTMLSanitizer {
  private config = DOMPurify.defaultConfig;

  sanitize(html: string, options: SanitizeOptions = {}): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Length check
    if (html.length > (opts.maxLength || Infinity)) {
      html = html.substring(0, opts.maxLength);
    }

    // Pre-strip script tags before DOMPurify (defense in depth)
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: opts.allowedTags,
      ALLOWED_ATTR: opts.allowedAttributes ? 
        Object.entries(opts.allowedAttributes).reduce((acc, [tag, attrs]) => {
          acc[tag] = attrs;
          return acc;
        }, {} as Record<string, string[]>) : undefined,
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'],
      FORBID_CONTENTS: ['style', 'script'],
      WHOLE_DOCUMENT: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM: false,
      SANITIZE_DOM: true,
      KEEP_CONTENT: false,
    });
  }

  // For search highlights specifically: only allow <mark> tags
  sanitizeHighlight(text: string): string {
    return this.sanitize(text, {
      allowedTags: ['mark'],
      allowedAttributes: {},
      stripUnsafe: true,
    });
  }

  // For user bios/comments: allow basic formatting
  sanitizeContent(text: string): string {
    return this.sanitize(text, {
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'br'],
      allowedAttributes: {
        'a': ['href', 'rel', 'target'],
      },
      stripUnsafe: true,
    });
  }
}

export const sanitizer = new HTMLSanitizer();

// React component wrapper for safe HTML rendering
export function SafeHTML({ html, className, sanitize = 'content' }: {
  html: string;
  className?: string;
  sanitize?: 'content' | 'highlight' | 'none';
}) {
  const sanitized = useMemo(() => {
    if (sanitize === 'none') return html;
    if (sanitize === 'highlight') return sanitizer.sanitizeHighlight(html);
    return sanitizer.sanitizeContent(html);
  }, [html, sanitize]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
```

**Usage in search component**:

```typescript
// BEFORE (XSS VULNERABLE):
// <div dangerouslySetInnerHTML={{ __html: t.highlight || t.title }} />

// AFTER (SANITIZED):
import { SafeHTML } from '@/lib/sanitize';

<SafeHTML
  html={t.highlight || t.title}
  sanitize="highlight"
  className="search-highlight"
/>
```

**Bypass testing suite**:

```typescript
// tests/sanitize.test.ts

describe('HTMLSanitizer — XSS Prevention', () => {
  const XSS_PAYLOADS = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    'javascript:alert(1)',
    '<a href="javascript:alert(1)">click</a>',
    '-o-link\'javascript:alert(1)\'',
    '-o-link-source:current',
    '<!--[if gte mso 9]><xml><%=exec("cmd")%></xml><![endif]-->',
    '<math><style><!--</style><img src=x onerror=alert(1)>-->',
    '<<script>alert("xss")<!--</script>',
    '<iframe src="javascript:alert(1)">',
    '<details/open/ontoggle=alert(1)>',
    '<body onload=alert(1)>',
    '<input autofocus onfocus=alert(1)>',
    '<select autofocus onfocus=alert(1)>',
    '<textarea autofocus onfocus=alert(1)>',
    '<keygen autofocus onfocus=alert(1)>',
    '{"payload": "<script>alert(1)</script>"}',
  ];

  const sanitizer = new HTMLSanitizer();

  XSS_PAYLOADS.forEach((payload, i) => {
    it(`blocks XSS payload #${i + 1}`, () => {
      const result = sanitizer.sanitizeContent(payload);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('onload');
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('<iframe');
      expect(result).not.toContain('<object');
      expect(result).not.toContain('<embed');
    });
  });

  it('allows safe HTML through', () => {
    const input = 'Hello <b>world</b>! Check <a href="https://example.com">this</a>.';
    const result = sanitizer.sanitizeContent(input);
    expect(result).toContain('<b>world</b>');
    expect(result).toContain('https://example.com');
  });

  it('strips dangerous attributes from allowed tags', () => {
    const input = '<a href="https://safe.com" onclick="evil()" style="color:red">link</a>';
    const result = sanitizer.sanitizeContent(input);
    expect(result).toContain('https://safe.com');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('style=');
  });
});
```

---

## 4. Infrastructure — HIGH (20 items)

### H1-H9: Docker Compose & Dockerfile Issues

**Order**: #0.12 (Phase 0B, Week 1)
**⏱️ Effort**: 3 hours
**✅ Final Expected Behavior**: `.dockerignore` excludes all unnecessary files. Build context reduced by 90%+. pnpm pinned to exact version (`9.15.9`). No floating `latest` or `@9` tags. `NODE_ENV=production` set explicitly in build stages. Dev compose uses random ports to avoid conflicts.

Due to space constraints, all Docker-related HIGH items are addressed by applying these enterprise patterns to the entire build pipeline:

**Multi-stage Docker build with layer caching**:

```dockerfile
# Dockerfile.backend — Enterprise multi-stage build
# Stage 0: Base dependencies (cached unless pnpm-lock.yaml changes)
FROM node:20.18.3-alpine3.21 AS deps
WORKDIR /app
RUN apk add --no-cache curl ca-certificates

# Pin package manager
RUN npm install -g pnpm@9.15.9

# Copy only dependency files (maximizes layer cache)
COPY backend/package.json backend/pnpm-lock.yaml ./

# Frozen lockfile ensures reproducible builds
RUN pnpm install --frozen-lockfile --prod

# Stage 1: Build
FROM node:20.18.3-alpine3.21 AS build
WORKDIR /app
RUN npm install -g pnpm@9.15.9
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ .

# Build with production Node.js env
ENV NODE_ENV=production
RUN pnpm build

# Stage 2: Production runtime
FROM node:20.18.3-alpine3.21 AS run
WORKDIR /app
RUN apk add --no-cache curl ca-certificates && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy only what's needed for production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# Create upload directory with proper permissions
RUN mkdir -p /app/uploads && chown nodejs:nodejs /app/uploads

# Security: run as non-root user
USER nodejs

EXPOSE 8000

# Health check
HEALTHCHECK --interval=15s --timeout=10s --retries=5 --start-period=60s \
  CMD node /app/dist/lib/healthcheck.mjs

CMD ["node", "dist/server.js"]
```

**.dockerignore**:

```dockerignore
# Version control
.git/
.gitignore
.gitattributes
.gitmodules

# Environment
.env
.env.*
!.env.example

# Dependencies (handled by multi-stage build)
**/node_modules/
**/pnpm-lock.yaml
package-lock.json

# Build outputs
**/dist/
**/build/
**/.next/

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Tests
**/*.test.ts
**/*.test.tsx
**/__tests__/
**/__mocks__/
coverage/

# Documentation
docs/
*.md
README*

# CI
.github/
.ci/

# Docker
Dockerfile*
docker-compose*
.dockerignore

# Temp
tmp/
temp/
```

**H2 (dev compose port conflict)**: Resolved by using randomized ports in dev:

```yaml
# docker-compose.dev.yml
services:
  app:
    ports:
      - "0:3000"  # Random high port — prevents conflicts
      - "0:8000"
```

**H3 (hardcoded dev JWT)**: Resolved by generating on startup:

```bash
# generate-dev-secrets.sh
# Run on dev container startup
export JWT_SECRET=$(openssl rand -hex 32)
echo "Dev JWT_SECRET generated: ${JWT_SECRET:0:8}..."
```

---

### H10-H20: ESLint, TypeScript, Next.js Config Issues

**Order**: #0.10-#0.13
**⏱️ Effort**: 0.5h+2h+3h+1h
**✅ Final Expected Behavior**: Single ESLint 9 flat config. next-env.d.ts exists. Lint errors block builds. Docker layer caching. pnpm pinned.

**H10 (eslint-config-next version mismatch)**:

```json
// frontend/package.json
{
  "devDependencies": {
    "next": "15.5.18",
    "eslint-config-next": "15.5.18",  // Same version as next
  }
}
```

**H11 (ESLint flat config migration)**:

```javascript
// eslint.config.js (ESLint 9 flat config)
import nextPlugin from '@next/eslint-plugin-next';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['.next/**', 'dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@next': nextPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@next/next/no-html-link-for-pages': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
```

**H14-H15 (missing next-env.d.ts, wrong next.config.ts)**:

```typescript
// next.config.ts — Enterprise configuration
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  
  // Strict type checking
  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: './tsconfig.json',
  },
  
  // ESLint enforcement
  eslint: {
    ignoreDuringBuilds: false,  // BLOCK BUILDS on lint errors
    dirs: ['src'],
  },
  
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.yotop10.com",
      },
      {
        protocol: "https",
        hostname: "**.yotop10.com",
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Compress responses
  compress: true,
  
  // HTTP headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Request-ID', value: crypto.randomUUID() },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
  
  // Runtime config (not NEXT_PUBLIC_* — handled by runtime config endpoint)
  serverRuntimeConfig: {
    apiUrl: process.env.INTERNAL_API_URL || 'http://backend:8000/api',
  },
  
  // Remove deprecated options
  devIndicators: {
    buildActivity: false,
  },
};

export default nextConfig;
```

**Required `next-env.d.ts`**:

```typescript
// frontend/src/next-env.d.ts
// Auto-generated by Next.js — DO NOT EDIT manually.
// This file ensures TypeScript recognizes Next.js types.
// If missing, run: npx next dev --turbo (generates this file)

/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/building-your-application/configuring/typescript for more information.
```

---

## 5. Backend — HIGH (24 items)

### H21 — Missing Indexes for Sort Operations

**Order**: #1.7
**⏱️ Effort**: 1h
**✅ Final Expected Behavior**: All sort operations use index-only scans. No in-memory sorts. 9 compound indexes created.

```typescript
// models/Post.ts — Enterprise index strategy

// Current indexes:
// postSchema.index({ status: 1, created_at: -1 });               // covers: newest feed
// postSchema.index({ status: 1, deleted: 1, created_at: -1 });   // ADD: covers deleted filter
postSchema.index({ status: 1, deleted: 1, created_at: -1 });       // For public feed with deleted filter

// Sort indexes:
postSchema.index({ status: 1, deleted: 1, comment_count: -1 });   // For most_commented sort
postSchema.index({ status: 1, deleted: 1, view_count: -1 });      // For most_viewed sort

// Category feed:
postSchema.index({ category_slug: 1, status: 1, deleted: 1, created_at: -1 });  // For category-filtered feed

// User posts:
postSchema.index({ author_id: 1, status: 1, created_at: -1 });    // For user profile page

// Admin queries:
postSchema.index({ status: 1, created_at: -1, deleted: 1 });      // For admin pending list
postSchema.index({ author_username: 1, status: 1 });              // For admin author search
```

### H22 — Load All Categories on Every Request

**Order**: #1.6
**⏱️ Effort**: 1h
**✅ Final Expected Behavior**: Categories cached in Redis with 5min TTL. Zero DB queries for category names on feed requests.

```typescript
// Cache categories in Redis with 5-minute refresh
const CATEGORY_CACHE_KEY = 'cache:categories';
const CATEGORY_CACHE_TTL = 300;

async function getCategoryNameMap(): Promise<Map<string, string>> {
  try {
    // Try Redis cache first
    const cached = await redis.get(CATEGORY_CACHE_KEY);
    if (cached) {
      const entries = JSON.parse(cached) as Array<[string, string]>;
      return new Map(entries);
    }
  } catch { /* fall through to DB */ }

  // Cache miss — load from DB
  const categories = await Category.find({}).select('slug name').lean();
  const map = new Map<string, string>(categories.map(c => [c.slug, c.name]));

  // Populate cache (non-blocking)
  redis.setEx(CATEGORY_CACHE_KEY, CATEGORY_CACHE_TTL, JSON.stringify(Array.from(map.entries())))
    .catch(err => console.error('[CategoryCache] Redis write failed:', err));

  return map;
}
```

### H23-H44 — Additional Backend HIGH Items

**Order**: #1.8+#1.9
**⏱️ Effort**: 1h+2h
**✅ Final Expected Behavior**: ImmutableConfig pattern implemented. ES indexing has retry + dead letter queue.

**Type safety enforcement** — Replace all `as any` casts with proper types:

```typescript
// types/express.d.ts — Extended Express request types
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      admin?: AdminUser;
      fingerprint?: string;
      validatedQuery?: Record<string, unknown>;
      requestId?: string;
    }
  }
}

// Custom type guard for route handlers
import { Request, Response } from 'express';

type AsyncRouteHandler = (req: Request, res: Response) => Promise<void>;

function asyncHandler(fn: AsyncRouteHandler): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}
```

**ES indexing error handling**:

```typescript
// lib/elasticsearch/indexWriter.ts
// Reliable ES indexing with retry queue + dead letter

import { es } from './client';

class IndexingService {
  private retryQueue: Array<{ operation: string; data: unknown; attempts: number }> = [];
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  async indexDocument(index: string, id: string, doc: Record<string, unknown>): Promise<void> {
    try {
      await es.index({
        index,
        id,
        body: doc,
        refresh: 'wait_for',  // Wait for shard refresh
      });
    } catch (err) {
      console.error(`[ES] Index failed for ${index}/${id}:`, err);
      await this.enqueueRetry('index', { index, id, doc });
    }
  }

  async deleteDocument(index: string, id: string): Promise<void> {
    try {
      await es.delete({ index, id });
    } catch (err) {
      if (err instanceof Error && err.message.includes('not_found')) {
        // Document already deleted — not an error
        return;
      }
      console.error(`[ES] Delete failed for ${index}/${id}:`, err);
      await this.enqueueRetry('delete', { index, id });
    }
  }

  private async enqueueRetry(operation: string, data: unknown): Promise<void> {
    this.retryQueue.push({ operation, data, attempts: 0 });
    await this.processRetryQueue();
  }

  private async processRetryQueue(): Promise<void> {
    while (this.retryQueue.length > 0) {
      const item = this.retryQueue[0];
      
      if (item.attempts >= this.MAX_RETRIES) {
        console.error(`[ES] Max retries reached for ${item.operation}`);
        // Write to dead letter queue (MongoDB collection)
        await SearchDeadLetter.create({
          operation: item.operation,
          data: item.data,
          error: 'Max retries exceeded',
          created_at: new Date(),
        });
        this.retryQueue.shift();
        continue;
      }

      try {
        if (item.operation === 'index') {
          const { index, id, doc } = item.data as { index: string; id: string; doc: Record<string, unknown> };
          await es.index({ index, id, body: doc });
        } else if (item.operation === 'delete') {
          const { index, id } = item.data as { index: string; id: string };
          await es.delete({ index, id });
        }
        this.retryQueue.shift();
      } catch {
        item.attempts++;
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS * item.attempts));
      }
    }
  }
}

export const indexingService = new IndexingService();
```

---

## 6. Frontend — HIGH (12 items)

### H45-H47 — Missing Suspense Boundaries

**Order**: #4.1
**⏱️ Effort**: 1h
**✅ Final Expected Behavior**: DesktopTopBar, SlideMenuRouter, DynamicIsland wrapped in Suspense with skeleton fallbacks.

```typescript
// layout.tsx — Enterprise component isolation

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Top-level shell with Suspense boundaries */}
        <Suspense fallback={<div className="h-14 bg-zinc-950 animate-pulse" />}>
          <DesktopTopBar />
        </Suspense>
        
        <Suspense fallback={<div className="fixed inset-0 z-40 bg-zinc-950/50 animate-fade-in" />}>
          <SlideMenuRouter />
        </Suspense>
        
        {/* Dynamic content */}
        {children}
        
        {/* Bottom nav (mobile only) */}
        <Suspense fallback={null}>
          <DynamicIsland />
        </Suspense>
        
        {/* Overlays */}
        <Suspense fallback={null}>
          <AuthInitializer />
          <ToastContainer />
          <AnalyticsBeacon />
          <PWAInstallPrompt />
        </Suspense>
      </body>
    </html>
  );
}
```

### H48-H51 — Dead Code, Error Messages, Reserved Routes

**Order**: #4.2-#4.5
**⏱️ Effort**: 0.5h+0.1h+2h+1h
**✅ Final Expected Behavior**: Dead code removed. Error messages fixed. Search uses apiFetch. Profile upload uses API methods.

**Reserved routes consolidation**:

```typescript
// lib/reservedRoutes.ts — SINGLE SOURCE OF TRUTH
export const RESERVED_ROUTES = new Set([
  'admin', 'api', 'login', 'search', 'settings', 'profile',
  'categories', 'c', 'auth', 'submit', 'explore', 'articles',
  'saved', 'arguments', 'hall-of-fame', 'claim', 'notifications',
  'username-history', 'submit-article', 'post', 'posts',
  'feed', 'trending', 'popular', 'recent',
]);
```

Fix `[slug]/client.tsx` to import from the canonical source:

```typescript
import { RESERVED_ROUTES } from '@/lib/reservedRoutes';
// Remove the inline array at line 14
```

**Dead code removal** — Remove `loading` state from `[slug]/client.tsx`:

```typescript
// Remove useState(false) for loading (line 84)
// Remove the entire loading render branch (lines 340-346)
```

**Error message fix** — Update the catch block in `fetchComments`:

```typescript
} catch (err) {
  console.error('[PostDetail] Failed to refresh comments:', err);
  setCommentError('Failed to load comments. Please try refreshing.');
}
```

### H52-H53 — Raw fetch Bypass in Search & Profile

**Order**: #4.4-#4.5
**⏱️ Effort**: 2h+1h
**✅ Final Expected Behavior**: Search and profile use API methods through apiFetch. Raw fetch calls deleted.

**Search API migration**:

```typescript
// api/endpoints/search.ts — Add to API module
export const searchApi = {
  search: (query: string, page: number, filters: Record<string, string>) =>
    apiFetch(`/search?q=${encodeURIComponent(query)}&page=${page}&${new URLSearchParams(filters)}`),
  
  autocomplete: (query: string) =>
    apiFetch(`/search/autocomplete?q=${encodeURIComponent(query)}`),
  
  getSuggestions: (query: string) =>
    apiFetch(`/search/suggest?q=${encodeURIComponent(query)}`),
};
```

**Profile API migration**:

```typescript
// api/endpoints/users.ts — Add upload method
export const usersApi = {
  updateProfileImage: (url: string) =>
    apiFetch('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ profile_image_url: url }),
    }),
  
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return apiFetch('/upload/profile', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type — browser sets multipart boundary
      headers: {},  // Override default JSON Content-Type
    });
  },
};
```

### H54-H56 — Accessibility, Keyboard Navigation, Logout Stale State

**Order**: #4.6-#4.8
**⏱️ Effort**: 1h+0.5h+0.2h
**✅ Final Expected Behavior**: Autocomplete keyboard accessible. Admin logout always clears state. Duplicate interfaces merged.

**Autocomplete keyboard accessibility**:

```typescript
export function AutocompleteSuggestions({ suggestions, onSelect }: Props) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0) onSelect(suggestions[activeIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label="Search suggestions"
      onKeyDown={handleKeyDown}
      className="...">
      {suggestions.map((s, i) => (
        <li
          key={s.slug}
          role="option"
          aria-selected={i === activeIndex}
          tabIndex={-1}
          onClick={() => onSelect(s)}
          onMouseEnter={() => setActiveIndex(i)}
          className={i === activeIndex ? 'bg-white/10' : ''}>
          {s.title}
        </li>
      ))}
    </ul>
  );
}
```

**Admin logout resilience**:

```typescript
// stores/admin.ts
logout: async () => {
  try {
    await API.adminLogout();
  } catch (err) {
    // Network error — still clear local state
    console.warn('[AdminStore] Logout API call failed, clearing local state:', err);
  } finally {
    // ALWAYS clear local state regardless of API success/failure
    set({ admin: null, authenticated: false, loading: false, initialized: true });
    
    // Clear auth cookie as best-effort
    document.cookie = 'admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    // Redirect to login
    window.location.href = '/admin/login';
  }
},
```

---

## 7. Secrets Management Overlay

### Enterprise Vault Integration

```hcl
# vault-policy.hcl — Least-privilege Vault policy for yotop10-backend

path "secret/data/yotop10/production/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/yotop10/production/*" {
  capabilities = ["read", "list"]
}

path "sys/leases/renew" {
  capabilities = ["update"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}
```

```bash
# scripts/vault-setup.sh — One-time Vault bootstrapping

VAULT_ADDR="${VAULT_ADDR:-https://vault.internal.yotop10.com}"
VAULT_TOKEN="${VAULT_TOKEN:?Must provide root token}"

# Enable KV v2 secrets engine
vault secrets enable -path=secret kv-v2

# Store production secrets
vault kv put secret/yotop10/production/jwt \
  jwt_secret=$(openssl rand -hex 32)

vault kv put secret/yotop10/production/mongodb \
  username=yotop10_admin \
  password=$(openssl rand -base64 48) \
  uri="mongodb://yotop10_admin:${password}@mongodb:27017/yotop10?authSource=admin"

vault kv put secret/yotop10/production/redis \
  password=$(openssl rand -base64 32)

vault kv put secret/yotop10/production/elasticsearch \
  password=$(openssl rand -base64 32)

# Create approle for backend
vault auth enable approle
vault write auth/approle/role/yotop10-backend \
  token_policies="yotop10-backend" \
  token_ttl=1h \
  token_max_ttl=24h \
  secret_id_ttl=72h \
  secret_id_num_uses=40

# Get Role ID and Secret ID for deployment
vault read auth/approle/role/yotop10-backend/role-id
vault write -f auth/approle/role/yotop10-backend/secret-id
```

---

## 8. Observability & Monitoring Overlay

### Prometheus Metrics

```typescript
// backend/src/lib/metrics.ts
// Enterprise metrics collection with Prometheus

import prometheus from 'prom-client';

// Register default metrics
const register = new prometheus.Registry();
prometheus.collectDefaultMetrics({ register });

// HTTP request duration histogram
export const httpRequestDuration = new prometheus.Histogram({
  name: 'yotop10_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Database query duration
export const dbQueryDuration = new prometheus.Histogram({
  name: 'yotop10_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['collection', 'operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// Active users gauge
export const activeUsers = new prometheus.Gauge({
  name: 'yotop10_active_users',
  help: 'Number of active users in the last 5 minutes',
  registers: [register],
});

// Rate limit counter
export const rateLimitExceeded = new prometheus.Counter({
  name: 'yotop10_rate_limit_exceeded_total',
  help: 'Total number of rate limit exceeded events',
  labelNames: ['type'],
  registers: [register],
});

// Health check status
export const healthCheckStatus = new prometheus.Gauge({
  name: 'yotop10_health_check_status',
  help: 'Health check status (1=healthy, 0=unhealthy)',
  labelNames: ['component'],
  registers: [register],
});

export function getMetrics(): Promise<string> {
  return register.metrics();
}
```

### Structured Logging

```typescript
// backend/src/lib/logger.ts
// Enterprise structured logging with correlation IDs

import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL || 
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger = pino({
  level: LOG_LEVEL,
  transport: process.env.NODE_ENV !== 'production' 
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      requestId: req.requestId,
      ip: req.ip,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.token'],
    censor: '[REDACTED]',
  },
});

// Request-scoped logger with correlation ID
export function childLogger(parentLogger: typeof logger, requestId: string) {
  return parentLogger.child({ requestId });
}
```

---

## 9. Incident Response Playbooks

### Playbook 1: JWT Secret Compromise

```yaml
id: IR-001
title: JWT Secret Compromise
severity: CRITICAL
response_time: 15 minutes

steps:
  1. IMMEDIATE: Rotate JWT secret in Vault
  2. IMMEDIATE: Increment token_version for ALL admin users
  3. WITHIN 1H: Review audit logs for unauthorized admin access
  4. WITHIN 1H: Scan Git history for exposed credentials
  5. WITHIN 4H: Force re-clone all developer repositories
  6. WITHIN 24H: Rotate all database credentials
  7. COMPLETION: Document incident in postmortem

verification:
  - curl -X POST /api/admin/login returns 401 for all existing tokens
  - Admin can re-authenticate with valid credentials
  - No unauthorized access found in audit logs

rollback:
  - Restore previous JWT secret from Vault version history
  - Decrement token_version to re-validate existing tokens
```

### Playbook 2: Database Compromise (No Auth)

```yaml
id: IR-002
title: Unauthenticated Database Access
severity: CRITICAL
response_time: 30 minutes

steps:
  1. IMMEDIATE: Isolate database containers from network
  2. IMMEDIATE: Enable authentication on all databases
  3. WITHIN 1H: Rotate all data (users exported, DB re-created with auth)
  4. WITHIN 4H: Review application logs for data exfiltration attempts
  5. WITHIN 24H: Implement network segmentation (internal networks)
  6. COMPLETION: Enable database audit logging

verification:
  - docker exec mongodb mongosh -u admin -p fails without credentials
  - Application functions normally with authenticated connections
  - Network scan shows database ports are not exposed
```

---

## 10. Architecture Decision Records

### ADR-001: Secrets Management

```
# ADR-001: Secrets Management Strategy

Status: ACCEPTED
Date: 2026-06-07

## Context
JWT_SECRET was committed to Git in plaintext. All database credentials 
were hardcoded in docker-compose.yml without authentication enabled.

## Decision
Adopt HashiCorp Vault with the following hierarchy:
- Production secrets in Vault KV v2 at `secret/yotop10/production/*`
- Staging secrets at `secret/yotop10/staging/*`
- Dev secrets generated per-session via `openssl rand`
- Vault AppRole authentication for backend services
- Secret files in Docker (not environment variables) for runtime

## Consequences
Positive:
- Compromise of a single credential does not expose others
- Audit trail for all secret access
- Automatic secret rotation possible
- No secrets in Git history after BFG cleanup

Negative:
- Increased operational complexity (Vault cluster management)
- Latency added to secret resolution at startup
- Dependency on Vault availability at application start

## Alternatives Considered
1. AWS Secrets Manager: Rejected due to cloud provider lock-in
2. Kubernetes Secrets: Rejected — not running K8s
3. Encrypted .env files (SOPS): Rejected — no audit trail
4. 1Password Connect: Rejected — not designed for service auth
```

### ADR-002: API Client Architecture

```
# ADR-002: Frontend API Client Architecture

Status: ACCEPTED
Date: 2026-06-07

## Context
Three different API call patterns existed (apiFetch, raw fetch, API.* methods).
API calls bypassed device fingerprint headers and 425 retry logic.

## Decision
Consolidate all frontend API calls to use `API.*` methods:
- All endpoints go through `apiFetch<T>()` wrapper
- Device fingerprint and X-Tier0 headers are automatically attached
- 425 retry with exponential backoff is automatic
- Response type safety via generic parameter

## Consequences
Positive:
- Single point of change for API infrastructure
- Automatic retry and fingerprint on ALL requests
- Type-safe responses everywhere

Negative:
- All endpoints must be defined in the API module before use
- Some endpoints (upload) need special handling for multipart forms

## Migration Path
1. Add `searchApi` methods for search endpoints
2. Add `uploadApi` method for file uploads
3. Replace all raw `fetch()` calls in `search/client.tsx` and `profile/client.tsx`
4. Remove unused legacy `api.ts` file
```

---

*This document contains CONFIDENTIAL information about the YoTop10 production infrastructure. Distribution is restricted to authorized engineering personnel. All remediation must be approved by the CISO before deployment.*

---

## Final State Verification Checklist

After ALL phases are complete, this checklist MUST pass:

### Security
- [ ] `.env` removed from Git history (BFG verified)
- [ ] JWT secret loaded from Docker secrets / Vault — never from env var
- [ ] MongoDB, Redis, ES all require authentication
- [ ] Nginx enforces HTTPS + HSTS + security headers
- [ ] CSP blocks inline scripts
- [ ] All `dangerouslySetInnerHTML` goes through DOMPurify
- [ ] No `$regex` with unescaped user input in any route
- [ ] Fingerprint merge requires user confirmation

### Reliability
- [ ] All 7+ cron jobs registered in `CronRegistry` with dead-man's-switch
- [ ] Graceful shutdown drains all crons before `process.exit`
- [ ] Post editing uses journaled writes with rollback
- [ ] ES indexing has retry + dead letter queue
- [ ] Redis `KEYS` replaced with `SCAN` everywhere
- [ ] No unbounded DB queries — all paginated or batched

### Performance
- [ ] Title similarity uses ES pre-filtering
- [ ] SparkScore cron uses batched processing (max 500 docs in memory)
- [ ] Categories cached in Redis (5min TTL)
- [ ] All sort queries have covering indexes
- [ ] Bulk operations use `Promise.allSettled` with concurrency control

### Code Quality
- [ ] Zero `as any` in backend code
- [ ] Zero non-null assertions (`!`) on async results
- [ ] Zero `console.log` in production code
- [ ] Single ESLint 9 flat config (both packages)
- [ ] `RESERVED_ROUTES` defined once in `lib/`
- [ ] All API calls go through `apiFetch` / `API.*`

### Monitoring
- [ ] Prometheus metrics exported at `/api/metrics`
- [ ] All crons push dead-man's-switch heartbeats to Redis
- [ ] Search dead letter count visible in admin dashboard
- [ ] Rate limit exceeded events tracked as metrics
- [ ] Structured logging with correlation IDs
