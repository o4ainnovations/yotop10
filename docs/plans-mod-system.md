# Moderator System — Enterprise Implementation Plan (v2)

## Objective

Replace the single-admin model with a multi-admin system. One super admin creates moderators with granular, revocable permissions. Mods see only what they're authorized to see. No UI code branches — permissions propagate from a centralized map.

---

## 1. Data Model

### 1.1 `AdminUser` — Extended

```typescript
{
  username: string;
  password_hash: string;
  role: 'super_admin' | 'mod';
  permissions: string[];              // e.g. ['posts:read', 'posts:approve']
  permissions_version: number;        // incremented on every permission change, stored in JWT
  token_version: number;
  failed_login_attempts: number;
  locked_until: Date | null;
  created_by: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
```

**Migration (runs once on deploy)**:
```typescript
await AdminUser.updateMany(
  { role: { $exists: false } },
  { role: 'super_admin', permissions: [], permissions_version: 1, is_active: true, created_by: 'system' }
);
```

### 1.2 `PermissionPreset` — New Model

```typescript
{
  name: string;            // "Content Moderator", "Full Moderator"
  description: string;
  permissions: string[];   // auto-check these when preset selected
  created_at: Date;
}
```

**Idempotent seed** (runs on every boot, skips if presets exist):
```typescript
if (await PermissionPreset.countDocuments() === 0) {
  await PermissionPreset.insertMany([
    { name: 'Read-Only Auditor', description: 'View analytics, dashboard, and audit logs', permissions: ['dashboard:read','statistics:read','audit:read'] },
    { name: 'Content Moderator', description: 'Approve posts and moderate comments', permissions: ['dashboard:read','posts:read','posts:approve','comments:read','comments:moderate','comments:penalty','categories:read','hof:read','statistics:read','audit:read','notifications:read'] },
    { name: 'Full Moderator', description: 'Full content management without user/config access', permissions: ['dashboard:read','statistics:read','posts:read','posts:approve','posts:edit','posts:delete','posts:manage','comments:read','comments:moderate','comments:penalty','comments:delete','categories:read','categories:edit','categories:bulk','hof:read','hof:manage','alerts:read','audit:read','audit:export','search:read','notifications:read','notifications:send'] },
    { name: 'Community Manager', description: 'Manage users, notifications, and Hall of Fame', permissions: ['dashboard:read','users:read','users:restrict','users:trust','hof:read','hof:manage','notifications:read','notifications:send','audit:read','statistics:read'] },
  ]);
}
```

---

## 2. Permission Catalog (31)

| Category | Permission | Controls |
|---|---|---|
| Dashboard | `dashboard:read` | View admin dashboard |
| Statistics | `statistics:read` | View analytics dashboard |
| Posts | `posts:read` | View review queue + all posts |
| | `posts:approve` | Change post status (approve/reject/retry) |
| | `posts:edit` | Edit post content (title, intro, items) |
| | `posts:delete` | Soft/hard delete |
| | `posts:manage` | Feature, lock, bump, bulk ops |
| Comments | `comments:read` | View comments table |
| | `comments:moderate` | Hide, unhide, highlight, unhighlight |
| | `comments:penalty` | Apply trust penalties + manage flags |
| | `comments:delete` | Soft/hard delete |
| Users | `users:read` | View user listing |
| | `users:restrict` | Ban/unban |
| | `users:trust` | Manual trust adjustment + rate overrides |
| Categories | `categories:read` | View tree/table/analytics |
| | `categories:edit` | Create, update, archive |
| | `categories:bulk` | Merge, reparent, import, export |
| Hall of Fame | `hof:read` | View entries |
| | `hof:manage` | Add, remove, reorder, edit notes |
| Alerts | `alerts:read` | View thresholds + history |
| | `alerts:manage` | Create, update, delete, toggle |
| Audit | `audit:read` | View logs |
| | `audit:export` | CSV export |
| Search | `search:read` | View ES status |
| | `search:manage` | Reindex, delete index |
| Notifications | `notifications:read` | View sent messages |
| | `notifications:send` | Send + manage templates |
| Config | `config:read` | View settings |
| | `config:write` | Modify rate limits + trust tiers |
| Mods | `mods:manage` | Create, edit, disable moderators (super admin only) |
| Profile | `profile:read` | View own admin profile (implicit — granted to all authenticated admins) |

