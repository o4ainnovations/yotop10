'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import CtaButton from '@/components/CtaButton';
import { apiFetch } from '@/lib/api';
import { PostCarouselCard } from '@/components/PostCarouselCard';
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
        <CtaButton href="/submit">
          <Icon name="Plus" size={16} />
          Submit a List
        </CtaButton>
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
            className={`text-3xs font-mono px-3 py-1.5 rounded-full transition-colors min-h-8 ${
              sort === opt.value
                ? 'bg-orange-500/15 text-orange-400'
                : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/5'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Horizontal carousel — snap scrolling */}
      <div
        className="flex flex-row overflow-x-auto overflow-y-hidden gap-3 pl-4 pb-4 -webkit-overflow-scrolling-touch snap-x snap-mandatory scroll-smooth"
      >
        {posts.map((post) => (
          <PostCarouselCard key={post.id} post={post} />
        ))}
        <div ref={sentinelRef} className="h-px w-px flex-shrink-0" />
      </div>
    </div>
  );
}
