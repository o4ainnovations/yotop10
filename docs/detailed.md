# YoTop10 — Full Technical Architecture

## Stack Overview

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15.5.18 (App Router, React 19) |
| **Backend** | Node.js 20, Express.js |
| **Database** | MongoDB 7.x with Mongoose ODM |
| **Cache** | Redis 7.x |
| **Search** | Elasticsearch |
| **Reverse Proxy** | Docker nginx → Host nginx (two-tier) |
| **Image Processing** | Sharp (server-side webp conversion) |
| **Styling** | Tailwind CSS v4 (CSS-first config) |
| **Package Manager** | pnpm 9 |
| **Containerization** | Docker Compose (6 services) |

---

## Infrastructure (Docker)

### 6 Containers

| Service | Container | Internal Port | Host Port | Health Check |
|---------|-----------|--------------|-----------|-------------|
| `nginx` | `yotop10_nginx` | 80/443 | 8080/8443 | `nginx -t` |
| `frontend` | `yotop10_frontend` | 3000 | 3100 | HTTP GET `/` |
| `backend` | `yotop10_backend` | 8000 | 8100 | Custom healthcheck.mjs |
| `mongodb` | `yotop10_mongodb` | 27017 | — | `mongosh` ping |
| `redis` | `yotop10_redis` | 6379 | — | `redis-cli ping` |
| `elasticsearch` | `yotop10_elasticsearch` | 9200 | — | HTTP GET `/` |

### Host Nginx (`/etc/nginx/sites-available/yotop10`)

- TLS termination via Let's Encrypt (Certbot)
- Location routing:
  - `/` → proxies to `frontend:3000`
  - `/api/` → proxies to `backend:8000`
  - `/uploads/` → proxies to `backend:8000` (static file serving)
- Rate limiting zones:
  - `yotop10_api`: 20 req/s, burst 50
  - `yotop10_fe`: 100 req/s
- `client_max_body_size 10m` (file uploads)

### Docker Nginx (`nginx.conf`)

- TLS ciphers: ECDHE + CHACHA20 + DHE
- HSTS: `max-age=63072000; includeSubDomains; preload`
- CSP headers with strict rules
- Static asset caching: 365d immutable for js/css/images
- Gzip compression
- `client_body_buffer_size 128k`, `client_max_body_size 10m`

### Persistent Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `mongodb_data` | `/data/db` | MongoDB data |
| `redis_data` | `/data` | Redis RDB snapshots |
| `elasticsearch_data` | `/usr/share/elasticsearch/data` | ES indices |
| `uploads_data` | `/app/uploads` | User-uploaded images |

### Resource Limits

| Service | Memory | CPU |
|---------|--------|-----|
| Backend | 512m | 1.0 |
| MongoDB | 1g | 1.0 |
| Redis | 256m | 0.5 |
| Elasticsearch | 1g | 1.0 |

---

## Backend Architecture

### Express Router Structure

Routes are registered in `backend/src/routes/index.ts` as an array of `{ path, router }` definitions.

| Path | Router | Lines | Purpose |
|------|--------|-------|---------|
| `/api/auth` | `auth.ts` | — | Device fingerprint login/logout |
| `/api/categories` | `categories.ts` | — | Category CRUD |
| `/api/comments` | `comments.ts` | — | Comments CRUD |
| `/api/fingerprint` | `fingerprint.ts` | — | Fingerprint matching and identity |
| `/api/identity` | `identity.ts` | — | Seed phrase claim |
| `/api/posts` | `posts.ts` | ~1248 | Posts CRUD, view counting, voting, counter-lists |
| `/api/upload` | `upload.ts` | 51 | Image upload with Sharp processing |
| `/api/search` | `search.ts` | — | Search + autocomplete + trending |
| `/api/users` | `users.ts` | ~632 | User profiles, rate limits, notifications |
| `/api/articles` | `articles.ts` | ~275 | Articles CRUD |
| `/api/bookmarks` | `bookmarks.ts` | 210 | Save/unsave/bookmarks |
| `/api/arguments` | `arguments.ts` | — | Hot debates with Redis sorting |
| `/api/explore` | `explore.ts` | — | Explore scoring algorithm |
| `/api/hall-of-fame` | `hallOfFame.ts` | — | Featured posts |
| `/api/admin` | `admin.ts` | ~3466 | Admin dashboard, moderation, config, users |

