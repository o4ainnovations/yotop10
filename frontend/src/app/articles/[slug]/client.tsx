'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { API } from '@/lib/api';
import type { Article } from '@/lib/api/types';
import Link from 'next/link';
import Image from 'next/image';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { BookmarkButton } from '@/components/BookmarkButton';
import { ShareButton } from '@/components/ShareButton';
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

const WORDS_PER_MIN = 265;

export default function ArticleDetailClient() {
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
      .then((data) => { setArticle(data.article); })
      .catch((e) => { setError(e instanceof Error ? e.message : 'Failed to load article'); })
      .finally(() => { setLoading(false); });
  }, [slug]);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-5 py-20 sm:px-6">
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-5 py-20 sm:px-6">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">{error}</div>
        <Link href="/articles" className="mt-6 inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white">
          <Icon name="ArrowLeft" size={14} /> Back to Articles
        </Link>
      </main>
    );
  }

  if (!article) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-5 py-20 sm:px-6">
        <Link href="/articles" className="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white">
          <Icon name="ArrowLeft" size={14} /> Back to Articles
        </Link>
        <p className="mt-12 text-zinc-500">Article not found.</p>
      </main>
    );
  }

  const paragraphs = article.body ? article.body.split('\n\n').filter(Boolean) : [];
  const wordCount = article.body ? article.body.split(/\s+/).filter(Boolean).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / WORDS_PER_MIN));

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-12 sm:px-6 lg:py-16">
      <Breadcrumbs items={[
        { label: 'Home', href: '/' },
        { label: 'Articles', href: '/articles' },
        { label: article.title, href: `/articles/${article.slug}` },
      ]} />

      <article>
        {/* Cover image */}
        {article.cover_image && (
          <div className="relative w-full overflow-hidden rounded-xl mb-10">
            <Image src={article.cover_image} alt={article.title} width={1200} height={630} className="w-full object-cover" priority unoptimized />
          </div>
        )}

        {/* Title */}
        <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl sm:leading-tight lg:text-5xl">
          {article.title}
        </h1>

        {/* Author bar + actions at the top */}
        <div className="flex items-center justify-between mt-6 pb-8 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 text-sm font-bold text-white shrink-0">
              {(article.author_display_name || 'A')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{article.author_display_name}</p>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span suppressHydrationWarning>{relativeTime(article.created_at)}</span>
                <span className="text-zinc-700">&middot;</span>
                <span>{readingTime} min read</span>
                <span className="text-zinc-700">&middot;</span>
                <span className="inline-flex items-center gap-1"><Icon name="Eye" size={12} /> {article.view_count}</span>
              </div>
            </div>
            {article.fact_check_status && article.fact_check_status !== 'unverified' && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-2xs font-mono ${factCheckStyles[article.fact_check_status] || factCheckStyles.unverified}`}>
                <Icon name={article.fact_check_status === 'verified' ? 'ShieldCheck' : 'TriangleAlert'} size={11} />
                {factCheckLabels[article.fact_check_status]}
              </span>
            )}
          </div>
          {/* Bookmark + Share at top */}
          <div className="flex items-center gap-2">
            <BookmarkButton postId={article.id} />
            <ShareButton slug={article.slug} title={article.title} postId={article.id} />
          </div>
        </div>

        {/* Body */}
        <div className="mt-8 space-y-5 sm:space-y-6">
          {paragraphs.map((paragraph, idx) => (
            <p key={idx} className="text-base sm:text-lg leading-relaxed sm:leading-relaxed text-zinc-200">{paragraph}</p>
          ))}
        </div>

        {/* Sources */}
        {article.sources && article.sources.length > 0 && (
          <section className="mt-12 pt-8 border-t border-white/5">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Sources</h2>
            <ul className="space-y-2">
              {article.sources.map((source, idx) => (
                <li key={idx}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 transition">
                    <Icon name="ExternalLink" size={12} /> {source.title || source.url}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Comments section */}
        <section className="mt-10 pt-8 border-t border-white/5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Comments ({article.comment_count})</h2>
          <p className="text-xs text-zinc-600 text-center py-8">
            <Icon name="MessageCircle" size={20} className="mx-auto mb-2 text-zinc-700" />
            Comments are not yet available for articles.
          </p>
        </section>
      </article>
    </main>
  );
}
