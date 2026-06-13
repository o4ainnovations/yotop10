'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from './icons/Icon';

interface DebateItem {
  id?: string;
  slug: string;
  title: string;
  comment_count: number;
  view_count?: number;
  post_type?: string;
  item_a_title?: string;
  item_b_title?: string;
  votes_a?: number;
  votes_b?: number;
  hero_image_url?: string | null;
  user_display_name?: string;
}

export function DesktopDebates({ debates, className = '' }: { debates: DebateItem[]; className?: string }) {
  const [localDebates, setLocalDebates] = useState(debates);
  const [votedMap, setVotedMap] = useState<Record<string, 'A' | 'B' | null>>({});

  if (!localDebates || localDebates.length === 0) return null;

  const handleVote = async (debate: DebateItem, side: 'A' | 'B') => {
    const pid = debate.id;
    if (!pid) return;
    try {
      const { apiFetch } = await import('@/lib/api/client');
      const res = await apiFetch<{ votes_a: number; votes_b: number; voted: string | null }>(`/posts/${pid}/vote`, {
        method: 'POST',
        body: JSON.stringify({ side }),
      });
      setLocalDebates(prev =>
        prev.map(d =>
          d.id === pid ? { ...d, votes_a: res.votes_a, votes_b: res.votes_b } : d
        )
      );
      setVotedMap(prev => ({ ...prev, [pid]: res.voted as 'A' | 'B' | null }));
    } catch { /* silently fail */ }
  };

  return (
    <section className={`${className}`}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Icon name="MessageCircle" size={16} className="text-orange-400" />
          Hot Debates
        </h2>
        <Link href="/arguments" className="text-xs text-orange-400 hover:text-orange-300 transition">
          View all &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {localDebates.slice(0, 4).map((d) => {
          const votesA = d.votes_a ?? 0;
          const votesB = d.votes_b ?? 0;
          const totalVotes = votesA + votesB;
          const hasVotes = totalVotes > 0;
          const pctA = hasVotes ? Math.round((votesA / totalVotes) * 100) : 0;
          const pctB = hasVotes ? Math.round((votesB / totalVotes) * 100) : 0;
          const voted = (d.id ? votedMap[d.id] : null) ?? null;

          return (
            <article
              key={d.slug}
              className="rounded-2xl border border-white/5 bg-white/[0.03] overflow-hidden transition hover:border-orange-500/20 hover:bg-white/[0.06]"
            >
              <Link href={`/${d.slug}`} className="block relative h-28 w-full overflow-hidden bg-zinc-900">
                {d.hero_image_url ? (
                  <Image src={d.hero_image_url} alt="" fill className="object-cover" unoptimized />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-600/30 to-red-700/30 flex items-center justify-center">
                    <Icon name="MessageCircle" size={28} className="text-white/15" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <span className="absolute top-2 left-2 rounded-md bg-black/50 backdrop-blur-sm px-2 py-0.5 text-2xs font-bold text-orange-400 tracking-wider flex items-center gap-1">
                  <Icon name="Flame" size={10} />
                  TRENDING
                </span>
              </Link>
              <div className="px-4 pb-4">
                <Link href={`/${d.slug}`} className="block mt-3 mb-3">
                  <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">{d.title}</h3>
                </Link>
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/10 text-2xs font-mono text-zinc-400 shrink-0">
                    {(d.user_display_name || 'A')[0].toUpperCase()}
                  </span>
                  <span className="text-2xs text-zinc-500">{d.user_display_name || 'anonymous'}</span>
                  <Icon name="BadgeCheck" size={10} className="text-blue-400" />
                </div>
                <div className="space-y-2">
                  <div className="rounded-lg border border-red-500/10 bg-red-500/[0.03] px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-zinc-300 truncate">{d.item_a_title || ''}</span>
                      <span className="text-xs font-bold font-mono text-red-400 shrink-0 ml-2">{hasVotes ? `${pctA}%` : '--'}</span>
                    </div>
                    <div className="h-1 rounded-full bg-zinc-800 overflow-hidden mb-1">
                      <div className={`h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 transition-all ${!hasVotes ? 'opacity-0' : ''}`} style={{ width: `${hasVotes ? pctA : 0}%` }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-3xs text-zinc-600">{votesA.toLocaleString()} votes</span>
                      <button
                        onClick={() => handleVote(d, 'A')}
                        className={`rounded px-2 py-0.5 text-3xs font-semibold transition ${
                          voted === 'A'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'border border-white/10 text-zinc-500 hover:border-red-500/30 hover:text-red-400'
                        }`}
                      >
                        {voted === 'A' ? 'Voted' : 'Vote A'}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-blue-500/10 bg-blue-500/[0.03] px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-zinc-300 truncate">{d.item_b_title || ''}</span>
                      <span className="text-xs font-bold font-mono text-blue-400 shrink-0 ml-2">{hasVotes ? `${pctB}%` : '--'}</span>
                    </div>
                    <div className="h-1 rounded-full bg-zinc-800 overflow-hidden mb-1">
                      <div className={`h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all ${!hasVotes ? 'opacity-0' : ''}`} style={{ width: `${hasVotes ? pctB : 0}%` }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-3xs text-zinc-600">{votesB.toLocaleString()} votes</span>
                      <button
                        onClick={() => handleVote(d, 'B')}
                        className={`rounded px-2 py-0.5 text-3xs font-semibold transition ${
                          voted === 'B'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'border border-white/10 text-zinc-500 hover:border-blue-500/30 hover:text-blue-400'
                        }`}
                      >
                        {voted === 'B' ? 'Voted' : 'Vote B'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-3 mt-3 border-t border-zinc-800">
                  <span className="flex items-center gap-1 text-3xs text-zinc-600">
                    <Icon name="Users" size={12} />
                    {totalVotes}
                  </span>
                  <Link href={`/${d.slug}`} className="flex items-center gap-1 text-3xs text-zinc-600 hover:text-zinc-400 transition">
                    <Icon name="MessageCircle" size={12} />
                    {d.comment_count}
                  </Link>
                  <span className="flex items-center gap-1 text-3xs text-zinc-600">
                    <Icon name="Eye" size={12} />
                    {(d.view_count ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
