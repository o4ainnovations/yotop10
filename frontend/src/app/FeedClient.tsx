'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { GlassSlab } from '@/components/GlassSlab';
import type { Post, PostsResponse } from '@/lib/api/types';

const PER_PAGE = 20;

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
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPosts = useCallback(async (pageNum: number) => {
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: String(PER_PAGE),
    });
    if (category) params.set('category', category);
    return apiFetch<PostsResponse>(`/posts?${params}`);
  }, [category]);

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
          const data = await fetchPosts(nextPage);
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
  }, [hasMore, fetching, page, fetchPosts]);

  if (posts.length === 0) return null;

  return (
    <div className="space-y-3 pb-20">
      {posts.map((post) => (
        <GlassSlab key={post.id} post={post} variant="compact" observe />
      ))}
      <div ref={sentinelRef} className="h-px" />
    </div>
  );
}
