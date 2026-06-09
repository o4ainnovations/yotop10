'use client';

import { memo } from 'react';
import Link from 'next/link';
import { Icon } from './icons/Icon';
import { ArgumentBar } from './ArgumentBar';
import { relativeTime } from '@/lib/dates';
import type { ArgumentPost } from '@/lib/api/types';

const POST_TYPE_CONFIG: Record<string, { label: string; borderClass: string }> = {
  this_vs_that: { label: 'THIS VS THAT', borderClass: 'border border-orange-500/30 text-orange-400' },
  counter_list: { label: 'COUNTER LIST', borderClass: 'border border-teal-500/30 text-teal-400' },
};

interface ArgumentCardProps {
  argument: ArgumentPost;
}

export const ArgumentCard = memo(function ArgumentCard({ argument }: ArgumentCardProps) {
  const config = POST_TYPE_CONFIG[argument.post_type] ?? {
    label: argument.post_type.toUpperCase(),
    borderClass: 'border border-white/10 text-zinc-400',
  };

  const topComment = argument.top_comments?.[0];
  const contentPreview = topComment
    ? topComment.content.length > 100
      ? topComment.content.slice(0, 100) + '...'
      : topComment.content
    : null;

  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl p-5 transition hover:border-white/10">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`text-2xs font-mono px-2 py-0.5 rounded ${config.borderClass}`}>
          {config.label}
        </span>

        <span className="text-2xs font-mono text-zinc-600 uppercase">
          {argument.category_name || argument.category_slug}
        </span>

        {argument.velocity > 0 && (
          <span className="text-2xs font-mono text-orange-400">
            {argument.velocity} replies/hour
          </span>
        )}
      </div>

      <Link href={`/${argument.slug}`} className="block group">
        <h3 className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors mb-3">
          {argument.title}
        </h3>
      </Link>

      {topComment && (
        <div className="mb-3 rounded-xl bg-white/5 border border-white/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center justify-center w-5 h-5 rounded bg-orange-500/20 text-2xs font-mono text-orange-400 tabular-nums">
              {topComment.rank}
            </span>
            <span className="text-xs text-zinc-400">
              On item #{topComment.rank}: {topComment.item_title}
            </span>
          </div>
          <p className="text-sm text-zinc-500 leading-relaxed mb-2">
            {contentPreview}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-3xs font-mono text-zinc-500">
              @{topComment.author_username}
            </span>
            <span className="flex items-center gap-1 text-3xs text-zinc-600">
              <Icon name="Flame" size={11} />
              <span className="font-mono tabular-nums">{topComment.fire_count}</span>
            </span>
          </div>
        </div>
      )}

      <div className="mb-3">
        <ArgumentBar supportPct={argument.support_pct} contradictPct={argument.contradict_pct} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center rounded-full bg-white/10 text-xs font-mono text-zinc-400 w-6 h-6 shrink-0">
            {(argument.author_display_name || argument.author_username || '?')[0].toUpperCase()}
          </span>
          <span className="text-xs text-zinc-500">
            @{argument.author_username}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono tabular-nums text-2xs text-zinc-600">
          <span className="text-3xs text-zinc-600" suppressHydrationWarning>
            {relativeTime(argument.last_active)}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="Eye" size={11} />
            {argument.view_count}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="MessageCircle" size={11} />
            {argument.comment_count}
          </span>
        </div>
      </div>
    </div>
  );
});
