'use client';

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

const FALLBACK_ICON = 'Folder';

function getCategoryIcon(slug: string): string {
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (slug.startsWith(key)) return icon;
  }
  return FALLBACK_ICON;
}

export function PostCarouselCard({ post }: { post: Post }) {
  const topItems = post.topItems || [];
  const remaining = Math.max(0, topItems.length - 3);
  const displayName = post.author_display_name || post.author_username;

  return (
    <Link
      href={`/${post.slug}`}
      className="flex-shrink-0 w-[calc(76vw-12px)] scroll-snap-align-start rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm overflow-hidden transition hover:border-white/10 focus:outline-none flex flex-col"
    >
      {/* Section A: Title + Description */}
      <div className="px-4 pt-4 pb-3">
        <h3 className="text-lg font-bold text-white leading-snug line-clamp-2">
          {post.title}
        </h3>
        {post.intro && (
          <p className="mt-1.5 text-[12px] text-zinc-500 leading-relaxed line-clamp-2">
            {post.intro}
          </p>
        )}
      </div>

      {/* Section B: Ranked Items */}
      {topItems.length > 0 && (
        <div className="px-4 space-y-2 mb-3">
          {topItems.slice(0, 3).map((item) => (
            <div key={item.rank} className="flex items-center gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 text-[11px] font-bold font-mono text-zinc-500 shrink-0">
                {item.rank}
              </span>
              <span className="text-sm text-zinc-300 truncate">{item.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Section C: Author Byline */}
      <div className="px-4 pb-3 flex items-center gap-1.5 text-[12px] text-zinc-500">
        <span>By</span>
        <span className="font-mono text-zinc-400">@{displayName}</span>
        <Icon name="BadgeCheck" size={12} className="text-orange-400" />
        <span className="text-zinc-700">&middot;</span>
        <span suppressHydrationWarning>{formatDate(post.created_at)}</span>
      </div>

      {/* Section D: Media — Image or Category Fallback */}
      <div className="mx-4 rounded-xl overflow-hidden h-44 bg-white/[0.03] flex items-center justify-center">
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
          <div className="flex flex-col items-center gap-2 text-zinc-700">
            <Icon name={getCategoryIcon(post.category_slug) as LucideIconName} size={36} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
              {post.category_slug}
            </span>
          </div>
        )}
      </div>

      {/* Section E: Footer */}
      <div className="flex items-center justify-between px-4 py-3 mt-auto border-t border-white/5">
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Icon name="MessageCircle" size={13} />
          <span>{post.comment_count} comments</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span>{post.view_count} views</span>
        </span>
      </div>
    </Link>
  );
}
