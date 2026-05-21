# YoTop10 — Product Specification (Open Platform)

> An open Wikipedia-style platform for top 10 lists with a social UI. Anyone can browse, submit, and comment without creating an account. Only the admin can approve/reject posts for quality control.

---

## 1. Brand Identity

| Field | Value |
|---|---|
| **Name** | YoTop10 |
| **Tagline** | *"Fact mine. Debate ground. Your list vs the world."* |
| **Positioning** | Wikipedia × Social Feed — open platform for ranked lists |
| **Tone** | Community-driven, fact-focused, open |
| **Audience** | Global. Anyone with a top 10 list to share. |

---

## 2. Core Concept

YoTop10 is an **open publishing platform** centered on:
- **Top lists** (Top 10, Top 5, Top 25, etc.)
- **Debates** (This vs That, Who Is Better, Best Of)
- **Fact drops** (sourced opinion pieces disguised as ranked content)

**Key Difference:** No accounts required. No login. No barriers. Anyone can submit and comment. Admin approve/reject content.

---

## 3. Post / Content Types

| Type | Description | Example |
|---|---|---|
| **Top List** | Ranked items with written justification per item | "Top 10 Most Influential Scientists Ever" |
| **This vs That** | Two-item head-to-head comparison | "Kendrick vs Drake: Who Really Won?" |
| **Who Is Better** | Multi-candidate comparison | "Messi, Ronaldo, Pelé — Final Verdict" |
| **Fact Drop** | Short sourced statement or discovery | "5 facts about X that nobody talks about" |
| **Best Of [Period]** | Time-scoped curated lists | "Best Movies of 2024" |
| **Worst Of** | Inverse list (controversy magnet) | "Top 10 Most Overrated Albums" |
| **Hidden Gems** | Underrated/undiscovered topic lists | "10 Countries No One Talks About" |
| **Counter List** | A direct rival to an existing list | "My rebuttal to [Author]'s Top 10 Rappers" |

> All post types support images per item and optional source citations.

---

## 4. List Format Rules

- **Length**: Flexible (Top 5 to Top 25+), but default and preferred is **Top 10**
- **Items**: Each item requires a **title + written justification** (mandatory)
- **Sources**: Optional but strongly encouraged
- **Images**: One image per item (optional). No videos. Clean reading experience.
- **Categories**: Every post must select exactly 1 category

---

## 5. Anonymous User System

### User Identity Format

All users are **anonymous** with this format:

```
Username: a_XXXX
Example: a_9Gh7, a_abc1, a_k4m9
```

- **Format**: `a_` + last 4 characters of 8-character alphanumeric user ID
- **User ID**: 8-character alphanumeric (e.g., `a1b2c3d4`)

### Username Customization

Users can **customize** their display name in their profile page:
- Keep `a_` prefix
- Change last 4 characters to anything they want
- Example: `a_9Gh7` → `a_nekw` (if available)
- **Must be unique** - check availability before saving

### Device Fingerprinting

For anonymous identity tracking, use **all** of these signals:

| Signal | Description |
|--------|-------------|
| Canvas fingerprint | GPU rendering hash |
| WebGL fingerprint | Graphics capabilities hash |
| Audio context fingerprint | Audio hardware hash |
| Screen resolution | Width x Height + color depth |
| Timezone | UTC offset |
| Language | Browser language |
| Installed fonts | Font detection |

Combine all signals into a **unique device fingerprint hash**.

### Profile Page

Each anonymous user has a public profile at `/a/[username]`:
- Shows all posts made by user
- Shows **approved** posts (public)
- Shows **rejected** posts (with "Rejected" badge - only visible to author)
- Shows **pending** posts (with "Pending" badge - only visible to author)
- Display name customization option
- No password/email needed - identity is device-based

#### Profile Stats Tab (Authenticated User Only)
When viewing your own profile, an additional "Stats" tab is available showing real-time system status:
- Current trust score and tier (Troll/Neutral/Scholar)
- Real-time remaining rate limits:
  - Posts remaining this hour
  - Comments remaining this hour
  - Reactions remaining this hour
- Countdown timer until rate limits reset
- Exact current limits based on trust score
- Counter lists are always shown as "Unlimited"