**Overlap clarification**: `posts:approve` = change status only. `posts:edit` = change content only. The review detail page shows edit fields only if mod has `posts:edit`. The approve button shows only if mod has `posts:approve`. Three separate guards on one page: read (sees page), edit (sees edit fields), approve (sees approve button).

**Double-blind protection**: `config:write` cannot toggle `double_blind`. The `double_blind` field is super-admin-only. Saving config with `double_blind` change as a mod returns 403 with "This setting requires super admin access."

---

## 3. Centralized Permission Map (Single Source of Truth)

```typescript
// lib/permissionMap.ts
export const ROUTE_PERMISSIONS: Record<string, string> = {
  // Dashboard
  'GET /admin': 'dashboard:read',
  'GET /admin/stats/overview': 'statistics:read',
  
  // Posts
  'GET /admin/posts/pending': 'posts:read',
  'GET /admin/posts/pending/:id': 'posts:read',
  'PATCH /admin/posts/:id/approve': 'posts:approve',
  'PATCH /admin/posts/:id/reject': 'posts:approve',
  'POST /admin/posts/:id/retry': 'posts:approve',
  'GET /admin/posts': 'posts:read',
  'PATCH /admin/posts/:id': 'posts:edit',
  'DELETE /admin/posts/:id': 'posts:delete',
  'POST /admin/posts/:id/restore': 'posts:delete',
  'DELETE /admin/posts/:id/permanent': 'posts:delete',
  'POST /admin/posts/:id/feature': 'posts:manage',
  'POST /admin/posts/:id/unfeature': 'posts:manage',
  'POST /admin/posts/:id/lock': 'posts:manage',
  'POST /admin/posts/:id/unlock': 'posts:manage',
  'POST /admin/posts/:id/bump': 'posts:manage',
  'POST /admin/posts/bulk/status': 'posts:manage',
  'POST /admin/posts/bulk/delete': 'posts:delete',
  'POST /admin/posts/bulk/change-category': 'posts:edit',
  'POST /admin/posts/:id/duplicate': 'posts:edit',
  'GET /admin/posts/:id/activity': 'posts:read',
  'POST /admin/posts/quality-check': 'posts:read',
  'GET /admin/posts/export': 'posts:read',
  
  // Comments
  'GET /admin/comments': 'comments:read',
  'PATCH /admin/comments/:id': 'comments:moderate',
  'DELETE /admin/comments/:id': 'comments:delete',
  'POST /admin/comments/:id/restore': 'comments:delete',
  'DELETE /admin/comments/:id/permanent': 'comments:delete',
  'POST /admin/comments/:id/hide': 'comments:moderate',
  'POST /admin/comments/:id/unhide': 'comments:moderate',
  'POST /admin/comments/:id/highlight': 'comments:moderate',
  'POST /admin/comments/:id/unhighlight': 'comments:moderate',
  'POST /admin/comments/:id/flag': 'comments:penalty',
  'POST /admin/comments/:id/dismiss-flag': 'comments:penalty',
  'POST /admin/comments/:id/apply-penalty': 'comments:penalty',
  'GET /admin/comments/stats': 'comments:read',
  'GET /admin/comments/export': 'comments:read',
  
  // Users
  'GET /admin/users': 'users:read',
  'GET /admin/users/:user_id': 'users:read',
  'PATCH /admin/users/:user_id/restrict': 'users:restrict',
  'PATCH /admin/users/:user_id/rate-limits': 'users:trust',
  'PATCH /admin/users/:user_id/trust': 'users:trust',
  'GET /admin/users/:user_id/trust-history': 'users:read',
  
  // Categories
  'GET /admin/categories/stats': 'categories:read',
  'GET /admin/categories/health': 'categories:read',
  'GET /admin/categories/analytics': 'categories:read',
  'GET /admin/categories/export': 'categories:read',
  'GET /admin/categories/orphans': 'categories:read',
  'GET /admin/categories/check-duplicate': 'categories:read',
  'GET /admin/categories/:id/audit': 'categories:read',
  'POST /admin/categories': 'categories:edit',
  'PATCH /admin/categories/:id': 'categories:edit',
  'DELETE /admin/categories/:id': 'categories:edit',
  'POST /admin/categories/:id/duplicate': 'categories:edit',
  'POST /admin/categories/:id/publish': 'categories:edit',
  'POST /admin/categories/:id/hide': 'categories:edit',
  'POST /admin/categories/bulk/feature': 'categories:bulk',
  'POST /admin/categories/bulk/archive': 'categories:bulk',
  'POST /admin/categories/bulk/merge': 'categories:bulk',
  'POST /admin/categories/bulk/reparent': 'categories:bulk',
  'POST /admin/categories/import': 'categories:bulk',
  
  // Hall of Fame
  'GET /admin/hall-of-fame': 'hof:read',
  'POST /admin/hall-of-fame': 'hof:manage',
  'DELETE /admin/hall-of-fame/:id': 'hof:manage',
  'PATCH /admin/hall-of-fame/reorder': 'hof:manage',
  'PATCH /admin/hall-of-fame/:id': 'hof:manage',
  'GET /admin/hall-of-fame/candidates': 'hof:read',
  
  // Alerts
  'GET /admin/alerts/thresholds': 'alerts:read',
  'POST /admin/alerts/thresholds': 'alerts:manage',
  'PATCH /admin/alerts/thresholds/:id': 'alerts:manage',
  'DELETE /admin/alerts/thresholds/:id': 'alerts:manage',
  'PATCH /admin/alerts/thresholds/:id/toggle': 'alerts:manage',
  'GET /admin/alerts/notifications': 'alerts:read',
  'GET /admin/alerts/history': 'alerts:read',
  
  // Audit
  'GET /admin/audit-logs': 'audit:read',
  'GET /admin/audit-logs/stats': 'audit:read',
  'GET /admin/audit-logs/export': 'audit:export',
  
  // Search
  'GET /admin/search/status': 'search:read',
  'POST /admin/search/reindex': 'search:manage',
  'DELETE /admin/search/index': 'search:manage',
  'GET /admin/search/mappings': 'search:read',
  'GET /admin/search/preview': 'search:read',
  'GET /admin/stats/search/overview': 'search:read',
  
  // Notifications
  'GET /admin/messages': 'notifications:read',
  'POST /admin/messages': 'notifications:send',
  'DELETE /admin/messages/:id': 'notifications:send',
  'GET /admin/messages/:id/stats': 'notifications:read',
  'POST /admin/messages/templates': 'notifications:send',
  'GET /admin/messages/templates': 'notifications:read',
  'DELETE /admin/messages/templates/:id': 'notifications:send',
  
  // Config
  'GET /admin/config': 'config:read',
  'PUT /admin/config': 'config:write',
  'GET /admin/config/impact': 'config:read',
  'GET /admin/config/versions': 'config:read',
  
  // Mods
  'POST /admin/mods': 'mods:manage',
  'GET /admin/mods': 'mods:manage',
  'GET /admin/mods/:id': 'mods:manage',
  'PATCH /admin/mods/:id': 'mods:manage',
  'DELETE /admin/mods/:id': 'mods:manage',
  'POST /admin/mods/:id/reset-password': 'mods:manage',
  'GET /admin/mods/permissions': 'mods:manage',
  'GET /admin/mods/presets': 'mods:manage',
};

// CI GUARD: Any admin route NOT in this map → rejects all non-super-admins
export const DEFAULT_PERMISSION = '__super_admin_only__';
```

