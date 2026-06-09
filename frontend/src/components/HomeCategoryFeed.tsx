'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { API } from '@/lib/api';
import { DataCard } from './DataCard';
import type { Post } from '@/lib/api/types';

interface CatItem {
  name: string;
  slug: string;
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

  if (top.length === 0) return null;

  const currentPost = posts[slide] || null;
  const totalSlides = Math.min(posts.length, 3);

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
              {currentPost && (
                <DataCard post={currentPost} />
              )}
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
