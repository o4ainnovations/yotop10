'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface NotificationItem {
  _id: string;
  type: 'post_approved' | 'post_rejected' | 'revision_requested';
  post_id: string;
  post_title: string;
  message: string;
  read: boolean;
  created_at: string;
}

const TYPE_EMOJI: Record<string, string> = {
  post_approved: '✅',
  post_rejected: '❌',
  revision_requested: '🔄',
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
        '/users/me/notifications?limit=5'
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
    if (!open) {
      fetchNotifications();
    }
    setOpen(!open);
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/users/me/notifications/read-all', { method: 'PATCH' });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* ignore */ }
  };

  if (unreadCount === 0 && !open) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={handleBellClick}
        style={{
          background: 'none',
          border: 'none',
          fontSize: '20px',
          cursor: 'pointer',
          position: 'relative',
          padding: '4px 8px',
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
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              width: '360px',
              maxHeight: '400px',
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
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'block',
                    padding: '10px 16px',
                    textDecoration: 'none',
                    color: n.read ? '#666' : '#000',
                    backgroundColor: n.read ? 'transparent' : '#f5f5f5',
                    borderBottom: '1px solid #f0f0f0',
                    fontSize: '13px',
                    lineHeight: '1.4',
                  }}
                >
                  <span style={{ marginRight: '6px' }}>{TYPE_EMOJI[n.type] || '📌'}</span>
                  {n.message}
                </div>
              ))
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
