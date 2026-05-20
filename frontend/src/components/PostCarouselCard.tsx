'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Icon } from './icons/Icon';
import { relativeTime } from '@/lib/dates';
import type { Post } from '@/lib/api/types';

interface PostCarouselCardProps {
  post: Post;
}

export function PostCarouselCard({ post }: PostCarouselCardProps) {
  const topItems = post.topItems || [];
  const remaining = Math.max(0, (post as any).totalItems - 3 || topItems.length - 3 || 0);
  const displayName = post.author_display_name || post.author_username;
  const username = post.author_username;

  return (
    <Link
      href={`/${post.slug}`}
      className="flex-shrink-0 w-[calc(76vw-12px)] scroll-snap-align-start rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm overflow-hidden transition hover:border-white/10 focus:outline-none"
    >
      {/* Header — User Meta */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold text-sm shrink-0">
          {displayName[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-white truncate">{displayName}</span>
            <Icon name="BadgeCheck" size={13} className="text-orange-400 shrink-0" />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span className="font-mono">@{username}</span>
            <span className="text-zinc-700">&middot;</span>
            <span suppressHydrationWarning>{relativeTime(post.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Title */}
      <h3 className="px-4 text-lg font-bold text-white leading-snug">
        {post.title}
      </h3>

      {/* Sub-headline / Intro */}
      {post.intro && (
        <p className="px-4 mt-1.5 text-[13px] text-zinc-500 leading-relaxed line-clamp-2">
          {post.intro}
        </p>
      )}

      {/* Ranked List Block — Top 3 items */}
      {topItems.length > 0 && (
        <div className="px-4 mt-4 space-y-2">
          {topItems.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-[11px] font-bold font-mono text-orange-400 shrink-0">
                {item.rank}
              </span>
              <span className="text-sm text-zinc-300 truncate">{item.title}</span>
            </div>
          ))}
          {remaining > 0 && (
            <p className="text-center text-[11px] text-zinc-600 mt-1">
              ... and {remaining} more items
            </p>
          )}
        </div>
      )}

      {/* Rich Media Image */}
      {post.hero_image_url && (
        <div className="mt-4 mx-4 rounded-xl overflow-hidden aspect-[16/9]">
          <Image
            src={post.hero_image_url}
            alt=""
            width={600}
            height={338}
            className="w-full h-full object-cover"
            unoptimized
          />
        </div>
      )}

      {/* Engagement Footer */}
      <div className="flex items-center justify-between px-4 py-3 mt-3 border-t border-white/5">
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Icon name="MessageCircle" size={13} />
          <span>{post.comment_count} comments</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Icon name="ChartBar" size={13} />
          <span>{post.view_count} views</span>
        </span>
      </div>
    </Link>
  );
}
