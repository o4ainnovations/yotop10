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
    { icon: 'Search' as const, label: 'Search', action: () => setSearchOpen(true) },
    { icon: 'Plus' as const, label: 'Submit', href: '/submit' },
    { icon: 'Folder' as const, label: 'Categories', href: '/categories' },
  ];

  return (
    <>
      <nav
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-5 rounded-full px-6 py-3 glass-obsidian ${
          scrolled ? 'dynamic-island-scrolled' : 'dynamic-island'
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
                isActive ? 'text-orange-500' : 'text-zinc-400 hover:text-orange-400'
              }`}
              aria-label={tab.label}
            >
              <Icon name={tab.icon} size={19} />
            </button>
          );
        })}
      </nav>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
