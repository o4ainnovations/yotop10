'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icons/Icon';

const TABS: Array<{
  icon: 'House' | 'Folder' | 'Plus';
  label: string;
  href: string;
  gradient?: boolean;
}> = [
  { icon: 'House', label: 'Home', href: '/' },
  { icon: 'Folder', label: 'Categories', href: '/categories' },
  { icon: 'Plus', label: 'Submit', href: '/submit', gradient: true },
];

export function FloatingDock() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-0.5 rounded-2xl border border-white/10 bg-zinc-900/70 px-1.5 py-1.5 backdrop-blur-xl">
        {TABS.map((tab) => {
          const isActive =
            tab.href === '/'
              ? pathname === '/'
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                tab.gradient
                  ? 'flex items-center gap-2 rounded-xl px-3 py-2 transition bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold'
                  : `flex items-center gap-2 rounded-xl px-3 py-2 transition ${
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                    }`
              }
            >
              <Icon name={tab.icon} size={16} />
              {tab.gradient && (
                <span className="hidden sm:inline text-xs font-bold">
                  {tab.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
