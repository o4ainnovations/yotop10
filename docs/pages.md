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
