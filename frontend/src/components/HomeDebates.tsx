'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from './icons/Icon';

interface DebateItem {
  slug: string;
  title: string;
  comment_count: number;
  velocity?: number;
  support_pct?: number;
  contradict_pct?: number;
  post_type?: string;
  item_a_title?: string;
  item_b_title?: string;
  votes_a?: number;
  votes_b?: number;
  id?: string;
}

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
      <div className="space-y-3">
        {localDebates.slice(0, 4).map(d => {
          const votesA = d.votes_a ?? 0;
          const votesB = d.votes_b ?? 0;
          const totalVotes = votesA + votesB || 1;
          const pctA = Math.round((votesA / totalVotes) * 100);
          const pctB = 100 - pctA;
          const did = d.id;
          const voted = did ? (votedMap[did] ?? null) : null;

          return (
            <div
              key={d.slug}
              className="rounded-xl border border-white/5 bg-white/5 px-4 py-4 transition hover:border-orange-500/20 hover:bg-white/10 group"
            >
              <p className="text-sm font-semibold text-zinc-200 group-hover:text-white transition mb-3 leading-snug">
                {d.title}
              </p>

              {/* Two vote options side by side */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button
                  onClick={() => handleVote(d, 'A')}
                  className={`rounded-lg border px-3 py-2.5 text-center transition ${
                    voted === 'A'
                      ? 'border-orange-500/50 bg-orange-500/10 text-orange-400'
                      : 'border-white/10 text-zinc-400 hover:border-orange-500/30 hover:text-orange-400'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Icon name="ArrowUp" size={14} />
                    <span className="text-xs font-semibold">Vote</span>
                  </div>
                  <p className="text-xs font-medium truncate">{d.item_a_title || 'Side A'}</p>
                  <span className="text-lg font-bold font-mono">{pctA}%</span>
                </button>

                <button
                  onClick={() => handleVote(d, 'B')}
                  className={`rounded-lg border px-3 py-2.5 text-center transition ${
                    voted === 'B'
                      ? 'border-orange-500/50 bg-orange-500/10 text-orange-400'
                      : 'border-white/10 text-zinc-400 hover:border-orange-500/30 hover:text-orange-400'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Icon name="ArrowUp" size={14} />
                    <span className="text-xs font-semibold">Vote</span>
                  </div>
                  <p className="text-xs font-medium truncate">{d.item_b_title || 'Side B'}</p>
                  <span className="text-lg font-bold font-mono">{pctB}%</span>
                </button>
              </div>

              {/* Bar + vote count + CTA */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex h-1.5 w-28 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-500 to-red-500 transition-all" style={{ width: `${pctA}%` }} />
                    <div className="bg-zinc-600 transition-all" style={{ width: `${pctB}%` }} />
                  </div>
                  <span className="text-3xs text-zinc-600 font-mono">{totalVotes - 1} votes</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xs text-zinc-600 flex items-center gap-1">
                    <Icon name="MessageCircle" size={12} />
                    {d.comment_count}
                  </span>
                  <Link
                    href={`/${d.slug}`}
                    className="rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-2xs font-semibold text-orange-400 transition hover:bg-orange-500/20"
                  >
                    Cast your vote &rarr;
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
