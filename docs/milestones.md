# YoTop10 — Build Milestones

> **Platform**: Open anonymous top 10 lists platform. No login required. Admin-only review.
> **Stack**: MERN — MongoDB + Express + Next.js + Elasticsearch
> **Note**: All styling deferred until after MVP. Platform functions with minimal styling until launch.

---

## Overview

This is the simplified roadmap based on the [revert.md](./revert.md) plan. The platform transforms from a full social platform into an open Wikipedia-style platform:

- **Anyone** can submit top 10 lists (anonymous, device fingerprint tracked)
- **Anyone** can comment with nested threading (up to 3 levels like Twitter/X)
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
- **Profile Page**: `/a_XXXX` shows all posts (Approved/Rejected/Pending with badges)

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
| Action | Limit |
|-------|-------|
| General Comments | 50 per hour per user |
| Item-Anchored Comments | 45 per hour per user |
| Posts | 4 posts per hour per user |
| Burst Protection | Max 5 comments per 5 minutes |

### Shadow Trust Score
| User Type | Last 5 Posts | Comment Limit Multiplier |
|-----------|--------------|------------------------|
| Scholar | ≥7 approved | 2x (40/hr) |
| Neutral | Mixed | 1x (20/hr) |
| Troll | ≤3 rejected | 0.1x (2/hr) |

---

## PHASE 1 — MVP LAUNCH (V1)

### M1 — Project Foundation
- [ ] Monorepo structure (`/frontend` + `/backend`)
- [ ] Next.js 14 frontend (App Router)
- [ ] Express.js backend
- [ ] MongoDB setup (local + connection)
- [ ] Elasticsearch setup
- [ ] Redis setup (rate limiting, caching)
- [ ] Docker Compose (frontend, backend, MongoDB, Redis, Elasticsearch)
- [ ] Environment configuration

### M2 — Database Schema
- [ ] `users` collection (anonymous: user_id, username, custom_display_name, device_fingerprint, is_admin)
- [ ] `posts` collection (author_id, author_username, author_display_name, title, post_type, intro, status, category_id, fire_count, comment_count, view_count, created_at, updated_at)
- [ ] `list_items` collection (post_id, rank, title, justification, image_url, source_url, fire_count)
- [ ] `comments` collection (post_id, list_item_id, parent_comment_id, depth, author_id, author_username, author_display_name, content, fire_count, reply_count, created_at, updated_at)
- [ ] `reactions` collection (user_device_fingerprint, target_type, target_id, reaction_type, created_at)
- [ ] `categories` collection (name, slug, description, icon, parent_id, post_count, is_featured, is_archived)
- [ ] `admin_user` collection (username, password_hash)
- [ ] MongoDB indexes for performance
- [ ] Seed 10 parent + 300 child categories

### M3 — Anonymous Post Submission
- [ ] `POST /api/posts` — Submit post (no auth)
  - Body: `{ title, post_type, intro, category_id (EXACTLY 1), items, author_display_name }`
  - All posts default to `pending_review`
  - Generate `any_XXXX` username from device fingerprint
  - Rate limit: 4 posts/hour per fingerprint

### M4 — Public Feed
- [ ] `GET /api/posts` — Approved posts only
  - Filter: `status=approved`
  - Sort: newest first
  - Filter by category (exactly 1)
  - Pagination (20 per page)
- [ ] `GET /api/posts/:id` — Single post with items + comments

### M5 — Post Detail Page
- [x] Frontend: `/post/[id]`
- [x] Full post display with ranked list items
- [x] Item-anchored comments (highlight specific item)
- [x] Nested comments (max 3 levels)
- [x] Fire reactions (toggle on/off)
- [x] "Submit a Counter-List" button
- [x] Post history/changelog

### M5.5 — The SEO "Authority" Routing System
[ ] **Part A: Database Schema Evolution**
- [ ] `slug` field added to Post schema: `{ type: String, unique: true, index: true }`
- [ ] `generateUniqueSlug(title, id)` utility function:
  - Normalize title (lowercase, remove special chars, replace spaces with `-`)
  - Truncate to 60 chars
  - Append last 6 chars of post ID
- [ ] Migration script to populate slug for all existing posts