All counters update automatically after each action.

---

## 6. Feed System

### Public Feed (Homefeed)
- Shows all **approved** posts
- **Newest first** (no algorithm, no ranking)
- Filter by category
- Pagination (20 posts per page)
- **Anyone can view** - no login required

### Category Feed
- URL: `/c/[slug]`
- Posts filtered by specific category
- Same sorting: newest first

### Browse Categories
- URL: `/categories`
- Shows all available categories
- Click to filter feed by category

---

## 7. Review & Moderation System

### Admin Only
- **You** are the only admin
- All new posts enter a **review queue** before hitting the public feed
- **Approve** → Goes to public feed
- **Reject** → Stays in author's personal feed only

### Review Queue
- URL: `/admin/dashboard`
- List all pending posts
- One-click approve/reject
- Optional: Add rejection reason

### Post Status Flow
```
draft → pending_review → [approved / rejected]
```

---

## 8. Comment System (Advanced Feature)

### Two Comment Modes

#### Item Comment
- Anchor comment to a **specific list item**
- The item is highlighted when viewing comment
- Use case: "This item should be #3, not #7 because..."

#### Full Post Comment
- Comment on the **list as a whole**
- General discussion about the entire list
- Use case: "Great list! What about..."

### Nested Replies
- Support **nested replies** (max **10 levels**)
- Level 1: Direct comment on post/item
- Level 2: Reply to Level 1 comment
- Levels 3-10: Deep nested replies
- No further nesting allowed

### Comment Features

| Feature | Description |
|---------|-------------|
| Display Name | Anonymous (any_XXXX format) |
| Content | Text comment (max 2000 chars) |
| Timestamp | Auto-recorded |
| Item Anchor | Optional - link to specific list item |
| Parent | Optional - for nested replies |
| Edit Window | 2-hour edit window after posting |

### Rate Limiting
All rate limits use 2D soft gradient floor algorithm with guaranteed minimums:

| Action | Base Limit | Absolute Minimum | Trust Multiplier |
|--------|------------|------------------|------------------|
| **General Comments** | 20 per hour | 10 per hour | 0.5x - 2.0x |
| **Item-Anchored Comments** | 25 per hour | 12 per hour | 0.5x - 2.0x |
| **Posts** | 4 per hour | 2 per hour | 0.5x - 2.0x |
| **Counter Lists** | Unlimited | Unlimited | Always unlimited |
| **Burst Protection** | Max 5 comments per 5 minutes | | |

#### Rate Limit Transparency
Every user can view their exact rate limit status in real-time on their profile Stats tab:
- Remaining posts/comments this hour
- Countdown timer until reset
- Current trust score and tier
- Exact limits they are subject to
- All counters update automatically after every action

- No rate limit for browsing (only authenticated actions are limited)

---

## 9. Categories System

### Category Hierarchy
- **10 Major Parent Categories**
- **300 Default Child Categories** distributed across parents
- Each child category has one parent
- Example: `Technology & Digital → Artificial Intelligence (AI)`

### Default Categories (10 Parents)

1. **Technology & Digital**
2. **Health & Wellness**
3. **Business & Finance**
4. **Lifestyle & Leisure**
5. **Creative Arts & Entertainment**
6. **Education & Self-Development**
7. **Home & Family**
8. **Professional & Industrial**
9. **Social & Global Issues**
10. **Niche Hobbies & Collections**

### Category Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique identifier |
| name | String | Yes | Display name |
| slug | String | Yes | URL-friendly (unique) |
| icon | String | No | Emoji or icon identifier |
| description | String | No | Short description |
| parent_id | UUID | No | Parent category ID |
| post_count | Integer | Auto | Number of posts |
| is_featured | Boolean | No | Show on homepage |
| is_archived | Boolean | No | Soft delete |

### Post Creation
- Every post must select **exactly 1 category**
- Maximum: 1 category per post

---

## 10. Admin Dashboard

