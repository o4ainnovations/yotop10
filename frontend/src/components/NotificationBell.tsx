'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface NotificationItem {
  _id: string;
  type: 'post_approved' | 'post_rejected' | 'revision_requested' | 'admin_message';
  post_id?: string;
  post_title?: string;
  message?: string;
  title?: string;
  body?: string;
  priority?: string;
  message_type?: string;
  created_by?: string;
  is_admin?: boolean;
  read: boolean;
  created_at: string;
}

const TYPE_EMOJI: Record<string, string> = {
  post_approved: '✅',
  post_rejected: '❌',
  revision_requested: '🔄',
  admin_message: '📬',
};

const PRIORITY_COLORS: Record<string, { bg: string; border: string }> = {
  info: { bg: '#e3f2fd', border: '#90caf9' },
  important: { bg: '#fff3e0', border: '#ffb74d' },
  urgent: { bg: '#ffebee', border: '#ef9a9a' },
};

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  const fetchCount = useCallback(async () => {
    try {
      const data = await apiFetch<{ count: number }>('/users/me/notifications/unread-count');
      setUnreadCount(data.count || 0);
    } catch { /* not authenticated — ignore */ }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiFetch<{ notifications: NotificationItem[]; unreadCount: number }>(
        '/users/me/notifications?limit=10'
      );
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  const handleBellClick = () => {
    if (!open) fetchNotifications();
    setOpen(!open);
  };

  const handleDismissAdmin = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await apiFetch(`/users/me/messages/${id}/dismiss`, { method: 'PATCH' });
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      fetchCount();
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/users/me/notifications/read-all', { method: 'PATCH' });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* ignore */ }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={handleBellClick}
        style={{
          background: unreadCount > 0 ? '#e3f2fd' : 'transparent',
          border: '1px solid #ddd',
          fontSize: '18px',
          cursor: 'pointer',
          position: 'relative',
          padding: '6px 12px',
          borderRadius: '6px',
        }}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              backgroundColor: '#f44336',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              fontSize: '11px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: '52px',
              right: '20px',
              width: '400px',
              maxHeight: '450px',
              overflowY: 'auto',
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              zIndex: 100,
              padding: '8px 0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #eee' }}>
              <strong>Notifications</strong>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{ background: 'none', border: 'none', color: '#2196f3', cursor: 'pointer', fontSize: '13px' }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>No notifications yet</div>
            ) : (
              notifications.map((n) => {
                const isAdmin = n.is_admin || n.type === 'admin_message';
                const pc = PRIORITY_COLORS[n.priority || 'info'];
                return (
                  <div
                    key={n._id}
                    onClick={() => !isAdmin && setOpen(false)}
                    style={{
                      padding: '10px 16px',
                      color: n.read && !isAdmin ? '#666' : '#000',
                      backgroundColor: isAdmin ? pc.bg : (n.read ? 'transparent' : '#f5f5f5'),
                      borderBottom: '1px solid #f0f0f0',
                      borderLeft: isAdmin ? `3px solid ${pc.border}` : '3px solid transparent',
                      fontSize: '13px',
                      lineHeight: '1.4',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ marginRight: '6px' }}>{TYPE_EMOJI[n.type] || '📌'}</span>
                        {isAdmin ? (
                          <>
                            <strong style={{ fontSize: '13px' }}>{n.title}</strong>
                            {n.priority && n.priority !== 'info' && (
                              <span style={{ marginLeft: '6px', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold', background: pc.border, color: '#fff' }}>
                                {n.priority.toUpperCase()}
                              </span>
                            )}
                            <div style={{ color: '#555', marginTop: '3px', fontSize: '12px' }}>
                              {n.body?.substring(0, 100)}{(n.body?.length || 0) > 100 ? '...' : ''}
                            </div>
                            <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                              From: {n.created_by} · {n.message_type === 'broadcast' ? '📢 Broadcast' : '👤 Private'}
                            </div>
                          </>
                        ) : (
                          n.message
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={(e) => handleDismissAdmin(e, n._id)}
                          style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '16px', padding: '0 4px', flexShrink: 0 }}
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

            <div style={{ padding: '8px 16px', borderTop: '1px solid #eee', textAlign: 'center' }}>
              <span style={{ fontSize: '13px', color: '#999' }}>Notifications are per-device</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
