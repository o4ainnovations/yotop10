# BEFORE DOING ANYTHING: FIRST READ AGENTS.md IN FULL


# 🚀 RAM.md - Current Highest Priority Task

## CURRENT HIGHEST PRIORITY: **M3 Pre-Requisite Fixes**

These must be completed before Submit Page (M3) will work correctly.

---

## ✅ Already Handled:
1. ✅ Category seed data populated
2. ✅ Post slug generation bug fixed
3. ✅ Trust score calculation engine implemented
4. ✅ Trust score hooked up to approve/reject endpoints
5. ✅ Review queue backend fully implemented

---

## ⚠️ Remaining Required Pre-Requisites (Do these FIRST):

| # | Task | Status | Impact if skipped |
|---|---|---|---|
| 1 | ⛔ Fix double rate limiting count | `pending` | Users get rate limited at half the documented limit |
| 2 | 🔑 Fix frontend fingerprint race condition | `pending` | 10% of first-time users lose access to their posts permanently |

**Total estimated effort**: 15-30 minutes

---

## NEXT: Submit Page (M3 Frontend)
User-facing page for submitting top 10 posts. Without this, users cannot create content.

**Milestone**: M3 — Anonymous Post Submission
**Blockers**: Above 2 tasks
**Estimated effort**: 2-3 hours

---

## ✅ Task Completed: M10.3 Admin UI Pages for Review Queue
All admin UI pages for the review queue are now 100% implemented and functional.

---

### ✅ Implementation Complete
1. ✅ Admin route authentication guard implemented in `/admin/layout.tsx`
2. ✅ `/admin/posts/pending` - Review queue list page implemented
   - FIFO oldest first sorting
   - Approve/Reject actions per row
   - Pagination 20 per page
   - Preview navigation
3. ✅ `/admin/posts/pending/[id]` - Full pending post preview page implemented
   - Full post content with all list items
   - Approve button
   - Reject modal with reason input
   - Navigation back to queue
4. ✅ Approval / Rejection flow fully functional
5. ✅ Integration with all 4 backend endpoints

### ✅ All acceptance criteria met:
- Admin authentication required for all pages
- Full backend integration complete
- Approve triggers trust score updates
- Reject requires reason
- Minimal unstyled HTML only (no design/styling implemented)
- TypeScript 0 errors
- Full Next.js build passes

---

## Implementation Steps (Submit Page)

1. Create frontend page at `/frontend/src/app/submit/page.tsx`
2. Fetch categories for dropdown (GET /api/categories)
3. Implement form fields:
   - Post type selector (top_list only for now)
   - Category dropdown (EXACTLY 1, required)
   - Title input (5-300 chars)
   - Intro/description textarea (max 2000 chars)
   - Dynamic list items (add/remove/reorder, min 1, max 25)
   - Author display name input (3-50 chars)
4. Submit to POST /api/posts with device_fingerprint
5. Handle success/error feedback
6. Test TypeScript compilation
7. Test build
8. Update rom.md
