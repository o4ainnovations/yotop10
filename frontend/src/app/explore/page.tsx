import { API } from '@/lib/api';
import type { ExplorePost } from '@/lib/api/types';
import ExploreClient from './client';

const PER_PAGE = 20;

export default async function ExplorePage() {
  let posts: ExplorePost[] = [];
  let hasMore = false;

  try {
    const data = await API.getExplore(1, PER_PAGE);
    posts = data.posts || [];
    hasMore = 1 < (data.pagination?.totalPages || 1);
  } catch {}

  return <ExploreClient initialPosts={posts} initialHasMore={hasMore} />;
}
