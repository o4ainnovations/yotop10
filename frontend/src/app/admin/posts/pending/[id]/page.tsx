'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Icon } from '@/components/icons/Icon';
import { toast } from '@/lib/toast';

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
    try {
      await apiFetch(`/admin/posts/${postId}/retry`, {
        method: 'POST',
        body: JSON.stringify({ guidance: retryGuidance })
      });
      toast.success('Guidance sent. Post remains in queue.');
      setRetryGuidance('');
      setShowRetryModal(false);
    } catch (error) {
      console.error('Failed to request revision:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const modalOverlay: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const modalBox: React.CSSProperties = { background: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius-lg)', minWidth: '400px', maxWidth: '520px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-primary)' };

  const btnSecondary: React.CSSProperties = {
    padding: '10px 20px',
    fontSize: '14px',
    cursor: 'pointer',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontWeight: 'bold',
  };

  const btnPrimary: React.CSSProperties = {
    ...btnSecondary,
    background: 'var(--accent-gradient)',
    color: '#fff',
    border: 'none',
  };

  if (loading) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Loading post...</div>;
  if (!postId) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Invalid post ID</div>;
  if (!post) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Post not found</div>;

  return (
    <div>
      <button onClick={() => router.push('/admin/posts/pending')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', padding: 0 }}>
        Back to pending posts
      </button>

      <div style={{ marginTop: '20px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '24px' }}>{post.title}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          By {post.author_username} | {new Date(post.created_at).toLocaleString()} | {post.post_type}
        </p>

        <div style={{ marginTop: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <h3 style={{ color: 'var(--text-primary)', margin: '0 0 8px' }}>Introduction</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{post.intro}</p>
        </div>

        <div style={{ marginTop: '24px' }}>
          <h3 style={{ color: 'var(--text-primary)', margin: '0 0 12px' }}>List Items</h3>
          {post.items.map(item => (
            <div key={item.id} style={{ marginBottom: '16px', padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ color: 'var(--text-primary)', margin: '0 0 6px' }}>#{item.rank} {item.title}</h4>
              <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{item.justification}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '32px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <button onClick={handleApprove} disabled={actionLoading} style={btnPrimary}>
            <Icon name="Check" size={16} color="#fff" /> Approve Post
          </button>
          <button onClick={() => setShowRetryModal(true)} disabled={actionLoading} style={{ ...btnSecondary, background: actionLoading ? 'var(--border-primary)' : '#ff9800', color: '#fff', border: 'none' }}>
            <Icon name="RefreshCw" size={16} color="#fff" /> Request Revision
          </button>
          <button onClick={() => setShowRejectModal(true)} disabled={actionLoading} style={btnSecondary}>
            <Icon name="X" size={16} color="#c62828" /> Reject Post
          </button>
        </div>

        {showRetryModal && (
          <div style={modalOverlay} onClick={() => { setShowRetryModal(false); setRetryGuidance(''); }}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <h3 style={{ color: 'var(--text-primary)', margin: '0 0 4px' }}>Request Revision</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '13px' }}>Send guidance to the author. No trust score penalty.</p>
              <textarea
                value={retryGuidance}
                onChange={(e) => setRetryGuidance(e.target.value)}
                placeholder="Enter guidance for the author (e.g., 'Add more detail to item #3' or 'Fix spelling in the intro')"
                rows={5}
                maxLength={2000}
                style={{ width: '100%', margin: '0 0 10px', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{retryGuidance.length}/2000</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setShowRetryModal(false); setRetryGuidance(''); }} style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px' }}>Cancel</button>
                  <button onClick={handleRetry} disabled={!retryGuidance.trim() || actionLoading} style={{ background: !retryGuidance.trim() || actionLoading ? 'var(--border-primary)' : '#ff9800', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 'var(--radius-sm)', cursor: !retryGuidance.trim() || actionLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                    Send Guidance
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showRejectModal && (
          <div style={modalOverlay} onClick={() => setShowRejectModal(false)}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <h3 style={{ color: 'var(--text-primary)', margin: '0 0 4px' }}>Reject Post</h3>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                rows={4}
                style={{ width: '100%', margin: '12px 0', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowRejectModal(false)} style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px' }}>Cancel</button>
                <button onClick={handleReject} disabled={!rejectionReason.trim() || actionLoading} style={{ background: !rejectionReason.trim() || actionLoading ? 'var(--border-primary)' : '#c62828', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 'var(--radius-sm)', cursor: !rejectionReason.trim() || actionLoading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
