# Moderator System — Enterprise Implementation Plan

## Objective

Replace the single-admin model with a multi-admin system. One super admin creates moderators with granular, revocable permissions. Mods see only what they're authorized to see. No UI code branches — permissions propagate automatically.

---

## 1. Data Model

### 1.1 `AdminUser` — Extended

```typescript
{
  username: string;
  password_hash: string;
  role: 'super_admin' | 'mod';
  permissions: string[];          // e.g. ['posts:read', 'posts:approve']
  token_version: number;
  failed_login_attempts: number;
  locked_until: Date | null;
  created_by: string;             // super_admin username or 'system'
  is_active: boolean;             // soft-delete — mods can be disabled
  created_at: Date;
  updated_at: Date;
}
```

### 1.2 `PermissionPreset` — New Model

```typescript
{
  name: string;                   // "Content Moderator", "Full Moderator"
  description: string;
  permissions: string[];          // auto-check these when preset selected
  created_at: Date;
}
```

Default presets seeded on first setup:
- **Read-Only Auditor**: `dashboard:read`, `statistics:read`, `audit:read`
- **Content Moderator**: all posts + all comments (11 permissions)
- **Full Moderator**: everything except `config:write`, `users:restrict`, `users:trust`, `alerts:manage`, `search:manage`
- **Community Manager**: all users + notifications + HoF (6 permissions)

---

## 2. Permission Catalog (29)

### Category: Dashboard
| Permission | Controls |
|---|---|
| `dashboard:read` | View admin dashboard overview |

### Category: Statistics
| Permission | Controls |
|---|---|
| `statistics:read` | View analytics dashboard (21 panels) |

### Category: Posts
| Permission | Controls |
|---|---|
| `posts:read` | View review queue + all posts table |
| `posts:approve` | Approve / reject / retry posts |
| `posts:edit` | Edit post content (title, intro, items) |
| `posts:delete` | Soft/hard delete posts |
| `posts:manage` | Feature, unfeature, lock, unlock, bump, bulk operations |

### Category: Comments
| Permission | Controls |
|---|---|
| `comments:read` | View comments table |
| `comments:moderate` | Hide, unhide, highlight, unhighlight |
| `comments:penalty` | Apply trust score penalties + manage flags |
| `comments:delete` | Soft/hard delete comments |

### Category: Users
| Permission | Controls |
|---|---|
| `users:read` | View user listing |
| `users:restrict` | Ban / unban users |
| `users:trust` | Manual trust score adjustment + rate limit overrides |

### Category: Categories
| Permission | Controls |
|---|---|
| `categories:read` | View category tree/table/analytics |
| `categories:edit` | Create, update, archive categories |
| `categories:bulk` | Merge, reparent, import, export categories |

### Category: Hall of Fame
| Permission | Controls |
|---|---|
| `hof:read` | View Hall of Fame |
| `hof:manage` | Add, remove, reorder, edit editorial notes |

### Category: Alerts
| Permission | Controls |
|---|---|
| `alerts:read` | View alert thresholds + history |
| `alerts:manage` | Create, update, delete, toggle thresholds |

### Category: Audit
| Permission | Controls |
|---|---|
| `audit:read` | View audit logs |
| `audit:export` | Export audit logs to CSV |

### Category: Search Management
| Permission | Controls |
|---|---|
| `search:read` | View ES status + analytics |
| `search:manage` | Reindex, delete index, test queries |

### Category: Notifications
| Permission | Controls |
|---|---|
| `notifications:read` | View sent messages + templates |
| `notifications:send` | Send individual/broadcast messages + manage templates |

### Category: Config
| Permission | Controls |
|---|---|
| `config:read` | View rate limits + trust tier settings |
| `config:write` | Modify rate limits + trust tier settings |

---

## 3. Permission Enforcement — Three Layers

### Layer 1: Backend Middleware (`lib/permissionGuard.ts`)

