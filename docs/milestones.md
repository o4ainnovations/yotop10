# YoTop10 — Build Milestones

> **Platform**: Open anonymous top 10 lists platform. No login required. Admin-only review.
> **Stack**: MERN — MongoDB + Express + Next.js + Elasticsearch
> **Note**: All styling deferred until after MVP. Platform functions with minimal styling until launch.

---

## Overview

This is the simplified roadmap based on the [revert.md](./revert.md) plan. The platform transforms from a full social platform into an open Wikipedia-style platform:

- **Anyone** can submit top 10 lists (anonymous, device fingerprint tracked)
- **Anyone** can comment with nested threading (up to 10 levels)
- **Categories** are fully organized (10 parents, 300 children)
- **Only you** (admin) can approve/reject posts
- **Smart rate limiting**: 50 comments/hour per user (device fingerprint)
- **Shadow Trust Score**: Rewards "scholars" (2x limits), chokes "trolls"

---

## CORE SPECIFICATIONS

### Anonymous User Identity
- **Username Format**: `a_XXXX` (e.g., `a_9Gh7`)
  - `a_` + last 4 characters of 8-character alphanumeric user ID
  - Example: User ID `xyza1b2c3d4` → Username `a_1b2c`
- **Display Name Customization**: Users can change **any suffix after the `a_` prefix** (unlimited length)
  - Example: `a_9Gh7` → `a_gojominitia`, `a_alphax5`, `a_z` (any length, alphanumeric only)
  - Only the `a_` prefix is mandatory
- **Scholar Status Upgrade**: Users with Trust Score ≥ 1.8 automatically lose the `a_` prefix completely. Usernames become fully custom.
- **Profile Page**: `/a/[username]` shows all posts (Approved/Rejected/Pending with badges)

### Device Fingerprinting
Track anonymous users using:
- Canvas fingerprint (GPU rendering hash)
- WebGL fingerprint (graphics capabilities hash)
- Audio context fingerprint (audio hardware hash)
- Screen resolution (Width x Height + color depth)
- Timezone (UTC offset)
- Language (browser language)
- Installed fonts (font detection)

### Rate Limiting (Per User, Not IP)
All limits use 2D soft gradient floor algorithm:
| Action | Base Limit | Guaranteed Minimum | Trust Multiplier Range |
|-------|-------|---------------------|------------------------|
| General Comments | 20 per hour | 10 per hour | 0.5x - 2.0x |
| Item-Anchored Comments | 25 per hour | 12 per hour | 0.5x - 2.0x |
| Posts | 4 per hour | 2 per hour | 0.5x - 2.0x |
| Counter Lists | Unlimited | Unlimited | Always unlimited |
| Burst Protection | Max 5 comments per 5 minutes | | |

### Shadow Trust Score
| User Type | Trust Score Range | Rate Limit Multiplier |
|-----------|-------------------|------------------------|
| Scholar | 1.8 - 2.0 | 2x |
| Neutral | 0.5 - 1.79 | 1x |
| Troll | 0.1 - 0.49 | 0.5x (minimum guaranteed) |

---

## PHASE 1 — MVP LAUNCH (V1)

### M1 — Project Foundation
- [x] Monorepo structure (`/frontend` + `/backend`)
- [x] Next.js 15 frontend (App Router)
- [x] Express.js backend
- [x] MongoDB setup (local + connection)
- [x] Elasticsearch setup
- [x] Redis setup (rate limiting, caching)
- [x] Docker Compose (frontend, backend, MongoDB, Redis, Elasticsearch)
- [x] Environment configuration

### M2 — Database Schema
- [x] `users` collection
- [x] `posts` collection (author_id, author_username, author_display_name, title, post_type, intro, status, category_id, comment_count, view_count, format, hero_image_url, created_at, updated_at)
  - [x] `post_type` enum: `top_list`, `this_vs_that`, `best_of`, `counter`, `article`, `who_is_better`, `fact_drop`, `worst_of`, `hidden_gems`
- [x] `list_items` collection (post_id, rank, title, justification, image_url, source_url)
- [x] `comments` collection (post_id, list_item_id, parent_comment_id, depth, author_id, author_username, author_display_name, content, fire_count, reply_count, created_at, updated_at)
- [x] `reactions` collection (user_device_fingerprint, target_type, target_id, reaction_type, created_at)
- [x] `categories` collection (name, slug, description, icon, parent_id, post_count, is_featured, is_archived)
- [x] `admin_user` collection (username, password_hash)
- [x] MongoDB indexes for performance
- [x] Seed 10 parent + 300 child categories
- [x] `articles` collection (author_id, title, slug, body (markdown), reading_time, cover_image, sources[], fact_check_status, related_posts[], created_at, updated_at) — separate long-form content model
- [x] `saved_posts` collection (user_id, post_id, saved_at) — compound index on (user_id, saved_at)

### M4 — Public Feed
- [x] `GET /api/posts` — Approved posts only
  - Filter: `status=approved`
  - Sort: newest first
  - Filter by category (exactly 1)
  - Pagination (20 per page)
- [x] `GET /api/posts/:id` — Single post with items + comments

### M5 — Post Detail Page
- [x] Frontend: `/post/[id]`
- [x] Full post display with ranked list items
- [x] Item-anchored comments (highlight specific item)
- [x] Nested comments (max 10 levels)
- [x] Fire reactions (toggle on/off)
- [x] "Submit a Counter-List" button
- [x] Post history/changelog
- [x] Share system — share_count on Post model, `POST /:idOrSlug/share` endpoint, ShareButton with clipboard copy + UTM tracking, OG/Twitter Card metadata
- [x] BookmarkButton — optimistic toggle, Lucide Bookmark icon

### M3 — Anonymous Post Submission ✅ COMPLETED
- [x] `POST /api/posts` — Submit post (no auth) - BACKEND COMPLETE
  - Body: `{ title, post_type, intro, category_slug, items, author_display_name }`
  - Supported post types: `top_list`, `this_vs_that`, `best_of`, `counter`, `article`
  - All posts default to `pending_review`
  - Generate `a_XXXX` username from device fingerprint
  - Rate limit: 2-8 posts/hour per fingerprint (trust score based)
  - Other post types (`who_is_better`, `fact_drop`, `worst_of`, `hidden_gems`) coming post-MVP
  - ✅ Counter lists are UNLIMITED for all users
- [x] Frontend: `/submit` page - COMPLETE ✅
  - Category selector with icon (slug-based, 341 options)
  - Title similarity check with debounced API (500ms), global cross-category detection
  - Dynamic list items (3-100 items, title + justification + optional source URL)
  - Title format validation (regex-based, instant client-side)
  - Default "Top 10 " title prefix
  - Optional author display name
  - Multi-layer validation (client + server)
  - WCAG 2.1 AA accessibility compliance
  - Draft recovery with localStorage (1 hour expiry, beforeunload sync)
  - Character counters and error handling

### M3.X — Article Post Type ✅ COMPLETED
- [x] `POST /api/articles` — Submit long-form article
  - Body: `{ title, body (markdown), cover_image?, sources[]?, author_display_name }`
  - Auto-generates `reading_time` from body length
  - Uses separate `Article` model (not `Post`)
  - Defaults to `pending_review`
- [x] `GET /api/articles` — All articles (approved only)
- [x] `GET /api/articles/:slug` — Single article by slug
- [x] Frontend: `/articles` — Medium-style feed with article cards (cover image, reading time badge, category badge, fact-check badge, stats row, Load More pagination)
- [x] Frontend: `/articles/[slug]` — Article reader with cover image, paragraph rendering, sources list, fact-check badge (ShieldCheck/TriangleAlert/Info icons), stats bar
- [x] Frontend: `/submit-article` — Submission form with title, category, body textarea, cover image URL, dynamic source fields, auto-calculated reading time preview

### M3.1 — Title Similarity Check (SEO & Quality Control) ✅ COMPLETED
[x] **Title Similarity Engine**
- [x] `GET /api/posts/check-title?q=...` — Global similarity check across all categories
- [x] Fuzzy matching algorithm (Damerau-Levenshtein with dynamic thresholds)
- [x] Year variation detection (intentionally not blocked)
- [x] Format validation embedded in check-title response
- [x] Backend: Title check implemented in `backend/src/routes/posts.ts`
- [x] Frontend: "Similar list already exists" warning showing match titles and categories

### M5.5 — The SEO "Authority" Routing System
[✅] **Part A: Database Schema Evolution**
- [x] `slug` field added to Post schema: `{ type: String, unique: true, index: true }`
- [x] `generateUniqueSlug(title, id)` utility function:
  - Normalize title (lowercase, remove special chars, replace spaces with `-`)
  - Truncate to 60 chars
  - Append last 6 chars of post ID
- [x] Migration script to populate slug for all existing posts

[x] **Part B: The "Flat" Wikipedia Route (Next.js)**
- [x] Restructure: `app/post/[id]/page.tsx` → `app/[slug]/page.tsx`
- [x] Update page to fetch via slug instead of ID
- [x] **Route Guard**:
  - Define `RESERVED_ROUTES = ['admin', 'api', 'login', 'search', 'settings', 'profile', 'categories', 'c', 'auth']`
  - If params.slug is in reserved list → trigger notFound()
- ❌ **Legacy Support REMOVED**:
  - No `/post/[id]` route exists permanently. Only `/[slug]` is supported.

[x] **Part C: Content Governance & Quality Control**
- [x] Title Similarity Engine: `GET /api/posts/check-title?q=...`
- [x] Frontend: "Similar list already exists" warning in Create Post UI if match > 80%
- [ ] **SEO Indexing Guard**:
  - Set `robots: "noindex"` if:
    - `post.spark_score === 0` AND `post.age > 48h`
    - Post description < 100 characters

[x] **Part D: Schema.org "Rich Results" Integration**
- [x] Post detail page injects ItemList JSON-LD with ListItem schema (position, name, description)
- [x] Dynamic canonical tag: `<link rel="canonical" href="https://yotop10.com/${slug}" />`

[x] **Part E: Internal Link Refactor**
- [x] All `<Link>` components across the app use `href={"/" + post.slug}` exclusively

### M5.6 — The Arena (Counter-List System)
The Arena is what transforms YoTop10 from a static list site into a competitive debate platform. It allows users to challenge any existing "Top 10" with their own version, triggering a "Battle" between the two perspectives.

M5.6.1 — Counter-List Data Architecture
[ ] POST /api/posts/:slug/counter — Create a rebuttal post

Request: { title, intro, items: [], parentId }

Logic:

Validate parent slug exists.

Copy original items to the new post but allow reordering/replacement.

Set post_type to counter.

Spark Boost: Add +10 to parentId.spark_score immediately.

[ ] GET /api/posts/:slug/counters — Fetch all challenges for a post

Query params: sort (spark_score, newest), page, limit

[ ] SEO Independence Logic:

Middleware/Hook: Compare counter.spark_score vs parent.spark_score.

If counter > parent: set robots: "index, follow".

Else: set robots: "noindex, follow".

### M5.6.2 — Comparison Engine (The "Diff" Logic)
[ ] GET /api/posts/compare/:originalId/:counterId — Get delta data

Returns a mapped object showing:

Matches: Items in the same rank.

Moved: Items present in both but different ranks (with +/- offset).

Replaced: Items in original removed by challenger.

New: Items added by challenger not in original.

[ ] POST /api/posts/compare/:originalId/:counterId/vote — Community "Better List" Vote

Increments Spark score for the winner of the comparison view.

Integration Note:
The "Comparison Engine" (VS View) uses the Query Parameter Strategy (?vs=...) as we discussed. This keeps your URL structure clean and flat, ensuring the Counter-Post gets the main SEO authority while the VS View remains a powerful utility for the community to settle arguments.

