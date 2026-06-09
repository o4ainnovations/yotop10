'use client';

import { usePathname, useRouter } from 'next/navigation';

interface AdminData {
  id: string;
  username: string;
  role: string;
  permissions: string[];
}

export default function AdminClientShell({
  admin,
  children,
}: {
  admin: AdminData;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const linkClass = (active: boolean) =>
    `block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
      active ? 'bg-white/10 text-white font-medium' : 'text-white/50 hover:text-white hover:bg-white/5'
    }`;

  const nav = (href: string, label: string) => (
    <button
      onClick={() => router.push(href)}
      className={linkClass(
        pathname === href ||
          (href !== '/admin' && pathname.startsWith(href + '/')) ||
          (href === '/admin/posts/pending' && pathname.startsWith('/admin/posts/pending'))
      )}
    >
      {label}
    </button>
  );

  const hasPermission = (perm: string) =>
    admin.role === 'super_admin' || admin.permissions.includes(perm);

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Sidebar */}
      <div className="hidden lg:flex w-[220px] min-h-screen border-r border-white/10 bg-zinc-950/80 backdrop-blur-sm flex-shrink-0 flex flex-col">
        <div className="px-4 py-5 border-b border-white/10">
          <div className="text-white font-bold text-base tracking-tight">
            YoTop10 <span className="text-zinc-500 font-normal">Admin</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {nav('/admin', 'Dashboard')}

          {hasPermission('posts:read') && nav('/admin/posts/pending', 'Pending Posts')}
          {hasPermission('posts:read') && nav('/admin/posts', 'All Posts')}
          {hasPermission('comments:read') && nav('/admin/comments', 'Comments')}
          {hasPermission('users:read') && nav('/admin/users', 'Users')}
          {hasPermission('categories:read') && nav('/admin/categories', 'Categories')}
          {hasPermission('statistics:read') && nav('/admin/statistics', 'Statistics')}
          {hasPermission('alerts:read') && nav('/admin/alerts', 'Alerts')}
          {hasPermission('notifications:read') && nav('/admin/notifications', 'Notifications')}
          {hasPermission('search:read') && nav('/admin/search', 'Search')}
          {hasPermission('hof:read') && nav('/admin/hall-of-fame', 'Hall of Fame')}
          {hasPermission('audit:read') && nav('/admin/audit', 'Audit Logs')}
          {hasPermission('mods:manage') && nav('/admin/settings/mods', 'Moderators')}
          {admin.role === 'super_admin' && nav('/admin/settings/rate-limits', 'Rate Limits')}
        </nav>

        <div className="px-3 py-3 border-t border-white/10 space-y-1">
          {nav('/admin/profile', 'Profile')}
          <button
            onClick={async () => {
              const { API } = await import('@/lib/api');
              await API.adminLogout();
              router.push('/admin/login');
            }}
            className="block w-full text-left px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 overflow-auto">{children}</div>
    </div>
  );
}
