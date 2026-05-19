'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import HeaderBells from './HeaderBells';
import Link from 'next/link';
import { Icon } from './icons/Icon';
import { SlideMenuTrigger } from './SlideMenu';

export default function DesktopTopBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[var(--color-bg)]/80 backdrop-blur-2xl border-b border-white/5">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-3 sm:px-6">
        {/* Logo — left */}
        <Link href="/" className="flex items-baseline gap-0 shrink-0">
          <span className="font-accent gradient-text text-lg sm:text-xl tracking-normal">YO</span>
          <span className="font-display text-lg sm:text-xl tracking-tight text-white">Top10</span>
        </Link>

        {/* Desktop search */}
        <div className="hidden sm:flex flex-1 mx-4 justify-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Fact mine. Debate ground. Search rankings..."
            className="w-full max-w-xl bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none backdrop-blur-md transition"
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Desktop: notification bell */}
          <div className="hidden sm:block">
            <HeaderBells />
          </div>

          {/* Desktop: submit button */}
          <Link
            href="/submit"
            className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg transition hover:scale-105 active:scale-95"
            aria-label="Submit"
          >
            <Icon name="Plus" size={20} />
          </Link>

          {/* Mobile: slide menu */}
          <SlideMenuTrigger />
        </div>
      </div>
    </header>
  );
}
