'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { Icon } from './icons/Icon';
import { CommandSearch } from './CommandSearch';

export function DynamicIsland() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  if (pathname.startsWith('/admin')) return null;

  const username = user?.username || null;

  const tabs = [
    { icon: 'House' as const, label: 'Home', href: '/' },
    { icon: 'Search' as const, label: 'Search', action: () => setSearchOpen(true) },
    { icon: 'MessageCircle' as const, label: 'Arguments', href: '/arguments' },
    { icon: 'Bell' as const, label: 'Notifications', href: '/notifications' },
    { icon: 'User' as const, label: 'Profile', href: username ? `/a/${username.replace(/^a_/, '')}` : '/a' },
  ];

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 hide-desktop items-center justify-around px-4 h-[90px] bg-[var(--color-bg)] border-t border-white/10"
      >
        {tabs.map((tab) => {
          const isActive = tab.href
            ? tab.href === '/'
              ? pathname === '/'
              : pathname.startsWith(tab.href)
            : false;

          return (
            <button
              key={tab.label}
              onClick={() => (tab.action ? tab.action() : router.push(tab.href!))}
              className={`transition ${
                isActive ? 'text-orange-400' : 'text-white'
              }`}
              aria-label={tab.label}
            >
              <Icon name={tab.icon} size={24} />
            </button>
          );
        })}
      </nav>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
