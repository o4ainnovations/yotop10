'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Icon } from '@/components/icons/Icon';
import { formatDate, formatTime } from '@/lib/dates';

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

export default function NotificationDetailClient() {
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

  const PRIORITY_COLORS: Record<string, string> = { info: 'text-blue-400', important: 'text-orange-400', urgent: 'text-red-400' };
  const PRIORITY_BG: Record<string, string> = { info: 'bg-blue-500/20', important: 'bg-orange-500/20', urgent: 'bg-red-500/20' };

  if (loading) return <div className="p-5 text-white/40">Loading...</div>;
  if (!n) return (
    <div className="max-w-[700px] mx-auto px-3 sm:px-5 py-10 text-center">
      <h2 className="text-white/40 text-lg">Notification not found</h2>
      <p className="text-white/30 text-sm2 mt-1">
        It may have been deleted, expired, or you don&rsquo;t have access to it.
      </p>
      <button onClick={() => router.push('/notifications')} className="mt-3 px-4 py-2 bg-blue-700 text-white border-none rounded-xl cursor-pointer text-sm font-bold min-h-10">
        <Icon name="ArrowLeft" size={16} className="inline mr-1" /> Back to notifications
      </button>
    </div>
  );

  const isAdmin = n.is_admin || n.type === 'admin_message';
  const pc = n.priority || 'info';
  const priorityTextColor = PRIORITY_COLORS[pc];
  const priorityBg = PRIORITY_BG[pc];

  return (
    <div className="max-w-[700px] mx-auto px-3 sm:px-5 py-5">
      <button onClick={() => router.push('/notifications')} className="bg-transparent border-none text-white/50 cursor-pointer text-sm2 mb-5 hover:text-white/80">
        <Icon name="ArrowLeft" size={16} className="inline mr-1" /> Back to notifications
      </button>

      <div className="border border-white/10 rounded-xl p-5 bg-white/5">
        {isAdmin ? (
          <>
            <div className="flex gap-2 items-start mb-3">
              <span className="text-2xl"><Icon name="Mail" size={24} /></span>
              <div>
                <h1 className="text-lg font-bold text-white m-0">{n.title}</h1>
                <div className="text-xs text-white/40 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                  <span>From: {n.created_by}</span>
                  <span>· {n.message_type === 'broadcast' ? <><Icon name="Megaphone" size={12} /> Broadcast to all users</> : <><Icon name="User" size={12} /> Private message</>}</span>
                  {n.priority && n.priority !== 'info' && (
                    <span className={`ml-0 rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wider ${priorityBg} ${priorityTextColor}`}>
                      {n.priority.toUpperCase()}
                    </span>
                  )}
                  {n.dismissed && (
                    <span className="text-green-400 text-3xs"><Icon name="Check" size={12} color="#2e7d32" /> Dismissed</span>
                  )}
                </div>
              </div>
            </div>
            <p className="text-base2 text-white/70 leading-relaxed whitespace-pre-wrap">{n.body}</p>
            <div className="mt-5 pt-4 border-t border-white/10 flex justify-between items-center">
              <span className="text-xs text-white/30" suppressHydrationWarning>{formatDate(n.created_at)} {formatTime(n.created_at)}</span>
              {!n.dismissed && (
                <button onClick={handleDismiss} disabled={actionLoading}
                  className={`px-4 py-2 border border-white/10 rounded-xl cursor-pointer text-sm2 min-h-10 ${actionLoading ? 'bg-white/5 cursor-not-allowed text-white/30' : 'bg-white/5 text-white hover:bg-white/10'}`}>
                  {actionLoading ? '...' : 'Dismiss'}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mb-2">
              {n.type === 'post_approved' ? <Icon name="Check" size={24} color="#2e7d32" /> : n.type === 'post_rejected' ? <Icon name="X" size={24} color="#c62828" /> : <Icon name="RefreshCw" size={24} color="#f57c00" />}
            </div>
            <h1 className="text-lg font-bold text-white mb-1">
              {n.post_title}
            </h1>
            <div className="text-sm2 text-white/40 mb-4">
              {n.type === 'post_approved' ? 'Your post was approved' : n.type === 'post_rejected' ? 'Your post was rejected' : 'Revision requested'}
            </div>
            <p className="text-base2 text-white/70 leading-relaxed">{n.message}</p>
            <div className="mt-5 pt-4 border-t border-white/10 flex justify-between items-center">
              <span className="text-xs text-white/30" suppressHydrationWarning>{formatDate(n.created_at)} {formatTime(n.created_at)}</span>
              {n.post_id && (
                <a href={`/${n.post_id}`} className="text-orange-400 text-sm2 no-underline hover:text-orange-300">
                  View post <Icon name="ArrowRight" size={14} className="inline" />
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
