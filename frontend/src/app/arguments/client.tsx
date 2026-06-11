'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { ArgumentCard } from '@/components/ArgumentCard';
import type { ArgumentPost, Category } from '@/lib/api/types';
import { API } from '@/lib/api';

const PER_PAGE = 20;

const TIME_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
] as const;

interface ArgumentsClientProps {
  initialPosts: ArgumentPost[];
  initialCategories: Category[];
  initialHasMore: boolean;
}

export default function ArgumentsClient({ initialPosts, initialCategories, initialHasMore }: ArgumentsClientProps) {
  const [posts, setPosts] = useState<ArgumentPost[]>(initialPosts);
  const [time, setTime] = useState<string>('all');
  const [category, setCategory] = useState<string>('');
  const categories = initialCategories;

  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(initialHasMore);
  const fetchingRef = useRef(false);
  const pageRef = useRef(1);

  const fetchArguments = useCallback(
    async (pageNum: number, t: string, cat: string) => {
      return API.getArguments({
        page: pageNum,
        limit: PER_PAGE,
        time: t !== 'all' ? t : undefined,
        category: cat || undefined,
      });
    },
    []
  );

  const resetFeed = useCallback(
    async (t: string, cat: string) => {
      fetchingRef.current = true;
      try {
        const data = await fetchArguments(1, t, cat);
        setPosts(data.arguments || []);
        pageRef.current = 1;
        hasMoreRef.current = 1 < (data.pagination?.totalPages || 1);
      } catch {
        setPosts([]);
        hasMoreRef.current = false;
      } finally {
        fetchingRef.current = false;
      }
    },
    [fetchArguments]
  );

  useEffect(() => {
    resetFeed(time, category);
  }, [time, category, resetFeed]);

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
          const data = await fetchArguments(nextPage, time, category);
          setPosts((prev) => [...prev, ...(data.arguments || [])]);
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
  }, [time, category, fetchArguments]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-white mb-1">Arguments</h1>
        <p className="text-zinc-500 text-sm">The hottest debates happening right now</p>
      </div>

      <div className="flex gap-3 mb-8">
        <select
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-lg px-3 py-2 text-sm text-zinc-400 outline-none focus:border-white/10 transition-colors appearance-none min-h-11"
        >
          {TIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-300">
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-lg px-3 py-2 text-sm text-zinc-400 outline-none focus:border-white/10 transition-colors appearance-none min-h-11"
        >
          <option value="" className="bg-zinc-900 text-zinc-300">
            All Categories
          </option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.slug} className="bg-zinc-900 text-zinc-300">
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 backdrop-blur-xl border border-white/5">
            <Icon name="MessageSquare" size={24} className="text-zinc-600" />
          </div>
          <p className="text-zinc-500 text-sm max-w-sm">
            No active debates right now. Start one by submitting a This vs That or countering an existing list.
          </p>
          <Link
            href="/new"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-red-600 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            <Icon name="Plus" size={14} />
            Start a Debate
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4 pb-20">
            {posts.map((post) => (
              <ArgumentCard key={post.id} argument={post} />
            ))}
          </div>
          <div ref={sentinelRef} className="h-px" />
        </>
      )}
    </div>
  );
}
