'use client';

import { useState, useEffect, useCallback } from 'react';
import { API } from '@/lib/api';
import type { Article } from '@/lib/api/types';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/icons/Icon';
import { relativeTime } from '@/lib/dates';
import { FeedSkeleton } from '@/components/Skeleton';

const PAGE_SIZE = 10;

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchArticles = useCallback(async (p: number, append: boolean) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await API.getArticles({ page: p, limit: PAGE_SIZE });
      const fetched = data.articles || [];
      setArticles(prev => (append ? [...prev, ...fetched] : fetched));
      const totalPages = data.pagination?.totalPages || 1;
      setHasMore(p < totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load articles');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles(1, false);
  }, [fetchArticles]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchArticles(nextPage, true);
  };

  const excerpt = (body: string): string => {
    if (!body) return '';
    return body.length > 250 ? body.slice(0, 250) + '...' : body;
  };

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

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <header className="mb-12">
        <h1 className="font-display text-3xl text-white">Articles</h1>
        <p className="mt-2 text-zinc-500">Long-form knowledge pieces. Fact-checked. Sourced.</p>
      </header>

      {error && (
        <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && articles.length === 0 && (
        <FeedSkeleton count={3} />
      )}

      {!loading && articles.length === 0 && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center backdrop-blur-xl">
          <Icon name="FileText" size={40} className="mx-auto mb-4 text-zinc-500" />
          <p className="text-zinc-500">No articles yet. Be the first to publish.</p>
        </div>
      )}

      <div className="space-y-8">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/articles/${article.slug}`}
            className="block rounded-2xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-xl transition hover:border-white/10"
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
              <span className="rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-0.5 text-[11px] font-mono text-zinc-500">
                {article.reading_time} min read
              </span>
              {article.category_slug && (
                <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-zinc-500">
                  {article.category_slug}
                </span>
              )}
              {article.fact_check_status && (
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-mono ${factCheckStyles[article.fact_check_status] || factCheckStyles.unverified}`}
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
                <Icon name="ChartBar" size={14} />
                {article.view_count}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-mono">
                <Icon name="MessageCircle" size={14} />
                {article.comment_count}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-mono">
                <Icon name="Bookmark" size={14} />
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
            className="rounded-xl border border-white/10 bg-white/[0.02] px-8 py-3 text-sm text-zinc-400 backdrop-blur-xl transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load more articles'}
          </button>
        </div>
      )}
    </main>
  );
}