ALL IMPLEMENTATIONS MUST MEET M5.6.3 STANDARD

### M5.6.3 — Arena Governance & SEO Logic
1. The SEO "Independence" Threshold
[ ] Dynamic Robot Tagging:

Logic: Every Counter-Post is created as noindex by default.

Trigger: The system performs a daily (or real-time) check: IF (Counter.SparkScore > Parent.SparkScore) OR (Counter.SparkScore > 500).

Action: Update meta_robots from noindex, follow to index, follow.

Independence Day: Once indexed, the post is treated as a standalone "Entity" in your Sitemap.

2. The "Authority Flip" Signal
[ ] Parent-Post Notification:

Logic: If a Counter-Post's Spark Score exceeds the Parent's by 20%, the Parent Post must display an Authority Warning.

UI: A banner on the Parent list: "The community has found a more updated/accurate version of this list. [View Challenger]".

SEO: Add a rel="canonical" hint or a JSON-LD isBasedOn property to the original post to point to the new "Winner."

3. Keyword Cannibalization Shield
[ ] Slug Uniqueness:

Logic: Even if the Counter-Post has the exact same title as the parent, the 6-character ID suffix prevents a URL collision.

SEO Logic: By keeping lower-spark counters noindex, you prevent "Keyword Cannibalization" (where two pages on your site fight for the same Google rank). Only the "Winner" gets to represent that keyword.

4. The "Spark-to-Index" Ratio
[ ] Minimum Quality Gate:

Logic: Any post (Original or Counter) with a Description < 100 characters or a Spark Score of 0 after 72 hours is automatically set to noindex.

Reasoning: This keeps your site "High-Quality" in the eyes of Google by hiding "trash" or "test" posts.

---

### M6 — Categories System
- [x] `GET /api/categories` — All categories
- [x] `GET /api/categories/:slug` — Single category
- [x] Category hierarchy (10 parents, 300 children)
- [x] Frontend: `/categories` and `/c/[slug]`
- [x] Admin CRUD for categories

### M7 — Comment System
- [x] `GET /api/posts/:id/comments` — Get comments
- [x] `POST /api/posts/:id/comments` — Add comment (anonymous)
  - Two modes: Full Post Comment OR Item-Anchored Comment
  - Nested replies (max 3 levels)
- [x] `PATCH /api/comments/:id` — Edit (within 2hr window)
- [x] `DELETE /api/comments/:id` — Delete own comment
- [x] Rate limit: 50 comments/hour per user

### M9 — Admin Authentication
- [x] `POST /api/admin/login` — Admin login
- [x] JWT token for admin only
- [x] Protect all `/api/admin/*` routes

**Standard Secure Single-Admin Pattern:**

This is the exact system used by Wordpress, Ghost, Discourse and every self-hosted CMS. It solves your exact requirements perfectly.

### ✅ System Rules:
1. **Maximum ONE active admin user at all times** - there can never be two admins
2. **No public signup endpoint** - admin creation requires server shell access
3. **One-time setup tokens** - generated via server command, expires after 15 minutes
4. **Automatic rotation** - when a new admin is created, ALL old admin sessions are immediately invalidated
5. **Password reset only via server** - no email reset, no web-based recovery

---

### 🛡️ **How it works:**
1. You lose your device/get logged out
2. You SSH into your server and run:
   ```bash
   npm run generate-admin-token
   ```
3. Server outputs a 16 character one-time token that expires in 15 minutes
4. You visit `https://yotop10.fun/admin/setup?token=xxxx`
5. You set a new username and password
6. Old admin is deleted, old sessions are invalidated, you become the new admin

---

### 🚫 **Guaranteed Security:**
- No attacker can ever create an admin without full shell access to your server
- There is no endpoint exposed on the web that can create an admin
- Old sessions are immediately and irreversibly terminated
- You can never get locked out permanently

---

### ✅ **Implements exactly what you asked for:**
✅ Dynamic signup when you lose your device
✅ No possibility of hackers logging you off
✅ Simple, proven, battle-tested pattern
✅ Zero attack surface
✅ No third party dependencies

This is the standard industry solution for this exact problem. There is no "better" or "more secure" way to do this.

---

### M9.1 — Global Notification System

Single unified notification system that handles all user feedback across the entire platform. Implemented once, reused everywhere.

#### Core System Requirements:
- Minimal zero dependency toast component
- Singleton pattern, no context/redux required
- Auto dismiss after 4 seconds
- Stack up to 3 notifications at once
- Only positive actions trigger notifications. Never notify for failures/limits.

#### All Use Cases Handled:
| Event | Notification Message |
|-------|----------------------|
| Post submitted successfully | ✅ Post submitted! It's now pending review. |
| Post approved | ✅ Your post was approved. +3 post boost for 90 minutes. |
| Post rejected | ❌ Your post was rejected. |
| Display name updated | ✅ Display name updated successfully. |
| Comment received 3+ fires | ✅ Your comment was well received. +1 post boost for 90 minutes. |
| Comment received 2+ replies | ✅ People are replying to your comment. +1 post boost for 90 minutes. |
| Counter list submitted | ✅ Counter list received. +2 post boost for 90 minutes. |
| Admin action completed | ✅ Action completed successfully. |
| Category saved / deleted | ✅ Category updated successfully. |

#### Implementation Status:
- [x] Toast component implementation
- [x] Global notification state management
- [x] Integration with submit page
- [x] Integration with admin dashboard
- [x] Integration with Ladder boost system

---

### M10 — Admin Dashboard (Industry Standard)

> The admin dashboard is the command center for YoTop10. This is where you control everything. It's designed like a professional CMS.

### M10.1 — Admin Authentication & Security
- [x] `POST /api/admin/login` — Login with username/password
- [x] `POST /api/admin/logout` — Invalidate session
- [x] `GET /api/admin/me` — Get current admin user
- [x] `POST /api/admin/refresh` — Refresh JWT token (auto-refresh handled inline in middleware)
- [x] JWT stored in httpOnly, secure cookie
- [x] Token expiry: 24 hours
- [x] Rate limit: 10 login attempts per 15 minutes per IP
- [x] Audit log: login attempts (success/failed, IP, timestamp)

#### M10.2 — Dashboard Overview / Stats
- [x] `GET /api/admin/stats/*` — Real-time platform statistics (17 endpoints: /overview, /content, /community, /moderation, /categories, /trends, /quality, /traffic, etc.)
  - **Posts Stats**: total, today/week/month, pending, approved, rejected
  - **Comments Stats**: total, today/week/month
  - **Users Stats**: total unique devices, new today/week/month
  - **Engagement Stats**: fire reactions, views, avg comments
  - **Category Stats**: most posts, needing attention
- [x] Charts/graphs: Frontend statistics dashboard with 15 collapsible panels
- [x] Quick actions: Go to review queue, Create category

#### M10.3 — Review Queue (Pending Posts) ✅ 100% COMPLETE

> **Moderation Scaling Roadmap**:
> 
> A strictly manual review queue is the "Gold Standard" for quality, but it is also a classic linear bottleneck. The Trust Score System is the secret weapon to solving this:
> 
> **Phase 1 (Current):** Strict manual review only ✅ LIVE
> **Phase 2:** AI Pre-Filtering - LLM sanity check auto-rejects obvious spam/gibberish
> **Phase 3:** Scholar Fast-Track - Posts from Scholar trust tier (1.8+) bypass review queue automatically (with 5% spot checks)
> **Phase 4:** Community Sovereignty - Scholar users can vote to approve pending posts

---

- [x] `GET /api/admin/posts/pending` — List pending posts
  - Query params: `page`, `limit`, `category`, `post_type`, `date_from`, `date_to`, `sort`
  - Default sort: oldest first (oldest submissions first)
- [x] `GET /api/admin/posts/pending/:id` — Full preview of pending post
- [x] `PATCH /api/admin/posts/:id/approve` — Approve post
  - Auto-generates slug from title
  - Sets status to `approved`
  - Sets `published_at` timestamp
  - Indexes in Elasticsearch (stub implemented)
  - ✅ Automatically updates user trust score

- [x] `PATCH /api/admin/posts/:id/reject` — Reject post
  - Request: `{ reason }` (required)
  - Common reasons: "Spam", "Inappropriate content", "Duplicate", "Low quality", "Incorrect category", "Misleading title"
  - Sets status to `rejected`
  - Stores rejection reason for analytics
  - ✅ Automatically updates user trust score
- [x] `PATCH /api/admin/posts/:id/request_changes` — Request changes (keep pending) (implemented as `POST /api/admin/posts/:id/retry`)
  - Request: `{ feedback }` — specific feedback for author
  - Status remains `pending_review`
  - Author can see feedback in their profile
- [x] Bulk actions:
  - `POST /api/admin/posts/bulk/approve` — Approve multiple
  - `POST /api/admin/posts/bulk/reject` — Reject multiple
- [x] Filters:
  - By category (dropdown)
  - By post type (dropdown)
  - By date submitted (date range picker)
  - By author (search by username)
- [x] Quick preview: Click to expand inline without leaving page
- [x] Keyboard shortcuts: A=Approve, R=Reject, E=Request Changes

#### M10.4 — All Posts Management
- [x] `GET /api/admin/posts` — All posts with full data
  - Query params: `page`, `limit`, `status`, `category`, `post_type`, `author`, `date_from`, `date_to`, `sort`, `search`
- [x] Table columns:
  - Checkbox (for bulk actions)
  - ID (short)
  - Title (truncated)
  - Author (username)
  - Category
  - Post Type
  - Status (badge: Pending/Approved/Rejected)
  - Fire Count
  - Comment Count
  - Views
  - Created Date
  - Published Date
  - Actions (View/Edit/Delete)
- [x] Actions per post:
  - **View**: Open in new tab (public view)
  - **Edit**: Inline edit or modal (title, category, items)
  - **Delete**: Soft delete (archive) or hard delete
  - **Feature**: Add to Hall of Fame
  - **Unfeature**: Remove from Hall of Fame
  - **Lock**: Prevent comments
  - **Bump**: Move to top of feed
- [x] Bulk actions:
  - Select all / Select none
  - Bulk approve (only pending)
  - Bulk reject (only pending)
  - Bulk delete
  - Bulk feature
  - Bulk change category
- [x] Search: Full-text search in title, intro, list items
- [x] Export: CSV/Excel export of filtered results

#### Advanced Post Operations (Ghost — Built, Previously Undocumented)
- [x] `POST /api/admin/posts/:id/duplicate` — Duplicate a post
- [x] `POST /api/admin/posts/:id/retry` — Request revision with admin guidance
- [x] `GET /api/admin/posts/:id/activity` — Post activity log
- [x] `POST /api/admin/posts/quality-check` — Quality validation
- [x] `PATCH /api/admin/posts/:id/items/:itemId` — Edit individual list item
- [x] `DELETE /api/admin/posts/:id/items/:itemId` — Remove list item
- [x] `POST /api/admin/posts/:id/items` — Add new list item
- [x] `GET /api/admin/posts/:id/revisions` — Full revision history
- [x] `GET /api/admin/posts/export` — CSV export
- [x] `GET /api/admin/posts/compare` — Compare two posts

#### M10.5 — All Comments Management
- [x] `GET /api/admin/comments` — All comments
  - Query params: `page`, `limit`, `post_id`, `author`, `status`, `date_from`, `date_to`, `sort`, `search`
- [x] Table columns:
  - ID (short)
  - Content (truncated)
  - Author (username)
  - Post (title, link to post)
  - Type (Post Comment / Item-Anchored)
  - If Item-Anchored: show item rank #
  - Fire Count
  - Reply Count
  - Created Date
  - Actions
- [x] Actions:
  - **View Post**: Go to post page
  - **Edit**: Edit comment content
  - **Delete**: Remove comment
  - **Highlight**: Pin comment to top
  - **Hide**: Hide from public (soft delete)