**How it's applied**: A single middleware function reads this map. Every admin route is automatically guarded. No manual `hasPermission()` calls in individual route files. Zero risk of missing a route.

---

## 4. Permission Enforcement — Three Layers

### Layer 1: Auto-Middleware (`lib/permissionGuard.ts`)

```typescript
import { ROUTE_PERMISSIONS, DEFAULT_PERMISSION } from './permissionMap';

export function autoPermissionGuard(req: Request, res: Response, next: NextFunction) {
  const admin = req.admin;
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });
  if (admin.role === 'super_admin') return next();

  const routeKey = `${req.method} ${req.route?.path || req.path}`;
  const required = ROUTE_PERMISSIONS[routeKey] || DEFAULT_PERMISSION;

  if (required === DEFAULT_PERMISSION || !admin.permissions?.includes(required)) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      error: `Missing permission: ${required}`,
      required,
    });
  }
  return next();
}
```

Applied once in `server.ts` to the admin router:
```typescript
adminRouter.use(autoPermissionGuard);
```

**No changes to individual route files.** The map is the single source of truth.

### Layer 2: Frontend Hook (`usePermission.ts`)

```typescript
export function usePermission(permission: string): { allowed: boolean; loading: boolean } {
  const admin = useAdminStore((s) => s.admin);
  const initialized = useAdminStore((s) => s.initialized);
  
  if (!initialized) return { allowed: false, loading: true };
  if (!admin) return { allowed: false, loading: false };
  if (admin.role === 'super_admin') return { allowed: true, loading: false };
  return { allowed: admin.permissions?.includes(permission) ?? false, loading: false };
}
```

