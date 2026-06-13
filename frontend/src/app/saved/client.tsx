'use client';

import { useEffect, useState, useCallback } from 'react';
import { API } from '@/lib/api';
import type { SavedPost } from '@/lib/api/types';
import Link from 'next/link';
import { SavedSkeleton } from '@/components/SavedSkeleton';
import { Icon } from '@/components/icons/Icon';
import { BookmarkButton } from '@/components/BookmarkButton';

export default function SavedClient() {
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    API.getSaved(1, 20)
      .then((data) => {
        if (cancelled) return;
        setPosts(data.posts || []);
        setHasMore(1 < (data.pagination?.totalPages || 1));
      })
      .catch(() => { if (!cancelled) setError('Failed to load saved posts.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setLoadingMore(true);
    API.getSaved(nextPage, 20)
      .then((data) => {
        setPosts((prev) => [...prev, ...(data.posts || [])]);
        setPage(nextPage);
        setHasMore(nextPage < (data.pagination?.totalPages || 1));
      })
      .catch(() => setError('Failed to load more.'))
      .finally(() => setLoadingMore(false));
  }, [page]);

  if (loading) return <SavedSkeleton />;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-3 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        {error && <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>}
        <h1 className="mb-8 text-2xl font-bold text-white sm:text-3xl">Saved</h1>

        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
              <Icon name="Bookmark" size={24} className="text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500">No saved posts yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {posts.map((post) => {
              const isArticle = post.post_type === 'article';
              const href = isArticle ? `/articles/${post.slug}` : `/${post.slug}`;
              return (
                <div key={post.id} className="group flex items-start gap-3 py-4">
                  <Link href={href} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-3xs text-zinc-600 mb-1">
                      <Icon name={isArticle ? 'FileText' : 'List'} size={11} />
                      <span className="uppercase tracking-wider">{isArticle ? 'Article' : (post.post_type || 'List')}</span>
                      {post.reading_time && <span>· {post.reading_time} min read</span>}
                      <span>· {new Date(post.saved_at).toLocaleDateString()}</span>
                    </div>
                    <h2 className="text-sm font-semibold text-zinc-200 leading-snug group-hover:text-white transition-colors line-clamp-2">
                      {post.title}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5 text-3xs text-zinc-600">
                      <span>@{post.author_username}</span>
                      <span className="flex items-center gap-1"><Icon name="MessageCircle" size={10} /> {post.comment_count}</span>
                      <span className="flex items-center gap-1"><Icon name="Eye" size={11} /> {post.view_count}</span>
                    </div>
                  </Link>
                  <div className="shrink-0 pt-0.5" onClick={e => e.stopPropagation()}>
                    <BookmarkButton postId={post.id} initialBookmarked contentType={isArticle ? 'article' : 'post'} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div className="mt-8 text-center">
            <button onClick={loadMore} disabled={loadingMore}
              className="rounded-xl border border-white/10 bg-white/5 px-8 py-3 text-sm text-zinc-400 transition hover:border-white/20 hover:text-white disabled:opacity-50">
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
