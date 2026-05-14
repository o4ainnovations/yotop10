import { Suspense } from 'react';
import { FeedClient } from './FeedClient';

async function getPosts() {
  const baseUrl = process.env.INTERNAL_API_URL || 'http://localhost:8000/api';
  try {
    const res = await fetch(`${baseUrl}/posts?page=1&limit=20`, { cache: 'no-store' });
    if (!res.ok) return { posts: [], hasMore: false };
    const data = await res.json();
    return {
      posts: data.posts || [],
      hasMore: (data.pagination?.page || 1) < (data.pagination?.totalPages || 1),
    };
  } catch {
    return { posts: [], hasMore: false };
  }
}

export default async function Home() {
  const { posts, hasMore } = await getPosts();

  return (
    <Suspense>
      <FeedClient initialPosts={posts} initialHasMore={hasMore} />
    </Suspense>
  );
}
