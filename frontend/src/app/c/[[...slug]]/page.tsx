import { API } from '@/lib/api';
import type { Post } from '@/lib/api/types';
import { notFound } from 'next/navigation';
import CategoryFeedClient from './client';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  post_count: number;
  children: Array<{ id: string; name: string; slug: string; post_count: number }>;
}

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function CategoryFeedPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slugParam = resolvedParams.slug;
  const slug = slugParam ? slugParam.join('/') : '';

  if (!slug) return null;

  let category: Category | null = null;
  let posts: Post[] = [];
  let hasMore = false;

  try {
    const [catData, postsData] = await Promise.all([
      API.getCategory(slug) as Promise<{ category: Category }>,
      API.getPosts({ category: slug, page: 1, limit: 20 }) as Promise<{ posts: Post[]; pagination?: { page: number; totalPages: number } }>,
    ]);
    category = catData.category;
    posts = postsData.posts || [];
    hasMore = (postsData.pagination?.totalPages ?? 1) > 1;
  } catch {
    notFound();
  }

  return <CategoryFeedClient slug={slug} initialCategory={category} initialPosts={posts} initialHasMore={hasMore} />;
}
