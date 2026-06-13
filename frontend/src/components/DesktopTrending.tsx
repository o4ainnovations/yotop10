'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from './icons/Icon';

export function DesktopTrending({ className = '' }: { className?: string }) {
  const [trending, setTrending] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { apiFetch } = await import('@/lib/api/client');
        const data = await apiFetch<{ terms: string[] }>('/search/trending');
        setTrending(data.terms?.slice(0, 6) || []);
      } catch { /* ignore */ }
    })();
  }, []);

  if (trending.length === 0) return null;

  return (
    <section className={className}>
      <div className="flex items-center gap-2 mb-4">
        <Icon name="TrendingUp" size={16} className="text-orange-400" />
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Trending Now</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {trending.map(term => (
          <Link
            key={term}
            href={`/search?q=${encodeURIComponent(term)}`}
            className="rounded-full bg-white/5 border border-white/10 px-3.5 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-white/10 hover:border-orange-500/30 transition"
          >
            {term}
          </Link>
        ))}
      </div>
    </section>
  );
}
