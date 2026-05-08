'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface AlertNotification {
  _id: string;
  alert_type: string;
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  value: number;
  threshold: number;
  read: boolean;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  pending_queue_depth: 'Review Queue',
  approval_rate_drop: 'Approval Rate',
  zero_review_hours: 'No Reviews',
  comment_brigade: 'Brigade',
  es_index_gap_pct: 'Search Gap',
  restricted_user_surge: 'Restricted Users',
  new_user_spam_wave: 'Spam Wave',
  scholar_ratio_collapse: 'Scholar Ratio',
  flagged_comment_backlog: 'Flagged Comments',
  hidden_comment_surge: 'Hidden Surge',
  post_quality_drop: 'Quality Drop',
  snapshot_staleness: 'Stale Snapshot',
};

export default function AdminAlertBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchCount = useCallback(async () => {
    try {
      const data = await apiFetch<{ unread: number }>('/admin/alerts/notifications/count');
      setUnreadCount(data.unread || 0);
    } catch { /* not authenticated */ }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiFetch<{ notifications: AlertNotification[] }>(
        '/admin/alerts/notifications?limit=5'
      );
      setNotifications(data.notifications);
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

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/admin/alerts/notifications/read-all', { method: 'PATCH' });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* ignore */ }
  };

  const handleDismiss = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await apiFetch(`/admin/alerts/notifications/${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      fetchCount();
    } catch { /* ignore */ }
  };

  const severityColor = (s: string) => (s === 'critical' ? '#d32f2f' : '#f57c00');
  const severityBg = (s: string) => (s === 'critical' ? '#ffebee' : '#fff3e0');

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={handleBellClick}
        style={{
          background: unreadCount > 0 ? '#fff3e0' : 'transparent',
          border: unreadCount > 0 ? '2px solid #ff9800' : '1px solid #444',
          color: unreadCount > 0 ? '#e65100' : '#888',
          fontSize: '18px',
          cursor: 'pointer',
          position: 'relative',
          padding: '6px 12px',
          borderRadius: '6px',
          transition: 'all 0.2s',
        }}
        aria-label={`Alerts ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        title="Admin Alerts"
      >
        🚨
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#d32f2f',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              fontSize: '11px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
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
              maxHeight: '480px',
              overflowY: 'auto',
              backgroundColor: '#FFF8F0',
              border: '1px solid #E8D5C4',
              borderRadius: '8px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
              zIndex: 100,
              padding: '8px 0',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 16px', borderBottom: '1px solid #EFEBE0',
            }}>
              <strong style={{ color: '#3E2723', fontSize: '14px' }}>🚨 Alerts</strong>
              <div style={{ display: 'flex', gap: '8px' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{ background: 'none', border: 'none', color: '#D84315', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Mark all read
                  </button>
                )}
                <a href="/admin/alerts" style={{ color: '#8D6E63', fontSize: '12px', textDecoration: 'none' }} onClick={() => setOpen(false)}>
                  View all →
                </a>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#A1887F', fontSize: '13px' }}>
                ✅ No active alerts
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: n.read ? 'transparent' : severityBg(n.severity),
                    borderBottom: '1px solid #EFEBE0',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 'bold', color: severityColor(n.severity), fontSize: '12px' }}>
                      [{n.severity.toUpperCase()}]
                    </span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ color: '#A1887F', fontSize: '11px' }}>
                        {new Date(n.created_at).toLocaleTimeString()}
                      </span>
                      <button
                        onClick={(e) => handleDismiss(e, n._id)}
                        style={{ background: 'none', border: 'none', color: '#8D6E63', cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1 }}
                        title="Dismiss"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div style={{ color: '#5D4037', marginTop: '2px' }}>
                    <span style={{ color: '#8D6E63', fontSize: '11px' }}>
                      {TYPE_LABELS[n.alert_type] || n.alert_type}
                    </span>
                  </div>
                  <div style={{ color: '#3E2723', marginTop: '2px' }}>
                    {n.message}
                  </div>
                </div>
              ))
            )}

            <div style={{
              padding: '8px 16px', borderTop: '1px solid #EFEBE0', textAlign: 'center',
              fontSize: '11px', color: '#A1887F',
            }}>
              Runs every 60s · <a href="/admin/alerts" style={{ color: '#8D6E63' }}>Manage thresholds</a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
