'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { API } from '@/lib/api';
import type { Article } from '@/lib/api/types';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/icons/Icon';
import { relativeTime } from '@/lib/dates';

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

export default function ArticleDetailPage() {
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : '';

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    API.getArticle(slug)
      .then((data) => {
        setArticle(data.article);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load article');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-4 py-20 sm:px-6">
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-4 py-20 sm:px-6">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">
          {error}
        </div>
        <Link
          href="/articles"
          className="mt-6 inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white"
        >
          <Icon name="ArrowLeft" size={14} />
          Back to Articles
        </Link>
      </main>
    );
  }

  if (!article) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-4 py-20 sm:px-6">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center backdrop-blur-xl">
          <p className="text-zinc-500">Article not found.</p>
        </div>
        <Link
          href="/articles"
          className="mt-6 inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white"
        >
          <Icon name="ArrowLeft" size={14} />
          Back to Articles
        </Link>
      </main>
    );
  }

  const paragraphs = article.body ? article.body.split('\n\n').filter(Boolean) : [];
  const authorInitial = (article.author_display_name || 'A')[0].toUpperCase();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <Link
        href="/articles"
        className="mb-8 inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white"
      >
        <Icon name="ArrowLeft" size={14} />
        Back to Articles
      </Link>

      <article>
        <header className="mb-10">
          <h1 className="text-3xl font-display text-white sm:text-4xl">{article.title}</h1>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-sm font-bold text-white">
                {authorInitial}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{article.author_display_name}</p>
                <p className="text-xs text-zinc-500">
                  <span className="font-mono">{article.reading_time} min read</span>
                  <span className="mx-1.5 text-zinc-700">&middot;</span>
                  <span suppressHydrationWarning>{relativeTime(article.created_at)}</span>
                </p>
              </div>
            </div>

            {article.fact_check_status && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-mono ${factCheckStyles[article.fact_check_status] || factCheckStyles.unverified}`}
              >
                <Icon
                  name={article.fact_check_status === 'verified' ? 'ShieldCheck' : article.fact_check_status === 'disputed' ? 'TriangleAlert' : 'Info'}
                  size={12}
                />
                {factCheckLabels[article.fact_check_status] || 'Unverified'}
              </span>
            )}
          </div>
        </header>

        {article.cover_image && (
          <div className="relative mb-10 w-full overflow-hidden rounded-xl">
            <Image
              src={article.cover_image}
              alt={article.title}
              width={1200}
              height={600}
              className="w-full object-cover"
              priority
            />
          </div>
        )}

        <div className="space-y-4">
          {paragraphs.map((paragraph, idx) => (
            <p key={idx} className="text-base leading-relaxed text-zinc-300">
              {paragraph}
            </p>
          ))}
        </div>

        {article.sources && article.sources.length > 0 && (
          <section className="mt-12 rounded-2xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-xl">
            <h2 className="mb-4 font-display text-lg text-white">Sources</h2>
            <ul className="space-y-2">
              {article.sources.map((source, idx) => (
                <li key={idx}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-orange-400"
                  >
                    <Icon name="ExternalLink" size={12} />
                    {source.title || source.url}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {article.related_posts && article.related_posts.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 font-display text-lg text-white">Related Posts</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {article.related_posts.map((slug, idx) => (
                <Link
                  key={idx}
                  href={`/${slug}`}
                  className="flex-shrink-0 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-zinc-400 backdrop-blur-xl transition hover:border-white/10 hover:text-white"
                >
                  {slug}
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-12 flex items-center gap-6 border-t border-white/5 pt-6 text-zinc-500">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono">
            <Icon name="ChartBar" size={14} />
            {article.view_count} views
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono">
            <Icon name="MessageCircle" size={14} />
            {article.comment_count} comments
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono">
            <Icon name="Bookmark" size={14} />
            {article.bookmark_count} bookmarks
          </span>
        </div>
      </article>
    </main>
  );
}