- [x] Search: Full-text search in comment content
- [x] Filters:
  - By post
  - By author (device fingerprint or username)
  - By type (post comment / item-anchored)
  - By date range
  - By has replies (yes/no)
- [x] Moderation flags:
  - Auto-flag: High fire count negative (controversial)
  - Auto-flag: Very long comments (potential spam)
  - Auto-flag: Many replies in short time (brigading) — implemented in flagEngine.ts cron

#### Advanced Comment Operations (Ghost — Built, Previously Undocumented)
- [x] `POST /api/admin/comments/:id/apply-penalty` — Apply trust score penalty
- [x] `POST /api/admin/comments/:id/dismiss-flag` — Dismiss auto-detected flag
- [x] `POST /api/admin/comments/:id/unhide` — Unhide comment
- [x] `POST /api/admin/comments/:id/unhighlight` — Remove highlight
- [x] `GET /api/admin/comments/stats` — Comment statistics
- [x] `GET /api/admin/comments/export` — CSV export

#### M10.6 — Users Management (Anonymous)
- [x] `GET /api/admin/users` — All anonymous users
- [x] Table columns:
  - Username (any_XXXX)
  - Custom Display Name (if set)
  - Device Fingerprint (truncated)
  - Total Posts (Approved/Rejected/Pending breakdown)
  - Total Comments
  - Trust Score (Scholar/Neutral/Troll)
  - First Seen
  - Last Active
- [x] Actions:
  - **View Profile**: See all their posts/comments
  - **Ban**: Prevent from posting (by fingerprint)
  - **Whitelist**: Mark as trusted (bypass rate limits)
  - **Shadow Ban**: Can post but only they see it
- [x] Search: By username, by fingerprint
- [x] Filters:
  - By trust score
  - By post count (high/low)
  - By ban status
  - By date range

#### M10.7 — Categories Management

**Backend (Completed):**
- [x] `GET /api/admin/categories` — All categories (tree view) (via public `/api/categories`)
- [x] `POST /api/admin/categories` — Create category (name, slug, description, icon, parent_id, is_featured, sort_order)
- [x] `PATCH /api/admin/categories/:id` — Update category (any field, reorder within parent)
- [x] `DELETE /api/admin/categories/:id` — Archive category (soft delete, requires replacement)

**Frontend — Tree Management:**
- [ ] `/admin/categories` page with sidebar link
- [ ] Tree structure: collapsible parent/child hierarchy, drag-and-drop reorder
- [ ] View toggle: Tree | Table | Flat List
- [ ] Inline edit: click category to edit name/slug/description/icon/parent inline
- [ ] Create category modal with auto-slug generation and duplicate detection

**Category Metadata & Workflow:**
- [ ] `sort_order` field — custom ordering of children under each parent
- [ ] `status` field — `draft` | `published` | `hidden` — ghost categories for planning
- [ ] `publish_at` / `archive_at` — scheduled activation and archival
- [ ] `featured_in` — multiple curated lists: "popular", "trending", "editor picks"
- [ ] `category_template` — preset icon + description + parent for common patterns
- [ ] Slug history tracking — redirect old slugs to new ones on rename
- [ ] Circular reference guard — prevent parent pointing to own child

**Analytics & Health:**
- [ ] `GET /api/admin/categories/:id/stats` — per-category stats (post count, pending, approved, most active authors)
- [ ] `GET /api/admin/categories/health` — category health score: `posts/month`, growth rate, dead categories
- [ ] `GET /api/admin/categories/analytics` — content distribution chart, overloaded categories, cross-category overlap
- [ ] `GET /api/admin/categories/growth` — growth over time per category (line chart data)

**Bulk Operations:**
- [ ] `POST /api/admin/categories/bulk/feature` — bulk feature/unfeature
- [ ] `POST /api/admin/categories/bulk/archive` — bulk archive with preview (shows affected posts)
- [ ] `POST /api/admin/categories/bulk/merge` — merge category A into B, moving all posts and children
- [ ] `POST /api/admin/categories/bulk/reparent` — move multiple children to new parent
- [ ] `POST /api/admin/categories/import` — CSV import (batch create from file)
- [ ] `GET /api/admin/categories/export` — CSV export of full tree with all metadata

**Quality & Governance:**
- [ ] Duplicate detection — warn when new category name 80% matches existing
- [ ] Orphan detection — flag children whose parent was archived
- [ ] Description validation — min length, must differ from name
- [ ] Category activity audit log — "admin created X", "admin moved X from Y to Z"

**Public-Facing (Separate Milestone):**
- [ ] Category stats on `/c/:slug` — total posts, active authors, top posts, subcategories
- [ ] Related categories — based on user browsing overlap
- [ ] Category RSS feeds — `/c/:slug/feed`

#### M10.8 — Hall of Fame Management
- [x] `GET /api/hall-of-fame` — Public: featured posts sorted by sort_order
- [x] `GET /api/admin/hall-of-fame` — All featured posts
- [x] `POST /api/admin/hall-of-fame` — Add to Hall of Fame
  - Request: `{ post_id, editorial_note }`
  - Editorial note: Short text explaining why featured
- [x] `PATCH /api/admin/hall-of-fame/:id` — Edit editorial note
- [x] `DELETE /api/admin/hall-of-fame/:id` — Remove from Hall of Fame
- [x] `PATCH /api/admin/hall-of-fame/reorder` — Reorder featured posts
- [x] Auto-candidate suggestions:
  - Posts with comment_count >= 10 OR view_count >= 500 within last 90 days
- [x] Featured badge customization (HallOfFameCard with public/admin/featured variants)
- [x] 40 backend integration tests + 29 frontend component tests

#### M10.9 — Alert System ✅ COMPLETED
- [x] Alert engine — 12 metrics evaluated every 60s with breach/resolution/cooldown logic
- [x] Threshold CRUD — create, update, delete, toggle enable/disable
- [x] Alert notifications — admin bell badge with unread count, dropdown with severity colors
- [x] Alert history — permanent audit trail of all triggered alerts with resolution tracking
- [x] Alert detail page — `/admin/alerts/[id]` with live status, resolution guide, settle button
- [x] Default thresholds seeded for 12 metrics on first startup
- [x] Live status badges — 🟢🟠🔴 in thresholds table reflecting real-time Redis state

#### M10.9b — Admin Outbound Notifications (NEW)
- [x] `AdminMessage` model — separate from user `Notification`, supports individual + broadcast
- [x] `POST /api/admin/messages` — Send individual or broadcast message
  - Request: `{ type: 'individual'|'broadcast', recipient_id?, title, body, priority }`
  - Broadcast creates 1 document, `dismissed_by[]` tracks per-user read state
  - Zod validated
- [x] `GET /api/admin/messages` — List sent messages (paginated, filterable)
- [x] `DELETE /api/admin/messages/:id` — Retract/expire a message
- [x] `GET /api/admin/messages/:id/stats` — Delivery stats (sent, seen_by count, dismissed_by count)
- [x] `POST /api/admin/messages/templates` — Save reusable message template
- [x] `GET /api/admin/messages/templates` — List all templates
- [x] `DELETE /api/admin/messages/templates/:id` — Delete template
- [x] `GET /api/users/me/messages` — User-facing: merged feed of personal + active broadcasts
- [x] Frontend: `/admin/notifications` page in sidebar — Compose (user search + broadcast toggle), Sent history, Templates tabs
- [x] React Hooks for every blueprint: client-side typing, SWR/re-fetch, toast, error handling

#### M10.10 — Search & Elasticsearch Management
- [x] `GET /api/admin/search/status` — Elasticsearch connection status (at `/api/search/admin/status`)
  - Cluster health
  - Index existence
  - Document counts per index
  - Index sizes
- [x] `POST /api/admin/search/reindex/posts` — Reindex all posts (consolidated into `/api/search/admin/reindex` with `scope` param)
  - Progress indicator (bulk response with per-collection results)
  - Error log if any (errorDetails array per collection)
- [x] `POST /api/admin/search/reindex/comments` — Reindex all comments (via `scope: comments`)
- [x] `POST /api/admin/search/reindex/all` — Full reindex (via `scope: all`, includes categories + users)
- [x] `DELETE /api/admin/search/index` — Delete and recreate index (at `/api/search/admin/index`)
- [x] Index mappings viewer (at `GET /api/search/admin/mappings`)
- [x] Test search query tool (at `GET /api/search/admin/preview`)

#### Search Analytics System (Ghost — Built, Previously Undocumented)
- [x] `SearchEvent` model — Records every search query (normalized_query, fingerprint, zero_results, response_time_ms, had_suggestion)
- [x] `SearchClick` model — Tracks result clicks (query, result_type, result_position, result_id)
- [x] `SearchDailyStats` model — Daily aggregation (total_searches, unique_searchers, top_queries, zero_result_rate, avg_response_time, index_gap_pct)
- [x] `SearchDeadLetter` model — Failed ES indexing with retry queue
- [x] `searchAnalyticsCron.ts` — Hourly cron: SearchEvent → SearchDailyStats
- [x] `POST /api/search/click` — Result click beacon for CTR tracking
- [x] 9 analytics endpoints: `search/overview`, `queries`, `relevance`, `trends`, `infrastructure`, `behavior`, `trending`, `popular`, `engaged`

#### M10.11 — Rate Limiting & Trust Scores
- [x] `GET /api/admin/rate-limits` — View rate limit settings
- [x] `PATCH /api/admin/rate-limits` — Adjust global base rate limits
  - General comments per hour
  - Item-anchored comments per hour
  - Posts per hour
  - Burst limit
- [x] `PATCH /api/admin/rate-limits/tiers` — Set tier-specific rate limit multipliers
  - Troll multiplier: Default 0.5x
  - Neutral multiplier: Default 1.0x  
  - Scholar multiplier: Default 2.0x
  - Admins can adjust each tier's multiplier independently
- [x] `GET /api/admin/trust-scores` — View trust score distribution
  - Count of Scholars
  - Count of Neutrals
  - Count of Trolls
  - Recently flagged users
- [x] Manual user trust level locking:
  - `PATCH /api/admin/users/:user_id/trust` — Lock user to specific trust level
  - Options: scholar, neutral, troll, automatic (default)
  - When locked, automatic trust score calculation is permanently disabled for this user
  - User will always remain at the assigned level until manually changed
- [x] Trust Score History Tracking:
  - All trust score changes are permanently logged
  - `GET /api/admin/users/:user_id/trust-history` — Full audit trail of trust score changes
  - Fields: timestamp, previous_score, new_score, reason (approval/rejection/manual)
  - Source: auto-calculated vs manual admin override
  - Viewable on user admin profile page
  - Retention: Permanent record
- [x] Per-user rate limit overrides:
  - `PATCH /api/admin/users/:user_id/rate-limits` — Set custom rate limits for individual users
  - Admins can set custom post/comment limits for any user, bypassing tier multipliers
  - Overrides persist permanently until removed

#### M10.12 — Audit Logs
- [x] `GET /api/admin/audit-logs` — All admin actions
  - Actions: login, approve_post, reject_post, delete_comment, etc.
  - Log: admin_id, action, target_id, timestamp, IP
- [x] Filters:
  - By action type
  - By admin user
  - By date range
- [x] Retention: 90 days default (TTL index on AuditLog.created_at)
- [x] Export: CSV export for compliance (GET /api/admin/audit-logs/export + frontend button)