[ ] **Part B: The "Flat" Wikipedia Route (Next.js)**
- [ ] Restructure: `app/post/[id]/page.tsx` → `app/[slug]/page.tsx`
- [ ] Update page to fetch via slug instead of ID
- [ ] **Route Guard**:
  - Define `RESERVED_ROUTES = ['admin', 'api', 'login', 'search', 'settings', 'profile', 'categories', 'c', 'auth']`
  - If params.slug is in reserved list → trigger notFound()
- [ ] **Legacy Support**:
  - Old `/post/[id]` → 301 Permanent Redirect to new slug-based URL

[ ] **Part C: Content Governance & Quality Control**
- [ ] Title Similarity Engine: `GET /api/posts/check-title?q=...`
- [ ] Frontend: "Similar list already exists" warning in Create Post UI if match > 80%
- [ ] **SEO Indexing Guard**:
  - Set `robots: "noindex"` if:
    - `post.spark_score === 0` AND `post.age > 48h`
    - Post description < 100 characters

[ ] **Part D: Schema.org "Rich Results" Integration**
- [ ] Post detail page injects ItemList JSON-LD with ListItem schema (position, name, description)
- [ ] Dynamic canonical tag: `<link rel="canonical" href="https://yotop10.com/${slug}" />`

[ ] **Part E: Internal Link Refactor**
- [ ] Update all `<Link href={"/post/" + post.id}>` components across the app to use `href={"/" + post.slug}`

### M5.6 — The Arena (Counter-List System)
The Arena is what transforms YoTop10 from a static list site into a competitive debate platform. It allows users to challenge any existing "Top 10" with their own version, triggering a "Battle" between the two perspectives.

M5.6.1 — Counter-List Data Architecture
[ ] POST /api/posts/:id/counter — Create a rebuttal post

Request: { title, intro, items: [], parentId }

Logic:

Validate parentId exists.

Copy original items to the new post but allow reordering/replacement.

Set post_type to counter.

Spark Boost: Add +10 to parentId.spark_score immediately.

[ ] GET /api/posts/:id/counters — Fetch all challenges for a post

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
- [ ] `GET /api/categories` — All categories
- [ ] `GET /api/categories/:slug` — Single category
- [ ] Category hierarchy (10 parents, 300 children)
- [ ] Frontend: `/categories` and `/c/[slug]`
- [ ] Admin CRUD for categories

### M7 — Comment System
- [x] `GET /api/posts/:id/comments` — Get comments
- [x] `POST /api/posts/:id/comments` — Add comment (anonymous)
  - Two modes: Full Post Comment OR Item-Anchored Comment
  - Nested replies (max 3 levels)
- [x] `PATCH /api/comments/:id` — Edit (within 2hr window)
- [x] `DELETE /api/comments/:id` — Delete own comment
- [x] Rate limit: 50 comments/hour per user

### M8 — Fire Reactions
- [ ] `POST /api/reactions` — Toggle fire
- [ ] `GET /api/reactions/state` — Check reaction status
- [ ] Works on posts, list items, comments

### M9 — Admin Authentication
- [ ] `POST /api/admin/login` — Admin login
- [ ] JWT token for admin only
- [ ] Protect all `/api/admin/*` routes

### M10 — Admin Dashboard (Industry Standard)

> The admin dashboard is the command center for YoTop10. This is where you control everything. It's designed like a professional CMS.

#### M10.1 — Admin Authentication & Security
- [ ] `POST /api/admin/login` — Login with username/password
  - Request: `{ username, password }`
  - Response: JWT token (httpOnly cookie) + admin user info
- [ ] `POST /api/admin/logout` — Invalidate session
- [ ] `GET /api/admin/me` — Get current admin user
- [ ] `POST /api/admin/refresh` — Refresh JWT token
- [ ] JWT stored in httpOnly, secure cookie
- [ ] Token expiry: 24 hours
- [ ] Rate limit: 5 login attempts per 15 minutes per IP
- [ ] Audit log: login attempts (success/failed, IP, timestamp)

#### M10.2 — Dashboard Overview / Stats
- [ ] `GET /api/admin/stats` — Real-time platform statistics
  - **Posts Stats**:
    - Total posts (all time)
    - Posts today / this week / this month
    - Pending review count
    - Approved today / this week / this month
    - Rejected today / this week / this month
  - **Comments Stats**:
    - Total comments (all time)
    - Comments today / this week / this month
  - **Users Stats**:
    - Total unique device fingerprints (anonymous users)
    - New users today / this week / this month
  - **Engagement Stats**:
    - Total fire reactions
    - Total views
    - Average comments per post
  - **Category Stats**:
    - Categories with most posts
    - Categories needing attention (no posts)
