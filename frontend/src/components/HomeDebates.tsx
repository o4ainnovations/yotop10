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

const BG_GRADIENTS = [
  'from-orange-600/40 to-red-700/40',
  'from-blue-600/40 to-purple-700/40',
  'from-emerald-600/40 to-teal-700/40',
  'from-pink-600/40 to-rose-700/40',
];

export function HomeDebates({ debates }: { debates: DebateItem[] }) {
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
    } catch {
      // silently fail
    }
  };

  return (
    <section className="px-3 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Icon name="MessageCircle" size={16} className="text-orange-400" />
          Hot Debates
        </h2>
        <Link href="/arguments" className="text-xs text-orange-400 hover:text-orange-300 transition">
          View all &rarr;
        </Link>
      </div>
      <div className="space-y-4">
        {localDebates.slice(0, 4).map((d, idx) => {
          const votesA = d.votes_a ?? 0;
          const votesB = d.votes_b ?? 0;
          const totalVotes = votesA + votesB;
          const hasVotes = totalVotes > 0;
          const pctA = hasVotes ? Math.round((votesA / totalVotes) * 100) : 0;
          const pctB = hasVotes ? Math.round((votesB / totalVotes) * 100) : 0;
          const voted = (d.id ? votedMap[d.id] : null) ?? null;
          const gradient = BG_GRADIENTS[idx % BG_GRADIENTS.length];

          return (
            <article
              key={d.slug}
              className="rounded-2xl border border-white/5 bg-white/5 overflow-hidden transition hover:border-orange-500/20 hover:bg-white/[0.07]"
            >
              {/* A. Debate Banner Image */}
              <Link href={`/${d.slug}`} className="block relative h-36 w-full overflow-hidden bg-zinc-900">
                {d.hero_image_url ? (
                  <Image src={d.hero_image_url} alt="" fill className="object-cover" unoptimized />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <Icon name="MessageCircle" size={36} className="text-white/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="absolute top-2 left-2 rounded-md bg-black/60 backdrop-blur-sm px-2 py-0.5 text-2xs font-bold text-orange-400 tracking-wider flex items-center gap-1">
                  <Icon name="Flame" size={11} />
                  TRENDING
                </span>
              </Link>

              <div className="px-4 pb-4">
                {/* B. Creator Row */}
                <div className="flex items-center gap-2 mt-3 mb-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-2xs font-mono text-zinc-400 shrink-0">
                    {(d.user_display_name || 'A')[0].toUpperCase()}
                  </span>
                  <span className="text-xs text-zinc-500">{d.user_display_name || 'anonymous'}</span>
                  <Icon name="BadgeCheck" size={12} className="text-blue-400" />
                </div>

                {/* C. Debate Info */}
                <Link href={`/${d.slug}`} className="block mb-3">
                  <h3 className="text-base font-bold text-white leading-snug mb-1">{d.title}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    {d.item_a_title && d.item_b_title
                      ? `${d.item_a_title} vs ${d.item_b_title} — which side are you on?`
                      : 'Cast your vote and join the discussion.'}
                  </p>
                </Link>

                {/* D. Stacked Voting Options */}
                <div className="space-y-3 mb-3">
                  {/* Option A */}
                  <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-zinc-200">{d.item_a_title || ''}</span>
                      <span className="text-sm font-bold font-mono text-red-400">{hasVotes ? `${pctA}%` : '--'}</span>
                    </div>
                      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mb-1.5">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 transition-all ${!hasVotes ? 'opacity-0' : ''}`}
                          style={{ width: `${hasVotes ? pctA : 0}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xs text-zinc-600 font-mono">{votesA.toLocaleString()} votes</span>
                        <button
                          onClick={() => handleVote(d, 'A')}
                          className={`rounded-md px-2.5 py-1 text-2xs font-semibold transition ${
                            voted === 'A'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'border border-white/10 text-zinc-400 hover:border-red-500/30 hover:text-red-400'
                          }`}
                        >
                          {voted === 'A' ? 'Voted' : 'Vote'}
                        </button>
                      </div>
                    </div>

                    {/* Option B */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-zinc-200">{d.item_b_title || ''}</span>
                        <span className="text-sm font-bold font-mono text-blue-400">{hasVotes ? `${pctB}%` : '--'}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mb-1.5">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all ${!hasVotes ? 'opacity-0' : ''}`}
                          style={{ width: `${hasVotes ? pctB : 0}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xs text-zinc-600 font-mono">{votesB.toLocaleString()} votes</span>
                      <button
                        onClick={() => handleVote(d, 'B')}
                        className={`rounded-md px-2.5 py-1 text-2xs font-semibold transition ${
                          voted === 'B'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'border border-white/10 text-zinc-400 hover:border-blue-500/30 hover:text-blue-400'
                        }`}
                      >
                        {voted === 'B' ? 'Voted' : 'Vote'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* E. Engagement Footer */}
                <div className="flex items-center justify-start gap-5 pt-3 border-t border-zinc-800">
                  <span className="flex items-center gap-1.5 text-3xs text-zinc-600">
                    <Icon name="Users" size={13} />
                    {totalVotes}
                  </span>
                  <Link href={`/${d.slug}`} className="flex items-center gap-1.5 text-3xs text-zinc-600 hover:text-zinc-400 transition">
                    <Icon name="MessageCircle" size={13} />
                    {d.comment_count}
                  </Link>
                  <span className="flex items-center gap-1.5 text-3xs text-zinc-600">
                    <Icon name="Eye" size={13} />
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
