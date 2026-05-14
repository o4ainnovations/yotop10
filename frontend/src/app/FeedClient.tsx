'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { DataCard } from '@/components/DataCard';
import { Icon } from '@/components/icons/Icon';
import type { Post, PostsResponse } from '@/lib/api/types';

const PER_PAGE = 20;

type SortMode = 'newest' | 'most_viewed' | 'most_commented';

const SORT_LABELS: Record<SortMode, string> = {
  newest: 'Newest',
  most_viewed: 'Most Viewed',
  most_commented: 'Most Commented',
};

export function FeedClient({ initialPosts, initialHasMore }: { initialPosts: Post[]; initialHasMore: boolean }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [sort, setSort] = useState<SortMode>('newest');
  const [fetching, setFetching] = useState(false);
  const navigatingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPosts = useCallback(async (pageNum: number, sortMode: SortMode) => {
    return apiFetch<PostsResponse>(`/posts?page=${pageNum}&limit=${PER_PAGE}&sort=${sortMode}`);
  }, []);

  const handleSort = async (s: SortMode) => {
    if (s === sort) return;
    setSort(s);
    setFetching(true);
    try {
      const data = await fetchPosts(1, s);
      setPosts(data.posts || []);
      setPage(1);
      setHasMore(1 < (data.pagination?.totalPages || 1));
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (!hasMore || fetching || navigatingRef.current) return;

        const nextPage = page + 1;
        setFetching(true);
        try {
          const data = await fetchPosts(nextPage, sort);
          setPosts((prev) => [...prev, ...(data.posts || [])]);
          setPage(nextPage);
          setHasMore(nextPage < (data.pagination?.totalPages || 1));
        } finally {
          setFetching(false);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, fetching, page, sort, fetchPosts]);

  const SortPill = ({ s }: { s: SortMode }) => (
    <button
      onClick={() => handleSort(s)}
      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition sm:px-4 sm:text-xs ${
        sort === s
          ? 'border border-orange-500/30 bg-orange-500/10 text-orange-400'
          : 'text-zinc-500 hover:text-zinc-400'
      }`}
    >
      {SORT_LABELS[s]}
    </button>
  );

  return (
    <div>
      <div className="flex gap-1.5 px-3 py-2.5 sm:gap-2 sm:px-6 sm:py-3">
        <SortPill s="newest" />
        <SortPill s="most_viewed" />
        <SortPill s="most_commented" />
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-20 text-center sm:py-28">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 sm:h-16 sm:w-16">
            <Icon name="FileText" size={24} className="text-zinc-600 sm:size-[28px]" />
          </div>
          <h3 className="mb-2 text-base font-semibold text-zinc-300 sm:text-lg">
            No ranked lists yet.
          </h3>
          <Link
            href="/submit"
            onClick={() => { navigatingRef.current = true; }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 active:scale-[0.98]"
          >
            <Icon name="Plus" size={16} />
            Submit a List
          </Link>
        </div>
      ) : (
        <div className="space-y-3 px-3 pb-20 sm:px-4">
          {posts.map((post) => (
            <DataCard key={post.id} post={post} />
          ))}
          <div ref={sentinelRef} className="h-px" />
        </div>
      )}
    </div>
  );
}
