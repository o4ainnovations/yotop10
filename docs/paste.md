# YoTop10 — Page Briefing

## Public Pages

| Route | Purpose |
|---|---|
| `/` | Homepage feed — glassmorphism cards, hero with CTA, category bar, sort pills, load-more, SSR-rendered (no loading spinner) |
| `/submit` | Post submission — category, title with duplicate check, intro, dynamic list items (3-100), per-item image upload, hero image upload, format selector, display name, draft auto-save |
| `/[slug]` | Post detail — hero banner + items (image-left text-right), item-anchored comments (10-level nesting), fire reactions, comment filter by item |
| `/[slug]/history` | Post changelog — Wikipedia-style version history, view diffs |
| `/a/[username]` | User profile — posts/comments/stats tabs, trust score, rate limits, edit display name, SecureMyAuthority identity section, device manager |
| `/categories` | Category browser — grid of parent categories with subcategory lists |
| `/c/[slug]` | Category feed — breadcrumb, filtered PostCard feed, subcategory pills |
| `/search` | Full-text search — autocomplete, results tabs (all/posts/comments), filters, pagination |
| `/claim` | Identity recovery — enter 12-word seed phrase, 4-column word grid, challenge-response verification |
| `/notifications` | Notification feed — merged system notifications + admin messages |
| `/notifications/[id]` | Notification detail — full message, dismiss |
| `/username-history` | Username change history for current user |

## Admin Pages

| Route | Purpose |
|---|---|
| `/admin` | Dashboard — stat cards, quick links to all tools |
| `/admin/login` | Admin login form |
| `/admin/setup` | One-time setup token validation |
| `/admin/posts/pending` | Review queue — approve/reject, bulk actions, collision detection |
| `/admin/posts/pending/[id]` | Post review detail — preview, approve/reject/retry |
| `/admin/posts` | All posts — table with filters, bulk feature/archive/delete |
| `/admin/posts/[id]/edit` | Post editor — edit title, intro, items |
| `/admin/comments` | Comment moderation — flag dismissal, penalties, hide/unhide, highlight |
| `/admin/categories` | Category management — tree/table/analytics tabs, bulk merge/reparent, import/export |
| `/admin/statistics` | Analytics — 21 collapsible panels (overview, health, content, community, search, alerts, etc.) |
| `/admin/search` | Search management — ES status, reindex, mappings, test query, analytics |
| `/admin/audit` | Audit logs — 90-day retention, filterable, CSV export |
| `/admin/alerts` | Alert thresholds — CRUD for 12-metric alert engine |
| `/admin/alerts/[id]` | Alert detail — breach info, resolution, history |
| `/admin/notifications` | Outbound messaging — send individual/broadcast, templates CRUD, delivery stats |
| `/admin/profile` | Admin profile settings |

## Design

- Dark mode default — `bg-zinc-950`, glass surfaces (`bg-white/[0.02] backdrop-blur`)
- Accent — `from-orange-500 to-pink-500` gradient
- Mobile-first — 320px base, `sm:` at 640px
- Tailwind-only — zero inline styles, zero custom CSS
- Hydration-immune — all dates via `lib/dates.ts` (UTC-deterministic)

---

# UI Plan Review — Rating: 7/10

Strong visual taste, but over-engineered for the platform's identity.

## Pros

| Area | What works |
|---|---|
| **Glassmorphism** | `bg-white/[0.02]` + `backdrop-blur` is consistent, premium, and distinctive |
| **Accent gradient** | `from-orange-500 to-red-500` is bold against dark zinc — instantly recognizable brand |
| **Search as hero focus** | Large rounded-full input is inviting and solves the #1 discovery need |
| **SSR + Intersection Observer** | Correct modern approach — no loading spinners, no hydration mismatch |
| **Bottom nav (mobile)** | 4-tab floating glass bar is standard mobile UX, users understand it immediately |
| **Trending pills** | Fire icon + clickable tags encourages casual browsing |
| **User icon** | First-letter fallback is clean and avoids managing real avatars for now |
| **Fingerprint without modals** | Non-blocking identification is the right UX for an "anonymous-first" platform |

## Cons

| Area | Problem |
|---|---|
| **Too many sections** | Hero → search → trending pills → sort bar → hero card → regular cards → carousel → category grid → bottom nav. That's **9 distinct UI patterns** before the user has scrolled through 3 actual posts. The feed is buried under its own chrome. |
| **Trending hero card** | Rank number, category badge, growth %, engagement stat, post count, two CTAs, large image — this is a **news magazine widget**, not a ranked list card. YoTop10 explicitly sells itself as "no algorithm, just rankings." Engagement percentages contradict that philosophy. |
| **Hero copy** | "YO! Welcome to YO!Top10" repeats the brand twice. "Explore any Top 10 list and join the wildest Arguments online!" reads like a **SaaS landing page**, not a Wikipedia-Reddit hybrid. The platform's actual tagline — "Fact mine. Debate ground." — is sharper and already paid for. |
| **Hero height** | The hero section (search + trending pills + heading + subheading) consumes the **entire viewport on mobile**. Returning users will scroll past it every single time. Feed-first platforms put the feed in view instantly. |
| **Anton font** | Heavy, condensed display font for half the logo clashes with Geist. A logo with two fonts read as two separate words, not one brand. |
| **"Rankings" as a nav tab** | The home feed IS rankings. Splitting them creates confusion — what's the difference between "Home" and "Rankings"? |
| **Arguments tab** | Arguments is explicitly a **post-MVP / Phase 2** feature. Linking to it from the primary nav before it exists shows empty/error states. |
| **Carousel + infinite scroll** | Horizontal swipe inside a vertical scroll is a **scroll-jacking anti-pattern**. On mobile, the carousel competes with page scroll. |
| **Floating nav + infinite scroll** | The bottom bar permanently occupies 60-80px. Combined with the sticky header, the **viewable content area on mobile shrinks to ~60% of the screen**. |
| **No light mode** | The plan only describes dark mode. YoTop10 has a working `ThemeToggle` and `prefers-color-scheme` support. |

## What to cut / simplify

| Remove | Replace with |
|---|---|
| Hero section (heading + subheading) | The tagline lives in the meta title, not in a hero. Feed starts immediately after nav. |
| Trending hero card | A regular PostCard with a subtle "Trending" badge. Same component, no special treatment. |
| Featured Rankings carousel | A horizontal scroll row of compact cards — no swiping, no carousel UI, just `overflow-x-auto`. |
| "Rankings" bottom nav tab | Fold into Home. 3 tabs: Home / Categories / Submit. |
| Anton font in logo | Gradient Geist weight-800 on both words. Same font, unified brand. |

## Final verdict

This is a **beautiful consumer social app design** applied to a **Wikipedia-meets-Reddit ranked list platform**. The visual language is cohesive and premium. But the information architecture buries the feed under landing-page chrome. YoTop10 is a catalog of lists, not a content discovery feed — the posts ARE the experience. The design should serve the content, not compete with it.
