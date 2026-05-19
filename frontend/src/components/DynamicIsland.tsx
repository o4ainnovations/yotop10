'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from './icons/Icon';
import { CommandSearch } from './CommandSearch';

export function DynamicIsland() {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (pathname.startsWith('/admin')) return null;

  const tabs = [
    { icon: 'House' as const, label: 'Home', href: '/' },
    { icon: 'Search' as const, label: 'Search', action: () => setSearchOpen(true) },
    { icon: 'MessageCircle' as const, label: 'Arguments', href: '/arguments' },
    { icon: 'Bell' as const, label: 'Notifications', href: '/notifications' },
    { icon: 'User' as const, label: 'Profile', href: '/a' },
  ];

  return (
    <>
      <nav
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 rounded-full px-7 py-4 bg-[var(--color-bg)] border border-white/10 shadow-lg transition-opacity duration-400 lg:hidden ${
          scrolled ? 'opacity-60' : 'opacity-100'
        }`}
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
