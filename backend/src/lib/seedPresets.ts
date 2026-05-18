import { PermissionPreset } from '../models/PermissionPreset';

export async function seedPresets() {
  const count = await PermissionPreset.countDocuments();
  if (count > 0) return;

  await PermissionPreset.insertMany([
    {
      name: 'Read-Only Auditor',
      description: 'View analytics, dashboard, and audit logs',
      permissions: ['dashboard:read', 'statistics:read', 'audit:read'],
    },
    {
      name: 'Content Moderator',
      description: 'Approve posts and moderate comments',
      permissions: [
        'dashboard:read',
        'posts:read',
        'posts:approve',
        'comments:read',
        'comments:moderate',
        'comments:penalty',
        'categories:read',
        'hof:read',
        'statistics:read',
        'audit:read',
        'notifications:read',
      ],
    },
    {
      name: 'Full Moderator',
      description: 'Full content management without user/config access',
      permissions: [
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
        'categories:read',
        'categories:edit',
        'categories:bulk',
        'hof:read',
        'hof:manage',
        'alerts:read',
        'audit:read',
        'audit:export',
        'search:read',
        'notifications:read',
        'notifications:send',
      ],
    },
    {
      name: 'Community Manager',
      description: 'Manage users, notifications, and Hall of Fame',
      permissions: [
        'dashboard:read',
        'users:read',
        'users:restrict',
        'users:trust',
        'hof:read',
        'hof:manage',
        'notifications:read',
        'notifications:send',
        'audit:read',
        'statistics:read',
      ],
    },
  ]);

  console.log('Seeded 4 permission presets');
}
