import { API } from '@/lib/api';
import type { ArgumentPost, Category } from '@/lib/api/types';
import ArgumentsClient from './client';

const PER_PAGE = 20;

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