### Key Backend Libraries

| Library | Purpose |
|---------|---------|
| `multer` | Multipart file upload handling |
| `sharp` | Image resize/crop to webp |
| `bcryptjs` | Admin password hashing |
| `jsonwebtoken` | Admin JWT tokens |
| `express-validator` | Input validation (post submission) |
| `zod` | Schema validation (admin config) |
| `cors` | CORS headers |
| `cookie-parser` | Cookie parsing |

### MongoDB Models

| Model | Collection | Key Fields |
|-------|-----------|------------|
| `Post` | `posts` | title, slug, post_type, status, author_id, category_slug, hero_image_url, format, votes_a/b, ai_score, ai_flags, fire_count, parent_id, bookmark_count, created_at, published_at |
| `Article` | `articles` | title, slug, body, status, reading_time, cover_image, sources[], fact_check_status, author_id, bookmark_count |
| `User` | `users` | user_id, username, device_fingerprint, trust_score, trust_version, trust_level, trust_locked, is_admin, profile_image_url, authority_id, restricted_until, last_50_reviews[] |
| `ListItem` | `listitems` | post_id, rank, title, justification, image_url, source_url |
| `Comment` | `comments` | post_id, content, depth, fire_count, spark_score, author_username, list_item_id, parent_comment_id |
| `SavedPost` | `savedposts` | user_id, post_id, content_type ('post' \| 'article'), saved_at |
| `Category` | `categories` | name, slug, icon, post_count, parent_id, is_featured |
| `SystemConfig` | `systemconfigs` | key, rate_limits, trust_tiers, ai_moderation, version |
| `Notification` | `notifications` | user_id, type, post_id, post_title, message, read, created_at |
| `AdminMessage` | `adminmessages` | type, title, body, created_by, dismissed_by[], priority, expires_at |
| `AdminUser` | `adminusers` | username, password_hash, role, permissions[], token_version |
| `TrustScoreLog` | `trustscorelogs` | user_id, post_id, action, delta, old_score, new_score, version |
| `DeviceFingerprint` | `devicefingerprints` | fingerprint, user_id, last_seen |

---

## Authentication & Identity

### Three Identity Layers

| Layer | Method | Storage | Persistence |
|-------|--------|---------|-------------|
| **Device Fingerprint** | Browser fingerprint hash | `device_fingerprint` cookie + `X-Device-Fingerprint` header + localStorage | Cross-session |
| **User ID** | Auto-generated on first visit | `user_id` field on User document | MongoDB |
| **Authority (Claim)** | BIP39 12-word seed phrase | `authority_id` + `public_key_hash` on User | MongoDB |

### Fingerprint Middleware (`middleware/fingerprint.ts`)

**Flow:**
1. Read `device_fingerprint` cookie (httpOnly) or `X-Device-Fingerprint` header
2. Look up user by `device_fingerprint` in User collection
3. If found → attach `req.user` with user data
4. If not found → create new user with random `user_id`, random username, trust_score 1.0
5. Cross-browser merge via `x-merge-token` header
6. Set `device_fingerprint` cookie with expiry

**`req.user` structure:**
```typescript
{
  user_id: string;
  username: string;
  custom_display_name?: string;
  device_fingerprint: string;
  trust_score: number;
  trust_locked: boolean;
  rate_limit_override?: { posts_per_hour?: number; comments_per_hour?: number };
  is_admin: boolean;
  restricted_until: Date | null;
  created_at?: Date;
}
```

