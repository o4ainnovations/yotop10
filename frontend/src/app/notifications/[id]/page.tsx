'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface NotifDetail {
  _id: string;
  type: string;
  title?: string;
  body?: string;
  message?: string;
  post_id?: string;
  post_title?: string;
  message_type?: string;
  created_by?: string;
  priority?: string;
  dismissed?: boolean;
  is_admin?: boolean;
  read: boolean;
  created_at: string;
}

export default function NotificationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [n, setN] = useState<NotifDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ notification: NotifDetail }>(`/users/me/notifications/${params.id}`);
      setN(data.notification);
    } catch {
      setN(null);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // Mark as read on mount for system notifications
  useEffect(() => {
    if (n && !n.is_admin && !n.read) {
      apiFetch(`/users/me/notifications/${n._id}/read`, { method: 'PATCH' }).catch(() => {});
    }
  }, [n]);

  const handleDismiss = async () => {
    setActionLoading(true);
    try {
      await apiFetch(`/users/me/messages/${params.id}/dismiss`, { method: 'PATCH' });
      setN((prev) => prev ? { ...prev, dismissed: true } : null);
    } catch {}
    setActionLoading(false);
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;
  if (!n) return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
      <h2 style={{ color: '#999' }}>Notification not found</h2>
      <p style={{ color: '#aaa', fontSize: '13px' }}>
        It may have been deleted, expired, or you don&rsquo;t have access to it.
      </p>
      <button onClick={() => router.push('/notifications')} style={{ marginTop: '12px', padding: '8px 16px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
        ← Back to notifications
      </button>
    </div>
  );

  const isAdmin = n.is_admin || n.type === 'admin_message';
  const PRIORITY_COLORS: Record<string, string> = { info: '#1565c0', important: '#e65100', urgent: '#c62828' };
  const pc = PRIORITY_COLORS[n.priority || 'info'];

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px' }}>
      <button onClick={() => router.push('/notifications')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '13px', marginBottom: '20px' }}>
        ← Back to notifications
      </button>

      <div style={{ border: '1px solid #eee', borderRadius: '8px', padding: '20px', background: isAdmin ? '#fafafa' : '#fff' }}>
        {isAdmin ? (
          <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '24px' }}>📬</span>
              <div>
                <h1 style={{ fontSize: '18px', margin: 0, color: '#333' }}>{n.title}</h1>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                  From: {n.created_by} · {n.message_type === 'broadcast' ? '📢 Broadcast to all users' : '👤 Private message'}
                  {n.priority && n.priority !== 'info' && (
                    <span style={{ marginLeft: '6px', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', background: pc, color: '#fff' }}>
                      {n.priority.toUpperCase()}
                    </span>
                  )}
                  {n.dismissed && (
                    <span style={{ marginLeft: '6px', color: '#2e7d32', fontSize: '11px' }}>✅ Dismissed</span>
                  )}
                </div>
              </div>
            </div>
            <p style={{ fontSize: '15px', color: '#444', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{n.body}</p>
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#999' }}>{new Date(n.created_at).toLocaleString()}</span>
              {!n.dismissed && (
                <button onClick={handleDismiss} disabled={actionLoading}
                  style={{ padding: '8px 16px', background: actionLoading ? '#ccc' : '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px', cursor: actionLoading ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
                  {actionLoading ? '...' : 'Dismiss'}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>
              {n.type === 'post_approved' ? '✅' : n.type === 'post_rejected' ? '❌' : '🔄'}
            </div>
            <h1 style={{ fontSize: '18px', margin: '0 0 4px', color: '#333' }}>
              {n.post_title}
            </h1>
            <div style={{ fontSize: '13px', color: '#999', marginBottom: '16px' }}>
              {n.type === 'post_approved' ? 'Your post was approved' : n.type === 'post_rejected' ? 'Your post was rejected' : 'Revision requested'}
            </div>
            <p style={{ fontSize: '15px', color: '#444', lineHeight: '1.7' }}>{n.message}</p>
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#999' }}>{new Date(n.created_at).toLocaleString()}</span>
              {n.post_id && (
                <a href={`/${n.post_id}`} style={{ color: '#1565c0', fontSize: '13px', textDecoration: 'none' }}>
                  View post →
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
