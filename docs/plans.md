# Implementation Plan: Phase 3 - The Ladder Temporary Boost System
**Date**: 2026-04-19
**Status**: ✅ Phase 1 Complete | ✅ Phase 2 Complete | ⏳ Phase 3 Pending
**Estimated Effort**: 2 hours

---

## Core Principles & Rationale
Even with asymmetric weighting, users at low trust still feel stuck. They see the low rate limit and give up before they ever get a chance to prove they can contribute good content.

The Ladder System is a temporary training wheels mechanism that gives users a clear, transparent, guaranteed path to earn more posting capacity immediately, without having to wait weeks for trust score increases. It vanishes completely and permanently once users become established.

| Design Goal | Non-Negotiable Specification |
|--------------|---------------|
| ✅ No permanent advantages | Boosts are temporary and expire. No permanent rewards. |
| ✅ Zero risk | Nothing done during a boost can ever affect base trust score. Not up, not down. |
| ✅ Absolute transparency | Every trigger, every rule, every value is published and public. |
| ✅ No gaming possible | System cannot be farmed faster than 1 boost per 12 hours. |
| ✅ Vanishing act | System is 100% invisible to users above 1.2 trust. |

---

## Exact System Specification
The entire system is hardcoded. No algorithms. No machine learning. No secrets.

### Boundary Rule (Non Negotiable)
| Trust Score Range | Ladder System Status |
|--------------------|----------------------|
| 0.000 → 1.199 | ✅ Fully active, fully visible |
| 1.200 → 2.000 | ❌ 100% disabled, completely invisible |

Users will never know this system exists once they cross 1.2 trust.

---

### Exact Hardcoded Boost Triggers
All values are public. All values are permanent.

| Action | Boost Granted | Notes |
|--------|---------------|-------|
| ✅ Your comment receives 3+ fire reactions | +1 post, +5 comments | Works at any user count. 3 is a very low bar that works even on launch day. |
| ✅ You receive 2+ replies to your comment | +1 post, +5 comments | Cannot be farmed by yourself. Requires actual engagement from other users. |
| ✅ You submit a counter list | +2 posts, +10 comments | **Always granted immediately**. No approval required. No votes needed. |
| ✅ Your post is approved by admin | +3 posts, +15 comments | Granted the exact millisecond approval happens. |
| ❌ Post gets views | Never | Too easy to farm |
| ❌ Post gets fires | Never | Too easy to farm |

---

### Anti-Farming Rules
Also fully public and documented:
1. **Maximum one boost per 12 hours per user**. No stacking. No exceptions.
2. Boosts are purely additive to your base rate limit. They never multiply.
3. Boosts expire after exactly 90 minutes. No rollover. No extensions.
4. **Zero trust score impact**: Nothing you do during a boost ever affects your base trust score. Not positive. Not negative. No exceptions.

---

## Edge Case Behaviour Requirements

### At Exactly 1.2 Trust
- If a user has an active boost when they cross 1.2 trust: the boost remains active until it expires
- Once expired: the system is permanently disabled for that user
- They will never see another boost, notification, or reference to the system ever again

### Boost Eligibility
- You can earn a boost even if you are currently at your rate limit
- Boosts are added immediately. If you were blocked you can immediately post again
- You cannot earn another boost until your current active boost expires

### Troll Behaviour
Trolls will farm this. This is intentional.
- The absolute maximum any troll can ever get is +3 posts once every 12 hours
- To earn that boost they must produce at least one comment that 3 other people actually liked
- You get one decent comment from them for every 3 spam posts. This is an acceptable tradeoff.

---

## Technical Implementation Requirements

### Data Model Changes
Add these 3 fields to the User model:
```
active_boost: {
  posts: number,
  comments: number,
  expires_at: Date
}
last_boost_granted_at: Date
```

No other schema changes required. No migrations required.

### Rate Limit Integration
Boost calculation happens at the very end of rate limit calculation:
```
base_limit = calculateEffectivePostLimit(trust_score)
active_boost = getActiveBoostIfAny(user)

final_limit = base_limit + active_boost.posts
```

Boosts are always added, never multiplied.

### Notification Requirements
When a user earns a boost:
- Real time toast notification:
  > ✅ Your comment received 3 fires. You earned +1 post boost for 90 minutes.
- Countdown timer visible on profile stats tab
- Exact remaining time always displayed

### Transparency Requirements
1. Full list of all triggers and values visible on profile stats tab
2. Exact countdown timer until next boost eligibility
3. Public immutable log of all boosts granted at `/boosts`
4. No admin controls. No manual boosts. No secret adjustments.

---

## Verification Test Plan
Every single one of these must be tested before deployment:

| Test Case | Starting Trust | Action | Expected Result |
|-----------|----------------|--------|-----------------|
| 1 | 0.5 | Comment gets 3 fires | +1 post boost granted for 90 minutes |
| 2 | 0.5 | Comment gets 2 replies | +1 post boost granted for 90 minutes |
| 3 | 0.5 | Submit counter list | +2 post boost granted immediately |
| 4 | 0.5 | Post gets approved | +3 post boost granted immediately |
| 5 | 0.5 | Earn boost, then earn second boost 1 hour later | Second boost rejected |
| 6 | 0.5 | Earn boost, then get post rejected during boost | Trust score remains completely unchanged |
| 7 | 1.199 | Earn boost | Boost granted normally |
| 8 | 1.201 | Perform all boost actions | No boost granted. System completely invisible. |
| 9 | 1.199 with active boost | Cross 1.2 trust | Boost continues until expiry, then system vanishes forever |

---

## Rollout & Deployment Strategy
1. **Pre Deployment**:
   - Deploy database schema change first
   - All new fields nullable, default null
   - System disabled by default

2. **Gradual Rollout**:
   - Deploy with 10% sample of users for 24 hours
   - Monitor boost grant rate
   - Monitor submission rate
   - If no issues: enable for 100% of users

3. **Zero User Announcement**:
   - Users will discover the system naturally
   - No blog post. No changelog entry.
   - The system speaks for itself.

---

## Post Deployment Monitoring
For 14 days after deployment monitor:
1. **Boost grant rate**: Expected ~5-10 boosts per 100 active users
2. **Submission rate increase**: Expected 20-30% increase from low trust users
3. **Approval rate**: Should stay within 10% of previous levels
4. **Trust score migration**: Users should start moving past 1.2 trust faster

---

## Acceptance Criteria
✅ All 9 test cases pass  
✅ No user visible changes for users above 1.2  
✅ No trust score changes from actions taken during boosts  
✅ No way to earn more than one boost per 12 hours  
✅ All triggers work exactly as specified  
✅ Full audit log of all boosts granted  
✅ No increase in spam volume  
✅ Zero support tickets about the system

---

## Failure Rollback Plan
If any issues are detected:
1. Change single config flag to disable system globally
2. All active boosts expire normally
3. No permanent changes made to any user state
4. Can be disabled in 10 seconds without deployment

---

## Success Metrics
This change is successful if after 30 days:
- 30% more users cross the 1.2 trust threshold per week
- Post submission rate from new users increases by 25%
- Approval rate remains within 5% of previous levels
- Fewer than 1% of users hit the 12 hour boost cooldown
- Zero complaints about the system feeling unfair
