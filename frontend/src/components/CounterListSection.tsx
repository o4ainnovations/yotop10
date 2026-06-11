'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from './icons/Icon';

interface CounterInfo {
  id: string;
  slug: string;
  title: string;
  fire_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
  author_username: string;
  author_display_name: string;
}

export function CounterListSection({ slug }: { slug: string }) {
  const [counters, setCounters] = useState<CounterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/posts/${slug}/counters?limit=5`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setCounters(data.counters || []); })
      .catch(() => { if (!cancelled) setError('Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return null;
  if (error || counters.length === 0) return null;

  return (
    <section className="border-t border-white/5 pt-8 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Counter-Lists ({counters.length})</h2>
        <Link href={`/${slug}?vs=${counters[0]?.slug}`} className="text-xs text-orange-400 hover:text-orange-300 transition">
          Compare &rarr;
        </Link>
      </div>
      <div className="space-y-2">
        {counters.map(c => (
          <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 transition hover:border-orange-500/20">
            <div className="min-w-0 flex-1 mr-3">
              <Link href={`/${c.slug}`} className="text-sm font-medium text-zinc-200 hover:text-orange-400 transition truncate block">
                {c.title}
              </Link>
              <p className="text-2xs text-zinc-600 mt-0.5">
                by {c.author_display_name || c.author_username}
                <span className="mx-1.5 text-zinc-700">&middot;</span>
                <Link href={`/${slug}?vs=${c.slug}`} className="text-orange-400 hover:text-orange-300">Compare</Link>
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 text-2xs text-zinc-600">
              <span className="inline-flex items-center gap-1"><Icon name="Flame" size={11} color="#ea580c" /> {c.fire_count}</span>
              <span className="inline-flex items-center gap-1"><Icon name="MessageCircle" size={11} /> {c.comment_count}</span>
              <span className="inline-flex items-center gap-1"><Icon name="Eye" size={11} /> {c.view_count}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
