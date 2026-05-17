'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { BookmarkButton } from '@/components/BookmarkButton';
import { relativeTime } from '@/lib/dates';
import { useAuthStore } from '@/stores/auth';
import { API } from '@/lib/api';
import type { SavedPost } from '@/lib/api/types';

const PER_PAGE = 20;

export default function SavedPage() {
  const user = useAuthStore((s) => s.user);

  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [empty, setEmpty] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(true);
  const fetchingRef = useRef(false);
  const pageRef = useRef(1);

  const fetchPage = useCallback(async (pageNum: number) => {
    return API.getSaved(pageNum, PER_PAGE);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      fetchingRef.current = true;
      try {
        const data = await fetchPage(1);
        if (cancelled) return;
        const list = data.posts || [];
        setPosts(list);
        pageRef.current = 1;
        hasMoreRef.current = 1 < (data.pagination?.totalPages || 1);
        setEmpty(list.length === 0);
        setLoaded(true);
      } catch {
        if (!cancelled) {
          setPosts([]);
          setEmpty(true);
          setLoaded(true);
        }
      } finally {
        if (!cancelled) fetchingRef.current = false;
      }
    };
    load();
    return () => { cancelled = true; };
  }, [fetchPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (!hasMoreRef.current || fetchingRef.current) return;

        const nextPage = pageRef.current + 1;
        fetchingRef.current = true;
        try {
          const data = await fetchPage(nextPage);
          setPosts((prev) => [...prev, ...(data.posts || [])]);
          pageRef.current = nextPage;
          hasMoreRef.current = nextPage < (data.pagination?.totalPages || 1);
        } catch {
          hasMoreRef.current = false;
        } finally {
          fetchingRef.current = false;
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchPage]);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Bookmarks</h1>
          <p className="text-sm text-zinc-500">@{user?.username ?? '...'}</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Bookmarks</h1>
        <p className="text-sm text-zinc-500">@{user?.username ?? ''}</p>
      </div>

      {empty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/5">
            <Icon name="Bookmark" size={24} className="text-zinc-600" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Save posts for later</h2>
          <p className="text-sm text-zinc-500 max-w-xs">
            Bookmark posts to keep them in one place. No one can see your Bookmarks.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 pb-20">
            {posts.map((post) => {
              const authorInitial = (
                post.author_display_name || post.author_username || '?'
              )[0].toUpperCase();

              return (
                <div
                  key={`${post.id}-${post.saved_at}`}
                  className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-mono text-zinc-400">
                      {authorInitial}
                    </span>
                    <Link
                      href={`/a/${post.author_username.replace(/^a_/, '')}`}
                      className="text-[13px] font-mono text-zinc-400 hover:text-orange-400 transition-colors"
                    >
                      @{post.author_username}
                    </Link>
                    <span className="text-[11px] text-zinc-600">&middot;</span>
                    <span className="text-[11px] text-zinc-600 font-mono" suppressHydrationWarning>
                      {relativeTime(post.saved_at)}
                    </span>
                  </div>

                  <Link href={`/${post.slug}`} className="block group">
                    <h3 className="text-base font-bold text-white mb-1 group-hover:text-orange-400 transition-colors">
                      {post.title}
                    </h3>

                    {post.post_type === 'article' ? (
                      <p className="text-sm text-zinc-400 line-clamp-2 mb-2">
                        {post.intro}
                      </p>
                    ) : post.topItems && post.topItems.length > 0 ? (
                      <div className="mb-2 space-y-0.5">
                        {post.topItems.slice(0, 3).map((item) => (
                          <div key={item.rank} className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-zinc-600 w-4 text-right tabular-nums">
                              {item.rank}
                            </span>
                            <span className="text-sm text-zinc-400 truncate">
                              {item.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-400 line-clamp-2 mb-2">
                        {post.intro}
                      </p>
                    )}

                    {post.category_slug && (
                      <span className="inline-block text-[11px] text-zinc-500 font-mono uppercase mr-2">
                        {post.category_slug}
                      </span>
                    )}
                  </Link>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Icon name="Eye" size={12} className="text-zinc-500" />
                        <span className="font-mono tabular-nums">{post.view_count ?? 0}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="MessageCircle" size={12} className="text-zinc-500" />
                        <span className="font-mono tabular-nums">{post.comment_count ?? 0}</span>
                      </span>
                    </div>
                    <BookmarkButton postId={post.id} initialBookmarked />
                  </div>
                </div>
              );
            })}
          </div>
          <div ref={sentinelRef} className="h-px" />
        </>
      )}
    </div>
  );
}