### Admin Auth

- Separate `admin_token` httpOnly cookie (JWT)
- JWT payload: `{ id, username, role, token_version }`
- Role-based permissions: `super_admin`, `admin`, `mod`
- Each role mapped to permission set via `usePermission` hook
- `token_version` incremented on admin logout (invalidates all sessions)
- Admin middleware checks token on every protected route

---

## Trust & Reputation System

### Trust Score Range: 0.1 – 2.0 (starts at 1.0)

**Formula:**
```typescript
const pos = Math.log1p(approved * 0.05);
const neg = Math.log1p(rejected * 0.05 * 2.5);  // Punishment: 2.5x
const rawScore = 1.0 + pos - neg;
// Bayesian smoothing with confidence constant 5:
const weighted = ((5 * 1.0) + (rawScore * totalReviewed)) / (5 + totalReviewed);
```

### Score Multipliers (by current score)

| Range | Approve | Reject |
|-------|---------|--------|
| < 1.0 (low trust) | ×2.0 boost | ×0.5 dampen |
| 1.0 – 1.5 (neutral) | ×1.0 | ×1.0 |
| > 1.5 (high trust) | ×0.5 dampen | ×2.0 boost |

### Five Trust Levels

| Level | Gateway | Rate Limit Mult | Min Posts |
|-------|---------|----------------|-----------|
| `ghost` | >7d dormant + 0 approved | 0.1× | 1 |
| `newbie` | Default on signup | 0.25× | 1 |
| `troll` | Score ≤ 0.49 | 0.5× | 2 |
| `neutral` | Score 0.5–1.79 | 1.0× | 4 |
| `scholar` | Score ≥ 1.8 (enter ≥1.85) | 2.0× | 8 |

### Promotion / Demotion

```
ghost ──(1st approved post)──→ newbie ──(48h OR 1 approved)──→ neutral
neutral ──(score ≥ 1.85)──→ scholar
neutral ──(7d dormant + 0 approved)──→ ghost
scholar ──(score ≤ 1.70)──→ neutral
neutral ──(score ≤ 0.49)──→ troll
```

- `checkAndPromoteUser()` called on every user fetch + after every trust score update
- Version-based optimistic locking via `trust_version` field
- Configurable thresholds via `SystemConfig.trust_tiers`
- Admin can manually set score via `PATCH /admin/users/:id/trust` (also locks it)

---

## Post System

### 8 Post Types

| Type | Items | Validation Rule |
|------|-------|-----------------|
| `top_list` | 3–100 | Title must contain number + "Top" |
| `best_of` | 3–100 | Title must start with "Best" |
| `worst_of` | 3–100 | Title must start with "Worst" |
| `this_vs_that` | Exactly 2 | Two-sided debate |
| `fact_drop` | Exactly 1 | Source URL required |
| `counter_list` | 3–100 | Links to parent via `parent_id` |
| `hidden_gems` | 3–100 | Underrated picks |
| `article` | N/A | Long-form body, sources |

### Post Statuses

```
pending_review → approved / rejected
                ↕ (revision requested — stays pending_review)
```

### Slug Generation

```
title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + crypto.randomBytes(3).toString('hex')
```

Reserved slugs (404): `admin`, `api`, `login`, `search`, `settings`, `profile`, `categories`, `c`, `auth`, `submit`, `explore`, `articles`, `saved`, `arguments`, `hall-of-fame`, `claim`, `notifications`, `username-history`, `submit-article`

### Title Similarity Check

- Algorithm: Jaro-Winkler distance
- Threshold: ≥50% similarity → collision warning
- Checked against: last 200 approved posts + last 200 pending posts
- Returns: `{ allowed, blocked, warning, matches[], pendingConflicts[], suggestion, etag }`

### Post Model — Key Fields

