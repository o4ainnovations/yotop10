import type { Metadata } from 'next';
import { API } from '@/lib/api';
import type { ArgumentPost, Category } from '@/lib/api/types';
import ArgumentsClient from './client';

const PER_PAGE = 20;

export const metadata: Metadata = {
  title: 'Hot Debates — YoTop10',
  description: 'Vote on the most heated debates. Pick a side, cast your vote, and join the discussion.',
  openGraph: {
    title: 'Hot Debates — YoTop10',
    description: 'Vote on the most heated debates. Pick a side, cast your vote, and join the discussion.',
  },
};

export default async function ArgumentsPage() {
  let posts: ArgumentPost[] = [];
  let categories: Category[] = [];
  let hasMore = false;

  try {
    const [data, catData] = await Promise.all([
      API.getArguments({ page: 1, limit: PER_PAGE }),
      API.getCategories(),
    ]);
    posts = data.arguments || [];
    categories = catData.categories || [];
    hasMore = 1 < (data.pagination?.totalPages || 1);
  } catch {}

  return <ArgumentsClient initialPosts={posts} initialCategories={categories} initialHasMore={hasMore} />;
}
