'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { GlassSlab } from '@/components/GlassSlab';
import { Icon } from '@/components/icons/Icon';
import type { Post, PostsResponse } from '@/lib/api/types';

const PER_PAGE = 20;

type SortValue = 'latest' | 'views' | 'comments';

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'views', label: 'Most Viewed' },
  { value: 'comments', label: 'Discussed' },
] as const;

interface FeedClientProps {
  initialPosts: Post[];
  initialHasMore: boolean;
  category?: string;
}

export function FeedClient({ initialPosts, initialHasMore, category }: FeedClientProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [fetching, setFetching] = useState(false);
  const [sort, setSort] = useState<SortValue>('latest');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isMount = useRef(true);
  const currentSort = useRef<SortValue>('latest');

  const fetchPosts = useCallback(async (pageNum: number, s: SortValue) => {
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: String(PER_PAGE),
    });
    if (category) params.set('category', category);
    if (s !== 'latest') params.set('sort', s);
    return apiFetch<PostsResponse>(`/posts?${params}`);
  }, [category]);

  // Reset feed when sort pill changes
  useEffect(() => {
    if (isMount.current) {
      isMount.current = false;
      return;
    }
    if (currentSort.current === sort) return;
    currentSort.current = sort;

    let cancelled = false;
    const reset = async () => {
      setFetching(true);
      try {
        const data = await fetchPosts(1, sort);
        if (cancelled) return;
        setPosts(data.posts || []);
        setPage(1);
        setHasMore(1 < (data.pagination?.totalPages || 1));
      } catch {
        if (!cancelled) {
          setPosts([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    };
    reset();
    return () => { cancelled = true; };
  }, [sort, fetchPosts]);

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (!hasMore || fetching) return;

        const nextPage = page + 1;
        setFetching(true);
        try {
          const data = await fetchPosts(nextPage, sort);
          setPosts((prev) => [...prev, ...(data.posts || [])]);
          setPage(nextPage);
          setHasMore(nextPage < (data.pagination?.totalPages || 1));
        } catch {
          setHasMore(false);
        } finally {
          setFetching(false);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, fetching, page, fetchPosts, sort]);

  // Empty state
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
          <Icon name="FileText" size={24} className="text-zinc-600" />
        </div>
        <h3 className="mb-2 text-base font-semibold text-zinc-300">No ranked lists yet.</h3>
        <p className="mb-6 text-sm text-zinc-600 max-w-xs">
          Be the first to rank your top 10. Share your picks and spark the debate.
        </p>
        <Link
          href="/submit"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 active:scale-[0.98]"
        >
          <Icon name="Plus" size={16} />
          Submit a List
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Sort pills — small and unobtrusive */}
      <div className="flex items-center gap-1.5 mb-4 px-1">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSort(opt.value)}
            className={`text-[11px] font-mono px-3 py-1.5 rounded-full transition-colors min-h-[32px] ${
              sort === opt.value
                ? 'bg-orange-500/15 text-orange-400'
                : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Card deck — vertical stacking, infinite scroll */}
      <div className="space-y-3 pb-20">
        {posts.map((post, i) => (
          <Link key={post.id} href={`/${post.slug}`} className="block group">
            <GlassSlab post={post} variant="compact" observe={i >= 1} />
          </Link>
        ))}
        <div ref={sentinelRef} className="h-px" />
      </div>
    </div>
  );
}
