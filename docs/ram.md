# 🚀 RAM.md - Current Highest Priority Task

## CURRENT HIGHEST PRIORITY: **Trust Score V2 Refactor**
🔴 **CRITICAL FOUNDATION FIX. MUST BE IMPLEMENTED BEFORE M10.3 REVIEW QUEUE.**

The current linear trust score formula will completely break at scale. It creates terrible incentives and will lead to unresolvable abuse problems. This is the highest leverage change you can make right now.

---

## 🧑💻 Senior Backend Engineer Implementation Plan
**Phased, testable implementation order. No shortcuts. Each phase must be 100% complete before moving to next.**

---

## 📐 Core Formula Specifications

### 1. Bayesian Smoothing (Cold Start Fix)
$$Trust_{Score} = \frac{(C \times m) + (raw\_score \times n)}{C + n}$$

* $C$: Confidence constant = 5
* $m$: Global mean trust = 1.0
* $n$: Total posts reviewed for this user

**Purpose**: New users cannot jump immediately to Scholar status after 1 good post. Requires consistent evidence to move score away from default.

---

### 2. Logarithmic Scaling (Asymmetric Elasticity)
```typescript
BASE_TRUST = 1.0
MAX_TRUST = 2.0
MIN_TRUST = 0.1
PUNISHMENT_MULTIPLIER = 2.5  // Rejections hurt 2.5x more than approvals help

// Core velocity calculation
pos = log1p(total_approved * 0.05)
neg = log1p(total_rejected * 0.05 * PUNISHMENT_MULTIPLIER)
raw_score = BASE_TRUST + pos - neg
```

**Purpose**:
- Trust is hard to gain, easy to lose
- Diminishing returns make it increasingly difficult to reach 2.0
- The last 0.2 points to Scholar status require 10x more consistent quality than the first 0.8

---

### 3. Exponential Decay (Recency Bias)
$$Score_{new} = (Score_{old} \times e^{-\lambda t}) + \text{Adjustment}$$

* $\lambda$: Decay constant = 0.000114 (~50% decay over 60 days of inactivity)
* $t$: Hours since last activity

**Purpose**:
- Scholars must remain active to keep their status
- Trolls cannot wait out their punishment
- Trust reflects current behavior, not what someone did 2 years ago

---

### ✅ Phase 1: Formula Refactor (Est: 1hr)
**File**: `backend/src/lib/trustScore.ts`

| Step | Task | Acceptance Criteria |
|---|---|---|
| 1.1 | Implement new core formula | Logarithmic scaling, 2.5x punishment multiplier, clamp 0.1 - 2.0 |
| 1.2 | Add Bayesian smoothing | 5 post confidence constant, weighted average calculation |
| 1.3 | Add exponential decay logic | Time-based score decay on every calculation |
| 1.4 | Add unit tests | Verify edge cases: 0 posts, 1 post, 10 posts, 100 posts, inactivity |

**DO NOT PROCEED UNTIL UNIT TESTS PASS.**

---

### ✅ Phase 2: Idempotency Guards (Est: 2hrs)
**Files**: `Post.ts`, `trustScore.ts`

| Step | Task | Acceptance Criteria |
|---|---|---|
| 2.1 | Add `trust_score_updated: boolean` to Post schema | Default `false` |
| 2.2 | Update calculateTrustScore to check this flag | Return early if already updated |
| 2.3 | Set flag to `true` immediately after calculation | Atomic operation in single database transaction |
| 2.4 | Add unique constraint on audit log | `user_id + post_id` unique index |

**Guarantee**: Approving the same post 1000 times will change trust score **exactly once**.

---

### ✅ Phase 3: Immutable Audit Log (Est: 1.5hrs)
**Files**: `TrustScoreLog.ts` model, `trustScore.ts`

| Step | Task | Acceptance Criteria |
|---|---|---|
| 3.1 | Create TrustScoreLog collection | Fields: `user_id`, `timestamp`, `post_id`, `action`, `delta`, `old_score`, `new_score`, `source` |
| 3.2 | Write log entry on EVERY score change | Atomic with score update |
| 3.3 | No update/delete permissions on this collection | No code anywhere in the codebase that modifies or deletes these records |

**Guarantee**: You have a permanent, immutable paper trail of every trust score change forever.

---

### ✅ Phase 4: Circuit Breaker System (Est: 1.5hrs)
**Files**: `trustScore.ts`, `User.ts`

| Step | Task | Acceptance Criteria |
|---|---|---|
| 4.1 | Add `trust_locked: boolean` to User schema | Default `false` |
| 4.2 | On every trust score update, check velocity | If delta < -0.5 within last 60 minutes → auto lock |
| 4.3 | Locked users have all privileges revoked until admin review | Cannot post, cannot comment, read only |

**Guarantee**: Hacked accounts cannot do irreversible damage before admins notice.

---

### ✅ Phase 5: Background Worker Queue (Est: 2hrs)
**Files**: New worker system, `approve`/`reject` endpoints

| Step | Task | Acceptance Criteria |
|---|---|---|
| 5.1 | Implement simple in-memory queue for trust score updates | BullMQ or native JS queue |
| 5.2 | Modify approve/reject endpoints to queue instead of calculate | Endpoint returns in <10ms |
| 5.3 | Add at-least-once delivery guarantees | Retry failed calculations with backoff |

**Guarantee**: Trust score calculation never blocks user requests. Admin actions are instant.

---

### ✅ Phase 6: Backfill & Migration (Est: 1hr)
| Step | Task | Acceptance Criteria |
|---|---|---|
| 6.1 | Write one-time migration script | Recalculate trust scores for all existing users |
| 6.2 | Dry run first | Verify score distribution is correct |
| 6.3 | Execute migration | Atomic swap |

---

### ✅ Phase 7: M10.3 Review Queue (Est: 4hrs)
Only begin this phase **after** all previous 6 phases are 100% complete and tested.

---

## ⚠️ NON-NEGOTIABLE RULES
1. **No skipping phases**. Each phase depends completely on the previous one.
2. **No shortcuts**. Idempotency and immutability are not optional at scale.
3. **No UI work**. All work is backend only. Admin UI comes much later.
4. **Write tests first**. Every component must have unit tests before implementation.

---

### 📊 Final System Properties
| Property | Guarantee |
|---|---|
| ✅ Idempotent | Same action called 1M times = same result |
| ✅ Immutable | Audit log can never be changed |
| ✅ Resilient | Bad actors cannot game the system |
| ✅ Scalable | Works at 100 users or 10M users |
| ✅ Fast | All admin actions return in <10ms |
| ✅ Self-correcting | Inactive users automatically lose privileges over time |

---

**Blockers**: None. All dependencies are complete.

**Total estimated effort**: 12-14 hours total.

**This is the single most important thing you can build for the long term success of the platform.**