- [ ] Charts/graphs: Posts over time, Comments over time, Top categories
- [ ] Quick actions: Go to review queue, Create category

#### M10.3 — Review Queue (Pending Posts)
- [ ] `GET /api/admin/posts/pending` — List pending posts
  - Query params: `page`, `limit`, `category`, `post_type`, `date_from`, `date_to`, `sort`
  - Default sort: oldest first (oldest submissions first)
- [ ] `GET /api/admin/posts/pending/:id` — Full preview of pending post
- [ ] `PATCH /api/admin/posts/:id/approve` — Approve post
  - Auto-generates slug from title
  - Sets status to `approved`
  - Sets `published_at` timestamp
  - Indexes in Elasticsearch
  - Optional: send notification (future)
- [ ] `PATCH /api/admin/posts/:id/reject` — Reject post
  - Request: `{ reason }` (required)
  - Common reasons: "Spam", "Inappropriate content", "Duplicate", "Low quality", "Incorrect category", "Misleading title"
  - Sets status to `rejected`
  - Stores rejection reason for analytics
- [ ] `PATCH /api/admin/posts/:id/request_changes` — Request changes (keep pending)
  - Request: `{ feedback }` — specific feedback for author
  - Status remains `pending_review`
  - Author can see feedback in their profile
- [ ] Bulk actions:
  - `POST /api/admin/posts/bulk/approve` — Approve multiple
  - `POST /api/admin/posts/bulk/reject` — Reject multiple
- [ ] Filters:
  - By category (dropdown)
  - By post type (dropdown)
  - By date submitted (date range picker)
  - By author (search by username)
- [ ] Quick preview: Click to expand inline without leaving page
- [ ] Keyboard shortcuts: A=Approve, R=Reject, E=Request Changes

#### M10.4 — All Posts Management
- [ ] `GET /api/admin/posts` — All posts with full data
  - Query params: `page`, `limit`, `status`, `category`, `post_type`, `author`, `date_from`, `date_to`, `sort`, `search`
- [ ] Table columns:
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
- [ ] Actions per post:
  - **View**: Open in new tab (public view)
  - **Edit**: Inline edit or modal (title, category, items)
  - **Delete**: Soft delete (archive) or hard delete
  - **Feature**: Add to Hall of Fame
  - **Unfeature**: Remove from Hall of Fame
  - **Lock**: Prevent comments
  - **Bump**: Move to top of feed
- [ ] Bulk actions:
  - Select all / Select none
  - Bulk approve (only pending)
  - Bulk reject (only pending)
  - Bulk delete
  - Bulk feature
  - Bulk change category
- [ ] Search: Full-text search in title, intro, list items
- [ ] Export: CSV/Excel export of filtered results

#### M10.5 — All Comments Management
- [ ] `GET /api/admin/comments` — All comments
  - Query params: `page`, `limit`, `post_id`, `author`, `status`, `date_from`, `date_to`, `sort`, `search`
- [ ] Table columns:
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
- [ ] Actions:
  - **View Post**: Go to post page
  - **Edit**: Edit comment content
  - **Delete**: Remove comment
  - **Highlight**: Pin comment to top
  - **Hide**: Hide from public (soft delete)
- [ ] Search: Full-text search in comment content
- [ ] Filters:
  - By post
  - By author (device fingerprint or username)
  - By type (post comment / item-anchored)
  - By date range
  - By has replies (yes/no)
- [ ] Moderation flags:
  - Auto-flag: High fire count negative (controversial)
  - Auto-flag: Very long comments (potential spam)
  - Auto-flag: Many replies in short time (brigading)

#### M10.6 — Users Management (Anonymous)
- [ ] `GET /api/admin/users` — All anonymous users
- [ ] Table columns:
  - Username (any_XXXX)
  - Custom Display Name (if set)
  - Device Fingerprint (truncated)
  - Total Posts (Approved/Rejected/Pending breakdown)
  - Total Comments
  - Trust Score (Scholar/Neutral/Troll)
  - First Seen
  - Last Active
- [ ] Actions:
  - **View Profile**: See all their posts/comments
  - **Ban**: Prevent from posting (by fingerprint)
  - **Whitelist**: Mark as trusted (bypass rate limits)
  - **Shadow Ban**: Can post but only they see it
