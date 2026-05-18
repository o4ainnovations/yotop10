# Moderator System Plan — Flaw & Inconsistency Review

## FLAW 1: Permission Count Mismatch
**Problem**: Plan says 29 permissions. `mods:manage` is added in section 4 but NOT in the catalog in section 2. If included, it's 30. If it's super-admin-implicit, it shouldn't be in the catalog or the section 4 guard.

**Fix**: Either add `mods:manage` to the catalog as permission #30 (even though only super admin can assign it), OR remove the explicit guard and make mod CRUD endpoints check `role === 'super_admin'` directly. Recommend: add it to catalog — keeps the pattern consistent and audit-trailable.

---

## FLAW 2: Migration Gap — Existing Admin Has No Role
**Problem**: Current AdminUser model has no `role`, `permissions`, `created_by`, or `is_active` fields. The existing admin would have missing fields after schema change, breaking `admin.role === 'super_admin'` comparison.

**Fix**: Add a migration script that runs once on deploy:
```typescript
await AdminUser.updateMany({ role: { $exists: false } }, { 
  role: 'super_admin', 
  permissions: [], 
  is_active: true, 
  created_by: 'system' 
});
```
Run this in `initConfig()` or a dedicated migration step on server boot.

---

## FLAW 3: Token Staleness — 23 Hours, Not 1 Hour
**Problem**: Plan says "Maximum 1hr stale" for permissions. But the token auto-refresh fires when token has <1hr remaining on a 24hr token. Token was issued with old permissions → refresh copies old permissions into new token → staleness persists across refreshes. Permissions only update on FULL re-login.

**Fix**: Add `permissions_version` to AdminUser (incremented when mod permissions change). Store in JWT payload. Middleware checks `decoded.permissions_version !== admin.permissions_version` → force re-login or re-fetch permissions. Or simpler: reduce token expiry to 4 hours for mods, 24 hours for super admin.

---

## FLAW 4: `posts:approve` vs `posts:edit` — Overlap
**Problem**: The review detail page (`/admin/posts/pending/[id]`) lets admins edit post content before approving. If a mod has `posts:approve` but NOT `posts:edit`, can they still use the approve button? The approve endpoint also triggers post edits (setting status, published_at). Is that `approve` or `edit`?

**Fix**: Clarify: `posts:approve` covers "change post status" (approve/reject/retry). `posts:edit` covers "change post content" (title, intro, items). The review detail page should: show content (needs `posts:read`), show approve button (needs `posts:approve`), show edit fields (needs `posts:edit`). Three separate guards on one page.

---

## FLAW 5: Sidebar Guard vs Backend Guard Desync
**Problem**: Sidebar hides links based on `*:read` permission. But if a backend route accidentally omits `hasPermission()`, the mod can access it via URL even though the sidebar hid it. Silent security gap.

**Fix**: Create a test that ensures every admin route has a `hasPermission()` call. Scripted check:
```typescript
for (const route of adminRoutes) {
  assert(route.middleware.includes('hasPermission'), `Missing permission guard on ${route.path}`);
}
```
Add to CI pipeline. Fails build if any admin route lacks permission guard.

---

## FLAW 6: PermissionPreset Model Not Seeded
**Problem**: Plan says "Default presets seeded on first setup" but doesn't specify the mechanism. The current setup flow creates admin + seeds alert defaults. Presets need the same treatment.

**Fix**: Create `lib/seedPresets.ts`. Call in `server.ts` after `initConfig()` with an idempotency check: `if (await PermissionPreset.countDocuments() === 0) { seedDefaults(); }`.

---

## FLAW 7: `config:write` Can Disable Double-Blind
**Problem**: A mod with `config:write` can toggle `double_blind: false` in trust tiers config. This defeats the entire double-blind moderation system. Double-blind should be a super-admin-only setting.

**Fix**: Add a `super_admin_only` flag to specific config keys. Or extract `double_blind` from config and make it a separate endpoint guarded by `mods:manage` (super admin only). The config impact preview already has this check — extend it to the save logic.

---

## FLAW 8: No Permission for "View Own Profile"
**Problem**: Admin profile page (`/admin/profile`) — every admin should be able to view and edit their own profile. But the plan has no `profile` permission. Mods would be locked out of their own profile page.

**Fix**: Add `profile:read` (view own profile) and `profile:edit` (change own password) to the catalog. 31 permissions total. These are implicitly granted to every mod because the profile page checks "is this the current user's profile?" not "does this user have profile:read?".

---

## FLAW 9: 25+ Route Files — Manual Error Risk
**Problem**: Adding `hasPermission()` to every admin route across 10+ files is error-prone. A missed route = security gap. A wrong permission = broken mod UX.

**Fix**: Create a permission map — a single source of truth:
```typescript
export const ROUTE_PERMISSIONS: Record<string, string> = {
  'GET /admin/posts/pending': 'posts:read',
  'PATCH /admin/posts/:id/approve': 'posts:approve',
  'GET /admin/users': 'users:read',
  // ... every route listed exactly once
};
```
Then a generator applies `hasPermission()` to all routes at startup. If a route isn't in the map, it defaults to rejecting all non-super-admins. Zero manual errors.

---

## FLAW 10: Preset Changes Don't Affect Existing Mods
**Problem**: Plan correctly states "permissions copied at creation time." But what if super admin updates a preset and WANTS existing mods to get the new permissions? No mechanism exists.

**Fix**: Add a "Sync Preset Changes" button on the mod edit page. When clicked, it re-applies the mod's original preset (if one was used) and overwrites their current permissions. Optional — leave existing mods untouched by default.

---

## FLAW 11: Frontend Hook Loading State
**Problem**: `usePermission('posts:approve')` returns false while the admin store is still loading. Every guarded UI element flashes hidden → visible. Jank UX.

**Fix**: Add `adminLoading` state to the hook. Components use `{adminLoading && <Skeleton />} {!adminLoading && hasPermission && <Button />}`. Or use a simple approach: always render the button but disable it with a spinner during loading.

---

## UPDATED PERMISSION COUNT: 31

Add `profile:read` and `mods:manage` to the catalog. The mod CRUD endpoints use `mods:manage` (super-admin-only). The profile page uses implicit self-access (any authenticated admin can view/edit their own profile).

---

## INCONSISTENCY 1: `mods:manage` vs `users:manage`
Mods are AdminUser documents. Creating/deleting mods IS user management. Having both `users:manage` and `mods:manage` is confusing. BUT mods are NOT in the User collection — they're in AdminUser. So `users:manage` (User collection) and `mods:manage` (AdminUser collection) are separate concerns. The naming is correct. Keep both.

## INCONSISTENCY 2: Category permissions count
The plan says "12 categories × ~2.4 permissions each." But 29/12 = 2.4 average. With `mods:manage` + `profile:read` added (31), it's 2.6 average. Still fine.

## INCONSISTENCY 3: Plan says "15 files" but lists 14
Count verification: 7 backend + 7 frontend + 1 docs = 15. Actually: 5 backend files (AdminUser model, PermissionPreset model, permissionGuard.ts, adminAuth.ts, admin.ts) + 1 test + 1 hook + 2 frontend pages + 2 modals + 1 layout + 1 types update + 25+ existing route files to modify. That's way more than 15. The plan underestimates.

**Fix**: Update file count to ~35 (5 new + 1 modified model + 1 modified middleware + 10 route files modified + 6 frontend files + docs + tests).
