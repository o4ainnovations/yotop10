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

const PRIORITY_CLASSES: Record<string, string> = {
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  important: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  urgent: 'bg-red-500/10 border-red-500/30 text-red-400',
};

export default function NotificationsClient() {
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

  if (loading) return <div className="p-5 text-white/40">Loading...</div>;

  return (
    <div className="max-w-[700px] mx-auto px-3 sm:px-5 py-5">
      <h1 className="text-xl font-bold mb-5 flex items-center gap-2 text-white"><Icon name="Bell" size={20} /> All Notifications</h1>

      {notifs.length === 0 ? (
        <div className="p-10 text-center text-white/40 text-sm">
          No notifications yet
        </div>
      ) : (
        notifs.map((n) => {
          const isAdmin = n.is_admin || n.type === 'admin_message';
          const pc = PRIORITY_CLASSES[n.priority || 'info'];
          return (
            <div
              key={n._id}
              onClick={() => handleClick(n)}
              className={`px-4 py-3.5 cursor-pointer border-b border-white/5 border-l-4 min-h-11 transition-colors ${isAdmin ? `${pc}` : n.read ? 'bg-transparent border-l-transparent' : 'bg-white/5 border-l-transparent'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex gap-2 items-center mb-1">
                    <span><Icon name={(TYPE_ICON[n.type] || 'Pin') as LucideIconName} size={14} /></span>
                    <strong className={`text-sm ${n.read && !isAdmin ? 'text-white/30' : 'text-white'}`}>
                      {isAdmin ? n.title : n.post_title || n.type}
                    </strong>
                    {isAdmin && n.priority && n.priority !== 'info' && (
                      <span className={`rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wider ${pc} border`}>
                        {n.priority.toUpperCase()}
                      </span>
                    )}
                    {!isAdmin && !n.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm2 text-white/60 leading-relaxed mt-0">
                    {isAdmin ? n.body?.substring(0, 200) : n.message}
                  </p>
                  <div className="text-3xs text-white/30 mt-1">
                    {new Date(n.created_at).toLocaleString()}
                    {isAdmin && (
                      <span className="ml-2">
                        From: {n.created_by} · {n.message_type === 'broadcast' ? <><Icon name="Megaphone" size={11} /> Broadcast</> : <><Icon name="User" size={11} /> Private</>}
                      </span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={(e) => handleDismissAdmin(e, n._id)}
                    className="bg-transparent border-none text-white/30 cursor-pointer text-base px-2 py-1 flex-shrink-0 hover:text-white/60"
                    title="Dismiss"
                  >
                    <Icon name="X" size={16} />
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
