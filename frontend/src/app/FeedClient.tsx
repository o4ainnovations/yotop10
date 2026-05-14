'use client';

import { useState } from 'react';
import Link from 'next/link';
import { API } from '@/lib/api';
import { PostCard } from '@/components/PostCard';
import { CategoryBar } from '@/components/CategoryBar';
import { Icon } from '@/components/icons/Icon';
import type { Post } from '@/lib/api/types';

const PER_PAGE = 20;

type SortMode = 'newest' | 'most_viewed' | 'most_commented';

export function FeedClient({ initialPosts, initialHasMore }: { initialPosts: Post[]; initialHasMore: boolean }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<SortMode>('newest');
  const [loaded, setLoaded] = useState(false);

  const handleSort = async (s: SortMode) => {
    if (s === sort && loaded) return;
    setSort(s);
    setLoadingMore(true);
    try {
      const data = await API.getPosts({ page: 1, limit: PER_PAGE }) as { posts: Post[]; pagination?: { totalPages: number } };
      setPosts(data.posts || []);
      setHasMore(1 < (data.pagination?.totalPages || 1));
      setPage(1);
      setLoaded(true);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  };

  const loadMore = async () => {
    const next = page + 1;
    setLoadingMore(true);
    try {
      const data = await API.getPosts({ page: next, limit: PER_PAGE }) as { posts: Post[]; pagination?: { totalPages: number } };
      setPosts((prev) => [...prev, ...(data.posts || [])]);
      setHasMore(next < (data.pagination?.totalPages || 1));
      setPage(next);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  };

  const SortPill = ({ s, label }: { s: SortMode; label: string }) => (
    <button
      onClick={() => handleSort(s)}
      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition sm:px-4 sm:text-xs ${
        sort === s
          ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
          : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero — responsive text */}
      <header className="border-b border-white/5 px-4 py-10 text-center sm:px-6 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/5 px-3 py-1 sm:px-4 sm:py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-orange-400 sm:text-[11px]">
              Open Beta
            </span>
          </div>
          <h1 className="mb-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
            Fact Mine.
            <br />
            <span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
              Debate Ground.
            </span>
          </h1>
          <p className="mb-8 text-base leading-relaxed text-zinc-400 sm:text-lg">
            The open catalog of ranked lists. No accounts required.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
            <Link
              href="/submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 active:scale-[0.98]"
            >
              <Icon name="Plus" size={16} />
              Submit a List
            </Link>
            <Link
              href="/categories"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-300 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/10"
            >
              Browse Categories
            </Link>
          </div>
        </div>
      </header>

      {/* Category Bar — horizontal scroll on mobile */}
      <CategoryBar />

      {/* Sort */}
      <div className="flex justify-end gap-1.5 px-3 py-2.5 sm:gap-2 sm:px-6 sm:py-3">
        <SortPill s="newest" label="Newest" />
        <SortPill s="most_viewed" label="Viewed" />
        <SortPill s="most_commented" label="Comments" />
      </div>

      {/* Feed */}
      <main className="mx-auto max-w-3xl px-3 pb-20 sm:px-4">
        {posts.length === 0 ? (
          <div className="py-16 text-center sm:py-20">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 sm:h-16 sm:w-16">
              <Icon name="FileText" size={24} className="text-zinc-600 sm:size-[28px]" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-zinc-300 sm:text-lg">No lists yet</h3>
            <p className="mb-6 text-sm text-zinc-500">Be the first to submit a ranked list.</p>
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25"
            >
              <Icon name="Plus" size={16} />
              Submit a List
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3 pt-2 sm:space-y-4 sm:pt-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            {hasMore && (
              <div className="pt-6 text-center sm:pt-8">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full max-w-sm rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-zinc-400 backdrop-blur-sm transition hover:border-orange-500/30 hover:text-orange-400 disabled:opacity-30"
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-white/5 px-4 py-6 text-center sm:px-6 sm:py-8">
        <p className="text-[11px] text-zinc-600 sm:text-xs">
          YoTop10 &mdash; Open Platform for Ranked Lists
        </p>
      </footer>
    </div>
  );
}
