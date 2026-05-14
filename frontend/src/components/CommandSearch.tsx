'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './icons/Icon';

interface CommandSearchProps {
  trendingQueries: string[];
}

export function CommandSearch({ trendingQueries }: CommandSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      router.push(`/search?q=${encodeURIComponent(value.trim())}`);
    }
  };

  return (
    <section className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
      <div className="relative">
        <Icon
          name="Search"
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Fact mine. Debate ground. Search rankings..."
          className="w-full rounded-2xl border border-white/20 bg-white/[0.03] py-3.5 pl-12 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500/40 focus:outline-none focus:bg-white/[0.05] transition"
        />
      </div>

      {trendingQueries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
            Trending
          </span>
          {trendingQueries.map((q, i) => (
            <button
              key={q}
              onClick={() => router.push(`/search?q=${encodeURIComponent(q)}`)}
              className="text-[11px] font-mono text-zinc-500 hover:text-orange-400 transition cursor-pointer bg-transparent border-none p-0"
            >
              {(i + 1).toString().padStart(2, '0')}{' '}
              #{q.toUpperCase().replace(/\s/g, '_')}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
