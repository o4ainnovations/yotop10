# BEFORE DOING ANYTHING: FIRST READ AGENTS.md IN FULL


# 🚀 RAM.md - Current Highest Priority Task

## CURRENT HIGHEST PRIORITY: **M10.3 Admin UI Pages for Review Queue**
🔴 **CRITICAL PUBLIC LAUNCH BLOCKER.**

---

## Task: Implement M10.3 Frontend Admin UI
All backend endpoints are complete. Now implement the frontend pages required to review and moderate pending posts.

---

### ✅ Pre-Requisites Complete
- ✅ All 4 backend endpoints fully implemented
- ✅ Trust score integration working
- ✅ Admin authentication system complete
- ✅ Category post count auto increment/decrement working

---

### 📋 Required Pages & Components to Implement

#### 1. `/admin/posts/pending` - Review Queue List Page
**Purpose**: List all pending posts for moderation
- **Layout**: Data table with pending posts
- **Columns**: Title, Author, Category, Post Type, Submitted Date
- **Default sort**: Oldest first (FIFO)
- **Actions per row**: Preview, Approve, Reject
- **Pagination**: 20 per page
- **Features**:
  - Quick inline preview expand
  - Keyboard shortcuts: A=Approve, R=Reject
  - Bulk actions disabled per requirements

#### 2. `/admin/posts/pending/[id]` - Full Pending Post Preview
**Purpose**: Complete review of individual pending post
- **Layout**: Exact same display as public post view
- **Full content**: All list items visible
- **Actions**: Approve / Reject buttons
- **Navigation**: Previous/Next between pending posts
- **Rejection modal**: Requires reason selection + custom text

#### 3. Required Shared Components
- `ReviewCard` - Pending post preview component
- `ApprovalModal` - Confirm approve action
- `RejectionModal` - Reject with reason dropdown + custom input
- `DataTable` - Sortable/filterable/paginated table
- `Toast` - Success/error notifications

---

### ⚠️ **DO NOT implement** at this stage:
- ❌ Bulk actions
- ❌ Request changes endpoint / UI
- ❌ Filters and search
- ❌ Keyboard shortcuts (implement as final step)
- ❌ Styling / design - minimal unstyled HTML only

---

### ✅ Implementation Order
1. Implement base admin route authentication guard
2. Implement `/admin/posts/pending` list page
3. Implement `/admin/posts/pending/[id]` preview page
4. Implement approval modal flow
5. Implement rejection modal flow
6. Implement toast notifications

---

**Blockers**: None. All backend dependencies are complete. Can be implemented immediately.

**Estimated effort**: 3-4 hours total.
