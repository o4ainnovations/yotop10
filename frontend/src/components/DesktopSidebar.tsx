'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { Icon } from './icons/Icon';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
  { icon: 'Flame' as const, label: 'Home', href: '/' },
  { icon: 'Search' as const, label: 'Explore', href: '/explore' },
  { icon: 'Folder' as const, label: 'Categories', href: '/categories' },
  { icon: 'MessageCircle' as const, label: 'Arguments', href: '/arguments' },
  { icon: 'Bookmark' as const, label: 'Saved', href: '/saved' },
  { icon: 'FileText' as const, label: 'Articles', href: '/articles' },
  { icon: 'Crown' as const, label: 'Hall of Fame', href: '/hall-of-fame' },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const user = useAuthStore(s => s.user);
  const displayName = user?.custom_display_name || user?.username || 'User';
  const rawUsername = user?.username || 'unknown';
  const cleanUsername = rawUsername.replace(/^a_/, '');

  return (
    <aside className="fixed top-0 left-0 z-50 h-full w-64 lg:w-72 bg-[var(--color-bg)]/95 backdrop-blur-2xl border-r border-white/5 flex flex-col overflow-y-auto">
      {/* Logo */}
      <Link href="/" className="flex flex-col px-6 pt-6 pb-4 shrink-0">
        <div className="flex items-baseline gap-0">
          <span className="font-accent gradient-text text-3xl lg:text-4xl tracking-normal">YO</span>
          <span className="font-display text-3xl lg:text-4xl tracking-tight text-white">Top10</span>
        </div>
        <p className="text-2xs text-zinc-600 mt-1 leading-relaxed">Fact Mine. Debate Ground.</p>
      </Link>

      <hr className="border-white/5 mx-4 mb-4" />

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition text-sm ${
                isActive
                  ? 'text-orange-400 bg-orange-500/10 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto pt-4 pb-4 px-3 space-y-3 shrink-0">
        <hr className="border-white/5 mx-1" />

        {/* User section */}
        <Link
          href={user ? `/a/${cleanUsername}` : '/a'}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl transition text-sm text-zinc-400 hover:text-white hover:bg-white/5"
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold text-xs shrink-0">
            {displayName[0].toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-zinc-300 truncate">{displayName}</span>
              <Icon name="BadgeCheck" size={12} className="text-orange-400 shrink-0" />
            </div>
            <p className="text-3xs text-zinc-600 font-mono truncate">@{cleanUsername}</p>
          </div>
        </Link>

        {/* Settings + Theme */}
        <div className="flex items-center justify-between px-4 py-1">
          <Link
            href="/settings"
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition"
          >
            <Icon name="Settings" size={16} />
            Settings
          </Link>
          <ThemeToggle />
        </div>

        {/* Submit CTA */}
        <Link
          href="/new"
          className="block mx-1 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2.5 text-sm font-bold text-white text-center shadow-lg transition hover:shadow-xl hover:scale-[1.02]"
        >
          <Icon name="Plus" size={14} className="inline mr-1.5" />
          Submit a List
        </Link>
      </div>
    </aside>
  );
}
