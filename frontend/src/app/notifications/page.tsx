'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Icon, type LucideIconName } from '@/components/icons/Icon';

interface NotifItem {
  _id: string;
  type: string;
  title?: string;
  body?: string;
  message?: string;
  message_type?: string;
  post_title?: string;
  created_by?: string;
  priority?: string;
  is_admin?: boolean;
  read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, string> = {
  post_approved: 'Check', post_rejected: 'X', revision_requested: 'RefreshCw', admin_message: 'Mail',
};

const PRIORITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  info: { bg: '#e3f2fd', border: '#90caf9', text: '#1565c0' },
  important: { bg: '#fff3e0', border: '#ffb74d', text: '#e65100' },
  urgent: { bg: '#ffebee', border: '#ef9a9a', text: '#c62828' },
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifs, setNotifications] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ notifications: NotifItem[] }>('/users/me/notifications?limit=50');
      setNotifications(data.notifications);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleClick = async (n: NotifItem) => {
    if (!n.is_admin && n.type !== 'admin_message') {
      try { await apiFetch(`/users/me/notifications/${n._id}/read`, { method: 'PATCH' }); } catch {}
    }
    router.push(`/notifications/${n._id}`);
  };

  const handleDismissAdmin = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await apiFetch(`/users/me/messages/${id}/dismiss`, { method: 'PATCH' });
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch {}
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="Bell" size={20} /> All Notifications</h1>

      {notifs.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#999', fontSize: '14px' }}>
          No notifications yet
        </div>
      ) : (
        notifs.map((n) => {
          const isAdmin = n.is_admin || n.type === 'admin_message';
          const pc = PRIORITY_COLORS[n.priority || 'info'];
          return (
            <div
              key={n._id}
              onClick={() => handleClick(n)}
              style={{
                padding: '14px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #eee',
                borderLeft: isAdmin ? `4px solid ${pc.border}` : '4px solid transparent',
                backgroundColor: n.read && !isAdmin ? 'transparent' : (isAdmin ? pc.bg : '#fafafa'),
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                    <span><Icon name={(TYPE_ICON[n.type] || 'Pin') as LucideIconName} size={14} /></span>
                    <strong style={{ fontSize: '14px', color: n.read && !isAdmin ? '#999' : '#333' }}>
                      {isAdmin ? n.title : n.post_title || n.type}
                    </strong>
                    {isAdmin && n.priority && n.priority !== 'info' && (
                      <span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', background: pc.border, color: '#fff' }}>
                        {n.priority.toUpperCase()}
                      </span>
                    )}
                    {!isAdmin && !n.read && (
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2196f3', flexShrink: 0 }} />
                    )}
                  </div>
                  <p style={{ margin: '0', fontSize: '13px', color: '#555', lineHeight: '1.5' }}>
                    {isAdmin ? n.body?.substring(0, 200) : n.message}
                  </p>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                    {new Date(n.created_at).toLocaleString()}
                    {isAdmin && (
                      <span style={{ marginLeft: '8px' }}>
                        From: {n.created_by} · {n.message_type === 'broadcast' ? <><Icon name="Megaphone" size={11} /> Broadcast</> : <><Icon name="User" size={11} /> Private</>}
                      </span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={(e) => handleDismissAdmin(e, n._id)}
                    style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '16px', padding: '4px 8px', flexShrink: 0 }}
                    title="Dismiss"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
