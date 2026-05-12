'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { API, SingleCategoryResponse, PostsResponse } from '@/lib/api';
import { PostCard } from '@/components/PostCard';
import { CategoryBar } from '@/components/CategoryBar';
import NotFound from '@/components/NotFound';
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
      <div style={{ minHeight: '100vh', backgroundColor: '#0b0d17', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading...</p>
      </div>
    );
  }

  if (!category) return <NotFound message="Category does not exist." />;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0b0d17', color: '#e2e8f0' }}>
      {/* Header */}
      <header style={{ padding: '24px 20px 0', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <Link href="/" style={{ fontSize: '13px', color: '#00d4aa', textDecoration: 'none', fontWeight: 'bold' }}>
          YOTOP10
        </Link>
        <span style={{ color: '#334155' }}>/</span>
        <Link href="/categories" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none' }}>
          Categories
        </Link>
        <span style={{ color: '#334155' }}>/</span>
        <span style={{ fontSize: '13px', color: '#ff2d78', fontWeight: 'bold' }}>
          {category.name}
        </span>
      </header>

      {/* Category Info */}
      <div style={{ padding: '20px 20px 16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#f1f5f9', margin: '0 0 4px 0' }}>
          {category.name}
        </h1>
        {category.description && (
          <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 8px 0' }}>
            {category.description}
          </p>
        )}
        <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
          {category.post_count} posts
        </p>

        {category.children.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
            {category.children.map((child) => (
              <Link
                key={child.id}
                href={`/c/${child.slug}`}
                style={{
                  fontSize: '12px',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  padding: '4px 10px',
                  textDecoration: 'none',
                  textTransform: 'capitalize',
                }}
              >
                {child.name} ({child.post_count})
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Category Bar */}
      <CategoryBar active={slug} />

      {/* Feed */}
      <main style={{ padding: '20px', maxWidth: '1100px', margin: '0 auto' }}>
        {posts.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
            <p style={{ fontSize: '14px' }}>No posts yet in this category.</p>
            <Link
              href="/submit"
              style={{
                display: 'inline-block',
                marginTop: '16px',
                padding: '12px 24px',
                backgroundColor: '#ff2d78',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 'bold',
                textDecoration: 'none',
                textTransform: 'uppercase',
                border: '2px solid #ff2d78',
              }}
            >
              Submit a List
            </Link>
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
                gap: '12px',
              }}
            >
              {posts.map((post) => (
                <div key={post.id}>
                  <PostCard post={post} />
                </div>
              ))}
            </div>

            {hasMore && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{
                    width: '100%',
                    maxWidth: '400px',
                    padding: '14px',
                    backgroundColor: 'transparent',
                    color: loadingMore ? '#334155' : '#b8ff3d',
                    border: `2px solid ${loadingMore ? '#334155' : '#b8ff3d'}`,
                    fontSize: '14px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    cursor: loadingMore ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '2px solid #1e293b',
          padding: '24px 20px',
          textAlign: 'center',
          color: '#475569',
          fontSize: '12px',
        }}
      >
        <p style={{ margin: 0 }}>
          <Link href="/" style={{ color: '#00d4aa', textDecoration: 'none' }}>Home</Link>
          &nbsp;&middot;&nbsp;
          <Link href="/categories" style={{ color: '#00d4aa', textDecoration: 'none' }}>All Categories</Link>
          &nbsp;&middot;&nbsp;
          <Link href="/submit" style={{ color: '#00d4aa', textDecoration: 'none' }}>Submit</Link>
        </p>
      </footer>
    </div>
  );
}