```
hero_image_url, format (list_only / hero_list / full_list),
votes_a, votes_b (debate scores), fire_count (counter-list arena),
ai_score, ai_flags, ai_reviewed_at, ai_model, ai_prompt_tokens,
rejection_reason, revision_guidance, revision_requested_at, revision_count,
status_history[], parent_id (for counters), meta_robots,
deleted (soft delete), bump_score
```

---

## View Counting

### Redis-based Deduplication

```
Key format: post_view:{mongoId}:{fingerprint}
         or: article_view:{mongoId}:{fingerprint}
TTL: 1800 seconds (30 minutes)
```

**Fingerprint source chain:**
```
req.user.device_fingerprint
→ req.headers['x-device-fingerprint']
→ req.ip
→ 'unknown' (fallback)
```

**Flow:**
1. Visitor opens post/article → construct key
2. `redis.get(viewKey)` — returns truthy if viewed within 30 min
3. If **not viewed**: `Model.findByIdAndUpdate(_id, { $inc: { view_count: 1 } }, { new: true })`
4. `redis.set(viewKey, '1', { EX: 1800 })`
5. Response returns `updated.view_count` — the exact live DB value

### Inaccuracies Fixed

| Bug | Before | After |
|-----|--------|-------|
| Unconditional +1 | `(old + 1)` even when deduped | `{ new: true }` re-fetch — real DB value |
| Profile total_views | Only Post aggregation | Post + Article aggregation |

---

## AI Moderation System

### Architecture

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| DeepSeek client | `lib/aiModeration.ts` | 222 | API calls, encryption, scoring |
| Worker queue | `lib/aiModerationWorker.ts` | 105 | Redis async processing |
| Retro queue | `scripts/aiModerationRetro.ts` | — | Queues existing pending posts |
| Admin UI | `admin/settings/ai-moderation` | 283 | Configuration UI |

### Encryption

- API key encrypted with `AES-256-GCM` via `CONFIG_ENCRYPTION_KEY` env var
- Stored as `hex(iv):hex(tag):hex(ciphertext)` in `SystemConfig.ai_moderation.api_key_encrypted`

### Scoring Prompts (8 Rubrics)

| Type | Key Criteria | Flags |
|------|-------------|-------|
| `top_list` | Strong intro, substantive justifications | thin_content, gibberish, weak_justification |
| `best_of` | Title starts with "Best", positive curation | wrong_title_format |
| `worst_of` | Title starts with "Worst", specific criticism | wrong_title_format |
| `this_vs_that` | Both sides well-defined, distinct descriptions | one_sided_unbalanced |
| `fact_drop` | Genuinely surprising, credible source | missing_source, uninteresting_fact |
| `counter_list` | Clearly addresses original | no_original_rebuttal |
| `article` | Well-structured, >500 chars, sources | too_short, missing_sources |
| `hidden_gems` | Genuinely obscure picks | not_actually_underrated |

### Worker Queue

- Redis key: `ai_moderation:queue` (list), `ai_moderation:lock` (lock)
- Batch size: 10 posts per cron tick
- Cron interval: every 10 seconds
- Max retries: 3 per post (exponential backoff)
- Auto-approve when score ≥ threshold (configurable 0–100)

### Approval Modes

| Mode | Score ≥ Threshold | Score < Threshold |
|------|-------------------|-------------------|
| `approve_only` | Approved | Stays pending |
| `approve_reject` | Approved | Rejected |
| `approve_revision` | Approved | Pending with AI feedback |

---

## Counter-List Arena

