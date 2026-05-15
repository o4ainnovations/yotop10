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
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-5 rounded-full px-8 py-4 bg-white/[0.03] backdrop-blur-xl border border-white/10 transition-opacity duration-400 ${
          scrolled ? 'opacity-50' : 'opacity-100'
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
              <Icon name={tab.icon} size={22} />
            </button>
          );
        })}
      </nav>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
