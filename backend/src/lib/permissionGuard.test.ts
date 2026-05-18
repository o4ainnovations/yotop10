import { describe, it, expect, vi } from 'vitest';
import { autoPermissionGuard, PERMISSION_CATALOG, isValidPermission } from './permissionGuard';
import { ROUTE_PERMISSIONS, DEFAULT_PERMISSION } from './permissionMap';

function makeReqRes(overrides?: {
  method?: string;
  path?: string;
  routePath?: string;
  admin?: Record<string, unknown> | null;
}) {
  const req = {
    method: overrides?.method ?? 'GET',
    path: overrides?.path ?? '/posts',
    route: { path: overrides?.routePath ?? '/posts' },
    admin: overrides?.admin,
  };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

function superAdminReq() {
  return makeReqRes({
    admin: {
      id: 'admin-1',
      username: 'super',
      role: 'super_admin',
      permissions: [],
    },
  });
}

function modReq(opts?: {
  permissions?: string[];
  method?: string;
  path?: string;
  routePath?: string;
}) {
  return makeReqRes({
    method: opts?.method ?? 'GET',
    path: opts?.path ?? '/posts',
    routePath: opts?.routePath ?? '/posts',
    admin: {
      id: 'mod-abc',
      username: 'mod_test',
      role: 'mod',
      permissions: opts?.permissions ?? ['posts:read', 'posts:approve'],
    },
  });
}

describe('permissionGuard', () => {
  // 1. Super admin always passes
  it('super admin always passes', () => {
    const { req, res, next } = superAdminReq();
    autoPermissionGuard(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  // 2. Mod with correct permission passes
  it('mod with correct permission passes', () => {
    const { req, res, next } = modReq({
      permissions: ['posts:read'],
      method: 'GET',
      path: '/posts',
      routePath: '/posts',
    });
    autoPermissionGuard(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  // 3. Mod without required permission gets 403
  it('mod without required permission gets 403', () => {
    const { req, res, next } = modReq({
      permissions: ['comments:read'],
      method: 'POST',
      path: '/posts/:id/approve',
      routePath: '/posts/:id/approve',
    });
    autoPermissionGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  // 4. Mod with different category permission gets 403
  it('mod with different category permission gets 403', () => {
    const { req, res, next } = modReq({
      permissions: ['users:read', 'users:restrict'],
      method: 'POST',
      path: '/posts/:id/approve',
      routePath: '/posts/:id/approve',
    });
    autoPermissionGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // 5. Unauthenticated gets 401
  it('unauthenticated gets 401', () => {
    const { req, res, next } = makeReqRes({ admin: null });
    autoPermissionGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // 6. Inactive mod (admin missing) gets 401
  it('mod without admin field gets 401', () => {
    const { req, res, next } = makeReqRes({ admin: undefined });
    autoPermissionGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // 7. Route not in map → DEFAULT_PERMISSION → mod gets 403
  it('route not in map uses DEFAULT_PERMISSION and mod gets 403', () => {
    const { req, res, next } = modReq({
      permissions: ['posts:read'],
      method: 'GET',
      path: '/unknown-route',
      routePath: '/unknown-route',
    });
    autoPermissionGuard(req, res, next);
    expect(DEFAULT_PERMISSION).toBe('__super_admin_only__');
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // 8. Route in map checks correct permission
  it('route in map checks correct permission', () => {
    expect(ROUTE_PERMISSIONS['PATCH /posts/:id/approve']).toBe('posts:approve');

    const { req, res, next } = modReq({
      permissions: ['posts:approve'],
      method: 'PATCH',
      path: '/posts/:id/approve',
      routePath: '/posts/:id/approve',
    });
    autoPermissionGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // 9. Mod with mods:manage passes mod routes
  it('mod with correct mods permission succeeds', () => {
    const { req, res, next } = modReq({
      permissions: ['mods:manage'],
      method: 'GET',
      path: '/mods',
      routePath: '/mods',
    });
    autoPermissionGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // 10. Mod without mods:manage on mod route gets 403
  it('mod without mods permission on mod route gets 403', () => {
    const { req, res, next } = modReq({
      permissions: ['posts:read'],
      method: 'GET',
      path: '/mods',
      routePath: '/mods',
    });
    autoPermissionGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // 11. Empty permissions array handled correctly
  it('empty permissions array — no access to any route', () => {
    const { req, res, next } = modReq({
      permissions: [],
      method: 'GET',
      path: '/posts',
      routePath: '/posts',
    });
    autoPermissionGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // 12. Case sensitivity preserved (passes if permissions match exactly)
  it('permission names match exactly (no case coercion)', () => {
    const { req, res, next } = modReq({
      permissions: ['POSTS:READ'],
      method: 'GET',
      path: '/posts',
      routePath: '/posts',
    });
    autoPermissionGuard(req, res, next);
    // ROUTE_PERMISSIONS maps to 'posts:read' which !== 'POSTS:READ'
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // 13. Multiple permissions — any one matching is enough
  it('multiple permissions — any one matching is enough', () => {
    const { req, res, next } = modReq({
      permissions: ['comments:read', 'posts:approve', 'users:read'],
      method: 'PATCH',
      path: '/posts/:id/approve',
      routePath: '/posts/:id/approve',
    });
    autoPermissionGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // 14. Mod with exactly the required permission passes
  it('mod with exact required permission passes for route', () => {
    expect(ROUTE_PERMISSIONS['POST /posts/bulk/delete']).toBe('posts:delete');

    const { req, res, next } = modReq({
      permissions: ['posts:delete'],
      method: 'POST',
      path: '/posts/bulk/delete',
      routePath: '/posts/bulk/delete',
    });
    autoPermissionGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // 15. Mod with partial matching permission does NOT pass
  it('mod with category:read does not pass for category:edit route', () => {
    const { req, res, next } = modReq({
      permissions: ['config:read'],
      method: 'PUT',
      path: '/config',
      routePath: '/config',
    });
    autoPermissionGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // 16. Alerts routes check permissions correctly
  it('alerts read and manage permissions respected', () => {
    // Read passes with alerts:read
    const readReq = modReq({
      permissions: ['alerts:read'],
      method: 'GET',
      path: '/alerts/thresholds',
      routePath: '/alerts/thresholds',
    });
    const { res: res1, next: next1 } = readReq;
    autoPermissionGuard(readReq.req, res1, next1);
    expect(next1).toHaveBeenCalled();

    // Manage fails with only read
    const writeReq = modReq({
      permissions: ['alerts:read'],
      method: 'POST',
      path: '/alerts/thresholds',
      routePath: '/alerts/thresholds',
    });
    const { res: res2, next: next2 } = writeReq;
    autoPermissionGuard(writeReq.req, res2, next2);
    expect(res2.status).toHaveBeenCalledWith(403);
  });

  // 17. Hall of Fame routes
  it('hall of fame read and manage permissions respected', () => {
    const { req, res, next } = modReq({
      permissions: ['hof:read', 'hof:manage'],
      method: 'POST',
      path: '/hall-of-fame',
      routePath: '/hall-of-fame',
    });
    autoPermissionGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // 18. Users routes
  it('user restrict requires users:restrict permission', () => {
    const { req, res, next } = modReq({
      permissions: ['users:read'],
      method: 'PATCH',
      path: '/users/:user_id/restrict',
      routePath: '/users/:user_id/restrict',
    });
    autoPermissionGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // 19. Audit routes
  it('audit export requires audit:export permission', () => {
    const { req, res, next } = modReq({
      permissions: ['audit:read'],
      method: 'GET',
      path: '/audit-logs/export',
      routePath: '/audit-logs/export',
    });
    autoPermissionGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // 20. Mod with null admin permissions array
  it('mod with missing permissions array (undefined) handles gracefully', () => {
    const req = {
      method: 'GET',
      path: '/posts',
      route: { path: '/posts' },
      admin: {
        id: 'mod-null',
        username: 'nullperm',
        role: 'mod',
        permissions: undefined,
      },
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();
    autoPermissionGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('PERMISSION_CATALOG', () => {
  it('contains all expected permission categories', () => {
    const categories = new Set(PERMISSION_CATALOG.map((p) => p.split(':')[0]));
    expect(categories.has('dashboard')).toBe(true);
    expect(categories.has('statistics')).toBe(true);
    expect(categories.has('posts')).toBe(true);
    expect(categories.has('comments')).toBe(true);
    expect(categories.has('users')).toBe(true);
    expect(categories.has('categories')).toBe(true);
    expect(categories.has('hof')).toBe(true);
    expect(categories.has('alerts')).toBe(true);
    expect(categories.has('audit')).toBe(true);
    expect(categories.has('search')).toBe(true);
    expect(categories.has('notifications')).toBe(true);
    expect(categories.has('config')).toBe(true);
    expect(categories.has('mods')).toBe(true);
    expect(categories.has('profile')).toBe(true);
  });

  it('isValidPermission validates known permissions', () => {
    expect(isValidPermission('posts:read')).toBe(true);
    expect(isValidPermission('comments:moderate')).toBe(true);
    expect(isValidPermission('users:trust')).toBe(true);
    expect(isValidPermission('config:write')).toBe(true);
    expect(isValidPermission('mods:manage')).toBe(true);
  });

  it('isValidPermission rejects unknown permissions', () => {
    expect(isValidPermission('posts:unknown')).toBe(false);
    expect(isValidPermission('')).toBe(false);
    expect(isValidPermission('unknown:read')).toBe(false);
    expect(isValidPermission('posts:read:extra')).toBe(false);
  });
});

describe('CI: every admin route has a permission mapping', () => {
  it('all routes registered in the admin router are covered by ROUTE_PERMISSIONS', async () => {
    const { Router } = await import('express');
    const adminRouter = Router();

    const routes: Array<{ method: string; path: string }> = [
      // Dashboard & me
      { method: 'GET', path: '/me' },
      // Stats
      { method: 'GET', path: '/stats/overview' },
      { method: 'GET', path: '/stats/health' },
      { method: 'GET', path: '/stats/content' },
      { method: 'GET', path: '/stats/community' },
      { method: 'GET', path: '/stats/moderation' },
      { method: 'GET', path: '/stats/categories' },
      { method: 'GET', path: '/stats/trends' },
      { method: 'GET', path: '/stats/quality' },
      { method: 'GET', path: '/stats/traffic' },
      { method: 'GET', path: '/stats/traffic/lurkers' },
      { method: 'GET', path: '/stats/traffic/conversion' },
      { method: 'GET', path: '/stats/users/reengagement' },
      { method: 'GET', path: '/stats/submissions' },
      { method: 'GET', path: '/stats/users/lifecycle' },
      { method: 'GET', path: '/stats/alerts' },
      { method: 'GET', path: '/stats/compare' },
      { method: 'GET', path: '/stats/notifications' },
      { method: 'GET', path: '/stats/search/overview' },
      { method: 'GET', path: '/stats/search/queries' },
      { method: 'GET', path: '/stats/search/relevance' },
      { method: 'GET', path: '/stats/search/trends' },
      { method: 'GET', path: '/stats/search/infrastructure' },
      { method: 'GET', path: '/stats/search/behavior' },
      { method: 'GET', path: '/stats/search/trending' },
      { method: 'GET', path: '/stats/search/popular' },
      { method: 'GET', path: '/stats/search/engaged' },
      // Posts
      { method: 'GET', path: '/posts/pending' },
      { method: 'GET', path: '/posts/pending/:id' },
      { method: 'PATCH', path: '/posts/:id/approve' },
      { method: 'PATCH', path: '/posts/:id/reject' },
      { method: 'POST', path: '/posts/:id/retry' },
      { method: 'POST', path: '/posts/bulk/approve' },
      { method: 'POST', path: '/posts/bulk/reject' },
      { method: 'GET', path: '/posts' },
      { method: 'GET', path: '/posts/stats' },
      { method: 'PATCH', path: '/posts/:id' },
      { method: 'DELETE', path: '/posts/:id' },
      { method: 'POST', path: '/posts/:id/restore' },
      { method: 'DELETE', path: '/posts/:id/permanent' },
      { method: 'POST', path: '/posts/:id/feature' },
      { method: 'POST', path: '/posts/:id/unfeature' },
      { method: 'POST', path: '/posts/:id/lock' },
      { method: 'POST', path: '/posts/:id/unlock' },
      { method: 'POST', path: '/posts/:id/bump' },
      { method: 'POST', path: '/posts/bulk/status' },
      { method: 'POST', path: '/posts/bulk/delete' },
      { method: 'POST', path: '/posts/bulk/change-category' },
      { method: 'POST', path: '/posts/:id/duplicate' },
      { method: 'PATCH', path: '/posts/:id/items/:itemId' },
      { method: 'POST', path: '/posts/:id/items' },
      { method: 'DELETE', path: '/posts/:id/items/:itemId' },
      { method: 'GET', path: '/posts/:id/activity' },
      { method: 'GET', path: '/posts/:id/revisions' },
      { method: 'GET', path: '/posts/compare' },
      { method: 'GET', path: '/posts/:id/comments' },
      { method: 'POST', path: '/posts/quality-check' },
      { method: 'GET', path: '/posts/export' },
      // Comments
      { method: 'GET', path: '/comments' },
      { method: 'PATCH', path: '/comments/:id' },
      { method: 'DELETE', path: '/comments/:id' },
      { method: 'POST', path: '/comments/:id/restore' },
      { method: 'DELETE', path: '/comments/:id/permanent' },
      { method: 'POST', path: '/comments/:id/hide' },
      { method: 'POST', path: '/comments/:id/unhide' },
      { method: 'POST', path: '/comments/:id/highlight' },
      { method: 'POST', path: '/comments/:id/unhighlight' },
      { method: 'POST', path: '/comments/bulk/delete' },
      { method: 'POST', path: '/comments/bulk/hide' },
      { method: 'POST', path: '/comments/:id/flag' },
      { method: 'POST', path: '/comments/bulk/flag' },
      { method: 'POST', path: '/comments/bulk/unflag' },
      { method: 'POST', path: '/comments/:id/dismiss-flag' },
      { method: 'POST', path: '/comments/:id/apply-penalty' },
      { method: 'GET', path: '/comments/stats' },
      { method: 'GET', path: '/comments/export' },
      { method: 'GET', path: '/comments/:id/activity' },
      // Users
      { method: 'GET', path: '/users' },
      { method: 'GET', path: '/users/:user_id' },
      { method: 'PATCH', path: '/users/:user_id/restrict' },
      { method: 'PATCH', path: '/users/:user_id/rate-limits' },
      { method: 'PATCH', path: '/users/:user_id/trust' },
      { method: 'GET', path: '/users/:user_id/trust-history' },
      // Categories
      { method: 'GET', path: '/categories/stats' },
      { method: 'GET', path: '/categories/health' },
      { method: 'GET', path: '/categories/analytics' },
      { method: 'GET', path: '/categories/export' },
      { method: 'GET', path: '/categories/orphans' },
      { method: 'GET', path: '/categories/check-duplicate' },
      { method: 'GET', path: '/categories/:id/audit' },
      { method: 'POST', path: '/categories' },
      { method: 'PATCH', path: '/categories/:id' },
      { method: 'DELETE', path: '/categories/:id' },
      { method: 'POST', path: '/categories/:id/duplicate' },
      { method: 'POST', path: '/categories/:id/publish' },
      { method: 'POST', path: '/categories/:id/hide' },
      { method: 'POST', path: '/categories/bulk/feature' },
      { method: 'POST', path: '/categories/bulk/archive' },
      { method: 'POST', path: '/categories/bulk/merge' },
      { method: 'POST', path: '/categories/bulk/reparent' },
      { method: 'POST', path: '/categories/import' },
      // Hall of Fame
      { method: 'GET', path: '/hall-of-fame' },
      { method: 'POST', path: '/hall-of-fame' },
      { method: 'DELETE', path: '/hall-of-fame/:id' },
      { method: 'PATCH', path: '/hall-of-fame/reorder' },
      { method: 'PATCH', path: '/hall-of-fame/:id' },
      { method: 'GET', path: '/hall-of-fame/candidates' },
      // Alerts
      { method: 'GET', path: '/alerts/thresholds' },
      { method: 'POST', path: '/alerts/thresholds' },
      { method: 'PATCH', path: '/alerts/thresholds/:id' },
      { method: 'DELETE', path: '/alerts/thresholds/:id' },
      { method: 'PATCH', path: '/alerts/thresholds/:id/toggle' },
      { method: 'GET', path: '/alerts/notifications' },
      { method: 'GET', path: '/alerts/notifications/count' },
      { method: 'GET', path: '/alerts/notifications/:id' },
      { method: 'PATCH', path: '/alerts/notifications/:id/read' },
      { method: 'PATCH', path: '/alerts/notifications/read-all' },
      { method: 'DELETE', path: '/alerts/notifications/:id' },
      { method: 'PATCH', path: '/alerts/notifications/:id/settle' },
      { method: 'PATCH', path: '/alerts/notifications/settle-all' },
      { method: 'GET', path: '/alerts/history' },
      // Audit
      { method: 'GET', path: '/audit-logs' },
      { method: 'GET', path: '/audit-logs/stats' },
      { method: 'GET', path: '/audit-logs/export' },
      // Search
      { method: 'GET', path: '/search/status' },
      { method: 'POST', path: '/search/reindex' },
      { method: 'DELETE', path: '/search/index' },
      { method: 'GET', path: '/search/mappings' },
      { method: 'GET', path: '/search/preview' },
      // Notifications / Messages
      { method: 'GET', path: '/messages' },
      { method: 'POST', path: '/messages' },
      { method: 'DELETE', path: '/messages/:id' },
      { method: 'GET', path: '/messages/:id/stats' },
      { method: 'POST', path: '/messages/templates' },
      { method: 'GET', path: '/messages/templates' },
      { method: 'DELETE', path: '/messages/templates/:id' },
      // Config
      { method: 'GET', path: '/config' },
      { method: 'PUT', path: '/config' },
      { method: 'GET', path: '/config/impact' },
      { method: 'GET', path: '/config/versions' },
      // Mods
      { method: 'POST', path: '/mods' },
      { method: 'GET', path: '/mods' },
      { method: 'GET', path: '/mods/:id' },
      { method: 'PATCH', path: '/mods/:id' },
      { method: 'DELETE', path: '/mods/:id' },
      { method: 'POST', path: '/mods/:id/reset-password' },
      { method: 'GET', path: '/mods/permissions' },
      { method: 'GET', path: '/mods/presets' },
    ];

    for (const r of routes) {
      const handler = vi.fn();
      switch (r.method) {
        case 'GET': adminRouter.get(r.path, handler); break;
        case 'POST': adminRouter.post(r.path, handler); break;
        case 'PUT': adminRouter.put(r.path, handler); break;
        case 'PATCH': adminRouter.patch(r.path, handler); break;
        case 'DELETE': adminRouter.delete(r.path, handler); break;
      }
    }

    const stack = (adminRouter as unknown as {
      stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }>;
    }).stack || [];
    const routeKeys: string[] = [];
    for (const layer of stack) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).filter(
          (m: string) => layer.route!.methods[m],
        );
        for (const method of methods) {
          routeKeys.push(`${method.toUpperCase()} ${layer.route.path}`);
        }
      }
    }

    const publicPaths = ['POST /login', 'POST /setup', 'GET /setup/validate', 'POST /logout'];
    const guardedRoutes = routeKeys.filter((r) => !publicPaths.includes(r));
    const unguarded = guardedRoutes.filter(
      (r) => !(r in ROUTE_PERMISSIONS),
    );

    expect(unguarded).toEqual([]);
  });
});

describe('DEFAULT_PERMISSION', () => {
  it('DEFAULT_PERMISSION is __super_admin_only__', () => {
    expect(DEFAULT_PERMISSION).toBe('__super_admin_only__');
  });
});
