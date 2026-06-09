'use client';

import Link from 'next/link';
import { Icon } from './icons/Icon';

interface DebateItem {
  slug: string;
  title: string;
  comment_count: number;
  velocity?: number;
  category_slug?: string;
}

export function HomeDebates({ debates }: { debates: DebateItem[] }) {
  if (!debates || debates.length === 0) return null;

  return (
    <section className="px-3 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Icon name="MessageCircle" size={16} className="text-orange-400" />
          Hot Debates
        </h2>
        <Link href="/arguments" className="text-xs text-orange-400 hover:text-orange-300 transition">
          View all &rarr;
        </Link>
      </div>
      <div className="space-y-2">
        {debates.slice(0, 4).map(d => (
          <Link
            key={d.slug}
            href={`/${d.slug}`}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3 transition hover:border-orange-500/20 hover:bg-white/10 group"
          >
            <div className="flex-1 min-w-0 mr-3">
              <p className="text-sm text-zinc-300 truncate group-hover:text-white transition">{d.title}</p>
              {d.velocity !== undefined && d.velocity > 0 && (
                <p className="text-3xs text-orange-500 mt-0.5">{d.velocity} replies/hour</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Icon name="MessageCircle" size={14} className="text-zinc-600" />
              <span className="text-xs font-mono text-zinc-500">{d.comment_count}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
