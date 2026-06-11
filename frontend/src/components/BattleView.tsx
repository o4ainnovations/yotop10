'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from './icons/Icon';
import { relativeTime } from '@/lib/dates';

interface DiffResult {
  matches: Array<{ rank: number; title: string }>;
  moved: Array<{ title: string; old_rank: number; new_rank: number }>;
  replaced: Array<{ title: string; old_rank: number }>;
  added: Array<{ title: string; new_rank: number }>;
}

interface PostSummary {
  title: string;
  slug: string;
}

interface CompareData {
  original: PostSummary;
  counter: PostSummary;
  diff: DiffResult;
}

export function BattleView({
  originalSlug,
  counterSlug,
  onClose,
}: {
  originalSlug: string;
  counterSlug: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originalPost, setOriginalPost] = useState<{ author_display_name?: string; created_at: string } | null>(null);
  const [counterPost, setCounterPost] = useState<{ author_display_name?: string; created_at: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/posts/compare/${originalSlug}/${counterSlug}`).then(r => r.json()),
      fetch(`/api/posts/${originalSlug}`).then(r => r.json()),
      fetch(`/api/posts/${counterSlug}`).then(r => r.json()),
    ])
      .then(([compare, origData, counterData]) => {
        if (cancelled) return;
        setData(compare);
        setOriginalPost(origData.post || null);
        setCounterPost(counterData.post || null);
      })
      .catch(() => { if (!cancelled) setError('Failed to load comparison'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [originalSlug, counterSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-red-400">{error || 'Comparison unavailable'}</p>
        <button onClick={onClose} className="mt-4 text-xs text-orange-400 hover:text-orange-300 transition">Back to original list</button>
      </div>
    );
  }

  const { diff } = data;
  const matchColor = 'border-green-500/20 bg-green-500/5';
  const movedColor = 'border-yellow-500/20 bg-yellow-500/5';
  const replacedColor = 'border-red-500/20 bg-red-500/5';
  const addedColor = 'border-blue-500/20 bg-blue-500/5';

  return (
    <div className="mb-8">
      {/* Battle header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Icon name="Swords" size={16} className="text-orange-400" />
          Battle View
        </h2>
        <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300 transition">Back to original</button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-2xs text-zinc-600 mb-6 flex-wrap">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> {diff.matches.length} unchanged</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" /> {diff.moved.length} moved</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> {diff.replaced.length} removed</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> {diff.added.length} new</span>
      </div>

      {/* Side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Original column */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Original</h3>
            <Link href={`/${originalSlug}`} className="text-2xs text-orange-400 hover:text-orange-300 transition">View &rarr;</Link>
          </div>
          <p className="text-sm font-semibold text-white truncate mb-1">{data.original.title}</p>
          {originalPost && (
            <p className="text-2xs text-zinc-600 mb-4">
              {originalPost.author_display_name && `by ${originalPost.author_display_name}`}
              <span suppressHydrationWarning> &middot; {relativeTime(originalPost.created_at)}</span>
            </p>
          )}
          <div className="space-y-1.5">
            {/* Ranks that are same or modified */}
            {Array.from({ length: Math.max(
              ...diff.matches.map(m => m.rank),
              ...diff.moved.map(m => m.old_rank),
              ...diff.replaced.map(r => r.old_rank),
            ) }).map((_, idx) => {
              const rank = idx + 1;
              const match = diff.matches.find(m => m.rank === rank);
              const moved = diff.moved.find(m => m.old_rank === rank);
              const replaced = diff.replaced.find(r => r.old_rank === rank);
              if (match) {
                return (
                  <div key={`orig-${rank}`} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${matchColor}`}>
                    <span className="shrink-0 w-5 text-center text-2xs font-bold font-mono text-green-400">{rank}</span>
                    <span className="text-xs text-green-300 truncate">{match.title}</span>
                    <Icon name="Check" size={12} className="shrink-0 text-green-500" />
                  </div>
                );
              }
              if (moved) {
                return (
                  <div key={`orig-${rank}`} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${movedColor}`}>
                    <span className="shrink-0 w-5 text-center text-2xs font-bold font-mono text-yellow-400">{rank}</span>
                    <span className="text-xs text-yellow-300 truncate">{moved.title}</span>
                    <span className="shrink-0 text-2xs text-yellow-500">→{moved.new_rank}</span>
                  </div>
                );
              }
              if (replaced) {
                return (
                  <div key={`orig-${rank}`} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${replacedColor}`}>
                    <span className="shrink-0 w-5 text-center text-2xs font-bold font-mono text-red-400">{rank}</span>
                    <span className="text-xs text-red-300 truncate">{replaced.title}</span>
                    <Icon name="X" size={12} className="shrink-0 text-red-500" />
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>

        {/* Counter column */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Counter</h3>
            <Link href={`/${counterSlug}`} className="text-2xs text-orange-400 hover:text-orange-300 transition">View &rarr;</Link>
          </div>
          <p className="text-sm font-semibold text-white truncate mb-1">{data.counter.title}</p>
          {counterPost && (
            <p className="text-2xs text-zinc-600 mb-4">
              {counterPost.author_display_name && `by ${counterPost.author_display_name}`}
              <span suppressHydrationWarning> &middot; {relativeTime(counterPost.created_at)}</span>
            </p>
          )}
          <div className="space-y-1.5">
            {Array.from({ length: Math.max(
              ...diff.matches.map(m => m.rank),
              ...diff.moved.map(m => m.new_rank),
              ...diff.added.map(a => a.new_rank),
            ) }).map((_, idx) => {
              const rank = idx + 1;
              const match = diff.matches.find(m => m.rank === rank);
              const moved = diff.moved.find(m => m.new_rank === rank);
              const added = diff.added.find(a => a.new_rank === rank);
              if (match) {
                return (
                  <div key={`ctr-${rank}`} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${matchColor}`}>
                    <span className="shrink-0 w-5 text-center text-2xs font-bold font-mono text-green-400">{rank}</span>
                    <span className="text-xs text-green-300 truncate">{match.title}</span>
                    <Icon name="Check" size={12} className="shrink-0 text-green-500" />
                  </div>
                );
              }
              if (moved) {
                return (
                  <div key={`ctr-${rank}`} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${movedColor}`}>
                    <span className="shrink-0 w-5 text-center text-2xs font-bold font-mono text-yellow-400">{rank}</span>
                    <span className="text-xs text-yellow-300 truncate">{moved.title}</span>
                    <span className="shrink-0 text-2xs text-yellow-500">from {diff.moved.find(m => m.new_rank === rank)?.old_rank}</span>
                  </div>
                );
              }
              if (added) {
                return (
                  <div key={`ctr-${rank}`} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${addedColor}`}>
                    <span className="shrink-0 w-5 text-center text-2xs font-bold font-mono text-blue-400">{rank}</span>
                    <span className="text-xs text-blue-300 truncate">{added.title}</span>
                    <span className="shrink-0 text-2xs text-blue-500">NEW</span>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
