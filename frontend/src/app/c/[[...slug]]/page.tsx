'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { API, SingleCategoryResponse, PostsResponse } from '@/lib/api';
import { DataCard } from '@/components/DataCard';
import NotFound from '@/components/NotFound';
import { Icon } from '@/components/icons/Icon';
import type { Post } from '@/lib/api/types';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  post_count: number;
  children: Array<{ id: string; name: string; slug: string; post_count: number }>;
}

export default function CategoryFeedPage() {
  const params = useParams();
  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam.join('/') : slugParam as string;

  const [category, setCategory] = useState<Category | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    Promise.all([
      API.getCategory(slug).then((data: SingleCategoryResponse) => data.category),
      API.getPosts({ category: slug, page: 1, limit: 20 }).then((data: PostsResponse) => data),
    ])
      .then(([catData, postsData]) => {
        if (cancelled) return;
        setCategory(catData);
        setPosts(postsData.posts || []);
        setHasMore((postsData.pagination?.totalPages ?? 1) > 1);
      })
      .catch(() => {
        if (!cancelled) setCategory(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [slug]);

  const loadMore = () => {
    setLoadingMore(true);
    const nextPage = page + 1;

    API.getPosts({ category: slug, page: nextPage, limit: 20 })
      .then((data: PostsResponse) => {
        setPosts((prev) => [...prev, ...(data.posts || [])]);
        setPage(nextPage);
        setHasMore(data.pagination?.page ? data.pagination.page < (data.pagination.totalPages || 1) : false);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (!category) return <NotFound message="Category does not exist." />;

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="flex items-center gap-2 px-3 pt-6 sm:px-6">
        <Link href="/" className="text-[13px] font-bold text-orange-400 transition hover:text-orange-300">
          YOTOP10
        </Link>
        <span className="text-[13px] text-zinc-600">/</span>
        <Link href="/categories" className="text-[13px] text-zinc-500 transition hover:text-zinc-300">
          Categories
        </Link>
        <span className="text-[13px] text-zinc-600">/</span>
        <span className="text-[13px] font-bold text-orange-400">
          {category.name}
        </span>
      </div>

      <div className="px-3 pb-4 pt-5 sm:px-6">
        <h1 className="mb-1 text-2xl font-bold text-white sm:text-3xl">
          {category.name}
        </h1>
        {category.description && (
          <p className="mb-2 text-sm text-zinc-400 sm:text-base">
            {category.description}
          </p>
        )}
        <p className="text-xs text-zinc-600">
          {category.post_count} posts
        </p>

        {category.children.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {category.children.map((child) => (
              <Link
                key={child.id}
                href={`/c/${child.slug}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs capitalize text-zinc-400 transition hover:border-orange-500/30 hover:text-orange-400"
              >
                {child.name}
                <span className="text-[11px] text-zinc-600">({child.post_count})</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <main className="mx-auto max-w-3xl px-3 pb-20 sm:px-4">
        {posts.length === 0 ? (
          <div className="py-16 text-center sm:py-20">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 sm:h-16 sm:w-16">
              <Icon name="FileText" size={24} className="text-zinc-600 sm:size-7" />
            </div>
            <p className="mb-6 text-sm text-zinc-500">No posts yet in this category.</p>
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40"
            >
              <Icon name="Plus" size={16} />
              Submit a List
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3 pt-2 sm:space-y-4 sm:pt-4">
              {posts.map((post) => (
                <DataCard key={post.id} post={post} />
              ))}
            </div>

            {hasMore && (
              <div className="pt-6 text-center sm:pt-8">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full max-w-sm rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-zinc-400 backdrop-blur-sm transition hover:border-orange-500/30 hover:text-orange-400 disabled:opacity-30"
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-white/5 px-4 py-6 text-center sm:px-6 sm:py-8">
        <p className="text-[11px] text-zinc-600 sm:text-xs">
          <Link href="/" className="text-orange-400 transition hover:text-orange-300">Home</Link>
          <span className="mx-2">&middot;</span>
          <Link href="/categories" className="text-orange-400 transition hover:text-orange-300">All Categories</Link>
          <span className="mx-2">&middot;</span>
          <Link href="/submit" className="text-orange-400 transition hover:text-orange-300">Submit</Link>
        </p>
      </footer>
    </div>
  );
}