### Admin Authentication
- Username + password login with bcrypt password hashing
- JWT token stored in httpOnly secure cookie
- Token expiry: 24 hours (super_admin) / 12 hours (other roles)
- Brute-force protection: 10 attempts per 15 minutes per IP, account lock after threshold
- One-time setup token generated via server shell command, expires in 15 minutes
- Maximum ONE active admin user enforced
- Automatic session invalidation when new admin is created
- Fine-grained RBAC with 31 permissions across 4 role presets

### Admin Features (All Fully Implemented)

**Review Queue:**
- List pending posts (filterable by category, post type, author, date range)
- Approve (triggers trust score update, ES indexing, boost grant)
- Reject with required reason (triggers trust score penalty)
- Request revision with admin guidance feedback to author
- Bulk approve/reject (max 50 at a time)
- Keyboard shortcuts: A=Approve, R=Reject, E=Request Revision
- Double-blind review (moderator never sees username/trust score during review)
- Collision detection (similar pending titles highlighted)

**Posts Management:**
- Table view with search, filter, sort, pagination
- View, edit, soft delete, hard delete, restore
- Feature/unfeature from Hall of Fame
- Lock/unlock comments
- Bump to top of feed
- Bulk operations: delete, recategorize
- Individual list item CRUD
- Post duplication
- Activity log viewer
- Quality checker
- CSV export

**Comments Management:**
- Table view with search, filter, sort
- Edit, delete, hide, highlight
- Flag and dismiss flags
- Apply trust score penalties
- Bulk operations
- CSV export

**Users Management:**
- Table view with search, filter by trust score, post count, ban status
- View profile (all posts/comments)
- Ban (prevent all write operations)
- Whitelist (bypass rate limits)
- Shadow ban (user can post but only they see it)
- Manual trust level lock (scholar/neutral/troll/automatic)
- Per-user rate limit overrides
- Trust score history audit trail

**Statistics Dashboard:**
- 17 API endpoints across 15 collapsible panels
- Overview, content stats, community health, moderation metrics
- Category analytics, trend data, quality scores, traffic
- Hardware health (MongoDB, Redis, Elasticsearch)
- Alert summary, comparison metrics, notification stats

**Alert System:**
- 12 metrics evaluated every 60 seconds
- Configurable thresholds (create, update, delete, enable/disable)
- Breach detection with cooldown periods
- Admin bell badge with unread count
- Severity-colored notifications (critical/warning/info)
- Alert detail page with live status and resolution guide
- Resolution tracking and history

**Audit Logs:**
- All admin actions logged (login, approve, reject, delete, etc.)
- 90-day retention with TTL index
- Filterable by action type, admin user, date range
- CSV export
- IP-based throttling (300/minute)

**Outbound Messaging:**
- Individual messages to specific users
- Broadcast messages to all users
- Reusable message templates
- Delivery statistics (sent, seen, dismissed)
- Message retraction

**Search Management:**
- Elasticsearch cluster health status
- Reindex by scope (all, posts, comments, categories, users)
- Index recreation
- Mappings viewer
- Test search query tool

**Other:**
- System configuration (runtime config store, admin-editable)
- Hall of Fame management (add, remove, reorder, editorial notes, candidate suggestions)
- Moderator management (create, edit, delete mod users with role assignment)
- Category CRUD with tree management (backend complete, frontend tree UI pending)

---

## 11. Page Structure (Routes)

```
/                          → Public feed (newest first)
/arguments                 → Arguments Page (Hot Debates)
/explore                   → Algorithmic Explore feed
/hall-of-fame             → Hall of Fame (Best Lists)
/saved                    → Bookmarked posts
/articles                 → Long-form articles feed
/articles/[slug]          → Article reader
/submit                    → Anonymous post submission
/submit-article            → Article submission
/search                    → Full-text search
/categories               → Browse all categories
/c/[slug]                 → Category feed
/[slug]                    → Post detail + comments
/[slug]/history            → Post changelog/revisions
/a/[username]              → User profile (e.g., /a/9Gh7)
/username-history          → Username change history
/claim                     → Identity claim (seed phrase)
/notifications            → Notification feed
/notifications/[id]       → Single notification
/admin                     → Admin dashboard
/admin/login               → Admin login
/admin/setup               → One-time admin setup
/admin/profile             → Admin profile
/admin/posts               → All posts management
/admin/posts/pending       → Review queue
/admin/comments            → Comments management
/admin/categories          → Categories management
/admin/statistics          → Dashboard statistics
/admin/alerts              → Alert system management
/admin/audit               → Audit logs
/admin/notifications       → Outbound messaging
/admin/hall-of-fame        → Hall of Fame management
/admin/search              → Search management
/admin/settings            → Rate limits & trust scores
/admin/users               → Users management
```

