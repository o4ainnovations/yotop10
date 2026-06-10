import { API } from '@/lib/api';
import type { Article } from '@/lib/api/types';
import ArticlesClient from './client';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10;

export default async function ArticlesPage() {
  let articles: Article[] = [];
  let hasMore = false;

  try {
    const data = await API.getArticles({ page: 1, limit: PAGE_SIZE });
    articles = data.articles || [];
    const totalPages = data.pagination?.totalPages || 1;
    hasMore = 1 < totalPages;
  } catch {}

  return <ArticlesClient initialArticles={articles} initialHasMore={hasMore} />;
}
