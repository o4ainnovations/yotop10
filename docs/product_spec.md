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
- Simple username + password login
- Only ONE admin (you)
- JWT token for session

### Features
- **Review Queue**: Approve/Reject pending posts
- **Post Management**: Edit or delete any post
- **Comment Management**: Delete inappropriate comments
- **Category Management**: Create/Edit/Delete/Archive categories
- **Analytics**: View counts, pending posts count

---

## 11. Page Structure (Routes)

```
/                          → Public feed (newest first)
/arguments                 → Arguments Page (Hot Debates)
/hall-of-fame             → Hall of Fame (Best Lists)
/submit                    → Anonymous post submission
/post/[id]                → Post detail + comments
/post/[id]/history        → Post changelog/revisions
/post/[id]/counter       → Counter-lists for post
/categories               → Browse all categories
/c/[slug]                 → Category feed
/any_XXXX                 → User profile (e.g., /any_9Gh7)
/admin                    → Admin login
/admin/dashboard           → Review queue
/admin/posts              → All posts management
/admin/comments           → Comment management
/admin/categories         → Category management
/admin/hall-of-fame       → Manage Hall of Fame
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
| **Frontend** | Next.js 14 (App Router) |
| **Backend** | Python + FastAPI |
| **Database** | PostgreSQL |
| **Auth** | Device fingerprint (no JWT for users) |
| **Admin Auth** | Simple JWT (admin only) |

---

## 14. What's Different From Original Plan

### Disabled/Commented Out (Not Deleted)
- User registration
- User logins (regular users)
- Google OAuth
- JWT for regular users
- User profiles (replaced with anonymous any_XXXX)
- Follow system
- Connection system
- Reactions (Fire)
- Strike system
- Report system
- Communities
- Ephemeral threads
- Badges
- Multi-account
- Trust scores
- NextAuth.js

### What Stays Active
- Anonymous posting (any_XXXX)
- Device fingerprinting
- Advanced comment system
- Categories (full implementation)
- Admin dashboard
- Post review queue

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
- **M15 Identity Portability / Seed Phrases**
- **M3.1 Title Similarity Check**
- And more...

All the disabled code is still there - just commented out.

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

These features are fully functional but have not yet been added to formal API documentation.