- [ ] Search: By username, by fingerprint
- [ ] Filters:
  - By trust score
  - By post count (high/low)
  - By ban status
  - By date range

#### M10.7 — Categories Management
- [ ] `GET /api/admin/categories` — All categories (tree view)
- [ ] `POST /api/admin/categories` — Create category
  - Request: `{ name, slug, description, icon, parent_id, is_featured }`
  - Auto-generate slug from name if not provided
  - Validate: unique name, unique slug
- [ ] `PATCH /api/admin/categories/:id` — Update category
  - Edit any field
  - Reorder within parent
- [ ] `DELETE /api/admin/categories/:id` — Archive category
  - Soft delete (is_archived: true)
  - Require: select replacement category for all posts
  - Move all posts to replacement category
- [ ] Tree structure:
  - Drag-and-drop reordering
  - Expand/collapse parent categories
  - View subcategories under parent
- [ ] Bulk actions:
  - Bulk feature/unfeature
  - Bulk archive
- [ ] Stats per category:
  - Post count
  - Pending posts
  - Approved posts
  - Most active authors

#### M10.8 — Hall of Fame Management
- [ ] `GET /api/admin/hall-of-fame` — All featured posts
- [ ] `POST /api/admin/hall-of-fame` — Add to Hall of Fame
  - Request: `{ post_id, editorial_note, featured_date }`
  - Editorial note: Short text explaining why featured
- [ ] `DELETE /api/admin/hall-of-fame/:id` — Remove from Hall of Fame
- [ ] `PATCH /api/admin/hall-of-fame/reorder` — Reorder featured posts
- [ ] Auto-candidate suggestions:
  - Posts with 50+ item-anchored comments
  - Posts active for 3+ months
  - Low controversy (more CONFIRMED than CONTESTED)
- [ ] Featured badge customization

#### M10.9 — Reactions Management
- [ ] `GET /api/admin/reactions` — All reactions
- [ ] `GET /api/admin/reactions/fire` — Fire reactions breakdown
  - By post, by list item, by comment
  - Top fired posts
  - Most fired items
- [ ] `DELETE /api/admin/reactions/:id` — Remove reaction (admin can delete any)
- [ ] Anti-fraud:
  - Detect bulk voting (same fingerprint multiple votes)
  - Detect coordinated voting (multiple fingerprints from same IP)
  - Auto-remove suspicious reactions

#### M10.10 — Search & Elasticsearch Management
- [ ] `GET /api/admin/search/status` — Elasticsearch connection status
  - Cluster health
  - Index existence
  - Document counts per index
  - Index sizes
- [ ] `POST /api/admin/search/reindex/posts` — Reindex all posts
  - Progress indicator
  - Error log if any
- [ ] `POST /api/admin/search/reindex/comments` — Reindex all comments
- [ ] `POST /api/admin/search/reindex/all` — Full reindex
- [ ] `DELETE /api/admin/search/index` — Delete and recreate index
- [ ] Index mappings viewer
- [ ] Test search query tool

#### M10.11 — Rate Limiting & Trust Scores
- [ ] `GET /api/admin/rate-limits` — View rate limit settings
- [ ] `PATCH /api/admin/rate-limits` — Adjust rate limits
  - General comments per hour
  - Item-anchored comments per hour
  - Posts per hour
  - Burst limit
- [ ] `GET /api/admin/trust-scores` — View trust score distribution
  - Count of Scholars
  - Count of Neutrals
  - Count of Trolls
  - Recently flagged users
- [ ] Manual trust score override:
  - `PATCH /api/admin/users/:fingerprint/trust` — Set trust level manually
  - Options: scholar, neutral, troll

#### M10.12 — Audit Logs
- [ ] `GET /api/admin/audit-logs` — All admin actions
  - Actions: login, approve_post, reject_post, delete_comment, etc.
  - Log: admin_id, action, target_id, timestamp, IP
- [ ] Filters:
  - By action type
  - By admin user
  - By date range
- [ ] Retention: 90 days default
- [ ] Export: CSV export for compliance

#### M10.13 — Frontend Admin Pages
- [ ] `/admin` — Redirect to dashboard (or login if not authenticated)
- [ ] `/admin/login` — Login page
  - Username input
  - Password input
  - "Remember me" checkbox
  - Forgot password link (future)
