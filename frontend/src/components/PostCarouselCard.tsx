'use client';

import { memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon, type LucideIconName } from './icons/Icon';
import { formatDate } from '@/lib/dates';
import type { Post } from '@/lib/api/types';

const CATEGORY_ICONS: Record<string, string> = {
  movies: 'Film', music: 'Music', food: 'UtensilsCrossed', gaming: 'Gamepad2',
  books: 'BookOpen', technology: 'Cpu', sports: 'Trophy', television: 'Tv',
  business: 'Briefcase', lifestyle: 'Heart',
};

function getCategoryIcon(slug: string): string {
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (slug.startsWith(key)) return icon;
  }
  return 'Folder';
}

export const PostCarouselCard = memo(function PostCarouselCard({ post }: { post: Post }) {
  const topItems = post.topItems || [];
  const displayName = post.author_display_name || post.author_username;
  const totalItems = post.totalItems || topItems.length;
  const remaining = Math.max(0, totalItems - 3);

  return (
    <Link
      href={`/${post.slug}`}
      className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm overflow-hidden transition hover:border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 flex flex-col"
    >
      {/* Section A: Title + Description */}
      <div className="px-4 lg:px-5 pt-4 lg:pt-5 pb-3 lg:pb-4">
        <h3 className="text-lg lg:text-2xl font-bold text-white leading-snug lg:leading-tight line-clamp-2">
          {post.title}
        </h3>
        {post.intro && (
          <p className="mt-1.5 lg:mt-2 text-xs lg:text-sm text-zinc-500 leading-relaxed line-clamp-2 lg:line-clamp-3">
            {post.intro}
          </p>
        )}
      </div>

      {/* Section B: Ranked Items */}
      {topItems.length > 0 && (
        <div className="px-4 lg:px-5 space-y-2 lg:space-y-3 mb-2 lg:mb-3">
          {topItems.slice(0, 3).map((item) => (
            <div key={item.rank} className="flex items-center gap-3 lg:gap-4">
              <span className="flex items-center justify-center w-6 lg:w-8 h-6 lg:h-8 rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-3xs lg:text-xs font-bold font-mono text-white shrink-0" style={{ color: '#fff' }}>
                #{item.rank}
              </span>
              <span className="text-sm lg:text-lg text-zinc-300 truncate">{item.title}</span>
            </div>
          ))}
          {remaining > 0 && (
            <p className="text-right text-2xs lg:text-xs text-zinc-600 mt-1 lg:mt-2 mb-1">
              ... and {remaining} more items
            </p>
          )}
        </div>
      )}

      {/* Section C: Media — Image or Category Gradient Fallback */}
      <div className="mx-4 lg:mx-5 rounded-xl overflow-hidden h-44 lg:h-64 bg-white/5">
        {post.hero_image_url ? (
          <Image
            src={post.hero_image_url}
            alt=""
            width={600}
            height={338}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-600/30 via-purple-700/20 to-red-700/30 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Icon name={getCategoryIcon(post.category_slug) as LucideIconName} size={48} className="text-white/25" />
              <span className="text-xs font-mono uppercase tracking-widest text-white/40">
                {post.category_name || post.category_slug}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Section D: Author Byline — below media */}
      <div className="px-4 lg:px-5 pt-3 lg:pt-4 pb-1 flex items-center gap-1.5 lg:gap-2 text-xs lg:text-sm text-zinc-500">
        <span>By</span>
        <span className="font-mono text-zinc-400">@{displayName}</span>
        <span className="text-orange-400/30"><Icon name="BadgeCheck" size={14} /></span>
        <span className="text-zinc-700">&middot;</span>
        <span suppressHydrationWarning>{formatDate(post.published_at || post.created_at)}</span>
      </div>

      {/* Section E: Engagement Footer */}
      <div className="flex items-center justify-between px-4 lg:px-5 py-3 lg:py-4 mt-auto border-t border-white/5">
        <span className="flex items-center gap-1.5 text-3xs lg:text-xs text-zinc-500">
          <Icon name="MessageCircle" size={16} />
          <span>{post.comment_count} comments</span>
        </span>
        <span className="flex items-center gap-1.5 text-3xs lg:text-xs text-zinc-500">
          <span>{post.view_count} views</span>
        </span>
      </div>
    </Link>
  );
});