---

## 12. Design System

### Theme 1: Retro (DEFAULT)
- **Palette**: Classic Myspace palette — hot pink, teal, lime, dark navy
- **Feel**: Nostalgic, raw, expressive
- **Default theme** - loads automatically

### Theme 2: Futuristic (Optional)
- **Palette**: Orange-Red, Hot Pink, White, Deep Black
- **Feel**: Premium, clean, minimal
- User-selectable

---

## 13. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router) |
| **Backend** | Node.js + Express |
| **Database** | MongoDB + Mongoose |
| **Cache** | Redis |
| **Search** | Elasticsearch 8 |
| **Auth** | Device fingerprint (no JWT for users) |
| **Admin Auth** | JWT + bcrypt (admin only) |
| **State** | Zustand |
| **Validation** | Zod (runtime), TypeScript (compile-time) |

---

## 14. What's Different From Original Plan

### Disabled/Commented Out (Not Deleted)
- User registration
- User logins (regular users)
- Google OAuth
- JWT for regular users
- Follow system
- Connection system
- Strike system
- Report system
- Communities
- Ephemeral threads
- Badges
- Multi-account
- NextAuth.js

### Now Implemented (Originally Planned as Disabled or Post-MVP)

**Core Platform:**
- Anonymous posting (`a_XXXX` usernames via device fingerprint)
- User profiles — anonymous `/a/[username]` with Posts/Comments/Stats tabs
- Device fingerprinting — 3-tier system (Tier 0 machine-stable, Tier 1 browser, Tier 2 minor) via custom implementation
- Advanced comment system — nested 10-level, item-anchored, SparkScore-ranked
- Categories — 10 parents, 300 children, full public + admin API
- Post submission form — 903-line page with draft recovery, title similarity check, dynamic items
- Articles — separate long-form content model with Markdown body
- Hall of Fame — admin-curated featured posts with candidate suggestions
- Arguments page — hot debates feed (this_vs_that + counter_list) with Redis velocity tracking
- Explore page — algorithmic trending feed with 5-factor scoring (recency, engagement, authority, velocity, diversity)
- Bookmarks/saved posts — Redis-cached, optimistic toggle
- Search — Elasticsearch 4-index full-text search with facets, autocomplete, "did you mean?" suggestions
- Notifications — user-facing feed (system + admin messages)
- Post history/changelog — version listing with status tracking
- Share system — clipboard copy with UTM tracking

**Admin Dashboard:**
- Admin login — JWT + bcrypt with brute-force protection, account lock, IP-based rate limiting
- One-time setup token — shell-generated, 15-minute expiry, single-admin enforcement
- Review queue — approve/reject with trust score updates, request revision, bulk operations
- All posts management — table with search, filter, export, individual item CRUD, soft delete, restore
- Comments management — edit, delete, hide, highlight, flag, trust penalty, bulk operations
- Users management — ban, whitelist, shadow ban, trust level lock, per-user rate limit overrides
- Statistics dashboard — 17 endpoints across 15 collapsible panels (overview, content, community, moderation, trends, traffic)
- Alert system — 12 metrics evaluated every 60s, threshold CRUD, breach notifications, resolution tracking, history
- Audit logs — 90-day retention, fire-and-forget writes, CSV export, IP-based throttling
- Outbound messaging — individual + broadcast messages to users, reusable templates, delivery stats
- Search management — ES cluster health, reindex (all/posts/comments/categories/users), index recreation, mappings viewer
- Hall of Fame management — add, remove, reorder, editorial notes, auto-candidate suggestions
- Moderator system — 31 permissions, 4 presets (Super Admin, Content Moderator, Analyst, Moderator), RBAC enforcement
- System configuration — runtime config store (MongoDB + Redis-cached, 60s refresh), admin-configurable via UI