```typescript
export function hasPermission(required: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const admin = req.admin;
    if (!admin) return res.status(401).json({ error: 'Unauthorized' });
    if (admin.role === 'super_admin') return next();           // super admin bypasses all
    if (!admin.permissions?.includes(required)) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        error: `Missing permission: ${required}`,
      });
    }
    return next();
  };
}
```

Usage in routes:
```typescript
router.patch('/posts/:id/approve', hasPermission('posts:approve'), async (req, res) => { ... });
router.get('/users', hasPermission('users:read'), async (req, res) => { ... });
```

**Pattern**: Every protected admin route gets exactly ONE `hasPermission()` call. No other changes needed.

### Layer 2: Frontend Hook (`usePermission.ts`)

```typescript
export function usePermission(permission: string): boolean {
  const admin = useAdminStore((s) => s.admin);
  if (!admin) return false;
  if (admin.role === 'super_admin') return true;
  return admin.permissions?.includes(permission) ?? false;
}
```

Every conditional UI element uses it:
```tsx
{hasPermission('posts:approve') && <ApproveButton />}
{hasPermission('users:trust') && <EditTrustModal />}
```

### Layer 3: Sidebar (`admin/layout.tsx`)

```typescript
{hasPermission('posts:read') && <SidebarLink href="/admin/posts/pending">Review Queue</SidebarLink>}
{hasPermission('comments:read') && <SidebarLink href="/admin/comments">Comments</SidebarLink>}
```

Moderator logs in → only sees sidebar items they have `*:read` permission for. No manual hiding logic.

---

## 4. API Endpoints (all super-admin-only)

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/admin/mods` | Create moderator (super admin only) |
| `GET` | `/admin/mods` | List all moderators |
| `GET` | `/admin/mods/:id` | Get single moderator |
| `PATCH` | `/admin/mods/:id` | Update moderator (permissions, active status) |
| `DELETE` | `/admin/mods/:id` | Disable moderator (soft-delete) |
| `POST` | `/admin/mods/:id/reset-password` | Force password reset |
| `GET` | `/admin/mods/permissions` | List all available permissions (for frontend) |
| `GET` | `/admin/mods/presets` | List permission presets |

**Guard**: All mod management routes use `hasPermission('users:manage')`. Wait — super admins have implicit `*` but there's no `users:manage` in the catalog. 

**Fix**: Add `mods:manage` permission to the catalog. ONLY the super admin gets it. No mod can create other mods.

---

## 5. Modify: `adminAuthMiddleware`

Current middleware: checks JWT → finds AdminUser → sets `req.admin`.

Extended:
```typescript
// After finding admin:
req.admin = {
  id: admin._id,
  username: admin.username,
  role: admin.role,
  permissions: admin.permissions || [],
  token_version: admin.token_version,
};

