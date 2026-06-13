'use client';

import Link from 'next/link';
import { Icon } from './icons/Icon';

interface DebateItem {
  id?: string;
  slug: string;
  title: string;
  comment_count: number;
  view_count?: number;
  votes_a?: number;
  votes_b?: number;
  item_a_title?: string;
  item_b_title?: string;
}

export function DesktopActiveDebates({ debates, className = '' }: { debates: DebateItem[]; className?: string }) {
  if (!debates || debates.length === 0) return null;

  const active = debates.slice(0, 5);

  return (
    <section className={className}>
      <div className="flex items-center gap-2 mb-4">
        <Icon name="MessageCircle" size={16} className="text-orange-400" />
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Active Debates</h2>
      </div>
      <div className="space-y-2">
        {active.map(d => {
          const totalVotes = (d.votes_a ?? 0) + (d.votes_b ?? 0);
          return (
            <Link
              key={d.slug}
              href={`/${d.slug}`}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 transition hover:border-orange-500/20 hover:bg-white/[0.05]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-300 leading-snug line-clamp-1 group-hover:text-white transition">{d.title}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-3xs text-zinc-600">
                    <Icon name="Users" size={11} />
                    {totalVotes}
                  </span>
                  <span className="flex items-center gap-1 text-3xs text-zinc-600">
                    <Icon name="MessageCircle" size={11} />
                    {d.comment_count}
                  </span>
                  {d.item_a_title && d.item_b_title && (
                    <span className="text-3xs text-zinc-600 truncate">
                      {d.item_a_title} vs {d.item_b_title}
                    </span>
                  )}
                </div>
              </div>
              <Icon name="ChevronRight" size={14} className="text-zinc-600 shrink-0" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
