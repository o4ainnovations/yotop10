# 🚀 RAM.md - Current Highest Priority Task

## CURRENT HIGHEST PRIORITY: **M10.3 Review Queue**
**CRITICAL: THIS BLOCKS PUBLIC LAUNCH. NOTHING ELSE MATTERS UNTIL THIS IS IMPLEMENTED.**

---

## Task: Implement M10.3 Review Queue Endpoints
All posts submitted by users go into a black hole right now. There is no way to view, approve, or reject them.

---

### ✅ Pre-Requisites Complete
- ✅ Admin authentication system 100% working
- ✅ Post submission flow 100% working
- ✅ Post status lifecycle schema fully implemented
- ✅ Trust score hooks ready to trigger automatically
- ✅ All database models and indexes complete

---

### 📋 Required Endpoints to Implement

#### 1. `GET /api/admin/posts/pending`
**Purpose**: List all pending posts for admin review
- **Auth**: Admin only
- **Query params**: `page`, `limit`, `category`, `post_type`, `date_from`, `date_to`, `sort`
- **Default sort**: Oldest first (FIFO)
- **Response**: Full post metadata with author info, no list items

#### 2. `GET /api/admin/posts/pending/:id`
**Purpose**: Full preview of a single pending post
- **Auth**: Admin only
- **Response**: Complete post including all list items

#### 3. `PATCH /api/admin/posts/:id/approve`
**Purpose**: Approve a post and publish it to public feed
- **Auth**: Admin only
- **Actions when executed**:
  1. Set status to `approved`
  2. Set `published_at` timestamp to now
  3. Generate final unique slug from title
  4. Increment category post count
  5. Trigger trust score recalculation for author
  6. Add Elasticsearch index stub (empty implementation for now)
  7. Post becomes visible on public feed immediately

#### 4. `PATCH /api/admin/posts/:id/reject`
**Purpose**: Reject a pending post
- **Auth**: Admin only
- **Required body**: `{ reason: string }`
- **Actions when executed**:
  1. Set status to `rejected`
  2. Store rejection reason permanently
  3. Decrement category post count if previously approved
  4. Trigger trust score recalculation for author
  5. Post remains invisible to public

---

### ✅ Automatic Behaviors (No additional code needed)
- Trust scores will update automatically on approve/reject
- Approved posts will appear in public feed immediately
- All database triggers are already implemented

---

### ⚠️ **Do NOT implement** at this stage:
- ❌ Bulk actions
- ❌ Request changes endpoint
- ❌ Filters and search
- ❌ Keyboard shortcuts
- ❌ Admin UI pages (these come after endpoints work)

---

### ✅ Implementation Order
1. Implement `GET /api/admin/posts/pending`
2. Implement `GET /api/admin/posts/pending/:id`
3. Implement `PATCH /api/admin/posts/:id/approve`
4. Implement `PATCH /api/admin/posts/:id/reject`

---

**Blockers**: None. All dependencies are complete. This can be implemented immediately.

**Estimated effort**: 4-6 hours total.