#### Trust & Identity Infrastructure (Ghost — Built, Previously Undocumented)
- [x] `TrustScoreLog` model — Permanent immutable audit log of all trust score changes
- [x] `UsernameHistory` model — Tracks all username/display name changes with release dates
- [x] `UserEvent` model — General user event tracking
- [x] `CategoryAudit` model — Category mutation audit trail (duplicate, publish, hide, merge)
- [x] `FingerprintObservation` model — Browser fingerprint signals with 90-day TTL for cross-browser matching
- [x] `PlatformSnapshot` model — Hourly platform state snapshots (content, community, moderation, engagement, traffic)
- [x] `PageVisit` model — Page visit analytics with country detection
- [x] Ladder System (`ladderSystem.ts`) — Temporary rate limit boosts for low-trust users on positive actions (post approval, comment fires, replies, counter list submission)
- [x] Rate limit override per user (`rate_limit_override` field on User) — Admin-set per-user post/comment limits
- [x] User restriction (`restricted_until` field on User) — Temporary read-only restriction
- [x] Active boost system (`active_boost` field on User) — Posts/comments boost with expiry

#### M10.13 — Frontend Admin Pages
- [x] `/admin` — Redirect to dashboard (or login if not authenticated)
- [x] `/admin/login` — Login page
- [x] `/admin/setup` — One-time setup token page
- [x] `/admin/dashboard` — Overview with stats cards and charts
- [x] `/admin/statistics` — Full analytics with 15 collapsible panels
- [x] `/admin/posts/pending` — Review queue
- [x] `/admin/posts` — All posts management
- [x] `/admin/posts/:id/edit` — Post edit page with version conflict detection
- [x] `/admin/comments` — Comments management
- [x] `/admin/alerts` — Alert management (thresholds, notifications, history)
- [x] `/admin/alerts/[id]` — Alert detail with live status + resolution guide
- [x] `/admin/audit` — Audit logs
- [x] `/admin/profile` — Admin profile
- [x] `/admin/users` — Anonymous users management
- [x] `/admin/categories` — Categories CRUD
- [x] `/admin/notifications` — Outbound messaging (individual + broadcast)
- [x] `/admin/search` — Search management
- [x] `/admin/settings` — Rate limits, trust scores

#### M10.14 — Admin UI Components
- [x] `AdminLayout` — Sidebar navigation + header
- [x] `AdminAlertBell` — Admin-only alert bell with unread badge + dropdown
- [x] `HeaderBells` — Route-aware bell switcher (user vs admin)
- [x] `ToastContainer` — Toast notifications with success/error/info types
- [x] `NotificationBell` — User-facing notification bell with unread badge
- [x] `StatsCard` — Metric with trend indicator (in statistics dashboard)
- [x] `DataTable` — Sortable, filterable, paginated (posts/comments/alerts)
- [x] `BulkActionsBar` — Appears when items selected
- [x] `ReviewCard` — Pending post preview card (inline expand)
- [x] `RejectionModal` — Reject with reason dropdown + custom reason
- [ ] `StatsChart` — Line/bar charts
- [ ] `CategoryTree` — Drag-drop tree view
- [ ] `UserBadge` — Trust score badge (Scholar/Neutral/Troll)
- [ ] `SearchInput` — Global admin search
- [ ] `DateRangePicker` — Filter by date
- [ ] `ExportButton` — CSV/Excel export
- [ ] `ConfirmDialog` — Destructive action confirmation

#### Design System & Premium UI Components (Ghost — Built, Previously Undocumented)
- [x] 4-font system: Geist Sans (body), Geist Mono (metadata), Anton (display titles), Monoton (logo "YO")
- [x] Dark/light mode toggle (`ThemeToggle.tsx`) — localStorage persistence, `body.light-mode` class
- [x] Glass CSS: `glass-obsidian`, `glass-frosted`, `glass-slab` with backdrop-blur + gradient borders
- [x] Spatial depth shadows, neon wireframe borders, gradient text utilities
- [x] Argument bar CSS: `argument-bar-support` (orange), `argument-bar-contradict` (red)
- [x] Wiki badge CSS: `wiki-badge` — monospace 10px serial badges (REF-992-K)
- [x] Animation keyframes: `cardSlideUp`, `cardExpandDown` (mobile card deck)
- [x] `GlassSlab` — Self-animating glassmorphism card with wiki badges, expand/collapse, argument bars
- [x] `DataCard` — Link wrapper around GlassSlab for feed
- [x] `DesktopTopBar` — Fixed desktop header with logo, search, bells, submit button
- [x] `DynamicIsland` — Mobile floating 5-tab dock (Home/Search/Arguments/Notifications/Profile)
- [x] `FloatingDock` — Mobile bottom navigation (Feed/Categories/Search/Submit)
- [x] `CommandSearch` — Command palette search modal with trending queries
- [x] `ArgumentBar` — Support/contradict percentage bar
- [x] `ArgumentTicker` — Live debate pulse scroll
- [x] `ConsensusHeatmap` — Consensus heatmap visualization
- [x] `NavUserAvatar` — User avatar with profile image or first-letter fallback
- [x] `AnalyticsBeacon` — Page visit tracking via `POST /api/analytics/visit`
- [x] `AuthInitializer` — Auth store hydration on mount
- [x] `Toast` — Singleton notification system (4s auto-dismiss, 3-toast stack)

---

## M11 — Anonymous User System (FINAL COMPLETION)

✅ **COMPLETION BLOCKER**: This is the final foundation milestone. Nothing else can be built until M11 is 100% complete. Every other feature (rate limiting, moderation, trust scores, identity portability) depends directly on these 5 parts.

---

### ✅ M11.A: GET /api/users/me Endpoint
**Purpose**: Returns the full current user context for the authenticated fingerprint.

**Specification**:
- [x] Endpoint: `GET /api/users/me`
- [x] Authentication: Uses `X-Device-Fingerprint` header only. No other auth required.
- [x] Response format:
  ```typescript
  {
    user_id: string;
    username: string;
    custom_display_name: string | null;
    trust_score: number;
    trust_level: 'troll' | 'neutral' | 'scholar';
    post_count: number;
    comment_count: number;
    posts_approved: number;
    posts_rejected: number;
    created_at: ISO8601;
    first_seen_at: ISO8601;
  }
  ```
- [x] Calculated fields are computed on the fly, not stored:
  - `post_count`: Total posts submitted (all statuses)
  - `comment_count`: Total comments submitted
  - `posts_approved`: Number of posts with status `approved`
  - `posts_rejected`: Number of posts with status `rejected`
- [x] Trust level mapping:
  - < 0.5 → `troll`
  - 0.5 - 1.8 → `neutral`
  - ≥ 1.8 → `scholar`
- [x] Returns 404 if fingerprint is not recognized

---

### ✅ M11.B: PATCH /api/users/me Endpoint
**Purpose**: Username customization endpoint.

**Specification**:
- [x] Endpoint: `PATCH /api/users/me`
- [x] Authentication: Uses `X-Device-Fingerprint` header only.
- [x] Request body: `{ display_name: string }`
- [x] Rules:
  1.  **Mandatory Prefix**: Display name MUST start with `a_` for all users below Scholar level
  2.  **Scholar Exception**: Users with `trust_score ≥ 1.8` MAY omit the `a_` prefix completely
  3.  **Length**: Minimum 3 characters total (`a_x` is allowed), maximum 32 characters
  4.  **Allowed characters**: Alphanumeric only (a-z, 0-9). No spaces, no symbols, no underscores except the mandatory prefix
  5.  **Uniqueness**: Display name must be globally unique across all users
  6.  **Immutable Prefix**: Non-scholar users CANNOT change or remove the `a_` prefix. Any attempt to submit a name without `a_` will be automatically prefixed server side.
- [x] Success response: 200 OK with updated user object
- [x] Error responses:
  - 400: Invalid characters or length
  - 409: Display name already taken

---

### ✅ M11.C: Trust Score Calculation Engine (100% IMPLEMENTED)
**Purpose**: The core reputation system that powers all rate limits, permissions, and privileges.

**Specification**:
- [x] **Calculation formula**:
  ```
  approval_rate = posts_approved / max(posts_approved + posts_rejected, 1)
  
  base_score = 1.0
  
  if (posts_approved + posts_rejected) >= 5:
    if approval_rate >= 0.85:
      base_score = min(base_score + 0.1 * posts_approved, 2.0)
    elif approval_rate <= 0.3:
      base_score = max(base_score - 0.2 * posts_rejected, 0.1)
  
  trust_score = clamp(base_score, 0.1, 2.0)
   ```
- [x] **Automatic recalculation**:
  - Runs automatically **every time a post is approved or rejected**
  - Never recalculated on read operations
  - Stored permanently on User document
- [x] **Optimistic concurrency control** to prevent double counting
- [x] **50 post rolling window** (old actions expire automatically)
- [x] **Hysteresis thresholds** to prevent status flickering

---

### ✅ M11.C.1: Non-Negotiable Defensive Patterns
These patterns are required to prevent catastrophic failure modes at scale. Must be implemented alongside core formula.

- [x] **Hysteresis Thresholds**:
  - Enter Scholar status: **≥ 1.85**
  - Lose Scholar status: **≤ 1.70**
  - Eliminates cliff edge gaming and status flickering
- [x] **Optimistic Concurrency Control**:
  - `version` number field on User document
  - All trust updates: `UPDATE users SET trust_score = X, version = version + 1 WHERE id = Y AND version = expected_version`
  - Eliminates double counting on database failover/replication lag
- [x] **50 Post Rolling Window Only**:
  - Trust score **only ever considers the last 50 reviews**
  - Old actions expire automatically
  - No permanent lifetime penalties
  - Eliminates death spiral feedback loops
- [x] **Double-Blind Moderation**:
  - Moderators **never see** username, user_id, or trust score during review
  - Only content is visible
  - Eliminates moderator bias feedback loops
- [x] **Trust Level Tiers**:
  | Score | Level | Rate Multiplier | Prefix |
  |-------|-------|-----------------|--------|
  | 0.1 - 0.49 | Troll | 0.1x | `a_` (required) |
  | 0.5 - 1.79 | Neutral | 1.0x | `a_` (required) |
  | 1.8 - 2.0 | Scholar | 2.0x | None (optional) |

---

### ✅ M11.D: Trust-Aware Rate Limiting
**Purpose**: All rate limits are dynamically adjusted based on user trust score.

**Specification**:
- [x] **Base limits**:
  - Posts: 4 per hour base
  - General comments: 20 per hour base
  - Item-anchored comments: 25 per hour base
- [x] **2D Soft Gradient Algorithm**:
  ```javascript
  effective_trust = trust < 1.0 
    ? 0.5 + (trust * 0.5)    // Soft gradient mapping
    : trust

  effective_limit = max(MINIMUM_GUARANTEE, round(base_limit * effective_trust))
  ```
- [x] **Guaranteed Minimum Limits**:
  - All users: minimum 2 posts/hour
  - All users: minimum 10 comments/hour
  - Counter lists: UNLIMITED for everyone
- [x] **Edge cases**:
  - Trolls (0.1 trust): 2 posts/hour, 10 comments/hour
  - Neutrals (1.0 trust): Standard limits
  - Scholars (2.0 trust): 8 posts/hour, 40 comments/hour
- [x] **Rate Limit Status Endpoint**:
  - `GET /api/users/me/rate-limits` — Returns real-time remaining counts
  - Shows current trust score, tier, limits, and reset times
  - Updates automatically after every action

---

### 🔴 M11.E: User Profile Page /a/[username]
**Purpose**: Public anonymous profile page.

**Specification**:
- [x] Route: `/a/[username]`
- [ ] Publicly accessible to everyone, no auth required
- [ ] Page contents:
  - Username (large header)
  - Trust score badge (Scholar/Neutral/Troll)
  - Stats: Member since, total posts, total comments, approval rate
  - Tab navigation: Posts | Comments | Stats
  - Posts tab: All posts by user with status badges (Approved/Pending/Rejected)
  - Comments tab: All comments by user (public only, no deleted)
  - Stats tab: Real-time rate limit status, remaining counts, reset timers, trust score details
