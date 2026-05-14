'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from './icons/Icon';
import { relativeTime } from '@/lib/dates';
import type { Post } from '@/lib/api/types';

interface GlassSlabProps {
  post: Post;
  variant?: 'featured' | 'compact';
  observe?: boolean;
  rank?: number;
}

export function GlassSlab({ post, variant = 'compact', observe = false, rank }: GlassSlabProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!observe);

  useEffect(() => {
    if (!observe || !ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [observe]);

  const hasHero = (post.format === 'hero_list' || post.format === 'full_list') && post.hero_image_url;
  const itemCount = variant === 'featured' ? 5 : 2;
  const topItems = post.topItems?.slice(0, itemCount);
  const authorInitial = (post.author_display_name || post.author_username || '?')[0].toUpperCase();

  return (
    <div ref={ref} className={visible ? 'card-deck-enter' : ''}>
      <Link href={`/${post.slug}`} className="block group">
        <article className={`rounded-2xl glass-slab spatial-depth transition-all ${
          variant === 'featured' ? 'p-6' : 'p-3.5'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="wiki-badge">CAT/{post.category_slug}</span>
            <div className="flex items-center gap-2">
              {rank !== undefined && (
                <span className="text-[10px] font-mono text-zinc-600">#{rank}</span>
              )}
              <span className="text-[10px] text-zinc-600" suppressHydrationWarning>
                {relativeTime(post.created_at)}
              </span>
            </div>
          </div>

          <h3 className={`font-bold text-white ${
            variant === 'featured' ? 'text-xl sm:text-2xl mb-3' : 'text-sm sm:text-base mb-2'
          }`}>
            {post.title}
          </h3>

          {variant === 'featured' && hasHero && (
            <div className="mb-4 overflow-hidden rounded-xl">
              <Image
                src={post.hero_image_url!}
                alt=""
                width={600}
                height={337}
                className="w-full object-cover"
              />
            </div>
          )}

          {topItems && topItems.length > 0 && (
            <div className={variant === 'featured' ? 'mb-4 space-y-1.5' : 'mb-2 space-y-0.5'}>
              {topItems.map((item) => (
                <div key={item.rank} className="flex items-center gap-2 text-zinc-400">
                  <span className={`font-mono text-zinc-600 shrink-0 ${
                    variant === 'featured' ? 'text-xs w-6' : 'text-[10px] w-5'
                  }`}>
                    {item.rank.toString().padStart(2, '0')}
                  </span>
                  <span className={`truncate ${variant === 'featured' ? 'text-sm' : 'text-xs'}`}>
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-mono text-[10px] flex items-center justify-center">
                {authorInitial}
              </span>
              <span className={variant === 'featured' ? 'text-xs text-zinc-500' : 'text-[11px] text-zinc-600'}>
                @{post.author_username}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-600">
                <Icon name="Eye" size={11} />
                {post.view_count}
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-600">
                <Icon name="MessageCircle" size={11} />
                {post.comment_count}
              </span>
            </div>
          </div>
        </article>
      </Link>
    </div>
  );
}
