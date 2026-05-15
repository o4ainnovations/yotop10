'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import HeaderBells from './HeaderBells';
import Link from 'next/link';

export default function DesktopTopBar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#05050f]/80 backdrop-blur-2xl border-b border-white/5">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-0 shrink-0">
          <span className="font-accent gradient-text text-xl tracking-normal">YO</span>
          <span className="font-display text-xl tracking-tight text-white">Top10</span>
        </Link>

        <div className="flex-1 mx-4 flex justify-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Fact mine. Debate ground. Search rankings..."
            className="w-full max-w-xl bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none backdrop-blur-md transition"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white/5 border border-white/10 rounded-full px-3 py-1 text-[10px] font-mono text-zinc-500">
            {user
              ? `ID: 0x${user.user_id ? user.user_id.substring(0, 4) : '?'}...`
              : 'visitor'}
          </div>
          <HeaderBells />
        </div>
      </div>
    </header>
  );
}
