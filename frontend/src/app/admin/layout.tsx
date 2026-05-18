'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAdminStore } from '@/stores/admin';
import { usePermission } from '@/hooks/usePermission';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { loading, initialized, authenticated, checkSession } = useAdminStore();
  const perm = usePermission;

  useEffect(() => { checkSession(); }, [checkSession]);
  useEffect(() => { if (initialized && !authenticated && pathname !== '/admin/login' && pathname !== '/admin/setup') router.push('/admin/login'); }, [initialized, authenticated, router, pathname]);

  if (loading || !initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-6 h-6 border-2 border-white/20 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated && pathname !== '/admin/login' && pathname !== '/admin/setup') {
    return null;
  }

  if (pathname === '/admin/login' || pathname === '/admin/setup') {
    return <>{children}</>;
  }

  const linkClass = (active: boolean) =>
    `block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
      active ? 'bg-white/10 text-white font-medium' : 'text-white/50 hover:text-white hover:bg-white/5'
    }`;

  const nav = (href: string, label: string) => (
    <button
      onClick={() => router.push(href)}
      className={linkClass(pathname === href || (href !== '/admin' && pathname.startsWith(href + '/')) || (href === '/admin/posts/pending' && pathname.startsWith('/admin/posts/pending')))}
    >
      {label}
    </button>
  );

  const canMods = perm('mods:manage').allowed;

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Sidebar */}
      <div className="w-[220px] min-h-screen border-r border-white/10 bg-zinc-950/80 backdrop-blur-sm flex-shrink-0 flex flex-col">
        <div className="px-4 py-5 border-b border-white/10">
          <div className="text-white font-bold text-base tracking-tight">
            YoTop10 <span className="text-zinc-500 font-normal">Admin</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {nav('/admin', 'Dashboard')}

          {perm('posts:read').allowed && nav('/admin/posts/pending', 'Pending Posts')}
          {perm('posts:read').allowed && nav('/admin/posts', 'All Posts')}
          {perm('comments:read').allowed && nav('/admin/comments', 'Comments')}
          {perm('users:read').allowed && nav('/admin/users', 'Users')}
          {perm('categories:read').allowed && nav('/admin/categories', 'Categories')}
          {perm('statistics:read').allowed && nav('/admin/statistics', 'Statistics')}
          {perm('alerts:read').allowed && nav('/admin/alerts', 'Alerts')}
          {perm('notifications:read').allowed && nav('/admin/notifications', 'Notifications')}
          {perm('search:read').allowed && nav('/admin/search', 'Search')}
          {perm('hof:read').allowed && nav('/admin/hall-of-fame', 'Hall of Fame')}
          {perm('audit:read').allowed && nav('/admin/audit', 'Audit Logs')}
          {canMods && nav('/admin/settings/mods', 'Moderators')}
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
      <div className="flex-1 min-w-0 p-6 overflow-auto">
        {children}
      </div>
    </div>
  );
}
