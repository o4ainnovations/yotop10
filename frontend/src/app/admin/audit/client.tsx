'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Icon } from '@/components/icons/Icon';
import { formatDate, formatTime } from '@/lib/dates';

interface AuditEntry {
  _id: string;
  action: string;
  ip: string;
  metadata: Record<string, unknown>;
  admin_id: string | null;
  created_at: string;
}

function actionBadge(action: string): { label: string; className: string } {
  if (action === 'login_success') return { label: 'Login Success', className: 'bg-green-500/20 text-green-400 border-green-500/30' };
  if (action === 'login_failed') return { label: 'Login Failed', className: 'bg-red-500/20 text-red-400 border-red-500/30' };
  if (action === 'logout') return { label: 'Logout', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  return { label: action, className: 'bg-white/5 text-white/50 border-white/10' };
}

export default function AdminAuditClient() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [filterAction, setFilterAction] = useState('');

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (filterAction) params.set('action', filterAction);
      const data = await apiFetch<{ logs: AuditEntry[]; pagination: { total: number; pages: number } }>(
        `/admin/audit-logs?${params}`
      );
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch { /* auth guard redirects */ }
    finally { setLoading(false); }
  }, [filterAction]);

  useEffect(() => { fetchLogs(page); }, [page, filterAction, fetchLogs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-white text-lg font-bold">Audit Logs</h2>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs outline-none focus:border-orange-500/50 min-h-9"
        >
          <option value="" className="bg-zinc-900">All Actions</option>
          <option value="login_success" className="bg-zinc-900">Login Success</option>
          <option value="login_failed" className="bg-zinc-900">Login Failed</option>
          <option value="logout" className="bg-zinc-900">Logout</option>
          <option value="approve_post" className="bg-zinc-900">Approve Post</option>
          <option value="reject_post" className="bg-zinc-900">Reject Post</option>
        </select>
        <button
          onClick={() => window.open('/api/admin/audit-logs/export', '_blank')}
          className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold cursor-pointer bg-green-700 hover:bg-green-600 transition-colors min-h-9 flex items-center gap-1.5"
        >
          <Icon name="Download" size={13} /> Export CSV
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-white/20 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="lg:hidden space-y-2">
            {logs.map((log) => {
              const badge = actionBadge(log.action);
              const username = (log.metadata as Record<string, string>)?.username
                || (log.metadata as Record<string, string>)?.username_attempted
                || '--';
              const stage = (log.metadata as Record<string, string>)?.stage || '';
              return (
                <div key={log._id} className="bg-white/5 border border-white/5 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-2xs font-bold border ${badge.className}`}>
                      {badge.label}
                    </span>
                    <span className="text-3xs text-white/30 font-mono">{log.ip}</span>
                  </div>
                  <div className="text-xs text-white/50" suppressHydrationWarning>
                    {formatDate(log.created_at)} {formatTime(log.created_at)}
                  </div>
                  <div className="text-sm text-white/70">
                    {username}
                  </div>
                  {stage && (
                    <div className="text-3xs text-white/30">{stage}</div>
                  )}
                </div>
              );
            })}
            {logs.length === 0 && !loading && (
              <div className="bg-white/5 border border-white/5 rounded-2xl p-10 text-center">
                <p className="text-white/40 text-sm">No audit logs found.</p>
              </div>
            )}
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-collapse text-sm2">
              <thead>
                <tr className="border-b-2 border-white/10 text-left text-white/40">
                  <th className="p-2.5">Time</th>
                  <th className="p-2.5">Action</th>
                  <th className="p-2.5">Username</th>
                  <th className="p-2.5">IP</th>
                  <th className="p-2.5">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const badge = actionBadge(log.action);
                  return (
                    <tr key={log._id} className="border-b border-white/5">
                      <td className="p-2.5 text-white/40 text-xs" suppressHydrationWarning>{formatDate(log.created_at)} {formatTime(log.created_at)}</td>
                      <td className="p-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-2xs font-bold border ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-2.5 text-white/60 text-xs">
                        {(log.metadata as Record<string, string>)?.username ||
                         (log.metadata as Record<string, string>)?.username_attempted || '--'}
                      </td>
                      <td className="p-2.5 text-white/30 text-xs font-mono">{log.ip}</td>
                      <td className="p-2.5 text-white/30 text-xs">
                        {(log.metadata as Record<string, string>)?.stage || ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pagination.pages > 1 && (
        <div className="flex gap-3 justify-center items-center pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer min-h-9 transition-colors ${
              page === 1
                ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            }`}
          >
            Prev
          </button>
          <span className="text-xs text-white/40">Page {page} of {pagination.pages} ({pagination.total} total)</span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page >= pagination.pages}
            className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer min-h-9 transition-colors ${
              page >= pagination.pages
                ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            }`}
          >
            Next
          </button>
        </div>
      )}

      <p className="text-3xs text-white/30 pt-2">Logs retained for 90 days. Read-only.</p>
    </div>
  );
}
