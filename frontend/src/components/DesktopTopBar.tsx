'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import HeaderBells from './HeaderBells';
import Link from 'next/link';
import { Icon } from './icons/Icon';
import { SlideMenuTrigger } from './SlideMenu';

export default function DesktopTopBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const user = useAuthStore(s => s.user);
  const cleanUsername = user?.username?.replace(/^a_/, '') || '';
  const profileHref = cleanUsername ? `/a/${cleanUsername}` : '/a';

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[var(--color-bg)]/80 backdrop-blur-2xl border-b border-white/5">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-3 sm:px-6">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-baseline gap-0 shrink-0">
            <span className="font-accent gradient-text text-lg sm:text-xl tracking-normal">YO</span>
            <span className="font-display text-lg sm:text-xl tracking-tight text-white">Top10</span>
          </Link>
        </div>

        <div className="show-from-sm flex-1 mx-4 justify-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Fact mine. Debate ground. Search rankings..."
            className="w-full max-w-xl bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none backdrop-blur-md transition"
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <SlideMenuTrigger />
          <div className="show-from-sm-block">
            <HeaderBells />
          </div>

          <Link
            href={profileHref}
            className="show-desktop items-center justify-center w-9 h-9 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            aria-label="Profile"
          >
            <Icon name="User" size={18} />
          </Link>
        </div>
      </div>
    </header>
  );
}