### Routes

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/posts/:slug/counter` | Create counter-list rebuttal |
| `GET` | `/api/posts/:slug/counters` | List all counters for a post |
| `GET` | `/api/posts/compare/:original/:counter` | Side-by-side diff engine |
| `POST` | `/api/posts/compare/:original/:counter/vote` | "Better List" community vote |
| `GET` | `/api/posts/:slug/authority-flip` | Check if counter surpassed original |

### Fire Count

- Incremented when a counter-list surpasses its parent in community score
- AuthorityFlipBanner component shows at 20% surpass
- SEO promotion: `noindex, follow` → `index, follow` when fire_count ≥ 50

### Counter-List Fields

```typescript
Post.parent_id: ObjectId (links to parent post)
Post.fire_count: number
```

---

## Upload System

### Image Processing Pipeline

```
Upload (multipart) → multer validation (jpg/png/webp/gif/avif, max 10MB)
→ Sharp resize to 3 variants:
  - item_thumb: 400×280.webp (quality 82)
  - hero_lg: 1200×675.webp (quality 85)
  - profile: 200×200.webp (quality 85)
→ Save to /app/uploads/ (Docker named volume)
→ Return URL: /uploads/{random_hex}_{size}.webp
```

### Serving Chain

```
Browser
→ https://yotop10.com/uploads/file.webp
→ Host nginx location /uploads/
→ Backend Express static /app/uploads/
→ File served with 30d Cache-Control
```

### ImageUploader Component

- Upload button + URL paste side by side
- Preview thumbnail with remove button
- Loading/error states
- Supports jpg, png, webp, gif

---

## Search System

### Elasticsearch

- Posts indexed via `lib/indexWriter.ts`
- Indexed fields: title, intro, items[], category, author
- `POST /api/search` — full-text search with highlighting

### Redis-based Trending

- `POST /api/search/click` — tracks search term clicks per fingerprint
- 7-day rolling window
- `GET /api/search/trending` — returns top terms

### Frontend CommandSearch

- Full-screen overlay modal, `z-[100]`
- 180ms debounce on input
- Keyboard navigation: ArrowUp/Down/Enter/Escape
- `role="listbox"`, `aria-activedescendant` for accessibility
- Grouped results: Posts + Categories
- Recent searches in localStorage (max 5, removable pills)
- Trending from `/api/search/trending`

---

## Voting System (Debates)

### A/B Voting

- `POST /api/posts/:id/vote` — body: `{ side: 'A' | 'B' }`
- Fingerprint dedup via Redis (no double-voting from same device)
- `GET /api/posts/:id/vote` — read-only vote counts
- Optimistic UI updates on frontend (instant visual feedback)

### Data Stored

```
Post.votes_a: number
Post.votes_b: number
```

---

## Rate Limiting

### Dimensions

| Dimension | Method | Window |
|-----------|--------|--------|
| API requests | Host nginx leaky bucket + Redis | 20 req/s burst |
| Post submissions | Redis sorted set (per fingerprint) | Hourly |
| Comment submissions | Redis sorted set (per fingerprint) | Hourly |
| Trust-based multiplier | Calculated from trust_level | Dynamic |

### Trust-Based Multipliers

| Level | Posts/hr | Comments/hr |
|-------|----------|-------------|
| ghost | 0.4 | 2 |
| newbie | 1 | 5 |
| troll | 2 | 10 |
| neutral | 4 | 20 |
| scholar | 8 | 40 |

Boost system: `ladderSystem.ts` grants temporary boosts for activity.

---

## Notifications

### Types

| Type | Source | Storage |
|------|--------|---------|
| System notifications | `post_approved`, `post_rejected`, `revision_requested` | `notifications` collection |
| Admin messages | Broadcast and private | `admin_messages` collection with `dismissed_by[]` |
| Admin alerts | Alert engine (trust drops, spam detection) | `admin_alerts` collection |

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/users/me/notifications` | Merged feed (system + admin messages) |
| `GET` | `/api/users/me/notifications/unread-count` | Badge count |
| `PATCH` | `/api/users/me/notifications/:id/read` | Mark single read |
| `PATCH` | `/api/users/me/notifications/read-all` | Mark all read + dismiss admin messages |
| `PATCH` | `/api/users/me/messages/:id/dismiss` | Dismiss admin message |

### Polling

- `NotificationBell.tsx` fetches `/api/users/me/notifications/unread-count` every 30 seconds
- Mobile `DynamicIsland` fetches same endpoint
- Badge capped at `9+`

