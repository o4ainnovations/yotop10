'use client';

import { useState, useCallback } from 'react';
import { API } from '@/lib/api';
import type { Article } from '@/lib/api/types';
import Link from 'next/link';
import Image from 'next/image';
import { relativeTime } from '@/lib/dates';

const PAGE_SIZE = 10;

const factCheckStyles: Record<string, string> = {
  verified: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/5',
  disputed: 'text-red-400 border-red-400/20 bg-red-400/5',
  unverified: 'text-yellow-400 border-yellow-400/20 bg-yellow-400/5',
};

const factCheckLabels: Record<string, string> = {
  verified: 'Verified',
  disputed: 'Disputed',
  unverified: 'Unverified',
};

interface ArticlesClientProps {
  initialArticles: Article[];
  initialHasMore: boolean;
}

export default function ArticlesClient({ initialArticles, initialHasMore }: ArticlesClientProps) {
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);

  const handleLoadMore = useCallback(async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await API.getArticles({ page: nextPage, limit: PAGE_SIZE });
      const fetched = data.articles || [];
      setArticles(prev => [...prev, ...fetched]);
      const totalPages = data.pagination?.totalPages || 1;
      setHasMore(nextPage < totalPages);
      setPage(nextPage);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  }, [page]);

  const excerpt = (body: string): string => {
    if (!body) return '';
    return body.length > 250 ? body.slice(0, 250) + '...' : body;
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <header className="mb-12">
        <h1 className="font-display text-3xl text-white">Articles</h1>
        <p className="mt-2 text-zinc-500">Long-form knowledge pieces. Fact-checked. Sourced.</p>
      </header>

      {articles.length === 0 && (
        <div className="rounded-2xl border border-white/5 bg-white/5 p-12 text-center backdrop-blur-xl">
          <p className="text-zinc-500">No articles yet. Be the first to publish.</p>
        </div>
      )}

      <div className="space-y-8">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/articles/${article.slug}`}
            className="block rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-xl transition hover:border-white/10"
          >
            {article.cover_image && (
              <div className="relative mb-5 w-full overflow-hidden rounded-xl">
                <Image
                  src={article.cover_image}
                  alt={article.title}
                  width={1200}
                  height={600}
                  className="max-h-64 w-full object-cover"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-3xs font-mono text-zinc-500">
                {article.reading_time} min read
              </span>
              {article.category_slug && (
                <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-3xs text-zinc-500">
                {article.category_name || article.category_slug}
              </span>
              )}
              {article.fact_check_status && (
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-3xs font-mono ${factCheckStyles[article.fact_check_status] || factCheckStyles.unverified}`}
                >
                  {factCheckLabels[article.fact_check_status] || 'Unverified'}
                </span>
              )}
            </div>

            <h2 className="mb-2 text-2xl font-bold text-white">{article.title}</h2>

            <p className="mb-3 text-sm text-zinc-500">
              by {article.author_display_name}
              <span className="mx-1.5 text-zinc-700">&middot;</span>
              <span suppressHydrationWarning>{relativeTime(article.created_at)}</span>
            </p>

            <p className="mb-4 leading-relaxed text-zinc-400">{excerpt(article.body)}</p>

            <div className="flex items-center gap-4 text-zinc-500">
              <span className="inline-flex items-center gap-1 text-xs font-mono">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                {article.view_count}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-mono">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                {article.comment_count}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-mono">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                {article.bookmark_count}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {hasMore && (
        <div className="mt-10 flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="rounded-xl border border-white/10 bg-white/5 px-8 py-3 text-sm text-zinc-400 backdrop-blur-xl transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load more articles'}
          </button>
        </div>
      )}
    </main>
  );
}
