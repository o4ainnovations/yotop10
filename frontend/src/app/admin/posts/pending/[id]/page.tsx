'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface PendingPost {
  _id: string;
  title: string;
  author_username: string;
  post_type: string;
  intro: string;
  items: Array<{
    id: string;
    rank: number;
    title: string;
    justification: string;
  }>;
  created_at: string;
}

export default function AdminPendingPostPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;

  const [post, setPost] = useState<PendingPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [retryGuidance, setRetryGuidance] = useState('');
  const [showRetryModal, setShowRetryModal] = useState(false);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;

    const fetchPost = async () => {
      try {
        const data = await apiFetch<{ post: PendingPost }>(`/admin/posts/pending/${postId}`);
        if (!cancelled) {
          setPost(data.post);
        }
      } catch {
        if (!cancelled) console.error('Failed to fetch pending post');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPost();
    return () => { cancelled = true; };
  }, [postId]);

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await apiFetch(`/admin/posts/${postId}/approve`, {
        method: 'PATCH'
      });
      router.push('/admin/posts/pending');
    } catch (error) {
      console.error('Failed to approve post:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    
    setActionLoading(true);
    try {
      await apiFetch(`/admin/posts/${postId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: rejectionReason })
      });
      router.push('/admin/posts/pending');
    } catch (error) {
      console.error('Failed to reject post:', error);
    } finally {
      setActionLoading(false);
      setShowRejectModal(false);
    }
  };

  const handleRetry = async () => {
    if (!retryGuidance.trim()) return;

    setActionLoading(true);
    setActionMessage('');
    try {
      await apiFetch(`/admin/posts/${postId}/retry`, {
        method: 'POST',
        body: JSON.stringify({ guidance: retryGuidance })
      });
      setActionMessage('Revision guidance sent. Post remains in queue.');
      setRetryGuidance('');
      setShowRetryModal(false);
    } catch (error) {
      console.error('Failed to request revision:', error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div>Loading post...</div>;
  if (!postId) return <div>Invalid post ID</div>;
  if (!post) return <div>Post not found</div>;

  return (
    <div>
      <button onClick={() => router.push('/admin/posts/pending')}>← Back to pending posts</button>
      
      <div style={{ marginTop: '20px' }}>
        <h1>{post.title}</h1>
        <p style={{ color: '#666' }}>
          By {post.author_username} | {new Date(post.created_at).toLocaleString()} | {post.post_type}
        </p>
        
        <div style={{ marginTop: '20px' }}>
          <h3>Introduction</h3>
          <p>{post.intro}</p>
        </div>

        <div style={{ marginTop: '30px' }}>
          <h3>List Items</h3>
          {post.items.map(item => (
            <div key={item.id} style={{ marginBottom: '20px', padding: '10px', borderBottom: '1px solid #eee' }}>
              <h4>#{item.rank} {item.title}</h4>
              <p>{item.justification}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '40px', display: 'flex', gap: '20px' }}>
          <button onClick={handleApprove} disabled={actionLoading} style={{ fontSize: '16px', padding: '10px 20px' }}>
            ✅ Approve Post
          </button>
          <button onClick={() => setShowRetryModal(true)} disabled={actionLoading} style={{ fontSize: '16px', padding: '10px 20px', backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: actionLoading ? 'not-allowed' : 'pointer' }}>
            🔄 Request Revision
          </button>
          <button onClick={() => setShowRejectModal(true)} disabled={actionLoading} style={{ fontSize: '16px', padding: '10px 20px' }}>
            ❌ Reject Post
          </button>
        </div>

        {actionMessage && (
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e8f5e9', border: '1px solid #4caf50', borderRadius: '5px', color: '#2e7d32' }}>
            {actionMessage}
          </div>
        )}

        {showRetryModal && (
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', padding: '20px', border: '1px solid #ccc', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 100 }}>
            <h3>Request Revision</h3>
            <p style={{ color: '#666', marginBottom: '10px' }}>Send guidance to the author. No trust score penalty.</p>
            <textarea
              value={retryGuidance}
              onChange={(e) => setRetryGuidance(e.target.value)}
              placeholder="Enter guidance for the author (e.g., 'Add more detail to item #3' or 'Fix spelling in the intro')"
              rows={5}
              maxLength={2000}
              style={{ width: '450px', margin: '10px 0', padding: '8px' }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#999' }}>{retryGuidance.length}/2000</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => { setShowRetryModal(false); setRetryGuidance(''); }}>Cancel</button>
                <button onClick={handleRetry} disabled={!retryGuidance.trim() || actionLoading} style={{ backgroundColor: '#ff9800', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px' }}>
                  Send Guidance
                </button>
              </div>
            </div>
          </div>
        )}

        {showRejectModal && (
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', padding: '20px', border: '1px solid #ccc', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <h3>Reject Post</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              style={{ width: '400px', margin: '10px 0' }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button onClick={handleReject} disabled={!rejectionReason.trim() || actionLoading}>
                Confirm Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
