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

  const btnPrimaryClass = 'inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-bold text-white rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-11';
  const btnSecondaryClass = 'inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-bold text-white rounded-xl bg-white/5 border border-white/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-11';

  if (loading) return <div className="p-5 text-white/40">Loading post...</div>;
  if (!postId) return <div className="p-5 text-white/40">Invalid post ID</div>;
  if (!post) return <div className="p-5 text-white/40">Post not found</div>;

  return (
    <div className="space-y-3 sm:space-y-4">
      <button onClick={() => router.push('/admin/posts/pending')} className="bg-transparent border-none text-orange-400 cursor-pointer text-sm p-0 hover:text-orange-300">
        Back to pending posts
      </button>

      <div className="text-2xs font-mono text-zinc-600">
        DOUBLE-BLIND REVIEW — Decisions based on content, not author reputation
      </div>

      <div className="space-y-4 sm:space-y-6 mt-5">
        <div>
          <h1 className="text-white text-xl sm:text-2xl font-bold">{post.title}</h1>
          <p className="text-white/50 text-sm2 mt-1">
            By {post.author_username} | {new Date(post.created_at).toLocaleString()} | {post.post_type}
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-5">
          <h3 className="text-white font-semibold mb-2">Introduction</h3>
          <p className="text-white/60 leading-relaxed">{post.intro}</p>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <h3 className="text-white font-semibold">List Items</h3>
          {post.items.map(item => (
            <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
              <h4 className="text-white font-semibold mb-1.5">#{item.rank} {item.title}</h4>
              <p className="text-white/60 leading-relaxed">{item.justification}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap mt-8">
          <button onClick={handleApprove} disabled={actionLoading} className={btnPrimaryClass}>
            <Icon name="Check" size={16} color="#fff" /> Approve Post
          </button>
          <button onClick={() => setShowRetryModal(true)} disabled={actionLoading} className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-bold text-white rounded-xl bg-orange-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-11 hover:bg-orange-500">
            <Icon name="RefreshCw" size={16} color="#fff" /> Request Revision
          </button>
          <button onClick={() => setShowRejectModal(true)} disabled={actionLoading} className={btnSecondaryClass}>
            <Icon name="X" size={16} color="#ef4444" /> Reject Post
          </button>
        </div>

        {/* Retry Modal */}
        {showRetryModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={() => { setShowRetryModal(false); setRetryGuidance(''); }}>
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-semibold mb-1">Request Revision</h3>
              <p className="text-white/50 text-sm2 mb-3">Send guidance to the author. No trust score penalty.</p>
              <textarea
                value={retryGuidance}
                onChange={(e) => setRetryGuidance(e.target.value)}
                placeholder="Enter guidance for the author (e.g., 'Add more detail to item #3' or 'Fix spelling in the intro')"
                rows={5}
                maxLength={2000}
                className="w-full mb-2.5 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm2 resize-y outline-none placeholder:text-white/30"
              />
              <div className="flex gap-2.5 justify-between items-center">
                <span className="text-xs text-white/30">{retryGuidance.length}/2000</span>
                <div className="flex gap-2.5">
                  <button onClick={() => { setShowRetryModal(false); setRetryGuidance(''); }} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm2 cursor-pointer">Cancel</button>
                  <button onClick={handleRetry} disabled={!retryGuidance.trim() || actionLoading} className={`px-5 py-2 text-white rounded-xl text-sm2 font-bold ${!retryGuidance.trim() || actionLoading ? 'bg-white/10 cursor-not-allowed' : 'bg-orange-600 cursor-pointer hover:bg-orange-500'}`}>
                    Send Guidance
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowRejectModal(false)}>
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-semibold mb-1">Reject Post</h3>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                rows={4}
                className="w-full my-3 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm2 resize-y outline-none placeholder:text-white/30"
              />
              <div className="flex gap-2.5 justify-end">
                <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm2 cursor-pointer">Cancel</button>
                <button onClick={handleReject} disabled={!rejectionReason.trim() || actionLoading} className={`px-5 py-2 text-white rounded-xl text-sm2 font-bold ${!rejectionReason.trim() || actionLoading ? 'bg-white/10 cursor-not-allowed' : 'bg-red-700 cursor-pointer hover:bg-red-600'}`}>
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
