'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { relativeTime } from '@/lib/dates';
import type { ExplorePost } from '@/lib/api/types';
import { API } from '@/lib/api';
import { FeedSkeleton } from '@/components/Skeleton';

const PER_PAGE = 20;

type TabValue = 'all' | 'list' | 'vs' | 'article';

const TABS: { value: TabValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'list', label: 'Top Lists' },
  { value: 'vs', label: 'VS Battles' },
  { value: 'article', label: 'Articles' },
];

const POST_TYPE_MAP: Record<TabValue, string | null> = {
  all: null,
  list: 'list',
  vs: 'vs',
  article: 'article',
};

export default function ExplorePage() {
  const [allPosts, setAllPosts] = useState<ExplorePost[]>([]);
  const [tab, setTab] = useState<TabValue>('all');
  const [loaded, setLoaded] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(true);
  const fetchingRef = useRef(false);
  const pageRef = useRef(1);

  const filteredPosts = tab === 'all'
    ? allPosts
    : allPosts.filter((p) => p.post_type === POST_TYPE_MAP[tab]);

  const fetchExplorePage = useCallback(async (pageNum: number) => {
    return API.getExplore(pageNum, PER_PAGE);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      fetchingRef.current = true;
      try {
        const data = await fetchExplorePage(1);
        if (cancelled) return;
        setAllPosts(data.posts || []);
        pageRef.current = 1;
        hasMoreRef.current = 1 < (data.pagination?.totalPages || 1);
        setLoaded(true);
      } catch {
        if (!cancelled) {
          setAllPosts([]);
          setLoaded(true);
        }
      } finally {
        if (!cancelled) fetchingRef.current = false;
      }
    };
    load();
    return () => { cancelled = true; };
  }, [fetchExplorePage]);

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
          const data = await fetchExplorePage(nextPage);
          setAllPosts((prev) => [...prev, ...(data.posts || [])]);
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
  }, [fetchExplorePage]);

  if (!loaded) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl text-white mb-1">Explore</h1>
          <p className="text-zinc-500 text-sm">Algorithmic feed. What&apos;s rising.</p>
        </div>
        <FeedSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-white mb-1">Explore</h1>
        <p className="text-zinc-500 text-sm">Algorithmic feed. What&apos;s rising.</p>
      </div>

      <div className="flex gap-0 mb-8 border-b border-white/5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
              tab === t.value
                ? 'text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
            {tab === t.value && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-600" />
            )}
          </button>
        ))}
      </div>

      {filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/5">
            <Icon name="Compass" size={24} className="text-zinc-600" />
          </div>
          <p className="text-zinc-500 text-sm">No trending content yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-20">
            {filteredPosts.map((post) => (
              <Link
                key={post.id}
                href={`/${post.slug}`}
                className="block group"
              >
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-2xl p-4 transition hover:border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-orange-400 tabular-nums">
                      Score: {post.explore_score ?? 0}
                    </span>
                    {post.category_slug && (
                      <span className="text-[11px] text-zinc-500 font-mono uppercase">
                        {post.category_slug}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-white line-clamp-2 mb-2 group-hover:text-orange-400 transition-colors">
                    {post.title}
                  </h3>

                  {post.topItems && post.topItems.length > 0 && (
                    <div className="mb-3 space-y-0.5">
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
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-mono text-zinc-500">
                      {post.author_display_name || post.author_username}
                    </span>
                    <span className="text-zinc-600">&middot;</span>
                    <span className="text-xs font-mono text-zinc-600" suppressHydrationWarning>
                      {relativeTime(post.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Icon name="Eye" size={12} />
                      <span className="font-mono tabular-nums">{post.view_count ?? 0}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="MessageCircle" size={12} />
                      <span className="font-mono tabular-nums">{post.comment_count ?? 0}</span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div ref={sentinelRef} className="h-px" />
        </>
      )}
    </div>
  );
}
