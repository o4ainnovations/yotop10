'use client';

import { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import { Icon } from './icons/Icon';
import { relativeTime } from '@/lib/dates';
import type { Post } from '@/lib/api/types';

interface GlassSlabProps {
  post: Post;
  variant?: 'featured' | 'compact';
  observe?: boolean;
  rank?: number;
  actions?: React.ReactNode;
}

export function GlassSlab({ post, variant = 'compact', observe = false, rank, actions }: GlassSlabProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!observe);
  const [expanded, setExpanded] = useState(false);

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
  const defaultShow = variant === 'featured' ? 5 : 2;
  const allItems = post.topItems ?? [];
  const hasMore = allItems.length > defaultShow;
  const topItems = expanded ? allItems : allItems.slice(0, defaultShow);
  const hiddenCount = hasMore && !expanded ? allItems.length - defaultShow : 0;
  const authorInitial = (post.author_display_name || post.author_username || '?')[0].toUpperCase();

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  return (
    <div ref={ref} className={visible ? 'card-deck-enter' : ''}>
      <article
        className={`rounded-2xl glass-slab spatial-depth transition-all w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
          variant === 'featured'
            ? 'px-4 py-4 lg:px-6 lg:py-6'
            : 'px-4 py-4 lg:px-6 lg:py-5'
        }`}
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <span className="wiki-badge">CAT/{post.category_name || post.category_slug}</span>
          <div className="flex items-center gap-2">
            {rank !== undefined && (
              <span className="text-2xs font-mono text-zinc-600">#{rank}</span>
            )}
            <span className="text-2xs text-zinc-600" suppressHydrationWarning>
              {relativeTime(post.created_at)}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3
          className={`font-bold text-white ${
            variant === 'featured' ? 'text-xl sm:text-2xl mb-3' : 'text-sm sm:text-base mb-2'
          }`}
        >
          {post.title}
        </h3>

        {/* Hero image (featured only) */}
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

        {/* Top items */}
        {topItems.length > 0 && (
          <div className={variant === 'featured' ? 'mb-2 space-y-1.5' : 'mb-2 space-y-0.5'}>
            {topItems.map((item) => (
              <div key={item.rank} className="flex items-center gap-2 text-zinc-400">
                <span
                  className={`font-mono text-zinc-600 shrink-0 ${
                    variant === 'featured' ? 'text-xs w-6' : 'text-2xs w-5'
                  }`}
                >
                  {item.rank.toString().padStart(2, '0')}
                </span>
                <span className={`truncate ${variant === 'featured' ? 'text-sm' : 'text-xs'}`}>
                  {item.title}
                </span>
              </div>
            ))}

            {/* Expand / collapse toggle */}
            {hasMore && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleToggle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleToggle(e);
                  }
                }}
                className="inline-flex items-center gap-1 text-2xs font-mono text-zinc-500 hover:text-orange-400 transition-colors mt-1 py-2 min-h-11 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-lg"
              >
                {expanded ? (
                  <>
                    <Icon name="ChevronUp" size={12} />
                    Show less
                  </>
                ) : (
                  <>
                    <Icon name="ChevronDown" size={12} />
                    Show {hiddenCount} more
                  </>
                )}
              </span>
            )}
          </div>
        )}

        {/* Footer: author + metrics */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center rounded-full bg-white/10 text-xs font-mono text-zinc-400 w-6 h-6 shrink-0">
              {authorInitial}
            </span>
            <span
              className={
                variant === 'featured' ? 'text-xs text-zinc-500' : 'text-3xs text-zinc-600'
              }
            >
              @{post.author_username}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono tabular-nums text-2xs text-zinc-600">
            <span className="flex items-center gap-1">
              <Icon name="Eye" size={11} />
              {post.view_count}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="MessageCircle" size={11} />
              {post.comment_count}
            </span>
            {actions && <span className="flex items-center">{actions}</span>}
          </div>
        </div>
      </article>
    </div>
  );
}
