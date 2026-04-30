# BEFORE DOING ANYTHING: FIRST READ AGENTS.md IN FULL


# RAM.md - Current Highest Priority Task

## CURRENT HIGHEST PRIORITY: **Phase 1 — STOP THE BLEEDING (Security + Crashes) — COMPLETED ✅**

All 9 critical security and crash fixes from the ROM.md audit have been implemented and verified.

---

## ✅ Phase 1 Completion Checklist:

| # | Task | Files | Status |
|---|------|-------|--------|
| P1.1 | Remove hardcoded JWT secret fallback | `backend/src/lib/adminAuth.ts` | `completed` ✅ |
| P1.2 | Gate Eruda behind NODE_ENV | `frontend/src/app/Eruda.tsx` | `completed` ✅ |
| P1.3 | Fix XSS in JSON-LD (escape `</`) | `frontend/src/app/[slug]/page.tsx` | `completed` ✅ |
| P1.4 | Wrap localStorage in try/catch | `frontend/src/lib/api.ts` | `completed` ✅ |
| P1.5 | Add max retry to 425 recursion (3 max) | `frontend/src/lib/api.ts` | `completed` ✅ |
| P1.6 | Null-check window.eruda before init | `frontend/src/app/Eruda.tsx` | `completed` ✅ |
| P1.7 | Wrap localStorage in safe helpers | `frontend/src/lib/fingerprint.ts` | `completed` ✅ |
| P1.8 | Remove MongoDB $regex injection | `backend/src/routes/users.ts` | `completed` ✅ |
| P1.9 | Replace stub 200 OKs with 501 | `backend/src/routes/auth.ts, listings.ts, reviews.ts, search.ts, users.ts` | `completed` ✅ |
| V   | Backend build passes (tsc 0 errors) | — | `completed` ✅ |
| V   | Frontend build passes (Next.js 0 errors) | — | `completed` ✅ |

---

## NEXT: **Phase 2 — FIX THE INFRASTRUCTURE** 

**Priority**: HIGH
**Reference**: `docs/rom.md` Section 8 — Phase 2

| # | Task | Description |
|---|------|-------------|
| P2.1 | Create singleton Redis client | Replace 5 per-request `getRedisClient()` functions with shared singleton |
| P2.2 | Create singleton Elasticsearch client | Export ES client so search routes can use it |
| P2.3 | Enable MongoDB replica set OR replace `withTransaction()` | Trust score writes crash on standalone MongoDB |
| P2.4 | Move cron initialization to server.ts | Remove module-level `setInterval` calls, centralize lifecycle |
| P2.5 | Remove dead setInterval in fingerprint middleware | Delete the 60-second Redis connect/disconnect loop |

---

## ROM Reference

All findings, rationale, and migration plans are documented in `docs/rom.md`.

