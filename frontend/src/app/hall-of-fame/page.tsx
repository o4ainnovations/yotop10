'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { apiFetch } from '@/lib/api/client';
import { Icon } from '@/components/icons/Icon';
import { formatDate, relativeTime } from '@/lib/dates';
import type { HallOfFameEntry } from '@/lib/api/types';

interface HallOfFameResponse {
  featured: HallOfFameEntry[];
}

export default function HallOfFamePage() {
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<HallOfFameResponse>('/hall-of-fame')
      .then(data => setEntries(data.featured || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05050f] flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="min-h-screen bg-[#05050f] flex flex-col items-center justify-center px-4">
        <Icon name="Star" size={48} className="text-zinc-600 mb-4" />
        <h1 className="font-display text-3xl sm:text-4xl text-white mb-2">Hall of Fame</h1>
        <p className="text-zinc-500 text-sm">No featured lists yet. The best will rise.</p>
      </div>
    );
  }

  const featured = entries.slice(0, 3);
  const grid = entries.slice(3);

  return (
    <div className="min-h-screen bg-[#05050f]">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <h1 className="font-display text-3xl sm:text-4xl text-white mb-2">Hall of Fame</h1>
          <p className="text-zinc-500 text-sm sm:text-base">The best lists, confirmed by the community</p>
        </div>

        {/* Featured section — first 1-3 entries */}
        <div className="space-y-6 mb-12">
          {featured.map((entry) => {
            const post = entry.post;
            return (
              <a
                key={entry.id}
                href={`/${post.slug}`}
                className="block bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden hover:bg-white/[0.04] transition-colors group"
              >
                {post.hero_image_url && (
                  <div className="w-full overflow-hidden">
                    <Image
                      src={post.hero_image_url}
                      alt={post.title}
                      width={1200}
                      height={514}
                      className="block w-full h-auto"
                      unoptimized
                    />
                  </div>
                )}
                <div className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Featured
                    </span>
                    {post.category_slug && (
                      <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide border border-white/10 rounded-full px-2 py-0.5">
                        {post.category_slug}
                      </span>
                    )}
                  </div>

                  <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-orange-400 transition-colors">
                    {post.title}
                  </h2>

                  {entry.editorial_note && (
                    <div className="border-l-2 border-orange-500/30 pl-4 mb-4">
                      <p className="text-zinc-400 italic text-sm leading-relaxed">{entry.editorial_note}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="text-zinc-400">{post.author_username}</span>
                    <div className="flex items-center gap-3 text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Icon name="MessageCircle" size={13} /> {post.comment_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="Eye" size={14} /> {post.view_count}
                      </span>
                    </div>
                    <span className="text-zinc-600 font-mono text-[11px]" suppressHydrationWarning>
                      Featured {formatDate(entry.featured_at)}
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {/* Grid section — remaining entries */}
        {grid.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {grid.map((entry) => {
              const post = entry.post;
              return (
                <a
                  key={entry.id}
                  href={`/${post.slug}`}
                  className="block bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.04] hover:border-white/10 transition-all group"
                >
                  {post.hero_image_url && (
                    <div className="w-full overflow-hidden rounded-xl mb-3">
                      <Image
                        src={post.hero_image_url}
                        alt={post.title}
                        width={400}
                        height={225}
                        className="block w-full h-auto"
                        unoptimized
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                      Featured
                    </span>
                    {post.category_slug && (
                      <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide border border-white/10 rounded-full px-1.5 py-0.5">
                        {post.category_slug}
                      </span>
                    )}
                  </div>

                  <h3 className="text-white font-semibold text-sm leading-snug mb-2 line-clamp-2 group-hover:text-orange-400 transition-colors">
                    {post.title}
                  </h3>

                  {entry.editorial_note && (
                    <p className="text-zinc-500 italic text-xs leading-relaxed line-clamp-2 mb-3">
                      {entry.editorial_note}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span className="text-zinc-400">{post.author_username}</span>
                    <span className="flex items-center gap-1 text-zinc-500">
                      <Icon name="MessageCircle" size={11} /> {post.comment_count}
                    </span>
                    <span className="flex items-center gap-1 text-zinc-500">
                      <Icon name="Eye" size={12} /> {post.view_count}
                    </span>
                    <span className="text-zinc-600 font-mono" suppressHydrationWarning>
                      {relativeTime(entry.featured_at)}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