**Identity & Reputation:**
- Trust Score Engine V2 — rolling 50-review window, logarithmic scaling, asymmetric penalties, hysteresis thresholds (enter 1.85, exit 1.70), optimistic concurrency control
- Smart rate limiting — 2D soft gradient with guaranteed minimums, atomic Lua script in Redis
- Ladder Boost system — temporary rate limit boosts (4 types: post approved, comment fires, comment replies, counter list submitted)
- Identity portability (M15) — 12-word BIP39 seed phrases, Ed25519 challenge-response, multi-device linking
- SparkScore comment ranking — time-decay with gravity + floor, percentile thresholds, parent propagation
- Automated flag detection — spam repetition, link-first detection, brigading detection (60s cron)
- Double-blind moderation — reviewers never see username/trust score during review

**Infrastructure:**
- Zustand state management — 4 stores (auth, admin, rateLimit, slideMenu)
- Zod environment validation — all env vars validated at startup, crash-early pattern
- API client domain split — 11 endpoint modules (posts, comments, admin, users, reactions, categories, identity, articles, explore, bookmarks, arguments)
- 40+ reusable UI components — GlassSlab, DataCard, ArgumentBar, PostCarouselCard, DynamicIsland, CommandSearch, etc.
- Singleton Redis + Elasticsearch clients — shared connections, no per-request create/destroy
- Route barrel export — static imports with `RouteDefinition[]` metadata, TypeScript-enforced
- Clean architecture — pure functions in lib/, business logic extracted from route handlers

### What Stays Active
- Anonymous posting (a_XXXX format)
- Device fingerprinting
- Advanced comment system with nesting
- Categories (full public + admin implementation)
- Admin dashboard with all management features
- Post review queue
- Trust Score Engine V2
- Rate Limiting (trust-aware, atomic)
- SparkScore comment ranking
- Identity portability (seed phrases)
- Elasticsearch search
- Explore algorithmic feed
- Bookmarks/saved posts
- Notifications

---

## 15. Arguments Page (Hot Debates)

> "The Talk Page" - Where the magic happens

### Purpose
The Arguments page aggregates the most active **Item-Anchored Comments** across the entire platform. This is the billboard that attracts engagement - "People are arguing about this specific fact right now."

### Why It Matters
- Users on X/Reddit love jumping into a fight
- Shows "Item #4 on 'Top 10 Rappers' has 50 new comments"
- Without this, "Advanced Commenting" is buried
- Acts as a magnet for engagement

### Features

#### Page URL
- `/arguments` or `/debates`

#### Display
- List of **Item-Anchored Comments** with most activity
- Shows: Post title, Item number, Comment preview, Reply count
- Sorted by: Most replies, Recent activity
- Grouped by Post or show individual items

#### Filtering
- By category
- By time range (today, this week, this month, all time)

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/arguments | List most active item-anchored comments |
| GET | /api/arguments/{post_id} | Arguments for specific post |

---

## 16. Hall of Fame (Static Rankings)

> The "Gold Standard" lists - Wikipedia's "Featured Articles"

### Purpose
A "Trending" page is often just a "Newest" page with more clicks. Instead, build a Hall of Fame - the lists that have been confirmed or have stayed active for months.

### Why It Matters
- People go to Wikipedia for the "Final Word"
- Builds the "Fact Mine" reputation
- Separates the "trolls" from the "scholars"
- Admin-curated + community-vetted

### Features

#### Page URL
- `/hall-of-fame` 

#### Selection Criteria
- **Admin Picks**: You manually feature lists
- **Community Confirmed**: Lists with 50+ item-anchored comments, majority not challenged
- **Time-Tested**: Lists active for 3+ months with consistent engagement
- **Low Controversy**: Lists with more "Confirmed" verdicts than "Contested"

#### Display
- Featured lists at top
- Category sections below
- Static - not sorted by algorithm
- Badge: "Hall of Fame" icon

#### Admin Controls
- Manually add/remove lists
- Feature/unfeature
- Add editorial notes

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/hall-of-fame | List Hall of Fame posts |
| POST | /api/admin/hall-of-fame | Add to Hall of Fame (admin) |
| DELETE | /api/admin/hall-of-fame/{id} | Remove from Hall of Fame (admin) |