- [ ] **Privacy rules**:
  - Only the user themselves can see their own Pending/Rejected posts
  - All other users only see Approved posts
  - Device fingerprint is NEVER exposed publicly
- [ ] For authenticated user viewing their own profile:
  - Add "Edit Display Name" button
  - Add "Secure My Authority" section (for M15 seed phrase)
  - Show exact trust score number
- [x] Profile image support (Ghost — Built, Previously Undocumented):
  - `profile_image_url` field on User model
  - `POST /api/upload/profile` — Upload 200×200 WebP profile image
  - `PATCH /api/users/me` — Update profile_image_url
  - Click avatar on own profile → file upload → auto-patch
  - NavUserAvatar shows image when available, first-letter circle when not

---

✅ **M11 DEFINITION OF DONE**:
All 5 parts are implemented, tested, and merged. No open TODOs. No stubs. When M11 is complete, the user system is FINISHED FOREVER. You will never need to modify it again for the entire lifetime of the platform.

### Bookmarks — Saved Posts System
- [x] `SavedPost` model — user_id + post_id with compound unique index, (user_id, saved_at) compound index
- [x] `POST /api/bookmarks/save` — Bookmark a post
- [x] `DELETE /api/bookmarks/save` — Remove bookmark
- [x] `GET /api/bookmarks/saved` — Paginated saved posts feed
- [x] `GET /api/bookmarks/check` — O(1) Redis check with MongoDB fallback
- [x] `bookmark_count` field on Post model
- [x] Redis caching: Set per user, 1h TTL, O(1) checks
- [x] Core bookmark service (`lib/bookmarkService.ts`) with 16 unit tests
- [x] Frontend `BookmarkButton` component — optimistic toggle, Lucide Bookmark icon, 44px touch target, 8 unit tests
- [x] Frontend `/saved` page — Twitter-style bookmark feed with glass cards, IntersectionObserver infinite scroll

### M12 — Search & Discovery
- [x] Elasticsearch indexes for posts + comments (also categories + users — 4 indices total)
- [x] `GET /api/search` — Full search (with facets, highlighting, "did you mean?" suggestions)
- [x] `GET /api/search/autocomplete` — Autocomplete (with highlighting)
- [x] Filters: category, post type, author (date range not in public search)
- [x] Sort: relevance, newest, most comments, most liked (fires)
- [x] Frontend: `/search`
- [x] `GET /api/explore` — Algorithmic trending feed using multi-factor scoring (recency 15%, engagement 25%, authority 20%, velocity 30%, diversity 10%). All post types mixed, top-200 scoring pipeline with pagination.
- [x] `POST /api/explore/view` — Redis velocity tracking (1h TTL)
- [x] Frontend: `/explore` — 2-col grid, score badges, type tabs (All/Top Lists/VS Battles/Articles), IntersectionObserver infinite scroll
- [x] 17 unit tests for explore scoring algorithm

### M13 — Arguments Page
- [x] `GET /api/arguments` — Hot debates: `this_vs_that` + `counter` posts sorted by comment velocity. Pre-computed hourly into Redis.
- [x] Most active item-anchored comments
- [x] Filter by category, time range
- [x] Frontend: `/arguments`

### M14 — Hall of Fame (Post-MVP / Phase 2)
- [x] `GET /api/hall-of-fame` — Featured lists
- [x] Admin curation controls
- [x] Frontend: `/hall-of-fame`
- [x] HallOfFameCard component (public/admin/featured variants)
- [x] 69 tests (40 backend + 29 frontend)

---

## V1 MVP — COMPLETION CHECKLIST

- [x] Anonymous post submission works (no login) ✅
- [x] Public feed shows only approved posts (backend complete, frontend basic)
- [x] Post detail with list items + comments ✅
- [x] Nested comments (up to 10 levels) ✅
- [x] Item-anchored comments (highlight specific item) ✅
- [x] Fire reactions (toggle, comments only) ✅
- [x] Categories system (10 parents, 300 children) ✅
- [x] Admin login protects dashboard ✅
- [x] Review queue: approve/reject posts ✅
- [x] Submit page: create posts with dynamic list items ✅
- [x] Device fingerprinting tracks anonymous users ✅
- [x] Smart rate limiting (per user, not IP) ✅
- [x] Shadow Trust Score system ✅
- [x] Counter Lists are UNLIMITED for all users ✅
- [x] User profiles at `/a/[username]` ✅
- [x] Elasticsearch search with autocomplete (backend: 4 indices, search, autocomplete, admin management; frontend page pending)
- [x] M15 Identity Portability (seed phrases, multi-device linking) ✅
- [x] Frontend `/search` page
- [x] `/explore` page — Algorithmic trending feed
- [x] `/articles` page — Long-form article content
- [x] `/saved` page — User's bookmarked posts
- [x] `/arguments` page — Hot debates (this_vs_that + counter posts)
- [x] Bookmark/save system
- [ ] Share system (OG tags, UTM, copy link)
- [x] Article content type (separate model)
- [x] Hall of Fame
- [ ] Deployed and verified

---

## M15 — Identity Portability

✅ **Philosophy**: Crypto wallet style identity. No passwords, no emails. User owns their reputation completely.

### Implementation:
- [x] `POST /api/identity/generate-key` — Generate 12-word seed phrase for authenticated user
- [x] `POST /api/identity/claim` — Claim identity on new device using seed phrase
- [x] `POST /api/identity/link` — Link additional device fingerprint to existing identity
- [x] User cluster system: Multiple fingerprints can map to single authority ID
- [x] Seed phrases are NOT stored on server - only bcrypt hash of public key
- [x] No recovery system. If seed is lost, identity is permanently lost.
- [x] **Trust Score Prefix Removal**: Users with Scholar trust score (>1.8) automatically lose the `a_` prefix. Usernames become completely custom.

### UX:
- [x] Profile page section: "Secure My Authority"
- [ ] "This is your only key. We do not store this. If you lose it, your reputation is gone forever."
- [x] 12 word BIP39 standard seed phrase
- [ ] Optional JSON identity file download
- [x] Claim identity page for new devices
- [ ] Username customization: Only `a_` prefix is mandatory for new users. Suffix can be any alphanumeric string of any length (minimum 1 character).

---

## PHASE 2 — ADVANCED (V2)

After MVP launch. Optional features:

### V2.1 — Design & Styling
- [ ] Futuristic theme (design system)
- [ ] Retro theme (Myspace-style)
- [ ] Dark/light toggle
- [ ] Mobile-first responsive

### V2.2 — Post Changelog/Revisions
- [ ] Version history on posts
- [ ] Compare versions

### V2.3 — Counter-List System
- [ ] Counter List post type
- [ ] Battle View page

### V2.4 — Email Notifications
- [ ] Post approval/rejection


### V2.5 — PWA & Mobile
- [x] Progressive Web App manifest
- [x] Offline support

---

## API ENDPOINTS SUMMARY

### Public (No Auth)
```
GET    /api/categories              # List categories
GET    /api/categories/:slug       # Single category
GET    /api/posts                  # Approved posts (paginated)
GET    /api/posts/:slug            # Single post with items + comments
POST   /api/posts                  # Submit new post (anonymous)
GET    /api/posts/:slug/comments   # Comments for post
POST   /api/posts/:slug/comments   # Add comment (anonymous)
PATCH  /api/comments/:id            # Edit own comment (2hr window)
DELETE /api/comments/:id           # Delete own comment
GET    /api/comments/:id/replies   # Get replies
POST   /api/reactions              # Toggle fire reaction
GET    /api/reactions/state        # Get reaction states
GET    /api/search                 # Full search
GET    /api/search/autocomplete    # Autocomplete
GET    /api/explore                # Algorithmic trending feed
GET    /api/articles               # All articles
GET    /api/articles/:slug         # Single article
POST   /api/articles               # Submit article
GET    /api/arguments              # Hot debates
GET    /api/users/me               # Current user context
GET    /api/users/me/rate-limits   # Current user rate limit status
GET    /api/users/me/saved         # User's bookmarked posts
GET    /api/users/:username        # User profile
GET    /api/users/:username/posts  # User posts
PATCH  /api/users/me/display-name  # Update display name
POST   /api/posts/:id/save         # Bookmark post
DELETE /api/posts/:id/save         # Remove bookmark
```

### Identity (Auth: fingerprint)
```
GET    /api/identity/status              # Check seed identity status
POST   /api/identity/generate-key        # Generate seed phrase identity
POST   /api/identity/claim               # Request challenge for claim
POST   /api/identity/claim/verify        # Verify signed challenge
POST   /api/identity/link                # Link additional device
GET    /api/identity/devices             # List linked devices
DELETE /api/identity/devices/:fingerprint # Unlink a device
```

### Phase 2 (Post-MVP)
```
GET    /api/hall-of-fame           # Featured lists
```

### Admin (Auth Required)
```
POST   /api/admin/login                # Admin login
POST   /api/admin/logout               # Admin logout
GET    /api/admin/me                   # Current admin user
GET    /api/admin/stats/*              # Dashboard stats (17 endpoints: overview, content, community, moderation, categories, trends, quality, traffic, alerts, compare, notifications)
GET    /api/admin/posts/pending        # Review queue
GET    /api/admin/posts/pending/:id   # Preview pending post
PATCH  /api/admin/posts/:id/approve    # Approve post
PATCH  /api/admin/posts/:id/reject     # Reject post
POST   /api/admin/posts/:id/retry      # Request revision
POST   /api/admin/posts/bulk/approve   # Bulk approve
POST   /api/admin/posts/bulk/reject    # Bulk reject
GET    /api/admin/posts                # All posts
PATCH  /api/admin/posts/:id            # Edit post
DELETE /api/admin/posts/:id            # Soft delete post
DELETE /api/admin/posts/:id/permanent  # Hard delete post
POST   /api/admin/posts/:id/restore    # Restore soft-deleted
POST   /api/admin/posts/:id/feature    # Add to Hall of Fame
POST   /api/admin/posts/:id/unfeature  # Remove from Hall of Fame
POST   /api/admin/posts/:id/lock       # Lock comments
POST   /api/admin/posts/:id/bump       # Bump to top
POST   /api/admin/posts/bulk/delete    # Bulk delete
POST   /api/admin/posts/bulk/change-category  # Bulk recategorize
GET    /api/admin/comments             # All comments
PATCH  /api/admin/comments/:id        # Edit comment
DELETE /api/admin/comments/:id         # Soft delete
POST   /api/admin/comments/:id/restore # Restore comment
POST   /api/admin/comments/:id/hide    # Hide comment
POST   /api/admin/comments/:id/highlight  # Pin comment
POST   /api/admin/comments/:id/flag    # Manual flag
POST   /api/admin/comments/bulk/flag   # Bulk flag
POST   /api/admin/comments/bulk/unflag # Bulk unflag

# Alert System
GET    /api/admin/stats/alerts         # Active alerts from Redis + history
GET    /api/admin/alerts/thresholds    # List thresholds
POST   /api/admin/alerts/thresholds    # Create threshold
PATCH  /api/admin/alerts/thresholds/:id  # Update threshold
DELETE /api/admin/alerts/thresholds/:id  # Delete threshold
PATCH  /api/admin/alerts/thresholds/:id/toggle  # Enable/disable
GET    /api/admin/alerts/notifications       # List notifications
GET    /api/admin/alerts/notifications/count # Unread count
GET    /api/admin/alerts/notifications/:id   # Detail with live value
PATCH  /api/admin/alerts/notifications/:id/read    # Mark read
PATCH  /api/admin/alerts/notifications/:id/settle  # Mark settled
PATCH  /api/admin/alerts/notifications/read-all     # Mark all read
PATCH  /api/admin/alerts/notifications/settle-all   # Settle all
DELETE /api/admin/alerts/notifications/:id  # Dismiss
GET    /api/admin/alerts/history          # Alert history (paginated, filterable)

# Search
GET    /api/search                    # Public search (facets, highlights, suggestions)
GET    /api/search/autocomplete       # Autocomplete (rate limited)
GET    /api/search/admin/status       # ES status + DB/ES gap
POST   /api/search/admin/reindex      # Reindex (scope: all|posts|comments|categories|users)
DELETE /api/search/admin/index        # Delete + recreate index
GET    /api/search/admin/mappings     # View ES mappings
GET    /api/search/admin/preview      # Test search query

# Outbound Messaging (planned)
POST   /api/admin/messages            # Send individual or broadcast
GET    /api/admin/messages            # List sent messages
DELETE /api/admin/messages/:id        # Retract/expire
GET    /api/admin/messages/:id/stats  # Delivery stats
POST   /api/admin/messages/templates  # Save template
GET    /api/admin/messages/templates  # List templates
DELETE /api/admin/messages/templates/:id  # Delete template
GET    /api/users/me/messages         # User-facing: personal + broadcasts

# Audit
GET    /api/admin/audit-logs          # Audit logs (filterable, paginated)
GET    /api/admin/audit-logs/stats    # Quick audit stats (cached 30s)
```

