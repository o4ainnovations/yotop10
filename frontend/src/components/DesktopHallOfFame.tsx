'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from './icons/Icon';

interface HofEntry {
  id: string;
  post_id: string;
  post: {
    slug: string;
    title: string;
    post_type: string;
    author_username: string;
    author_display_name: string;
    view_count: number;
    comment_count: number;
  };
  editorial_note?: string | null;
}

export function DesktopHallOfFame({ className = '' }: { className?: string }) {
  const [entries, setEntries] = useState<HofEntry[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { apiFetch } = await import('@/lib/api/client');
        const data = await apiFetch<{ entries: HofEntry[] }>('/hall-of-fame?limit=3');
        setEntries(data.entries?.slice(0, 3) || []);
      } catch { /* ignore */ }
    })();
  }, []);

  if (entries.length === 0) return null;

  return (
    <section className={className}>
      <div className="flex items-center gap-2 mb-4">
        <Icon name="Crown" size={16} className="text-orange-400" />
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Hall of Fame</h2>
      </div>
      <div className="space-y-3">
        {entries.map((entry, i) => (
          <Link
            key={entry.id}
            href={`/${entry.post.slug}`}
            className="block rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-orange-500/20 hover:bg-white/[0.05]"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/15 text-2xs font-bold text-yellow-400">
                {i + 1}
              </span>
              <span className="text-3xs text-yellow-500/60 uppercase tracking-wider font-semibold">Featured</span>
            </div>
            <h3 className="text-sm font-semibold text-zinc-200 leading-snug line-clamp-2 mb-1">{entry.post.title}</h3>
            {entry.editorial_note && (
              <p className="text-2xs text-zinc-500 line-clamp-2 leading-relaxed mb-2">{entry.editorial_note}</p>
            )}
            <div className="flex items-center gap-3 text-3xs text-zinc-600">
              <span>{entry.post.author_display_name || entry.post.author_username}</span>
              <span>{entry.post.view_count.toLocaleString()} views</span>
              <span>{entry.post.comment_count} comments</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
