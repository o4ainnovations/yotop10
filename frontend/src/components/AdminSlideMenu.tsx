'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSlideMenu } from '@/stores/slideMenu';
import { useAdminStore } from '@/stores/admin';
import { usePermission } from '@/hooks/usePermission';
import { Icon } from './icons/Icon';
import { ThemeToggle } from './ThemeToggle';

export function AdminSlideMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const open = useSlideMenu((s) => s.open);
  const setOpen = useSlideMenu((s) => s.setOpen);
  const admin = useAdminStore((s) => s.admin);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const showPosts = usePermission('posts:read').allowed;
  const showComments = usePermission('comments:read').allowed;
  const showUsers = usePermission('users:read').allowed;
  const showCategories = usePermission('categories:read').allowed;
  const showStats = usePermission('statistics:read').allowed;
  const showAlerts = usePermission('alerts:read').allowed;
  const showNotifications = usePermission('notifications:read').allowed;
  const showSearch = usePermission('search:read').allowed;
  const showHof = usePermission('hof:read').allowed;
  const showAudit = usePermission('audit:read').allowed;
  const showMods = usePermission('mods:manage').allowed;

  const adminUsername = admin?.username || 'Admin';
  const adminInitial = adminUsername[0].toUpperCase();

  const navItems: { icon: string; label: string; href: string; show: boolean }[] = [
    { icon: 'LayoutDashboard', label: 'Dashboard', href: '/admin', show: true },
    { icon: 'Clock', label: 'Pending Posts', href: '/admin/posts/pending', show: showPosts },
    { icon: 'FileText', label: 'All Posts', href: '/admin/posts', show: showPosts },
    { icon: 'MessageSquare', label: 'Comments', href: '/admin/comments', show: showComments },
    { icon: 'Users', label: 'Users', href: '/admin/users', show: showUsers },
    { icon: 'Folder', label: 'Categories', href: '/admin/categories', show: showCategories },
    { icon: 'BarChart3', label: 'Statistics', href: '/admin/statistics', show: showStats },
    { icon: 'AlertTriangle', label: 'Alerts', href: '/admin/alerts', show: showAlerts },
    { icon: 'Bell', label: 'Notifications', href: '/admin/notifications', show: showNotifications },
    { icon: 'Search', label: 'Search', href: '/admin/search', show: showSearch },
    { icon: 'Trophy', label: 'Hall of Fame', href: '/admin/hall-of-fame', show: showHof },
    { icon: 'ScrollText', label: 'Audit Logs', href: '/admin/audit', show: showAudit },
    { icon: 'Shield', label: 'Moderators', href: '/admin/settings/mods', show: showMods },
  ];

  const handleLogout = async () => {
    const { API } = await import('@/lib/api');
    await API.adminLogout();
    setOpen(false);
    router.push('/admin/login');
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 right-0 z-[70] h-full w-80 bg-zinc-950 border-l border-white/10 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 pt-10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold text-lg shrink-0">
              {adminInitial}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-white truncate">{adminUsername}</span>
              </div>
              <p className="text-sm2 text-orange-400 font-medium">Admin</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
            aria-label="Close menu"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <hr className="border-white/10 mx-6" />

        <nav className="flex-1 px-3 pt-6 pb-2 overflow-y-auto flex flex-col gap-1">
          {navItems.map((item) => {
            if (!item.show) return null;
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href + '/'));
            return (
              <button
                key={item.label}
                onClick={() => {
                  router.push(item.href);
                  setOpen(false);
                }}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition text-base2 text-left ${
                  isActive
                    ? 'text-white bg-white/10 font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon name={item.icon as 'LayoutDashboard'} size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="px-6 py-3 mb-6">
            <ThemeToggle />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-6 py-3.5 text-base2 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition border-t border-white/10"
          >
            <Icon name="LogOut" size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}
