'use client';

import { useEffect, useState } from 'react';
import { API } from '@/lib/api';
import type { SavedPost } from '@/lib/api/types';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/icons/Icon';

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

  const loadMore = () => {
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
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] px-3 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl text-center py-20">
          <p className="text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

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
          <div className="space-y-4">
            {posts.map((post) => (
              <Link key={post.id} href={`/${post.slug}`} className="block group">
                <div className="rounded-2xl border border-white/5 bg-white/5 p-5 backdrop-blur-sm transition hover:border-white/10">
                  {post.hero_image_url && (
                    <div className="mb-3 overflow-hidden rounded-xl">
                      <Image src={post.hero_image_url} alt="" width={1200} height={675} className="w-full h-auto" unoptimized />
                    </div>
                  )}
                  <h2 className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">{post.title}</h2>
                  <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                    <span>{post.author_display_name}</span>
                    <span className="flex items-center gap-1"><Icon name="MessageCircle" size={12} /> {post.comment_count}</span>
                    <span className="flex items-center gap-1"><Icon name="Eye" size={13} /> {post.view_count}</span>
                  </div>
                </div>
              </Link>
            ))}
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
