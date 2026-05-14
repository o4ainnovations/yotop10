'use client';

import Link from 'next/link';
import { Icon } from './icons/Icon';
import { relativeTime } from '@/lib/dates';
import type { Post } from '@/lib/api/types';

const TYPE_LABEL: Record<string, string> = {
  top_list: 'Ranked', this_vs_that: 'VS', who_is_better: 'Versus',
  fact_drop: 'Fact', best_of: 'Best Of', worst_of: 'Worst',
  hidden_gems: 'Hidden Gem', counter_list: 'Rebuttal',
};

export function PostCard({ post }: { post: Post }) {
  const isCounter = post.post_type === 'counter_list';

  return (
    <Link href={`/${post.slug}`} className="group block">
      <article className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300 hover:border-orange-500/30 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-orange-500/5">
        <div className="mb-3 flex items-center gap-2">
          {isCounter && (
            <span className="text-sm font-bold text-orange-500">&larr;</span>
          )}
          <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-orange-400">
            {TYPE_LABEL[post.post_type] || post.post_type}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] capitalize text-zinc-500">
            {post.category_slug}
          </span>
        </div>

        <h3 className="mb-2 text-lg font-bold leading-snug text-white group-hover:text-white">
          {post.title}
        </h3>

        {post.intro && (
          <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-zinc-500">
            {post.intro}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-zinc-600">
          <span className="font-mono text-zinc-500" suppressHydrationWarning>{post.author_display_name}</span>
          <span className="text-zinc-700">&middot;</span>
          <span suppressHydrationWarning>{relativeTime(post.created_at)}</span>
          <span className="flex-1" />
          <span className="flex items-center gap-1.5">
            <Icon name="ChartBar" size={13} />
            <span className={post.view_count > 1000 ? 'text-orange-400' : ''} suppressHydrationWarning>
              {post.view_count > 1000 ? `${(post.view_count / 1000).toFixed(1)}k` : post.view_count}
            </span>
          </span>
          <span className="flex items-center gap-1.5 ml-3">
            <Icon name="MessageCircle" size={13} />
            <span>{post.comment_count}</span>
          </span>
        </div>
      </article>
    </Link>
  );
}
