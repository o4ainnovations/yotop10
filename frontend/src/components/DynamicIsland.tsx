'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { Icon } from './icons/Icon';
import { CommandSearch } from './CommandSearch';

export function DynamicIsland() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { apiFetch } = await import('@/lib/api/client');
        const data = await apiFetch<{ count: number }>('/users/me/notifications/unread-count');
        setUnreadCount(data.count || 0);
      } catch { /* ignore */ }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  if (pathname.startsWith('/admin')) return null;

  const username = user?.username || null;

  const tabs = [
    { icon: 'House' as const, label: 'Home', href: '/', isActive: pathname === '/' },
    { icon: 'Search' as const, label: 'Search', action: () => setSearchOpen(true) },
    { icon: 'MessageCircle' as const, label: 'Arguments', href: '/arguments', isActive: pathname.startsWith('/arguments') },
    { icon: 'User' as const, label: 'Profile', href: username ? `/a/${username.replace(/^a_/, '')}` : '/a', isActive: pathname.startsWith('/a/') || pathname === '/a' },
  ];

  const isNotifsActive = pathname.startsWith('/notifications');

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 hide-desktop items-center justify-around px-4 h-[90px] bg-[var(--color-bg)] border-t border-white/10"
      >
        {tabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => (tab.action ? tab.action() : router.push(tab.href!))}
            className={`transition ${
              tab.isActive ? 'text-orange-400' : 'text-white'
            }`}
            aria-label={tab.label}
          >
            <Icon name={tab.icon} size={24} />
          </button>
        ))}

        {/* Bell tab with unread badge */}
        <button
          onClick={() => router.push('/notifications')}
          className={`relative transition ${isNotifsActive ? 'text-orange-400' : 'text-white'}`}
          aria-label="Notifications"
        >
          <Icon name="Bell" size={24} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1.5 bg-red-500 text-white rounded-full w-[18px] h-[18px] text-3xs font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </nav>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