---

## Frontend Architecture

### Component Pattern

```
page.tsx (async server component)
  → Fetches initial data, passes as props
  → Renders client.tsx with initial{Data}
  
client.tsx ('use client')
  → useState(initialData) — hydrates from server
  → useEffect to fetch more data client-side
  → Loading: returns <PageSkeleton />
  → Error: returns error message with retry
  → Empty: returns empty state
  → Content: renders the actual UI
```

### Key Stores (Zustand)

| Store | File | State |
|-------|------|-------|
| `auth` | `stores/auth.ts` | user, loading, initialized |
| `admin` | `stores/admin.ts` | admin, permissions, token |
| `slideMenu` | `stores/slideMenu.ts` | open (boolean) |
| `rateLimit` | `stores/rateLimit.ts` | trust_score, current_tier, limits |

### Skeleton Loading Components

| File | For Page |
|------|----------|
| `HomeSkeleton.tsx` | `/` (mobile + desktop variants) |
| `ArticlesSkeleton.tsx` | `/articles` |
| `ArticleDetailSkeleton.tsx` | `/articles/[slug]` |
| `SavedSkeleton.tsx` | `/saved` |
| `NotificationsSkeleton.tsx` | `/notifications` |
| `ProfileSkeleton.tsx` | `/a/[username]` |
| `CategoriesSkeleton.tsx` | `/categories` |
| `SettingsSkeleton.tsx` | `/settings` |

### Responsive Breakpoints

| Name | Width | Layout |
|------|-------|--------|
| Mobile | < 768px | Single column, stacked, bottom nav |
| Tablet | 768px – 1023px | Same stack, larger cards |
| Desktop | ≥ 1024px | Sidebar + grid layout |

### Desktop Layout

```
┌──────────────────────┬──────────────────────────────────────┐
│  SIDEBAR (w-64)      │  TOP BAR (search + bells + profile)  │
│  ───────────────────  │  ───────────────────────────────────  │
│  YO Top10 (big logo) │  MAIN (lg:ml-64)                      │
│  Home                │                                       │
│  Explore             │  CAROUSEL — 3 cards, newest published │
│  Categories          │                                       │
│  Arguments           │  3-column grid below:                  │
│  Saved               │  Debates (2/3) │ Articles (1/3)       │
│  Articles            │  Categories    │ Facts                 │
│  Hall of Fame        │  Trending │ HoF │ Stats               │
│  ───────────────────  │  CTA Banner                           │
│  @userinfo           │                                       │
│  Settings  🌙        │                                       │
│  [+ Submit a List]   │                                       │
└──────────────────────┴──────────────────────────────────────┘
```

### Mobile Layout

```
┌─ TOP BAR ──────────────────────────────┐
│ Logo        Search          ☰  🔔  👤  │
├─────────────────────────────────────────┤
│  CAROUSEL (horizontal scroll)           │
├─────────────────────────────────────────┤
│  Hot Debates (2 cards on mobile)        │
├─────────────────────────────────────────┤
│  Categories (4 pill buttons)            │
├─────────────────────────────────────────┤
│  Did You Know? (auto-cycling fact)      │
├─────────────────────────────────────────┤
│  Recent Articles (compact list)         │
├─────────────────────────────────────────┤
│  Submit a List                          │
├─────────────────────────────────────────┤
│  BOTTOM NAV                             │
│ 🏠 🔍 💬 🔔 👤                         │
└─────────────────────────────────────────┘
```