// If mod is inactive:
if (admin.role === 'mod' && !admin.is_active) {
  return res.status(403).json({ code: 'ACCOUNT_DISABLED', error: 'Your account has been disabled' });
}
```

---

## 6. Frontend: `/admin/settings/mods` Page

### Create Moderator Form
```
┌──────────────────────────────────────────────────────┐
│  Create Moderator                                    │
│  ────────────────                                    │
│  Username: [_______________]                         │
│  Password: [_______________]  [Generate]             │
│                                                      │
│  Preset: [Select a preset ▾]                         │
│    ┌──────────────────────────────────────────────┐  │
│    │ Content Moderator                            │  │
│    │ Can approve posts and moderate comments      │  │
│    │ 11 permissions auto-selected                 │  │
│    └──────────────────────────────────────────────┘  │
│                                                      │
│  Or select individually:                             │
│  ┌─ Posts ─────────────────────────────────────────┐ │
│  │ ☑ read  ☑ approve  ☐ edit  ☐ delete  ☐ manage │ │
│  └─────────────────────────────────────────────────┘ │
│  ┌─ Comments ──────────────────────────────────────┐ │
│  │ ☑ read  ☑ moderate  ☐ penalty  ☐ delete       │ │
│  └─────────────────────────────────────────────────┘ │
│  ┌─ Users ─────────────────────────────────────────┐ │
│  │ ☐ read  ☐ restrict  ☐ trust                    │ │
│  └─────────────────────────────────────────────────┘ │
│  ... (all 12 categories expanded)                    │
│                                                      │
│  [Create Moderator]                                  │
└──────────────────────────────────────────────────────┘
```

### Mod List
```
┌──────────────────────────────────────────────────────┐
│  Active Moderators                                   │
│  ────────────────                                    │
│  ┌──────────────────────────────────────────────────┐│
│  │ [A] mod_john     Content Moderator    Active     ││
│  │     11 permissions · created 3 days ago          ││
│  │     [Edit] [Disable] [Reset Password]            ││
│  ├──────────────────────────────────────────────────┤│
│  │ [A] mod_sarah    Full Moderator      Active      ││
│  │     24 permissions · created 1 week ago          ││
│  │     [Edit] [Disable] [Reset Password]            ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

---

## 7. Files

| File | Action | Effort |
|---|---|---|
| `backend/src/models/AdminUser.ts` | Add role, permissions, created_by, is_active fields | S |
| `backend/src/models/PermissionPreset.ts` | New model | S |
| `backend/src/lib/permissionGuard.ts` | New — hasPermission middleware | M |
| `backend/src/lib/adminAuth.ts` | Modify — extend req.admin with role + permissions | M |
| `backend/src/routes/admin.ts` | Add 8 mod CRUD endpoints + seed presets + apply hasPermission to all existing routes | L |
| `backend/src/lib/permissionGuard.test.ts` | Tests for middleware | M |
| `frontend/src/hooks/usePermission.ts` | New hook | S |
| `frontend/src/app/admin/settings/mods/page.tsx` | Mod management page | L |
| `frontend/src/components/admin/CreateModModal.tsx` | Create form with preset + individual selection | L |
| `frontend/src/components/admin/EditModModal.tsx` | Edit permissions + active status | M |
| `frontend/src/app/admin/layout.tsx` | Sidebar links guarded by hasPermission | M |
| 25+ admin route files | Add `hasPermission()` to every protected route | L |
| `frontend/src/lib/api/endpoints/admin.ts` | Add mod API functions | S |
| `docs/milestones.md` | Add mod system section | S |

---

## 8. Implementation Order

1. Backend: AdminUser model changes + PermissionPreset model
2. Backend: permissionGuard middleware
3. Backend: Mod CRUD endpoints + seed presets
4. Backend: Apply hasPermission to ALL existing admin routes (batch operation)
5. Backend: Extend adminAuthMiddleware
6. Frontend: usePermission hook
7. Frontend: API client updates
8. Frontend: Sidebar guard (hide unauthorized links)
9. Frontend: CreateMod + EditMod modals
10. Frontend: /admin/settings/mods page
11. Frontend: Guard UI buttons across all admin pages
12. Tests: permissionGuard + mod endpoints + hook
13. Documentation

---

## 9. Edge Cases

| Case | Handling |
|---|---|
| **Super admin disables themselves** | Prevented. Super admin cannot disable or delete their own account. |
| **Mod permissions changed while logged in** | Token refresh (already auto-refreshes) picks up new permissions. Maximum 1hr stale. |
| **Mod tries to access URL directly** | `hasPermission` middleware returns 403. No UI bypass. |
| **Preset deleted but mod has those permissions** | No effect. Permissions are copied to mod at creation time, not linked to preset. |
| **New permission added to catalog later** | Existing mods don't get it automatically. Super admin must manually grant it. |
| **Multiple super admins** | Not allowed. Setup enforces single super_admin. Only one document with `role: 'super_admin'` can exist. |
