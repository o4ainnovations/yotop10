'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { API } from '@/lib/api';
import { PostCard } from '@/components/PostCard';
import { CategoryBar } from '@/components/CategoryBar';
import { Icon } from '@/components/icons/Icon';
import type { Post } from '@/lib/api/types';

const PER_PAGE = 20;

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<'newest' | 'most_viewed' | 'most_commented'>('newest');

  const fetchPosts = useCallback(async (pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const data = await API.getPosts({ page: pageNum, limit: PER_PAGE }) as { posts: Post[]; pagination?: { totalPages: number } };
      const fetched = data.posts || [];
      setPosts((prev) => append ? [...prev, ...fetched] : fetched);
      setHasMore(pageNum < (data.pagination?.totalPages || 1));
    } catch { /* silent */ }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { setPosts([]); setPage(1); fetchPosts(1, false); }, [sort, fetchPosts]);

  const loadMore = () => { const n = page + 1; setPage(n); fetchPosts(n, true); };

  const SortPill = ({ s, label }: { s: typeof sort; label: string }) => (
    <button
      onClick={() => setSort(s)}
      className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
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
      {/* Hero */}
      <header className="border-b border-white/5 px-6 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/5 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-orange-400">
              Open Beta
            </span>
          </div>
          <h1 className="mb-3 text-5xl font-black tracking-tight text-white">
            Fact Mine.
            <br />
            <span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
              Debate Ground.
            </span>
          </h1>
          <p className="mb-8 text-lg leading-relaxed text-zinc-400">
            The open catalog of ranked lists. No accounts required.
            <br />
            Submit your list. Defend your rankings. Own your reputation.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 hover:scale-[1.02]"
            >
              <Icon name="Plus" size={16} />
              Submit a List
            </Link>
            <Link
              href="/categories"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-300 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/10"
            >
              Browse Categories
            </Link>
          </div>
        </div>
      </header>

      {/* Category Bar */}
      <CategoryBar />

      {/* Sort */}
      <div className="flex justify-end gap-2 px-6 py-3">
        <SortPill s="newest" label="Newest" />
        <SortPill s="most_viewed" label="Most Viewed" />
        <SortPill s="most_commented" label="Most Commented" />
      </div>

      {/* Feed */}
      <main className="mx-auto max-w-3xl px-4 pb-20">
        {loading ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-orange-500/30 border-t-orange-500" />
            <p className="text-sm text-zinc-600">Loading the feed</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
              <Icon name="FileText" size={28} className="text-zinc-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-zinc-300">No lists yet</h3>
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
            <div className="space-y-4 pt-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            {hasMore && (
              <div className="pt-8 text-center">
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

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 text-center">
        <p className="text-xs text-zinc-600">
          YoTop10 &mdash; Open Platform for Ranked Lists
        </p>
      </footer>
    </div>
  );
}
