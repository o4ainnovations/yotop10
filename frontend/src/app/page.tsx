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
        backgroundColor: '#0b0d17',
        color: '#e2e8f0',
        fontFamily: 'var(--font-geist-sans), sans-serif',
      }}
    >
      {/* Brand Mark */}
      <header
        style={{
          padding: '40px 20px 32px',
          textAlign: 'center',
          borderBottom: '3px solid #ff2d78',
        }}
      >
        <div
          style={{
            fontSize: '42px',
            fontWeight: '900',
            letterSpacing: '6px',
            color: '#ff2d78',
            marginBottom: '8px',
          }}
        >
          Y O T O P 1 0
        </div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 'bold',
            letterSpacing: '3px',
            color: '#94a3b8',
            marginBottom: '24px',
          }}
        >
          F A C T &nbsp; M I N E . &nbsp; D E B A T E &nbsp; G R O U N D .
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <Link
            href="/submit"
            style={{
              padding: '12px 28px',
              backgroundColor: '#ff2d78',
              color: '#fff',
              border: '2px solid #ff2d78',
              fontSize: '14px',
              fontWeight: 'bold',
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            + Submit a List
          </Link>
          <Link
            href="/categories"
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              color: '#00d4aa',
              border: '2px solid #00d4aa',
              fontSize: '14px',
              fontWeight: 'bold',
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '1px',
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
          gap: '16px',
          padding: '12px 20px',
          borderBottom: '1px solid #1e293b',
        }}
      >
        {(['newest', 'most_viewed', 'most_commented'] as const).map((s) => (
          <button
            key={s}
            onClick={() => handleSortChange(s)}
            style={{
              background: 'none',
              border: 'none',
              color: sort === s ? '#ff2d78' : '#64748b',
              fontSize: '12px',
              fontWeight: sort === s ? 'bold' : 'normal',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '4px 0',
              borderBottom: sort === s ? '2px solid #ff2d78' : '2px solid transparent',
            }}
          >
            {s === 'newest' ? 'Newest' : s === 'most_viewed' ? 'Most Viewed' : 'Most Commented'}
          </button>
        ))}
      </div>

      {/* Feed */}
      <main style={{ padding: '20px', maxWidth: '1100px', margin: '0 auto' }}>
        {loading && posts.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
            <p style={{ fontSize: '14px' }}>Loading the debate wall...</p>
          </div>
        ) : posts.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
            <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#94a3b8', marginBottom: '8px' }}>
              The wall is empty
            </p>
            <p style={{ fontSize: '14px' }}>
              No approved posts yet. Be the first to submit a list.
            </p>
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
                <div
                  key={post.id}
                  style={
                    post.post_type === 'counter_list'
                      ? { borderLeft: '3px solid #00d4aa', paddingLeft: '0' }
                      : {}
                  }
                >
                  <PostCard post={post} />
                </div>
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
        <p style={{ margin: '0 0 8px' }}>
          Submit a list &middot; Browse all categories &middot;{' '}
          <Link href="/search" style={{ color: '#00d4aa', textDecoration: 'none' }}>Search</Link>
        </p>
        <p style={{ margin: 0 }}>YoTop10 &mdash; Open Platform for Ranked Lists</p>
      </footer>
    </div>
  );
}