**Loading state pattern**:
```tsx
const { allowed, loading } = usePermission('posts:approve');
if (loading) return <Skeleton />;
if (!allowed) return null;
return <ApproveButton />;
```

No UI flash. Skeleton shown during admin store hydration.

### Layer 3: Sidebar (`admin/layout.tsx`)

```tsx
{usePermission('posts:read').allowed && <SidebarLink href="/admin/posts/pending">Review Queue</SidebarLink>}
```

---

## 5. Token Handling — Permissions Version

**Problem**: Permissions in JWT can be up to 23 hours stale.

**Enterprise fix**: Add `permissions_version` to JWT payload. Middleware compares `decoded.permissions_version` with `admin.permissions_version`. If they differ → token is stale → re-issue with current permissions.

Also: reduce mod token expiry to **4 hours** (vs 24h for super admin). Super admin tokens remain 24h.

```typescript
const expiresIn = admin.role === 'super_admin' ? '24h' : '4h';
const token = jwt.sign({ id, username, role, permissions, permissions_version, token_version }, secret, { expiresIn });
```

Middleware auto-refresh:
```typescript
if (decoded.permissions_version !== admin.permissions_version) {
  // Permissions changed since token was issued — re-issue now
  const newToken = generateToken(admin);
  res.cookie('admin_token', newToken, { httpOnly: true, secure: true });
}
```

Maximum staleness: 4 hours (mod token expiry). Typical staleness: <1 hour (token auto-refresh when <1hr remaining).

---