---

## FRONTEND ROUTES & PAGE DESCRIPTIONS

### Public Pages

#### 1. Homepage — `/`
**Description**: The main landing page displaying the public feed of approved posts.
- **Features**:
  - Header with logo, search bar, navigation links (Categories, Hall of Fame [post-MVP], Arguments), Submit button
  - Category filter dropdown in sidebar or header
  - Sort controls: Newest (default), Most Viewed, Most Commented
  - Responsive grid of PostCards (1-3 columns based on screen)
  - PostCard displays: title, author (any_XXXX), category badge, view count, comment count, relative date
  - Click card → navigate to post detail
  - Pagination or "Load More" button (20 posts per page)
  - Loading skeletons while fetching
  - Empty state when no approved posts exist
- **API Calls**: `GET /api/posts`, `GET /api/categories`

---

#### 2. Submit Post Page — `/submit`
**Description**: Anonymous post submission form for creating top 10 lists.
- **Features**:
  - Post type selector dropdown: Top 10 List, This vs That, Who is Better, Fact Drop, Best Of, Worst Of, Hidden Gems, Counter List
  - Category selector dropdown (EXACTLY 1 category, required)
  - Title input (required, 5-300 chars)
  - Intro/description textarea (optional, max 2000 chars)
  - Dynamic list items section:
    - "Add Item" button to add more items
    - Each item: Rank # (auto), Title (required), Justification/description (required), Image URL (optional), Source URL (optional)
    - Remove item button per row
    - Up/Down arrows to reorder items
    - Minimum 1 item, maximum 25 items
  - Author display name input (required, 3-50 chars)
  - Device fingerprint auto-generated and hidden
  - Submit button with loading state

  - Form validation before submit
- **API Calls**: `GET /api/categories`, `POST /api/posts`

---