### Key Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `DesktopSidebar` | Permanent left nav | _(reads auth store)_ |
| `DesktopCarousel` | 3-cards-visible scroll | `posts: Post[]` |
| `PostCarouselCard` | Card inside carousel | `post: Post` |
| `DesktopDebates` | 2×2 debate grid (desktop) | `debates, className` |
| `HomeDebates` | Stacked debate cards (mobile) | `debates` |
| `DesktopArticles` | Magazine grid (desktop) | `articles, className` |
| `HomeArticles` | Compact list (mobile) | `articles` |
| `DesktopCategories` | 3×3 icon grid (desktop) | `categories, className` |
| `DesktopFacts` | Wide knowledge panel | `facts, className` |
| `DesktopTrending` | Trending search pills | `className` |
| `DesktopHallOfFame` | Featured posts | `className` |
| `DesktopStats` | Platform counters | `className` |
| `DesktopCta` | Banner CTA | `className` |
| `SlideMenuPanel` | Hamburger slide-out | _(reads slideMenu store)_ |
| `DynamicIsland` | Mobile bottom nav | _(reads auth store)_ |
| `CommandSearch` | Full-screen search overlay | `open, onClose` |
| `BookmarkButton` | Save/unsave toggle | `postId, contentType` |
| `ImageUploader` | Upload + URL paste | `currentUrl, onUpload` |
| `ShareModal` | Social sharing | `slug, title, postId` |
| `PostPendingClient` | Pending post page | `title, postId, queueNumber, isRejected` |
| `HeaderBells` | Desktop notification bell | _none_ |

---

## SEO

### Indexing Rules

| Condition | Directive |
|-----------|-----------|
| Approved post, active (comments/views within 48h) | `index, follow` |
| Stale post (48h, 0 comments, 0 views) | `noindex, follow` |
| Thin post (<100 chars intro, >24h) | `noindex, follow` |
| Pending/rejected post | `noindex, follow` |
| Counter-list (fire_count < 50) | `noindex, follow` |
| Counter-list (fire_count ≥ 50) | `index, follow` |

### Structured Data (JSON-LD)

- `ItemList` schema for ranked posts (with itemListElement)
- `BreadcrumbList` for navigation
- `Organization` + `WebSite` on root layout with `SearchAction` target
- Article schema on article pages

### Sitemaps

```
/sitemap.xml
├── /sitemap-static.xml        — Static pages
├── /sitemap-posts.xml         — Approved posts (1000 per page)
├── /sitemap-categories.xml    — Category pages
└── /sitemap-articles.xml      — Approved articles
```

---

## Error Handling

### Error Page Structure

| File | Purpose |
|------|---------|
| `app/not-found.tsx` | 404 page (styled, "Go back home" link) |
| `app/error.tsx` | Global error boundary (orange gradient Try Again button) |
| `app/admin/error.tsx` | Admin-specific error boundary |

### Error Boundary Behavior

- Server errors → `error.tsx` renders
- `notFound()` calls → `not-found.tsx` renders
- API errors → client handles with toast or inline error message
- Network errors → retry logic (3 attempts with 500ms delay)

---

## CSS Architecture

### Tailwind v4 Configuration

- CSS-first config via `@theme` block in `globals.css`
- Custom tokens: `--color-bg`, `--font-display`, `--font-accent`
- Custom radii: `--radius-card: 1rem`, `--radius-button: 0.75rem`
- Custom sizes: `--text-2xs`, `--text-3xs`, `--text-sm2`, `--text-base2`

### Light Mode

- Toggle via `localStorage` `yotop10_theme` key
- `html.light-mode` class swaps `--color-bg` to `#f8f8fa`
- ~30 CSS overrides map dark-mode Tailwind classes to light equivalents:
  - `.text-white` → `#0f0f1a`
  - `.bg-white/5` → `rgba(0,0,0,0.04)`
  - `.border-white/10` → `rgba(0,0,0,0.15)`

### Glass Layer Utilities

- `.glass-obsidian` — dark glass with 40px blur
- `.glass-frosted` — light glass
- `.glass-slab` — subtle glass with shadow

### Animations

- `cardSlideUp` — 0.5s cubic-bezier card entrance
- `cardExpandDown` — 0.4s content expand
- `ticker-scroll` — 45s infinite vertical scroll

---

## Utility Functions

