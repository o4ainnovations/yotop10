'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { API } from '@/lib/api';
import { PostCard } from '@/components/PostCard';
import { CategoryBar } from '@/components/CategoryBar';
import type { Post } from '@/lib/api/types';

const POSTS_PER_PAGE = 20;

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<'newest' | 'most_viewed' | 'most_commented'>('newest');

  const fetchPosts = useCallback(async (pageNum: number, append: boolean, _sortMode: string) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await API.getPosts({
        page: pageNum,
        limit: POSTS_PER_PAGE,
      }) as { posts: Post[]; pagination?: { totalPages: number } };

      const fetched = data.posts || [];

      if (append) {
        setPosts((prev) => [...prev, ...fetched]);
      } else {
        setPosts(fetched);
      }

      const totalPages = data.pagination?.totalPages || 1;
      setHasMore(pageNum < totalPages);
    } catch {
      /* feed failed — show what we have */
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts(1, false, sort);
  }, [sort, fetchPosts]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, true, sort);
  };

  const handleSortChange = (newSort: 'newest' | 'most_viewed' | 'most_commented') => {
    setSort(newSort);
    setPage(1);
    setPosts([]);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-geist-sans), sans-serif',
      }}
    >
      {/* Brand Mark */}
      <header
        style={{
          padding: '48px 24px 32px',
          textAlign: 'center',
          borderBottom: '2px solid var(--border-primary)',
        }}
      >
        <div
          style={{
            fontSize: '42px',
            fontWeight: 900,
            letterSpacing: '6px',
            background: 'var(--accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '8px',
            lineHeight: 1.1,
          }}
        >
          Y O T O P 1 0
        </div>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '3px',
            color: 'var(--text-muted)',
            marginBottom: '24px',
          }}
        >
          F A C T &nbsp; M I N E . &nbsp; D E B A T E &nbsp; G R O U N D .
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <Link
            href="/submit"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 28px',
              background: 'var(--accent-gradient)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              boxShadow: '0 2px 8px rgba(255,59,48,0.3)',
              transition: 'all var(--transition)',
            }}
          >
            + Submit a List
          </Link>
          <Link
            href="/categories"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 28px',
              background: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              transition: 'all var(--transition)',
            }}
          >
            Browse Categories
          </Link>
        </div>
      </header>

      {/* Category Bar */}
      <CategoryBar />

      {/* Sort Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '20px',
          padding: '14px 24px',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        {(['newest', 'most_viewed', 'most_commented'] as const).map((s) => (
          <button
            key={s}
            onClick={() => handleSortChange(s)}
            style={{
              background: 'none',
              border: 'none',
              color: sort === s ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: sort === s ? 600 : 400,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              padding: '4px 0',
              borderBottom: sort === s ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'color var(--transition), border-color var(--transition)',
            }}
          >
            {s === 'newest' ? 'Newest' : s === 'most_viewed' ? 'Most Viewed' : 'Most Commented'}
          </button>
        ))}
      </div>

      {/* Feed */}
      <main style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
        {loading && posts.length === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Loading the wall...
            </p>
          </div>
        ) : posts.length === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              The wall is empty
            </p>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              No approved posts yet. Be the first to submit a list.
            </p>
            <Link
              href="/submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 28px',
                background: 'var(--accent-gradient)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                boxShadow: '0 2px 8px rgba(255,59,48,0.3)',
                transition: 'all var(--transition)',
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
                gap: '16px',
              }}
            >
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            {hasMore && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    width: '100%',
                    maxWidth: '400px',
                    padding: '14px',
                    background: 'transparent',
                    color: loadingMore ? 'var(--text-muted)' : 'var(--accent)',
                    border: `1.5px solid ${loadingMore ? 'var(--border-primary)' : 'var(--accent)'}`,
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    cursor: loadingMore ? 'not-allowed' : 'pointer',
                    transition: 'all var(--transition)',
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
          borderTop: '1px solid var(--border-primary)',
          padding: '24px 24px 36px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '12px',
        }}
      >
        <p style={{ margin: '0 0 8px' }}>
          Submit a list &middot; Browse all categories &middot;{' '}
          <Link href="/search" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Search</Link>
        </p>
        <p style={{ margin: 0 }}>YoTop10 &mdash; Open Platform for Ranked Lists</p>
      </footer>
    </div>
  );
}