#### 3. Post Detail Page — `/[slug]`
**Description**: Full post display with ranked list items and nested comments.
- **Features**:
  - Post header: title (large), post type badge, category badge (links to /c/[slug]), author username (any_XXXX), created date
  - Status badge if viewing own post: Pending/Approved/Rejected
  - Intro/description section
  - List items section:
    - Ranked display (#1, #2, #3...)
    - Each item: rank number, title (bold), justification/description (expandable), image (if provided), source link (if provided)
    - 🔥 Fire button per item with count
    - "Challenge" button to anchor a comment to this specific item
  - Post-level Fire reaction button
  - Total comment count display
  - "Submit a Counter-List" prominent button (links to /submit with counter_list type)
  - "View History" link (shows changelog)
  - Comments section:
    - Toggle: "Comment on this post" vs "Comment on item #X"
    - Comment form: textarea (1-2000 chars), author display name input
    - Nested comment tree (max 3 levels, Twitter/X-style):
      - Level 1: Top-level comment
      - Level 2: Reply to L1
      - Level 3: Reply to L2 (replies go to L2's parent after this)
    - Each comment shows: author username, content, timestamp, reply button
    - If item-anchored: shows "Replying to Item #X" with item title
    - Inline reply form when clicking reply
- **API Calls**: `GET /api/posts/:slug`, `GET /api/posts/:slug/comments`, `POST /api/comments`, `POST /api/reactions`, `GET /api/reactions/state`

---

#### 4. Post History/Changelog — `/[slug]/history`
**Description**: Version history page showing all revisions of a post.
- **Features**:
  - List of all versions:
    - Version number (v1, v2, v3...)
    - Date created
    - Author (username)
    - Change summary (if provided)
  - Click version to view that version's full content
  - "Compare with current" button to see diff
  - Side-by-side comparison view
- **API Calls**: `GET /api/posts/:slug/history`

---

#### 5. Categories Page — `/categories`
**Description**: Browse all categories in a grid.
- **Features**:
  - Page title: "Categories"
  - Search/filter categories input
  - Grid of CategoryCards:
    - Category name
    - Category icon (emoji)
    - Post count
    - Subcategory count (if parent)
  - Featured categories section at top (is_featured: true)
  - Click card → navigate to category feed
- **API Calls**: `GET /api/categories`

---

#### 6. Category Feed Page — `/c/[slug]`
**Description**: Posts filtered by a specific category.
- **Features**:
  - Category header: name, description, icon
  - Subcategories list (if parent category has children)
  - Same feed layout as homepage (PostCards grid)
  - Sort controls: Newest, Most Viewed, Most Commented
  - Breadcrumb: Home > Categories > Category Name
  - Back to all categories link
  - 404 if category not found or archived
- **API Calls**: `GET /api/categories/:slug`, `GET /api/posts?category_id=...`

---

#### 7. Search Results Page — `/search`
**Description**: Full-text search across posts and comments with filters.
- **Features**:
  - Search input at top (pre-filled with query from URL)
  - Results count: "Found X results for 'query'"
  - Tabs: All | Posts | Comments
  - Filters sidebar:
    - Category checkboxes
    - Post type checkboxes
    - Author input (username)
    - Date range picker (From/To with presets: Today, This Week, This Month, This Year)
    - "Clear all filters" button
  - Sort options: Relevance (default), Newest, Oldest, Most Viewed
  - Results display:
    - Post results: title (highlighted), excerpt, category badge, author, view count, comment count, date
    - Comment results: content (highlighted), post title attached to, author, date, reply count
  - Active filters shown as removable tags
  - URL params for shareability: `/search?q=movies&category=tech&sort=newest`
  - Pagination or "Load More"
  - Empty results state: "No results found for 'query'"
  - No query state: Show recent/popular posts
- **API Calls**: `GET /api/search`, `GET /api/search/posts`, `GET /api/search/comments`

---

#### 8. Arguments Page — `/arguments`
**Description**: Hot debates page showing most active `this_vs_that` and `counter` posts sorted by comment velocity. MVP feature.
- **Features**:
  - Page title: "Arguments" or "Hot Debates"
  - Description: "Most active item-anchored discussions"
  - Filter bar:
    - Category dropdown (filter by category)
    - Time range: Today, This Week, This Month, All Time (default)
  - Sort toggle: Most Replies, Recent Activity
  - Data pre-computed hourly into Redis for fast reads
  - List of ArgumentItems:
    - Post title
    - List item number and title (e.g., "#4: The Godfather")
    - Comment preview (first 100 chars)
    - Reply count
    - Time since last reply ("2 hours ago")
  - Click item → navigates to post, scrolls to that specific item
- **API Calls**: `GET /api/arguments`

---

#### 9. Explore Page — `/explore` (NEW)
**Description**: Algorithmic trending feed using multi-factor scoring.
- **Features**:
  - Multi-factor scoring: recency, engagement (fires/comments/views), authority (author trust score), velocity (growth rate), diversity (category spread)
  - All post types mixed in feed
  - Continuous scroll or pagination
  - Responsive card layout matching homepage
- **API Calls**: `GET /api/explore`

---

#### 10. Articles Page — `/articles` (NEW)
**Description**: All article-type posts displayed like Medium homepage.
- **Features**:
  - Grid/list of article cards with cover image, title, reading time, author, date
  - Sort by newest, most read, longest read
  - Category filter
  - Click card → navigate to `/articles/:slug`
- **API Calls**: `GET /api/articles`

---

#### 11. Article Detail Page — `/articles/:slug` (NEW)
**Description**: Full long-form article display.
- **Features**:
  - Cover image hero
  - Title, author, reading time, published date
  - Markdown body rendered
  - Sources section at bottom
  - Fact-check status badge
  - Related posts sidebar/bottom
- **API Calls**: `GET /api/articles/:slug`

---

#### 12. Saved Posts Page — `/saved` (NEW)
**Description**: User's bookmarked posts. Requires fingerprint auth.
- **Features**:
  - Grid of saved PostCards sorted by save date (newest first)
  - Remove bookmark button on each card
  - Empty state: "No saved posts yet"
  - Requires device fingerprint to authenticate
- **API Calls**: `GET /api/users/me/saved`, `DELETE /api/posts/:id/save`

---

#### 13. Hall of Fame Page — `/hall-of-fame`
**Description**: Curated best lists - the "Gold Standard" lists like Wikipedia's Featured Articles.
- **Features**:
  - Page title: "Hall of Fame"
  - Description: "The best lists, confirmed by the community"
  - Featured section (admin-curated):
    - Large featured cards with:
      - Post title
      - Editorial note (if any)
      - Author
      - Category badge
      - View count
      - Comment count
  - Category sections below:
    - Posts organized by category
    - Community-vetted criteria badge:
      - 50+ item-anchored comments
      - Active for 3+ months
      - Low controversy
  - Static display (not algorithm-sorted)
- **API Calls**: `GET /api/hall-of-fame`

---

#### 14. User Profile Page — `/users/[username]`
**Description**: Anonymous user profile showing their posts and customizable display name.
- **Features**:
  - Profile header:
    - Username: `any_XXXX`
    - Custom display name: "also known as: any_nekw" (if set)
    - Edit button (only if viewing own profile - matched by device fingerprint)
    - Stats: Total posts, Approved, Rejected, Pending
  - Tab navigation: Posts | Comments
  - Posts tab:
    - Filter tabs: All | Approved | Rejected | Pending
    - List of user's posts:
      - Post title
      - Category badge
      - Status badge (only visible to author):
        - Green: "Approved"
        - Red: "Rejected" (with rejection reason on hover)
        - Yellow: "Pending"
      - View count, Comment count
      - Created date
  - Comments tab:
    - List of comments made by user:
      - Comment content (truncated)
      - Post title it was commented on
      - Date
      - Reply count
  - Edit display name modal (own profile only):
    - Input for new last 4 characters
    - Availability check
    - Save/Cancel buttons
    - Must keep `any_` prefix
- **API Calls**: `GET /api/users/:username`, `GET /api/users/:username/posts`

---

#### 15. Notifications Page — `/notifications` (Ghost — Built, Previously Undocumented)
**Description**: Merged feed of system notifications and admin outbound messages.
- **Features**:
  - System notifications: post_approved, post_rejected, revision_requested
  - Admin messages: individual + broadcast with dismiss
  - Mark-as-read on click
  - Unread badge count in header bell

#### 16. Notification Detail — `/notifications/[id]` (Ghost — Built, Previously Undocumented)
**Description**: Full notification view with body, dismiss button, and navigation.

#### 17. Username History — `/username-history` (Ghost — Built, Previously Undocumented)
**Description**: Shows all past display name changes with dates and release status.

---






---

## ⚠️ UNCONFIRMED / SILENT IMPLEMENTATION CHANGES
These features are implemented and working in production but not yet formally documented:

| Feature | Status | Notes |
|---------|--------|-------|
| Counter List Post Type | ✅ Implemented | Core platform feature |
| Post Edit Window | ✅ Implemented | 2 hour window to edit own posts |
| Trust Score Hysteresis | ✅ Implemented | Prevents trust level flickering |
| Optimistic Concurrency Control | ✅ Implemented | Prevents double counting trust score changes |
| Trust Score Audit Log | ✅ Implemented | Permanent immutable log of all trust score changes |
| Redis Sliding Window Rate Limiting | ✅ Implemented | Full production ready rate limiting |

---

# **M5.6 — The Arena: High-Authority Challenge & Reputation System**

> **Objective:** To transition YoTop10 from a static list platform to a competitive ranking engine where "Conflicts" drive data authority. The system must mathematically prioritize high-trust debate (Scholars) over engagement-farming (Trolls) and maintain a "Library-Grade" SEO presence.

---

## **Part 1: The Arena Data Architecture**

### **M5.6.1 — Post-Level Spark Engine ($S_{post}$)**
Unlike comments, the Post Spark Score is a hybrid metric that balances "Discussion" against "Direct Challenges."

* **The 60/40 Split Logic:**
    * **Comment Weight ($0.4$):** The sum of all individual `comment_spark_scores` (after decay).
    * **Counter-List Weight ($0.6$):** A base value of **50 points** per created counter-list, plus 10% of that counter-list's current Spark score.
* **The Trust Multipliers (The Multiplier Gate):**
    All interactions (Comments or Challenges) are multiplied by the user's **Current Trust Level**:
    * **Low-Trust:** $0.0x$ (Engagement is recorded but contributes $0$ points to the post's ranking).
    * **Medium-Trust:** $1.5x$ multiplier to the Spark points awarded.
    * **High-Trust (Scholar):** $2.0x$ multiplier to the Spark points awarded.
* **Post Decay & Floor Protection:**
    * **Decay:** Uses the same $\gamma$ (gravity) formula as comments to determine "Hotness" for Discovery feeds.
    * **The Library Guard:** The `Base_Score` (pre-decay) serves as a permanent SEO signal. High-quality posts never lose their indexing status even if their "Feed Rank" decays to zero.

---

### **M5.6.2 — The Dynamic Reputation Engine ($R$)**
The system will auto-calculate user reputation to prevent "static" gaming of the platform.

* **The Tiered Quality Matrix ($M$):**
    Posts and Comments are categorized based on their percentile rank within the database:
    * **S-Rank (Top 5%):** $Multiplier = 10.0$
    * **A-Rank (Top 15%):** $Multiplier = 5.0$
    * **B-Rank (Top 40%):** $Multiplier = 2.5$
    * **C-Rank (Bottom 60%):** $Multiplier = 1.0$
* **The Reputation Formula ($R$):**
    $$R = \frac{\sum (Posts \times M_{tier}) + \sum (Comments \times M_{tier})}{\text{Total Submission Count}}$$
* **Trust Level Thresholds ($x$):**
    * **Scholar (High):** $R \geq 7.5$
    * **Neutral (Medium):** $R = 3.0 \text{ to } 7.4$
    * **Entry/Troll (Low):** $R < 3.0$
* **Manual Override:** Admins in **M10.11** can lock a user's trust level, bypassing auto-calculation.

---

## **Part 2: The Challenger Logic & Constraints**

### **M5.6.3 — The "4-Item Disagreement" Protocol**
This is the core constraint that prevents low-effort clones and ensures high-quality rebuttals.

* **The Hard Constraint (6/10 Rule):**
    * A challenger **must** disagree with a **minimum of 1** and a **maximum of 4** items from the parent list.
    * **Logic Lock:** The remaining items (minimum 6) are locked. The challenger cannot edit their Title or Description.
    * **Global Freedom:** The challenger can reorder all 10 items. For example, they can move a "Locked" item from #1 to #10 while replacing #2 with a completely new entity.
* **Conflict Resolution & Sync:**
    * **Version Pinning:** Every counter-list is pinned to the `versionId` of the parent.
    * **Update Notification:** If Author A updates their list while User B is drafting a counter, the system triggers an interrupt: *"The original list has been updated. Your draft has been invalidated to ensure the challenge is current."*
    * **The "Legacy" Exception:** If a counter-list is already published, it remains linked to the *previous* version of the parent list.

---

## **Part 3: Frontend Route Specifications**

### **1. The Challenger Editor — `/[slug]/challenge`**
**Description:** The "War Room" where users construct their rebuttal.
-   **Features:**
    * **Selection Phase:** High-intensity UI where user clicks 1–4 items to "Discard."
    * **Dynamic Ghosting:** Once 4 items are selected, all other items turn semi-transparent and become "Read-Only."
    * **Entity Injection:** The 4 discarded slots become empty inputs for the user to add new names/entities.
    * **Rank-Shuffle:** A drag-and-drop interface allowing a global reshuffle of all 10 cards.
    * **Diff-Tracker:** A real-time summary showing: *"Replaced: [Item A] with [Item B] | Shifted: [Item C] up by 2 positions."*

### **2. The Counter-Post Detail — `/[counter-slug]`**
**Description:** The SEO-optimized standalone page for the rebuttal.
-   **Features:**
    * **Battle Header:** "REBUTTAL: [User] disagrees with [Parent Author] on [X] items."
    * **Agreement Index:** A percentage bar showing how much of the original list remains (e.g., "60% Agreement").
    * **The Challenge Link:** A prominent button to view the original parent list.
    * **Battle Stats:** A visual progress bar comparing the `Spark_Score` of the Parent vs. the Challenger.

### **3. The "VS" Comparison View — `/[slug]?vs=[counter-slug]`**
**Description:** The side-by-side analytical state of the Post page.
-   **Desktop UX:**
    * Dual-pane layout with **SVG Thread Connectors**. Lines draw paths from the original item's rank to its new rank on the challenger's list.
    * Color-coding: **Green** (Matched), **Yellow** (Moved), **Red** (Replaced).
-   **Mobile "Layered Stack" UX:**
    * To save memory/performance, mobile uses a **Ghost-Overlay**.
    * Each list card shows a "shadow" of the parent list item in the background.
    * Indicators show Rank Change (e.g., `▲ 2` or `▼ 1`) or a **Red X** if the item was deleted.

### **4. The Challenges Gallery — `/[slug]/challenges`**
**Description:** The directory of all competing viewpoints for a specific topic.
-   **Features:**
    * **Contender Feed:** All child posts sorted by Spark Score.
    * **The "Be the First" State:** If no counters exist, show a CTA: *"No one has dared to challenge this list. Are you the first?"*
    * **Leaderboard Badge:** The counter-post with the highest Spark score is labeled "The Top Contender."

---

## **Part 4: Arena Governance & SEO Indexing**

### **M5.6.4 — The "Library Guard" Indexing Logic**
We treat the site as a permanent encyclopedia. Indexing is earned through quality, not just seniority.

* **The SEO "Independence" Threshold:**
    * Every counter-list starts as `noindex, follow`.
    * **Automatic Promotion:** A counter-list is promoted to `index, follow` if:
        1.  `Counter.Spark_Score > Parent.Spark_Score` (The Authority Flip).
        2.  **OR** `Counter.Spark_Score` reaches the **85th Percentile** of all site content (The "Independent Quality" rule).
* **The "Authority Flip" Signal:**
    * If a Challenger surpasses the Parent by **20%** in Spark, the Parent Post is forced to display a banner: *"A more accurate/popular version of this list exists. [Link to Challenger]."*
    * **Canonical Signal:** The JSON-LD schema on the parent post updates to include `isBasedOn` linking to the new winner.
* **Quality Gatekeeper:**
    * Any post (Original or Counter) with a **Description < 100 characters** or a **Spark Score of 0 after 72 hours** is set to `noindex`.
    * **Fairness Clause:** Low-trust users can still post, but their content will only become `indexable` if it gains significant engagement from Medium/High-trust users (proving they have "leveled up").

---

## **Part 5: Admin "Arena" Integration (M10 Extension)**

### **M10.15 — Simple Conflict Dashboard**
* **Battle Monitor:** A list of posts sorted by `counter_count`. High counts indicate viral debates.
* **Duplicate Detection:** A background utility flags counter-lists that use different spellings for the same item (e.g., "Ronaldo" vs "C. Ronaldo") to help admins purge low-effort duplicates.
* **Manual Trust Adjustment:** Admins can see a user's `reputation_score ($R$)` and manually override their Trust Level if they are clearly a "Scholar" in training.

---

### **Technical Summary for AI Code Execution**
1.  **Database:** Update `Post` schema to include `parentId`, `post_type: ['original', 'counter']`, `spark_score`, and `versionId`.
2.  **Logic:** Build the `generateReputation` cron job and the `generateSlug` uniqueness guard.
3.  **Validation:** Strict 6/10 logic check on the `POST /api/posts/counter` controller.
4.  **UI:** Use Next.js Query Params (`?vs=`) for the comparison state to avoid unnecessary route complexity.

**This specification is now complete. It provides the mathematical formulas, the frontend UX constraints, and the SEO governance needed to build the YoTop10 Arena.**








### Admin Pages

#### 18. Admin Login Page — `/admin/login`
**Description**: Admin authentication page.
- **Features**:
  - YoTop10 logo/branding
  - Username input
  - Password input
  - "Remember me" checkbox
  - Login button

- **API Calls**: `POST /api/admin/login`

---

#### 19. Admin Dashboard — `/admin/dashboard`
**Description**: Overview of platform statistics.
- **Features**:
  - Sidebar navigation (collapsible)
  - Header: "Admin Dashboard", current admin username, logout button
  - Stats cards row:
    - Total Posts (all time)
    - Pending Review (clickable → review queue)
    - Approved (this month)
    - Rejected (this month)
    - Total Comments
    - Total Users (anonymous)
    - Total Categories
  - Charts section:
    - Posts over time (line chart)
    - Comments over time (line chart)
    - Top categories by posts (bar chart)
  - Recent activity feed
  - Quick action buttons: "Review Queue", "Create Category"
- **API Calls**: `GET /api/admin/stats`

---

#### 20. Review Queue — `/admin/posts/pending`
**Description**: List of posts awaiting approval.
- **Features**:
  - Header: "Pending Reviews", count badge
  - Filters: category, post type, date range, author search
  - Sort: Oldest first (default)
  - List of ReviewCards:
    - Post title
    - Author username
    - Category
    - Post type badge
    - Submitted date
    - Quick preview (expand inline)
  - Actions per card:
    - Approve button (green)
    - Reject button (red) - opens modal
    - Request Changes button (yellow) - opens modal
    - Preview button - shows full post in modal
  - Bulk actions bar (when items selected): Bulk Approve, Bulk Reject
  - Keyboard shortcuts hint: "A: Approve | R: Reject | E: Request Changes"
  - Pagination
- **API Calls**: `GET /api/admin/posts/pending`, `PATCH /api/admin/posts/:id/approve`, `PATCH /api/admin/posts/:id/reject`, `PATCH /api/admin/posts/:id/request_changes`

---

#### 21. All Posts Management — `/admin/posts`
**Description**: Complete posts management table.
- **Features**:
  - Header: "All Posts", search input
  - Filters: status (All/Pending/Approved/Rejected), category, post type, date range
  - Data table columns:
    - Checkbox (bulk select)
    - ID
    - Title (truncated)
    - Author
    - Category
    - Post Type
    - Status (badge)
    - 🔥
    - 💬
    - 👁
    - Created
    - Published
    - Actions
  - Actions dropdown: View, Edit, Delete, Feature, Unfeature, Lock, Bump
  - Bulk actions: Select all, Approve, Reject, Delete, Feature, Change Category
  - Export button: CSV/Excel download
  - Pagination
- **API Calls**: `GET /api/admin/posts`, `PATCH /api/admin/posts/:id`, `DELETE /api/admin/posts/:id`

---

#### 22. Comments Management — `/admin/comments`
**Description**: All comments management with moderation tools.
- **Features**:
  - Header: "Comments", search input
  - Filters: by post, by author, type (Post Comment/Item-Anchored), date range, has replies
  - Data table:
    - ID
    - Content (truncated)
    - Author
    - Post (title, link)
    - Type badge
    - Item # (if anchored)
    - 🔥
    - Replies
    - Created
    - Actions
  - Actions: View Post, Edit, Delete, Highlight, Hide
  - Moderation flags column:
    - ⚠️ Controversial (high negative fires)
    - ⚠️ Potential Spam (very long)
    - ⚠️ Brigading (many rapid replies)
  - Click flag to investigate
- **API Calls**: `GET /api/admin/comments`, `PATCH /api/admin/comments/:id`, `DELETE /api/admin/comments/:id`

---

#### 23. Users Management — `/admin/users`
**Description**: Anonymous users management.
- **Features**:
  - Header: "Users", search by username or fingerprint
  - Filters: trust score (Scholar/Neutral/Troll), post count, ban status, date range
  - Data table:
    - Username (any_XXXX)
    - Custom Display Name
    - Fingerprint (truncated)
    - Posts (Approved/Rejected/Pending breakdown)
    - Comments
    - Trust Score (badge)
    - First Seen
    - Last Active
    - Actions
  - Actions: View Profile, Ban, Whitelist, Shadow Ban
  - Ban modal: confirm, select duration
  - Trust score override dropdown
- **API Calls**: `GET /api/admin/users`, `PATCH /api/admin/users/:fingerprint/ban`

---

#### 24. Categories Management — `/admin/categories`
**Description**: CRUD for categories with tree view.
- **Features**:
  - Header: "Categories", "Add Category" button
  - Tree view:
    - Parent categories expandable
    - Drag-and-drop reordering
    - Expand/collapse children
    - Each item: icon, name, post count, featured badge, archived badge
  - Add/Edit category modal:
    - Name input
    - Slug input (auto-generated from name)
    - Description textarea
    - Icon picker (emoji)
    - Parent category dropdown
    - Featured toggle
  - Archive category modal (when deleting):
    - Select replacement category
    - Confirm move of all posts
  - Bulk actions: Feature, Unfeature, Archive
- **API Calls**: `GET /api/admin/categories`, `POST /api/admin/categories`, `PATCH /api/admin/categories/:id`, `DELETE /api/admin/categories/:id`

---

#### 25. Hall of Fame Management — `/admin/hall-of-fame`
**Description**: Manage featured posts.
- **Features**:
  - Header: "Hall of Fame Management"
  - "Add to Hall of Fame" button → opens modal:
    - Search for post
    - Add editorial note (optional)
    - Set featured date
  - List of featured posts:
    - Post title
    - Editorial note
    - Featured date
    - Actions: Remove, Edit Note, Reorder
  - Reorder via drag-and-drop
  - Auto-candidates section:
    - Suggested posts based on criteria
    - One-click "Add" button
- **API Calls**: `GET /api/admin/hall-of-fame`, `POST /api/admin/hall-of-fame`, `DELETE /api/admin/hall-of-fame/:id`

---

#### 26. Reactions Management — `/admin/reactions`
**Description**: Overview of all fire reactions with anti-fraud.
- **Features**:
  - Header: "Reactions"
  - Stats cards:
    - Total fires
    - Fires on posts
    - Fires on items
    - Fires on comments
  - Tabs: All | Posts | Items | Comments
  - Top lists:
    - Most viewed posts
    - Most popular items (by anchor comments)
    - Most fired comments
  - Suspicious activity section:
    - Bulk voting detected (same fingerprint)
    - Coordinated voting (same IP)
    - Auto-removed suspicious reactions
  - Action: Remove individual reactions
- **API Calls**: `GET /api/admin/reactions`, `GET /api/admin/reactions/fire`

---

#### 27. Search Management — `/admin/search`
**Description**: Elasticsearch management and reindexing.
- **Features**:
  - Header: "Search Management"
  - Connection status card:
    - Cluster health (green/yellow/red)
    - Node count
    - Index existence (posts, comments)
  - Index stats:
    - Posts index: document count, size
    - Comments index: document count, size
  - Actions:
    - "Reindex Posts" button with progress bar
    - "Reindex Comments" button with progress bar
    - "Full Reindex" button
    - "Delete & Recreate Index" (with confirmation)
  - Test search tool:
    - Input query
    - Select index (posts/comments)
    - View results
  - Index mappings viewer (read-only)
- **API Calls**: `GET /api/admin/search/status`, `POST /api/admin/search/reindex/posts`, `POST /api/admin/search/reindex/comments`

---

#### 28. Settings Page — `/admin/settings`
**Description**: Rate limits and trust score configuration.
- **Features**:
  - Header: "Settings"
  - Rate Limiting section:
    - General comments per hour (input, default: 5)
    - Item-anchored comments per hour (input, default: 25)
    - Posts per hour (input, default: 4)
    - Burst limit (input, default: 5 per 5 min)
    - Save button
  - Trust Scores section:
    - Distribution stats: Scholars count, Neutrals count, Trolls count
    - Recent flagged users list
    - Manual override: select user, set trust level

- **API Calls**: `GET /api/admin/rate-limits`, `PATCH /api/admin/rate-limits`, `GET /api/admin/trust-scores`

---

#### 29. Audit Logs — `/admin/audit`
**Description**: History of all admin actions.
- **Features**:
  - Header: "Audit Logs"
  - Filters: action type, admin user, date range
  - Data table:
    - Timestamp
    - Admin username
    - Action (login, approve_post, reject_post, delete_comment, etc.)
    - Target (post ID, user ID, etc.)
    - IP Address
    - Details (JSON expandable)
  - Pagination
  - Export CSV button
  - Retention notice: "Logs kept for 90 days"
- **API Calls**: `GET /api/admin/audit-logs`

---

## TECH STACK

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Search | Elasticsearch |
| Cache/Rate Limit | Redis |
| Auth | Admin only (JWT) |
| User Identity | Device fingerprint + `any_XXXX` |
| File Storage | MinIO / Cloudinary |

---

## WHAT WAS REMOVED

These features from the old social platform are NOT part of V1:

| Old Feature | Reason |
|-------------|--------|
| User registration/email auth | Replaced by anonymous |
| Google OAuth | Replaced by anonymous |
| JWT for users | Admin only |
| NextAuth.js | Admin only |
| User profiles (old) | Replaced by `/any_XXXX` |
| Follow system | Not needed |
| Connection system | Not needed |
| Reactions (complex) | Just fire for MVP |
| Strike system | Admin-only platform |
| Report system | Not needed for MVP |
| Communities | Not needed |
| Ephemeral threads | Not needed |
| Badge/Rank system | Not needed |
| Multi-account | Not needed |
| Trust scores (old) | Replaced by Shadow Trust |

---

## M17 — Moderator System

> Multi-admin system with granular, revocable permissions. One super admin creates moderators with specific access levels. Mods see only what they're authorized to see.

### M17.1 — Data Model
- [x] `AdminUser` extended — `role` ('super_admin' | 'mod'), `permissions` (string[]), `permissions_version` (number), `created_by` (string), `is_active` (boolean)
- [x] `PermissionPreset` model — `name`, `description`, `permissions` (4 idempotent seed presets: Read-Only Auditor, Content Moderator, Full Moderator, Community Manager)
- [x] Migration: Existing admin users automatically upgraded to `super_admin` role on server boot
- [x] `permissions_version` incremented on every mod permission change, stored in JWT

### M17.2 — Permission Catalog (31 permissions)
- [x] Dashboard — `dashboard:read`
- [x] Statistics — `statistics:read`
- [x] Posts — `posts:read`, `posts:approve`, `posts:edit`, `posts:delete`, `posts:manage`
- [x] Comments — `comments:read`, `comments:moderate`, `comments:penalty`, `comments:delete`
- [x] Users — `users:read`, `users:restrict`, `users:trust`
- [x] Categories — `categories:read`, `categories:edit`, `categories:bulk`
- [x] Hall of Fame — `hof:read`, `hof:manage`
- [x] Alerts — `alerts:read`, `alerts:manage`
- [x] Audit — `audit:read`, `audit:export`
- [x] Search — `search:read`, `search:manage`
- [x] Notifications — `notifications:read`, `notifications:send`
- [x] Config — `config:read`, `config:write` (double_blind super-admin-only)
- [x] Mods — `mods:manage` (super admin only, mapped for audit trail)

### M17.3 — Permission Enforcement (3 layers)
- [x] **Layer 1: Auto-Middleware** (`permissionGuard.ts`) — Centralized route-to-permission map (`permissionMap.ts`, 150+ routes), applied once to admin router. Login/logout/setup/me routes exempted. Super admin bypasses all checks. Unknown routes default to `__super_admin_only__`.
- [x] **Layer 2: Frontend Hook** (`usePermission.ts`) — Loading state handling (skeleton during hydration), super admin bypass, exact permission matching.
- [x] **Layer 3: Sidebar** (`admin/layout.tsx`) — All nav links guarded by `usePermission`. Sidebar collapses for mods with limited permissions.

### M17.4 — Token Handling
- [x] Super admin tokens: 24h expiry
- [x] Mod tokens: 4h expiry
- [x] `permissions_version` in JWT payload — middleware auto-refreshes token when version changes
- [x] Token stale detection: compares `decoded.permissions_version` with DB `permissions_version`

### M17.5 — Mod CRUD Endpoints (super admin only)
- [x] `POST /api/admin/mods` — Create moderator (validates permissions, logs audit)
- [x] `GET /api/admin/mods` — List all moderators
- [x] `GET /api/admin/mods/:id` — Get single moderator
- [x] `PATCH /api/admin/mods/:id` — Update permissions, toggle active (increments permissions_version)
- [x] `DELETE /api/admin/mods/:id` — Soft-disable moderator (sets is_active=false)
- [x] `POST /api/admin/mods/:id/reset-password` — Force password reset
- [x] `GET /api/admin/mods/permissions` — Full permission catalog (31)
- [x] `GET /api/admin/mods/presets` — All presets

### M17.6 — Security Guards
- [x] Mod cannot disable themselves
- [x] `config:write` cannot toggle `double_blind` (403 "This setting requires super admin access.")
- [x] Permission validation: invalid permissions rejected with 400
- [x] `permissions_version` increment on every permission/password change
- [x] Audit logging on all mod CRUD operations

### M17.7 — Frontend
- [x] `/admin/settings/mods` page — Mod list (mobile cards + desktop table), create/edit/delete/toggle/enable/reset-password actions
- [x] CreateModModal — Username/password fields, preset selector (4 presets), 12-category permission accordion, live permission count
- [x] EditModModal — Permission edit with live count
- [x] ResetPasswordModal — Password reset with validation
- [x] Admin layout sidebar — Permission-guarded nav links using `usePermission` hook
- [x] Admin store — `role`, `permissions`, `initialized` fields populated from `/me` response

### M17.8 — Tests
- [x] `permissionGuard.test.ts` — 20+ test cases: super admin bypass, mod permissions, route coverage, catalog validation, CI guard
- [x] All existing tests updated for new admin model shape

### M17.9 — Documentation
- [x] `docs/plans-mod-system.md` — Full enterprise implementation plan
- [x] `docs/plans-mod-system-flaws.md` — 11 flaw review
- [x] `docs/milestones.md` — This section
- [x] `docs/build-status.md` — Counts updated