| Function | File | Purpose |
|----------|------|---------|
| `formatDate` | `lib/dates.ts` | Human-readable date formatting |
| `relativeTime` | `lib/dates.ts` | "2h ago", "3d ago" |
| `absoluteUrl` | `lib/urls.ts` | Resolves relative to absolute URL |
| `apiFetch` | `lib/api/client.ts` | HTTP client with credentials + fingerprint |
| `getFingerprint` | `lib/fingerprint.ts` | Browser fingerprint calculation |

---

## Scripts

| Script | Location | Purpose |
|--------|----------|---------|
| `rebuild.sh` | `scripts/rebuild.sh` | Full CI/CD: auto-commit → push → pull → docker rebuild → healthcheck |
| `init-nginx.sh` | `scripts/init-nginx.sh` | Generate nginx config from template with domain |
| `healthcheck.mjs` | `scripts/healthcheck.mjs` | Backend health check (MongoDB + Redis + ES ping) |
| `promoteCounters.ts` | `backend/src/scripts/promoteCounters.ts` | SEO promotion for counter-lists |
| `aiModerationRetro.ts` | `backend/src/scripts/aiModerationRetro.ts` | Retroactive AI scoring of pending posts |
| `seedContentPack.ts` | `backend/src/scripts/seedContentPack.ts` | Seed 4 rich posts with real images |
| `seedCategories.ts` | `backend/src/scripts/seedCategories.ts` | Category tree |
| `seedPosts.ts` | `backend/src/scripts/seedPosts.ts` | Sample posts |
| `seedFactDrops.ts` | `backend/src/scripts/seedFactDrops.ts` | Did You Know facts |
| `seedBestWorst.ts` | `backend/src/scripts/seedBestWorst.ts` | Best/Worst lists |
| `seedArticlesVs.ts` | `backend/src/scripts/seedArticlesVs.ts` | Articles + debates |

---

## Key Environment Variables

```
MONGO_USERNAME=yotop10_admin
MONGO_PASSWORD=<hex-only, 64+ chars>
REDIS_PASSWORD=<base64, 64 chars>
ES_PASSWORD=<base64, 64 chars>
JWT_SECRET=<random string>
CONFIG_ENCRYPTION_KEY=<32+ chars, used for AES-256-GCM>
CORS_ORIGINS=https://yotop10.com,https://www.yotop10.com
INTERNAL_API_URL=http://backend:8000/api
NEXT_PUBLIC_INTERNAL_API_URL=http://backend:8000/api
NEXT_PUBLIC_SITE_URL=https://yotop10.com
NGINX_SERVER_NAME=yotop10.com
```

---

## Technology Versions

| Component | Version |
|-----------|---------|
| Node.js | 20-alpine |
| Next.js | 15.5.18 |
| React | 19.2.4 |
| TypeScript | (strict mode) |
| Mongoose | 8.23.1 |
| Express | 4.x |
| Lucide React | 0.471.x |
| Sharp | latest |
| Tailwind CSS | v4 |
| Redis | 7.x |
| MongoDB | 7.x |
| Elasticsearch | 8.x |
| nginx | 1.27.4-alpine |
| pnpm | 9 |
| Docker Compose | v3 |

---

## File Count & Size

| Directory | Files | Total (approx) |
|-----------|-------|----------------|
| `backend/src/routes/` | ~19 files | ~8,500 lines |
| `backend/src/models/` | ~14 files | ~800 lines |
| `backend/src/lib/` | ~15 files | ~1,500 lines |
| `backend/src/middleware/` | 1 file | ~170 lines |
| `backend/src/scripts/` | ~8 files | ~1,200 lines |
| `frontend/src/app/` | ~55 pages | ~6,000 lines |
| `frontend/src/components/` | ~40 components | ~4,500 lines |
| `frontend/src/stores/` | 4 files | ~180 lines |
| **Total** | **~156 files** | **~22,000+ lines** |