- [ ] `/admin/dashboard` — Overview with stats cards and charts
- [ ] `/admin/posts/pending` — Review queue
- [ ] `/admin/posts` — All posts management
- [ ] `/admin/comments` — Comments management
- [ ] `/admin/users` — Anonymous users management
- [ ] `/admin/categories` — Categories CRUD
- [ ] `/admin/hall-of-fame` — Featured posts
- [ ] `/admin/reactions` — Reactions overview
- [ ] `/admin/search` — Search management
- [ ] `/admin/settings` — Rate limits, trust scores
- [ ] `/admin/audit` — Audit logs

#### M10.14 — Admin UI Components
- [ ] `AdminLayout` — Sidebar navigation + header
- [ ] `AdminSidebar` — Collapsible, icons + labels
- [ ] `StatsCard` — Metric with trend indicator
- [ ] `StatsChart` — Line/bar charts (use Recharts)
- [ ] `DataTable` — Sortable, filterable, paginated
- [ ] `BulkActionsBar` — Appears when items selected
- [ ] `ReviewCard` — Pending post preview card
- [ ] `ApprovalModal` — Approve with optional note
- [ ] `RejectionModal` — Reject with reason dropdown + custom reason
- [ ] `CategoryTree` — Drag-drop tree view
- [ ] `UserBadge` — Trust score badge (Scholar/Neutral/Troll)
- [ ] `SearchInput` — Global admin search
- [ ] `DateRangePicker` — Filter by date
- [ ] `ExportButton` — CSV/Excel export
- [ ] `Toast` — Success/error notifications
- [ ] `ConfirmDialog` — Destructive action confirmation

---

### M11 — User Profiles
- [ ] `GET /api/users/:username` — Profile data
- [ ] `GET /api/users/:username/posts` — User's posts
- [ ] `PATCH /api/users/:username` — Update display name
- [ ] Frontend: `/any_XXXX` — Profile page
- [ ] Show Approved/Rejected/Pending posts with badges

### M12 — Search & Discovery
- [ ] Elasticsearch indexes for posts + comments
- [ ] `GET /api/search` — Full search
- [ ] `GET /api/search/autocomplete` — Autocomplete
- [ ] Filters: category, post type, author, date range
- [ ] Sort: relevance, newest, most fired
- [ ] Frontend: `/search`

### M13 — Arguments Page
- [ ] `GET /api/arguments` — Hot debates
- [ ] Most active item-anchored comments
- [ ] Filter by category, time range
- [ ] Frontend: `/arguments`

### M14 — Hall of Fame
- [ ] `GET /api/hall-of-fame` — Featured lists
- [ ] Admin curation controls
- [ ] Frontend: `/hall-of-fame`

---

## V1 MVP — COMPLETION CHECKLIST

- [ ] Anonymous post submission works (no login)
- [ ] Public feed shows only approved posts
- [ ] Post detail with list items + comments
- [ ] Nested comments (max 3 levels, Twitter/X-style)
- [ ] Item-anchored comments (highlight specific item)
- [ ] Fire reactions (toggle)
- [ ] Categories system (10 parents, 300 children)
- [ ] Admin login protects dashboard
- [ ] Review queue: approve/reject posts
- [ ] Submit page: create posts with dynamic list items
- [ ] Device fingerprinting tracks anonymous users
- [ ] Smart rate limiting (per user, not IP)
- [ ] Shadow Trust Score system
- [ ] Elasticsearch search with autocomplete
- [ ] Arguments page (hot debates)
- [ ] Hall of Fame
- [ ] User profiles at `/a_XXXX`
- [ ] Deployed and verified

---

## M15 — Identity Portability

✅ **Philosophy**: Crypto wallet style identity. No passwords, no emails. User owns their reputation completely.

### Implementation:
- [ ] `POST /api/identity/generate-key` — Generate 12-word seed phrase for authenticated user
- [ ] `POST /api/identity/claim` — Claim identity on new device using seed phrase
- [ ] `POST /api/identity/link` — Link additional device fingerprint to existing identity
- [ ] User cluster system: Multiple fingerprints can map to single authority ID
- [ ] Seed phrases are NOT stored on server - only bcrypt hash of public key
- [ ] No recovery system. If seed is lost, identity is permanently lost.
- [ ] **Trust Score Prefix Removal**: Users with Scholar trust score (>1.8) automatically lose the `a_` prefix. Usernames become completely custom.

