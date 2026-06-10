'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { API } from '@/lib/api';
import { DataCard } from './DataCard';
import { Icon } from './icons/Icon';
import type { Post } from '@/lib/api/types';

interface CatItem {
  name: string;
  slug: string;
}

function VsMiniCard({ post }: { post: Post }) {
  const items = post.topItems ?? [];
  return (
    <Link
      href={`/${post.slug}`}
      className="block rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm px-4 py-4 transition hover:border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-2xs font-bold text-orange-400">VS</span>
        <span className="text-2xs text-zinc-600">{post.comment_count} comments</span>
      </div>
      <h3 className="text-sm font-bold text-white leading-snug mb-2">{post.title}</h3>
      <div className="flex items-center gap-2">
        {items.slice(0, 2).map((item, i) => (
          <div
            key={item.rank}
            className={`flex-1 rounded-lg border px-2.5 py-2 text-center ${i === 0 ? 'border-orange-500/20 bg-orange-500/5' : 'border-blue-500/20 bg-blue-500/5'}`}
          >
            <span className={`text-xs font-semibold ${i === 0 ? 'text-orange-400' : 'text-blue-400'}`}>
              {item.title}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
        <span className="text-3xs text-zinc-600">@{post.author_username}</span>
        <span className="text-3xs text-zinc-600">{post.view_count} views</span>
      </div>
    </Link>
  );
}

function FactDropMiniCard({ post }: { post: Post }) {
  return (
    <Link
      href={`/${post.slug}`}
      className="block rounded-2xl border border-orange-500/10 bg-gradient-to-r from-orange-500/5 to-pink-500/5 px-4 py-4 transition hover:border-orange-500/20 hover:from-orange-500/10 hover:to-pink-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-2xs font-bold text-orange-400 uppercase tracking-wider mb-2">
        <Icon name="Lightbulb" size={11} /> Did You Know?
      </span>
      <p className="text-xs leading-relaxed text-zinc-300 line-clamp-3">
        {post.intro || post.title}
      </p>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
        <span className="text-3xs text-zinc-600">@{post.author_username}</span>
        <span className="text-3xs text-zinc-600">{post.view_count} views</span>
      </div>
    </Link>
  );
}

export function HomeCategoryFeed({ categories }: { categories: CatItem[] }) {
  const top = categories.filter(c => c.name).slice(0, 4);
  const [activeSlug, setActiveSlug] = useState(top[0]?.slug || '');
  const [posts, setPosts] = useState<Post[]>([]);
  const [slide, setSlide] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchPosts = useCallback(async (slug: string) => {
    setLoading(true);
    setSlide(0);
    try {
      const data = await API.getPosts({ category: slug, limit: 3 }) as { posts: Post[] };
      setPosts(data.posts || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (top.length > 0 && !activeSlug) {
      setActiveSlug(top[0].slug);
    }
  }, [top, activeSlug]);

  useEffect(() => {
    if (activeSlug) fetchPosts(activeSlug);
  }, [activeSlug, fetchPosts]);

  // Auto-slide every 3 seconds (must be before early return — hooks rule)
  const totalSlides = Math.min(posts.length, 3);
  useEffect(() => {
    if (totalSlides <= 1) return;
    const interval = setInterval(() => {
      setSlide(s => (s + 1) % totalSlides);
    }, 3000);
    return () => clearInterval(interval);
  }, [totalSlides]);

  if (top.length === 0) return null;

  const currentPost = posts[slide] || null;

  return (
    <section className="px-3 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          Categories
        </h2>
        <Link href="/categories" className="text-xs text-orange-400 hover:text-orange-300 transition">
          Browse all &rarr;
        </Link>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {top.map(cat => (
          <button
            key={cat.slug}
            onClick={() => { setActiveSlug(cat.slug); }}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
              activeSlug === cat.slug
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10 hover:text-zinc-200'
            }`}
          >
            {cat.slug}
          </button>
        ))}
      </div>

      {/* 3-slide carousel */}
      <div className="relative">
        {loading ? (
          <div className="h-40 rounded-xl bg-white/5 animate-pulse" />
        ) : posts.length === 0 ? (
          <p className="text-sm text-zinc-600 py-8 text-center">No posts in this category yet.</p>
        ) : (
          <>
            {/* Post card */}
            <div className="min-h-[160px]">
              {currentPost && currentPost.post_type === 'this_vs_that'
                ? <VsMiniCard post={currentPost} />
                : currentPost && currentPost.post_type === 'fact_drop'
                  ? <FactDropMiniCard post={currentPost} />
                  : currentPost && <DataCard post={currentPost} />
              }
            </div>

            {/* Arrows + Dots */}
            {totalSlides > 1 && (
              <div className="flex items-center justify-center gap-4 mt-4">
                <button
                  onClick={() => setSlide(s => Math.max(0, s - 1))}
                  disabled={slide === 0}
                  className="text-zinc-500 hover:text-white disabled:opacity-30 transition text-xs"
                  aria-label="Previous"
                >
                  &#9664;
                </button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: totalSlides }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSlide(i)}
                      className={`w-2 h-2 rounded-full transition ${
                        i === slide ? 'bg-orange-400' : 'bg-zinc-700 hover:bg-zinc-500'
                      }`}
                      aria-label={`Slide ${i + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setSlide(s => Math.min(totalSlides - 1, s + 1))}
                  disabled={slide >= totalSlides - 1}
                  className="text-zinc-500 hover:text-white disabled:opacity-30 transition text-xs"
                  aria-label="Next"
                >
                  &#9654;
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
