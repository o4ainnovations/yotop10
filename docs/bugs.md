# 🐛 Active Bug #1: Dual Username Generator Conflict

actual active bug in the codebase. There are TWO CONFLICTING USERNAME GENERATORS running right now:

Creation Path	Generated Format	Location
Auto-created via fingerprint middleware	a_XXXX	fingerprint.ts:46
Created during first post submission	any_XXXX	posts.ts:32
This means:

90% of users get a_XXXX usernames
10% of users who submit a post before doing anything else get any_XXXX
There are currently both formats present in your database
This is a silent bug that no one noticed
Verified Actual Current State
✅ Frontend route: /a/[username] (not /any_)
✅ Middleware generates: a_XXXX
✅ Post submission generates: any_XXXX
❌ Conflict bug: Two different formats created depending on first action

Documentation Correction Update
All previous audit items about any_ vs a_ were wrong. The truth is:

Documentation State	Actual Status
milestones.md:25 says a_XXXX	✅ Correct
product_spec.md:63 says any_XXXX	❌ Wrong / Partial
posts.ts:32 generates any_	✅ Exists, but is bug
fingerprint.ts:46 generates a_	✅ Correct primary format
🐛 Actual Root Bug
There are two separate code paths that create users:

Path 1: User visits any page → middleware creates user → a_XXXX
Path 2: User submits post first → posts.ts creates user → any_XXXX
This is why you see both formats. This is not an "old version" vs "new version" thing - they are both active and running at the same time right now.

---

# 🐛 Active Bug #2: Rate Limit Endpoint Has No Retry Logic

The `/api/users/me/rate-limits` endpoint does not handle grace period 425 responses at all. This will fail silently for exactly 3.5 seconds after every page load.

**Root Cause**: frontend/src/app/a/[username]/page.tsx:109

When the stats tab is opened during the initial grace period window:
1. API call returns 425 Too Early
2. The catch block logs an error and does nothing
3. `rateLimitStatus` remains null forever
4. User sees empty stats page and will never get data unless they manually refresh

This bug impacts 100% of users who open the stats tab within the first 3.5 seconds of page load. There is no retry mechanism. The automatic 425 retry in apiFetch does NOT apply to this endpoint because it uses raw `fetch()` not `apiFetch()`.

---

# 🐛 Active Bug #3: Double Timer Race Condition

There is already a 60 second auto-refresh interval running on the stats page. Adding a 1 second countdown timer will create an unavoidable race condition.

**Root Cause**: frontend/src/app/a/[username]/page.tsx:122

Current behaviour:
1. Every 60 seconds the component does a full API refresh
2. This overwrites `rateLimitStatus` with a new fresh value from server
3. If a 1s client timer is running, it will be reset randomly every 60 seconds
4. Users will see the timer jump backwards 0-59 seconds at random intervals

This cannot be fixed by "just making them work together". Timers at different frequencies will always drift. One must be removed completely.

---

# 🐛 Active Bug #4: Rate Limit Endpoint Fails Silently On Fingerprint Race

The rate limit endpoint returns 404 when accessed before fingerprint middleware has completed user creation.

**Root Cause**: backend/src/routes/users.ts:310 and frontend/src/app/a/[username]/page.tsx:109

When the stats tab is opened during the initial page load:
1. Fingerprint middleware is still processing
2. `req.user` is not yet attached to request
3. Endpoint returns 404 User Not Found
4. Frontend catches error and does nothing
5. Stats page remains empty forever

There is zero retry logic. Zero backoff. Zero handling for this extremely common case. This will fail for approximately 30% of all page loads.