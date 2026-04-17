'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface PendingPost {
  _id: string;
  title: string;
  author_username: string;
  category_id: string;
  post_type: string;
  created_at: string;
  status: string;
}

interface PendingPostsResponse {
  posts: PendingPost[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function AdminPendingPostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchPendingPosts = async () => {
      try {
        const response = await apiFetch<PendingPostsResponse>(`/admin/posts/pending?page=${page}`);
        setPosts(response.posts);
        setPagination({
          total: response.pagination.total,
          pages: response.pagination.pages
        });
      } catch (error) {
        console.error('Failed to fetch pending posts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingPosts();
  }, [page]);

  const handleApprove = async (postId: string) => {
    setActionLoading(postId);
    try {
      await apiFetch(`/admin/posts/${postId}/approve`, {
        method: 'PATCH'
      });
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch (error) {
      console.error('Failed to approve post:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (postId: string) => {
    setActionLoading(postId);
    try {
      await apiFetch(`/admin/posts/${postId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: 'Rejected via admin queue' })
      });
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch (error) {
      console.error('Failed to reject post:', error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div>Loading pending posts...</div>;

  return (
    <div>
      <h2>Pending Posts Review Queue</h2>
      <p>Total pending: {pagination.total}</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ccc' }}>
            <th style={{ textAlign: 'left', padding: '8px' }}>Title</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>Author</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>Type</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>Submitted</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {posts.map(post => (
            <tr key={post._id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px' }}>
                <button
                  onClick={() => router.push(`/admin/posts/pending/${post._id}`)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  {post.title}
                </button>
              </td>
              <td style={{ padding: '8px' }}>{post.author_username}</td>
              <td style={{ padding: '8px' }}>{post.post_type}</td>
              <td style={{ padding: '8px' }}>{new Date(post.created_at).toLocaleString()}</td>
              <td style={{ padding: '8px' }}>
                <button
                  onClick={() => handleApprove(post._id)}
                  disabled={actionLoading === post._id}
                  style={{ marginRight: '10px' }}
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(post._id)}
                  disabled={actionLoading === post._id}
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {posts.length === 0 && (
        <div style={{ marginTop: '40px', textAlign: 'center', color: '#666' }}>
          No pending posts to review
        </div>
      )}

      <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Previous
        </button>
        <span>Page {page} of {pagination.pages}</span>
        <button
          onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
          disabled={page >= pagination.pages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
