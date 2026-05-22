'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Icon } from './icons/Icon';
import { relativeTime } from '@/lib/dates';
import type { HallOfFameEntry } from '@/lib/api/types';

interface HallOfFameCardProps {
  entry: HallOfFameEntry;
  variant: 'admin' | 'public' | 'featured';
  onRemove?: (id: string) => void;
  onEditNote?: (id: string, note: string) => void;
}

const FALLBACK_TEXT = 'No post data available';

export function HallOfFameCard({
  entry,
  variant,
  onRemove,
  onEditNote,
}: HallOfFameCardProps) {
  const post = entry.post;
  const hasPost = post && post.title;

  if (variant === 'featured') {
    return (
      <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
        {post?.hero_image_url && (
          <div className="relative w-full h-48 lg:h-64 overflow-hidden">
            <Image
              src={post.hero_image_url}
              alt={post.title || ''}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
          </div>
        )}

        <div className="p-5 lg:p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
              FEATURED
            </span>
            {post?.category_slug && (
              <span className="text-2xs font-mono text-zinc-500 uppercase">
                {post.category_slug}
              </span>
            )}
          </div>

          {hasPost ? (
            <Link href={`/${post.slug}`} className="block group">
              <h2 className="text-xl lg:text-2xl font-bold text-white group-hover:text-amber-400 transition-colors mb-2">
                {post.title}
              </h2>
            </Link>
          ) : (
            <h2 className="text-xl font-bold text-zinc-600">{FALLBACK_TEXT}</h2>
          )}

          {entry.editorial_note && (
            <p className="text-sm text-zinc-400 italic leading-relaxed mb-3 border-l-2 border-amber-500/40 pl-3">
              {entry.editorial_note}
            </p>
          )}

          {hasPost && (
            <div className="flex items-center gap-4 mt-3 font-mono tabular-nums text-3xs text-zinc-500">
              {post.author_username && (
                <span className="flex items-center gap-1">
                  <Icon name="User" size={11} />
                  {post.author_display_name || post.author_username}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Icon name="MessageCircle" size={11} />
                {(post.comment_count ?? 0).toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Icon name="Eye" size={11} />
                {(post.view_count ?? 0).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'admin') {
    return (
      <div className="rounded-xl border border-white/5 bg-white/5 backdrop-blur-xl p-4 transition hover:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-2xs font-mono text-zinc-600 tabular-nums">
                #{entry.sort_order}
              </span>
              {post?.category_slug && (
                <span className="text-2xs font-mono text-zinc-600 uppercase">
                  {post.category_slug}
                </span>
              )}
              <span className="text-2xs text-zinc-600" suppressHydrationWarning>
                {entry.featured_at ? relativeTime(entry.featured_at) : ''}
              </span>
            </div>

            {hasPost ? (
              <Link href={`/${post.slug}`} className="block group">
                <h3 className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors truncate">
                  {post.title}
                </h3>
              </Link>
            ) : (
              <h3 className="text-sm font-semibold text-zinc-600">{FALLBACK_TEXT}</h3>
            )}

            {hasPost && (
              <span className="text-3xs text-zinc-500">
                @{post.author_username}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onEditNote && (
              <button
                onClick={() => {
                  const note = window.prompt('Edit editorial note:', entry.editorial_note ?? '');
                  if (note !== null) {
                    onEditNote(entry.id, note);
                  }
                }}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-white/5 transition"
                aria-label="Edit editorial note"
              >
                <Icon name="Pencil" size={14} />
              </button>
            )}
            {onRemove && (
              <button
                onClick={() => {
                  if (window.confirm('Remove this post from Hall of Fame?')) {
                    onRemove(entry.id);
                  }
                }}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-white/5 transition"
                aria-label="Remove from Hall of Fame"
              >
                <Icon name="Trash2" size={14} />
              </button>
            )}
          </div>
        </div>

        {entry.editorial_note && (
          <p className="mt-2 text-xs text-zinc-500 italic line-clamp-2">
            {entry.editorial_note}
          </p>
        )}

        {hasPost && (
          <div className="flex items-center gap-3 mt-2 font-mono tabular-nums text-2xs text-zinc-600">
            <span className="flex items-center gap-1">
              <Icon name="MessageCircle" size={10} />
              {(post.comment_count ?? 0).toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="Eye" size={10} />
              {(post.view_count ?? 0).toLocaleString()}
            </span>
          </div>
        )}
      </div>
    );
  }

  // variant === 'public'
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 backdrop-blur-xl p-4 transition hover:border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
          FEATURED
        </span>
        {post?.category_slug && (
          <span className="text-2xs font-mono text-zinc-500 uppercase">
            {post.category_slug}
          </span>
        )}
      </div>

      {hasPost ? (
        <Link href={`/${post.slug}`} className="block group">
          <h3 className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors line-clamp-2">
            {post.title}
          </h3>
        </Link>
      ) : (
        <h3 className="text-sm font-semibold text-zinc-600">{FALLBACK_TEXT}</h3>
      )}

      {entry.editorial_note && (
        <p className="mt-2 text-xs text-zinc-400 leading-relaxed line-clamp-3">
          {entry.editorial_note}
        </p>
      )}

      {hasPost && (
        <div className="flex items-center gap-3 mt-2">
          <span className="text-3xs text-zinc-500">
            @{post.author_username}
          </span>
          <span className="flex items-center gap-1 font-mono tabular-nums text-2xs text-zinc-600">
            <Icon name="MessageCircle" size={10} />
            {(post.comment_count ?? 0).toLocaleString()}
          </span>
          <span className="flex items-center gap-1 font-mono tabular-nums text-2xs text-zinc-600">
            <Icon name="Eye" size={10} />
            {(post.view_count ?? 0).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
