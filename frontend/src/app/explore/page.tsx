import type { Metadata } from 'next';
import { API } from '@/lib/api';
import type { ExplorePost } from '@/lib/api/types';
import ExploreClient from './client';

const PER_PAGE = 20;

export const metadata: Metadata = {
  title: 'Explore — YoTop10',
  description: 'Discover trending lists, debates, and fact drops. Find something new every day.',
  openGraph: {
    title: 'Explore — YoTop10',
    description: 'Discover trending lists, debates, and fact drops.',
  },
};

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