## 6. API Endpoints (all mods:manage — super admin only)

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/admin/mods` | Create moderator |
| `GET` | `/admin/mods` | List all moderators |
| `GET` | `/admin/mods/:id` | Get single moderator |
| `PATCH` | `/admin/mods/:id` | Update (permissions, active status) |
| `DELETE` | `/admin/mods/:id` | Disable (soft-delete, sets is_active=false) |
| `POST` | `/admin/mods/:id/reset-password` | Force password reset |
| `GET` | `/admin/mods/permissions` | List all available permissions (31) |
| `GET` | `/admin/mods/presets` | List presets |

**Preset sync**: When editing a mod, show "Sync from preset" button. Re-applies the preset's permissions to the mod, overwriting current permissions. Preset selection stored on mod document as `applied_preset` field for future syncs.

---

## 7. Frontend: `/admin/settings/mods` Page

### Create Moderator

- Username + password (with generate button)
- Preset selector (4 defaults + any custom)
- Selecting a preset → auto-checks all preset permissions
- 12 category accordions with individual permission checkboxes
- Live permission count: "14 permissions selected"
- Save button → creates mod + generates SetupToken-like initial password

### Mod List

- Table: username, preset, permission count, status (active/disabled), created date
- Actions: Edit (opens EditMod modal), Disable/Enable toggle, Reset Password
- Disabled mods shown with strikethrough and grayed out

### Edit Mod

- Same permission selector as create form
- Toggle active/inactive
- "Sync from preset" button if mod was created with a preset
- "Remove all permissions" (effectively disables mod without deleting)
- Save propagates: updates permissions_version → forces token refresh on next mod request

---

## 8. Files (Updated Count)

| File | Action | Effort |
|---|---|---|
| `backend/src/lib/permissionMap.ts` | Create — single source of truth (100+ entries) | L |
| `backend/src/lib/permissionGuard.ts` | Create — auto-middleware using map | M |
| `backend/src/models/AdminUser.ts` | Modify — add role, permissions, permissions_version, created_by, is_active | M |
| `backend/src/models/PermissionPreset.ts` | Create | S |
| `backend/src/lib/seedPresets.ts` | Create — idempotent seeder | S |
| `backend/src/lib/adminAuth.ts` | Modify — extend req.admin, mod token 4h, permissions_version check | M |
| `backend/src/routes/admin.ts` | Add 8 mod CRUD endpoints + apply autoPermissionGuard | L |
| `backend/src/server.ts` | Modify — apply autoPermissionGuard to admin router + seed presets | S |
| `backend/src/lib/permissionGuard.test.ts` | Tests — 15+ cases | M |
| `frontend/src/hooks/usePermission.ts` | Create — with loading state | S |
| `frontend/src/app/admin/settings/mods/page.tsx` | Create — mod management page | L |
| `frontend/src/components/admin/CreateModModal.tsx` | Create — preset + individual selection | L |
| `frontend/src/components/admin/EditModModal.tsx` | Create — edit + sync preset | M |
| `frontend/src/app/admin/layout.tsx` | Modify — sidebar guarded by usePermission | M |
| `frontend/src/lib/api/endpoints/admin.ts` | Add mod API functions | S |
| `docs/milestones.md` | Add mod system section | S |
| **CI test** | Script that verifies ROUTE_PERMISSIONS covers all admin routes | M |

---

## 9. CI Security Test

```typescript
// Runs in CI. Fails build if any admin route lacks permission mapping.
import { ROUTE_PERMISSIONS } from '../lib/permissionMap';
import adminRouter from '../routes/admin';

adminRouter.stack.forEach(layer => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).filter(m => layer.route.methods[m]);
    methods.forEach(method => {
      const key = `${method.toUpperCase()} ${layer.route.path}`;
      if (!ROUTE_PERMISSIONS[key]) {
        throw new Error(`UNGUARDED ROUTE: ${key} — add to permissionMap.ts`);
      }
    });
  }
});
```

---

## 10. Implementation Order

1. Backend: AdminUser model changes + migration
2. Backend: PermissionPreset model + seeder
3. Backend: permissionMap.ts (100+ route entries)
4. Backend: permissionGuard.ts (auto-middleware)
5. Backend: Mod CRUD endpoints
6. Backend: Extend adminAuth (permissions_version, 4h mod tokens)
7. Backend: Apply autoPermissionGuard to admin router
8. CI: Security test for route coverage
9. Frontend: usePermission hook
10. Frontend: API client updates
11. Frontend: Sidebar guard
12. Frontend: CreateMod + EditMod modals
13. Frontend: /admin/settings/mods page
14. Tests: 25+ test cases
15. Documentation