---

## 17. Post Changelog / Revisions

> Wikipedia's "View History" - Living documents

### Purpose
Since posts can be updated and Counter Lists can be submitted, users want to see what changed. This makes the platform feel like a living document rather than a disposable blog post.

### Features

#### Version History
- Every edit creates a new version
- Stores: timestamp, author, changes summary
- View any previous version
- Compare versions side-by-side

#### Changelog Display
- URL: `/post/[id]/history` or `/post/[id]/changelog`
- Shows: Version number, Date, Author, Change summary
- Click to view full content at that version

#### What Triggers New Version
- Author edits their post (within 2-hour window)
- Admin edits post
- Counter List is submitted (creates reference, not version)

#### Fields to Store

```python
class PostRevision:
    id: UUID
    post_id: UUID
    version_number: int
    title: str
    intro: str
    items: JSON          # List items at this version
    created_at: datetime
    author_id: UUID
    change_summary: str  # Optional note about what changed
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/posts/{id}/history | List all revisions |
| GET | /api/posts/{id}/history/{version} | Get specific revision |
| GET | /api/posts/{id}/compare | Compare two versions |

---

## 18. Counter-List & Rebuttal System

> Side-by-side debates - The "Backlink" system

### Purpose
Every Post Detail page should have a prominent "Submit a Counter-List" button. This creates a backlink between the original list and the rebuttal.

### Features

#### Counter-List Button
- **Prominent button** on every Post Detail page: "Submit a Counter-List"
- Links to submission page with original post pre-selected

#### Rebuttal Link
- On original post: Shows all counter-lists
- On counter-list: Shows original post it's rebutting
- Creates a "debate chain" visual

#### Post Types
- Counter Lists are a **post type** (already in spec)
- No review required - publishes immediately
- Original list always displayed prominently

### Display on Post Detail

```
[Post Title]
[Intro]

[Item 1] ← Comments
[Item 2] ← Comments
[Item 3] ← Comments

[Counter Lists]
├── "Why Item #2 is Wrong" by any_abc1
└── "My Rebuttal" by any_xyz9

[Submit a Counter-List] ← Prominent Button
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/posts/{id}/counter-lists | Get all counter-lists for a post |
| POST | /api/posts | Submit counter-list (with original_post_id) |

---

## 19. Smart Rate Limiting

> Weighted/Contextual limits - Not blunt instruments

### A. Velocity Rule (Burst Protection)

**Rule**: Allow bursts, prevent dumps

| Limit Type | Value |
|------------|-------|
| Per 5 minutes | 5 comments |
| Per hour | 20 comments |

**Why**:
- Stops bot from dumping 20 comments in 1 second
- Allows humans to have back-and-forth conversation
- More natural engagement pattern

### B. Anchor Distinction

Different limits for different comment types:

| Comment Type | Per Hour Limit | Rationale |
|--------------|----------------|-----------|
| **General Post Comments** | 5 comments | Usually "Nice list!" or "This sucks." Low value. |
| **Item-Anchored Comments** | 25 comments | This is where the "Fact Mine" happens. Encourage specific debates. |

**Why**:
- Item-anchored comments = higher quality
- General comments = noise
- Rewards meaningful engagement

### C. Shadow Trust Score (Fingerprint Logic)

Since we use Device Fingerprinting, track a **"Success Rate"** per device:

| User History | Trust Score Range | Comment Limit Multiplier |
|--------------|-------------------|-------------------------|
| **Scholar** (last 10 posts ≥7 approved) | 1.8 - 2.0 | 2x |
| **Neutral** (mixed history) | 0.5 - 1.79 | 1x |
| **Troll** (last 10 posts ≤3 approved) | 0.1 - 0.49 | 0.5x |

#### 2D Soft Gradient Rate Limiting Algorithm
All rate limits use this exact formula to guarantee minimum limits while preserving incentive gradients:

```javascript
effective_trust = trust < 1.0 
  ? 0.5 + (trust * 0.5)    // Soft gradient mapping
  : trust

limit = max(MINIMUM_GUARANTEE, floor(BASE_LIMIT * effective_trust))
```

