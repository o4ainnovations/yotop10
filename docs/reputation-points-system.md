# Reputation Points System — Post-MVP Specification

## Overview

A two-tier reputation model. Trust Score (0.1–2.0) controls rate limits and content quality gating. Reputation Points (0–∞) measures lifetime contribution. Both must be earned. Neither can be bought or farmed without quality.

---

## Trust Score (Existing — Unchanged)

| Tier | Score | Effect |
|---|---|---|
| Troll | 0.1 – 0.49 | 0.5× rate limits, `a_` prefix enforced, points hidden from public |
| Neutral | 0.5 – 1.79 | 1.0× rate limits, `a_` prefix enforced, points visible to self only |
| Scholar | 1.8 – 2.0 | 2.0× rate limits, `a_` prefix optional, points fully public |

Trust is calculated from the last 50 review decisions. It moves up AND down. Fast to change — responds to recent behavior.

---

## Reputation Points (New — Additive Only)

### How points are earned

| Action | Points |
|---|---|
| Post approved | +50 |
| Comment receives a fire reaction (per fire) | +5 |
| Counter-list submitted | +25 |
| Featured in Hall of Fame | +100 |
| Active visit (once per day) | +3 |

Points never decrease. They accumulate for life. A banned/restricted user keeps their points but cannot earn more while restricted.

### Data Model

```typescript
User {
  reputation_points: number;     // default 0, never decreases
  reputation_badges: string[];   // awarded at thresholds
}
```

---

## Visibility Gates

Points visibility depends on trust score. This protects beginners from public scrutiny while they learn the platform.

| Trust | Points visible to |
|---|---|
| < 0.5 (Troll) | User only (private) |
| 0.5 – 1.49 (Neutral) | User only (private) |
| ≥ 1.5 (Scholar-ready) | Everyone (public on profile) |

A user at trust 1.0 with 3,000 points — only THEY can see their points. Once trust hits 1.5, those 3,000 points become publicly visible and all earned unlocks activate.

---

## Unlocks

Every unlock requires BOTH a points threshold AND a trust threshold. Points without trust unlock nothing. This prevents trolls from exploiting the system.

| Points | Unlock | Trust Gate | Description |
|---|---|---|---|
| 250 | Private milestone | None | User sees "Keep going — you're building reputation" on their profile |
| 500 | Subcategory submission | 0.5 | Can submit posts to child categories (not just parent) |
| 1,000 | Established badge (private) | 0.5 | Badge visible on own profile: "Established Contributor" |
| 2,000 | Remove `a_` prefix | 1.5 | Custom username — no prefix required |
| 3,500 | Queue priority | 1.5 | Pending posts reviewed before non-priority users |
| 7,500 | Authority badge (public) | 1.8 | Badge visible publicly: "Verified Authority" |
| 15,000 | Auto Hall of Fame candidate | 1.8 | Posts automatically qualify for HoF nomination |

---

## Scenarios

### New user (trust 1.0, 0 pts)
Submits 5 posts. All approved. Now at 250 pts (private). Gets a "Keep going" nudge. Trust may rise to 1.3. Points stay private. Nothing unlocked yet. Beginner-friendly — no pressure.

### Active user (trust 1.6, 2,000 pts)
Points now public. `a_` prefix removed. Queue priority active. Badge visible. Has earned visibility through consistent quality.

### Recovering troll (trust 0.3, 5,000 pts)
Points exist but are private. Nothing unlocked. The user knows they have 5,000 pts (motivation to reform). If trust rises above 1.5, all 5,000 pts become public and unlocks activate retroactively. Past contribution isn't erased — it's waiting for quality to catch up.

### Scholar (trust 1.9, 8,000 pts)
All points public. Authority badge visible. Eligible for moderator candidate. Queue priority. Custom username. Hall of Fame candidate at 15,000.

---

## Integration Points

No existing code changes. Purely additive:

| Where | What's added |
|---|---|
| `models/User.ts` | `reputation_points: number`, `reputation_badges: string[]` |
| `routes/admin.ts` | On approve: `user.reputation_points += 50` |
| `routes/comments.ts` | On fire reaction: `user.reputation_points += 5` |
| `routes/posts.ts` | On counter-list submit: `user.reputation_points += 25` |
| `routes/admin.ts` | On feature in HoF: `user.reputation_points += 100` |
| `middleware/fingerprint.ts` | On daily active visit: `user.reputation_points += 3` (Redis-deduped per day) |
| `app/a/[username]/page.tsx` | Show points + badges on profile (with trust gate) |
| `app/leaderboard/page.tsx` | New page — top users by points (only shows users with trust ≥ 1.5) |

---

## Anti-Abuse

| Attack | Defense |
|---|---|
| Mass submit to farm approvals | Trust score drops on rejection — low trust = no unlocks |
| Spam comments for fires | Fire requires genuine engagement from other users |
| Bot daily visits | Points-limited to 1/day. Minimal impact on total. |
| Troll with 100,000 pts | No unlocks unless trust ≥ 0.5. Points are harmless. |

---

## Phase: Post-MVP

This system is designed to be built AFTER the current features are complete. It depends on:
- Trust score system (already built)
- User profiles (already built)
- Comment reactions (already built)
- Hall of Fame (already built)
- Moderator system (already built)

Nothing in this plan requires changing any existing system. All integration is additive.