### UX:
- [ ] Profile page section: "Secure My Authority"
- [ ] "This is your only key. We do not store this. If you lose it, your reputation is gone forever."
- [ ] 12 word BIP39 standard seed phrase
- [ ] Optional JSON identity file download
- [ ] Claim identity page for new devices
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
- [ ] Reply notifications

### V2.5 — PWA & Mobile
- [ ] Progressive Web App manifest
- [ ] Offline support

---

## API ENDPOINTS SUMMARY

### Public (No Auth)
```
GET    /api/categories              # List categories
GET    /api/categories/:slug       # Single category
GET    /api/posts                  # Approved posts (paginated)
GET    /api/posts/:id              # Single post with items + comments
POST   /api/posts                  # Submit new post (anonymous)
GET    /api/posts/:id/comments     # Comments for post
POST   /api/posts/:id/comments     # Add comment (anonymous)
PATCH  /api/comments/:id            # Edit own comment (2hr window)
DELETE /api/comments/:id           # Delete own comment
GET    /api/comments/:id/replies   # Get replies
POST   /api/reactions              # Toggle fire reaction
GET    /api/reactions/state        # Get reaction states
GET    /api/search                 # Full search
GET    /api/search/autocomplete    # Autocomplete
GET    /api/arguments              # Hot debates
GET    /api/hall-of-fame           # Featured lists
GET    /api/users/:username        # User profile
GET    /api/users/:username/posts  # User posts
PATCH  /api/users/:username        # Update display name
```

### Admin (Auth Required)
```
POST   /api/admin/login                # Admin login
POST   /api/admin/logout               # Admin logout
GET    /api/admin/me                   # Current admin user
POST   /api/admin/refresh              # Refresh JWT token
GET    /api/admin/stats                # Dashboard stats
GET    /api/admin/posts/pending        # Review queue
GET    /api/admin/posts/pending/:id   # Preview pending post
PATCH  /api/admin/posts/:id/approve    # Approve post
PATCH  /api/admin/posts/:id/reject     # Reject post
PATCH  /api/admin/posts/:id/request_changes  # Request changes
POST   /api/admin/posts/bulk/approve   # Bulk approve
POST   /api/admin/posts/bulk/reject    # Bulk reject
GET    /api/admin/posts                # All posts
PATCH  /api/admin/posts/:id            # Edit post
DELETE /api/admin/posts/:id            # Delete post
POST   /api/admin/posts/:id/feature    # Add to Hall of Fame
POST   /api/admin/posts/:id/unfeature  # Remove from Hall of Fame
GET    /api/admin/comments             # All comments
PATCH  /api/admin/comments/:id        # Edit comment
DELETE /api/admin/comments/:id         # Delete comment
POST   /api/admin/comments/:id/highlight  # Pin comment
GET    /api/admin/users                # All anonymous users
PATCH  /api/admin/users/:fingerprint/ban     # Ban user
PATCH  /api/admin/users/:fingerprint/whitelist  # Whitelist user
PATCH  /api/admin/users/:fingerprint/trust     # Set trust score
GET    /api/admin/categories           # All categories
POST   /api/admin/categories          # Create category
PATCH  /api/admin/categories/:id     # Update category
DELETE /api/admin/categories/:id      # Archive category
GET    /api/admin/hall-of-fame        # Featured posts
POST   /api/admin/hall-of-fame        # Add to Hall of Fame
DELETE /api/admin/hall-of-fame/:id   # Remove from Hall of Fame
PATCH  /api/admin/hall-of-fame/reorder  # Reorder
GET    /api/admin/reactions           # All reactions
DELETE /api/admin/reactions/:id      # Delete reaction
GET    /api/admin/search/status       # ES status
POST   /api/admin/search/reindex/posts    # Reindex posts
POST   /api/admin/search/reindex/comments # Reindex comments
POST   /api/admin/search/reindex/all      # Full reindex
GET    /api/admin/rate-limits         # View rate limits
PATCH  /api/admin/rate-limits        # Update rate limits
GET    /api/admin/trust-scores        # Trust score distribution
GET    /api/admin/audit-logs          # Audit logs
```

---

## FRONTEND ROUTES & PAGE DESCRIPTIONS

### Public Pages