⚠️ **Implementation Note**: Currently uses `Math.floor()`. Planned change to `Math.round()` documented in implementation plan.

This produces:
- No user ever gets 0 for any action
- Guaranteed minimums: 2 posts/hour, 10 comments/hour
- Smooth gradient - every trust score improvement matters
- No hard discontinuities
- No silent bans

**Counter List Exception**:
✅ **Counter Lists are 100% unlimited for all users**. No rate limit ever applies. This is a core platform guarantee.

### Implementation Summary

| User Type | Regular Posts/hr | Counter Lists/hr | Post Comments/hr | Item-Anchored/hr | Scholar? |
|-----------|------------------|------------------|------------------|------------------|-----------|
| **New User** | 4 | **UNLIMITED** | 5 | 25 | No history |
| **Scholar** | 8 | **UNLIMITED** | 10 | 50 | 7+ approved |
| **Neutral** | 4 | **UNLIMITED** | 5 | 25 | Mixed |
| **Troll** | 2 | **UNLIMITED** | 1 | 5 | 3+ rejected |

✅ **Counter Lists are unlimited for everyone, always. No exceptions.**

---

## 20. Future Features (Post-Launch)

When you're ready, you can re-enable:
- User accounts (email/Google OAuth)
- Follow/Connection system
- Communities
- Badge system
- Custom profiles (HTML/CSS)
- Strikes/report system
- Ephemeral threads
- Multi-account support
- And more...

---

## 21. Feature Status Reference (Audit 2026-05-21)

### Fully Implemented (108 features)
All core platform features, admin dashboard, backend infrastructure, and frontend UI are fully implemented and verified in code. See §14 "Now Implemented" for the comprehensive list.

### Partially Implemented (6 features)

| Feature | Implemented | Missing |
|---------|------------|---------|
| Post edit history | Status change tracking (approvals/rejections) | No content revision diffs, no versioned edits, no compare across versions |
| Counter-list Arena (M5.6) | `counter_list` post type, unlimited rate limit, included in arguments feed | No rebuttal endpoint (POST /:slug/counter), no battle view, no comparison engine, no SEO independence logic |
| Admin category tree (frontend) | Full backend CRUD, stats, analytics, health, bulk operations | Frontend tree view, drag-drop reorder, status workflow (draft/published/hidden), templates, RSS feeds, slug redirects |
| Admin UI components | 17 of 24 planned components built | Missing: StatsChart, CategoryTree (drag-drop), UserBadge, SearchInput (global admin), DateRangePicker, ExportButton, ConfirmDialog |
| V2 design themes | Dark/light toggle, 4-font system, glass morphism | Futuristic theme and Retro (Myspace) theme as distinct theme systems |
| V2 post changelog | History page exists | No versioned content diffs, no side-by-side comparison |

### Stub Routes (Not Implemented by Design)
- `/api/auth/*` — login, register, logout (all return 501)
- `/api/listings/*` — all 5 endpoints return 501
- `/api/reviews/*` — all 5 endpoints return 501
- `/api/users` (GET /, PUT /:id, DELETE /:id) — partial stubs return 501

### Not Yet Built (Documented in milestones)

**M5.6 — Counter-List Arena System:**
- POST /api/posts/:slug/counter — create rebuttal post
- GET /api/posts/:slug/counters — fetch all challenges
- GET /api/posts/compare/:original/:counter — get diff data
- POST /api/posts/compare/:original/:counter/vote — community vote
- SEO independence threshold logic
- Authority flip signal
- Spark-to-index ratio quality gate

**M10.7 — Admin Category Tree (Frontend):**
- Collapsible tree structure with drag-drop reorder
- View toggle (Tree/Table/Flat List)
- Inline edit modal with auto-slug
- Status workflow (draft/published/hidden)
- Scheduled activation/archival (publish_at/archive_at)
- Category templates
- Slug history tracking with redirects
- Category RSS feeds

**V2 Features:**
- Futuristic theme system
- Retro (Myspace) theme system
- Email notifications (post approval/rejection)
- JSON identity file download
- "This is your only key" warning UI
