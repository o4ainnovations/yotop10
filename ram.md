# RAM — Runtime Action Manifest

## Completed
- **[M00.0] Dev ports changed** — Frontend `3000→3100`, Backend `8000→8100`
- **[Fix] PM2 7 compatibility** — JSON ecosystem config, Node entry points, pm2 install
- **[Fix] Hydration mismatch** — `useRef` counter for deterministic item IDs
- **[Fix] Enterprise seed script resilience** — 4-layer fix:
  1. Removed `required: true` from `normalized_title` (pre-save hook sets it, validation runs first)
  2. Replaced dead `post('save')` hook with `pre('save')` flag + `post('save')` increment
  3. Added `/posts/:idOrSlug/comments` GET+POST to posts router, removed dead routes from comments.ts
  4. Created `services/posts.ts` service layer — one code path for post creation

## Current
- _(none)_

## Next
- _(none)_
