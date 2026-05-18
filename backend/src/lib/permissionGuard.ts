/* eslint-disable @typescript-eslint/no-explicit-any */
import { ROUTE_PERMISSIONS, DEFAULT_PERMISSION } from './permissionMap';

export function autoPermissionGuard(req: any, res: any, next: any) {
  const admin = req.admin;
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });
  if (admin.role === 'super_admin') return next();

  const method = req.method.toUpperCase();
  const path = req.route?.path || req.path;
  const routeKey = `${method} ${path}`;
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

export const PERMISSION_CATALOG = [
  'dashboard:read',
  'statistics:read',
  'posts:read',
  'posts:approve',
  'posts:edit',
  'posts:delete',
  'posts:manage',
  'comments:read',
  'comments:moderate',
  'comments:penalty',
  'comments:delete',
  'users:read',
  'users:restrict',
  'users:trust',
  'categories:read',
  'categories:edit',
  'categories:bulk',
  'hof:read',
  'hof:manage',
  'alerts:read',
  'alerts:manage',
  'audit:read',
  'audit:export',
  'search:read',
  'search:manage',
  'notifications:read',
  'notifications:send',
  'config:read',
  'config:write',
  'mods:manage',
  'profile:read',
] as const;

type Permission = (typeof PERMISSION_CATALOG)[number];

export function isValidPermission(perm: string): perm is Permission {
  return (PERMISSION_CATALOG as readonly string[]).includes(perm);
}
