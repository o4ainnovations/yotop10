'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Icon, type LucideIconName } from './icons/Icon';

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

const TYPE_ICON: Record<string, string> = {
  post_approved: 'Check',
  post_rejected: 'X',
  revision_requested: 'RefreshCw',
  admin_message: 'Mail',
};

const PRIORITY_CLASSES: Record<string, string> = {
  info: 'bg-blue-500/10 border-blue-500/30',
  important: 'bg-orange-500/10 border-orange-500/30',
  urgent: 'bg-red-500/10 border-red-500/30',
};

export default function NotificationBell() {
  const router = useRouter();
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
        '/users/me/notifications?limit=10&unread=true'
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

  const handleClick = async (n: NotificationItem) => {
    setOpen(false);
    if (n.is_admin || n.type === 'admin_message') {
      try { await apiFetch(`/users/me/messages/${n._id}/dismiss`, { method: 'PATCH' }); } catch {}
    } else {
      try { await apiFetch(`/users/me/notifications/${n._id}/read`, { method: 'PATCH' }); } catch {}
    }
    setNotifications((prev) => prev.filter((x) => x._id !== n._id));
    fetchCount();
    router.push(`/notifications/${n._id}`);
  };

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
    <div className="relative inline-block">
      <button
        onClick={handleBellClick}
        className={`relative text-lg cursor-pointer px-3 py-1.5 rounded-lg border min-h-10 ${unreadCount > 0 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-transparent border-white/10'}`}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        <Icon name="Bell" size={20} color={unreadCount > 0 ? '#90caf9' : '#888'} strokeWidth={2.5} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white rounded-full w-[18px] h-[18px] text-3xs font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[99]"
            onClick={() => setOpen(false)}
          />
          <div className="fixed top-[52px] right-5 w-[400px] max-w-[calc(100vw-2rem)] max-h-[450px] overflow-y-auto bg-zinc-900 border border-white/10 rounded-xl shadow-lg z-[100] py-2">
            <div className="flex justify-between px-4 py-2 border-b border-white/5">
              <strong className="text-white text-sm">Notifications</strong>
              {notifications.length > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="bg-transparent border-none text-orange-400 cursor-pointer text-sm2 font-medium"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="p-4 text-center text-white/40 text-sm">No notifications yet</div>
            ) : (
              notifications.map((n) => {
                const isAdmin = n.is_admin || n.type === 'admin_message';
                const pc = PRIORITY_CLASSES[n.priority || 'info'];
                return (
                  <div
                    key={n._id}
                    onClick={() => handleClick(n)}
                    className={`px-4 py-2.5 cursor-pointer border-b border-white/5 border-l-[3px] text-sm2 leading-relaxed ${
                      isAdmin ? pc : n.read ? 'bg-transparent border-l-transparent text-white/40' : 'bg-white/5 border-l-transparent text-white'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="mr-1.5"><Icon name={(TYPE_ICON[n.type] || 'Pin') as LucideIconName} size={14} /></span>
                        {isAdmin ? (
                          <>
                            <strong className="text-sm2 text-white">{n.title}</strong>
                            {n.priority && n.priority !== 'info' && (
                              <span className="ml-1.5 rounded-full px-1.5 py-px text-2xs font-bold uppercase tracking-wider text-white bg-orange-500 border border-orange-500/30">
                                {n.priority.toUpperCase()}
                              </span>
                            )}
                            <div className="text-white/50 mt-1 text-xs">
                              {n.body?.substring(0, 100)}{(n.body?.length || 0) > 100 ? '...' : ''}
                            </div>
                            <div className="text-3xs text-white/30 mt-0.5">
                              From: {n.created_by} · {n.message_type === 'broadcast' ? <><Icon name="Megaphone" size={11} /> Broadcast</> : <><Icon name="User" size={11} /> Private</>}
                            </div>
                          </>
                        ) : (
                          n.message
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={(e) => handleDismissAdmin(e, n._id)}
                          className="bg-transparent border-none text-white/30 cursor-pointer text-base px-1 py-0 flex-shrink-0 hover:text-white/60"
                          aria-label="Dismiss" title="Dismiss"
                        >
                          <Icon name="X" size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            <div className="px-4 py-2 border-t border-white/5 text-center">
              <Link href="/notifications" className="text-sm2 text-orange-400 no-underline hover:text-orange-300" onClick={() => setOpen(false)}>
                See all notifications <Icon name="ArrowRight" size={14} className="inline" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
