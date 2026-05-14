import { Suspense } from 'react';
import { FeedClient } from './FeedClient';
import { CommandSearch } from '@/components/CommandSearch';
import type { Post } from '@/lib/api/types';

const FALLBACK_TRENDING = [
  'best movies 2024',
  'top albums',
  'favorite games',
  'best restaurants',
  'coding languages',
  'workout routines',
];

async function getPosts() {
  const baseUrl = process.env.INTERNAL_API_URL || 'http://localhost:8000/api';
  try {
    const res = await fetch(`${baseUrl}/posts?page=1&limit=20`, { cache: 'no-store' });
    if (!res.ok) return { posts: [] as Post[], hasMore: false };
    const data = await res.json();
    return {
      posts: (data.posts || []) as Post[],
      hasMore: (data.pagination?.page || 1) < (data.pagination?.totalPages || 1),
    };
  } catch {
    return { posts: [] as Post[], hasMore: false };
  }
}

async function getTrending() {
  const baseUrl = process.env.INTERNAL_API_URL || 'http://localhost:8000/api';
  try {
    const res = await fetch(`${baseUrl}/search/trending`, { cache: 'no-store' });
    if (!res.ok) return FALLBACK_TRENDING;
    const data = await res.json();
    return (data.trending || []).map((t: { query: string }) => t.query).slice(0, 8);
  } catch {
    return FALLBACK_TRENDING;
  }
}

export default async function Home() {
  const [{ posts, hasMore }, trendingQueries] = await Promise.all([
    getPosts(),
    getTrending(),
  ]);

  return (
    <div>
      <CommandSearch trendingQueries={trendingQueries} />
      <Suspense>
        <FeedClient initialPosts={posts} initialHasMore={hasMore} />
      </Suspense>
    </div>
  );
}
