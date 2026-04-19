# Implementation Plan: Phase 2 - Asymmetric Trust Score Weighting
**Date**: 2026-04-19
**Status**: ⏳ Pending Implementation
**Estimated Effort**: 1.5 hours

---

## Core Principles & Rationale
This change fixes the single most fundamental flaw in the current trust system: the incentive paradox where the optimal strategy for users below 1.0 trust is to stop posting entirely.

This is not a balance change. This is a behavioural correction. The system must always reward participation and never punish users for trying.

| Design Goal | Non-Negotiable Specification |
|--------------|---------------|
| ✅ No death spirals | It must always be mathematically possible to recover from any trust score |
| ✅ No permanent elite | No user can stay at maximum trust forever |
| ✅ Natural gravity | All users are pulled towards neutral over time |
| ✅ Incentive alignment | At every possible trust value, the optimal strategy is to post the highest quality content you can |

---

## Exact Weighting Specification
All delta values remain exactly 0.1 base. Only the multipliers change based on current trust score.

| Trust Score Range | Approval Multiplier | Rejection Multiplier | Operating Mode |
|-------------------|---------------------|----------------------|----------------|
| **0.000 → 0.999** | 2.0x | 0.5x | ✅ Forgiving Training Mode |
| **1.000 → 1.499** | 1.0x | 1.0x | ⚖️ Fair Neutral Mode |
| **1.500 → 2.000** | 0.5x | 2.0x | 🔒 Strict Trusted Mode |

---

## Edge Case Behaviour Requirements
These are non negotiable requirements that must be tested.

### At Exactly 1.0
- When moving **up** into 1.0: use 1.0x weights immediately
- When moving **down** into 1.0: use 2.0/0.5 weights immediately
- No hysteresis at this boundary

### At Exactly 1.5
- When moving **up** into 1.5: use 0.5/2.0 weights immediately
- When moving **down** into 1.5: use 1.0x weights immediately
- No hysteresis at this boundary

### At Minimum Trust (0.1)
- A user at 0.1 can never go lower than 0.1, no matter how many rejections they get
- 4 approved posts will take them from 0.1 → 0.9
- 16 rejected posts will take them from 0.9 → 0.1

### At Maximum Trust (2.0)
- A user at 2.0 can never go higher than 2.0, no matter how many approvals they get
- 4 approved posts will take them from 1.5 → 1.7
- 4 rejected posts will take them from 2.0 → 1.2

### Rolling Window Behaviour
All weighting rules apply equally to every single action in the rolling 50 post window. This means:
- A user who was at 0.2 when they got a rejection will only take 0.05 penalty, even if they later rise to 2.0 trust
- Weights are applied at the time the action happens. They are never retroactively changed.

---

## Technical Implementation Requirements
No database schema changes. No migrations. No API changes.

1. **Backwards Compatibility Guarantee**:
   - All existing trust score values remain completely valid
   - No recalculation of historical trust scores is required
   - The change only affects actions that happen after deployment

2. **Atomicity Requirements**:
   - The entire weighting calculation must happen inside the same database transaction as the trust score update
   - No partial updates allowed
   - Optimistic concurrency control must remain fully functional

3. **Audit Log Requirements**:
   - Every trust score delta must be logged with the multiplier that was applied
   - Audit log must include: currentTrust, action, multiplier, delta, newTrust
   - No exceptions. All changes must be fully auditable.

4. **Zero User Visibility**:
   - This change must be completely invisible to users
   - No notifications
   - No UI changes
   - No announcements
   - Users must only notice that the system now feels fair

---

## Verification Test Plan
Every single one of these must be tested before deployment:

| Test Case | Starting Trust | Action | Expected Result |
|-----------|----------------|--------|-----------------|
| 1 | 0.1 | Approve | 0.3 |
| 2 | 0.1 | Reject | 0.075 → clamped to 0.1 |
| 3 | 0.5 | Approve | 0.7 |
| 4 | 0.5 | Reject | 0.45 |
| 5 | 0.9 | Approve | 1.1 |
| 6 | 0.9 | Reject | 0.85 |
| 7 | 1.0 | Approve | 1.1 |
| 8 | 1.0 | Reject | 0.9 |
| 9 | 1.4 | Approve | 1.5 |
| 10 | 1.4 | Reject | 1.3 |
| 11 | 1.5 | Approve | 1.55 |
| 12 | 1.5 | Reject | 1.3 |
| 13 | 2.0 | Approve | 2.0 |
| 14 | 2.0 | Reject | 1.8 |

---

## Rollout & Deployment Strategy
1. **Pre Deployment**:
   - Run all unit tests
   - Run full production database snapshot simulation
   - Verify no existing user's trust score would be negatively affected by this change

2. **Deployment**:
   - Deploy during low traffic period
   - No feature flag required. Deploy live immediately.
   - This is a server side only change. No frontend deployment required.

3. **Canary Period**:
   - Monitor for 24 hours
   - Check for any version conflict errors
   - Check audit log for correct delta calculation

---

## Post Deployment Monitoring
For 7 days after deployment monitor:
1. **Trust score distribution graph**
   - Expected: Users will start moving up from the 0.1-0.3 range
   - Expected: Fewer users permanently stuck at minimum trust
   - Expected: Fewer users permanently stuck at maximum trust

2. **Submission rate**:
   - Expected: 20-30% increase in post submission volume from low trust users
   - If this goes higher than 50% roll back immediately

3. **Approval rate**:
   - Expected: Approval rate should stay approximately the same
   - If approval rate drops by more than 10% roll back immediately

---

## Acceptance Criteria
✅ All unit tests pass  
✅ All 14 edge case tests pass  
✅ Trust score calculation remains perfectly accurate  
✅ No user visible changes  
✅ Audit logs correctly record all multipliers  
✅ Optimistic concurrency control continues to work  
✅ No increase in spam volume  
✅ Zero support tickets about trust score changes

---

## Failure Rollback Plan
If any issues are detected:
1. Revert the single commit
2. Deploy immediately
3. No data corruption possible
4. All trust scores will automatically return to previous behaviour
5. No data loss. No permanent changes.

---

## Success Metrics
This change is successful if after 30 days:
- 70% fewer users are permanently stuck below 0.3 trust
- Post submission rate from new users increases by 20%
- Approval rate remains within 5% of previous levels
- Zero support tickets about unfair trust score changes