#### 1. Homepage — `/`
**Description**: The main landing page displaying the public feed of approved posts.
- **Features**:
  - Header with logo, search bar, navigation links (Categories, Arguments, Hall of Fame), Submit button
  - Category filter dropdown in sidebar or header
  - Sort controls: Newest (default), Most Fired, Most Commented
  - Responsive grid of PostCards (1-3 columns based on screen)
  - PostCard displays: title, author (any_XXXX), category badge, 🔥 fire count, comment count, relative date
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
  - Success toast: "Post submitted! It's now pending review."
  - Error handling with toast notifications
  - Form validation before submit
- **API Calls**: `GET /api/categories`, `POST /api/posts`

---

#### 3. Post Detail Page — `/post/[id]`
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
- **API Calls**: `GET /api/posts/:id`, `GET /api/posts/:id/comments`, `POST /api/comments`, `POST /api/reactions`, `GET /api/reactions/state`

---

#### 4. Post History/Changelog — `/post/[id]/history`
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
- **API Calls**: `GET /api/posts/:id/history`

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
  - Sort controls: Newest, Most Fired, Most Commented
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
  - Sort options: Relevance (default), Newest, Oldest, Most Fired
  - Results display:
    - Post results: title (highlighted), excerpt, category badge, author, fire count, comment count, date
    - Comment results: content (highlighted), post title attached to, author, date, reply count
  - Active filters shown as removable tags
  - URL params for shareability: `/search?q=movies&category=tech&sort=newest`
  - Pagination or "Load More"
  - Empty results state: "No results found for 'query'"
  - No query state: Show recent/popular posts
- **API Calls**: `GET /api/search`, `GET /api/search/posts`, `GET /api/search/comments`

---

#### 8. Arguments Page — `/arguments`
**Description**: Hot debates page showing most active item-anchored comments (the "Talk" page).
- **Features**:
  - Page title: "Arguments" or "Hot Debates"
  - Description: "Most active item-anchored discussions"
  - Filter bar:
    - Category dropdown (filter by category)
    - Time range: Today, This Week, This Month, All Time (default)
  - Sort toggle: Most Replies, Recent Activity
  - List of ArgumentItems:
    - Post title
    - List item number and title (e.g., "#4: The Godfather")
    - Comment preview (first 100 chars)
    - Reply count
    - Time since last reply ("2 hours ago")
  - Click item → navigates to post, scrolls to that specific item
- **API Calls**: `GET /api/arguments`

---

#### 9. Hall of Fame Page — `/hall-of-fame`
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
      - 🔥 fire count
      - "Featured" badge
  - Category sections below:
    - Posts organized by category
    - Community-vetted criteria badge:
      - 50+ item-anchored comments
      - Active for 3+ months
      - Low controversy
  - Static display (not algorithm-sorted)
- **API Calls**: `GET /api/hall-of-fame`

---

#### 10. User Profile Page — `/users/[username]`
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
      - Fire count, Comment count
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

#### 15. Admin Login Page — `/admin/login`
**Description**: Admin authentication page.
- **Features**:
  - YoTop10 logo/branding
  - Username input
  - Password input
  - "Remember me" checkbox
  - Login button
  - Error messages for invalid credentials
  - Rate limit message if too many attempts
- **API Calls**: `POST /api/admin/login`

---

#### 16. Admin Dashboard — `/admin/dashboard`
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

#### 17. Review Queue — `/admin/posts/pending`
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

#### 18. All Posts Management — `/admin/posts`
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

#### 19. Comments Management — `/admin/comments`
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

#### 20. Users Management — `/admin/users`
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

#### 21. Categories Management — `/admin/categories`
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

#### 21. Hall of Fame Management — `/admin/hall-of-fame`
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

#### 22. Reactions Management — `/admin/reactions`
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
    - Most fired posts
    - Most fired items
    - Most fired comments
  - Suspicious activity section:
    - Bulk voting detected (same fingerprint)
    - Coordinated voting (same IP)
    - Auto-removed suspicious reactions
  - Action: Remove individual reactions
- **API Calls**: `GET /api/admin/reactions`, `GET /api/admin/reactions/fire`

---

#### 23. Search Management — `/admin/search`
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

#### 24. Settings Page — `/admin/settings`
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
  - Save confirmation toast
- **API Calls**: `GET /api/admin/rate-limits`, `PATCH /api/admin/rate-limits`, `GET /api/admin/trust-scores`

---

#### 25. Audit Logs — `/admin/audit`
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
